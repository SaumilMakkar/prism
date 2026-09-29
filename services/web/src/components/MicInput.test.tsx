import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MicInput } from "./MicInput";

describe("MicInput — Web Speech fallback path", () => {
  // jsdom has no SpeechRecognition implementation, so this exercises the
  // exact fallback real Firefox/older-Chromium users hit (frontend_prompt.md's
  // "Where the API is unavailable... fall back to a typing field").
  it("renders the typing fallback when SpeechRecognition is unavailable", () => {
    render(<MicInput onFinal={vi.fn()} onDraft={vi.fn()} active={false} setActive={vi.fn()} />);
    expect(
      screen.getByPlaceholderText(/Web Speech unavailable|Press Mic, or type a chunk/i)
    ).toBeInTheDocument();
  });

  it("submits typed text as a chunk on Enter", () => {
    const onFinal = vi.fn();
    render(<MicInput onFinal={onFinal} onDraft={vi.fn()} active={false} setActive={vi.fn()} />);
    const input = screen.getByPlaceholderText(/Web Speech unavailable|Press Mic, or type a chunk/i);
    fireEvent.change(input, { target: { value: "my phone will not power on" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onFinal).toHaveBeenCalledWith("my phone will not power on");
  });

  it("submits typed text via the Send button", () => {
    const onFinal = vi.fn();
    render(<MicInput onFinal={onFinal} onDraft={vi.fn()} active={false} setActive={vi.fn()} />);
    const input = screen.getByPlaceholderText(/Web Speech unavailable|Press Mic, or type a chunk/i);
    fireEvent.change(input, { target: { value: "hello" } });
    fireEvent.click(screen.getByText("Send"));
    expect(onFinal).toHaveBeenCalledWith("hello");
  });

  it("does not submit empty input", () => {
    const onFinal = vi.fn();
    render(<MicInput onFinal={onFinal} onDraft={vi.fn()} active={false} setActive={vi.fn()} />);
    fireEvent.click(screen.getByText("Send"));
    expect(onFinal).not.toHaveBeenCalled();
  });
});
