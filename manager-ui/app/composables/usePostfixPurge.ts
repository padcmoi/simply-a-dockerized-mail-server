export function usePostfixPurge(queue: () => QueueName | undefined, onPurged: () => void) {
  const { t } = useI18n();
  const { isRoot, hasGlobal } = usePermissions();
  const { call } = useApi();
  const { apiErrorMessage } = useApiError();
  const toast = useToast();

  const targets = ref<string[]>([]);
  const purging = ref(false);
  const canPurge = computed(
    () => isRoot.value || (hasGlobal("postfix", "access") && hasGlobal("postfix", "purge-postfix-queue-message"))
  );
  const confirmOpen = computed({
    get: () => targets.value.length > 0,
    set: (open: boolean) => {
      if (!open) targets.value = [];
    },
  });
  const confirmTitle = computed(() =>
    targets.value.length === 1
      ? t("postfixPage.purgeTitle", { id: targets.value[0] ?? "" })
      : t("postfixPage.purgeManyTitle", { count: targets.value.length })
  );
  const confirmDescription = computed(() =>
    t(targets.value.length > 1 ? "postfixPage.purgeManyDescription" : "postfixPage.purgeDescription")
  );

  function ask(ids: (string | number)[]) {
    targets.value = ids.map(String);
  }

  async function purge() {
    const ids = targets.value;
    const name = queue();
    targets.value = [];
    if (!ids.length || !name) return [];
    purging.value = true;
    const done: string[] = [];
    let lastError: unknown = null;
    for (const id of ids) {
      try {
        await call(`/postfix/queue/${name}/messages/${id}`, { method: "DELETE" });
        done.push(id);
      } catch (err) {
        lastError = err;
      }
    }
    purging.value = false;
    if (done.length) {
      toast.add({
        title:
          done.length === 1
            ? t("postfixPage.purged", { id: done[0] ?? "" })
            : t("postfixPage.purgedMany", { count: done.length }),
        color: "success",
        icon: "i-lucide-check",
      });
      onPurged();
    }
    if (lastError) {
      toast.add({
        title: t("postfixPage.purgeFailedMany", { count: ids.length - done.length }),
        description: apiErrorMessage(lastError),
        color: "error",
      });
    }
    return done;
  }

  return { canPurge, confirmOpen, confirmTitle, confirmDescription, purging, ask, purge };
}
