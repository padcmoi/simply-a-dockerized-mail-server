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
    // Same omission on the dropdown menu: its `item` slot only carries
    // `data-disabled:cursor-not-allowed`, so an enabled entry keeps the text
    // cursor. Nested entries are covered too (the account menu's language and
    // appearance submenus): DropdownMenuContent passes this override down to
    // the sub-content it renders.
    dropdownMenu: {
      slots: {
        item: "cursor-pointer",
      },
    },
  },
});
