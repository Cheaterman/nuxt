import * as playwright_core from 'playwright-core';
import { Browser, BrowserContextOptions, LaunchOptions } from 'playwright-core';
import { NuxtConfig, Nuxt } from '@nuxt/schema';
import { ExecaChildProcess } from 'execa';
import { FetchOptions } from 'ofetch';

declare function createBrowser(): Promise<void>;
declare function getBrowser(): Promise<Browser>;
declare function createPage(path?: string, options?: BrowserContextOptions): Promise<playwright_core.Page>;

type TestRunner = 'vitest' | 'jest';
interface TestOptions {
    testDir: string;
    fixture: string;
    configFile: string;
    rootDir: string;
    buildDir: string;
    nuxtConfig: NuxtConfig;
    build: boolean;
    dev: boolean;
    setupTimeout: number;
    waitFor: number;
    browser: boolean;
    runner: TestRunner;
    logLevel: number;
    browserOptions: {
        type: 'chromium' | 'firefox' | 'webkit';
        launch?: LaunchOptions;
    };
    server: boolean;
    port?: number;
}
interface TestContext {
    options: TestOptions;
    nuxt?: Nuxt;
    browser?: Browser;
    url?: string;
    serverProcess?: ExecaChildProcess;
    mockFn?: Function;
}
interface TestHooks {
    beforeEach: () => void;
    afterEach: () => void;
    afterAll: () => void;
    setup: () => void;
    ctx: TestContext;
}

declare function createTestContext(options: Partial<TestOptions>): TestContext;
declare function useTestContext(): TestContext;
declare function setTestContext(context: TestContext): TestContext;
declare function setTestContext(context?: TestContext): TestContext | undefined;
declare function isDev(): boolean;
declare function recoverContextFromEnv(): void;
declare function exposeContextToEnv(): void;

declare function mockFn(): Function | undefined;
declare function mockLogger(): Record<string, Function>;

declare function loadFixture(): Promise<void>;
declare function buildFixture(): Promise<void>;

declare function startServer(): Promise<void>;
declare function stopServer(): Promise<void>;
declare function fetch(path: string, options?: any): Promise<Response>;
declare function $fetch(path: string, options?: FetchOptions): Promise<any>;
declare function url(path: string): string;

declare function setupJest(hooks: TestHooks): Promise<void>;

declare function setupVitest(hooks: TestHooks): Promise<void>;

declare const setupMaps: {
    jest: typeof setupJest;
    vitest: typeof setupVitest;
};
declare function createTest(options: Partial<TestOptions>): TestHooks;
declare function setup(options?: Partial<TestOptions>): Promise<void>;

interface RunTestOptions {
    rootDir: string;
    dev?: boolean;
    watch?: boolean;
    runner?: 'vitest';
    globalSetup?: boolean;
}
declare function runTests(opts: RunTestOptions): Promise<void>;

export { $fetch, type RunTestOptions, type TestContext, type TestHooks, type TestOptions, type TestRunner, buildFixture, createBrowser, createPage, createTest, createTestContext, exposeContextToEnv, fetch, getBrowser, isDev, loadFixture, mockFn, mockLogger, recoverContextFromEnv, runTests, setTestContext, setup, setupMaps, startServer, stopServer, url, useTestContext };
