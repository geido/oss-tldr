import { StoredTLDRReport, TLDRData, Timeframe } from "../types/github";
import { UserStorage } from "./userStorage";

interface User {
  id: number;
  login: string;
  name?: string;
  avatar_url?: string;
  email?: string;
}

const BASE_STORAGE_KEY = "oss-tldr-reports";
const STORAGE_VERSION = 1;
const MAX_REPORTS = 50; // Limit storage size

export class TLDRStorage {
  private static getStorageKey(user: User | null): string {
    return UserStorage.getUserKey(BASE_STORAGE_KEY, user);
  }

  private static getReports(user: User | null = null): StoredTLDRReport[] {
    try {
      const storageKey = this.getStorageKey(user);
      const stored = localStorage.getItem(storageKey);
      if (!stored) return [];

      const reports = JSON.parse(stored) as StoredTLDRReport[];
      // Filter out reports from older versions
      return reports.filter((report) => report.version === STORAGE_VERSION);
    } catch (error) {
      console.error("Failed to load TLDR reports from storage:", error);
      return [];
    }
  }

  private static saveReports(
    reports: StoredTLDRReport[],
    user: User | null = null,
  ): void {
    try {
      // Keep only the most recent reports
      const sortedReports = reports
        .sort(
          (a, b) =>
            new Date(b.generatedAt).getTime() -
            new Date(a.generatedAt).getTime(),
        )
        .slice(0, MAX_REPORTS);

      const storageKey = this.getStorageKey(user);
      localStorage.setItem(storageKey, JSON.stringify(sortedReports));
    } catch (error) {
      console.error("Failed to save TLDR reports to storage:", error);
    }
  }

  static getReport(
    repo: string,
    timeframe: Timeframe,
    user: User | null = null,
  ): StoredTLDRReport | null {
    const reports = this.getReports(user);
    const id = `${repo}:${timeframe}`;
    return reports.find((report) => report.id === id) || null;
  }

  static saveReport(
    repo: string,
    timeframe: Timeframe,
    data: TLDRData,
    user: User | null = null,
  ): void {
    const reports = this.getReports(user);
    const id = `${repo}:${timeframe}`;

    // Remove existing report for this repo/timeframe
    const filteredReports = reports.filter((report) => report.id !== id);

    // Add new report
    const newReport: StoredTLDRReport = {
      id,
      repo,
      timeframe,
      data,
      generatedAt: new Date().toISOString(),
      version: STORAGE_VERSION,
    };

    filteredReports.push(newReport);
    this.saveReports(filteredReports, user);
  }

  static getAllReports(user: User | null = null): StoredTLDRReport[] {
    return this.getReports(user);
  }

  static deleteReport(
    repo: string,
    timeframe: Timeframe,
    user: User | null = null,
  ): void {
    const reports = this.getReports(user);
    const id = `${repo}:${timeframe}`;
    const filteredReports = reports.filter((report) => report.id !== id);
    this.saveReports(filteredReports, user);
  }

  static clearAllReports(user: User | null = null): void {
    try {
      const storageKey = this.getStorageKey(user);
      localStorage.removeItem(storageKey);
    } catch (error) {
      console.error("Failed to clear TLDR reports:", error);
    }
  }

  static getStorageSize(user: User | null = null): string {
    try {
      const storageKey = this.getStorageKey(user);
      const stored = localStorage.getItem(storageKey);
      if (!stored) return "0 KB";

      const sizeInBytes = new Blob([stored]).size;
      const sizeInKB = (sizeInBytes / 1024).toFixed(1);
      return `${sizeInKB} KB`;
    } catch {
      return "Unknown";
    }
  }
}
