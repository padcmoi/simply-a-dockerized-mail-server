export interface GithubReleaseAsset {
  name: string;
  size: number;
  download_count: number;
  browser_download_url: string;
}

export interface GithubRelease {
  tag_name: string;
  name: string | null;
  body: string | null;
  draft: boolean;
  prerelease: boolean;
  published_at: string | null;
  html_url: string;
  author: { login: string; html_url: string } | null;
  assets: GithubReleaseAsset[];
}

export interface GithubCommit {
  sha: string;
  html_url: string;
}

export interface ReleaseLookup {
  release: GithubRelease | null;
  commit: GithubCommit | null;
}

// One entry of GET /repos/{repo}/tags: the name is all the page reads.
export interface GithubTag {
  name: string;
  commit: { sha: string };
}
