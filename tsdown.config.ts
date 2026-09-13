import { defineConfig } from "tsdown/config";

export default defineConfig({
  entry: ["src/index.ts"],
  format: "esm",
  outDir: "dist",
  root: "src",
  dts: true,
  deps: { neverBundle: true },
  treeshake: true,
});
