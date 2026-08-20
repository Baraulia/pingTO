function getPath(obj, path) {
  return String(path)
    .split('.')
    .reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}

export function runPreRequest(script, ctx) {
  if (!String(script || '').trim()) return { ctx, logs: [] };
  const logs = [];
  const pm = {
    environment: {
      get: (key) => ctx.variables[key],
      set: (key, value) => {
        ctx.variables[key] = String(value);
      },
    },
    variables: {
      get: (key) => ctx.variables[key],
      set: (key, value) => {
        ctx.variables[key] = String(value);
      },
    },
    request: ctx.request,
    info: { console: { log: (...args) => logs.push(args.map(String).join(' ')) } },
  };
  const fn = new Function('pm', 'console', script);
  fn(pm, { log: (...args) => logs.push(args.map(String).join(' ')) });
  return { ctx, logs };
}

export function runTests(script, response, ctx) {
  const results = [];
  if (!String(script || '').trim()) return results;
  const json = (() => {
    try {
      return JSON.parse(response.body);
    } catch {
      return null;
    }
  })();
  const expect = (actual) => ({
    toBe(expected) {
      if (actual !== expected) throw new Error(`expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    },
    toEqual(expected) {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error('values are not equal');
      }
    },
    toContain(part) {
      if (!String(actual).includes(part)) throw new Error(`expected to contain ${part}`);
    },
    toBeTruthy() {
      if (!actual) throw new Error('expected truthy value');
    },
  });
  const pm = {
    test: (name, fn) => {
      try {
        fn();
        results.push({ name, pass: true });
      } catch (error) {
        results.push({ name, pass: false, error: error.message });
      }
    },
    expect,
    response: {
      code: response.status,
      status: response.status,
      json: () => json,
      text: () => response.body,
    },
    environment: {
      get: (key) => ctx.variables[key],
      set: (key, value) => {
        ctx.variables[key] = String(value);
      },
    },
    json,
    getPath: (path) => getPath(json, path),
  };
  const fn = new Function('pm', 'expect', script);
  fn(pm, expect);
  return results;
}
