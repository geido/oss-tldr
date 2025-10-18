import {
  GroupReportData,
  StoredGroupReport,
  Timeframe,
} from "../types/github";
import { UserStorage } from "./userStorage";
import { slugify } from "./slugify";

interface User {
  id: number;
  login: string;
  name?: string;
  avatar_url?: string;
  email?: string;
}

const BASE_STORAGE_KEY = "oss-tldr-group-reports";
const STORAGE_VERSION = 1;
const MAX_REPORTS = 20;

const buildReportId = (
  name: string,
  repos: string[],
  timeframe: Timeframe,
  groupId?: string | null,
) => {
  const base = groupId ? groupId : slugify(name);
  const repoSignature = repos.slice().sort().join("|");
  return `${base}:${repoSignature}:${timeframe}`;
};

export class GroupTLDRStorage {
  private static getStorageKey(user: User | null): string {
    return UserStorage.getUserKey(BASE_STORAGE_KEY, user);
  }

  private static getReports(user: User | null = null): StoredGroupReport[] {
    try {
      const storageKey = this.getStorageKey(user);
      const stored = localStorage.getItem(storageKey);
      if (!stored) return [];

      const reports = JSON.parse(stored) as StoredGroupReport[];
      return reports.filter((report) => report.version === STORAGE_VERSION);
    } catch (error) {
      console.error("Failed to load group reports from storage:", error);
      return [];
    }
  }

  private static saveReports(
    reports: StoredGroupReport[],
    user: User | null = null,
  ): void {
    try {
      const sorted = reports
        .sort(
          (a, b) =>
            new Date(b.generatedAt).getTime() -
            new Date(a.generatedAt).getTime(),
        )
        .slice(0, MAX_REPORTS);

      const storageKey = this.getStorageKey(user);
      localStorage.setItem(storageKey, JSON.stringify(sorted));
    } catch (error) {
      console.error("Failed to save group reports:", error);
    }
  }

  static getReport(
    group: { id?: string | null; name: string; repos: string[] },
    timeframe: Timeframe,
    user: User | null = null,
  ): StoredGroupReport | null {
    const reports = this.getReports(user);
    const id = buildReportId(group.name, group.repos, timeframe, group.id);
    return reports.find((report) => report.id === id) || null;
  }

  static saveReport(
    group: { id?: string | null; name: string; repos: string[] },
    timeframe: Timeframe,
    data: GroupReportData,
    user: User | null = null,
    resolvedGroupId?: string | null,
  ): void {
    const normalizedRepos = Array.from(
      new Set(
        group.repos
          .map((repo) => repo.trim())
          .filter((repo) => repo.length > 0),
      ),
    );
    const reportId = buildReportId(
      group.name,
      normalizedRepos,
      timeframe,
      resolvedGroupId ?? group.id,
    );

    const reports = this.getReports(user);
    const filtered = reports.filter((report) => report.id !== reportId);

    const newReport: StoredGroupReport = {
      id: reportId,
      groupId: resolvedGroupId ?? group.id,
      name: group.name,
      repos: normalizedRepos,
      timeframe,
      data,
      generatedAt: new Date().toISOString(),
      version: STORAGE_VERSION,
    };

    filtered.push(newReport);
    this.saveReports(filtered, user);
  }
}
