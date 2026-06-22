import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Unmount any components rendered by RTL between tests so the DOM is isolated.
afterEach(() => {
  cleanup();
});

// jsdom does not implement matchMedia (used by use-mobile hook and theme logic).
if (!window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

// jsdom has no IntersectionObserver (used by lazy-mounting Radix primitives).
if (typeof window.IntersectionObserver === 'undefined') {
  class IntersectionObserverStub {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
    takeRecords = vi.fn(() => []);
    root = null;
    rootMargin = '';
    thresholds = [];
  }
  window.IntersectionObserver =
    IntersectionObserverStub as unknown as typeof window.IntersectionObserver;
}

// jsdom has no ResizeObserver (used by recharts ResponsiveContainer and kibo-ui).
if (typeof window.ResizeObserver === 'undefined') {
  class ResizeObserverStub {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  }
  window.ResizeObserver = ResizeObserverStub as unknown as typeof window.ResizeObserver;
}

// Pointer / scroll APIs missing in jsdom but required by @testing-library/user-event
// and focusable Radix triggers.
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = vi.fn();
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = vi.fn();
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = vi.fn();
}
