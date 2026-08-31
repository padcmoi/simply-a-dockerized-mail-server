import { useAuthStore } from "~/stores/auth";
import { usePermissionsStore } from "~/stores/permissions";
import { useDomainStore } from "~/stores/domain";

// Re-verifies ACL on *every* navigation (not just window-focus regains, which is
// all `useWindowFocus.ts` covers). Kept as a standalone middleware (rather than a
// shared composable with `useWindowFocus.ts`) because that composable is already
// committed and off-limits to edit; the small duplication of the check itself is an
// accepted tradeoff. Source of truth is always a fresh `usePermissionsStore` fetch,
// never the (long-lived) JWT payload; see security-hardening.md "fraîcheur des droits".
export default defineNuxtRouteMiddleware(async (to) => {
  const auth = useAuthStore();
  if (!auth.isAuthenticated) return;

  const perms = usePermissionsStore();
  if (!perms.loaded) {
    await perms.fetch().catch(() => undefined);
  }

  const isRoot = auth.session?.isRoot ?? false;
  if (isRoot) return;

  const meta = to.meta;
  if (meta.rootOnly) {
    showError({ statusCode: 403 });
    return;
  }

  for (const req of meta.requiredGlobal ?? []) {
    if (!perms.hasGlobal(req.resource, req.action)) {
      showError({ statusCode: 403 });
      return;
    }
  }

  const domain = useDomainStore();
  if (domain.selected) {
    for (const req of meta.requiredDomain ?? []) {
      if (!perms.hasDomain(domain.selected.id, req.resource, req.action)) {
        showError({ statusCode: 403 });
        return;
      }
    }
  }
});
