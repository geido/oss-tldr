import {
  Typography,
  Button,
  Space,
  Divider,
  Collapse,
  Tabs,
  Avatar,
  Skeleton,
} from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import { IssueListItem, ItemHeader, LoadableCollapse } from "../../components";
import { Contributor, GitHubItem, TLDRData } from "../../types/github";
import styled from "styled-components";

const { Title, Paragraph } = Typography;
const { Panel } = Collapse;

type TLDRProps = {
  repo: string;
  data: TLDRData;
  onReset: () => void;
};

type TopContributorsProps = {
  repo: string;
  people: Contributor[] | null;
  loading: boolean;
};

const StyledPanel = styled(Panel)`
  background: #fff;
  margin-bottom: 8px;
  border-radius: 4px;
  border: 1px solid #f0f0f0;
`;

const TopContributors: React.FC<TopContributorsProps> = ({
  repo,
  people,
  loading,
}) => {
  return (
    <div style={{ marginTop: "4rem" }}>
      <Divider orientation="left">👨‍💻 Most Active</Divider>

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
              <div style={{ paddingTop: 16 }}>
                <Title level={5}>Summary</Title>
                <Paragraph style={{ fontSize: 16, fontWeight: 300 }}>
                  {contributor.tldr}
                </Paragraph>

                {contributor.prs.length > 0 && (
                  <>
                    <Divider orientation="left">Pull Requests</Divider>
                    <LoadableCollapse
                      panels={contributor.prs.map((pr) => (
                        <StyledPanel
                          key={pr.id}
                          header={<ItemHeader {...pr} />}
                        >
                          <IssueListItem repo={repo} item={pr} />
                        </StyledPanel>
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
                        <StyledPanel
                          key={issue.id}
                          header={<ItemHeader {...issue} />}
                        >
                          <IssueListItem repo={repo} item={issue} />
                        </StyledPanel>
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
    </div>
  );
};

const TLDRView: React.FC<TLDRProps> = ({ repo, data, onReset }) => {
  return (
    <div style={{ padding: "2rem 4rem", maxWidth: 960, margin: "0 auto" }}>
      <Space
        style={{
          width: "100%",
          justifyContent: "space-between",
          marginBottom: "2rem",
        }}
      >
        <Title level={3}>
          <img
            src="/oss_tldr.png"
            alt="OSS TL;DR Logo"
            style={{ width: 48, height: 48, verticalAlign: "middle" }}
          />
          OSS TL;DR
        </Title>
        <Button icon={<ReloadOutlined />} onClick={onReset}>
          New TL;DR
        </Button>
      </Space>

      <div style={{ marginBottom: "2rem" }}>
        <Title level={4}>Summary</Title>
        {data.tldr ? (
          <Paragraph style={{ fontSize: 20, fontWeight: 300 }}>
            {data.tldr}
          </Paragraph>
        ) : (
          <Skeleton active paragraph={{ rows: 3 }} />
        )}
      </div>

      <Divider orientation="left">🚀 Top Pull Requests</Divider>
      <LoadableCollapse
        panels={(data.prs || []).map((pr) => (
          <StyledPanel key={pr.id} header={<ItemHeader {...pr} />}>
            <IssueListItem repo={repo} item={pr} />
          </StyledPanel>
        ))}
        loading={data.prs === null}
      />

      <Divider orientation="left" style={{ marginTop: "3rem" }}>
        🐛 Top Issues
      </Divider>
      <LoadableCollapse
        panels={(data.issues || []).map((issue) => (
          <StyledPanel key={issue.id} header={<ItemHeader {...issue} />}>
            <IssueListItem repo={repo} item={issue} />
          </StyledPanel>
        ))}
        loading={data.issues === null}
      />
      <TopContributors
        repo={repo}
        people={data.people}
        loading={data.people === null}
      />
    </div>
  );
};

export default TLDRView;
