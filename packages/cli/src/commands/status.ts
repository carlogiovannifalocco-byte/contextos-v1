import type { StatusOptions } from "../args.js";
import { countOpenConflicts, readAgentList, readHealth, readProjectDetail } from "../apiShapes.js";
import { requireConnection } from "../connection.js";
import { CLI_NAME } from "../constants.js";
import { CliError } from "../errors.js";
import { ApiClient } from "../http.js";
import { discoverConnection } from "../localConfig.js";
import { info, ok, out, style, warn } from "../ui.js";

function rejected(status: number, projectId: string): CliError {
  if (status === 401 || status === 403) {
    return new CliError(
      `The agent key was rejected (${status}). Re-run "${CLI_NAME} init --new-key" to mint a fresh one.`,
    );
  }
  return new CliError(`Project ${projectId} is not visible to this agent key (404). Re-run "${CLI_NAME} init".`);
}

export async function runStatus(options: StatusOptions, cwd: string): Promise<void> {
  const discovered = discoverConnection(options, cwd);
  const api = new ApiClient(discovered.apiUrl.value);

  const health = readHealth((await api.get("/api/health", { allow: [503] })).body);
  if (health.ok) ok("API", `${api.baseUrl} · v${health.version} · db ${health.db}`);
  else warn(`API ${api.baseUrl} is up but its database is ${health.db}.`);

  const connection = requireConnection(discovered);
  api.useAgentKey(connection.agentKey);

  const projectResponse = await api.get(`/api/v1/projects/${connection.projectId}`, { allow: [401, 403, 404] });
  if (!projectResponse.ok) throw rejected(projectResponse.status, connection.projectId);
  const project = readProjectDetail(projectResponse.body);
  ok("Project", `${project.name} (${project.id})`);
  info(
    "Counts",
    `${project.counts.memories} memory · ${project.counts.tasks} tasks · ${project.counts.agents} agents · ${project.counts.conflicts} conflicts`,
  );

  const openConflicts = countOpenConflicts((await api.get(`/api/v1/projects/${project.id}/conflicts`)).body);
  if (openConflicts > 0) warn(`${openConflicts} open conflict${openConflicts === 1 ? "" : "s"} — a human has to merge.`);
  else info("Conflicts", "none open");

  const agents = readAgentList((await api.get(`/api/v1/projects/${project.id}/presence`)).body);
  if (agents.length === 0) {
    info("Agents", "none registered");
  } else {
    const online = agents.filter((agent) => agent.presence === "online").length;
    info("Agents", `${online}/${agents.length} online`);
    for (const agent of agents) {
      const activity = agent.activity === "" ? "" : ` — ${agent.activity}`;
      out(`              ${agent.presence === "online" ? style.green("●") : style.dim("○")} ${agent.name} (${agent.kind})${activity}`);
    }
  }

  info("Config", connection.sources.join(", "));
}
