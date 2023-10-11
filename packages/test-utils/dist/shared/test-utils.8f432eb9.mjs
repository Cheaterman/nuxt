import { execa } from 'execa';
import { getRandomPort, waitForPort } from 'get-port-please';
import { fetch as fetch$1, $fetch as $fetch$1 } from 'ofetch';
import * as _kit from '@nuxt/kit';
import { resolve as resolve$1 } from 'pathe';
import { resolve } from 'node:path';
import { defu } from 'defu';

let currentContext;
function createTestContext(options) {
  const _options = defu(options, {
    testDir: resolve(process.cwd(), "test"),
    fixture: "fixture",
    configFile: "nuxt.config",
    setupTimeout: 120 * 1e3,
    dev: !!JSON.parse(process.env.NUXT_TEST_DEV || "false"),
    logLevel: 1,
    server: true,
    build: options.browser !== false || options.server !== false,
    nuxtConfig: {},
    // TODO: auto detect based on process.env
    runner: "vitest",
    browserOptions: {
      type: "chromium"
    }
  });
  return setTestContext({
    options: _options
  });
}
function useTestContext() {
  recoverContextFromEnv();
  if (!currentContext) {
    throw new Error("No context is available. (Forgot calling setup or createContext?)");
  }
  return currentContext;
}
function setTestContext(context) {
  currentContext = context;
  return currentContext;
}
function isDev() {
  const ctx = useTestContext();
  return ctx.options.dev;
}
function recoverContextFromEnv() {
  if (!currentContext && process.env.NUXT_TEST_CONTEXT) {
    setTestContext(JSON.parse(process.env.NUXT_TEST_CONTEXT || "{}"));
  }
}
function exposeContextToEnv() {
  const { options, browser, url } = currentContext;
  process.env.NUXT_TEST_CONTEXT = JSON.stringify({ options, browser, url });
}

const kit = _kit.default || _kit;
async function startServer() {
  const ctx = useTestContext();
  await stopServer();
  const host = "127.0.0.1";
  const port = ctx.options.port || await getRandomPort(host);
  ctx.url = `http://${host}:${port}`;
  if (ctx.options.dev) {
    const nuxiCLI = await kit.resolvePath("nuxi/cli");
    ctx.serverProcess = execa(nuxiCLI, ["_dev"], {
      cwd: ctx.nuxt.options.rootDir,
      stdio: "inherit",
      env: {
        ...process.env,
        _PORT: String(port),
        // Used by internal _dev command
        PORT: String(port),
        HOST: host,
        NODE_ENV: "development"
      }
    });
    await waitForPort(port, { retries: 32, host }).catch(() => {
    });
    let lastError;
    for (let i = 0; i < 150; i++) {
      await new Promise((resolve2) => setTimeout(resolve2, 100));
      try {
        const res = await $fetch(ctx.nuxt.options.app.baseURL);
        if (!res.includes("__NUXT_LOADING__")) {
          return;
        }
      } catch (e) {
        lastError = e;
      }
    }
    ctx.serverProcess.kill();
    throw lastError || new Error("Timeout waiting for dev server!");
  } else {
    ctx.serverProcess = execa("node", [
      resolve$1(ctx.nuxt.options.nitro.output.dir, "server/index.mjs")
    ], {
      stdio: "inherit",
      env: {
        ...process.env,
        PORT: String(port),
        HOST: host,
        NODE_ENV: "test"
      }
    });
    await waitForPort(port, { retries: 20, host });
  }
}
async function stopServer() {
  const ctx = useTestContext();
  if (ctx.serverProcess) {
    await ctx.serverProcess.kill();
  }
}
function fetch(path, options) {
  return fetch$1(url(path), options);
}
function $fetch(path, options) {
  return $fetch$1(url(path), options);
}
function url(path) {
  const ctx = useTestContext();
  if (!ctx.url) {
    throw new Error("url is not available (is server option enabled?)");
  }
  if (path.startsWith(ctx.url)) {
    return path;
  }
  return ctx.url + path;
}

export { $fetch as $, url as a, stopServer as b, createTestContext as c, startServer as d, exposeContextToEnv as e, fetch as f, isDev as i, recoverContextFromEnv as r, setTestContext as s, useTestContext as u };
