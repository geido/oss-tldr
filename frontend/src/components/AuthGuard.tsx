import React, { useState, useEffect } from "react";
import { Spin } from "antd";
import { useAuth } from "../hooks/useAuth";
import AuthModal from "./AuthModal";

interface AuthGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  requireAuth?: boolean;
}

const AuthGuard: React.FC<AuthGuardProps> = ({
  children,
  fallback,
  requireAuth = true,
}) => {
  const { isAuthenticated, isLoading } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    if (!isLoading && requireAuth && !isAuthenticated) {
      setShowAuthModal(true);
    }
  }, [isLoading, isAuthenticated, requireAuth]);

  // Show loading spinner while checking auth state
  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
        }}
      >
        <Spin size="large" />
      </div>
    );
  }

  // If authentication is not required, always show children
  if (!requireAuth) {
    return <>{children}</>;
  }

  // If authenticated, show children
  if (isAuthenticated) {
    return <>{children}</>;
  }

  // Show fallback or auth modal
  return (
    <>
      {fallback || children}
      <AuthModal
        open={showAuthModal}
        onCancel={() => setShowAuthModal(false)}
      />
    </>
  );
};

export default AuthGuard;
