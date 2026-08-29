/** Narrowing helpers for JSON coming off the wire, so nothing types as `any`. */

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

export function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function asBoolean(value: unknown): boolean {
  return value === true;
}

export function asList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function asRecordList(value: unknown): Record<string, unknown>[] {
  return asList(value).filter(isRecord);
}

export function asStringList(value: unknown): string[] {
  return asList(value).filter((item): item is string => typeof item === "string");
}
