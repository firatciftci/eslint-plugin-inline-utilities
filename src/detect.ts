import { createRequire } from "node:module";
import path from "node:path";

const PROJECT_ANCHOR = "__inline_utilities_anchor__.js";

/**
 * Ordered so the framework that owns the markup answers first. A project often
 * holds more than one: a SvelteKit app may render mail with react-email, and an
 * Astro site commonly installs React too.
 */
const FRAMEWORK_ADVICE: Array<[string, string]> = [
  ["svelte", "extract a Svelte snippet or a component"],
  ["vue", "extract a Vue component"],
  ["@angular/core", "extract a component or an ng-template"],
  ["lit", "extract a template function or a component"],
  ["astro", "extract an Astro component"],
  ["solid-js", "extract a component"],
  ["@builder.io/qwik", "extract a component"],
  ["preact", "extract a component"],
  ["react", "extract a component"],
];

/**
 * The rules read utility clusters by structure, never by a list of utility
 * names, so they hold for any utility-first engine. This only decides what to
 * call those classes in a report.
 */
const ENGINE_LABELS: Array<[string, string]> = [
  ["tailwindcss", "Tailwind utility classes"],
  ["unocss", "UnoCSS utility classes"],
  ["@unocss/core", "UnoCSS utility classes"],
  ["@master/css", "Master CSS utility classes"],
];

export type ProjectDescription = { advice: string; utilities: string };

const cache = new Map<string, ProjectDescription>();

function isInstalled(
  resolve: (specifier: string) => string,
  name: string,
): boolean {
  for (const specifier of [name, `${name}/package.json`]) {
    try {
      resolve(specifier);
      return true;
    } catch {
      continue;
    }
  }
  return false;
}

function firstInstalled(
  resolve: (specifier: string) => string,
  table: Array<[string, string]>,
  fallback: string,
): string {
  for (const [name, label] of table)
    if (isInstalled(resolve, name)) return label;
  return fallback;
}

/**
 * Resolution runs from the linted project, not from this file, the way
 * eslint-plugin-svelte does it. Anchoring on the plugin breaks in a monorepo,
 * where the plugin sits at the root and the framework sits in a workspace
 * package. Cached per working directory, so it settles once per process.
 */
export function describeProject(cwd: string): ProjectDescription {
  const cached = cache.get(cwd);
  if (cached != null) return cached;

  const projectRequire = createRequire(path.join(cwd, PROJECT_ANCHOR));
  const resolve = (specifier: string): string =>
    projectRequire.resolve(specifier);
  const described: ProjectDescription = {
    advice: firstInstalled(
      resolve,
      FRAMEWORK_ADVICE,
      "extract a component or a template partial",
    ),
    utilities: firstInstalled(resolve, ENGINE_LABELS, "utility classes"),
  };

  cache.set(cwd, described);
  return described;
}
