import type { Rule } from "eslint";
import type { AstNode } from "#/ast.js";
import {
  asEstreeNode,
  asNode,
  attributeName,
  calleeName,
  isClassAttributeName,
  walk,
} from "#/ast.js";
import { describeProject } from "#/detect.js";

/** Tagged templates that exist only to hold class strings. */
const CLASS_STRING_TAGS = new Set(["tw"]);

/** Calls whose result is a class value, so a reference into one is proof. */
const CLASS_MERGE_CALLS = new Set([
  "classNames",
  "classnames",
  "clsx",
  "cn",
  "cva",
  "cx",
  "tv",
  "twJoin",
  "twMerge",
]);

/**
 * Calls that pass a class string through to the name that holds it. `tv` and
 * `cva` are absent on purpose: a variant map is a component's own API, not a
 * reusability shortcut.
 */
const CLASS_VALUE_CALLS = new Set([
  "$derived",
  "classNames",
  "classnames",
  "clsx",
  "cn",
  "computed",
  "createMemo",
  "cx",
  "twJoin",
  "twMerge",
  "useComputed$",
  "useMemo",
]);

const CLASS_VALUE_CONTAINERS = new Set([
  "ArrayExpression",
  "BinaryExpression",
  "ConditionalExpression",
  "LogicalExpression",
  "ObjectExpression",
  "Property",
  "TSAsExpression",
  "TSNonNullExpression",
  "TSSatisfiesExpression",
]);

const MARKUP_BOUNDARIES = new Set([
  "JSXOpeningElement",
  "Program",
  "SvelteStartTag",
  "VStartTag",
]);

