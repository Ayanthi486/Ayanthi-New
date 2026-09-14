const fs = require('fs');
const content = fs.readFileSync('src/test/setup.ts', 'utf8');
const fixed = content.replace(/Object\.defineProperty\(window, 'matchMedia'[\s\S]+/, `Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});`);
fs.writeFileSync('src/test/setup.ts', fixed);
