const base = process.env.CONTEXTOS_API_URL ?? process.env.CONTEXTOS_API_ORIGIN ?? "http://127.0.0.1:3001";
const res = await fetch(`${base}/api/health`);
if (!res.ok) {
  console.error(`Health check failed: ${res.status}`);
  process.exit(1);
}
const json = await res.json();
if (!json.ok || json.db !== "up") {
  console.error("API is up but database is down.", json);
  process.exit(1);
}
console.log("OK", json);
