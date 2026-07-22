<script lang="ts">
import { h, type VNode } from "vue";

// Draws the parsed message. Every node is created with `h`, so text coming from
// a message is only ever a child string: it cannot become an element, an
// attribute or a script. No `v-html`, hence no injection to guard against.
const renderInline: (_nodes: InlineNode[]) => (VNode | string)[] = (nodes) =>
  nodes.map((node) => {
    if (node.type === "text") return node.value;
    if (node.type === "break") return h("br");
    if (node.type === "code") {
      return h("code", { class: "px-1 py-0.5 rounded bg-default/15 font-mono text-[0.9em]" }, node.value);
    }
    if (node.type === "strong") return h("strong", { class: "font-semibold" }, renderInline(node.children));
    if (node.type === "em") return h("em", { class: "italic" }, renderInline(node.children));
    if (node.type === "strike") return h("s", { class: "line-through" }, renderInline(node.children));
    return h(
      "a",
      {
        href: node.href,
        target: "_blank",
        rel: "noopener noreferrer nofollow",
        class: "underline underline-offset-2 hover:opacity-80",
      },
      renderInline(node.children)
    );
  });

const renderBlocks: (_blocks: BlockNode[]) => VNode[] = (blocks) =>
  blocks.map((block) => {
    switch (block.type) {
      case "heading":
        return h(`h${Math.min(block.level + 2, 6)}`, { class: "font-semibold" }, renderInline(block.children));
      case "quote":
        return h("blockquote", { class: "border-l-2 border-current/30 ps-3 opacity-90" }, renderBlocks(block.blocks));
      case "list":
        return h(
          block.ordered ? "ol" : "ul",
          { class: [block.ordered ? "list-decimal" : "list-disc", "ps-5 space-y-0.5"] },
          block.items.map((item) => h("li", renderInline(item)))
        );
      case "codeBlock":
        return h(
          "pre",
          { class: "rounded-md bg-default/15 p-2 overflow-x-auto" },
          h("code", { class: "font-mono text-[0.85em] whitespace-pre" }, block.value)
        );
      case "rule":
        return h("hr", { class: "border-current/20" });
      default:
        return h("p", { class: "whitespace-pre-wrap break-words" }, renderInline(block.children));
    }
  });

export default defineComponent({
  props: { text: { type: String, required: true } },
  setup(props) {
    const blocks = computed(() => parseBlocks(props.text));
    return () => h("div", { class: "space-y-2" }, renderBlocks(blocks.value));
  },
});
</script>
