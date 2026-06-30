// Mirror of noDefinePageMetaOutsidePages: every Vue file picked up by Nuxt
// as a route must declare its own definePageMeta() so the layout / middleware
// / page key are explicit (no implicit "default" surprises across reorgs).
// Triggered when the file lives under pages/ and the script setup never calls
// definePageMeta.
const pageDirectory = /(^|\/)(app\/)?pages\//;

export default {
  meta: {
    type: "problem",
    docs: { description: "Require definePageMeta() in every pages/**.vue file." },
    schema: [],
    messages: {
      missing: "Page must call definePageMeta() at the top of <script setup>.",
    },
  },
  create(context) {
    const filename = context.filename ?? context.getFilename?.() ?? "";
    if (!pageDirectory.test(filename)) return {};

    let seen = false;
    return {
      CallExpression(node) {
        if (node.callee?.type === "Identifier" && node.callee.name === "definePageMeta") {
          seen = true;
        }
      },
      "Program:exit"(node) {
        if (!seen) context.report({ node, messageId: "missing" });
      },
    };
  },
};
