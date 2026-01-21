import React, { useState, useEffect, useCallback, useRef } from "react";
import { Select, Spin, Tag, Empty, type SelectProps } from "antd";
import {
  GithubOutlined,
  StarOutlined,
  LockOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import styled from "styled-components";
import { apiClient } from "../../utils/apiClient";
import { RepoSummary } from "../../types/github";
import {
  UserReposResponse,
  SearchReposResponse,
  Repository,
} from "../../types/api";

const StyledSelect = styled(Select<string>)<SelectProps<string>>`
  &.ant-select .ant-select-selector {
    border-radius: 8px;
  }

  &.ant-select .ant-select-selection-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 500;
  }
`;

const OptionContent = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
  gap: 12px;
`;

const RepoInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const RepoName = styled.div`
  font-weight: 600;
  font-size: ${({ theme }) => theme.token.fontSizeSM}px;
  color: ${({ theme }) => theme.token.colorText};
  margin-bottom: 2px;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.token.paddingXXS}px;

  .anticon {
    font-size: ${({ theme }) => theme.token.fontSizeSM}px;
  }
`;

const RepoDescription = styled.div`
  color: ${({ theme }) => theme.token.colorTextSecondary};
  font-size: ${({ theme }) => theme.token.fontSizeSM}px;
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 300px;
`;

const RepoStats = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
`;

const StatItem = styled.span`
  display: flex;
  align-items: center;
  gap: 2px;
  color: ${({ theme }) => theme.token.colorTextSecondary};
  font-size: ${({ theme }) => theme.token.fontSizeSM}px;

  .anticon {
    font-size: ${({ theme }) => theme.token.fontSizeSM - 1}px;
  }
`;

const SectionHeader = styled.div`
  padding: ${({ theme }) => theme.token.paddingXS}px
    ${({ theme }) => theme.token.paddingSM}px;
  background: ${({ theme }) => theme.token.colorFillQuaternary};
  color: ${({ theme }) => theme.token.colorTextTertiary};
  font-size: ${({ theme }) => theme.token.fontSizeSM}px;
  font-weight: 600;
  border-bottom: 1px solid ${({ theme }) => theme.token.colorBorder};
  margin: -4px -8px 4px -8px;
`;

type RepoAutocompleteProps = {
  value?: string;
  onChange?: (value: string, repoData?: RepoSummary) => void;
  placeholder?: string;
  size?: "small" | "middle" | "large";
  excludeRepos?: string[]; // Array of full_name to exclude
};

