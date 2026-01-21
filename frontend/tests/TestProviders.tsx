import React from "react";
import { ConfigProvider, theme as antdTheme } from "antd";
import { ThemeProvider, type DefaultTheme } from "styled-components";

const defaultTheme: DefaultTheme = {
  token: antdTheme.getDesignToken(),
};

type TestProvidersProps = {
  children: React.ReactNode;
};

const TestProviders: React.FC<TestProvidersProps> = ({ children }) => (
  <ConfigProvider theme={{ token: defaultTheme.token }}>
    <ThemeProvider theme={defaultTheme}>{children}</ThemeProvider>
  </ConfigProvider>
);

export { TestProviders };