const GROUPED_VALUE = /\[[^\]]*\]|\([^)]*\)/g;
const UTILITY_MARKER = /[-:[/]/;
const UTILITY_TOKEN = /^(?=.*[a-z])[\d!#$%&*+./:>@_a-z~-]+$/;
const WHITESPACE = /\s/;

/**
 * Recognizes a cluster of utility classes without a list of utility names,
 * which Tailwind v4 and UnoCSS both let a project extend. Bare utilities such
 * as `grid`, `relative` and `isolate` are indistinguishable from prose, so
 * this asks only for two or more lowercase, space-free tokens with at least
 * one carrying utility punctuation. Every token needs a letter, which keeps
 * out the punctuation a template literal leaves between its expressions, such
 * as the two hyphens in `` `${name}-${x}-${y}` ``.
 *
 * Arbitrary values are stripped first, because a comma or a paren outside
 * `[...]` or `(...)` never appears in a real class token. That keeps out the
 * strings most apt to read like utilities, such as `"private, no-store"` and
 * `"(prefers-reduced-motion: reduce)"`.
 */
function isUtilityCluster(value: string): boolean {
  if (!WHITESPACE.test(value)) return false;

  const tokens = value.trim().split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return false;

  let marked = 0;
  for (const token of tokens) {
    if (!UTILITY_TOKEN.test(token.replaceAll(GROUPED_VALUE, ""))) return false;
    if (UTILITY_MARKER.test(token)) marked += 1;
  }

  return marked > 0;
}

/**
 * The strict bar, for a site with no local reference to follow: an export, a
 * class field or a returned value. The hyphen is the namespace separator in
 * every utility-first engine, so a real cluster carries at least one
 * hyphenated utility. Keeping this off the reference-proven path preserves
 * variant-only clusters such as `"hidden sm:grid"`.
 */
function hasHyphenatedUtility(value: string): boolean {
  for (const token of value.trim().split(/\s+/))
    if (token.replaceAll(GROUPED_VALUE, "").includes("-")) return true;
  return false;
}

function isClassValuePosition(node: AstNode): boolean {
  if (node.type.endsWith("Attribute"))
    return isClassAttributeName(attributeName(node));
  if (node.type === "CallExpression")
    return CLASS_MERGE_CALLS.has(calleeName(node));
  return false;
}

/**
 * The node that would give a class string a name, when `child` is the value it
 * takes. A class field counts, because an Angular or Lit component keeps its
 * class strings there.
 */
function namingSite(node: AstNode, child: AstNode): AstNode | undefined {
  if (node.type === "VariableDeclarator" && node.init === child)
    return node.id?.type === "Identifier" ? node.id : undefined;
  if (node.type === "PropertyDefinition" && node.value === child)
    return node.key?.type === "Identifier" ? node.key : undefined;
  if (node.type === "ReturnStatement" && node.argument === child) return node;
  if (node.type === "ArrowFunctionExpression" && node.body === child)
    return child;
}

function canHoldClassValue(node: AstNode): boolean {
  return node.type === "CallExpression"
    ? CLASS_VALUE_CALLS.has(calleeName(node))
    : CLASS_VALUE_CONTAINERS.has(node.type);
}

/**
 * Walks out of a class string to the name that keeps it alive. Returns nothing
 * when the string stays at its point of use, such as an inline attribute, an
 * inline prop object or a `tv()` variant map, which is the shape the rule
 * wants people to write.
 */
function bindingSite(start: AstNode): AstNode | undefined {
  let child = start;

  for (let node = start.parent; node != null; node = node.parent) {
    const site = namingSite(node, child);
    if (site != null) return site;
    if (!canHoldClassValue(node)) return;
    child = node;
  }
}

function canReachClassValue(identifier: AstNode): boolean {
  for (
    let node: AstNode | undefined = identifier;
    node != null;
    node = node.parent
  ) {
    if (isClassValuePosition(node)) return true;
    if (MARKUP_BOUNDARIES.has(node.type)) return false;
  }
  return false;
}

/**
 * Names a Vue template reads in a class position. vue-eslint-parser keeps the
 * template outside the script scope, so a `<script setup>` binding gets no
 * reference from `:class="shell"` and the parent walk cannot reach it. Reading
 * the template once gives the same proof by name.
 */
function templateClassNames(templateBody: unknown): Set<string> {
  const names = new Set<string>();
  if (templateBody == null || typeof templateBody !== "object") return names;

  walk(asNode(templateBody), (node) => {
    if (!isClassValuePosition(node)) return;
    walk(node, (inner) => {
      if (inner.type === "Identifier" && typeof inner.name === "string")
        names.add(inner.name);
    });
  });

  return names;
}

/**
 * An exported binding has no local reference worth following, because the
 * markup that consumes it sits in another file and ESLint reads one file at a
 * time. Exporting a utility cluster is the pattern this rule forbids, so the
 * content check stands alone there.
 */
function isExported(identifier: AstNode): boolean {
  return identifier.parent?.parent?.parent?.type === "ExportNamedDeclaration";
}

export const noClassConstants: Rule.RuleModule = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow naming a cluster of utility classes, which hides the classes that apply to an element",
      url: "https://github.com/firatciftci/eslint-plugin-inline-utilities/blob/main/README.md#no-class-constants",
    },
    schema: [],
    messages: {
      named:
        'The "{{name}}" binding holds {{utilities}}. Put the utilities on the element they style. To reuse a cluster, {{advice}}.',
      returned:
        "This function returns {{utilities}}. Put the utilities on the element they style. To reuse a cluster, {{advice}}.",
    },
  },

  create(context) {
    const { sourceCode } = context;
    const { advice, utilities } = describeProject(context.cwd);
    const reported = new Set<AstNode>();
    let vueNames: Set<string> | undefined;

    /**
     * True when a binding reaches a class attribute or a class merger, so the
     * string it holds is provably a class value and not lowercase data that
     * happens to resemble one.
     */
    function isProvenClassValue(identifier: AstNode): boolean {
      const declarator = identifier.parent;
      if (declarator == null) return false;

      const [variable] = sourceCode.getDeclaredVariables(
        asEstreeNode(declarator),
      );
      const references = variable?.references ?? [];
      for (const reference of references)
        if (
          reference.isRead() &&
          canReachClassValue(asNode(reference.identifier))
        )
          return true;

      const { templateBody } = sourceCode.ast as { templateBody?: unknown };
      vueNames ??= templateClassNames(templateBody);
      return (
        typeof identifier.name === "string" && vueNames.has(identifier.name)
      );
    }

    /** `text` is the class string, or nothing when a tag already proves it. */
    function check(start: AstNode, text?: string): void {
      const site = bindingSite(start);
      if (site == null || reported.has(site)) return;

      const isNamed = site.type === "Identifier";
      const isLocalBinding =
        isNamed &&
        site.parent?.type === "VariableDeclarator" &&
        !isExported(site);

      if (text != null) {
        if (isLocalBinding && !isProvenClassValue(site)) return;
        if (!isLocalBinding && !hasHyphenatedUtility(text)) return;
      }

      reported.add(site);
      context.report({
        node: asEstreeNode(site),
        messageId: isNamed ? "named" : "returned",
        data: {
          advice,
          name: isNamed && typeof site.name === "string" ? site.name : "",
          utilities,
        },
      });
    }

    return {
      TaggedTemplateExpression(node) {
        const tag = asNode(node.tag);
        if (
          tag.type === "Identifier" &&
          typeof tag.name === "string" &&
          CLASS_STRING_TAGS.has(tag.name)
        )
          check(asNode(node));
      },

      Literal(node) {
        if (typeof node.value === "string" && isUtilityCluster(node.value))
          check(asNode(node), node.value);
      },

      TemplateLiteral(node) {
        if (asNode(node).parent?.type === "TaggedTemplateExpression") return;
        const text = node.quasis
          .map((quasi) => quasi.value.cooked ?? quasi.value.raw)
          .join("");
        if (isUtilityCluster(text)) check(asNode(node), text);
      },
    };
  },
};
