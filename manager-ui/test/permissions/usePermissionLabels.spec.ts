import { describe, it, expect, vi } from "vitest";
import { ref } from "vue";
import { usePermissionLabels } from "~/composables/usePermissionLabels";

// t returns the key verbatim so we can assert exactly which i18n key each
// resource/action maps to; te is toggled to hit the raw-name fallback.
function stubI18n(te: (k: string) => boolean) {
  vi.stubGlobal("useI18n", () => ({
    t: (k: string) => k,
    te,
    locale: ref("en_GB"),
    locales: ref([]),
  }));
}

describe("usePermissionLabels resource maps", () => {
  it("maps every global resource, camelCasing the dashed/underscored keys", () => {
    stubI18n(() => true);
    const { globalResourceLabels } = usePermissionLabels();
    const g = globalResourceLabels.value;
    expect(g.sieve).toBe("groups.permissions.resources.global.sieve");
    expect(g["api-tokens"]).toBe("groups.permissions.resources.global.apiTokens");
    expect(g.domain_owner_elevated).toBe("groups.permissions.resources.global.domainOwnerElevated");
    expect(g.superadmin).toBe("groups.permissions.resources.global.superadmin");
  });

  it("maps every domain resource under the domain namespace", () => {
    stubI18n(() => true);
    const { domainResourceLabels } = usePermissionLabels();
    const d = domainResourceLabels.value;
    expect(d.domain).toBe("groups.permissions.resources.domain.domain");
    expect(d.recipients).toBe("groups.permissions.resources.domain.recipients");
    expect(d.dkim).toBe("groups.permissions.resources.domain.dkim");
    // The two tiers stay distinct: `rspamd` exists on both but under its own tier.
    const { globalResourceLabels } = usePermissionLabels();
    expect(d.rspamd).toBe("groups.permissions.resources.domain.rspamd");
    expect(globalResourceLabels.value.rspamd).toBe("groups.permissions.resources.global.rspamd");
  });
});

describe("usePermissionLabels.actionLabel", () => {
  it("builds the tiered key, camelCasing api-tokens and domain_owner_elevated", () => {
    stubI18n(() => true);
    const { actionLabel } = usePermissionLabels();
    expect(actionLabel("global", "api-tokens", "create")).toBe("groups.permissions.actionsLabel.global.apiTokens.create");
    expect(actionLabel("global", "domain_owner_elevated", "grant")).toBe(
      "groups.permissions.actionsLabel.global.domainOwnerElevated.grant"
    );
    expect(actionLabel("domain", "recipients", "modify")).toBe("groups.permissions.actionsLabel.domain.recipients.modify");
  });

  it("returns the raw action name when the key is untranslated", () => {
    stubI18n(() => false);
    const { actionLabel } = usePermissionLabels();
    expect(actionLabel("global", "rspamd", "view-rspamd-stats")).toBe("view-rspamd-stats");
    expect(actionLabel("domain", "dkim", "rotate")).toBe("rotate");
  });
});

describe("usePermissionLabels.actionLabelsFor", () => {
  it("returns an action -> label record for the resolved keys", () => {
    stubI18n(() => true);
    const { actionLabelsFor } = usePermissionLabels();
    expect(actionLabelsFor("global", "groups", ["create", "delete"])).toEqual({
      create: "groups.permissions.actionsLabel.global.groups.create",
      delete: "groups.permissions.actionsLabel.global.groups.delete",
    });
  });

  it("maps each action to its own raw name when none are translated", () => {
    stubI18n(() => false);
    const { actionLabelsFor } = usePermissionLabels();
    expect(actionLabelsFor("domain", "aliases", ["create", "delete"])).toEqual({
      create: "create",
      delete: "delete",
    });
  });

  it("returns an empty record for no actions", () => {
    stubI18n(() => true);
    const { actionLabelsFor } = usePermissionLabels();
    expect(actionLabelsFor("global", "sieve", [])).toEqual({});
  });
});
