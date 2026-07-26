import type { Locales } from "../Locales";
import app from "./fr_FR/app";
import apiErrors from "./fr_FR/apiErrors";
import nav from "./fr_FR/nav";
import presence from "./fr_FR/presence";
import layout from "./fr_FR/layout";
import common from "./fr_FR/common";
import error from "./fr_FR/error";
import confirm from "./fr_FR/confirm";
import login from "./fr_FR/login";
import dashboard from "./fr_FR/dashboard";
import domains from "./fr_FR/domains";
import recipients from "./fr_FR/recipients";
import aliases from "./fr_FR/aliases";
import quotas from "./fr_FR/quotas";
import notifications from "./fr_FR/notifications";
import tickets from "./fr_FR/tickets";
import sieve from "./fr_FR/sieve";
import profile from "./fr_FR/profile";
import preferences from "./fr_FR/preferences";
import accounts from "./fr_FR/accounts";
import invite from "./fr_FR/invite";
import mailboxOwner from "./fr_FR/mailboxOwner";
import domainDashboard from "./fr_FR/domainDashboard";
import postfixPage from "./fr_FR/postfixPage";
import rspamdPage from "./fr_FR/rspamdPage";
import apiTokens from "./fr_FR/apiTokens";
import groups from "./fr_FR/groups";
import config from "./fr_FR/config";

// One file per top-level namespace under ./fr_FR/, this file only assembles
// them. `satisfies Locales` still type-checks the whole tree here, and each
// chunk checks its own slice with `satisfies Locales["<key>"]`.
export default {
  app,
  apiErrors,
  nav,
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
} satisfies Locales;
