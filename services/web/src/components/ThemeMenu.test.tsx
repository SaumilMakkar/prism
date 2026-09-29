import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_THEME, THEMES, ThemeMenu, readStoredTheme } from "./ThemeMenu";

describe("ThemeMenu", () => {
  beforeEach(() => {
    try {
      localStorage.clear();
    } catch {
      // ignore
    }
    delete document.documentElement.dataset.theme;
  });

  it("applies the default theme on mount", () => {
    render(<ThemeMenu />);
    expect(document.documentElement.dataset.theme).toBe(DEFAULT_THEME);
  });

  it("switches the theme and remembers it", () => {
    render(<ThemeMenu />);
    fireEvent.click(screen.getByTitle("Appearance"));
    fireEvent.click(screen.getByRole("option", { name: /Light/ }));
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(readStoredTheme()).toBe("light");
  });

  it("ignores an unknown stored value", () => {
    localStorage.setItem("prelude_theme", "not-a-theme");
    expect(readStoredTheme()).toBe(DEFAULT_THEME);
  });

  it("offers every theme defined in tokens", () => {
    render(<ThemeMenu />);
    fireEvent.click(screen.getByTitle("Appearance"));
    expect(screen.getAllByRole("option")).toHaveLength(THEMES.length);
  });
});
