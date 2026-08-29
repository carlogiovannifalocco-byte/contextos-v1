import { PrismaClient } from "@prisma/client";

export { PrismaClient, Prisma } from "@prisma/client";
export type {
  ActorType,
  Agent,
  MemoryEntry,
  MemoryRelation,
  MemoryType,
  Project,
  User,
} from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error(
      "DATABASE_URL is not set. Postgres is required for the API and for API integration tests. Run `node scripts/setup.mjs` (writes .env) or export DATABASE_URL. See docs/QUICKSTART.md.",
    );
  }
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createClient();
  }
  return globalForPrisma.prisma;
}

/** Lazy so unit tests can import modules that mention prisma without a DATABASE_URL. */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    if (prop === "then") return undefined;
    const client = getPrisma();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

