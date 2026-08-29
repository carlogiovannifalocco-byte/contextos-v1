import { AGENT_KEY_PREFIX } from "./constants.js";

// The API stores the first 12 characters of a key as its lookup prefix, so a
// 12-character preview is exactly what the dashboard shows next to an agent.
const PREVIEW_LENGTH = 12;
const MIN_HIDDEN_CHARS = 6;
const KEY_PATTERN = /cos_[A-Za-z0-9_-]+/g;

/** Shorten an agent key to something safe to print or log. */
export function redactKey(value: string): string {
  const key = value.trim();
  if (!key.startsWith(AGENT_KEY_PREFIX) || key.length <= AGENT_KEY_PREFIX.length) return "***";
  if (key.length < PREVIEW_LENGTH + MIN_HIDDEN_CHARS) return `${AGENT_KEY_PREFIX}…`;
  return `${key.slice(0, PREVIEW_LENGTH)}…`;
}

/** Redact every agent key inside arbitrary text (error messages, API bodies). */
export function redactSecrets(text: string): string {
  return text.replace(KEY_PATTERN, (match) => redactKey(match));
}
