import { describe, expect, it } from "vitest";
import { pickRoute } from "./route";

describe("pickRoute", () => {
  it("serves the front page at the root", () => {
    expect(pickRoute("/")).toBe("landing");
    expect(pickRoute("")).toBe("landing");
  });
  it("serves the dashboard under /console", () => {
    expect(pickRoute("/console")).toBe("console");
    expect(pickRoute("/console/")).toBe("console");
    expect(pickRoute("/console/anything")).toBe("console");
  });
  it("does not match a prefix that merely starts with the word", () => {
    expect(pickRoute("/consoles")).toBe("landing");
  });
});
