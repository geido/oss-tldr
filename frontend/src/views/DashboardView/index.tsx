import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Card,
  Col,
  Row,
  Typography,
  Button,
  Modal,
  Form,
  Input,
  Space,
  message,
  Spin,
  Tag,
  Tooltip,
  Avatar,
  theme,
  Popconfirm,
  Select,
} from "antd";
import {
  PlusOutlined,
  GithubOutlined,
  DeleteOutlined,
  StarOutlined,
  CodeOutlined,
  AppstoreOutlined,
} from "@ant-design/icons";
import styled from "styled-components";
import {
  DigestTarget,
  GroupDefinition,
  RepoSummary,
  Timeframe,
} from "../../types/github";
import { apiClient } from "../../utils/apiClient";
import { useAuth } from "../../hooks/useAuth";
import { RepoAutocomplete } from "../../components";
import { UserStorage } from "../../utils/userStorage";
import { GroupListResponse } from "../../types/api";
import { normalizeRepoIdentifier } from "../../utils/repoUtils";
import { slugify } from "../../utils/slugify";

const { Title, Text } = Typography;
const { Option } = Select;

type SavedRepo = {
  id: string;
  owner: string;
  repo: string;
  full_name: string;
  description: string | null;
  stars: number;
  language: string | null;
  name?: string;
  stargazers_count?: number;
};

type DashboardProps = {
  onStartDigest: (target: DigestTarget, timeframe: Timeframe) => void;
};

type SavedGroup = {
  id: string;
  name: string;
  repos: string[];
  description?: string | null;
};

const StyledCard = styled(Card)`
  height: 280px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.645, 0.045, 0.355, 1);
  border-radius: ${({ theme }) => theme.token.borderRadiusLG}px;
  overflow: hidden;
  box-shadow: ${({ theme }) => theme.token.boxShadow};

  &:hover {
    transform: translateY(-8px);
    box-shadow: ${({ theme }) => theme.token.boxShadowTertiary};
    border-color: ${({ theme }) => theme.token.colorPrimary};
  }

  .ant-card-body {
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: ${({ theme }) => theme.token.padding}px;
  }

  .ant-card-actions {
    border-top: 1px solid ${({ theme }) => theme.token.colorBorder};
    background: ${({ theme }) => theme.token.colorFillAlter};
  }
`;

const AddRepoCard = styled(Card)`
  height: 280px;
  cursor: pointer;
  border: 2px dashed ${({ theme }) => theme.token.colorBorder};
  border-radius: ${({ theme }) => theme.token.borderRadiusLG}px;
  transition: all 0.3s cubic-bezier(0.645, 0.045, 0.355, 1);
  background: ${({ theme }) => theme.token.colorBgContainer};

  &:hover {
    border-color: ${({ theme }) => theme.token.colorPrimary};
    background: ${({ theme }) => theme.token.colorPrimaryBg};
    transform: translateY(-4px);
    box-shadow: ${({ theme }) => theme.token.boxShadowSecondary};
  }

  .ant-card-body {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    padding: 40px 20px;
  }
`;

const RepoHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: ${({ theme }) => theme.token.marginSM}px;
  gap: ${({ theme }) => theme.token.paddingXS}px;
`;

const RepoTitle = styled.div`
  flex: 1;
  min-width: 0;
  overflow: hidden;
`;

const RepoActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.token.paddingXS}px;
  flex-shrink: 0;
`;

const RepoName = styled(Text)`
  font-weight: 600;
  font-size: ${({ theme }) => theme.token.fontSize}px;
  color: ${({ theme }) => theme.token.colorText};
  display: block;
  margin-bottom: ${({ theme }) => theme.token.marginXXS}px;
`;

const RepoDescription = styled(Text)`
  color: ${({ theme }) => theme.token.colorTextSecondary};
  font-size: ${({ theme }) => theme.token.fontSizeSM}px;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 36px;
`;

const StatsRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.token.padding}px;
  margin-top: ${({ theme }) => theme.token.margin}px;
`;

const StatItem = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.token.marginXXS}px;
  color: ${({ theme }) => theme.token.colorTextSecondary};
  font-size: ${({ theme }) => theme.token.fontSizeSM}px;

  .anticon {
    font-size: ${({ theme }) => theme.token.fontSizeSM}px;
  }
`;

