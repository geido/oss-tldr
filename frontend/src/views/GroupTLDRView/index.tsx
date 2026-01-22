import React, { useState } from "react";
import styled from "styled-components";
import {
  Alert,
  Avatar,
  Button,
  Card,
  Collapse,
  Divider,
  Empty,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
} from "antd";
import {
  ArrowLeftOutlined,
  ClockCircleOutlined,
  GithubOutlined,
  PlayCircleOutlined,
  SyncOutlined,
} from "@ant-design/icons";

import {
  DigestTarget,
  GroupRepoReport,
  Timeframe,
} from "../../types/github";
import { useGroupTLDRData } from "../../hooks/useGroupTLDRData";
import { formatDateRange } from "../../utils/dateUtils";
import { IssueListItem, ItemHeader, LoadableCollapse } from "../../components";

const { Title, Paragraph, Text, Link } = Typography;
const { Panel } = Collapse;
const { Option } = Select;

const Container = styled.div`
  padding: 1.5rem 1rem;
  max-width: 1080px;
  margin: 0 auto;

  @media (min-width: 768px) {
    padding: 2rem 3rem;
  }
`;

const HeaderBar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.token.marginSM}px;
  margin-bottom: ${({ theme }) => theme.token.marginXL}px;
`;

const StyledCard = styled(Card)`
  margin-bottom: ${({ theme }) => theme.token.marginXL}px;

  .ant-card-body {
    padding: 1.25rem;

    @media (min-width: 768px) {
      padding: 1.75rem;
    }
  }
`;

const RepoHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: ${({ theme }) => theme.token.marginSM}px;
  flex-wrap: wrap;
`;

const RepoMeta = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.token.marginXS}px;
`;

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

type GroupTLDRViewProps = {
  group: Extract<DigestTarget, { kind: "group" }>;
  onReset: () => void;
  initialTimeframe?: Timeframe;
};

const renderItems = (
  repoUrl: string,
  items: GroupRepoReport["prs"],
  emptyLabel: string,
) => {
  if (items.length === 0) {
    return (
      <Text type="secondary" style={{ fontStyle: "italic" }}>
        {emptyLabel}
      </Text>
    );
  }

  return (
    <LoadableCollapse
      panels={items.map((item) => (
        <Panel key={item.id} header={<ItemHeader {...item} />}>
          <IssueListItem repo={repoUrl} item={item} />
        </Panel>
      ))}
    />
  );
};

const GroupTLDRView: React.FC<GroupTLDRViewProps> = ({
  group,
  onReset,
  initialTimeframe = "last_week",
}) => {
  const [currentTimeframe, setCurrentTimeframe] = useState<Timeframe>(
    initialTimeframe,
  );

  const { data, loading, error, lastReport, hasData, generateReport } =
    useGroupTLDRData(group, currentTimeframe);

  const handleGenerate = () => {
    void generateReport();
  };

  return (
    <Container>
      <HeaderBar>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={onReset} size="small">
            Back to Dashboard
          </Button>
          <Title level={4} style={{ margin: 0 }}>
            {group.name}
          </Title>
        </Space>
        <Tag color="blue">{group.repos.length} repositories</Tag>
      </HeaderBar>

      <StyledCard
        style={{
          background: "linear-gradient(135deg, #f0f5ff 0%, #f6ffed 100%)",
        }}
      >
        <Space
          direction="vertical"
          style={{ width: "100%", gap: "1.25rem" }}
        >
          <Space style={{ justifyContent: "space-between", width: "100%" }}>
            <Space>
              <Text strong>Timeframe:</Text>
              <Select
                value={currentTimeframe}
                size="small"
                style={{ minWidth: 130 }}
                onChange={setCurrentTimeframe}
              >
                {timeframes.map((item) => (
                  <Option key={item.value} value={item.value}>
                    {item.label}
                  </Option>
                ))}
              </Select>
            </Space>

            <Space>
              {lastReport && (
                <Space size="small">
                  <ClockCircleOutlined />
                  <Text type="secondary" style={{ fontSize: "0.85rem" }}>
                    {formatTimeAgo(lastReport.generatedAt)}
                  </Text>
                  <Tag color="purple" style={{ fontSize: "0.75rem" }}>
                    {formatDateRange(lastReport.timeframe)}
                  </Tag>
                </Space>
              )}

              <Button
                type="primary"
                size="small"
                loading={loading}
                icon={hasData ? <SyncOutlined /> : <PlayCircleOutlined />}
                onClick={handleGenerate}
              >
                {hasData ? "Regenerate" : "Generate"} TL;DR
              </Button>
            </Space>
          </Space>

          {error && (
            <Alert
              type="error"
              showIcon
              message="Failed to generate group report"
              description={error}
            />
          )}
        </Space>
      </StyledCard>

      {loading && !hasData ? (
        <Spin size="large" style={{ display: "block", margin: "4rem auto" }} />
      ) : null}

      {hasData && data.tldr && (
        <StyledCard>
          <Title level={5}>Group TL;DR</Title>
          <Paragraph style={{ fontSize: "1rem", lineHeight: 1.6 }}>
            {data.tldr}
          </Paragraph>
        </StyledCard>
      )}

      {hasData && (
        <>
          {data.repos.map((repoSummary: GroupRepoReport) => (
            <StyledCard key={repoSummary.full_name}>
              <RepoHeader>
                <RepoMeta>
                  <Space>
                    <Avatar icon={<GithubOutlined />} size="small" />
                    <Link href={repoSummary.html_url} target="_blank">
                      {repoSummary.full_name}
                    </Link>
                  </Space>
                  {repoSummary.tldr && (
                    <Paragraph
                      style={{ marginBottom: 0, fontSize: "0.95rem" }}
                    >
                      {repoSummary.tldr}
                    </Paragraph>
                  )}
                </RepoMeta>
              </RepoHeader>

              <Divider orientation="left">Pull Requests</Divider>
              {renderItems(
                repoSummary.html_url,
                repoSummary.prs,
                "No notable pull requests in this timeframe.",
              )}

              <Divider orientation="left">Issues</Divider>
              {renderItems(
                repoSummary.html_url,
                repoSummary.issues,
                "No notable issues in this timeframe.",
              )}
            </StyledCard>
          ))}
        </>
      )}

      {!loading && !hasData && (
        <StyledCard style={{ textAlign: "center" }}>
          <Empty
            description="No recent activity for this group. Try a broader timeframe or regenerate the report."
          />
        </StyledCard>
      )}
    </Container>
  );
};

export default GroupTLDRView;
