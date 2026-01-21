import { render, RenderOptions, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReactElement } from "react";

import { TestProviders } from "./TestProviders";

const renderWithProviders = (
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">
) => render(ui, { wrapper: TestProviders, ...options });

export {
  render,
  renderWithProviders,
  screen,
  userEvent,
  waitFor,
};