const BASE_GROUP_STORAGE_KEY = "oss-tldr-groups";

const GroupCard = styled(Card)`
  height: 220px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  border-radius: ${({ theme }) => theme.token.borderRadiusLG}px;
  box-shadow: ${({ theme }) => theme.token.boxShadowSecondary};

  .ant-card-body {
    padding: ${({ theme }) => theme.token.paddingLG}px;
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.token.margin}px;
  }
`;

const GroupHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: ${({ theme }) => theme.token.marginSM}px;
`;

const GroupName = styled(Text)`
  font-size: ${({ theme }) => theme.token.fontSizeLG}px;
  font-weight: 600;
`;

const DashboardView: React.FC<DashboardProps> = ({ onStartDigest }) => {
  const { user, logout } = useAuth();
  const [repos, setRepos] = useState<SavedRepo[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [validating, setValidating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [availableGroups, setAvailableGroups] = useState<GroupDefinition[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [customGroups, setCustomGroups] = useState<SavedGroup[]>([]);
  const [groupModalVisible, setGroupModalVisible] = useState(false);
  const [groupValidating, setGroupValidating] = useState(false);
  const [form] = Form.useForm();
  const [groupForm] = Form.useForm();
  const { token } = theme.useToken();
  const loadReposRequestedRef = useRef(false);

  const repoOptions = useMemo(
    () =>
      repos.map((repo) => ({
        value: repo.full_name,
        label: repo.full_name,
      })),
    [repos],
  );

  const loadReposFromDatabase = useCallback(async () => {
    if (loadReposRequestedRef.current) {
      console.log("Repos already loading, skipping duplicate request");
      return;
    }

    loadReposRequestedRef.current = true;
    try {
      setLoading(true);
      const response = await apiClient.getUserRepositories();
      const repositories =
        (response as { repositories?: SavedRepo[] }).repositories || [];

      const mappedRepos: SavedRepo[] = repositories.map((repo) => {
        const [owner, repoNameFromFullName] = repo.full_name.split("/");
        const repoName = repo.name || repo.repo || repoNameFromFullName;
        const starCount = repo.stargazers_count ?? repo.stars ?? 0;

        return {
          id: repo.full_name,
          owner,
          repo: repoName,
          full_name: repo.full_name,
          description: repo.description,
          stars: starCount,
          language: repo.language,
          name: repo.name,
          stargazers_count: repo.stargazers_count,
        };
      });

      setRepos(mappedRepos);
    } catch (error) {
      console.error("Failed to load repos from database:", error);
      // Don't show error message for auth errors - AuthGuard will handle it
      if (error instanceof Error && error.message !== "Authentication required") {
        message.error("Failed to load tracked repositories");
      }
      setRepos([]);
    } finally {
      setLoading(false);
      loadReposRequestedRef.current = false;
    }
  }, []);

  const loadGroupsFromStorage = useCallback(() => {
    try {
      const storageKey = UserStorage.getUserKey(BASE_GROUP_STORAGE_KEY, user);
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setCustomGroups(JSON.parse(saved));
      } else {
        setCustomGroups([]);
      }
    } catch (error) {
      console.error("Failed to load groups from storage:", error);
      setCustomGroups([]);
    }
  }, [user]);

  const saveGroupsToStorage = (groups: SavedGroup[]) => {
    try {
      const storageKey = UserStorage.getUserKey(BASE_GROUP_STORAGE_KEY, user);
      localStorage.setItem(storageKey, JSON.stringify(groups));
      setCustomGroups(groups);
    } catch (error) {
      console.error("Failed to save groups to storage:", error);
      message.error("Failed to save group");
    }
  };

  const [selectedRepoData, setSelectedRepoData] = useState<RepoSummary | null>(
    null,
  );

  const handleRepoSelect = (repoUrl: string, repoData?: RepoSummary) => {
    setSelectedRepoData(repoData || null);
    form.setFieldsValue({ repo_url: repoUrl });
  };

  const handleAddRepo = async (values: { repo_url: string }) => {
    setValidating(true);

    try {
      // Check if repo already exists
      const url = new URL(values.repo_url);
      const [, owner, repoName] = url.pathname.split("/");
      const fullName = `${owner}/${repoName}`;

      if (repos.some((repo) => repo.id === fullName)) {
        message.warning("Repository already exists in your dashboard");
        return;
      }

      // Track repository via API
      const response = await apiClient.trackRepository(values.repo_url);
      const trackedRepo = (response as { repository: SavedRepo }).repository;

      // Reload repositories from database
      await loadReposFromDatabase();

      setIsModalVisible(false);
      form.resetFields();
      setSelectedRepoData(null);
      message.success(`Successfully added ${trackedRepo.full_name}`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to add repository";

      // Show enhanced error messages with helpful hints
      if (errorMessage.includes("third-party access")) {
        message.error({
          content: (
            <div>
              <div>{errorMessage}</div>
              <div style={{ fontSize: "12px", marginTop: "4px", opacity: 0.8 }}>
                💡 Ask your organization admin to enable third-party OAuth apps
                in GitHub Settings
              </div>
            </div>
          ),
          duration: 8, // Show longer for complex messages
        });
      } else if (errorMessage.includes("rate limit")) {
        message.error({
          content: (
            <div>
              <div>{errorMessage}</div>
              <div style={{ fontSize: "12px", marginTop: "4px", opacity: 0.8 }}>
                💡 Please wait a few minutes and try again
              </div>
            </div>
          ),
          duration: 6,
        });
      } else {
        message.error(errorMessage);
      }
    } finally {
      setValidating(false);
    }
  };

  const handleAddGroup = async (values: {
    name: string;
    repos: string[];
    description?: string;
  }) => {
    setGroupValidating(true);

    try {
      const normalizedRepos = Array.from(
        new Set(
          values.repos.map((repo) => normalizeRepoIdentifier(repo)).filter(Boolean),
        ),
      );

      if (normalizedRepos.length === 0) {
        throw new Error("Add at least one repository to the group");
      }

      const trimmedName = values.name.trim();
      if (!trimmedName) {
        throw new Error("Group name is required");
      }

      const baseId = slugify(trimmedName);
      let candidateId = baseId;
      let suffix = 1;
      while (customGroups.some((group) => group.id === candidateId)) {
        candidateId = `${baseId}-${suffix}`;
        suffix += 1;
      }

      const newGroup: SavedGroup = {
        id: candidateId,
        name: trimmedName,
        repos: normalizedRepos,
        description: values.description?.trim() || undefined,
      };

      saveGroupsToStorage([...customGroups, newGroup]);
      setGroupModalVisible(false);
      groupForm.resetFields();
      message.success(`Created group "${newGroup.name}"`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to create group";
      message.error(errorMessage);
    } finally {
      setGroupValidating(false);
    }
  };

  const handleRemoveRepo = async (repoId: string, repoName: string) => {
    try {
      const repoUrl = `https://github.com/${repoId}`;
      await apiClient.untrackRepository(repoUrl);

      // Reload repositories from database
      await loadReposFromDatabase();

      message.success(`${repoName} removed from dashboard`);
    } catch (error) {
      console.error("Failed to remove repository:", error);
      message.error("Failed to remove repository");
    }
  };

  const handleRepoClick = (repo: SavedRepo) => {
    const repoUrl = `https://github.com/${repo.full_name}`;
    onStartDigest(
      { kind: "repo", repo: repoUrl, label: repo.full_name },
      "last_week",
    );
  };

  const handleGroupStart = (
    group: SavedGroup | GroupDefinition,
    preset: boolean = false,
  ) => {
    onStartDigest(
      {
        kind: "group",
        id: group.id,
        name: group.name,
        repos: group.repos,
        preset,
      },
      "last_week",
    );
  };

  const handleRemoveGroup = (groupId: string) => {
    const updated = customGroups.filter((group) => group.id !== groupId);
    saveGroupsToStorage(updated);
    message.success("Group removed");
  };

  useEffect(() => {
    // Only load repos if user is authenticated
    if (user) {
      loadReposFromDatabase();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]); // Only reload when user ID changes, not the whole user object

  useEffect(() => {
    loadGroupsFromStorage();
  }, [loadGroupsFromStorage]);

  useEffect(() => {
    const fetchGroups = async () => {
      try {
        setGroupsLoading(true);
        const response = await apiClient.get<GroupListResponse>("groups");
        setAvailableGroups(response.groups);
      } catch (error) {
        console.error("Failed to load predefined groups:", error);
      } finally {
        setGroupsLoading(false);
      }
    };

    fetchGroups();
  }, []);

  return (
    <div
      style={{
        padding: "3rem 2rem",
        maxWidth: 1400,
        margin: "0 auto",
        minHeight: "100vh",
        background: `linear-gradient(135deg, ${token.colorBgContainer} 0%, #f8faff 100%)`,
      }}
    >
      {/* Header with user info */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginBottom: "2rem",
          paddingRight: "1rem",
        }}
      >
        {user && (
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <img
              src={user.avatar_url}
              alt={user.login}
              style={{ width: 32, height: 32, borderRadius: "50%" }}
            />
            <Text>{user.name || user.login}</Text>
            <Button
              type="text"
              size="small"
              onClick={logout}
              style={{ color: token.colorTextSecondary }}
            >
              Logout
            </Button>
          </div>
        )}
      </div>

      <div style={{ marginBottom: "3rem", textAlign: "center" }}>
        <div style={{ marginBottom: "1rem" }}>
          <img
            src="/oss_tldr.png"
            alt="OSS TL;DR Logo"
            style={{ width: 64, height: 64, marginBottom: 16 }}
          />
        </div>
        <Title
          level={1}
          style={{ margin: 0, marginBottom: 8, color: token.colorText }}
        >
          OSS TL;DR Dashboard
        </Title>
        <Text type="secondary" style={{ fontSize: 16 }}>
          Track multiple repositories and get AI-powered summaries
        </Text>
        {repos.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <Text type="secondary">
              {repos.length}{" "}
              {repos.length === 1 ? "repository" : "repositories"} tracked
            </Text>
          </div>
        )}
      </div>

      {loading ? (
        <Row gutter={[24, 24]}>
          {[...Array(4)].map((_, index) => (
            <Col xs={24} sm={12} md={8} lg={6} key={index}>
              <Card style={{ height: 280 }}>
                <Spin
                  size="large"
                  style={{
                    display: "block",
                    textAlign: "center",
                    paddingTop: 100,
                  }}
                />
              </Card>
            </Col>
          ))}
        </Row>
      ) : repos.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "4rem 2rem",
            background: token.colorBgContainer,
            borderRadius: 16,
            border: `2px dashed ${token.colorBorder}`,
          }}
        >
          <GithubOutlined
            style={{
              fontSize: 64,
              color: token.colorTextSecondary,
              marginBottom: 24,
            }}
          />
          <Title
            level={3}
            style={{ color: token.colorTextSecondary, marginBottom: 16 }}
          >
            No repositories yet
          </Title>
          <Text
            type="secondary"
            style={{ fontSize: 16, marginBottom: 32, display: "block" }}
          >
            Add your first repository to start tracking OSS activity
          </Text>
          <Button
            type="primary"
            size="large"
            icon={<PlusOutlined />}
            onClick={() => setIsModalVisible(true)}
            style={{ minWidth: 160 }}
          >
            Add Repository
          </Button>
        </div>
      ) : (
        <Row gutter={[24, 24]}>
          {repos.map((repo) => (
            <Col xs={24} sm={12} md={8} lg={6} key={repo.id}>
              <StyledCard hoverable onClick={() => handleRepoClick(repo)}>
                <div>
                  <RepoHeader>
                    <RepoTitle>
                      <RepoName>
                        <GithubOutlined
                          style={{ marginRight: 8, color: token.colorPrimary }}
                        />
                        {repo.full_name}
                      </RepoName>
                      {repo.language && (
                        <Tag
                          color="blue"
                          style={{ fontSize: 11, marginTop: 4 }}
                        >
                          <CodeOutlined style={{ marginRight: 4 }} />
                          {repo.language}
                        </Tag>
                      )}
                    </RepoTitle>
                    <RepoActions>
                      <Popconfirm
                        title="Remove Repository"
                        description={`Are you sure you want to remove "${repo.full_name}" from your dashboard?`}
                        onConfirm={(e) => {
                          e?.stopPropagation();
                          handleRemoveRepo(repo.id, repo.full_name);
                        }}
                        onCancel={(e) => e?.stopPropagation()}
                        okText="Remove"
                        cancelText="Cancel"
                        okType="danger"
                        placement="topLeft"
                      >
                        <Button
                          type="text"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={(e) => e.stopPropagation()}
                          size="small"
                          style={{
                            opacity: 0.6,
                            transition: "opacity 0.2s",
                          }}
                          onMouseEnter={(e) =>
                            ((e.target as HTMLElement).style.opacity = "1")
                          }
                          onMouseLeave={(e) =>
                            ((e.target as HTMLElement).style.opacity = "0.6")
                          }
                        />
                      </Popconfirm>
                    </RepoActions>
                  </RepoHeader>

                  <RepoDescription>
                    {repo.description || "No description available"}
                  </RepoDescription>

                  <StatsRow>
                    <StatItem>
                      <StarOutlined />
                      <span>{repo.stars.toLocaleString()}</span>
                    </StatItem>
                  </StatsRow>
                </div>
              </StyledCard>
            </Col>
          ))}

          <Col xs={24} sm={12} md={8} lg={6}>
            <AddRepoCard onClick={() => setIsModalVisible(true)}>
              <PlusOutlined
                style={{
                  fontSize: 48,
                  color: token.colorPrimary,
                  marginBottom: 16,
                  opacity: 0.8,
                }}
              />
              <Title
                level={5}
                style={{ color: token.colorTextSecondary, margin: 0 }}
              >
                Add Repository
              </Title>
              <Text type="secondary" style={{ fontSize: 13, marginTop: 8 }}>
                Track a new repository
              </Text>
            </AddRepoCard>
          </Col>
        </Row>
      )}

      <div style={{ marginTop: "4rem" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "1rem",
            marginBottom: "1.5rem",
          }}
        >
          <div>
            <Title level={3} style={{ marginBottom: 4 }}>
              Group Reports
            </Title>
            <Text type="secondary">
              Summaries across curated collections of repositories
            </Text>
          </div>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setGroupModalVisible(true)}
          >
            Create Group
          </Button>
        </div>

        {groupsLoading ? (
          <div style={{ textAlign: "center", padding: "3rem 0" }}>
            <Spin size="large" />
          </div>
        ) : customGroups.length === 0 && availableGroups.length === 0 ? (
          <Card style={{ textAlign: "center" }}>
            <AppstoreOutlined
              style={{
                fontSize: 48,
                color: token.colorTextSecondary,
                marginBottom: 16,
              }}
            />
            <Title level={4} style={{ marginBottom: 8 }}>
              No groups yet
            </Title>
            <Text type="secondary">
              Create a group or use one of the curated presets to get started.
            </Text>
          </Card>
        ) : (
          <Row gutter={[24, 24]}>
            {customGroups.map((group) => (
              <Col xs={24} md={12} lg={8} key={group.id}>
                <GroupCard>
                  <div>
                    <GroupHeader>
                      <GroupName>{group.name}</GroupName>
                      <Popconfirm
                        title="Remove Group"
                        description={`Remove “${group.name}” from your dashboard?`}
                        onConfirm={() => handleRemoveGroup(group.id)}
                        okType="danger"
                        okText="Remove"
                      >
                        <Button type="text" danger icon={<DeleteOutlined />} />
                      </Popconfirm>
                    </GroupHeader>
                    {group.description && (
                      <Text type="secondary">{group.description}</Text>
                    )}
                    <Text type="secondary" style={{ display: "block" }}>
                      {group.repos.slice(0, 3).join(", ")}
                      {group.repos.length > 3 && " …"}
                    </Text>
                  </div>
                  <Space style={{ justifyContent: "space-between" }}>
                    <Tag color="blue">{group.repos.length} repos</Tag>
                    <Button type="primary" onClick={() => handleGroupStart(group)}>
                      Open Report
                    </Button>
                  </Space>
                </GroupCard>
              </Col>
            ))}

            {availableGroups.map((group) => (
              <Col xs={24} md={12} lg={8} key={`preset-${group.id}`}>
                <GroupCard>
                  <div>
                    <GroupHeader>
                      <GroupName>{group.name}</GroupName>
                    </GroupHeader>
                    {group.description && (
                      <Text type="secondary">{group.description}</Text>
                    )}
                    <Text type="secondary" style={{ display: "block" }}>
                      {group.repos.slice(0, 3).join(", ")}
                      {group.repos.length > 3 && " …"}
                    </Text>
                  </div>
                  <Space style={{ justifyContent: "space-between" }}>
                    <Tag color="geekblue">{group.repos.length} repos</Tag>
                    <Button onClick={() => handleGroupStart(group, true)}>
                      View Summary
                    </Button>
                  </Space>
                </GroupCard>
              </Col>
            ))}
          </Row>
        )}
      </div>

      <Modal
        title={
          <div style={{ textAlign: "center", paddingBottom: 16 }}>
            <GithubOutlined
              style={{
                fontSize: 24,
                color: token.colorPrimary,
                marginBottom: 8,
              }}
            />
            <Title level={4} style={{ margin: 0 }}>
              Add Repository
            </Title>
            <Text type="secondary">
              Add a GitHub repository to your dashboard
            </Text>
          </div>
        }
        open={isModalVisible}
        onCancel={() => {
          setIsModalVisible(false);
          form.resetFields();
          setSelectedRepoData(null);
        }}
        footer={null}
        width={500}
        centered
        forceRender
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleAddRepo}
          style={{ paddingTop: 16 }}
          preserve={false}
        >
          <Form.Item
            name="repo_url"
            label="Repository"
            rules={[
              { required: true, message: "Please select a repository" },
              {
                pattern: /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+/,
                message: "Please enter a valid GitHub repository URL",
              },
            ]}
          >
            <RepoAutocomplete
              value={form.getFieldValue("repo_url")}
              onChange={handleRepoSelect}
              excludeRepos={repos.map((repo) => repo.full_name)}
              size="large"
              placeholder="Search your repositories or public repos..."
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
            <Space style={{ width: "100%", justifyContent: "flex-end" }}>
              <Button onClick={() => setIsModalVisible(false)} size="large">
                Cancel
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={validating}
                size="large"
                style={{ minWidth: 140 }}
              >
                {validating ? "Validating..." : "Add Repository"}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={
          <div style={{ textAlign: "center", paddingBottom: 12 }}>
            <AppstoreOutlined
              style={{ fontSize: 24, color: token.colorPrimary, marginBottom: 8 }}
            />
            <Title level={4} style={{ margin: 0 }}>
              Create Group
            </Title>
            <Text type="secondary">
              Combine multiple repositories into a themed report
            </Text>
          </div>
        }
        open={groupModalVisible}
        onCancel={() => {
          setGroupModalVisible(false);
          groupForm.resetFields();
        }}
        footer={null}
        width={520}
        centered
      >
        <Form
          form={groupForm}
          layout="vertical"
          onFinish={handleAddGroup}
          style={{ paddingTop: 12 }}
        >
          <Form.Item
            name="name"
            label="Group name"
            rules={[{ required: true, message: "Please provide a group name" }]}
          >
            <Input placeholder="e.g. AI Landscape" size="large" />
          </Form.Item>

          <Form.Item
            name="repos"
            label="Repositories"
            rules={[
              {
                required: true,
                message: "Add at least one repository",
              },
            ]}
          >
            <Select
              mode="tags"
              size="large"
              placeholder="Add repositories (owner/repo or GitHub URL)"
              options={repoOptions}
            />
          </Form.Item>

          <Form.Item name="description" label="Description (optional)">
            <Input.TextArea rows={3} maxLength={160} showCount />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
            <Space style={{ width: "100%", justifyContent: "flex-end" }}>
              <Button onClick={() => setGroupModalVisible(false)} size="large">
                Cancel
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={groupValidating}
                size="large"
                style={{ minWidth: 160 }}
              >
                {groupValidating ? "Saving..." : "Create Group"}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default DashboardView;
