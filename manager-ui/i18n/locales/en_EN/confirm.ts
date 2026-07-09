import type { Locales } from "../../Locales";

export default {
  title: "Confirm deletion",
  description: "This action cannot be undone.",
  proceed: "Delete",
  proceedAction: "Confirm",
  countdownHint: "Cancel before the countdown ends to stop the deletion.",
  countdownHintAction: "Cancel before the countdown ends to stop this action.",
  clicksHint: "Keep clicking the button to confirm the deletion.",
  clicksHintAction: "Keep clicking the button to confirm this action.",
} satisfies Locales["confirm"];
