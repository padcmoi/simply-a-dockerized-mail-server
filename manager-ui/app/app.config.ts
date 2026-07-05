export default defineAppConfig({
  ui: {
    colors: { primary: "blue", neutral: "slate" },
    // Nuxt UI's checkbox doesn't ship a pointer cursor by default even though
    // the whole control (box + label) is clickable -- apply it app-wide so
    // every checkbox, present and future, gets it for free. `select-none` on
    // the label stops accidental text selection when clicking checkboxes
    // rapidly (e.g. the permissions grid).
    checkbox: {
      slots: {
        root: "cursor-pointer",
        base: "cursor-pointer",
        label: "cursor-pointer select-none",
        description: "select-none",
      },
    },
  },
});
