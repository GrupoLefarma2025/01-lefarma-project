import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Desmontar los componentes renderizados por RTL entre tests para mantener el DOM aislado.
afterEach(() => {
  cleanup();
});

// jsdom no implementa matchMedia (usado por el hook use-mobile y la lógica de tema).
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

// jsdom no tiene IntersectionObserver (usado por primitivas Radix de montaje lazy).
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

// jsdom no tiene ResizeObserver (usado por ResponsiveContainer de recharts y kibo-ui).
if (typeof window.ResizeObserver === 'undefined') {
  class ResizeObserverStub {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  }
  window.ResizeObserver = ResizeObserverStub as unknown as typeof window.ResizeObserver;
}

// APIs de pointer / scroll faltantes en jsdom pero requeridas por @testing-library/user-event
// y triggers enfocables de Radix.
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = vi.fn();
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = vi.fn();
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = vi.fn();
}
