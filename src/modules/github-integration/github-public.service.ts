import { GitHubClient, type GitHubRepo } from "./github-client";

const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour

type CacheEntry = {
  value: PublicRepoStats;
  expiresAt: number;
};

const cache = new Map<string, CacheEntry>();

let sharedClient: GitHubClient | null = null;

function getPublicClient(): GitHubClient {
  if (!sharedClient) {
    const token = process.env.GITHUB_PUBLIC_TOKEN ?? "";
    sharedClient = new GitHubClient(token);
  }
  return sharedClient;
}

export type PublicRepoStats = {
  fullName: string;
  htmlUrl: string;
  description: string | null;
  homepage: string | null;
  language: string | null;
  stargazersCount: number;
  forksCount: number;
  watchersCount: number;
  openIssuesCount: number;
  topics: string[];
  pushedAt: string;
  fetchedAt: string;
};

function toStats(repo: GitHubRepo): PublicRepoStats {
  return {
    fullName: repo.full_name,
    htmlUrl: repo.html_url,
    description: repo.description,
    homepage: repo.homepage,
    language: repo.language,
    stargazersCount: repo.stargazers_count,
    forksCount: repo.forks_count,
    watchersCount: repo.watchers_count,
    openIssuesCount: repo.open_issues_count,
    topics: repo.topics ?? [],
    pushedAt: repo.pushed_at,
    fetchedAt: new Date().toISOString()
  };
}

export async function getPublicRepoStats(
  owner: string,
  repo: string
): Promise<PublicRepoStats> {
  const key = `${owner.toLowerCase()}/${repo.toLowerCase()}`;
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }
  const client = getPublicClient();
  const data = await client.getRepo(owner, repo);
  const stats = toStats(data);
  cache.set(key, { value: stats, expiresAt: now + CACHE_TTL_MS });
  return stats;
}

export async function getPublicRepoStatsByFullName(
  fullName: string
): Promise<PublicRepoStats | null> {
  const [owner, repo] = fullName.split("/");
  if (!owner || !repo) return null;
  try {
    return await getPublicRepoStats(owner, repo);
  } catch {
    return null;
  }
}
