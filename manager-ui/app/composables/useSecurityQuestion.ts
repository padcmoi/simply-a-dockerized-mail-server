import { useAuthStore } from "~/stores/auth";

// The security question, shared by the page that sets it and the modal that
// nags for it: one read, one form, one way to save, so the two can never
// disagree about what is set.
export function useSecurityQuestion() {
  const { t } = useI18n();
  const { call } = useApi();
  const { apiErrorMessage } = useApiError();
  const toast = useToast();
  const auth = useAuthStore();

  const saving = ref(false);
  const form = reactive({ question: "", answer: "" });

  const { data: status, status: loadStatus } = useAsyncData(
    "security-question-status",
    () => call<SecurityQuestionStatus>("/auth/jwt/me/security-question"),
    { server: false }
  );

  const loading = computed(() => loadStatus.value !== "success" && loadStatus.value !== "error");
  const isSet = computed(() => status.value?.set === true);
  // What the API says right now, not what the session was told when it opened:
  // undefined until the answer lands, then true or false. A session persisted
  // before the question was cleared still carries the old flag, so anything
  // that gates on "has none" has to read this rather than the session.
  const answered = computed(() => (loadStatus.value === "success" ? status.value?.set === true : undefined));

  // The list is the API's, translated here and nowhere invented: a question the
  // server does not offer could never be asked at sign-in.
  const options = computed(() =>
    (status.value?.catalogue ?? []).map((key) => ({
      value: key,
      label: t(`profile.securityQuestionPage.questions.${key}`),
    }))
  );

  const chosenLabel = computed(() =>
    status.value?.question ? t(`profile.securityQuestionPage.questions.${status.value.question}`) : ""
  );

  const canSubmit = computed(() => !isSet.value && form.question.length > 0 && form.answer.trim().length > 0);

  // Lower case as it is typed, so what is stored is what was seen. The server
  // ignores case, accents and spacing anyway; showing it removes the doubt of
  // having to remember how it was capitalised a year later.
  function onAnswer(value: string) {
    form.answer = value.toLocaleLowerCase();
  }

  async function submit() {
    if (!canSubmit.value || saving.value) return;
    saving.value = true;
    try {
      await call("/auth/jwt/me/security-question", {
        method: "PUT",
        body: { question: form.question, answer: form.answer },
      });
      form.answer = "";
      toast.add({ title: t("profile.securityQuestionPage.saved"), color: "success" });
      await refreshNuxtData("security-question-status");
      // The session carries the flag the modal watches: without this it would
      // keep opening after the question has been answered.
      await auth.fetchProfile().catch(() => undefined);
    } catch (err) {
      toast.add({ title: t("profile.securityQuestionPage.failed"), description: apiErrorMessage(err), color: "error" });
    } finally {
      saving.value = false;
    }
  }

  return { form, status, loading, isSet, answered, options, chosenLabel, canSubmit, saving, onAnswer, submit };
}
