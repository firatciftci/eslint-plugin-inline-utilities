import { Linter } from "eslint";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import plugin from "#/index.js";
import { RULE } from "#tests/helpers.js";

const ROOT = path.join(tmpdir(), "inline-utilities-detect");

function fakeProject(name: string, packages: Array<string>) {
  const directory = path.join(ROOT, name);
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    path.join(directory, "package.json"),
    '{"name":"p","private":true,"type":"module"}',
  );
  for (const dependency of packages) {
    const target = path.join(directory, "node_modules", dependency);
    mkdirSync(target, { recursive: true });
    writeFileSync(
      path.join(target, "package.json"),
      JSON.stringify({ name: dependency, version: "1.0.0", main: "i.js" }),
    );
    writeFileSync(path.join(target, "i.js"), "");
  }
  return directory;
}

function messageIn(cwd: string) {
  const linter = new Linter({ cwd });
  const messages = linter.verify(
    'export const c = "rounded-md p-4 shadow-xs";',
    {
      files: ["**/*"],
      plugins: { "inline-utilities": plugin },
      languageOptions: { ecmaVersion: 2023, sourceType: "module" },
      rules: { [RULE]: "error" },
    },
    "t.js",
  );
  return messages.find((message) => message.ruleId === RULE)?.message ?? "";
}

describe("project detection", () => {
  it.each([
    {
      packages: ["tailwindcss", "svelte"],
      engine: "Tailwind utility classes",
      advice: "extract a Svelte snippet or a component",
    },
    {
      packages: ["unocss", "vue"],
      engine: "UnoCSS utility classes",
      advice: "extract a Vue component",
    },
    {
      packages: ["@unocss/core", "react"],
      engine: "UnoCSS utility classes",
      advice: "extract a component",
    },
    {
      packages: ["@master/css", "@angular/core"],
      engine: "Master CSS utility classes",
      advice: "extract a component or an ng-template",
    },
    {
      packages: ["tailwindcss", "lit"],
      engine: "Tailwind utility classes",
      advice: "extract a template function or a component",
    },
    {
      packages: ["tailwindcss", "astro"],
      engine: "Tailwind utility classes",
      advice: "extract an Astro component",
    },
    {
      packages: [],
      engine: "utility classes",
      advice: "extract a component or a template partial",
    },
  ])("names $engine and advises to $advice", ({ packages, engine, advice }) => {
    const cwd = fakeProject(
      packages.join("-").replaceAll(/\W/g, "") || "bare",
      packages,
    );
    const message = messageIn(cwd);
    expect(message).toContain(`holds ${engine}.`);
    expect(message).toContain(`To reuse a cluster, ${advice}.`);
  });

  it("resolves per workspace package in a monorepo", () => {
    const root = fakeProject("mono", []);
    const web = fakeProject(path.join("mono", "packages", "web"), [
      "tailwindcss",
      "svelte",
    ]);

    expect(messageIn(web)).toContain("extract a Svelte snippet or a component");
    expect(messageIn(root)).toContain(
      "extract a component or a template partial",
    );
  });
});
