import { beforeEach, describe, expect, test, vi } from "vitest";

import { renderWithProviders, screen, userEvent } from "../../../tests/test-utils";
import { RepoAutocomplete } from "./index";
import type { ApiClient } from "../../utils/apiClient";

const mockedGet = vi.fn<ApiClient["get"]>();

vi.mock("../../utils/apiClient", () => ({
  apiClient: {
    get: mockedGet,
  },
}));

const userReposResponse = {
  repositories: [
    {
      full_name: "octo/hello",
      name: "hello",
      private: false,
      stargazers_count: 10,
      language: "TypeScript",
      description: "hello repo",
    },
  ],
};

describe("RepoAutocomplete", () => {
  beforeEach(() => {
    mockedGet.mockReset();
    // First call for user repos, subsequent calls for search
    mockedGet.mockResolvedValueOnce(userReposResponse);
  });

  test("loads user repos and allows selecting a result", async () => {
    const handleChange = vi.fn();

    renderWithProviders(
      <RepoAutocomplete
        placeholder="Search repos"
        onChange={handleChange}
        excludeRepos={[]}
      />,
    );

    const combo = screen.getByRole("combobox", { name: /repository search/i });
    await userEvent.click(combo);

    const option = await screen.findByText("octo/hello");
    await userEvent.click(option);

    expect(handleChange).toHaveBeenCalledWith(
      "https://github.com/octo/hello",
      expect.objectContaining({ full_name: "octo/hello" }),
    );
  });
});
