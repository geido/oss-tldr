import React, { useState } from "react";
import { Modal, Button, Typography, Space, Alert, Spin } from "antd";
import { GithubOutlined, UserOutlined } from "@ant-design/icons";
import { useAuth } from "../hooks/useAuth";

const { Title, Text } = Typography;

interface AuthModalProps {
  open: boolean;
  onCancel: () => void;
  title?: string;
  description?: string;
}

const AuthModal: React.FC<AuthModalProps> = ({
  open,
  onCancel,
  title = "GitHub Authentication Required",
  description = "To access OSS TL;DR, you need to authenticate with GitHub. This allows us to analyze both your public and private repositories.",
}) => {
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    try {
      setIsLoading(true);
      setError(null);
      await login();
    } catch (err) {
      console.error("Login failed:", err);
      setError(err instanceof Error ? err.message : "Login failed");
      setIsLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      footer={null}
      width={480}
      centered
      maskClosable={false}
      closable={false}
    >
      <div style={{ textAlign: "center", padding: "1rem 0" }}>
        <UserOutlined
          style={{ fontSize: 64, color: "#1890ff", marginBottom: "1rem" }}
        />

        <Title level={3}>{title}</Title>

        <Text
          type="secondary"
          style={{ display: "block", marginBottom: "2rem" }}
        >
          {description}
        </Text>

        {error && (
          <Alert
            message="Authentication Error"
            description={error}
            type="error"
            showIcon
            style={{ marginBottom: "1.5rem" }}
          />
        )}

        <Space direction="vertical" size="large" style={{ width: "100%" }}>
          <Button
            type="primary"
            size="large"
            icon={<GithubOutlined />}
            onClick={handleLogin}
            loading={isLoading}
            style={{
              width: "100%",
              height: "48px",
              fontSize: "16px",
            }}
          >
            {isLoading ? "Redirecting..." : "Continue with GitHub"}
          </Button>

          <div style={{ fontSize: "12px", color: "#8c8c8c", lineHeight: 1.4 }}>
            <Text type="secondary">
              <strong>What OSS TL;DR will access:</strong>
              <br />• Read access to your public and private repositories
              <br />• Basic user profile information
            </Text>
          </div>
        </Space>
      </div>
    </Modal>
  );
};

export default AuthModal;
