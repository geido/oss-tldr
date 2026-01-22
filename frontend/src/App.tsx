import { useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ConfigProvider, theme } from "antd";
import { ThemeProvider } from "styled-components";
import DashboardView from "./views/DashboardView";
import TLDRView from "./views/TLDRView";
import AuthCallback from "./components/AuthCallback";
import AuthGuard from "./components/AuthGuard";
import { AuthProvider } from "./contexts/AuthContext";
import { Timeframe } from "./types/github";

const AppContent: React.FC = () => {
  const [hasStarted, setHasStarted] = useState(false);
  const [repo, setRepo] = useState("");
  const [initialTimeframe, setInitialTimeframe] =
    useState<Timeframe>("last_week");

  const handleStart = (repo: string, timeframe: Timeframe) => {
    setHasStarted(true);
    setRepo(repo);
    setInitialTimeframe(timeframe);
  };

  const handleReset = () => {
    setHasStarted(false);
    setRepo("");
    setInitialTimeframe("last_week");
  };

  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route
            path="/*"
            element={
              <AuthGuard>
                {!hasStarted && <DashboardView onStartDigest={handleStart} />}
                {hasStarted && (
                  <TLDRView
                    repo={repo}
                    onReset={handleReset}
                    initialTimeframe={initialTimeframe}
                  />
                )}
              </AuthGuard>
            }
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
};

const AppWithTheme: React.FC = () => {
  const { token } = theme.useToken();

  return (
    <ThemeProvider theme={{ token }}>
      <AppContent />
    </ThemeProvider>
  );
};

function App() {
  return (
    <ConfigProvider>
      <AppWithTheme />
    </ConfigProvider>
  );
}

export default App;
