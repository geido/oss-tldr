import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "antd/dist/reset.css"; // AntD v5 CSS baseline
import { ThemeProvider } from "styled-components";

// @ts-ignore
ReactDOM.createRoot(document.getElementById("root")).render(
  <ThemeProvider theme={{}}>
    <React.StrictMode>
      <App />
    </React.StrictMode>
  </ThemeProvider>,
);
