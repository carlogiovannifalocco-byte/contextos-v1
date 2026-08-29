import { AGENT_KEY_PREFIX } from "@contextos/shared";
import { hashPassword, randomToken, verifyPassword } from "./crypto.js";

export async function mintAgentKey(): Promise<{ raw: string; prefix: string; hash: string }> {
  const raw = `${AGENT_KEY_PREFIX}${randomToken(24)}`;
  const prefix = raw.slice(0, 12);
  const hash = await hashPassword(raw);
  return { raw, prefix, hash };
}

export async function matchAgentKey(
  candidates: { id: string; keyHash: string }[],
  raw: string,
): Promise<string | null> {
  for (const candidate of candidates) {
    if (await verifyPassword(candidate.keyHash, raw)) {
      return candidate.id;
    }
  }
  return null;
}
