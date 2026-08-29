import path from "node:path";
import type { InitOptions } from "../args.js";
import {
  readAgentList,
  readCsrfToken,
  readHealth,
  readProject,
  readProjectList,
  readRegisteredAgent,
  type ProjectSummary,
} from "../apiShapes.js";
import { AGENT_KEY_PREFIX, CLAUDE_MCP_FILE, CLI_NAME, CURSOR_MCP_FILE } from "../constants.js";
import { CliError } from "../errors.js";
import { ApiClient } from "../http.js";
import {
  ensureIgnoreFile,
  protectMcpFilesInGitignore,
  readLocalConnections,
  writeMcpConfigs,
} from "../localConfig.js";
import { buildServerEntry } from "../mcpConfig.js";
import { createPrompter, type Prompter } from "../prompt.js";
import { redactKey } from "../redact.js";
import { info, ok, out, style, warn } from "../ui.js";
import { resolveContextosRoot } from "../workspace.js";

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function defaultProjectName(cwd: string): string {
  return path.basename(cwd).slice(0, 80) || "My project";
}

function defaultAgentName(cwd: string): string {
  const base = slug(path.basename(cwd));
  return base === "" ? "local-agent" : `${base}-agent`;
}

function defaultDisplayName(email: string): string {
  return (email.split("@")[0] ?? "Developer").slice(0, 80);
}

async function checkHealth(api: ApiClient): Promise<void> {
  const response = await api.get("/api/health", { allow: [503] });
  const health = readHealth(response.body);
  if (!health.ok) {
    throw new CliError(
      `The ContextOS API at ${api.baseUrl} answered but its database is ${health.db}. Start Postgres, then re-run.`,
    );
  }
  ok("API", `${api.baseUrl} · v${health.version} · db ${health.db}`);
}

async function signIn(api: ApiClient, prompter: Prompter, options: InitOptions): Promise<string> {
  const email = options.email ?? (await prompter.ask("Email", process.env["CONTEXTOS_EMAIL"]));
  const password = options.password ?? process.env["CONTEXTOS_PASSWORD"] ?? (await prompter.secret("Password"));

  const login = await api.post("/api/v1/auth/login", { email, password }, { allow: [401] });
  if (login.status !== 401) {
    ok("Account", `${email} (signed in)`);
    return finishSession(api, login.body, email);
  }

  const create = await prompter.confirm(`No account matched ${email}. Create one now?`, true);
  if (!create) {
    throw new CliError(`Sign-in failed for ${email}. Re-run with the correct --password.`);
  }
  const name = await prompter.ask("Display name", defaultDisplayName(email));
  const registered = await api.post(
    "/api/v1/auth/register",
    { email, password, name },
    { allow: [400, 409] },
  );
  if (registered.status === 409) {
    throw new CliError(`${email} already has an account but that password was rejected. Re-run with the right one.`);
  }
  if (registered.status === 400) {
    throw new CliError("The password must be at least 10 characters and include a letter and a number.");
  }
  ok("Account", `${email} (created)`);
  return finishSession(api, registered.body, email);
}

function finishSession(api: ApiClient, body: unknown, email: string): string {
  const csrfToken = readCsrfToken(body);
  if (!api.hasSession || csrfToken === "") {
    throw new CliError(`The API accepted ${email} but returned no session cookie or CSRF token. Check the API logs.`);
  }
  api.useCsrfToken(csrfToken);
  return csrfToken;
}

async function createProject(api: ApiClient, name: string, cwd: string): Promise<ProjectSummary> {
  const created = await api.post("/api/v1/projects", { name, rootPath: cwd });
  return readProject(created.body);
}

async function selectProject(
  api: ApiClient,
  prompter: Prompter,
  options: InitOptions,
  cwd: string,
): Promise<ProjectSummary> {
  const projects = readProjectList((await api.get("/api/v1/projects")).body);

  if (options.project !== undefined) {
    const match = projects.find((project) => project.name.toLowerCase() === options.project?.toLowerCase());
    if (match) {
      ok("Project", `${match.name} (${match.id})`);
      return match;
    }
    const created = await createProject(api, options.project, cwd);
    ok("Project", `${created.name} (${created.id}, created)`);
    return created;
  }

  if (projects.length === 0 || options.yes) {
    const existing = projects[0];
    if (existing && options.yes) {
      ok("Project", `${existing.name} (${existing.id})`);
      return existing;
    }
    const created = await createProject(api, defaultProjectName(cwd), cwd);
    ok("Project", `${created.name} (${created.id}, created)`);
    return created;
  }

  out();
  out(style.bold("Projects"));
  projects.forEach((project, index) => out(`  ${index + 1}  ${project.name}`));
  out(`  n  create a new project for ${path.basename(cwd)}`);
  const answer = await prompter.ask("Choose", "1");
  if (answer.toLowerCase() === "n") {
    const name = await prompter.ask("Project name", defaultProjectName(cwd));
    const created = await createProject(api, name, cwd);
    ok("Project", `${created.name} (${created.id}, created)`);
    return created;
  }
  const chosen = projects[Number(answer) - 1];
  if (!chosen) {
    throw new CliError(`"${answer}" is not one of the ${projects.length} listed projects.`);
  }
  ok("Project", `${chosen.name} (${chosen.id})`);
  return chosen;
}

