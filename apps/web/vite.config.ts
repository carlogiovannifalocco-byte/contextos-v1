import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const apiOrigin = process.env.CONTEXTOS_API_ORIGIN ?? "http://127.0.0.1:3001";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: Number(process.env.WEB_PORT || 5173),
    strictPort: false,
    proxy: {
      "/api": apiOrigin,
      "/ws": { target: apiOrigin.replace("http", "ws"), ws: true },
    },
  },
});
