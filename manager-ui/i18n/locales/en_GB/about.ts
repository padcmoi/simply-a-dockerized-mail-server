import type { Locales } from "../../Locales";

export default {
  title: "Version",
  subtitle: "The software release this server is running.",
  onGithub: "See on GitHub",
  unavailable: "Unknown version",
  preRelease: "Pre-release",
  stable: "Stable",
  draft: "Draft",
  published: "Published on {date}",
  publishedAgo: "Published on {date} ({ago})",
  unpublished: "Not published",
  noNotes: "This release carries no notes.",
  noRelease: "No release published on GitHub for tag {version}.",
  viewTag: "See the tag on GitHub",
  loadFailed: "GitHub did not answer.",
  rateLimited: "The anonymous GitHub API limit is reached for your address. Try again in an hour.",
  retry: "Retry",
  changelog: "Changelog",
  changelogMissing: "No CHANGELOG.md file in tag {version}.",
} satisfies Locales["about"];
