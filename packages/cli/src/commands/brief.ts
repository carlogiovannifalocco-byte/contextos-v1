import type { BriefOptions } from "../args.js";
import { parseContextPackage, renderBriefMarkdown } from "../brief.js";
import { requireConnection } from "../connection.js";
import { CLI_NAME } from "../constants.js";
import { CliError } from "../errors.js";
import { ApiClient } from "../http.js";
import { asRecord, asString, isRecord } from "../json.js";
import { discoverConnection } from "../localConfig.js";
import { raw } from "../ui.js";

export async function runBrief(options: BriefOptions, cwd: string): Promise<void> {
  const connection = requireConnection(discoverConnection(options, cwd));
  const api = new ApiClient(connection.apiUrl);
  api.useAgentKey(connection.agentKey);

  const response = await api.get(`/api/v1/projects/${connection.projectId}/context-package`, {
    query: { format: options.format, budget: options.budget, focus: options.focus },
    allow: [401, 403, 404],
  });
  if (!response.ok) {
    if (response.status === 404) {
      throw new CliError(`Project ${connection.projectId} is not visible to this agent key. Re-run "${CLI_NAME} init".`);
    }
    throw new CliError(`The agent key was rejected (${response.status}). Re-run "${CLI_NAME} init --new-key".`);
  }

  if (options.format === "json") {
    raw(isRecord(response.body) ? JSON.stringify(response.body, null, 2) : response.text);
    return;
  }

  // A newer API renders the markdown itself; an older one only speaks JSON.
  if (typeof response.body === "string") {
    raw(response.text);
    return;
  }
  const markdown = asString(asRecord(response.body)["markdown"]);
  if (markdown !== "") {
    raw(markdown);
    return;
  }
  raw(
    renderBriefMarkdown(parseContextPackage(response.body), {
      budget: options.budget,
      focus: options.focus,
    }),
  );
}
