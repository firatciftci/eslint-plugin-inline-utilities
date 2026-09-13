/* eslint-disable unicorn/no-incorrect-template-string-interpolation */
import { describe, expect, it } from "vitest";
import { expectMarkers, parsers } from "#tests/helpers.js";

const cases = [
  {
    name: "Svelte",
    filename: "t.svelte",
    parser: parsers.svelte,
    parserOptions: { parser: parsers.ts },
    code: `<script lang="ts">
  const shell = "relative isolate grid px-3"; // FLAG
  const viaProp = "flex items-center gap-1"; // FLAG
  const words = "some words here"; // OK
  const scopes = "read:user write:repo"; // OK
</script>
<div class={shell}></div>
<Comp triggerClass={viaProp} />
<span data-x={scopes}>{words}</span>`,
  },
  {
    name: "Vue script setup",
    filename: "t.vue",
    parser: parsers.vue,
    parserOptions: { parser: parsers.ts },
    code: `<script setup lang="ts">
const shell = "relative isolate grid px-3"; // FLAG
const bound = "flex items-center gap-1"; // FLAG
const viaProp = "grid gap-2 px-3"; // FLAG
const merged = "text-sm text-red-600"; // FLAG
const words = "some words here"; // OK
const mime = "image/png image/jpeg"; // OK
</script>
<template>
  <div :class="shell"></div>
  <div v-bind:class="bound"></div>
  <MyComp :trigger-class="viaProp" />
  <div :class="cn(merged)"></div>
  <div :data-mime="mime">{{ words }}</div>
</template>`,
  },
  {
    name: "Vue Options API",
    filename: "t.ts",
    parser: parsers.ts,
    code: `export default {
  computed: {
    shellClass() { return "relative isolate grid px-3"; }, // FLAG
  },
  data() { return { labelClass: "px-1 text-sm text-neutral-600" }; }, // FLAG
};`,
  },
  {
    name: "React and Next.js",
    filename: "t.tsx",
    parser: parsers.ts,
    code: `import { useMemo } from "react";
const shell = "relative isolate grid px-3"; // FLAG
const viaProp = "flex items-center gap-1"; // FLAG
const words = "some words here"; // OK
export function App() {
  const memo = useMemo(() => "grid gap-2 px-3", []); // FLAG
  return <><div className={shell} /><Card wrapperClassName={viaProp} /><p title={words}>{memo}</p></>;
}`,
  },
  {
    name: "Solid",
    filename: "t.tsx",
    parser: parsers.ts,
    code: `const shell = "relative isolate grid px-3"; // FLAG
export const App = () => <div classList={{ [shell]: true }} />;`,
  },
  {
    name: "Astro",
    filename: "t.astro",
    parser: parsers.astro,
    code: `---
const shell = "relative isolate grid px-3"; // FLAG
const viaList = "flex items-center gap-1"; // FLAG
const words = "some words here"; // OK
---
<div class={shell}></div>
<div class:list={[viaList]}></div>
<p title={words}></p>`,
  },
  {
    name: "Angular",
    filename: "t.ts",
    parser: parsers.ts,
    code: `import { Component } from "@angular/core";
@Component({ selector: "a-b", template: \`<div [class]="shellClass"></div>\` })
export class CardComponent {
  readonly shellClass = "relative isolate grid px-3"; // FLAG
  protected labelClass = "px-1 text-sm text-neutral-600"; // FLAG
  private readonly cacheControl = "private, no-store"; // OK
  private readonly greeting = "some words here"; // OK
}`,
  },
  {
    name: "Lit",
    filename: "t.ts",
    parser: parsers.ts,
    code: `import { html, LitElement } from "lit";
export class Card extends LitElement {
  static shellClass = "relative isolate grid px-3"; // FLAG
  override render() { return html\`<div class="\${Card.shellClass}"></div>\`; }
}`,
  },
];

describe("no-class-constants across frameworks", () => {
  for (const testCase of cases)
    it(testCase.name, () => {
      for (const result of expectMarkers(testCase))
        expect(result.wasReported, result.source).toBe(result.shouldReport);
    });
});
