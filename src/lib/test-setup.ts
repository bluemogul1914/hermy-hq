import "@testing-library/jest-dom";

/* jsdom cannot host a WebGL canvas. The VirtualCity smoke test stubs the
 * @react-three/* layer into plain DOM nodes, which deliberately feeds
 * three-only props (position, args, castShadow, ...) onto DOM elements.
 * React emits validateDOMProp warnings for that — harmless for a headless
 * smoke test. Silence that specific noise so the report stays readable;
 * real failures still surface as thrown errors (not console noise). */
const DOM_PROP_NOISE = /does not recognize|allowed list|Unknown prop|validateDOMProp/i;

const realError = console.error;
const realWarn = console.warn;

console.error = (...args: unknown[]) => {
  if (DOM_PROP_NOISE.test(String(args[0] ?? ""))) return;
  realError(...args);
};

console.warn = (...args: unknown[]) => {
  if (DOM_PROP_NOISE.test(String(args[0] ?? ""))) return;
  realWarn(...args);
};
