import { u as useTestContext, a as url, c as createTestContext, s as setTestContext, b as stopServer, d as startServer } from './shared/test-utils.8f432eb9.mjs';
export { $ as $fetch, e as exposeContextToEnv, f as fetch, i as isDev, r as recoverContextFromEnv } from './shared/test-utils.8f432eb9.mjs';
import { consola } from 'consola';
import { promises, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defu } from 'defu';
import * as _kit from '@nuxt/kit';
import { dirname, resolve as resolve$1 } from 'pathe';
import { fileURLToPath } from 'node:url';
import 'execa';
import 'get-port-please';
import 'ofetch';

async function createBrowser() {
  const ctx = useTestContext();
  let playwright;
  try {
    playwright = await import(String("playwright-core"));
  } catch {
    throw new Error(`
      The dependency 'playwright-core' not found.
      Please run 'yarn add --dev playwright-core' or 'npm install --save-dev playwright-core'
    `);
  }
  const { type, launch } = ctx.options.browserOptions;
  if (!playwright[type]) {
    throw new Error(`Invalid browser '${type}'`);
  }
  ctx.browser = await playwright[type].launch(launch);
}
async function getBrowser() {
  const ctx = useTestContext();
  if (!ctx.browser) {
    await createBrowser();
  }
  return ctx.browser;
}
async function createPage(path, options) {
  const browser = await getBrowser();
  const page = await browser.newPage(options);
  if (path) {
    await page.goto(url(path));
  }
  return page;
}

function mockFn() {
  const ctx = useTestContext();
  return ctx.mockFn;
}
function mockLogger() {
  const mocks = {};
  consola.mockTypes((type) => {
    mocks[type] = mockFn();
    return mocks[type];
  });
  return mocks;
}

const kit = _kit.default || _kit;
const isNuxtApp = (dir) => {
  return existsSync(dir) && (existsSync(resolve(dir, "pages")) || existsSync(resolve(dir, "nuxt.config.js")) || existsSync(resolve(dir, "nuxt.config.mjs")) || existsSync(resolve(dir, "nuxt.config.cjs")) || existsSync(resolve(dir, "nuxt.config.ts")));
};
const resolveRootDir = () => {
  const { options } = useTestContext();
  const dirs = [
    options.rootDir,
    resolve(options.testDir, options.fixture),
    process.cwd()
  ];
  for (const dir of dirs) {
    if (dir && isNuxtApp(dir)) {
      return dir;
    }
  }
  throw new Error("Invalid nuxt app. (Please explicitly set `options.rootDir` pointing to a valid nuxt app)");
};
async function loadFixture() {
  const ctx = useTestContext();
  ctx.options.rootDir = resolveRootDir();
  if (!ctx.options.dev) {
    const randomId = Math.random().toString(36).slice(2, 8);
    const buildDir = resolve(ctx.options.rootDir, ".nuxt", randomId);
    ctx.options.nuxtConfig = defu(ctx.options.nuxtConfig, {
      buildDir,
      nitro: {
        output: {
          dir: resolve(buildDir, "output")
        }
      }
    });
  }
  ctx.nuxt = await kit.loadNuxt({
    cwd: ctx.options.rootDir,
    dev: ctx.options.dev,
    overrides: ctx.options.nuxtConfig,
    configFile: ctx.options.configFile
  });
  await promises.mkdir(ctx.nuxt.options.buildDir, { recursive: true });
}
async function buildFixture() {
  const ctx = useTestContext();
  const prevLevel = kit.logger.level;
  kit.logger.level = ctx.options.logLevel;
  await kit.buildNuxt(ctx.nuxt);
  kit.logger.level = prevLevel;
}

async function setupJest(hooks) {
  const { jest, test, beforeEach, afterAll, afterEach } = await import('@jest/globals');
  hooks.ctx.mockFn = jest.fn;
  test("setup", hooks.setup, hooks.ctx.options.setupTimeout);
  beforeEach(hooks.beforeEach);
  afterEach(hooks.afterEach);
  afterAll(hooks.afterAll);
}

async function setupVitest(hooks) {
  const vitest = await import('vitest');
  hooks.ctx.mockFn = vitest.vi.fn;
  vitest.beforeAll(hooks.setup, hooks.ctx.options.setupTimeout);
  vitest.beforeEach(hooks.beforeEach);
  vitest.afterEach(hooks.afterEach);
  vitest.afterAll(hooks.afterAll);
}

const setupMaps = {
  jest: setupJest,
  vitest: setupVitest
};
function createTest(options) {
  const ctx = createTestContext(options);
  const beforeEach = () => {
    setTestContext(ctx);
  };
  const afterEach = () => {
    setTestContext(void 0);
  };
  const afterAll = async () => {
    if (ctx.serverProcess) {
      setTestContext(ctx);
      await stopServer();
      setTestContext(void 0);
    }
    if (ctx.nuxt && ctx.nuxt.options.dev) {
      await ctx.nuxt.close();
    }
    if (ctx.browser) {
      await ctx.browser.close();
    }
  };
  const setup2 = async () => {
    if (ctx.options.fixture) {
      await loadFixture();
    }
    if (ctx.options.build) {
      await buildFixture();
    }
    if (ctx.options.server) {
      await startServer();
    }
    if (ctx.options.waitFor) {
      await new Promise((resolve) => setTimeout(resolve, ctx.options.waitFor));
    }
    if (ctx.options.browser) {
      await createBrowser();
    }
  };
  return {
    beforeEach,
    afterEach,
    afterAll,
    setup: setup2,
    ctx
  };
}
async function setup(options = {}) {
  const hooks = createTest(options);
  const setupFn = setupMaps[hooks.ctx.options.runner];
  await setupFn(hooks);
}

const distDir = dirname(fileURLToPath(import.meta.url));

const RunTestDefaults = {
  runner: "vitest",
  globalSetup: true
};
async function runTests(opts) {
  opts = { ...RunTestDefaults, ...opts };
  if (opts.runner !== "vitest") {
    throw new Error(`Unsupported runner: ${opts.runner}. Currently only vitest runner is supported.`);
  }
  if (opts.dev) {
    process.env.NUXT_TEST_DEV = "true";
  }
  process.env.NUXT_TEST_OPTIONS = JSON.stringify(opts);
  const { startVitest } = await import('vitest/node');
  const succeeded = await startVitest(
    "test",
    [],
    // Vitest options
    {
      root: opts.rootDir,
      run: !opts.watch,
      deps: {
        inline: [/@nuxt\/test-utils/]
      }
    },
    // Vite options
    {
      esbuild: {
        tsconfigRaw: "{}"
      },
      test: {
        dir: opts.rootDir,
        deps: {
          inline: [
            distDir,
            "@nuxt/test-utils",
            "@nuxt/test-utils-edge"
          ]
        },
        globals: true,
        globalSetup: [
          ...opts.globalSetup ? [resolve$1(distDir, "./runtime/global-setup")] : []
        ]
      }
    }
  );
  if (!succeeded) {
    process.exit(1);
  }
}

export { buildFixture, createBrowser, createPage, createTest, createTestContext, getBrowser, loadFixture, mockFn, mockLogger, runTests, setTestContext, setup, setupMaps, startServer, stopServer, url, useTestContext };
