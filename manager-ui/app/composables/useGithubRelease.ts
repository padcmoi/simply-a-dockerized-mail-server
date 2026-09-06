import type { Ref } from "vue";
import { GITHUB_REPO } from "~/composables/useCodeVersion";
import type { GithubCommit, GithubRelease, GithubTag, ReleaseLookup } from "~/types/system/release";
import * as semver from "~/utils/semverTags";

// The release GitHub holds for the tag the server runs, read by the browser
// itself: the repository is public, the endpoint needs no key and answers with
// CORS open, and an anonymous address gets sixty calls an hour, two of which a
// visit to the page spends.
const API = `https://api.github.com/repos/${GITHUB_REPO}`;
const RAW = `https://raw.githubusercontent.com/${GITHUB_REPO}`;
const HEADERS = { Accept: "application/vnd.github+json" };

function statusOf(error: unknown) {
  const failure = error as FetchError;
  return failure.statusCode ?? failure.response?.status ?? null;
}

async function lookup(tag: string) {
  let release: GithubRelease;
  try {
    release = await $fetch<GithubRelease>(`${API}/releases/tags/${encodeURIComponent(tag)}`, { headers: HEADERS });
  } catch (error) {
    if (statusOf(error) === 404) return { release: null, commit: null };
    throw error;
  }
  const commit = await $fetch<GithubCommit>(`${API}/commits/${encodeURIComponent(tag)}`, { headers: HEADERS }).catch(() => null);
  return { release, commit };
}

export function useGithubRelease(version: Ref<string | null>) {
  const { data, status, error, refresh } = useAsyncData<ReleaseLookup | null>(
    "github-release",
    () => (version.value ? lookup(version.value) : Promise.resolve(null)),
    { server: false, watch: [version], default: () => null }
  );
  const rateLimited = computed(() => {
    const code = error.value ? statusOf(error.value) : null;
    return code === 403 || code === 429;
  });
  return { lookup: data, status, error, rateLimited, refresh };
}

// The CHANGELOG.md the tag carries, as the raw file: no API quota on that
// host, CORS open as well. Read as soon as the version is known.
export function useGithubChangelog(version: Ref<string | null>) {
  const { data, status, error, refresh } = useAsyncData<string | null>(
    "github-changelog",
    () =>
      version.value
        ? $fetch<string>(`${RAW}/${encodeURIComponent(version.value)}/CHANGELOG.md`, { responseType: "text" })
        : Promise.resolve(null),
    { server: false, watch: [version], default: () => null }
  );
  const missing = computed(() => (error.value ? statusOf(error.value) === 404 : false));
  return { changelog: data, status, missing, refresh };
}

// Every tag of the line the server runs, newest first, so the page can show
// any of them and not only the one answering. One call, no quota to speak of;
// a hundred tags is more than this repository will carry for years. The line
// is the running version's major, or the newest there is when the version is
// unknown.
export function useGithubTags(version: Ref<string | null>) {
  const { data, status, refresh } = useAsyncData<GithubTag[]>(
    "github-tags",
    () => $fetch<GithubTag[]>(`${API}/tags?per_page=100`, { headers: HEADERS }),
    { server: false, default: () => [] }
  );
  const names = computed(() => data.value.map((tag) => tag.name));
  const major = computed(() => semver.majorOf(version.value) ?? semver.newestMajor(names.value));
  const tags = computed(() => (major.value === null ? [] : semver.tagsOfMajor(names.value, major.value)));
  return { tags, major, status, refresh };
}
