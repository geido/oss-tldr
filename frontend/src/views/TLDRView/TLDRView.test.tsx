import { beforeEach, describe, expect, test, vi } from "vitest";

import { renderWithProviders, screen } from "../../../tests/test-utils";
import TLDRView from "./index";

type UseTLDRDataHook = typeof import("../../hooks/useTLDRData").useTLDRData;

const mockUseTLDRData = vi.fn<UseTLDRDataHook>();

vi.mock("../../hooks/useTLDRData", () => ({
  useTLDRData: mockUseTLDRData,
}));

const baseData = {
  prs: null,
  issues: null,
  people: null,
  tldr: null,
};

describe("TLDRView", () => {
  beforeEach(() => {
    mockUseTLDRData.mockReset();
  });

  test("renders controls and shows loading state", () => {
    mockUseTLDRData.mockReturnValue({
      data: baseData,
      loading: true,
      error: "",
      lastReport: null,
      hasData: false,
      cached: false,
      generateReport: vi.fn(),
    });

    renderWithProviders(<TLDRView repo="octo/repo" onReset={vi.fn()} />);

    expect(
      screen.getByRole("combobox", { name: /timeframe/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /generate tl;dr/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/generating tl;dr/i)).toBeInTheDocument();
  });

  test("shows an error alert when fetch fails", () => {
    mockUseTLDRData.mockReturnValue({
      data: baseData,
      loading: false,
      error: "rate limit exceeded",
      lastReport: null,
      hasData: false,
      cached: false,
      generateReport: vi.fn(),
    });

    renderWithProviders(<TLDRView repo="octo/repo" onReset={vi.fn()} />);

    expect(screen.getByRole("alert")).toHaveTextContent(/rate limit/i);
  });
});
