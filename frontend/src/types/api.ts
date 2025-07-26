// API Response Types
import { GitHubItem, PeopleData } from "./github";

export interface PatchItem {
  file: string;
  patch: string;
}

export interface PatchesResponse {
  patches: PatchItem[];
}

export interface DiffResponse {
  explanation: string;
}

export interface Repository {
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  private: boolean;
  fork: boolean;
  archived: boolean;
  language: string | null;
  stargazers_count: number;
  updated_at: string;
}

export interface UserReposResponse {
  repositories: Repository[];
}

export interface SearchReposResponse {
  repositories: Repository[];
  total_count: number;
}

export interface PeopleResponse {
  people: PeopleData[];
}

export interface PullRequestsResponse {
  prs: GitHubItem[];
}

export interface IssuesResponse {
  issues: GitHubItem[];
}
