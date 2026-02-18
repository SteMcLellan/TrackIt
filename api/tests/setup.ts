const suppressedWarnings = [
  'WARNING: Failed to detect the Azure Functions runtime.',
  'WARNING: Skipping call to register function'
];

const originalWarn = console.warn.bind(console);

console.warn = (...args: unknown[]) => {
  const text = args
    .map((arg) => (typeof arg === 'string' ? arg : String(arg)))
    .join(' ');
  const shouldSuppress = suppressedWarnings.some((warning) =>
    text.includes(warning)
  );

  if (shouldSuppress) {
    return;
  }

  originalWarn(...args);
};
