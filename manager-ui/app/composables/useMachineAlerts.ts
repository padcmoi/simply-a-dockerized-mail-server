// The machine's in-app alerts, switched from the supervision page itself: the
// page where a figure goes red is the page where one decides to be told about
// it. It is the same preference as the `Machine` row of /profile/notifications,
// read and written through the same route.
//
// The email channel is carried through untouched on every write: this switch
// says whether the interface warns, and nothing about what lands in a mailbox.
import { useNotificationPreferences } from "~/composables/useNotifications";

export function useMachineAlerts() {
  const { load, save } = useNotificationPreferences();

  const channels = ref<NotificationChannels>({ inApp: false, email: false });
  const saving = ref(false);

  const enabled = computed(() => channels.value.inApp);

  async function read() {
    const preferences = await load();
    channels.value = preferences.supervision ?? { inApp: false, email: false };
    return channels.value;
  }

  async function toggle() {
    saving.value = true;
    try {
      const preferences = await save("supervision", { ...channels.value, inApp: !channels.value.inApp });
      channels.value = preferences.supervision ?? channels.value;
      return true;
    } catch {
      return false;
    } finally {
      saving.value = false;
    }
  }

  return { channels, enabled, saving, read, toggle };
}
