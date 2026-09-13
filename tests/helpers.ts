import * as angularParser from "@angular-eslint/template-parser";
import * as tsParser from "@typescript-eslint/parser";
import * as astroParser from "astro-eslint-parser";
import { Linter } from "eslint";
import process from "node:process";
import * as svelteParser from "svelte-eslint-parser";
import * as vueParser from "vue-eslint-parser";
import plugin from "#/index.js";

export const RULE = "inline-utilities/no-class-constants";

export const parsers = {
  angular: angularParser,
  astro: astroParser,
  svelte: svelteParser,
  ts: tsParser,
  vue: vueParser,
};

export type Case = {
  code: string;
  filename: string;
  parser: Linter.Parser;
  parserOptions?: Record<string, unknown>;
};

export type Marker = {
  shouldReport: boolean;
  source: string;
  wasReported: boolean;
};

/**
 * Lints a fixture, then pairs every line marked `FLAG` or `OK` with whether
 * the rule actually reported it. Keeping the expectation next to the code it
 * describes is what makes these fixtures readable.
 */
export function expectMarkers(testCase: Case): Array<Marker> {
  const linter = new Linter({ cwd: process.cwd() });
  const messages = linter.verify(
    testCase.code,
    {
      files: ["**/*.{astro,html,js,jsx,svelte,ts,tsx,vue}"],
      plugins: { "inline-utilities": plugin },
      languageOptions: {
        parser: testCase.parser,
        ecmaVersion: 2023,
        sourceType: "module",
        parserOptions: {
          ecmaFeatures: { jsx: true },
          ...testCase.parserOptions,
        },
      },
      rules: { [RULE]: "error" },
    },
    testCase.filename,
  );

  const unusable = messages.find(
    (message) => message.fatal === true || message.ruleId == null,
  );
  if (unusable != null)
    throw new Error(`could not lint ${testCase.filename}: ${unusable.message}`);

  const reported = new Set(
    messages
      .filter((message) => message.ruleId === RULE)
      .map((message) => message.line),
  );

  const markers: Array<Marker> = [];
  for (const [index, line] of testCase.code.split("\n").entries()) {
    const shouldReport = /\bFLAG\b/.test(line);
    if (!shouldReport && !/\bOK\b/.test(line)) continue;
    markers.push({
      shouldReport,
      source: line.trim(),
      wasReported: reported.has(index + 1),
    });
  }

  if (markers.length === 0)
    throw new Error(`no FLAG or OK markers in ${testCase.filename}`);

  return markers;
}
