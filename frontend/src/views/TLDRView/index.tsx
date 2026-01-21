import React, { useState } from "react";
import {
  Typography,
  Button,
  Space,
  Divider,
  Collapse,
  Tabs,
  Avatar,
  Skeleton,
  Select,
  Alert,
  Card,
  Tag,
  Empty,
} from "antd";
import {
  ReloadOutlined,
  SyncOutlined,
  PlayCircleOutlined,
  ClockCircleOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import { IssueListItem, ItemHeader, LoadableCollapse } from "../../components";
import { Contributor, Timeframe } from "../../types/github";
import { useTLDRData } from "../../hooks/useTLDRData";
import styled from "styled-components";
import { formatDateRange } from "../../utils/dateUtils";

const ResponsiveContainer = styled.div`
  padding: 1rem;
  max-width: 960px;
  margin: 0 auto;

  @media (min-width: 768px) {
    padding: 2rem 4rem;
  }
`;

const MobileTitle = styled(Typography.Title)`
  &&& {
    margin: 0;
    font-size: ${({ theme }) => theme.token.fontSizeLG}px;

    @media (min-width: 768px) {
      font-size: ${({ theme }) => theme.token.fontSizeXL}px;
    }
  }
`;

const ResponsiveCard = styled(Card)`
  margin-bottom: 1.5rem;

  .ant-card-body {
    padding: 1rem;

    @media (min-width: 768px) {
      padding: 1.5rem;
    }
  }
`;

const { Title, Paragraph, Text } = Typography;
const { Panel } = Collapse;
const { Option } = Select;

type TLDRProps = {
  repo: string;
  onReset: () => void;
  initialTimeframe?: Timeframe;
};

type TopContributorsProps = {
  repo: string;
  people: Contributor[] | null;
  loading: boolean;
};

const MobileTopContributors = styled.div`
  margin-top: ${({ theme }) => theme.token.marginXL}px;

  @media (min-width: 768px) {
    margin-top: ${({ theme }) => theme.token.marginXXL}px;
  }

  &&& .ant-tabs-tab {
    padding: ${({ theme }) => theme.token.paddingXS}px
      ${({ theme }) => theme.token.paddingSM}px;
    font-size: ${({ theme }) => theme.token.fontSizeSM}px;

    @media (min-width: 768px) {
      padding: ${({ theme }) => theme.token.paddingSM}px
        ${({ theme }) => theme.token.padding}px;
      font-size: ${({ theme }) => theme.token.fontSize}px;
    }
  }

  .ant-tabs-content-holder {
    padding-top: 0.75rem;

    @media (min-width: 768px) {
      padding-top: 1rem;
    }
  }
`;

const TopContributors: React.FC<TopContributorsProps> = ({
  repo,
  people,
  loading,
}) => {
  return (
    <MobileTopContributors>
      <Divider orientation="left" style={{ fontSize: "0.9rem" }}>
        👨‍💻 Most Active
      </Divider>

      {!loading ? (
        <Tabs
          tabPosition="top"
          type="line"
          items={(people || []).map((contributor) => ({
            key: contributor.username,
            label: (
              <Space>
                <Avatar src={contributor.avatar_url} />
                {contributor.username}
              </Space>
            ),
            children: (
              <div style={{ paddingTop: 12 }}>
                <Title
                  level={5}
                  style={{ fontSize: "1rem", marginBottom: "0.75rem" }}
                >
                  Summary
                </Title>
                <Paragraph
                  style={{ fontSize: 14, fontWeight: 300, lineHeight: 1.5 }}
                >
                  {contributor.tldr}
                </Paragraph>

                {contributor.prs.length > 0 && (
                  <>
                    <Divider orientation="left">Pull Requests</Divider>
                    <LoadableCollapse
                      panels={contributor.prs.map((pr) => (
                        <Panel
                          key={pr.id}
                          header={<ItemHeader {...pr} />}
                          style={{
                            background: "#fff",
                            marginBottom: "8px",
                            borderRadius: "4px",
                            border: "1px solid #f0f0f0",
                          }}
                        >
                          <IssueListItem repo={repo} item={pr} />
                        </Panel>
                      ))}
                    />
                  </>
                )}

                {contributor.issues.length > 0 && (
                  <>
                    <Divider orientation="left" style={{ marginTop: 24 }}>
                      Issues
                    </Divider>
                    <LoadableCollapse
                      panels={contributor.issues.map((issue) => (
                        <Panel
                          key={issue.id}
                          header={<ItemHeader {...issue} />}
                          style={{
                            background: "#fff",
                            marginBottom: "8px",
                            borderRadius: "4px",
                            border: "1px solid #f0f0f0",
                          }}
                        >
                          <IssueListItem repo={repo} item={issue} />
                        </Panel>
                      ))}
                    />
                  </>
                )}
              </div>
            ),
          }))}
        />
      ) : (
        <Skeleton active paragraph={{ rows: 3 }} />
      )}
    </MobileTopContributors>
  );
};

const timeframes: { label: string; value: Timeframe }[] = [
  { label: "Last day", value: "last_day" },
  { label: "Last week", value: "last_week" },
  { label: "Last month", value: "last_month" },
  { label: "Last year", value: "last_year" },
];

const formatTimeAgo = (isoString: string): string => {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

const TLDRView: React.FC<TLDRProps> = ({
  repo,
  onReset,
  initialTimeframe = "last_week",
}) => {
  const [currentTimeframe, setCurrentTimeframe] =
    useState<Timeframe>(initialTimeframe);
  const { data, loading, error, lastReport, hasData, generateReport } =
    useTLDRData(repo, currentTimeframe);

  const handleTimeframeChange = (newTimeframe: Timeframe) => {
    setCurrentTimeframe(newTimeframe);
  };

  const handleGenerateTLDR = () => {
    generateReport(true); // Force fresh data when clicking Regenerate
  };
  return (
    <ResponsiveContainer>
      <Space
        style={{
          width: "100%",
          justifyContent: "space-between",
          marginBottom: "1.5rem",
          flexWrap: "wrap",
          gap: "0.5rem",
        }}
      >
        <MobileTitle level={4}>
          <img
            src="/oss_tldr.png"
            alt="OSS TL;DR Logo"
            style={{
              width: 32,
              height: 32,
              verticalAlign: "middle",
              marginRight: "0.5rem",
            }}
          />
          OSS TL;DR
        </MobileTitle>
        <Button icon={<ReloadOutlined />} onClick={onReset} size="small">
          Back to Dashboard
        </Button>
      </Space>

      {/* Controls and Metadata Bar */}
      <ResponsiveCard
        style={{
          background: "linear-gradient(135deg, #f6ffed 0%, #f0f9ff 100%)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "1rem",
          }}
        >
          <Space wrap>
            <span style={{ fontWeight: 500, fontSize: "0.9rem" }}>
              Timeframe:
            </span>
            <Select
              aria-label="Select timeframe"
              value={currentTimeframe}
              onChange={handleTimeframeChange}
              style={{ width: 120 }}
              size="small"
            >
              {timeframes.map((t) => (
                <Option key={t.value} value={t.value}>
                  {t.label}
                </Option>
              ))}
            </Select>
          </Space>

          <Space wrap>
            {lastReport && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  color: "#666",
                  fontSize: "0.8rem",
                }}
              >
                <ClockCircleOutlined />
                <span style={{ fontSize: "0.8rem" }}>
                  {formatTimeAgo(lastReport.generatedAt)}
                </span>
                <Tag color="blue" style={{ fontSize: "0.7rem" }}>
                  {formatDateRange(lastReport.timeframe)}
                </Tag>
              </div>
            )}

            <Button
              icon={hasData ? <SyncOutlined /> : <PlayCircleOutlined />}
              onClick={handleGenerateTLDR}
              type="primary"
              loading={loading}
              size="small"
            >
              {hasData ? "Regenerate" : "Generate"} TL;DR
            </Button>
          </Space>
        </div>
      </ResponsiveCard>

      {error && (
        <Alert
          message={
            error.includes("third-party access")
              ? "Third-Party Access Restricted"
              : error.includes("rate limit")
                ? "GitHub Rate Limit Exceeded"
                : error.includes("authentication failed")
                  ? "Authentication Required"
                  : "Repository Access Error"
          }
          description={
            <div>
              {error}
              {error.includes("third-party access") && (
                <div
                  style={{ marginTop: "8px", fontSize: "12px", opacity: 0.8 }}
                >
                  💡 <strong>How to fix:</strong> Ask your organization admin to
                  enable third-party OAuth apps in GitHub Settings /
                  Organizations / [Your Org] / Third-party access
                </div>
              )}
              {error.includes("rate limit") && (
                <div
                  style={{ marginTop: "8px", fontSize: "12px", opacity: 0.8 }}
                >
                  💡 <strong>How to fix:</strong> GitHub limits API requests.
                  Please wait a few minutes and try again.
                </div>
              )}
              {error.includes("authentication failed") && (
                <div
                  style={{ marginTop: "8px", fontSize: "12px", opacity: 0.8 }}
                >
                  💡 <strong>How to fix:</strong> Please logout and sign in
                  again with GitHub.
                </div>
              )}
            </div>
          }
          type="error"
          showIcon
          closable
          style={{ marginBottom: "2rem" }}
        />
      )}

      {/* Show loading state when auto-generating */}
      {loading && !hasData ? (
        <ResponsiveCard style={{ textAlign: "center", padding: "2rem 1rem" }}>
          <div style={{ padding: "2rem 0" }}>
            <SyncOutlined
              spin
              style={{ fontSize: 48, color: "#1890ff", marginBottom: 16 }}
            />
            <Title level={4} style={{ color: "#666", fontSize: "1.1rem" }}>
              Generating TL;DR...
            </Title>
            <Text type="secondary" style={{ fontSize: 14 }}>
              Analyzing repository activity and generating summary
            </Text>
            <div style={{ marginTop: "2rem" }}>
              <Skeleton active paragraph={{ rows: 2 }} style={{ maxWidth: 600, margin: "0 auto" }} />
            </div>
          </div>
        </ResponsiveCard>
      ) : !hasData && !loading ? (
        <ResponsiveCard style={{ textAlign: "center", padding: "2rem 1rem" }}>
          <Empty
            image={
              <ThunderboltOutlined style={{ fontSize: 48, color: "#1890ff" }} />
            }
            styles={{ image: { height: 60 } }}
            description={
              <div>
                <Title
                  level={4}
                  style={{ color: "#666", marginBottom: 8, fontSize: "1.1rem" }}
                >
                  No TL;DR Generated Yet
                </Title>
                <Text type="secondary" style={{ fontSize: 14 }}>
                  Click "Generate TL;DR" to create an AI-powered summary of this
                  repository's recent activity.
                </Text>
              </div>
            }
          >
            <Button
              type="primary"
              size="large"
              icon={<PlayCircleOutlined />}
              onClick={handleGenerateTLDR}
              style={{ marginTop: 16 }}
            >
              Generate Your First TL;DR
            </Button>
          </Empty>
        </ResponsiveCard>
      ) : (
        <>
          {/* Check if we have data but no meaningful activity */}
          {hasData &&
          data.prs &&
          data.issues &&
          data.people &&
          data.prs.length === 0 &&
          data.issues.length === 0 &&
          data.people.length === 0 ? (
            <ResponsiveCard
              style={{ textAlign: "center", padding: "3rem 2rem" }}
            >
              <Empty
                image={
                  <ClockCircleOutlined
                    style={{ fontSize: 64, color: "#d9d9d9" }}
                  />
                }
                styles={{ image: { height: 80 } }}
                description={
                  <div>
                    <Title
                      level={4}
                      style={{
                        color: "#666",
                        marginBottom: 8,
                        fontSize: "1.1rem",
                      }}
                    >
                      No Recent Activity Found
                    </Title>
                    <Text
                      type="secondary"
                      style={{ fontSize: 14, lineHeight: 1.5 }}
                    >
                      This repository doesn't have enough recent activity in the
                      selected timeframe to generate a meaningful summary.
                    </Text>
                    <div style={{ marginTop: 16 }}>
                      <Text type="secondary" style={{ fontSize: 13 }}>
                        💡 Try selecting a longer timeframe or check back when
                        there's more activity
                      </Text>
                    </div>
                  </div>
                }
              >
                <Button
                  icon={<SyncOutlined />}
                  onClick={handleGenerateTLDR}
                  style={{ marginTop: 16 }}
                >
                  Try Different Timeframe
                </Button>
              </Empty>
            </ResponsiveCard>
          ) : (
            <>
              <div style={{ marginBottom: "2rem" }}>
                <Title
                  level={4}
                  style={{ fontSize: "1.1rem", marginBottom: "1rem" }}
                >
                  Summary
                </Title>
                {data.tldr ? (
                  <Paragraph
                    style={{ fontSize: 16, fontWeight: 300, lineHeight: 1.6 }}
                  >
                    {data.tldr}
                  </Paragraph>
                ) : (
                  <Skeleton active paragraph={{ rows: 3 }} />
                )}
              </div>

              {(data.prs === null || (data.prs && data.prs.length > 0)) && (
                <>
                  <Divider orientation="left" style={{ fontSize: "0.9rem" }}>
                    🚀 Top Pull Requests
                  </Divider>
                  <LoadableCollapse
                    panels={(data.prs || []).map((pr) => (
                      <Panel
                        key={pr.id}
                        header={<ItemHeader {...pr} />}
                        style={{
                          background: "#fff",
                          marginBottom: "8px",
                          borderRadius: "4px",
                          border: "1px solid #f0f0f0",
                        }}
                      >
                        <IssueListItem repo={repo} item={pr} />
                      </Panel>
                    ))}
                    loading={data.prs === null}
                  />
                </>
              )}

              {(data.issues === null ||
                (data.issues && data.issues.length > 0)) && (
                <>
                  <Divider
                    orientation="left"
                    style={{ marginTop: "3rem", fontSize: "0.9rem" }}
                  >
                    🐛 Top Issues
                  </Divider>
                  <LoadableCollapse
                    panels={(data.issues || []).map((issue) => (
                      <Panel
                        key={issue.id}
                        header={<ItemHeader {...issue} />}
                        style={{
                          background: "#fff",
                          marginBottom: "8px",
                          borderRadius: "4px",
                          border: "1px solid #f0f0f0",
                        }}
                      >
                        <IssueListItem repo={repo} item={issue} />
                      </Panel>
                    ))}
                    loading={data.issues === null}
                  />
                </>
              )}

              {(data.people === null ||
                (data.people && data.people.length > 0)) && (
                <TopContributors
                  repo={repo}
                  people={data.people}
                  loading={data.people === null}
                />
              )}
            </>
          )}
        </>
      )}
    </ResponsiveContainer>
  );
};

export default TLDRView;