async function reusableKey(baseUrl: string, projectId: string, cwd: string): Promise<{ key: string; label: string } | undefined> {
  for (const local of readLocalConnections(cwd)) {
    const key = local.connection.agentKey;
    if (!key?.startsWith(AGENT_KEY_PREFIX) || local.connection.projectId !== projectId) continue;
    const probe = new ApiClient(baseUrl);
    probe.useAgentKey(key);
    const response = await probe.get(`/api/v1/projects/${projectId}`, { allow: [401, 403, 404] });
    if (response.ok) return { key, label: local.label };
  }
  return undefined;
}

async function obtainAgentKey(
  api: ApiClient,
  prompter: Prompter,
  options: InitOptions,
  project: ProjectSummary,
  cwd: string,
): Promise<string> {
  if (!options.newKey) {
    const reuse = await reusableKey(api.baseUrl, project.id, cwd);
    if (reuse) {
      info("Agent", `reusing the key in ${reuse.label} (${redactKey(reuse.key)}) — pass --new-key to register another`);
      return reuse.key;
    }
  }

  const name = options.agent ?? (await prompter.ask("Agent name", defaultAgentName(cwd)));
  const existing = readAgentList((await api.get(`/api/v1/projects/${project.id}/agents`)).body);
  if (existing.some((agent) => agent.name.toLowerCase() === name.toLowerCase())) {
    warn(`An agent called "${name}" already exists; registering a second one. Revoke unused agents in the dashboard.`);
  }

  const registered = readRegisteredAgent(
    (await api.post(`/api/v1/projects/${project.id}/agents/register`, { name, kind: "mcp" })).body,
  );
  if (!registered.apiKey.startsWith(AGENT_KEY_PREFIX)) {
    throw new CliError("The API registered the agent but returned no usable key. Check the API logs.");
  }
  ok("Agent", `${registered.name} · key ${redactKey(registered.apiKey)}`);
  return registered.apiKey;
}

export async function runInit(options: InitOptions, cwd: string): Promise<void> {
  const contextosRoot = resolveContextosRoot(options.mcpCwd, cwd);
  const api = new ApiClient(options.api);
  const prompter = createPrompter(options.yes);

  try {
    await checkHealth(api);
    await signIn(api, prompter, options);
    const project = await selectProject(api, prompter, options, cwd);
    const agentKey = await obtainAgentKey(api, prompter, options, project, cwd);

    const entry = buildServerEntry({ contextosRoot, apiUrl: api.baseUrl, agentKey, projectId: project.id });
    const written = writeMcpConfigs(cwd, entry);
    const changed = written.filter((result) => result.changed).map((result) => result.label);
    const unchanged = written.filter((result) => !result.changed).map((result) => result.label);
    if (changed.length > 0) ok("MCP config", changed.join(", "));
    if (unchanged.length > 0) info("MCP config", `${unchanged.join(", ")} already up to date`);

    const ignore = ensureIgnoreFile(cwd);
    if (ignore.changed) ok("Ignore file", `${ignore.label} seeded with defaults`);
    else info("Ignore file", `${ignore.label} left as is`);

    const gitignore = protectMcpFilesInGitignore(cwd);
    if (!gitignore.present) {
      warn(`No .gitignore here. Add ${CLAUDE_MCP_FILE} and ${CURSOR_MCP_FILE} to yours: they hold an agent key.`);
    } else if (gitignore.added.length > 0) {
      ok(".gitignore", `ignored ${gitignore.added.join(", ")}`);
    } else {
      info(".gitignore", `${CLAUDE_MCP_FILE} and ${CURSOR_MCP_FILE} already ignored`);
    }

    out();
    out(style.bold("Next"));
    out(`  1. Restart Cursor or Claude Code so it loads the "contextos" MCP server.`);
    out(`  2. ${CLI_NAME} status`);
    out(`  3. ${CLI_NAME} brief`);
    out();
    out(
      style.dim(
        `The full key lives only in ${CLAUDE_MCP_FILE} and ${CURSOR_MCP_FILE}. ContextOS will not show it again.`,
      ),
    );
  } finally {
    prompter.close();
  }
}
