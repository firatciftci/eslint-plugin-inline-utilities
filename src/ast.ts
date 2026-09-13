import type { Rule } from "eslint";
/**
 * One structural node type for every parser this plugin supports. Svelte, Vue,
 * JSX, Astro and Angular each ship their own AST, and they share no common
 * TypeScript type, so the fields the rules actually read are declared here.
 */
export type AstNode = {
  type: string;
  parent?: AstNode;
  argument?: AstNode | null;
  body?: AstNode;
  callee?: AstNode;
  id?: AstNode;
  init?: AstNode | null;
  key?: AstNode;
  name?: AstNode | string;
  namespace?: AstNode;
  object?: AstNode;
  quasis?: Array<{ value: { cooked?: string | null; raw: string } }>;
  tag?: AstNode;
  value?: AstNode | bigint | boolean | number | string | null;
};

const CLASS_ATTRIBUTE_NAMES = new Set(["class:list", "classlist"]);
const CLASS_ATTRIBUTE_SUFFIXES = [
  "class",
  "classes",
  "classname",
  "classnames",
];

/**
 * ESLint types its visitors against ESTree, so a node arrives typed for one
 * parser only. This is the single place that widens it.
 */
export function asNode(node: object): AstNode {
  return node as AstNode;
}

/** The reverse of `asNode`, for the ESLint APIs that demand an ESTree node. */
export function asEstreeNode(node: AstNode): Rule.Node {
  const widened: unknown = node;
  return widened as Rule.Node;
}

function isNode(value: unknown): value is AstNode {
  return (
    typeof value === "object" &&
    value != null &&
    "type" in value &&
    typeof value.type === "string"
  );
}

/**
 * Walks every child node, skipping the `parent` back-reference so the walk
 * terminates.
 */
export function walk(node: AstNode, visit: (node: AstNode) => void): void {
  visit(node);

  for (const [key, value] of Object.entries(node)) {
    if (key === "parent") continue;
    if (Array.isArray(value)) {
      for (const item of value) if (isNode(item)) walk(item, visit);
    } else if (isNode(value)) {
      walk(value, visit);
    }
  }
}

export function calleeName(node: AstNode): string {
  const callee = node.callee;
  if (callee == null) return "";
  if (callee.type === "Identifier" && typeof callee.name === "string")
    return callee.name;
  if (
    callee.type === "MemberExpression" &&
    callee.object?.type === "Identifier" &&
    typeof callee.object.name === "string"
  )
    return callee.object.name;
  return "";
}

/**
 * Reads an attribute name across template parsers. Svelte and Vue keep it on
 * `key`, JSX and Astro on `name`. A Vue binding such as `:class` keeps the real
 * name on `key.argument`, while `key.name` only says `bind`. Astro's
 * `class:list` arrives as a namespaced name split in two.
 */
export function attributeName(node: AstNode): string | undefined {
  const key = node.key ?? node.name;
  if (key == null || typeof key === "string") return key;
  if (key.argument != null) return nameOf(key.argument);
  if (key.namespace != null) return `${nameOf(key.namespace)}:${nameOf(key)}`;
  return nameOf(key);
}

function nameOf(node: AstNode): string | undefined {
  const { name } = node;
  if (typeof name === "string") return name;
  if (name != null && typeof name.name === "string") return name.name;
}

/**
 * Matches `class` and `className`, the `class:list` and `classList`
 * spellings, and the `*Class` and `*Classes` props components use to forward
 * classes inward, such as `triggerClass` or `errorClasses`.
 */
export function isClassAttributeName(name: string | undefined): boolean {
  if (name == null) return false;
  const lowered = name.toLowerCase();
  if (CLASS_ATTRIBUTE_NAMES.has(lowered)) return true;
  return CLASS_ATTRIBUTE_SUFFIXES.some((suffix) => lowered.endsWith(suffix));
}
