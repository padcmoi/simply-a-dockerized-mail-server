import type { Locales } from "../../Locales";

export default {
  generic: {
    title: "Something went wrong",
    description: "An unexpected error occurred. Please try again in a moment.",
  },
  403: {
    title: "Access denied",
    description: "You do not have permission to view this page.",
  },
  404: {
    title: "Page not found",
    description: "The page you are looking for does not exist or has moved.",
  },
} satisfies Locales["error"];
