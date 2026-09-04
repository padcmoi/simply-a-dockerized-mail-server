import type { Locales } from "../Locales";
import app from "./en_GB/app";
import apiErrors from "./en_GB/apiErrors";
import nav from "./en_GB/nav";
import myspace from "./en_GB/myspace";
import presence from "./en_GB/presence";
import layout from "./en_GB/layout";
import common from "./en_GB/common";
import error from "./en_GB/error";
import confirm from "./en_GB/confirm";
import login from "./en_GB/login";
import dashboard from "./en_GB/dashboard";
import domains from "./en_GB/domains";
import recipients from "./en_GB/recipients";
import aliases from "./en_GB/aliases";
import quotas from "./en_GB/quotas";
import notifications from "./en_GB/notifications";
import tickets from "./en_GB/tickets";
import sieve from "./en_GB/sieve";
import profile from "./en_GB/profile";
import preferences from "./en_GB/preferences";
import accounts from "./en_GB/accounts";
import invite from "./en_GB/invite";
import mailboxOwner from "./en_GB/mailboxOwner";
import domainDashboard from "./en_GB/domainDashboard";
import postfixPage from "./en_GB/postfixPage";
import rspamdPage from "./en_GB/rspamdPage";
import apiTokens from "./en_GB/apiTokens";
import groups from "./en_GB/groups";
import config from "./en_GB/config";
import supervision from "./en_GB/supervision";
import table from "./en_GB/table";
import deliverability from "./en_GB/deliverability";
import activity from "./en_GB/activity";

// One file per top-level namespace under ./en_GB/, this file only assembles
// them. `satisfies Locales` still type-checks the whole tree here, and each
// chunk checks its own slice with `satisfies Locales["<key>"]`.
export default {
  app,
  apiErrors,
  nav,
  myspace,
  presence,
  layout,
  common,
  error,
  confirm,
  login,
  dashboard,
  domains,
  recipients,
  aliases,
  quotas,
  notifications,
  tickets,
  sieve,
  profile,
  preferences,
  accounts,
  invite,
  mailboxOwner,
  domainDashboard,
  postfixPage,
  rspamdPage,
  apiTokens,
  groups,
  config,
  supervision,
  table,
  deliverability,
  activity,
} satisfies Locales;
