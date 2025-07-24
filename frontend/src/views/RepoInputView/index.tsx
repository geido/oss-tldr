import React, { useState } from "react";
import { Form, Input, Button, Select, Typography, Space, Card } from "antd";

const { Title, Text } = Typography;
const { Option } = Select;

const timeframes = [
  { label: "Last day", value: "last_day" },
  { label: "Last week", value: "last_week" },
  { label: "Last month", value: "last_month" },
  { label: "Last year", value: "last_year" },
];

type RepoInputFormProps = {
  onStartDigest: (repo: string, timeframe: string) => void;
};

export default function RepoInputForm({ onStartDigest }: RepoInputFormProps) {
  const [repo, setRepo] = useState("");
  const [timeframe, setTimeframe] = useState("last_week");
  const [error, setError] = useState("");

  const handleSubmit = () => {
    const isValid = /^.+\/.+$/.test(repo);
    if (!isValid) {
      setError('Please enter a valid GitHub repo in the format "owner/repo".');
      return;
    }
    setError("");
    onStartDigest(repo.trim(), timeframe);
  };

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Card style={{ maxWidth: 480, width: "100%" }}>
        <Space direction="vertical" style={{ width: "100%" }}>
          <Title
            level={3}
            style={{ textAlign: "center", marginBottom: "1rem" }}
          >
            <img
              src="/oss_tldr.png"
              alt="OSS TL;DR Logo"
              style={{ width: 48, height: 48 }}
            />
            Generate OSS TL;DR
          </Title>

          <Input
            placeholder="e.g. vercel/next.js"
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
            size="large"
          />

          <Select
            size="large"
            value={timeframe}
            onChange={setTimeframe}
            style={{ width: "100%" }}
          >
            {timeframes.map((t) => (
              <Option key={t.value} value={t.value}>
                {t.label}
              </Option>
            ))}
          </Select>

          {error && <Text type="danger">{error}</Text>}

          <Button type="primary" size="large" block onClick={handleSubmit}>
            Generate TL;DR
          </Button>
        </Space>
      </Card>
    </div>
  );
}
