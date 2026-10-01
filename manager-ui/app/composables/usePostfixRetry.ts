const RETRYABLE: readonly QueueName[] = ["deferred", "hold"];

export function usePostfixRetry(queue: () => QueueName | undefined, onRetried: () => void) {
  const { t } = useI18n();
  const { isRoot, hasGlobal } = usePermissions();
  const { call } = useApi();
  const { running, run } = useBulkRun();

  const canRetry = computed(() => {
    const name = queue();
    if (!name || !RETRYABLE.includes(name)) return false;
    return isRoot.value || (hasGlobal("postfix", "access") && hasGlobal("postfix", "retry-postfix-queue-message"));
  });

  async function retry(ids: (string | number)[]) {
    const name = queue();
    if (!ids.length || !name || !canRetry.value) return [];
    const done = await run(
      ids.map(String),
      (id) => call(`/postfix/queue/${name}/messages/${id}/retry`, { method: "POST" }),
      (count) => (count === 1 ? t("postfixPage.retried") : t("postfixPage.retriedMany", { count }))
    );
    if (done.length) onRetried();
    return done;
  }

  return { canRetry, retrying: running, retry };
}
