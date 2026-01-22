/* eslint-disable react-refresh/only-export-components */
import React, {
  createContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  ReactNode,
} from "react";
import { UserStorage } from "../utils/userStorage";
import { apiClient } from "../utils/apiClient";

export interface User {
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
  const hasInitialized = useRef(false);

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
        const data = await apiClient.post<{ valid: boolean; user?: User }>(
          "/auth/validate",
          {},
          {
            skipAuth: false,
            headers: { Authorization: `Bearer ${authToken}` },
          },
        );

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

  const login = useCallback(async () => {
    try {
      const data = await apiClient.get<{ state: string; auth_url: string }>(
        "/auth/github/login",
        { skipAuth: true },
      );

      // Store state for CSRF protection
      localStorage.setItem("oauth_state", data.state);

      // Redirect to GitHub OAuth
      window.location.href = data.auth_url;
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  }, []);

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

  const value: AuthContextType = useMemo(
    () => ({
      user,
      token,
      isAuthenticated,
      isLoading,
      login,
      logout,
      setAuthData,
    }),
    [user, token, isAuthenticated, isLoading, login, logout]
  );

  useEffect(() => {
    const initializeAuth = async () => {
      if (hasInitialized.current) {
        console.log("Auth already initialized, skipping");
        return;
      }
      hasInitialized.current = true;

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
