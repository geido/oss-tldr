import React, { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, Spin, Alert, Typography } from "antd";
import { useAuth } from "../hooks/useAuth";
import { apiClient } from "../utils/apiClient";
import { User } from "../contexts/AuthContext";

const { Title, Text } = Typography;

const AuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setAuthData } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(true);
  const hasProcessed = useRef(false);

  const handleRetry = () => {
    navigate("/", { replace: true });
  };

  useEffect(() => {
    const processCallback = async () => {
      if (hasProcessed.current) return; // Prevent multiple calls
      hasProcessed.current = true;

      try {
        const code = searchParams.get("code");
        const state = searchParams.get("state");
        const error = searchParams.get("error");

        if (error) {
          throw new Error(`OAuth error: ${error}`);
        }

        if (!code || !state) {
          throw new Error("Missing authorization code or state");
        }

        // Verify state matches what we stored (CSRF protection)
        const storedState = localStorage.getItem("oauth_state");
        if (state !== storedState) {
          throw new Error("Invalid state parameter - possible CSRF attack");
        }

        // Exchange code for token
        const data = await apiClient.post<{ access_token: string; user: User }>(
          "/auth/github/callback",
          { code, state },
          { skipAuth: true },
        );

        // Store authentication data
        setAuthData(data.access_token, data.user);

        // Clean up state
        localStorage.removeItem("oauth_state");

        // Redirect to main app
        navigate("/", { replace: true });
      } catch (err) {
        console.error("OAuth callback error:", err);
        setError(err instanceof Error ? err.message : "Authentication failed");
        setIsProcessing(false);
      }
    };

    processCallback();
  }, [searchParams, navigate, setAuthData]);

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        padding: "2rem",
      }}
    >
      <Card style={{ maxWidth: 400, textAlign: "center" }}>
        {isProcessing ? (
          <>
            <Spin size="large" />
            <Title level={4} style={{ marginTop: "1rem" }}>
              Completing Authentication...
            </Title>
            <Text type="secondary">
              Please wait while we verify your GitHub credentials.
            </Text>
          </>
        ) : (
          <>
            <Alert
              message="Authentication Failed"
              description={error}
              type="error"
              showIcon
              style={{ marginBottom: "1rem" }}
            />
            <Text type="secondary">
              <a onClick={handleRetry} style={{ cursor: "pointer" }}>
                Return to main app
              </a>
            </Text>
          </>
        )}
      </Card>
    </div>
  );
};

export default AuthCallback;
