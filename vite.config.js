import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// for normal use dev
export default defineConfig({
  plugins: [react()],
  base: "/client",
  server: {
    port: 3000,
  },
});
