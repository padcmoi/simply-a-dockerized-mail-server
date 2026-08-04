import type { Locales } from "../../Locales";

export default {
  subtitle: "Server-wide spam filter statistics and recent scan history.",
  uptime: "uptime {s}s",
  history: {
    title: "Scan history",
    noData: "No scan history yet. History is persisted in Redis and accumulates over time.",
  },
  col: {
    from: "From",
    to: "To",
    action: "Action",
    score: "Score",
    size: "Size",
    time: "Time",
  },
  bayes: {
    title: "Bayesian statistics",
    noData: "No Bayes statfile yet.",
    symbol: "Symbol",
    type: "Type",
    learns: "Learns",
    users: "Users",
  },
  actions: {
    title: "Action thresholds",
    hint: "Score at which each action triggers. Lower thresholds are reached first: greylist, then add header, then rewrite subject, then reject.",
    softReject: "Soft reject",
    greylist: "Greylist",
    addHeader: "Add header",
    rewriteSubject: "Rewrite subject",
    reject: "Reject",
    negativeError: "Thresholds cannot be negative.",
    orderError: "Thresholds must increase: greylist < add header < rewrite subject < reject.",
    save: "Save",
    saved: "Action thresholds saved",
    saveFailed: "Failed to save action thresholds",
    readOnlyHint: "You need the rspamd modify and delete permissions to edit these thresholds.",
    reset: "Reset to defaults",
    confirmReset: "Reset action thresholds to defaults?",
    confirmResetDesc:
      "This discards the current thresholds and restores this project's shipped baseline (reject 15, add header 5, greylist and rewrite subject disabled).",
    resetDone: "Action thresholds reset to defaults",
    resetFailed: "Failed to reset action thresholds",
  },
} satisfies Locales["rspamdPage"];
