export type GitHubItem = {
  id: string;
  number: number;
  title: string;
  state: string;
  summary?: string;
  html_url: string;
  created_at: string;
  updated_at: string;
  comments: number;
  labels: string[];
  user: {
    login: string;
    avatar_url: string;
    profile_url: string;
  };
  reactions?: number;
  is_pull_request: boolean;
  assignees?: {
    login: string;
    avatar_url: string;
    profile_url: string;
  }[];
  merged?: boolean;
};

export type Contributor = {
  username: string;
  avatar_url: string;
  profile_url: string;
  tldr: string;
  prs: GitHubItem[];
  issues: GitHubItem[];
};

export type PeopleData = {
  username: string;
  avatar_url: string;
  profile_url: string;
  tldr: string;
  prs: GitHubItem[];
  issues: GitHubItem[];
};

export type Timeframe = "last_day" | "last_week" | "last_month" | "last_year";

export type TLDRData = {
  prs: GitHubItem[] | null;
  issues: GitHubItem[] | null;
  people: PeopleData[] | null;
  tldr: string | null;
};

export type StoredTLDRReport = {
  id: string; // `${repo}:${timeframe}`
  repo: string;
  timeframe: Timeframe;
  data: TLDRData;
  generatedAt: string; // ISO timestamp
  version: number; // For future migration
};

export type RepoSummary = {
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
};
