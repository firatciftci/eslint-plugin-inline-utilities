import type { ESLint, Linter } from "eslint";
import { noClassConstants } from "#/rules/no-class-constants.js";

const rules = { "no-class-constants": noClassConstants };

const plugin: ESLint.Plugin = {
  meta: { name: "eslint-plugin-inline-utilities" },
  rules,
};

/**
 * Flat config preset. Spread it into a config array, then narrow it with
 * `files` if the rule should only run on part of the tree.
 */
export const recommended: Linter.Config = {
  name: "inline-utilities/recommended",
  plugins: { "inline-utilities": plugin },
  rules: { "inline-utilities/no-class-constants": "error" },
};

plugin.configs = { recommended };

export { rules };
export default plugin;

export { noClassConstants } from "#/rules/no-class-constants.js";
