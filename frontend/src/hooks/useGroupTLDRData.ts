import { useCallback, useEffect, useRef, useState } from "react";

import {
  DigestTarget,
  GroupReportData,
  StoredGroupReport,
  Timeframe,
} from "../types/github";
import { GroupReportResponse } from "../types/api";
import { apiClient } from "../utils/apiClient";
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
  const [data, setData] = useState<GroupReportData>(emptyData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastReport, setLastReport] = useState<StoredGroupReport | null>(null);

  // React.StrictMode protection: prevent duplicate requests
  const requestInFlightRef = useRef(false);
  const lastRequestRef = useRef<string>("");
  const abortControllerRef = useRef<AbortController | null>(null);

  // Reset data when group or timeframe changes
  useEffect(() => {
    setData(emptyData);
    setLastReport(null);
    setError(null);
  }, [group.id, group.name, timeframe]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Cancel any in-flight request when unmounting
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const generateReport = useCallback(async () => {
    const requestKey = `${group.id ?? group.name}-${group.repos.join(",")}-${timeframe}`;

    // Prevent duplicate requests (React.StrictMode protection)
    if (requestInFlightRef.current && lastRequestRef.current === requestKey) {
      console.log("🔄 Group request already in flight for", requestKey, "- skipping duplicate");
      setLoading(true);
      return;
    }

    // Cancel any previous in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    requestInFlightRef.current = true;
    lastRequestRef.current = requestKey;
    setLoading(true);
    setError(null);

    const normalizedRepos = Array.from(
      new Set(group.repos.map((repo) => normalizeRepoIdentifier(repo))),
    );

    // Build request payload - prefer group_id for database-backed groups
    const payload: Record<string, unknown> = {
      timeframe,
    };

    if (group.id) {
      payload.group_id = group.id;
    } else {
      // Ad-hoc group without database ID
      payload.name = group.name;
      payload.repos = normalizedRepos;
    }

    try {
      const response = await apiClient.post<GroupReportResponse>(
        "groups/report",
        payload,
      );

      // Check if request was aborted before updating state
      if (abortController.signal.aborted) {
        return;
      }

      const reportData: GroupReportData = {
        tldr: response.tldr,
        repos: response.repos,
      };

      setData(reportData);

      // Track last report metadata (in-memory only, consistent with useTLDRData)
      setLastReport({
        id: `${response.group_id ?? group.id ?? group.name}:${timeframe}`,
        groupId: response.group_id ?? group.id,
        name: response.name,
        repos: normalizedRepos,
        timeframe,
        data: reportData,
        generatedAt: new Date().toISOString(),
        version: 2, // Version 2 = database-backed groups
      });
    } catch (err) {
      // Ignore aborted requests
      if ((err as Error)?.name === "AbortError") {
        return;
      }
      console.error("Failed to load group report", err);
      const message =
        err instanceof Error
          ? err.message
          : "Failed to generate group TL;DR. Please try again.";
      setError(message);
    } finally {
      requestInFlightRef.current = false;
      setLoading(false);
    }
  }, [group.id, group.name, group.repos, timeframe]);

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
