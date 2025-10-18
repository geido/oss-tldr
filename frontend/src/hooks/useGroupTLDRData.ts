import { useCallback, useEffect, useState } from "react";

import {
  DigestTarget,
  GroupReportData,
  StoredGroupReport,
  Timeframe,
} from "../types/github";
import { GroupReportResponse } from "../types/api";
import { useAuth } from "./useAuth";
import { apiClient } from "../utils/apiClient";
import { GroupTLDRStorage } from "../utils/groupStorage";
import { normalizeRepoIdentifier } from "../utils/repoUtils";

type UseGroupTLDRDataReturn = {
  data: GroupReportData;
  loading: boolean;
  error: string | null;
  lastReport: StoredGroupReport | null;
  hasData: boolean;
  generateReport: () => Promise<void>;
};

const emptyData: GroupReportData = {
  tldr: null,
  repos: [],
};

export const useGroupTLDRData = (
  group: Extract<DigestTarget, { kind: "group" }>,
  timeframe: Timeframe,
): UseGroupTLDRDataReturn => {
  const { user } = useAuth();
  const [data, setData] = useState<GroupReportData>(emptyData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastReport, setLastReport] = useState<StoredGroupReport | null>(null);

  const loadStoredReport = useCallback(() => {
    try {
      const normalized = group.repos.map((repo) => normalizeRepoIdentifier(repo));
      const stored = GroupTLDRStorage.getReport(
        { id: group.id, name: group.name, repos: normalized },
        timeframe,
        user,
      );
      if (stored) {
        setData(stored.data);
        setLastReport(stored);
      } else {
        setData(emptyData);
        setLastReport(null);
      }
    } catch (error) {
      console.warn("Skipping stored group report lookup due to invalid repo", error);
      setData(emptyData);
      setLastReport(null);
    }
  }, [group.id, group.name, group.repos, timeframe, user]);

  useEffect(() => {
    loadStoredReport();
    setError(null);
  }, [loadStoredReport]);

  const generateReport = useCallback(async () => {
    setLoading(true);
    setError(null);

    const normalizedRepos = Array.from(
      new Set(group.repos.map((repo) => normalizeRepoIdentifier(repo))),
    );

    const payload: Record<string, unknown> = {
      timeframe,
    };

    if (group.id) {
      payload.group_id = group.id;
    }

    if (!group.id || normalizedRepos.length) {
      payload.repos = normalizedRepos;
    }

    if (!group.id) {
      payload.name = group.name;
    }

    try {
      const response = await apiClient.post<GroupReportResponse>(
        "groups/report",
        payload,
      );

      const reportData: GroupReportData = {
        tldr: response.tldr,
        repos: response.repos,
      };

      setData(reportData);

      GroupTLDRStorage.saveReport(
        { id: response.group_id ?? group.id, name: response.name, repos: normalizedRepos },
        timeframe,
        reportData,
        user,
        response.group_id ?? group.id,
      );

      const saved = GroupTLDRStorage.getReport(
        { id: response.group_id ?? group.id, name: response.name, repos: normalizedRepos },
        timeframe,
        user,
      );
      setLastReport(saved);
    } catch (err) {
      console.error("Failed to load group report", err);
      const message =
        err instanceof Error
          ? err.message
          : "Failed to generate group TL;DR. Please try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [group.id, group.name, group.repos, timeframe, user]);

  const hasData = data.repos.length > 0 || Boolean(data.tldr);

  return {
    data,
    loading,
    error,
    lastReport,
    hasData,
    generateReport,
  };
};
