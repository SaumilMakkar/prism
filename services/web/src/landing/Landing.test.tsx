import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { Landing, readLandingMode } from "./Landing";
import { PILLARS, TABS } from "./content";

describe("Landing", () => {
  beforeEach(() => {
    try {
      localStorage.clear();
    } catch {
      // ignore
    }
  });

  it("renders the product line and a way into the console", () => {
    render(<Landing />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/before the question ends/i);
    const links = screen.getAllByRole("link", { name: /open the console/i });
    expect(links.length).toBeGreaterThan(0);
    links.forEach((a) => expect(a).toHaveAttribute("href", "/console"));
  });

  it("starts in the light (paper) mode and can flip to dark", () => {
    const { container } = render(<Landing />);
    const root = container.querySelector(".landing")!;
    expect(root).toHaveAttribute("data-mode", "paper");
    fireEvent.click(screen.getByRole("button", { name: /switch to dark/i }));
    expect(root).toHaveAttribute("data-mode", "obsidian");
    expect(readLandingMode()).toBe("obsidian");
  });

  it("shows every pillar", () => {
    render(<Landing />);
    for (const p of PILLARS) expect(screen.getByRole("heading", { name: p.title })).toBeInTheDocument();
  });

  it("switches engineering tabs", () => {
    render(<Landing />);
    const second = TABS[1];
    fireEvent.click(screen.getByRole("tab", { name: new RegExp(second.label) }));
    expect(screen.getByRole("tabpanel")).toHaveTextContent(second.title);
    expect(screen.getByRole("tabpanel")).toHaveTextContent(second.chips[0]);
  });

  it("ignores an unknown stored mode", () => {
    localStorage.setItem("prelude_landing_mode", "neon");
    expect(readLandingMode()).toBe("paper");
  });
});
