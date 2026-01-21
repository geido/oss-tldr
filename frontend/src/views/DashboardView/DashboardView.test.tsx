import { beforeEach, describe, expect, test, vi } from "vitest";

import { renderWithProviders, screen, waitFor } from "../../../tests/test-utils";
import DashboardView from "./index";
import type { ApiClient } from "../../utils/apiClient";

const mockGetUserRepositories = vi.fn<ApiClient["getUserRepositories"]>();
const mockGet = vi.fn<ApiClient["get"]>();

vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: 1, login: "tester", avatar_url: "avatar.png" },
    token: "token",
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    setAuthData: vi.fn(),
  }),
}));

vi.mock("../../utils/apiClient", () => ({
  apiClient: {
    getUserRepositories: mockGetUserRepositories,
    get: mockGet,
  },
}));

describe("DashboardView", () => {
  beforeEach(() => {
    mockGetUserRepositories.mockReset();
    mockGet.mockReset();
  });

  test("renders empty state and add repo button when no repos", async () => {
    mockGetUserRepositories.mockResolvedValue({ repositories: [] });
    mockGet.mockResolvedValue({ repositories: [] });
    const onStartDigest = vi.fn();

    renderWithProviders(<DashboardView onStartDigest={onStartDigest} />);

    await waitFor(() =>
      expect(screen.getByText(/No repositories yet/i)).toBeInTheDocument(),
    );

    expect(
      screen.getByRole("button", { name: /add repository/i }),
    ).toBeInTheDocument();
  });
});
