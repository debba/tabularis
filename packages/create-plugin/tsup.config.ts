import { defineConfig } from "tsup";

export default defineConfig({
  entry: { cli: "src/cli.ts" },
  format: ["esm"],
  target: "node18",
  platform: "node",
  dts: false,
  sourcemap: false,
  clean: true,
  minify: false,
  splitting: false,
  shims: false,
  banner: { js: "#!/usr/bin/env node" },
});
