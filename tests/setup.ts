/** Minimal chrome API mock for vitest (jsdom). */

function makeStorage() {
  const store = new Map<string, any>();
  const computeGet = (keys: any) => {
    if (keys == null) return Object.fromEntries(store);
    if (typeof keys === 'string')
      return store.has(keys) ? { [keys]: store.get(keys) } : {};
    if (Array.isArray(keys)) {
      const out: Record<string, unknown> = {};
      for (const k of keys) if (store.has(k)) out[k] = store.get(k);
      return out;
    }
    if (typeof keys === 'object') {
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(keys)) out[k] = store.has(k) ? store.get(k) : (keys as Record<string, unknown>)[k];
      return out;
    }
    return {};
  };
  const maybeCallback = (result: any, callback?: (r: any) => void) => {
    if (callback) callback(result);
    return Promise.resolve(result);
  };
  return {
    get: (...args: any[]) => {
      const callback = typeof args[args.length - 1] === 'function' ? args.pop() : undefined;
      return maybeCallback(computeGet(args[0]), callback);
    },
    set: (obj: Record<string, unknown>, callback?: () => void) => {
      for (const [k, v] of Object.entries(obj)) store.set(k, v);
      if (callback) callback();
      return Promise.resolve();
    },
    remove: (keys: any, callback?: () => void) => {
      const list = Array.isArray(keys) ? keys : [keys];
      for (const k of list) store.delete(k);
      if (callback) callback();
      return Promise.resolve();
    },
    getBytesInUse: undefined,
  };
}

const runtimeListeners: Array<(...args: any[]) => unknown> = [];

const chromeMock: any = {
  runtime: {
    id: 'test-extension-id',
    getManifest: () => ({ name: 'CF Toolkit', version: '0.1.0' }),
    lastError: undefined as any,
    onMessage: {
      addListener: (fn: (...args: any[]) => unknown) => { runtimeListeners.push(fn); },
      removeListener: (fn: (...args: any[]) => unknown) => {
        const i = runtimeListeners.indexOf(fn);
        if (i >= 0) runtimeListeners.splice(i, 1);
      },
    },
    onChanged: undefined as any,
    sendMessage: (...args: any[]) => {
      const callback = typeof args[args.length - 1] === 'function' ? args.pop() : undefined;
      const result = { ok: true };
      if (callback) callback(result);
      return Promise.resolve(result);
    },
  },
  storage: {
    sync: makeStorage(),
    local: makeStorage(),
    onChanged: {
      addListener: () => {},
      removeListener: () => {},
    },
  },
};

(globalThis as any).chrome = chromeMock;
(globalThis as any).__cfToolkitChromeMock = chromeMock;
