import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages: served at https://<user>.github.io/market-sim/
// The repo name must match this base. Change both if you rename the repo.
export default defineConfig({
  plugins: [react()],
  base: "/market-sim/",
});
