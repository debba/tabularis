import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Build the plugin UI as a single IIFE bundle that the Tabularis host can
// execute at runtime. React, react/jsx-runtime and @tabularis/plugin-api
// are provided by the host as globals — do not bundle them.
//
// The `name` must be `__tabularis_plugin__`: the host reads this global
// to retrieve the component. Do not change it.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    lib: {
      entry: "src/index.tsx",
      formats: ["iife"],
      name: "__tabularis_plugin__",
      fileName: () => "index.js",
    },
    rollupOptions: {
      external: ["react", "react/jsx-runtime", "@tabularis/plugin-api"],
      output: {
        globals: {
          react: "React",
          "react/jsx-runtime": "ReactJSXRuntime",
          "@tabularis/plugin-api": "__TABULARIS_API__",
        },
      },
    },
  },
});
