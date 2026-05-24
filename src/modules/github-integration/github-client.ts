import { ApiError } from "@/shared/errors/api-error";

const GITHUB_API = "https://api.github.com";
const DEFAULT_HEADERS = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "portfolio-saas/1"
};

export type GitHubUser = {
  login: string;
  id: number;
  name: string | null;
  avatar_url: string;
  html_url: string;
  bio: string | null;
  company: string | null;
  blog: string | null;
  location: string | null;
  email: string | null;
  public_repos: number;
  public_gists: number;
  followers: number;
  following: number;
  created_at: string;
};

export type GitHubRepo = {
  id: number;
  node_id: string;
  name: string;
  full_name: string;
  owner: { login: string; avatar_url: string };
  private: boolean;
  html_url: string;
  description: string | null;
  fork: boolean;
  homepage: string | null;
  language: string | null;
  stargazers_count: number;
  watchers_count: number;
  forks_count: number;
  open_issues_count: number;
  archived: boolean;
  disabled: boolean;
  topics: string[];
  default_branch: string;
  pushed_at: string;
  created_at: string;
  updated_at: string;
};

export type ListReposOptions = {
  visibility?: "all" | "public" | "private";
  affiliation?: string;
  sort?: "created" | "updated" | "pushed" | "full_name";
  direction?: "asc" | "desc";
  perPage?: number;
  page?: number;
};

export class GitHubClient {
  constructor(private readonly token: string) {}

  private async request<T>(
    path: string,
    init: RequestInit = {}
  ): Promise<{ data: T; scopes: string }> {
    const url = path.startsWith("http") ? path : `${GITHUB_API}${path}`;
    const headers = new Headers({
      ...DEFAULT_HEADERS,
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      ...(init.headers as Record<string, string> | undefined)
    });

    const response = await fetch(url, { ...init, headers });
    const scopes = response.headers.get("x-oauth-scopes") ?? "";

    if (response.status === 401) {
      throw ApiError.unauthorized(
        "El token de GitHub es inválido o ha expirado."
      );
    }
    if (response.status === 403) {
      const rateLimit = response.headers.get("x-ratelimit-remaining");
      throw ApiError.forbidden(
        rateLimit === "0"
          ? "Has alcanzado el límite de peticiones a GitHub. Inténtalo en unos minutos."
          : "El token no tiene permisos suficientes para esta operación."
      );
    }
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new ApiError(
        response.status as never,
        `GitHub respondió ${response.status}`,
        text ? { detail: text.slice(0, 400) } : undefined
      );
    }

    if (response.status === 204) {
      return { data: undefined as T, scopes };
    }

    const data = (await response.json()) as T;
    return { data, scopes };
  }

  async getViewer(): Promise<{ data: GitHubUser; scopes: string }> {
    return this.request<GitHubUser>("/user");
  }

  async listRepos(options: ListReposOptions = {}): Promise<GitHubRepo[]> {
    const params = new URLSearchParams({
      per_page: String(options.perPage ?? 30),
      page: String(options.page ?? 1),
      sort: options.sort ?? "pushed",
      direction: options.direction ?? "desc"
    });
    if (options.visibility) params.set("visibility", options.visibility);
    if (options.affiliation) params.set("affiliation", options.affiliation);

    const { data } = await this.request<GitHubRepo[]>(
      `/user/repos?${params.toString()}`
    );
    return data;
  }

  async getRepo(owner: string, repo: string): Promise<GitHubRepo> {
    const { data } = await this.request<GitHubRepo>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`
    );
    return data;
  }

  async getRepoLanguages(
    owner: string,
    repo: string
  ): Promise<Record<string, number>> {
    const { data } = await this.request<Record<string, number>>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/languages`
    );
    return data;
  }

  async getRepoTopics(owner: string, repo: string): Promise<string[]> {
    const { data } = await this.request<{ names: string[] }>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/topics`
    );
    return data.names;
  }

  async getRepoReadme(owner: string, repo: string): Promise<string | null> {
    try {
      const { data } = await this.request<{
        content: string;
        encoding: string;
      }>(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/readme`
      );
      if (data.encoding === "base64") {
        return Buffer.from(data.content, "base64").toString("utf8");
      }
      return data.content;
    } catch {
      return null;
    }
  }
}
