export const APP_NAME = "ContextOS";
export const APP_VERSION = "1.0.0-beta";
export const AGENT_KEY_PREFIX = "cos_";
export const SESSION_COOKIE = "contextos_session";
export const CSRF_HEADER = "x-csrf-token";
export const MIN_COOKIE_SECRET_LENGTH = 32;
export const MIN_PASSWORD_LENGTH = 10;
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14;

export const MEMORY_TYPES = [
  "decision",
  "convention",
  "fact",
  "note",
  "constraint",
  "risk",
] as const;

export const MEMORY_STATUSES = ["draft", "active", "archived"] as const;
export const TASK_STATUSES = ["open", "in_progress", "blocked", "done"] as const;
export const ACTOR_TYPES = ["user", "agent", "system"] as const;
export const PRESENCE_STATUSES = ["online", "idle", "offline"] as const;
export const CONFLICT_STATUSES = ["open", "merged", "resolved", "dismissed"] as const;
export const PROJECT_ROLES = ["owner", "member", "viewer"] as const;
export const HANDOFF_STATUSES = ["open", "accepted", "closed"] as const;
export const MEMORY_RELATION_KINDS = [
  "supersedes",
  "contradicts",
  "references",
  "parent_of",
] as const;

export const SCAN_JOB_STATUSES = [
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
] as const;

export const EVENT_NAMES = {
  memoryCreated: "memory.created",
  memoryUpdated: "memory.updated",
  memoryDeleted: "memory.deleted",
  memoryVerified: "memory.verified",
  taskCreated: "task.created",
  taskUpdated: "task.updated",
  agentRegistered: "agent.registered",
  agentHeartbeat: "agent.heartbeat",
  agentPresence: "agent.presence",
  agentRevoked: "agent.revoked",
  conflictDetected: "conflict.detected",
  conflictResolved: "conflict.resolved",
  conflictMerged: "conflict.merged",
  scanProgress: "scan.progress",
  scanCompleted: "scan.completed",
  handoffCreated: "handoff.created",
  projectUpdated: "project.updated",
  memoryLinked: "memory.linked",
  memorySuperseded: "memory.superseded",
} as const;

export type EventName = (typeof EVENT_NAMES)[keyof typeof EVENT_NAMES];
