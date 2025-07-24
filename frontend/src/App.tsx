import React, { useState } from "react";
import RepoInputView from "./views/RepoInputView";
import TLDRView from "./views/TLDRView";
import { notification } from "antd";
import { TLDRData, GitHubItem } from "./types/github";

function App() {
  const [hasStarted, setHasStarted] = useState(false);
  const [repo, setRepo] = useState("");
  const [tldrData, setTLDRData] = useState<TLDRData>({
    prs: null,
    issues: null,
    people: null,
    tldr: null,
  });
  const openNotification = (message: string) => {
    notification.error({
      message: "Error",
      description: message,
      duration: 3,
    });
  };

  const handleStart = async (repo: string, timeframe: string) => {
    setHasStarted(true);
    setRepo(repo);
    setTLDRData({ prs: null, issues: null, people: null, tldr: null });

    const payload = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repo_url: repo, timeframe }),
    };

    // 🔁 Load people right away (async)
    fetch("/api/v1/people", payload)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.people) {
          setTLDRData((prev) => ({ ...prev, people: data.people }));
        }
      })
      .catch((err) => {
        console.error("Failed to fetch people:", err);
        openNotification("Failed to load contributors.");
      });

    // ⚡ Fetch PRs (async and progressive)
    const prsPromise = fetch("/api/v1/prs", payload)
      .then((res) => (res.ok ? res.json() : Promise.reject("PR fetch failed")))
      .then((data) => {
        setTLDRData((prev) => ({ ...prev, prs: data.prs || [] }));
        return data.prs || [];
      });

    // ⚡ Fetch Issues (async and progressive)
    const issuesPromise = fetch("/api/v1/issues", payload)
      .then((res) =>
        res.ok ? res.json() : Promise.reject("Issue fetch failed"),
      )
      .then((data) => {
        setTLDRData((prev) => ({ ...prev, issues: data.issues || [] }));
        return data.issues || [];
      });

    // ⏳ Wait for both before generating TLDR
    try {
      const [prs, issues] = await Promise.all([prsPromise, issuesPromise]);

      const summaries = [
        ...prs.map((pr: GitHubItem) => pr.summary).filter(Boolean),
        ...issues.map((issue: GitHubItem) => issue.summary).filter(Boolean),
      ].join("\n");

      const tldrRes = await fetch("/api/v1/tldr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: summaries }),
      });

      if (!tldrRes.ok || !tldrRes.body)
        throw new Error("Failed to fetch TLDR summary");

      const reader = tldrRes.body.getReader();
      const decoder = new TextDecoder();
      let result = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        result += chunk;
        setTLDRData((prev) => ({ ...prev, tldr: result })); // Progressive update
      }
    } catch (err) {
      console.error(err);
      openNotification("Failed to load TL;DR data. Please try again.");
    }
  };

  const handleReset = () => {
    setHasStarted(false);
    setRepo("");
    setTLDRData({ prs: null, issues: null, people: null, tldr: null });
  };

  return (
    <>
      {!hasStarted && <RepoInputView onStartDigest={handleStart} />}
      {hasStarted && (
        <TLDRView repo={repo} data={tldrData} onReset={handleReset} />
      )}
    </>
  );
}

export default App;
