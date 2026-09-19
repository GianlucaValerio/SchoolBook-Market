import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // IMPORTANTE: sostituisci "libroscambio" con il nome esatto del tuo repo GitHub
  base: "/schoolbook-market/",
});
