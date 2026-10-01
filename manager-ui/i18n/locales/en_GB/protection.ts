import type { Locales } from "../../Locales";

export default {
  bulk: {
    protect: "Protect ({count})",
    unprotect: "Remove the protection ({count})",
    confirmTitle: "Protect {count} item(s)?",
    protected: "{count} item(s) protected",
    unprotected: "Protection removed from {count} item(s)",
  },
  protect: "Protect",
  unprotect: "Remove the protection",
  protected: "Protected: no edit, no deletion, no change of owner",
  confirmTitle: "Protect {label}?",
  confirmDescription:
    "Once protected, this item can no longer be edited, deleted or given another owner, by anyone. Only a root account can remove the protection.",
  protectedToast: "{label} is protected",
  unprotectedToast: "Protection removed from {label}",
  failed: "The protection could not be changed",
} satisfies Locales["protection"];
