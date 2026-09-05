// The release the server is running. It is the API's answer and not a constant
// on this side: the front would otherwise show the version it was built from,
// not the one answering it. GET /api/v1 is public, so the login screen can name
// it before anyone has signed in.
export const GITHUB_REPO = "padcmoi/simply-a-dockerized-mail-server";
export const RELEASES_URL = `https://github.com/${GITHUB_REPO}/releases/tag`;

export interface ApiInfo {
  code_version: string;
}

const fetchInfo = () => $fetch<ApiInfo>("/api/v1");

export function useCodeVersion() {
  const { data, pending } = useAsyncData("api-info", fetchInfo, { server: false });
  const version = computed(() => data.value?.code_version ?? null);
  const releaseUrl = computed(() => (version.value ? `${RELEASES_URL}/${version.value}` : null));
  return { version, pending, releaseUrl };
}
