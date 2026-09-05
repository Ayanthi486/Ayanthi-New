import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Explicit registration because vitest.config.ts runs with `globals: false`,
// so @testing-library/react's automatic afterEach hook (which looks for a
// global `afterEach`) never fires on its own.
afterEach(() => {
  cleanup();
});

// jsdom doesn't implement these; Radix's popper/menu primitives
// (DropdownMenu, etc.) call them during pointer interaction and typeahead.
for (const method of ['hasPointerCapture', 'setPointerCapture', 'releasePointerCapture']) {
  if (!(method in Element.prototype)) {
    Object.defineProperty(Element.prototype, method, { value: () => false, writable: true });
  }
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
