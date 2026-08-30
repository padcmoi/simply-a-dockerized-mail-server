// Turning a flat list of messages into what a conversation looks like: day
// separators, and runs of messages from the same author collapsed into one
// block. None of it is specific to tickets, so it lives here rather than inside
// the component that happens to render it first.

// A burst is messages from one author close enough together to read as a single
// utterance. Five minutes is long enough to survive someone thinking mid-thread
// and short enough that a reply an hour later starts a new block.
const GROUP_WINDOW_MS = 5 * 60 * 1000;

export function dayKey(iso: string) {
  return new Date(iso).toDateString();
}

export function useMessageThread<T extends ThreadMessage>(messages: () => T[], isMine: (message: T) => boolean) {
  const { locale } = useI18n();

  const intlLocale = computed(() => locale.value.split("_")[0]);
  const dayFormat = computed(() => new Intl.DateTimeFormat(intlLocale.value, { dateStyle: "full" }));
  const timeFormat = computed(() => new Intl.DateTimeFormat(intlLocale.value, { timeStyle: "short" }));
  const dateTimeFormat = computed(() => new Intl.DateTimeFormat(intlLocale.value, { dateStyle: "medium", timeStyle: "short" }));

  const entries = computed<ThreadEntry<T>[]>(() => {
    const out: ThreadEntry<T>[] = [];
    const list = messages();
    let day: string | null = null;

    list.forEach((message, index) => {
      const at = new Date(message.createdAt).getTime();
      const currentDay = dayKey(message.createdAt);

      if (currentDay !== day) {
        day = currentDay;
        out.push({ kind: "day", key: `day-${currentDay}`, label: dayFormat.value.format(new Date(message.createdAt)) });
      }

      const sameRun = (other?: T) =>
        !!other &&
        other.authorEmail === message.authorEmail &&
        dayKey(other.createdAt) === currentDay &&
        Math.abs(new Date(other.createdAt).getTime() - at) < GROUP_WINDOW_MS;

      out.push({
        kind: "bubble",
        key: `m-${message.id}`,
        message,
        mine: isMine(message),
        at: timeFormat.value.format(new Date(message.createdAt)),
        leading: !sameRun(list[index - 1]),
        trailing: !sameRun(list[index + 1]),
      });
    });

    return out;
  });

  const formatDateTime = (iso: string) => dateTimeFormat.value.format(new Date(iso));

  return { entries, formatDateTime };
}
