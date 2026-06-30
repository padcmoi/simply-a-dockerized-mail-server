// definePageMeta() is a Nuxt page macro: it only makes sense in files Nuxt
// auto-routes (under `pages/`). Calling it from a layout, component or
// composable is silently ignored at runtime, which masks the bug -- this
// rule turns the silent miss into a lint error.
const pageDirectory = /(^|\/)(app\/)?pages\//;

export default {
  meta: {
    type: "problem",
    docs: { description: "Disallow definePageMeta() outside of pages/." },
    schema: [],
    messages: {
      outsidePages: "definePageMeta() is only allowed in pages/**; it is a no-op everywhere else.",
    },
  },
  create(context) {
    const filename = context.filename ?? context.getFilename?.() ?? "";
    if (pageDirectory.test(filename)) return {};
    return {
      CallExpression(node) {
        if (node.callee?.type === "Identifier" && node.callee.name === "definePageMeta") {
          context.report({ node, messageId: "outsidePages" });
        }
      },
    };
  },
};
