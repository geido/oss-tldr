import type { GitHubItem, PeopleData } from "../types/github";

interface ApiRequestInit extends RequestInit {
  skipAuth?: boolean;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    const envUrl = import.meta.env.VITE_API_BASE_URL;

    // Order of resolution:
    // 1. Passed explicitly (useful for testing)
    // 2. Vite environment variable (injected at build time)
    // 3. Fallback to default
    this.baseUrl = baseUrl || envUrl || "/api/v1";
  }

  private getAuthToken(): string | null {
    return localStorage.getItem("oss_tldr_auth_token");
  }

  private buildUrl(endpoint: string): string {
    return `${this.baseUrl}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;
  }

  private buildHeaders(options: ApiRequestInit = {}): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    if (!options.skipAuth) {
      const token = this.getAuthToken();
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    }

    return headers;
  }

  async request<T>(endpoint: string, options: ApiRequestInit = {}): Promise<T> {
    const url = this.buildUrl(endpoint);
    const headers = this.buildHeaders(options);

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      // Clear auth tokens but don't reload - let AuthContext/AuthGuard handle it
      localStorage.removeItem("oss_tldr_auth_token");
      localStorage.removeItem("oss_tldr_user");
      throw new Error("Authentication required");
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.detail || `HTTP ${response.status}: ${response.statusText}`,
      );
    }

    return response.json();
  }

  async requestStream(
    endpoint: string,
    options: ApiRequestInit = {},
  ): Promise<Response> {
    const url = this.buildUrl(endpoint);
    const headers = this.buildHeaders(options);

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      // Clear auth tokens but don't reload - let AuthContext/AuthGuard handle it
      localStorage.removeItem("oss_tldr_auth_token");
      localStorage.removeItem("oss_tldr_user");
      throw new Error("Authentication required");
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.detail || `HTTP ${response.status}: ${response.statusText}`,
      );
    }

    return response;
  }

  async get<T>(endpoint: string, options: ApiRequestInit = {}): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: "GET" });
  }

  async post<T>(
    endpoint: string,
    data?: Record<string, unknown>,
    options: ApiRequestInit = {},
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async postStream(
    endpoint: string,
    data?: Record<string, unknown>,
    options: ApiRequestInit = {},
  ): Promise<Response> {
    return this.requestStream(endpoint, {
      ...options,
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(
    endpoint: string,
    data?: Record<string, unknown>,
    options: ApiRequestInit = {},
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: "DELETE",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  // Database-backed API methods

  /**
   * Get a specific report section (prs, issues, people, or tldr) with database caching.
   * This supports progressive loading - each section loads independently.
   */
  async getReportSection(
    owner: string,
    repo: string,
    section: "prs" | "issues" | "people" | "tldr",
    timeframe: "last_day" | "last_week" | "last_month" | "last_year",
    force: boolean = false,
    options?: ApiRequestInit,
  ): Promise<{
    prs?: GitHubItem[];
    issues?: GitHubItem[];
    people?: PeopleData[];
    tldr?: string;
    cached: boolean;
  }> {
    const forceParam = force ? "&force=true" : "";
    return this.get(`/reports/${owner}/${repo}/${section}?timeframe=${timeframe}${forceParam}`, options);
  }

  /**
   * Get all repositories tracked by the current user
   */
  async getUserRepositories() {
    return this.get("/users/me/repositories");
  }

  /**
   * Track a repository for the current user
   */
  async trackRepository(repo_url: string) {
    return this.post("/users/me/repositories", { repo_url });
  }

  /**
   * Untrack a repository for the current user
   */
  async untrackRepository(repo_url: string) {
    return this.delete("/users/me/repositories", { repo_url });
  }
}

export const apiClient = new ApiClient();
export { ApiClient };
