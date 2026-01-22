import { useState, useCallback, useEffect, useRef } from "react";
import {
  TLDRData,
  GitHubItem,
  Timeframe,
  StoredTLDRReport,
} from "../types/github";
import { apiClient } from "../utils/apiClient";

interface UseTLDRDataReturn {
  data: TLDRData;
  loading: boolean;
  error: string | null;
  lastReport: StoredTLDRReport | null;
  hasData: boolean;
  cached: boolean;
  generateReport: (force?: boolean) => void;
}

export const useTLDRData = (
  repo: string,
  timeframe: Timeframe,
): UseTLDRDataReturn => {
  const [data, setData] = useState<TLDRData>({
    prs: null,
    issues: null,
    people: null,
    tldr: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastReport, setLastReport] = useState<StoredTLDRReport | null>(null);
  const [cached, setCached] = useState(false);
  const requestInFlightRef = useRef(false);
  const lastRequestRef = useRef<string>("");
  const activeRequestIdRef = useRef<number>(0);

  // Store abort controllers for each request type
  const abortControllersRef = useRef<{
    people?: AbortController;
    prs?: AbortController;
    issues?: AbortController;
    tldr?: AbortController;
  }>({});

  // Generate new report with progressive loading (manual)
  const generateReport = useCallback(async (force: boolean = false) => {
    if (!repo || !timeframe) return;

    const requestKey = `${repo}-${timeframe}-${force}`;

    // Prevent duplicate requests for the same repo+timeframe+force (React.StrictMode protection)
    if (requestInFlightRef.current && lastRequestRef.current === requestKey) {
      console.log("🔄 Request already in flight for", requestKey, "- skipping duplicate (StrictMode protection)");
      // Ensure loading state is shown even for duplicate calls
      setLoading(true);
      return;
    }

    // Cancel any ongoing requests only if repo/timeframe changed
    if (lastRequestRef.current && lastRequestRef.current !== requestKey) {
      console.log("🚫 Aborting previous request for", lastRequestRef.current);
      Object.values(abortControllersRef.current).forEach((controller) => {
        if (controller) {
          controller.abort();
        }
      });
    }
    abortControllersRef.current = {};

    // Generate unique request ID for this call
    const currentRequestId = ++activeRequestIdRef.current;
    requestInFlightRef.current = true;
    lastRequestRef.current = requestKey;

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
    setCached(false);

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

      // Parse repo owner/name from URL
      // Handle both "owner/repo" and "https://github.com/owner/repo" formats
      let repoPath = repo;
      if (repo.startsWith("https://github.com/")) {
        repoPath = repo.replace("https://github.com/", "");
      } else if (repo.startsWith("http://github.com/")) {
        repoPath = repo.replace("http://github.com/", "");
      }
      const [owner, repoName] = repoPath.split("/");

      // 🔁 Load people right away (async and progressive)
      const peoplePromise = apiClient
        .getReportSection(owner, repoName, "people", timeframe, force, {
          signal: peopleController.signal,
        })
        .then((data) => {
          // Only update if not aborted AND still the active request
          if (!peopleController.signal.aborted && currentRequestId === activeRequestIdRef.current) {
            const peopleData = data.people ?? null;
            newData.people = peopleData;
            setData((prev) => ({ ...prev, people: peopleData }));
            if (data.cached) setCached(true);
          }
        })
        .catch((err) => {
          if (!peopleController.signal.aborted && currentRequestId === activeRequestIdRef.current) {
            console.error("Failed to fetch people:", err);
          }
        });

      // ⚡ Fetch PRs (async and progressive)
      const prsPromise = apiClient
        .getReportSection(owner, repoName, "prs", timeframe, force, {
          signal: prsController.signal,
        })
        .then((data) => {
          // Only update if not aborted AND still the active request
          if (!prsController.signal.aborted && currentRequestId === activeRequestIdRef.current) {
            const prsData = data.prs ?? [];
            newData.prs = prsData;
            setData((prev) => ({ ...prev, prs: prsData }));
            if (data.cached) setCached(true);
            return prsData;
          }
          return [];
        });

      // ⚡ Fetch Issues (async and progressive)
      const issuesPromise = apiClient
        .getReportSection(owner, repoName, "issues", timeframe, force, {
          signal: issuesController.signal,
        })
        .then((data) => {
          // Only update if not aborted AND still the active request
          if (!issuesController.signal.aborted && currentRequestId === activeRequestIdRef.current) {
            const issuesData = data.issues ?? [];
            newData.issues = issuesData;
            setData((prev) => ({ ...prev, issues: issuesData }));
            if (data.cached) setCached(true);
            return issuesData;
          }
          return [];
        });

      // ⏳ Wait for both PR and Issues before generating TLDR
      await Promise.all([prsPromise, issuesPromise]);

      // Check if requests were cancelled or superseded before proceeding to TLDR
      if (
        prsController.signal.aborted ||
        issuesController.signal.aborted ||
        currentRequestId !== activeRequestIdRef.current
      ) {
        return;
      }

      // ⚡ Fetch TL;DR (streaming endpoint - waits for PRs and Issues to be available)
      const tldrController = new AbortController();
      abortControllersRef.current.tldr = tldrController;

      const forceParam = force ? "&force=true" : "";
      const tldrRes = await apiClient.requestStream(
        `/reports/${owner}/${repoName}/tldr?timeframe=${timeframe}${forceParam}`,
        {
          signal: tldrController.signal,
        },
      );

      if (!tldrRes.ok || !tldrRes.body) {
        if (currentRequestId === activeRequestIdRef.current) {
          console.error("Failed to fetch TLDR summary");
        }
      } else {
        const reader = tldrRes.body.getReader();
        const decoder = new TextDecoder();
        let result = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done || tldrController.signal.aborted) break;

          const chunk = decoder.decode(value, { stream: true });
          result += chunk;

          // Only update if still the active request
          if (!tldrController.signal.aborted && currentRequestId === activeRequestIdRef.current) {
            newData.tldr = result;
            setData((prev) => ({ ...prev, tldr: result }));
          }
        }
      }

      // Wait for people promise to complete
      await peoplePromise;

      // Update last report metadata (only if still active request)
      if (currentRequestId === activeRequestIdRef.current) {
        setLastReport({
          id: `${repo}:${timeframe}`,
          repo,
          timeframe,
          data: newData,
          generatedAt: new Date().toISOString(),
          version: 3, // Version 3 = progressive loading with DB caching
        });
      }
    } catch (err: unknown) {
      // Only handle errors if this is still the active request
      if ((err as Error)?.name !== "AbortError" && currentRequestId === activeRequestIdRef.current) {
        console.error("Fetch error:", err);
        const errorMessage =
          (err as Error)?.message ||
          "Failed to load TL;DR data. Please try again.";
        setError(errorMessage);
      }
    } finally {
      // Only clear loading if this is still the active request
      // This prevents cancelled requests from clearing the loading state
      if (currentRequestId === activeRequestIdRef.current) {
        setLoading(false);
        requestInFlightRef.current = false;
      }
    }
  }, [repo, timeframe]);

  // Automatically fetch report when repo or timeframe changes
  useEffect(() => {
    if (repo && timeframe) {
      generateReport(); // Uses cache if available and fresh
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo, timeframe]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Don't abort requests or clear flags here to support StrictMode properly.
      // The duplicate check (requestInFlightRef + lastRequestRef) will prevent
      // the second mount from starting duplicate requests.
      // The request ID tracking ensures stale requests don't update state.
      // Only clear abort controllers to avoid memory leaks.
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
    cached,
    generateReport,
  };
};
