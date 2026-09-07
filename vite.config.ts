import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    base: "/admin/",
    plugins: [react(), tailwindcss()],
    server: {
      proxy: env.VITE_API_PROXY_TARGET
        ? {
            "/api/v1": {
              target: env.VITE_API_PROXY_TARGET,
              changeOrigin: false,
            },
          }
        : undefined,
    },
  };
});
