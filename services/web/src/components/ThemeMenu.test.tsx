import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_THEME, ModeToggle, THEMES, ThemeMenu, readStoredTheme } from "./ThemeMenu";

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

  it("defaults to the light Paper appearance", () => {
    expect(DEFAULT_THEME).toBe("paper");
  });

  it("the sun/moon toggle flips between Paper and Obsidian and keeps the front page in step", () => {
    render(<ModeToggle />);
    expect(document.documentElement.dataset.theme).toBe("paper");
    fireEvent.click(screen.getByRole("button", { name: /switch to dark/i }));
    expect(document.documentElement.dataset.theme).toBe("obsidian");
    expect(localStorage.getItem("prelude_landing_mode")).toBe("obsidian");
    fireEvent.click(screen.getByRole("button", { name: /switch to light/i }));
    expect(document.documentElement.dataset.theme).toBe("paper");
  });

  it("offers every theme defined in tokens", () => {
    render(<ThemeMenu />);
    fireEvent.click(screen.getByTitle("Appearance"));
    expect(screen.getAllByRole("option")).toHaveLength(THEMES.length);
  });
});
