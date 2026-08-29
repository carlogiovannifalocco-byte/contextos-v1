import { z } from "zod";
import { MIN_COOKIE_SECRET_LENGTH } from "@contextos/shared";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  HOST: z.string().default("0.0.0.0"),
  DATABASE_URL: z.string().min(1),
  COOKIE_SECRET: z.string().min(1),
  PUBLIC_WEB_ORIGIN: z.string().url().default("http://localhost:5173"),
  CORS_ORIGINS: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(raw: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.parse(raw);
  if (parsed.NODE_ENV === "production") {
    if (parsed.COOKIE_SECRET.length < MIN_COOKIE_SECRET_LENGTH) {
      throw new Error(
        `COOKIE_SECRET must be at least ${MIN_COOKIE_SECRET_LENGTH} characters in production. Refusing to boot.`,
      );
    }
    if (/change-me|dev-only|secret123|password/i.test(parsed.COOKIE_SECRET)) {
      throw new Error("COOKIE_SECRET looks weak. Refusing to boot production.");
    }
  }
  return parsed;
}

export function corsOrigins(env: Env): string[] {
  const extra = env.CORS_ORIGINS
    ? env.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean)
    : [];
  return [...new Set([env.PUBLIC_WEB_ORIGIN, ...extra])];
}

export function originAllowed(env: Env, origin?: string): boolean {
  if (!origin) return true;
  if (corsOrigins(env).includes(origin)) return true;
  if (env.NODE_ENV !== "production" && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) {
    return true;
  }
  return false;
}
