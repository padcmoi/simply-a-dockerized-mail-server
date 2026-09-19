<script setup lang="ts">
definePageMeta({
  requiredGlobal: [
    { resource: "supervision", action: "access" },
    { resource: "supervision", action: "view-mail-logs" },
  ],
});

const { t } = useI18n();
const { set: setBreadcrumb } = useBreadcrumb();

setBreadcrumb([{ label: t("nav.mailLogs"), to: "/admin/mail-logs" }, { label: "Postfix" }]);
</script>

<template>
  <MailLogPanel service="postfix" />
</template>
