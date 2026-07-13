<script setup lang="ts">
// Avatar preview with a pencil that opens a modal to edit the URL (a long URL
// inline is ugly). The draft holds the edit until Apply, so Cancel reverts.
// Shared by the profile page and the admin account edit page.
const model = defineModel<string>({ required: true });
const props = defineProps<{ alt: string }>();

const { t } = useI18n();
const open = ref(false);
const draft = ref("");

const preview = computed(() => (model.value.trim() ? { src: model.value.trim(), alt: props.alt } : { alt: props.alt }));
const draftPreview = computed(() => {
  const src = draft.value.trim();
  return src ? { src, alt: props.alt } : { alt: props.alt };
});

function openModal() {
  draft.value = model.value;
  open.value = true;
}

function apply() {
  model.value = draft.value.trim();
  open.value = false;
}

function close() {
  open.value = false;
}
</script>

<template>
  <div class="relative shrink-0">
    <UAvatar :src="preview.src" :alt="preview.alt" size="3xl" />
    <UButton
      icon="i-lucide-pencil"
      color="neutral"
      size="xs"
      class="absolute -bottom-1 -end-1 rounded-full ring-2 ring-default"
      :aria-label="t('profile.editAvatar')"
      @click="openModal"
    />

    <UModal v-model:open="open" :title="t('profile.avatarUrl')">
      <template #body>
        <div class="space-y-4">
          <div class="flex justify-center">
            <UAvatar :src="draftPreview.src" :alt="draftPreview.alt" size="3xl" />
          </div>
          <UFormField :label="t('profile.avatarUrl')" :description="t('profile.avatarUrlHint')">
            <UInput v-model="draft" type="url" placeholder="https://..." icon="i-lucide-image" class="w-full" autofocus />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton color="neutral" variant="ghost" @click="close">{{ t("common.cancel") }}</UButton>
          <UButton color="primary" icon="i-lucide-check" @click="apply">{{ t("common.apply") }}</UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
