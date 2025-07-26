/* eslint-disable react-refresh/only-export-components */
import React, {
  createContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { UserStorage } from "../utils/userStorage";

interface User {
  id: number;
  login: string;
  name?: string;
  avatar_url?: string;
  email?: string;
}

export interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => Promise<void>;
  logout: () => void;
  setAuthData: (token: string, user: User) => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined,
);

const TOKEN_KEY = "oss_tldr_auth_token";
const USER_KEY = "oss_tldr_user";

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!token && !!user;

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }, []);

  const validateToken = useCallback(
    async (authToken: string) => {
      try {
        const response = await fetch("/api/v1/auth/validate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
        });

        if (!response.ok) {
          console.warn("Token validation request failed:", response.status);
          // Don't logout on network errors - token might still be valid
          return;
        }

        const data = await response.json();

        if (!data.valid) {
          console.log("Token is invalid, logging out");
          logout();
        } else if (data.user) {
          // Update user data if it's provided
          setUser(data.user);
          console.log("Token is valid, user authenticated");
        }
      } catch (error) {
        console.error("Token validation error:", error);
        // Don't logout on network errors - could be temporary
        console.warn("Token validation failed, but keeping current session");
      }
    },
    [logout],
  );

  const login = async () => {
    try {
      const response = await fetch("/api/v1/auth/github/login");

      if (!response.ok) {
        throw new Error("Failed to get auth URL");
      }

      const data = await response.json();

      // Store state for CSRF protection
      localStorage.setItem("oauth_state", data.state);

      // Redirect to GitHub OAuth
      window.location.href = data.auth_url;
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  };

  const setAuthData = (authToken: string, userData: User) => {
    // Handle user switching (clear data if different user)
    const { userChanged } = UserStorage.handleUserChange(userData);

    if (userChanged) {
      console.log("User changed, data cleared for previous user");
    }

    setToken(authToken);
    setUser(userData);
    localStorage.setItem(TOKEN_KEY, authToken);
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
  };

  const value: AuthContextType = {
    user,
    token,
    isAuthenticated,
    isLoading,
    login,
    logout,
    setAuthData,
  };

  useEffect(() => {
    const initializeAuth = async () => {
      // Check for existing auth data on mount
      const storedToken = localStorage.getItem(TOKEN_KEY);
      const storedUser = localStorage.getItem(USER_KEY);

      if (storedToken && storedUser) {
        try {
          const userData = JSON.parse(storedUser);

          // Handle user change detection on initialization
          const { userChanged } = UserStorage.handleUserChange(userData);

          if (userChanged) {
            console.log(
              "User changed during initialization, data cleared for previous user",
            );
          }

          setToken(storedToken);
          setUser(userData);

          // Validate token is still valid
          await validateToken(storedToken);
        } catch (error) {
          console.error("Failed to parse stored user data:", error);
          logout();
        }
      }

      setIsLoading(false);
    };

    initializeAuth();
  }, [logout, validateToken]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
