import { useEffect } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { renderWithProviders, screen, waitFor } from "../../tests/test-utils";
import { useTLDRData } from "./useTLDRData";
import type { ApiClient } from "../utils/apiClient";
import type { GitHubItem, PeopleData } from "../types/github";

const mockGetReportSection = vi.fn<ApiClient["getReportSection"]>();
const mockRequestStream = vi.fn<ApiClient["requestStream"]>();

vi.mock("../utils/apiClient", () => ({
  apiClient: {
    getReportSection: mockGetReportSection,
    requestStream: mockRequestStream,
  },
}));

const streamResponse = () => {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode("Hello "));
      controller.enqueue(encoder.encode("World"));
      controller.close();
    },
  });

  return new Response(stream);
};

const baseItem: GitHubItem = {
  id: "item-1",
  number: 1,
  title: "Sample",
  state: "open",
  html_url: "https://example.com/item-1",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  comments: 0,
  labels: [],
  user: {
    login: "alice",
    avatar_url: "https://example.com/avatar",
    profile_url: "https://example.com/alice",
  },
  reactions: 0,
  is_pull_request: true,
  assignees: [],
  merged: false,
};

const prItem: GitHubItem = { ...baseItem, id: "pr-1", is_pull_request: true };
const issueItem: GitHubItem = {
  ...baseItem,
  id: "issue-1",
  is_pull_request: false,
};

const peopleEntry: PeopleData = {
  username: "alice",
  avatar_url: "https://example.com/avatar",
  profile_url: "https://example.com/alice",
  tldr: "Contributor summary",
  prs: [prItem],
  issues: [issueItem],
};

function HookHarness() {
  const { data, loading, hasData, generateReport } = useTLDRData(
    "octo/repo",
    "last_week",
  );

  useEffect(() => {
    generateReport();
  }, [generateReport]);

  return (
    <div>
      <div data-testid="loading">{loading ? "loading" : "done"}</div>
      <div data-testid="hasData">{String(hasData)}</div>
      <div data-testid="tldr">{data.tldr}</div>
      <div data-testid="people">{data.people?.length ?? 0}</div>
      <div data-testid="prs">{data.prs?.length ?? 0}</div>
      <div data-testid="issues">{data.issues?.length ?? 0}</div>
    </div>
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useTLDRData", () => {
  test("progressively loads sections and sets TLDR", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    mockGetReportSection
      .mockResolvedValueOnce({ people: [peopleEntry], cached: false })
      .mockResolvedValueOnce({ prs: [prItem], cached: false })
      .mockResolvedValueOnce({ issues: [issueItem], cached: false });
    mockRequestStream.mockResolvedValue(streamResponse());

    renderWithProviders(<HookHarness />);

    await waitFor(() =>
      expect(screen.getByTestId("loading").textContent).toBe("done"),
    );

    await waitFor(() =>
      expect(screen.getByTestId("tldr").textContent).toBe("Hello World"),
    );
    expect(screen.getByTestId("people").textContent).toBe("1");
    expect(screen.getByTestId("prs").textContent).toBe("1");
    expect(screen.getByTestId("issues").textContent).toBe("1");
    expect(mockGetReportSection).toHaveBeenCalledTimes(3);
    expect(mockRequestStream).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
