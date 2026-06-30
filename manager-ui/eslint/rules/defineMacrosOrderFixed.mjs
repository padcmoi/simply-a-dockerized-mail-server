// Enforce the configured top-level call-statement order inside <script setup>.
//
// Each top-level statement whose initializer (or expression) is a call is
// classified by the callee's name. The class index comes from `order`:
//   - an exact match wins.
//   - otherwise the longest "prefix*" entry matching the name wins
//     (so `useFoo`, `useBar`, `useThing` all fall into the `use*` bucket).
// Statements that do not match any entry are passed through (no constraint).
// When `defineExposeLast` is set, defineExpose() must come after every other
// classified statement.
export default {
  meta: {
    type: "suggestion",
    docs: { description: "Enforce ordering of script-setup macros and composables." },
    schema: [
      {
        type: "object",
        properties: {
          order: { type: "array", items: { type: "string" } },
          defineExposeLast: { type: "boolean" },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      wrongOrder: "'{{got}}' must be declared before '{{after}}' per the configured macro order.",
      exposeLast: "defineExpose() must be the last call in <script setup>.",
    },
  },
  create(context) {
    const options = context.options[0] || {};
    const order = Array.isArray(options.order) ? options.order : [];
    const defineExposeLast = options.defineExposeLast === true;

    const categoryFor = (name) => {
      if (!name) return -1;
      let bestIdx = -1;
      let bestLen = -1;
      for (let i = 0; i < order.length; i++) {
        const pat = order[i];
        if (pat === name) return i;
        if (pat.endsWith("*")) {
          const prefix = pat.slice(0, -1);
          if (name.startsWith(prefix) && prefix.length > bestLen) {
            bestIdx = i;
            bestLen = prefix.length;
          }
        }
      }
      return bestIdx;
    };

    const calleeName = (node) => {
      let cur = node;
      while (cur) {
        if (cur.type === "AwaitExpression") cur = cur.argument;
        else if (cur.type === "CallExpression") cur = cur.callee;
        else if (cur.type === "Identifier") return cur.name;
        else if (cur.type === "MemberExpression") return cur.property?.name ?? null;
        else return null;
      }
      return null;
    };

    const statementCall = (stmt) => {
      if (stmt.type === "VariableDeclaration") return calleeName(stmt.declarations?.[0]?.init);
      if (stmt.type === "ExpressionStatement") return calleeName(stmt.expression);
      return null;
    };

    return {
      Program(node) {
        const statements = node.body ?? [];
        let lastIdx = -1;
        let lastName = null;
        let exposeAt = -1;
        let lastNonExposeAt = -1;

        for (let i = 0; i < statements.length; i++) {
          const stmt = statements[i];
          const name = statementCall(stmt);
          if (!name) continue;
          const idx = categoryFor(name);
          if (idx < 0) continue;

          if (name === "defineExpose") exposeAt = i;
          else lastNonExposeAt = i;

          if (lastIdx >= 0 && idx < lastIdx) {
            context.report({
              node: stmt,
              messageId: "wrongOrder",
              data: { got: name, after: lastName ?? "previous call" },
            });
            return;
          }
          if (idx >= lastIdx) {
            lastIdx = idx;
            lastName = name;
          }
        }

        if (defineExposeLast && exposeAt >= 0 && exposeAt < lastNonExposeAt) {
          context.report({ node: statements[exposeAt], messageId: "exposeLast" });
        }
      },
    };
  },
};