export const RepoAutocomplete: React.FC<RepoAutocompleteProps> = ({
  value,
  onChange,
  placeholder = "Search for repositories...",
  size = "large",
  excludeRepos = [],
}) => {
  const [userRepos, setUserRepos] = useState<Repository[]>([]);
  const [searchResults, setSearchResults] = useState<Repository[]>([]);
  const [userReposLoading, setUserReposLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [userReposLoaded, setUserReposLoaded] = useState(false);
  const userReposRequested = useRef(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadUserRepos = useCallback(async () => {
    if (userReposLoaded || userReposRequested.current) return;
    userReposRequested.current = true;

    setUserReposLoading(true);
    try {
      const response = await apiClient.get<UserReposResponse>(
        "repos/user?per_page=50",
      );
      const filteredRepos = response.repositories.filter(
        (repo: Repository) => !excludeRepos.includes(repo.full_name),
      );
      setUserRepos(filteredRepos);
      setUserReposLoaded(true);
    } catch (error) {
      console.error("Failed to load user repositories:", error);
    } finally {
      setUserReposLoading(false);
    }
  }, [userReposLoaded, excludeRepos]);

  const searchPublicRepos = useCallback(
    async (query: string) => {
      setSearchLoading(true);
      try {
        const response = await apiClient.get<SearchReposResponse>(
          `repos/search?q=${encodeURIComponent(query)}&per_page=20`,
        );
        const filteredRepos = response.repositories.filter(
          (repo: Repository) => !excludeRepos.includes(repo.full_name),
        );
        setSearchResults(filteredRepos);
      } catch (error) {
        console.error("Failed to search repositories:", error);
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    },
    [excludeRepos],
  );

  const handleSearch: NonNullable<SelectProps<string>["onSearch"]> = (
    searchText,
  ) => {
    setSearchQuery(searchText);
  };

  const handleChange: NonNullable<SelectProps<string>["onChange"]> = (
    repoUrl,
  ) => {
    // Find the repo data from our state
    const allRepos = [...userRepos, ...searchResults];
    const selectedRepo = allRepos.find(
      (repo) => `https://github.com/${repo.full_name}` === repoUrl,
    );

    onChange?.(repoUrl, selectedRepo);
  };

  const handleClear = () => {
    setSearchQuery("");
    setSearchResults([]);
    onChange?.("");
  };

  const formatRepoOption = (repo: Repository, isUserRepo: boolean = false) => {
    const repoUrl = `https://github.com/${repo.full_name}`;

    // Rich but compact selected display
    const selectedLabel = (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          minWidth: 0,
        }}
      >
        <GithubOutlined style={{ color: "#1677ff", fontSize: "12px" }} />
        {repo.private && (
          <LockOutlined style={{ color: "#faad14", fontSize: "12px" }} />
        )}
        <span
          style={{
            fontWeight: 500,
            color: "#262626",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {repo.full_name}
        </span>
        {repo.language && (
          <Tag color="blue" style={{ fontSize: "10px", marginLeft: "4px" }}>
            {repo.language}
          </Tag>
        )}
        {isUserRepo && (
          <Tag color="green" style={{ fontSize: "10px" }}>
            Owned
          </Tag>
        )}
      </div>
    );

    return {
      value: repoUrl,
      label: selectedLabel, // Rich but compact for selected display
      children: (
        <OptionContent>
          <RepoInfo>
            <RepoName>
              <GithubOutlined />
              {repo.private && <LockOutlined style={{ color: "#faad14" }} />}
              {repo.full_name}
              {repo.language && (
                <Tag color="blue" style={{ fontSize: 10, marginLeft: 4 }}>
                  {repo.language}
                </Tag>
              )}
            </RepoName>
            <RepoDescription
              title={repo.description || "No description available"}
            >
              {repo.description || "No description available"}
            </RepoDescription>
          </RepoInfo>
          <RepoStats>
            <StatItem>
              <StarOutlined />
              {repo.stargazers_count.toLocaleString()}
            </StatItem>
            {isUserRepo && (
              <Tag color="green" style={{ fontSize: 10 }}>
                Owned
              </Tag>
            )}
          </RepoStats>
        </OptionContent>
      ),
    };
  };

  // Build options array
  const options: NonNullable<SelectProps<string>["options"]> = [];

  // Add user repos section if we have them and no search query
  if (userRepos.length > 0 && !searchQuery.trim()) {
    options.push({
      label: (
        <SectionHeader>Your Repositories ({userRepos.length})</SectionHeader>
      ),
      options: userRepos
        .slice(0, 10)
        .map((repo) => formatRepoOption(repo, true)),
    });
  }

  // Add search results section if we have a search query
  if (searchQuery.trim() && searchResults.length > 0) {
    options.push({
      label: <SectionHeader>Public Repositories</SectionHeader>,
      options: searchResults.map((repo) => formatRepoOption(repo, false)),
    });
  }

  const isLoading = userReposLoading || searchLoading;

  // Load user repos on component mount
  useEffect(() => {
    loadUserRepos();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced search effect
  useEffect(() => {
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      if (searchQuery.trim() && searchQuery.length >= 2) {
        searchPublicRepos(searchQuery);
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <StyledSelect
      aria-label="Repository search"
      value={value}
      onChange={handleChange}
      onSearch={handleSearch}
      onClear={handleClear}
      placeholder={placeholder}
      size={size}
      style={{ width: "100%" }}
      showSearch
      allowClear
      filterOption={false} // We handle filtering ourselves
      options={options}
      dropdownStyle={{ minWidth: 400, maxHeight: 400 }}
      suffixIcon={<GithubOutlined style={{ color: "#bfbfbf" }} />}
      loading={isLoading}
      notFoundContent={
        isLoading ? (
          <div style={{ textAlign: "center", padding: "20px" }}>
            <Spin size="small" />
            <div style={{ marginTop: 8, color: "#666", fontSize: 12 }}>
              {searchQuery.trim()
                ? "Searching repositories..."
                : "Loading your repositories..."}
            </div>
          </div>
        ) : searchQuery.trim() && searchResults.length === 0 ? (
          <Empty
            image={
              <SearchOutlined style={{ fontSize: 24, color: "#d9d9d9" }} />
            }
            styles={{ image: { height: 40 } }}
            description={
              <span style={{ fontSize: 12, color: "#999" }}>
                No repositories found for "{searchQuery}"
              </span>
            }
          />
        ) : !searchQuery.trim() &&
          userRepos.length === 0 &&
          !userReposLoading ? (
          <Empty
            image={
              <GithubOutlined style={{ fontSize: 24, color: "#d9d9d9" }} />
            }
            styles={{ image: { height: 40 } }}
            description={
              <span style={{ fontSize: 12, color: "#999" }}>
                No accessible repositories found
              </span>
            }
          />
        ) : null
      }
    />
  );
};
