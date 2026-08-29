import { z } from "zod";
import {
  CONFLICT_STATUSES,
  HANDOFF_STATUSES,
  MEMORY_RELATION_KINDS,
  MEMORY_STATUSES,
  MEMORY_TYPES,
  MIN_PASSWORD_LENGTH,
  PRESENCE_STATUSES,
  TASK_STATUSES,
} from "./constants.js";

export const emailSchema = z.string().trim().email().max(254).toLowerCase();

export const passwordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH)
  .max(200)
  .regex(/[A-Za-z]/, "Password must include a letter")
  .regex(/[0-9]/, "Password must include a number");

export const registerBodySchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().trim().min(1).max(80),
  language: z.enum(["en", "it"]).optional(),
});

export const loginBodySchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(200),
});

export const patchMeBodySchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  language: z.enum(["en", "it"]).optional(),
  theme: z.enum(["light", "dark", "system"]).optional(),
});

export const changePasswordBodySchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: passwordSchema,
});

export const createProjectBodySchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().max(2000).optional(),
  rootPath: z.string().max(1024).optional(),
});

export const patchProjectBodySchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  description: z.string().max(2000).optional(),
  rootPath: z.string().max(1024).nullable().optional(),
});

export const memoryTypeSchema = z.enum(MEMORY_TYPES);
export const memoryStatusSchema = z.enum(MEMORY_STATUSES);

export const createMemoryBodySchema = z.object({
  type: memoryTypeSchema,
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(20_000),
  tags: z.array(z.string().trim().min(1).max(40)).max(16).optional(),
  status: memoryStatusSchema.optional(),
  pinned: z.boolean().optional(),
});

export const patchMemoryBodySchema = z.object({
  type: memoryTypeSchema.optional(),
  title: z.string().trim().min(1).max(200).optional(),
  body: z.string().trim().min(1).max(20_000).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(16).optional(),
  status: memoryStatusSchema.optional(),
  pinned: z.boolean().optional(),
  verified: z.boolean().optional(),
});

export const importMemoryBodySchema = z.object({
  entries: z.array(createMemoryBodySchema).min(1).max(200),
});

export const registerAgentBodySchema = z.object({
  name: z.string().trim().min(1).max(80),
  kind: z.string().trim().min(1).max(40).optional(),
  description: z.string().max(500).optional(),
});

export const heartbeatBodySchema = z.object({
  activity: z.string().max(200).optional(),
});

export const presenceBodySchema = z.object({
  presence: z.enum(PRESENCE_STATUSES),
  activity: z.string().max(200).optional(),
});

export const createTaskBodySchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(5000).optional(),
  status: z.enum(TASK_STATUSES).optional(),
  assigneeAgentId: z.string().cuid().nullable().optional(),
});

export const patchTaskBodySchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  status: z.enum(TASK_STATUSES).optional(),
  assigneeAgentId: z.string().cuid().nullable().optional(),
});

export const createHandoffBodySchema = z.object({
  fromAgentId: z.string().cuid().nullable().optional(),
  toAgentId: z.string().cuid().nullable().optional(),
  summary: z.string().trim().min(1).max(300),
  details: z.string().max(8000).optional(),
});

export const scanBodySchema = z.object({
  rootPath: z.string().trim().min(1).max(1024).optional(),
});

export const mergeConflictBodySchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(20_000),
});

export const resolveConflictBodySchema = z.object({
  winnerId: z.string().cuid(),
  resolution: z.string().trim().min(1).max(2000),
});

export const ignoreRulesBodySchema = z.object({
  content: z.string().max(20_000),
});

export const createWebhookBodySchema = z.object({
  url: z.string().url().max(500),
  events: z.array(z.string().min(1).max(80)).max(40).optional(),
});

export const patchWebhookBodySchema = z.object({
  url: z.string().url().max(500).optional(),
  events: z.array(z.string().min(1).max(80)).max(40).optional(),
  enabled: z.boolean().optional(),
});

export const inviteMemberBodySchema = z.object({
  email: emailSchema,
  role: z.enum(["member", "viewer"]).optional(),
});

export const patchMemberRoleBodySchema = z.object({
  role: z.enum(["member", "viewer"]),
});

export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().optional(),
  q: z.string().max(200).optional(),
  type: memoryTypeSchema.optional(),
  status: memoryStatusSchema.optional(),
  verified: z.enum(["true", "false"]).optional(),
  pinned: z.enum(["true", "false"]).optional(),
});

export const memoryRelationKindSchema = z.enum(MEMORY_RELATION_KINDS);

export const createMemoryRelationBodySchema = z.object({
  toId: z.string().cuid(),
  kind: memoryRelationKindSchema,
  note: z.string().trim().max(500).optional(),
});

export const supersedeMemoryBodySchema = z.object({
  supersedesId: z.string().cuid(),
  note: z.string().trim().max(500).optional(),
});

export const contextPackageQuerySchema = z.object({
  budget: z.coerce.number().int().min(200).max(32_000).optional(),
  focus: z.string().trim().max(400).optional(),
  format: z.enum(["json", "md"]).optional(),
});

export const conflictStatusSchema = z.enum(CONFLICT_STATUSES);
export const handoffStatusSchema = z.enum(HANDOFF_STATUSES);
export const taskStatusSchema = z.enum(TASK_STATUSES);
