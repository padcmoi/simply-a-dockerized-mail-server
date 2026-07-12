import type { Locales } from "../Locales";
import app from "./en_EN/app";
import apiErrors from "./en_EN/apiErrors";
import nav from "./en_EN/nav";
import layout from "./en_EN/layout";
import common from "./en_EN/common";
import confirm from "./en_EN/confirm";
import login from "./en_EN/login";
import dashboard from "./en_EN/dashboard";
import domains from "./en_EN/domains";
import recipients from "./en_EN/recipients";
import aliases from "./en_EN/aliases";
import quotas from "./en_EN/quotas";
import sieve from "./en_EN/sieve";
import profile from "./en_EN/profile";
import preferences from "./en_EN/preferences";
import accounts from "./en_EN/accounts";
import invite from "./en_EN/invite";
import domainDashboard from "./en_EN/domainDashboard";
import postfixPage from "./en_EN/postfixPage";
import rspamdPage from "./en_EN/rspamdPage";
import apiTokens from "./en_EN/apiTokens";
import groups from "./en_EN/groups";

// One file per top-level namespace under ./en_EN/, this file only assembles
// them. `satisfies Locales` still type-checks the whole tree here, and each
// chunk checks its own slice with `satisfies Locales["<key>"]`.
export default {
  app,
  apiErrors,
  nav,
  layout,
  common,
  confirm,
  login,
  dashboard,
  domains,
  recipients,
  aliases,
  quotas,
  sieve,
  profile,
  preferences,
  accounts,
  invite,
  domainDashboard,
  postfixPage,
  rspamdPage,
  apiTokens,
  groups,
} satisfies Locales;
