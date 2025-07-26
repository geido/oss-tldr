import { useState, useEffect, useRef, useCallback } from "react";
import {
  TLDRData,
  GitHubItem,
  Timeframe,
  StoredTLDRReport,
} from "../types/github";
import { TLDRStorage } from "../utils/tldrStorage";
import { apiClient } from "../utils/apiClient";
import { useAuth } from "./useAuth";
import {
  PeopleResponse,
  PullRequestsResponse,
  IssuesResponse,
} from "../types/api";

interface UseTLDRDataReturn {
  data: TLDRData;
  loading: boolean;
  error: string | null;
  lastReport: StoredTLDRReport | null;
  hasData: boolean;
  generateReport: () => void;
}

export const useTLDRData = (
  repo: string,
  timeframe: Timeframe,
): UseTLDRDataReturn => {
  const { user } = useAuth();
  const [data, setData] = useState<TLDRData>({
    prs: null,
    issues: null,
    people: null,
    tldr: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastReport, setLastReport] = useState<StoredTLDRReport | null>(null);

  // Store abort controllers for each request type
  const abortControllersRef = useRef<{
    people?: AbortController;
    prs?: AbortController;
    issues?: AbortController;
    tldr?: AbortController;
  }>({});

  // Generate new report (manual)
  const generateReport = useCallback(async () => {
    if (!repo || !timeframe) return;

    // Cancel any ongoing requests
    Object.values(abortControllersRef.current).forEach((controller) => {
      if (controller) {
        controller.abort();
      }
    });
    abortControllersRef.current = {};

    // Reset state and create fresh data object
    setLoading(true);
    setError(null);
    const newData: TLDRData = {
      prs: null,
      issues: null,
      people: null,
      tldr: null,
    };
    setData(newData);

    const requestPayload = { repo_url: repo, timeframe };

    try {
      // Create abort controllers for each request
      const peopleController = new AbortController();
      const prsController = new AbortController();
      const issuesController = new AbortController();

      abortControllersRef.current = {
        people: peopleController,
        prs: prsController,
        issues: issuesController,
      };

      // 🔁 Load people right away (async)
      const peoplePromise = apiClient
        .post<PeopleResponse>("people", requestPayload, {
          signal: peopleController.signal,
        })
        .then((data) => {
          if (data?.people && !peopleController.signal.aborted) {
            newData.people = data.people;
            setData((prev) => ({ ...prev, people: data.people }));
          }
        })
        .catch((err) => {
          if (!peopleController.signal.aborted) {
            console.error("Failed to fetch people:", err);
            const errorMessage = err.message || "Failed to load contributors.";
            setError(errorMessage);
          }
        });

      // ⚡ Fetch PRs (async and progressive)
      const prsPromise = apiClient
        .post<PullRequestsResponse>("prs", requestPayload, {
          signal: prsController.signal,
        })
        .then((data) => {
          if (!prsController.signal.aborted) {
            newData.prs = data.prs || [];
            setData((prev) => ({ ...prev, prs: data.prs || [] }));
            return data.prs || [];
          }
          return [];
        });

      // ⚡ Fetch Issues (async and progressive)
      const issuesPromise = apiClient
        .post<IssuesResponse>("issues", requestPayload, {
          signal: issuesController.signal,
        })
        .then((data) => {
          if (!issuesController.signal.aborted) {
            newData.issues = data.issues || [];
            setData((prev) => ({ ...prev, issues: data.issues || [] }));
            return data.issues || [];
          }
          return [];
        });

      // ⏳ Wait for both PR and Issues before generating TLDR
      const [prs, issues] = await Promise.all([prsPromise, issuesPromise]);

      // Check if requests were cancelled before proceeding to TLDR
      if (prsController.signal.aborted || issuesController.signal.aborted) {
        return;
      }

      const summaries = [
        ...prs.map((pr: GitHubItem) => pr.summary).filter(Boolean),
        ...issues.map((issue: GitHubItem) => issue.summary).filter(Boolean),
      ].join("\n");

      if (summaries) {
        const tldrController = new AbortController();
        abortControllersRef.current.tldr = tldrController;

        const tldrRes = await apiClient.postStream(
          "tldr",
          { text: summaries },
          {
            signal: tldrController.signal,
          },
        );

        if (!tldrRes.ok || !tldrRes.body) {
          throw new Error("Failed to fetch TLDR summary");
        }

        const reader = tldrRes.body.getReader();
        const decoder = new TextDecoder();
        let result = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done || tldrController.signal.aborted) break;

          const chunk = decoder.decode(value, { stream: true });
          result += chunk;

          if (!tldrController.signal.aborted) {
            newData.tldr = result;
            setData((prev) => ({ ...prev, tldr: result }));
          }
        }
      }

      // Wait for people promise to complete
      await peoplePromise;

      // Save successful report to storage
      TLDRStorage.saveReport(repo, timeframe, newData, user);

      // Update last report metadata
      const savedReport = TLDRStorage.getReport(repo, timeframe, user);
      if (savedReport) {
        setLastReport(savedReport);
      }
    } catch (err: unknown) {
      if ((err as Error)?.name !== "AbortError") {
        console.error("Fetch error:", err);
        // Preserve specific error messages from the backend
        const errorMessage =
          (err as Error)?.message ||
          "Failed to load TL;DR data. Please try again.";
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  }, [repo, timeframe, user]);

  // Load stored data on mount or when repo/timeframe changes
  useEffect(() => {
    if (!repo || !timeframe) return;

    const storedReport = TLDRStorage.getReport(repo, timeframe, user);
    if (storedReport) {
      setLastReport(storedReport);
      setData(storedReport.data);
    } else {
      setLastReport(null);
      setData({ prs: null, issues: null, people: null, tldr: null });
    }
    setError(null);
  }, [repo, timeframe, user]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      Object.values(abortControllersRef.current).forEach((controller) => {
        if (controller) {
          controller.abort();
        }
      });
      abortControllersRef.current = {};
    };
  }, []);

  const hasData = !!(data.prs || data.issues || data.people || data.tldr);

  return {
    data,
    loading,
    error,
    lastReport,
    hasData,
    generateReport,
  };
};
