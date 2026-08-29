import { z } from "zod";
import { APP_VERSION, MEMORY_TYPES } from "../constants.js";

export const healthResponseSchema = z.object({
  ok: z.boolean(),
  version: z.string().default(APP_VERSION),
  db: z.enum(["up", "down"]),
  time: z.string(),
});

export const memoryEntryPublicSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  type: z.enum(MEMORY_TYPES),
  status: z.string(),
  title: z.string(),
  body: z.string(),
  tags: z.array(z.string()),
  pinned: z.boolean(),
  verified: z.boolean(),
  currentVersion: z.number(),
  createdByType: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
