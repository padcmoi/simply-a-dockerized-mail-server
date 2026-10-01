export type ProtectableKind = "account" | "recipient" | "alias" | "domain";

export function useProtectionRights(kind: ProtectableKind) {
  const { isRoot, hasGlobal } = usePermissions();

  const byPermission = kind === "recipient" || kind === "alias";
  const canProtect = computed(
    () => isRoot.value || (byPermission && hasGlobal("misc", "access") && hasGlobal("misc", "protect-resource"))
  );
  const canUnprotect = computed(() => isRoot.value);

  return { canProtect, canUnprotect };
}

export function unprotectedKeys<T extends { id: string | number; isProtected: number }>(rows: T[]) {
  return rows.filter((row) => row.isProtected !== 1).map((row) => row.id);
}
