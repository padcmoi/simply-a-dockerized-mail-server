import type { Locales } from "../../Locales";

export default {
  title: "Postfix and Dovecot logs",
  subtitle: "The last lines of the mail server logs, newest at the bottom.",
  search: "Filter the lines",
  older: "Load the 500 previous lines",
  beginning: "Beginning of the log",
  live: "Live",
  download: "Download the whole file",
  downloadFailed: "The log download failed",
  summary: "{n} lines shown out of {size}",
  updated: "written {at}",
  empty: "No line",
  loadFailed: "The log cannot be read",
} satisfies Locales["mailLogs"];
