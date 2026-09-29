import "@testing-library/jest-dom/vitest";

// jsdom has none of the observers Framer Motion's whileInView / layout
// animations and MotionConfig's reduced-motion query rely on. Stub them so
// components render; the tests assert on content, never on motion.
class ObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
if (typeof (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver === "undefined") {
  (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = ObserverStub;
}
if (typeof (globalThis as { ResizeObserver?: unknown }).ResizeObserver === "undefined") {
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ObserverStub;
}
if (typeof window !== "undefined" && typeof window.matchMedia === "undefined") {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {
        return false;
      },
    }) as MediaQueryList;
}
