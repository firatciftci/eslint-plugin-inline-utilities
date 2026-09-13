# eslint-plugin-inline-utilities

`eslint-plugin-inline-utilities` keeps utility classes on the element they style. It reports the class string constants that agents and generators like to introduce, such as `const shell = tw\`relative isolate grid px-3\``, and points you at a component or a snippet instead.

Naming a cluster of utilities reads like good factoring, but it undoes the thing utility-first CSS is for. Once the classes live behind a name, you can no longer read an element and know how it looks. You have to jump to the constant, and the constant tends to grow conditionals until it becomes a second, worse styling system.

The rules read clusters by structure, never from a list of utility names, so they work with Tailwind CSS, UnoCSS and Master CSS, including custom utilities that no list would know about.

## Installation

```sh
npm install --save-dev eslint-plugin-inline-utilities
```

Use the equivalent command for your package manager if you do not use npm.

The package is ESM only and needs ESLint 9 or newer with flat config.

## Usage

```js
// eslint.config.js
import inlineUtilities from "eslint-plugin-inline-utilities";

export default [inlineUtilities.configs.recommended];
```

Narrow it with `files` if the rules should only cover part of the tree:

```js
import inlineUtilities from "eslint-plugin-inline-utilities";

export default [
  {
    ...inlineUtilities.configs.recommended,
    files: ["src/**/*.{ts,tsx,svelte,vue,astro}"],
  },
];
```

Or wire the rule up yourself:

```js
import inlineUtilities from "eslint-plugin-inline-utilities";

export default [
  {
    plugins: { "inline-utilities": inlineUtilities },
    rules: { "inline-utilities/no-class-constants": "error" },
  },
];
```

## Supported Frameworks

| Framework                     | Class positions it reads                           |
| ----------------------------- | -------------------------------------------------- |
| Svelte, SvelteKit             | `class={x}`, `*Class` and `*Classes` props         |
| Vue, Nuxt                     | `:class`, `v-bind:class`, `class`, `*-class` props |
| React, Next.js, Remix, Preact | `className={x}`                                    |
| Solid                         | `class={x}`, `classList={x}`                       |
| Qwik                          | `class={x}`                                        |
| Astro                         | `class={x}`, `class:list={x}`                      |
| Angular                       | class fields                                       |
| Lit                           | class fields                                       |
| Anything else                 | exports, `cn()`, `clsx()`, `twMerge()`             |

Vue needs no extra setup. The rule reads `vue-eslint-parser`'s template body directly, because that parser keeps the template outside the script scope and a `<script setup>` binding gets no reference from `:class="shell"`.

Angular and Lit are partial. An external `.html` template is a separate file, and ESLint reads one file at a time, so the rule cannot follow a reference into it. Class fields and exports are still reported, because those need no reference.

## no-class-constants

Reports a name that holds a cluster of utility classes.

```svelte
<script lang="ts">
  // Reported: the classes are hidden behind a name.
  const field = tw`grid content-start gap-1.5`;
  const label = tw`px-1 text-[0.8125rem] text-neutral-600`;
</script>

<div class={field}>
  <span class={label}>Name</span>
</div>
```

```svelte
<!-- Fine: the classes sit on the element, and the snippet is the unit of reuse. -->
{#snippet field(label: string, children: Snippet)}
  <div class="grid content-start gap-1.5">
    <span class="px-1 text-[0.8125rem] text-neutral-600">{label}</span>
    {@render children()}
  </div>
{/snippet}
```

### What it reports

Every shape that puts a cluster behind a name:

```ts
const a = tw`grid gap-1.5`;                          // a tagged class string
const b = "grid content-start gap-1.5 px-3";         // a plain string
const c = cn("relative isolate grid px-3", { ... }); // wrapped in a merger
const d = { sm: "size-8 p-1", lg: "size-10 p-2" };   // a variant map
const e = $derived(tw`px-2 py-1`);                   // a reactive wrapper
const f = `rounded-md px-3 text-${size}`;            // a template literal
const g = "grid items-start px-3 " + tone;           // concatenation
const h = () => tw`flex items-center gap-1`;         // a class string factory

export const i = "rounded-md p-4 shadow-xs";         // an exported cluster
class J { readonly k = "relative grid px-3"; }       // a class field
```

### What it leaves alone

```svelte
<!-- Utilities written where they apply. -->
<div class="mx-auto grid w-full max-w-4xl px-1 py-20"></div>

<!-- Inline arguments to a merger. -->
<span class={cn("cursor-default opacity-50", className)}></span>
```

```ts
// A prop default, which belongs to the component it styles.
let { class: className = "px-2 py-1 text-sm" } = $props();

// A tailwind-variants or cva map, which is a component's own public API.
export const button = tv({
  base: "grid items-center rounded-md font-medium",
  variants: { size: { sm: "px-2.5 py-1.25 text-sm" } },
});
```

### How it decides

A class string is only reported when the rule can prove it is a class value. There are two kinds of proof.

1. **A reference reaches a class position.** The binding is read inside a `class` attribute, a `*Class` prop, or a class merger such as `cn()`. The content bar is loose here, so a variant-only cluster like `"hidden sm:grid"` still counts.
2. **No reference exists to follow.** The name is an export, a class field, or a returned value, so the markup that uses it is in another file. The content bar is strict here: the cluster must carry at least one hyphenated utility, the namespace separator every utility-first engine uses.

A `tw` tagged template is proof on its own, because the tag exists only to hold class strings.

The content check never consults a list of utility names. It asks for two or more lowercase, space-free tokens with utility punctuation, after stripping arbitrary values in `[...]` and `(...)`. That is what lets custom utilities such as `hover-xs` or `brightness-active` count, while keeping out lookalike data such as `"private, no-store"`, `"read:user write:repo"` and `"image/png image/jpeg"`.

The report names the engine and the framework it found in your project, so the advice matches your stack:

```
The "field" binding holds Tailwind utility classes. Put the utilities on the
element they style. To reuse a cluster, extract a Svelte snippet or a component.
```

## Development

```sh
pnpm install
pnpm run check-types
pnpm run lint
pnpm run test
pnpm run build
```

## License

MIT
