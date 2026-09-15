/* eslint-disable unicorn/no-incorrect-template-string-interpolation */
import { describe, expect, it } from "vitest";
import { expectMarkers, parsers } from "#tests/helpers.js";

const cases = [
  {
    name: "reports every shape that names a cluster",
    filename: "t.svelte",
    parser: parsers.svelte,
    parserOptions: { parser: parsers.ts },
    code: `<script lang="ts">
  import { cn, tw } from "$lib/utils";
  let { size = "sm" }: { size?: "lg" | "sm" } = $props();
  const tagged = tw\`grid content-start gap-1.5\`; // FLAG
  const plain = "grid content-start gap-1.5 px-3"; // FLAG
  const merged = cn("relative isolate grid px-3", { "opacity-50": true }); // FLAG
  const map = { sm: "size-8 p-1", lg: "size-10 p-2" }; // FLAG
  const derived = $derived(tw\`px-2 py-1 \${size}\`); // FLAG
  const template = \`rounded-md px-3 py-1.5 text-\${size}\`; // FLAG
  const concat = "grid items-start px-3 " + "py-2"; // FLAG
  const arrow = () => tw\`flex items-center gap-1\`; // FLAG
  function factory(on: boolean) {
    return tw\`grid items-center gap-x-2 \${on ? "opacity-100" : "opacity-0"}\`; // FLAG
  }
</script>
<i class={tagged}></i><i class={plain}></i><i class={merged}></i>
<i class={map[size]}></i><i class={derived}></i><i class={template}></i>
<i class={concat}></i><i class={arrow()}></i><i class={factory(true)}></i>`,
  },
  {
    name: "leaves a cluster alone at its point of use",
    filename: "t.svelte",
    parser: parsers.svelte,
    parserOptions: { parser: parsers.ts },
    code: `<script lang="ts">
  import { cn } from "$lib/utils";
  let { class: className = "px-2 py-1 text-sm" } = $props(); // OK
  const unused = "px-2 py-1 text-sm"; // OK
  const single = "swiper-slide"; // OK
</script>
<div class="mx-auto grid w-full max-w-4xl content-center gap-y-2 px-1 py-20"></div>
<span class={cn("cursor-default opacity-50", className)}></span>
<i class:active={single} data-x={unused}></i>`,
  },
  {
    name: "leaves a tv variant map alone",
    filename: "t.ts",
    parser: parsers.ts,
    code: `import { tv } from "tailwind-variants";
export const card = tv({ base: "grid gap-2 rounded-md px-3", variants: { t: { a: "bg-white text-black" } } }); // OK`,
  },
  {
    name: "reports exported clusters and spares lookalike data",
    filename: "t.ts",
    parser: parsers.ts,
    code: `export const cardClass = "rounded-md p-4 shadow-xs"; // FLAG
export const tokens = { calm: "bg-white text-neutral-900" }; // FLAG
export const CACHE_CONTROL = "private, no-store"; // OK
export const SCOPES = "read:user write:repo"; // OK
export const ACCEPT = "image/png image/jpeg"; // OK
export const MEDIA = "(prefers-reduced-motion: reduce)"; // OK
export const CSP = "default-src 'self'"; // OK
export const FIELDS = "user.email user.name"; // OK
export const GREETING = "some words here"; // OK`,
  },
  {
    name: "spares a key or file name built from expressions",
    filename: "t.ts",
    parser: parsers.ts,
    code: `export function cardKey(name: string, x: number, y: number): string {
  return \`\${name}-\${x}-\${y}\`; // OK
}
export function fileName(part: string, stamp: string): string {
  return \`\${part}-\${stamp}.png\`; // OK
}
export function meta(locale: string) {
  return { images: \`/images/og-image-\${locale}.png\` }; // OK
}
export function plane(uuid: string, index: number) {
  return { layerId: \`plane-\${uuid}-\${index}\` }; // OK
}
export const metadata = {
  title: { template: \`%s - \${label}\`, default: label }, // OK
};
export function dayKey(year: number, month: string) {
  return \`\${year}-\${month}-01\`; // OK
}`,
  },
  {
    name: "keeps variant-only clusters on the reference-proven path",
    filename: "t.svelte",
    parser: parsers.svelte,
    parserOptions: { parser: parsers.ts },
    code: `<script lang="ts">
  const responsive = "hidden sm:grid"; // FLAG
</script>
<div class={responsive}></div>`,
  },
];

describe("no-class-constants shapes", () => {
  for (const testCase of cases)
    it(testCase.name, () => {
      for (const result of expectMarkers(testCase))
        expect(result.wasReported, result.source).toBe(result.shouldReport);
    });
});
