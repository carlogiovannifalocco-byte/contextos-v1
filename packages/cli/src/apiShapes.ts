import { asBoolean, asNumber, asRecord, asRecordList, asString } from "./json.js";

export type HealthInfo = { ok: boolean; version: string; db: string };
export type ProjectSummary = { id: string; name: string };
export type ProjectCounts = { memories: number; tasks: number; agents: number; conflicts: number };
export type ProjectDetail = ProjectSummary & { description: string; counts: ProjectCounts };
export type AgentSummary = { id: string; name: string; kind: string; presence: string; activity: string };
export type RegisteredAgent = { id: string; name: string; apiKey: string };

export function readHealth(body: unknown): HealthInfo {
  const root = asRecord(body);
  return {
    ok: asBoolean(root["ok"]),
    version: asString(root["version"], "unknown"),
    db: asString(root["db"], "unknown"),
  };
}

export function readCsrfToken(body: unknown): string {
  return asString(asRecord(body)["csrfToken"]);
}

export function readProjectList(body: unknown): ProjectSummary[] {
  return asRecordList(asRecord(body)["projects"]).map((project) => ({
    id: asString(project["id"]),
    name: asString(project["name"], "(unnamed)"),
  }));
}

export function readProject(body: unknown): ProjectSummary {
  const project = asRecord(asRecord(body)["project"]);
  return { id: asString(project["id"]), name: asString(project["name"], "(unnamed)") };
}

export function readProjectDetail(body: unknown): ProjectDetail {
  const project = asRecord(asRecord(body)["project"]);
  const counts = asRecord(project["_count"]);
  return {
    id: asString(project["id"]),
    name: asString(project["name"], "(unnamed)"),
    description: asString(project["description"]),
    counts: {
      memories: asNumber(counts["memories"]),
      tasks: asNumber(counts["tasks"]),
      agents: asNumber(counts["agents"]),
      conflicts: asNumber(counts["conflicts"]),
    },
  };
}

export function readAgentList(body: unknown): AgentSummary[] {
  return asRecordList(asRecord(body)["agents"]).map((agent) => ({
    id: asString(agent["id"]),
    name: asString(agent["name"], "(unnamed)"),
    kind: asString(agent["kind"], "generic"),
    presence: asString(agent["presence"], "offline"),
    activity: asString(agent["activity"]),
  }));
}

export function readRegisteredAgent(body: unknown): RegisteredAgent {
  const root = asRecord(body);
  const agent = asRecord(root["agent"]);
  return {
    id: asString(agent["id"]),
    name: asString(agent["name"], "(unnamed)"),
    apiKey: asString(root["apiKey"]),
  };
}

export function countOpenConflicts(body: unknown): number {
  return asRecordList(asRecord(body)["conflicts"]).filter((conflict) => asString(conflict["status"]) === "open").length;
}
