import React, { useState } from "react";
import {
  List,
  Tag,
  Button,
  Space,
  Typography,
  Avatar,
  Tooltip,
  Modal,
  Collapse,
  Skeleton,
} from "antd";
import { DiffOutlined, FileSearchOutlined } from "@ant-design/icons";
import { GitHubItem } from "../../types/github";
import styled from "styled-components";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import Link from "antd/es/typography/Link";

const { Paragraph, Text } = Typography;
const { Panel } = Collapse;

type DiffPanelState = {
  loading: boolean;
  explanation?: string;
  code?: string;
};

type Props = {
  repo: string;
  item: GitHubItem;
};

const StyledListItem = styled(List.Item)`
  .ant-list-item-action {
    margin-top: 16px;
    display: flex;
    padding: 0;

    > li {
      list-style: none;
      margin-inline-end: 12px;
    }
  }
`;

export const IssueListItem: React.FC<Props> = ({ repo, item }) => {
  const isPR = item.is_pull_request;
  const assignees = item.assignees ?? [];

  const [diffVisible, setDiffVisible] = useState(false);
  const [fileStates, setFileStates] = useState<Record<string, DiffPanelState>>(
    {},
  );
  const [patchesLoading, setPatchesLoading] = useState(false);

  const [deepDiveVisible, setDeepDiveVisible] = useState(false);
  const [deepDiveLoading, setDeepDiveLoading] = useState(false);
  const [deepDiveContent, setDeepDiveContent] = useState("");

  const handleSummarizeDiff = async () => {
    setDiffVisible(true);
    setPatchesLoading(true); // Start loading
    setFileStates({});

    try {
      const res = await fetch("/api/v1/patches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repo_url: repo,
          pull_request: String(item.number),
        }),
      });

      if (!res.ok) throw new Error("Failed to fetch file patches");
      const data = await res.json();
      const patches: { file: string; patch: string }[] = data.patches;

      const initialState: Record<string, DiffPanelState> = {};
      patches.forEach(({ file, patch }) => {
        initialState[file] = {
          code: patch,
          loading: true,
        };
      });
      setFileStates(initialState);
      setPatchesLoading(false); // Done loading patches

      await Promise.all(
        patches.map(({ file, patch }) =>
          fetch("/api/v1/diff", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ file, patch }),
          })
            .then((res) => res.json())
            .then((data) => {
              setFileStates((prev) => ({
                ...prev,
                [file]: {
                  ...prev[file],
                  loading: false,
                  explanation: data.explanation,
                },
              }));
            })
            .catch((err) => {
              console.error("Failed diff summary for", file, err);
              setFileStates((prev) => ({
                ...prev,
                [file]: {
                  ...prev[file],
                  loading: false,
                  explanation: "⚠️ Failed to load diff summary.",
                },
              }));
            }),
        ),
      );
    } catch (e) {
      console.error("Error initializing diff:", e);
      setPatchesLoading(false);
    }
  };

  const handleDeepDive = async () => {
    setDeepDiveVisible(true);
    setDeepDiveLoading(true);
    setDeepDiveContent(""); // reset content

    try {
      const res = await fetch("/api/v1/deepdive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repo_url: repo,
          issue: String(item.number),
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error("Failed to fetch deep dive");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        fullText += chunk;
        setDeepDiveContent((prev) => prev + chunk); // progressively update
      }
    } catch (e) {
      console.error("Error streaming deep dive:", e);
      setDeepDiveContent("⚠️ Failed to load deep dive summary.");
    } finally {
      setDeepDiveLoading(false);
    }
  };

  return (
    <>
      <StyledListItem
        key={item.id}
        actions={[
          isPR && (
            <Button
              icon={<DiffOutlined />}
              size="small"
              onClick={handleSummarizeDiff}
            >
              Summarize Diff
            </Button>
          ),
          <Button
            icon={<FileSearchOutlined />}
            size="small"
            type="link"
            onClick={handleDeepDive}
          >
            Deep Dive
          </Button>,
        ].filter(Boolean)}
        extra={
          <div style={{ textAlign: "right" }}>
            <Tooltip title="Comments">💬 {item.comments}</Tooltip>{" "}
            <Tooltip title="Reactions">👍 {item.reactions ?? 0}</Tooltip>
          </div>
        }
      >
        <List.Item.Meta
          title={
            <a href={item.html_url} target="_blank" rel="noreferrer">
              #{item.number} {item.title}
            </a>
          }
          description={
            <Space size="middle" wrap>
              {item.labels.map((label) => (
                <Tag key={label}>{label}</Tag>
              ))}
              <Space>
                <Text type="secondary">Opened by</Text>
                <Avatar size="small" src={item.user.avatar_url} />
                <Text>{item.user.login}</Text>
              </Space>
              {assignees.length > 0 && (
                <Avatar.Group maxCount={5} size="small">
                  {assignees.map((assignee) => (
                    <Tooltip title={assignee.login} key={assignee.login}>
                      <Avatar
                        src={`https://github.com/${assignee.login}.png`}
                      />
                    </Tooltip>
                  ))}
                </Avatar.Group>
              )}
            </Space>
          }
        />
        {item.summary && (
          <div
            style={{
              background: "#f9f9f9",
              borderRadius: 8,
              padding: "0.75rem 1rem",
              marginTop: 12,
              fontSize: 14,
              lineHeight: 1.5,
            }}
          >
            <Paragraph style={{ marginBottom: 0 }}>{item.summary}</Paragraph>
          </div>
        )}
      </StyledListItem>

      <Modal
        title={
          <div style={{ marginBottom: 16 }}>
            <span>🧬 Summarized Diff for #{item.number}</span>{" "}
            <Link
              href={`https://github.com/${repo}/pull/${item.number}`}
              target="_blank"
              rel="noreferrer"
            >
              View on GitHub
            </Link>
          </div>
        }
        open={diffVisible}
        onCancel={() => setDiffVisible(false)}
        footer={null}
        width={800}
      >
        {patchesLoading ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : (
          <Collapse accordion>
            {Object.entries(fileStates).map(([filepath, state]) => (
              <Panel
                key={filepath}
                header={
                  <Space>
                    {state.loading && <Skeleton.Button active size="small" />}
                    <Text>{filepath}</Text>
                  </Space>
                }
                collapsible={state.loading ? "disabled" : "header"}
              >
                {state.loading ? (
                  <Skeleton active paragraph={{ rows: 4 }} />
                ) : (
                  <>
                    <Paragraph>{state.explanation}</Paragraph>
                    <SyntaxHighlighter language="diff" wrapLongLines>
                      {state.code}
                    </SyntaxHighlighter>
                  </>
                )}
              </Panel>
            ))}
          </Collapse>
        )}
      </Modal>

      {/* Deep Dive Modal */}
      <Modal
        title={
          <div style={{ marginBottom: 16 }}>
            <span>🧠 Deep Dive for #{item.number}</span>{" "}
            <Link
              href={`https://github.com/${repo}/pull/${item.number}`}
              target="_blank"
              rel="noreferrer"
            >
              View on GitHub
            </Link>
          </div>
        }
        open={deepDiveVisible}
        onCancel={() => setDeepDiveVisible(false)}
        footer={null}
        width={800}
      >
        {deepDiveLoading && deepDiveContent.length === 0 ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : (
          <div>
            {deepDiveLoading && deepDiveContent.length === 0 && (
              <Paragraph type="secondary" style={{ marginBottom: 12 }}>
                <Skeleton.Button
                  active
                  size="small"
                  shape="circle"
                  style={{ marginRight: 8 }}
                />
                Generating summary...
              </Paragraph>
            )}

            <ReactMarkdown
              components={{
                // @ts-ignore
                code({ node, inline, className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || "");
                  return !inline && match ? (
                    <SyntaxHighlighter
                      style={oneDark}
                      language={match[1]}
                      PreTag="div"
                      wrapLongLines
                      {...props}
                    >
                      {String(children).replace(/\n$/, "")}
                    </SyntaxHighlighter>
                  ) : (
                    <code className={className} {...props}>
                      {children}
                    </code>
                  );
                },
              }}
            >
              {deepDiveContent}
            </ReactMarkdown>
          </div>
        )}
      </Modal>
    </>
  );
};
