import React, { useState, useEffect, useCallback } from "react";
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
} from "antd";
import {
  PlusOutlined,
  GithubOutlined,
  DeleteOutlined,
  StarOutlined,
  CodeOutlined,
} from "@ant-design/icons";
import styled from "styled-components";
import { Timeframe, RepoSummary } from "../../types/github";
// import { apiClient } from "../../utils/apiClient"; // Currently unused
import { useAuth } from "../../hooks/useAuth";
import { RepoAutocomplete } from "../../components";
import { UserStorage } from "../../utils/userStorage";

const { Title, Text } = Typography;

type SavedRepo = {
  id: string;
  owner: string;
  repo: string;
  full_name: string;
  description: string | null;
  stars: number;
  language: string | null;
};

type DashboardProps = {
  onStartDigest: (repo: string, timeframe: Timeframe) => void;
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

const BASE_STORAGE_KEY = "oss-tldr-repos";

const DashboardView: React.FC<DashboardProps> = ({ onStartDigest }) => {
  const { user, logout } = useAuth();
  const [repos, setRepos] = useState<SavedRepo[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [validating, setValidating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form] = Form.useForm();
  const { token } = theme.useToken();

  const loadReposFromStorage = useCallback(() => {
    try {
      const storageKey = UserStorage.getUserKey(BASE_STORAGE_KEY, user);
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setRepos(JSON.parse(saved));
      } else {
        setRepos([]);
      }
    } catch (error) {
      console.error("Failed to load repos from storage:", error);
      setRepos([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const saveReposToStorage = (newRepos: SavedRepo[]) => {
    try {
      const storageKey = UserStorage.getUserKey(BASE_STORAGE_KEY, user);
      localStorage.setItem(storageKey, JSON.stringify(newRepos));
      setRepos(newRepos);
    } catch (error) {
      console.error("Failed to save repos to storage:", error);
      message.error("Failed to save repository");
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
      let repoData: RepoSummary;

      if (selectedRepoData) {
        // Use data from autocomplete selection
        repoData = selectedRepoData;
      } else {
        // Fallback: extract from URL (shouldn't happen with autocomplete)
        const url = new URL(values.repo_url);
        const [, owner, repoName] = url.pathname.split("/");

        if (!owner || !repoName) {
          throw new Error("Invalid repository URL format");
        }

        repoData = {
          name: repoName,
          full_name: `${owner}/${repoName}`,
          description: null,
          html_url: values.repo_url,
          private: false,
          fork: false,
          archived: false,
          language: null,
          stargazers_count: 0,
          updated_at: new Date().toISOString(),
        };
      }

      const newRepo: SavedRepo = {
        id: repoData.full_name,
        owner: repoData.full_name.split("/")[0],
        repo: repoData.name,
        full_name: repoData.full_name,
        description: repoData.description,
        stars: repoData.stargazers_count,
        language: repoData.language,
      };

      // Check if repo already exists
      if (repos.some((repo) => repo.id === newRepo.id)) {
        message.warning("Repository already exists in your dashboard");
        return;
      }

      const updatedRepos = [...repos, newRepo];
      saveReposToStorage(updatedRepos);

      setIsModalVisible(false);
      form.resetFields();
      setSelectedRepoData(null);
      message.success(`Successfully added ${newRepo.full_name}`);
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

  const handleRemoveRepo = (repoId: string, repoName: string) => {
    const updatedRepos = repos.filter((repo) => repo.id !== repoId);
    saveReposToStorage(updatedRepos);
    message.success(`${repoName} removed from dashboard`);
  };

  const handleRepoClick = (repo: SavedRepo) => {
    const repoUrl = `https://github.com/${repo.full_name}`;
    onStartDigest(repoUrl, "last_week");
  };

  useEffect(() => {
    loadReposFromStorage();
  }, [loadReposFromStorage]); // Reload when user changes

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
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleAddRepo}
          style={{ paddingTop: 16 }}
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
    </div>
  );
};

export default DashboardView;
