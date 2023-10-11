import { TransitionProps, KeepAliveProps } from 'vue';
import { ViteDevServer, UserConfig, ServerOptions } from 'vite';
import { Options as Options$4 } from '@vitejs/plugin-vue';
import { Options as Options$5 } from '@vitejs/plugin-vue-jsx';
import { SchemaDefinition, Schema } from 'untyped';
export { SchemaDefinition } from 'untyped';
import { NitroConfig, Nitro, NitroEventHandler, NitroDevEventHandler, NitroRuntimeConfigApp, NitroRuntimeConfig } from 'nitropack';
import { Hookable } from 'hookable';
import { Ignore } from 'ignore';
import { Server } from 'node:http';
import { Server as Server$1 } from 'node:https';
import { TSConfig } from 'pkg-types';
import { Manifest } from 'vue-bundle-renderer';
import { EventHandler } from 'h3';
import { InlinePreset, Import, Unimport, UnimportOptions } from 'unimport';
import { Configuration, Compiler, Stats, WebpackError } from 'webpack';
import { RouteLocationRaw, RouterOptions as RouterOptions$1, RouterHistory } from 'vue-router';
import { CompilerOptions } from '@vue/compiler-core';
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer';
import { PluginVisualizerOptions } from 'rollup-plugin-visualizer';
import { TransformerOptions } from 'unctx/transform';
import { PluginOptions } from 'mini-css-extract-plugin';
import { LoaderOptions } from 'esbuild-loader';
import { Options } from 'file-loader';
import { Options as Options$1 } from 'pug';
import { VueLoaderOptions } from 'vue-loader';
import { Options as Options$2 } from 'sass-loader';
import { BasePluginOptions, DefinedDefaultMinimizerAndOptions } from 'css-minimizer-webpack-plugin';
import { ProcessOptions } from 'postcss';
import { Options as Options$3 } from 'webpack-dev-middleware';
import { IncomingMessage, ServerResponse } from 'http';
import { MiddlewareOptions, ClientOptions } from 'webpack-hot-middleware';
import { MergeHead, Head } from '@unhead/schema';
import * as untyped_dist_types_a304c6a0 from 'untyped/dist/types-a304c6a0';

interface NuxtCompatibility {
    /**
     * Required nuxt version in semver format.
     * @example `^2.14.0` or `>=3.0.0-27219851.6e49637`.
     */
    nuxt?: string;
    /**
     * Bridge constraint for Nuxt 2 support.
     *
     * - `true`:  When using Nuxt 2, using bridge module is required.
     * - `false`: When using Nuxt 2, using bridge module is not supported.
     */
    bridge?: boolean;
}
interface NuxtCompatibilityIssue {
    name: string;
    message: string;
}
interface NuxtCompatibilityIssues extends Array<NuxtCompatibilityIssue> {
    /**
     * Return formatted error message.
     */
    toString(): string;
}

interface Component {
    pascalName: string;
    kebabName: string;
    export: string;
    filePath: string;
    shortPath: string;
    chunkName: string;
    prefetch: boolean;
    preload: boolean;
    global?: boolean | 'sync';
    island?: boolean;
    mode?: 'client' | 'server' | 'all';
    /**
     * This number allows configuring the behavior of overriding Nuxt components.
     * If multiple components are provided with the same name, then higher priority
     * components will be used instead of lower priority components.
     */
    priority?: number;
    /**
     * Allow bypassing client/server transforms for internal Nuxt components like
     * ServerPlaceholder and NuxtClientFallback.
     *
     * @internal
     */
    _raw?: boolean;
}
interface ScanDir {
    /**
     * Path (absolute or relative) to the directory containing your components.
     * You can use Nuxt aliases (~ or @) to refer to directories inside project or directly use an npm package path similar to require.
     */
    path: string;
    /**
     * Accept Pattern that will be run against specified path.
     */
    pattern?: string | string[];
    /**
     * Ignore patterns that will be run against specified path.
     */
    ignore?: string[];
    /**
     * Prefix all matched components.
     */
    prefix?: string;
    /**
     * Prefix component name by its path.
     */
    pathPrefix?: boolean;
    /**
     * Ignore scanning this directory if set to `true`
     */
    enabled?: boolean;
    /**
     * These properties (prefetch/preload) are used in production to configure how components with Lazy prefix are handled by webpack via its magic comments.
     * Learn more on webpack documentation: https://webpack.js.org/api/module-methods/#magic-comments
     */
    prefetch?: boolean;
    /**
     * These properties (prefetch/preload) are used in production to configure how components with Lazy prefix are handled by webpack via its magic comments.
     * Learn more on webpack documentation: https://webpack.js.org/api/module-methods/#magic-comments
     */
    preload?: boolean;
    /**
     * This flag indicates, component should be loaded async (with a separate chunk) regardless of using Lazy prefix or not.
     */
    isAsync?: boolean;
    extendComponent?: (component: Component) => Promise<Component | void> | (Component | void);
    /**
     * If enabled, registers components to be globally available.
     *
     */
    global?: boolean;
    /**
     * If enabled, registers components as islands
     */
    island?: boolean;
}
interface ComponentsDir extends ScanDir {
    /**
     * Watch specified path for changes, including file additions and file deletions.
     */
    watch?: boolean;
    /**
     * Extensions supported by Nuxt builder.
     */
    extensions?: string[];
    /**
     * Transpile specified path using build.transpile.
     * By default ('auto') it will set transpile: true if node_modules/ is in path.
     */
    transpile?: 'auto' | boolean;
    /**
     * This number allows configuring the behavior of overriding Nuxt components.
     * It will be inherited by any components within the directory.
     *
     * If multiple components are provided with the same name, then higher priority
     * components will be used instead of lower priority components.
     */
    priority?: number;
}
interface ComponentsOptions {
    dirs: (string | ComponentsDir)[];
    /**
     * The default value for whether to globally register components.
     *
     * When components are registered globally, they will still be directly imported where used,
     * but they can also be used dynamically, for example `<component :is="`icon-${myIcon}`">`.
     *
     * This can be overridden by an individual component directory entry.
     * @default false
     */
    global?: boolean;
    loader?: boolean;
    transform?: {
        exclude?: RegExp[];
        include?: RegExp[];
    };
}

type HookResult = Promise<void> | void;
type TSReference = {
    types: string;
} | {
    path: string;
};
type WatchEvent = 'add' | 'addDir' | 'change' | 'unlink' | 'unlinkDir';
type NuxtPage = {
    name?: string;
    path: string;
    file?: string;
    meta?: Record<string, any>;
    alias?: string[] | string;
    redirect?: RouteLocationRaw;
    children?: NuxtPage[];
};
type NuxtMiddleware = {
    name: string;
    path: string;
    global?: boolean;
};
type NuxtLayout = {
    name: string;
    file: string;
};
interface ImportPresetWithDeprecation extends InlinePreset {
}
interface GenerateAppOptions {
    filter?: (template: ResolvedNuxtTemplate<any>) => boolean;
}
interface NuxtAnalyzeMeta {
    name: string;
    slug: string;
    startTime: number;
    endTime: number;
    analyzeDir: string;
    buildDir: string;
    outDir: string;
}
/**
 * The listeners to Nuxt build time events
 */
interface NuxtHooks {
    /**
     * Allows extending compatibility checks.
     * @param compatibility Compatibility object
     * @param issues Issues to be mapped
     * @returns Promise
     */
    'kit:compatibility': (compatibility: NuxtCompatibility, issues: NuxtCompatibilityIssues) => HookResult;
    /**
     * Called after Nuxt initialization, when the Nuxt instance is ready to work.
     * @param nuxt The configured Nuxt object
     * @returns Promise
     */
    'ready': (nuxt: Nuxt) => HookResult;
    /**
     * Called when Nuxt instance is gracefully closing.
     * @param nuxt The configured Nuxt object
     * @returns Promise
     */
    'close': (nuxt: Nuxt) => HookResult;
    /**
     * Called to restart the current Nuxt instance.
     * @returns Promise
     */
    'restart': (options?: {
        /**
         * Try to restart the whole process if supported
         */
        hard?: boolean;
    }) => HookResult;
    /**
     * Called during Nuxt initialization, before installing user modules.
     * @returns Promise
     */
    'modules:before': () => HookResult;
    /**
     * Called during Nuxt initialization, after installing user modules.
     * @returns Promise
     */
    'modules:done': () => HookResult;
    /**
     * Called after resolving the `app` instance.
     * @param app The resolved `NuxtApp` object
     * @returns Promise
     */
    'app:resolve': (app: NuxtApp) => HookResult;
    /**
     * Called during `NuxtApp` generation, to allow customizing, modifying or adding new files to the build directory (either virtually or to written to `.nuxt`).
     * @param app The configured `NuxtApp` object
     * @returns Promise
     */
    'app:templates': (app: NuxtApp) => HookResult;
    /**
     * Called after templates are compiled into the [virtual file system](https://nuxt.com/docs/guide/directory-structure/nuxt#virtual-file-system) (vfs).
     * @param app The configured `NuxtApp` object
     * @returns Promise
     */
    'app:templatesGenerated': (app: NuxtApp, templates: ResolvedNuxtTemplate[], options?: GenerateAppOptions) => HookResult;
    /**
     * Called before Nuxt bundle builder.
     * @returns Promise
     */
    'build:before': () => HookResult;
    /**
     * Called after Nuxt bundle builder is complete.
     * @returns Promise
     */
    'build:done': () => HookResult;
    /**
     * Called during the manifest build by Vite and Webpack. This allows customizing the manifest that Nitro will use to render `<script>` and `<link>` tags in the final HTML.
     * @param manifest The manifest object to build
     * @returns Promise
     */
    'build:manifest': (manifest: Manifest) => HookResult;
    /**
     * Called when `nuxt analyze` is finished
     * @param meta the analyze meta object, mutations will be saved to `meta.json`
     * @returns Promise
     */
    'build:analyze:done': (meta: NuxtAnalyzeMeta) => HookResult;
    /**
     * Called before generating the app.
     * @param options GenerateAppOptions object
     * @returns Promise
     */
    'builder:generateApp': (options?: GenerateAppOptions) => HookResult;
    /**
     * Called at build time in development when the watcher spots a change to a file or directory in the project.
     * @param event "add" | "addDir" | "change" | "unlink" | "unlinkDir"
     * @param path the path to the watched file
     * @returns Promise
     */
    'builder:watch': (event: WatchEvent, path: string) => HookResult;
    /**
     * Called after pages routes are resolved.
     * @param pages Array containing resolved pages
     * @returns Promise
     */
    'pages:extend': (pages: NuxtPage[]) => HookResult;
    /**
     * Called when the dev middleware is being registered on the Nitro dev server.
     * @param handler the Vite or Webpack event handler
     * @returns Promise
     */
    'server:devHandler': (handler: EventHandler) => HookResult;
    /**
     * Called at setup allowing modules to extend sources.
     * @param presets Array containing presets objects
     * @returns Promise
     */
    'imports:sources': (presets: ImportPresetWithDeprecation[]) => HookResult;
    /**
     * Called at setup allowing modules to extend imports.
     * @param imports Array containing the imports to extend
     * @returns Promise
     */
    'imports:extend': (imports: Import[]) => HookResult;
    /**
     * Called when the [unimport](https://github.com/unjs/unimport) context is created.
     * @param context The Unimport context
     * @returns Promise
     */
    'imports:context': (context: Unimport) => HookResult;
    /**
     * Allows extending import directories.
     * @param dirs Array containing directories as string
     * @returns Promise
     */
    'imports:dirs': (dirs: string[]) => HookResult;
    /**
     * Called within `app:resolve` allowing to extend the directories that are scanned for auto-importable components.
     * @param dirs The `dirs` option to push new items
     * @returns Promise
     */
    'components:dirs': (dirs: ComponentsOptions['dirs']) => HookResult;
    /**
     * Allows extending new components.
     * @param components The `components` array to push new items
     * @returns Promise
     */
    'components:extend': (components: Component[]) => HookResult;
    /**
     * Called before initializing Nitro, allowing customization of Nitro's configuration.
     * @param nitroConfig The nitro config to be extended
     * @returns Promise
     */
    'nitro:config': (nitroConfig: NitroConfig) => HookResult;
    /**
     * Called after Nitro is initialized, which allows registering Nitro hooks and interacting directly with Nitro.
     * @param nitro The created nitro object
     * @returns Promise
     */
    'nitro:init': (nitro: Nitro) => HookResult;
    /**
     * Called before building the Nitro instance.
     * @param nitro The created nitro object
     * @returns Promise
     */
    'nitro:build:before': (nitro: Nitro) => HookResult;
    /**
     * Called after copying public assets. Allows modifying public assets before Nitro server is built.
     * @param nitro The created nitro object
     * @returns Promise
     */
    'nitro:build:public-assets': (nitro: Nitro) => HookResult;
    /**
     * Allows extending the routes to be pre-rendered.
     * @param ctx Nuxt context
     * @returns Promise
     */
    'prerender:routes': (ctx: {
        routes: Set<string>;
    }) => HookResult;
    /**
     * Called when an error occurs at build time.
     * @param error Error object
     * @returns Promise
     */
    'build:error': (error: Error) => HookResult;
    /**
     * Called before Nuxi writes `.nuxt/tsconfig.json` and `.nuxt/nuxt.d.ts`, allowing addition of custom references and declarations in `nuxt.d.ts`, or directly modifying the options in `tsconfig.json`
     * @param options Objects containing `references`, `declarations`, `tsConfig`
     * @returns Promise
     */
    'prepare:types': (options: {
        references: TSReference[];
        declarations: string[];
        tsConfig: TSConfig;
    }) => HookResult;
    /**
     * Called when the dev server is loading.
     * @param listenerServer The HTTP/HTTPS server object
     * @param listener The server's listener object
     * @returns Promise
     */
    'listen': (listenerServer: Server | Server$1, listener: any) => HookResult;
    /**
     * Allows extending default schemas.
     * @param schemas Schemas to be extend
     * @returns void
     */
    'schema:extend': (schemas: SchemaDefinition[]) => void;
    /**
     * Allows extending resolved schema.
     * @param schema Schema object
     * @returns void
     */
    'schema:resolved': (schema: Schema) => void;
    /**
     * Called before writing the given schema.
     * @param schema Schema object
     * @returns void
     */
    'schema:beforeWrite': (schema: Schema) => void;
    /**
     * Called after the schema is written.
     * @returns void
     */
    'schema:written': () => void;
    /**
     * Allows to extend Vite default context.
     * @param viteBuildContext The vite build context object
     * @returns Promise
     */
    'vite:extend': (viteBuildContext: {
        nuxt: Nuxt;
        config: ViteConfig;
    }) => HookResult;
    /**
     * Allows to extend Vite default config.
     * @param viteInlineConfig The vite inline config object
     * @param env Server or client
     * @returns Promise
     */
    'vite:extendConfig': (viteInlineConfig: ViteConfig, env: {
        isClient: boolean;
        isServer: boolean;
    }) => HookResult;
    /**
     * Allows to read the resolved Vite config.
     * @param viteInlineConfig The vite inline config object
     * @param env Server or client
     * @returns Promise
     */
    'vite:configResolved': (viteInlineConfig: Readonly<ViteConfig>, env: {
        isClient: boolean;
        isServer: boolean;
    }) => HookResult;
    /**
     * Called when the Vite server is created.
     * @param viteServer Vite development server
     * @param env Server or client
     * @returns Promise
     */
    'vite:serverCreated': (viteServer: ViteDevServer, env: {
        isClient: boolean;
        isServer: boolean;
    }) => HookResult;
    /**
     * Called after Vite server is compiled.
     * @returns Promise
     */
    'vite:compiled': () => HookResult;
    /**
     * Called before configuring the webpack compiler.
     * @param webpackConfigs Configs objects to be pushed to the compiler
     * @returns Promise
     */
    'webpack:config': (webpackConfigs: Configuration[]) => HookResult;
    /**
     * Allows to read the resolved webpack config
     * @param webpackConfigs Configs objects to be pushed to the compiler
     * @returns Promise
     */
    'webpack:configResolved': (webpackConfigs: Readonly<Configuration>[]) => HookResult;
    /**
     * Called right before compilation.
     * @param options The options to be added
     * @returns Promise
     */
    'webpack:compile': (options: {
        name: string;
        compiler: Compiler;
    }) => HookResult;
    /**
     * Called after resources are loaded.
     * @param options The compiler options
     * @returns Promise
     */
    'webpack:compiled': (options: {
        name: string;
        compiler: Compiler;
        stats: Stats;
    }) => HookResult;
    /**
     * Called on `change` on WebpackBar.
     * @param shortPath the short path
     * @returns void
     */
    'webpack:change': (shortPath: string) => void;
    /**
     * Called on `done` if has errors on WebpackBar.
     * @returns void
     */
    'webpack:error': () => void;
    /**
     * Called on `allDone` on WebpackBar.
     * @returns void
     */
    'webpack:done': () => void;
    /**
     * Called on `progress` on WebpackBar.
     * @param statesArray The array containing the states on progress
     * @returns void
     */
    'webpack:progress': (statesArray: any[]) => void;
}
type NuxtHookName = keyof NuxtHooks;

interface NuxtPlugin {
    /** @deprecated use mode */
    ssr?: boolean;
    src: string;
    mode?: 'all' | 'server' | 'client';
    /**
     * This allows more granular control over plugin order and should only be used by advanced users.
     * Lower numbers run first, and user plugins default to `0`.
     *
     * Default Nuxt priorities can be seen at [here](https://github.com/nuxt/nuxt/blob/9904849bc87c53dfbd3ea3528140a5684c63c8d8/packages/nuxt/src/core/plugins/plugin-metadata.ts#L15-L34).
     */
    order?: number;
}
type TemplateDefaultOptions = Record<string, any>;
interface NuxtTemplate<Options = TemplateDefaultOptions> {
    /** resolved output file path (generated) */
    dst?: string;
    /** The target filename once the template is copied into the Nuxt buildDir */
    filename?: string;
    /** An options object that will be accessible within the template via `<% options %>` */
    options?: Options;
    /** The resolved path to the source file to be template */
    src?: string;
    /** Provided compile option instead of src */
    getContents?: (data: Options) => string | Promise<string>;
    /** Write to filesystem */
    write?: boolean;
}
interface ResolvedNuxtTemplate<Options = TemplateDefaultOptions> extends NuxtTemplate<Options> {
    filename: string;
    dst: string;
}
interface NuxtTypeTemplate<Options = TemplateDefaultOptions> extends Omit<NuxtTemplate<Options>, 'write'> {
    write?: true;
}
type _TemplatePlugin<Options> = Omit<NuxtPlugin, 'src'> & NuxtTemplate<Options>;
interface NuxtPluginTemplate<Options = TemplateDefaultOptions> extends _TemplatePlugin<Options> {
}
interface NuxtApp {
    mainComponent?: string | null;
    rootComponent?: string | null;
    errorComponent?: string | null;
    dir: string;
    extensions: string[];
    plugins: NuxtPlugin[];
    components: Component[];
    layouts: Record<string, NuxtLayout>;
    middleware: NuxtMiddleware[];
    templates: NuxtTemplate[];
    configs: string[];
}
interface Nuxt {
    _version: string;
    _ignore?: Ignore;
    _ignorePatterns?: string[];
    /** The resolved Nuxt configuration. */
    options: NuxtOptions;
    hooks: Hookable<NuxtHooks>;
    hook: Nuxt['hooks']['hook'];
    callHook: Nuxt['hooks']['callHook'];
    addHooks: Nuxt['hooks']['addHooks'];
    ready: () => Promise<void>;
    close: () => Promise<void>;
    /** The production or development server. */
    server?: any;
    vfs: Record<string, string>;
    apps: Record<string, NuxtApp>;
}

interface ImportsOptions extends UnimportOptions {
    /**
     * Enable implicit auto import from Vue, Nuxt and module contributed utilities.
     * Generate global TypeScript definitions.
     * @default true
     */
    autoImport?: boolean;
    /**
     * Directories to scan for auto imports.
     * @see https://nuxt.com/docs/guide/directory-structure/composables#how-files-are-scanned
     * @default ['./composables', './utils']
     */
    dirs?: string[];
    /**
     * Assign auto imported utilities to `globalThis` instead of using built time transformation.
     * @default false
     */
    global?: boolean;
    transform?: {
        exclude?: RegExp[];
        include?: RegExp[];
    };
}

interface ModuleMeta {
    /** Module name. */
    name?: string;
    /** Module version. */
    version?: string;
    /**
     * The configuration key used within `nuxt.config` for this module's options.
     * For example, `@nuxtjs/axios` uses `axios`.
     */
    configKey?: string;
    /**
     * Constraints for the versions of Nuxt or features this module requires.
     */
    compatibility?: NuxtCompatibility;
    [key: string]: unknown;
}
/** The options received.  */
type ModuleOptions = Record<string, any>;
/** Optional result for nuxt modules */
interface ModuleSetupReturn {
    /**
     * Timing information for the initial setup
     */
    timings?: {
        /** Total time took for module setup in ms */
        setup?: number;
        [key: string]: number | undefined;
    };
}
type Awaitable<T> = T | Promise<T>;
type _ModuleSetupReturn = Awaitable<void | false | ModuleSetupReturn>;
/** Input module passed to defineNuxtModule. */
interface ModuleDefinition<T extends ModuleOptions = ModuleOptions> {
    meta?: ModuleMeta;
    defaults?: T | ((nuxt: Nuxt) => T);
    schema?: T;
    hooks?: Partial<NuxtHooks>;
    setup?: (this: void, resolvedOptions: T, nuxt: Nuxt) => _ModuleSetupReturn;
}
interface NuxtModule<T extends ModuleOptions = ModuleOptions> {
    (this: void, inlineOptions: T, nuxt: Nuxt): _ModuleSetupReturn;
    getOptions?: (inlineOptions?: T, nuxt?: Nuxt) => Promise<T>;
    getMeta?: () => Promise<ModuleMeta>;
}

type RouterOptions = Partial<Omit<RouterOptions$1, 'history' | 'routes'>> & {
    history?: (baseURL?: string) => RouterHistory;
    routes?: (_routes: RouterOptions$1['routes']) => RouterOptions$1['routes'];
    hashMode?: boolean;
    scrollBehaviorType?: 'smooth' | 'auto';
};
type RouterConfig = RouterOptions;
/**
 * Only JSON serializable router options are configurable from nuxt config
 */
type RouterConfigSerializable = Pick<RouterConfig, 'linkActiveClass' | 'linkExactActiveClass' | 'end' | 'sensitive' | 'strict' | 'hashMode' | 'scrollBehaviorType'>;

interface ConfigSchema {
 /**
  * Configure Nuxt component auto-registration.
  * 
  * Any components in the directories configured here can be used throughout your pages, layouts (and other components) without needing to explicitly import them.
  * 
  * 
  * @see https://nuxt.com/docs/guide/directory-structure/components
 */
 components: boolean | ComponentsOptions | ComponentsOptions['dirs'],

 /**
  * Configure how Nuxt auto-imports composables into your application.
  * 
  * 
  * @see [Nuxt 3 documentation](https://nuxt.com/docs/guide/directory-structure/composables)
 */
 imports: ImportsOptions,

 /**
  * Whether to use the vue-router integration in Nuxt 3. If you do not provide a value it will be enabled if you have a `pages/` directory in your source folder.
  * 
 */
 pages: boolean,

 /**
  * Manually disable nuxt telemetry.
  * 
  * 
  * @see [Nuxt Telemetry](https://github.com/nuxt/telemetry) for more information.
 */
 telemetry: boolean | Record<string, any>,

 /**
  * Enable Nuxt DevTools for development.
  * 
  * This is an experimental feature. Breaking changes for devtools might not reflect on the version of Nuxt.
  * 
  * @default false
  * 
  * @see  [Nuxt DevTools](https://devtools.nuxtjs.org/) for more information.
  * 
  * @experimental
 */
 devtools: boolean | { enabled: boolean, [key: string]: any },

 /**
  * Vue.js config
  * 
 */
 vue: {
  /**
   * Options for the Vue compiler that will be passed at build time.
   * 
   * 
   * @see [documentation](https://vuejs.org/api/application.html#app-config-compileroptions)
  */
  compilerOptions: CompilerOptions,

  /**
   * Include Vue compiler in runtime bundle.
   * 
   * @default false
  */
  runtimeCompiler: boolean,

  /**
   * Vue Experimental: Enable reactive destructure for `defineProps`
   * 
   * @default false
   * 
   * @see [Vue RFC#502](https://github.com/vuejs/rfcs/discussions/502)
  */
  propsDestructure: boolean,

  /**
   * Vue Experimental: Enable macro `defineModel`
   * 
   * @default false
   * 
   * @see [Vue RFC#503](https://github.com/vuejs/rfcs/discussions/503)
  */
  defineModel: boolean,
 },

 /**
  * Nuxt App configuration.
  * 
 */
 app: {
  /**
   * The base path of your Nuxt application.
   * 
   * This can be set at runtime by setting the NUXT_APP_BASE_URL environment variable.
   * 
   * @default "/"
   * 
   * @example
   * ```bash
   * NUXT_APP_BASE_URL=/prefix/ node .output/server/index.mjs
   * ```
  */
  baseURL: string,

  /**
   * The folder name for the built site assets, relative to `baseURL` (or `cdnURL` if set). This is set at build time and should not be customized at runtime.
   * 
   * @default "/_nuxt/"
  */
  buildAssetsDir: string,

  /**
   * An absolute URL to serve the public folder from (production-only).
   * 
   * This can be set to a different value at runtime by setting the `NUXT_APP_CDN_URL` environment variable.
   * 
   * @default ""
   * 
   * @example
   * ```bash
   * NUXT_APP_CDN_URL=https://mycdn.org/ node .output/server/index.mjs
   * ```
  */
  cdnURL: string,

  /**
   * Set default configuration for `<head>` on every page.
   * 
   * 
   * @example
   * ```js
   * app: {
   *   head: {
   *     meta: [
   *       // <meta name="viewport" content="width=device-width, initial-scale=1">
   *       { name: 'viewport', content: 'width=device-width, initial-scale=1' }
   *     ],
   *     script: [
   *       // <script src="https://myawesome-lib.js"></script>
   *       { src: 'https://awesome-lib.js' }
   *     ],
   *     link: [
   *       // <link rel="stylesheet" href="https://myawesome-lib.css">
   *       { rel: 'stylesheet', href: 'https://awesome-lib.css' }
   *     ],
   *     // please note that this is an area that is likely to change
   *     style: [
   *       // <style type="text/css">:root { color: red }</style>
   *       { children: ':root { color: red }', type: 'text/css' }
   *     ],
   *     noscript: [
   *       // <noscript>JavaScript is required</noscript>
   *       { children: 'JavaScript is required' }
   *     ]
   *   }
   * }
   * ```
  */
  head: NuxtAppConfig['head'],

  /**
   * Default values for layout transitions.
   * 
   * This can be overridden with `definePageMeta` on an individual page. Only JSON-serializable values are allowed.
   * 
   * @default false
   * 
   * @see https://vuejs.org/api/built-in-components.html#transition
  */
  layoutTransition: NuxtAppConfig['layoutTransition'],

  /**
   * Default values for page transitions.
   * 
   * This can be overridden with `definePageMeta` on an individual page. Only JSON-serializable values are allowed.
   * 
   * @default false
   * 
   * @see https://vuejs.org/api/built-in-components.html#transition
  */
  pageTransition: NuxtAppConfig['pageTransition'],

  /**
   * Default values for KeepAlive configuration between pages.
   * 
   * This can be overridden with `definePageMeta` on an individual page. Only JSON-serializable values are allowed.
   * 
   * @default false
   * 
   * @see https://vuejs.org/api/built-in-components.html#keepalive
  */
  keepalive: NuxtAppConfig['keepalive'],

  /**
   * Customize Nuxt root element id.
   * 
   * @default "__nuxt"
  */
  rootId: string | false,

  /**
   * Customize Nuxt root element tag.
   * 
   * @default "div"
  */
  rootTag: string,
 },

 /**
  * Boolean or a path to an HTML file with the contents of which will be inserted into any HTML page rendered with `ssr: false`. - If it is unset, it will use `~/app/spa-loading-template.html` if it exists. - If it is false, no SPA loading indicator will be loaded. - If true, Nuxt will look for `~/app/spa-loading-template.html` file or a default Nuxt image will be used.
  * 
  * Some good sources for spinners are [SpinKit](https://github.com/tobiasahlin/SpinKit) or [SVG Spinners](https://icones.js.org/collection/svg-spinners).
  * 
  * 
  * @example ~/app/spa-loading-template.html
  * ```html
  * <!-- https://github.com/barelyhuman/snips/blob/dev/pages/css-loader.md -->
  * <div class="loader"></div>
  * <style>
  * .loader {
  *   display: block;
  *   position: fixed;
  *   z-index: 1031;
  *   top: 50%;
  *   left: 50%;
  *   transform: translate(-50%, -50%);
  *   width: 18px;
  *   height: 18px;
  *   box-sizing: border-box;
  *   border: solid 2px transparent;
  *   border-top-color: #000;
  *   border-left-color: #000;
  *   border-bottom-color: #efefef;
  *   border-right-color: #efefef;
  *   border-radius: 50%;
  *   -webkit-animation: loader 400ms linear infinite;
  *   animation: loader 400ms linear infinite;
  * }
  * 
  * \@-webkit-keyframes loader {
  *   0% {
  *     -webkit-transform: translate(-50%, -50%) rotate(0deg);
  *   }
  *   100% {
  *     -webkit-transform: translate(-50%, -50%) rotate(360deg);
  *   }
  * }
  * \@keyframes loader {
  *   0% {
  *     transform: translate(-50%, -50%) rotate(0deg);
  *   }
  *   100% {
  *     transform: translate(-50%, -50%) rotate(360deg);
  *   }
  * }
  * </style>
  * ```
 */
 spaLoadingTemplate: string | boolean,

 /**
  * An array of nuxt app plugins.
  * 
  * Each plugin can be a string (which can be an absolute or relative path to a file). If it ends with `.client` or `.server` then it will be automatically loaded only in the appropriate context.
  * It can also be an object with `src` and `mode` keys.
  * 
  * 
  * @note Plugins are also auto-registered from the `~/plugins` directory
  * and these plugins do not need to be listed in `nuxt.config` unless you
  * need to customize their order. All plugins are deduplicated by their src path.
  * 
  * @see https://nuxt.com/docs/guide/directory-structure/plugins
  * 
  * @example
  * ```js
  * plugins: [
  *   '~/plugins/foo.client.js', // only in client side
  *   '~/plugins/bar.server.js', // only in server side
  *   '~/plugins/baz.js', // both client & server
  *   { src: '~/plugins/both-sides.js' },
  *   { src: '~/plugins/client-only.js', mode: 'client' }, // only on client side
  *   { src: '~/plugins/server-only.js', mode: 'server' } // only on server side
  * ]
  * ```
 */
 plugins: (NuxtPlugin | string)[],

 /**
  * You can define the CSS files/modules/libraries you want to set globally (included in every page).
  * 
  * Nuxt will automatically guess the file type by its extension and use the appropriate pre-processor. You will still need to install the required loader if you need to use them.
  * 
  * 
  * @example
  * ```js
  * css: [
  *   // Load a Node.js module directly (here it's a Sass file).
  *   'bulma',
  *   // CSS file in the project
  *   '@/assets/css/main.css',
  *   // SCSS file in the project
  *   '@/assets/css/main.scss'
  * ]
  * ```
 */
 css: string[],

 /**
  * The builder to use for bundling the Vue part of your application.
  * 
  * @default "@nuxt/vite-builder"
 */
 builder: 'vite' | 'webpack' | { bundle: (nuxt: Nuxt) => Promise<void> },

 /**
  * Whether to generate sourcemaps.
  * 
 */
 sourcemap: boolean | { server?: boolean | 'hidden', client?: boolean | 'hidden' },

 /**
  * Log level when building logs.
  * 
  * Defaults to 'silent' when running in CI or when a TTY is not available. This option is then used as 'silent' in Vite and 'none' in Webpack
  * 
  * @default "info"
 */
 logLevel: 'silent' | 'info' | 'verbose',

 /**
  * Shared build configuration.
  * 
 */
 build: {
  /**
   * If you want to transpile specific dependencies with Babel, you can add them here. Each item in transpile can be a package name, a function, a string or regex object matching the dependency's file name.
   * 
   * You can also use a function to conditionally transpile. The function will receive an object ({ isDev, isServer, isClient, isModern, isLegacy }).
   * 
   * 
   * @example
   * ```js
   *      transpile: [({ isLegacy }) => isLegacy && 'ky']
   * ```
  */
  transpile: Array<string | RegExp | ((ctx: { isClient?: boolean; isServer?: boolean; isDev: boolean }) => string | RegExp | false)>,

  /**
   * You can provide your own templates which will be rendered based on Nuxt configuration. This feature is specially useful for using with modules.
   * 
   * Templates are rendered using [`lodash/template`](https://lodash.com/docs/4.17.15#template).
   * 
   * 
   * @example
   * ```js
   * templates: [
   *   {
   *     src: '~/modules/support/plugin.js', // `src` can be absolute or relative
   *     dst: 'support.js', // `dst` is relative to project `.nuxt` dir
   *     options: {
   *       // Options are provided to template as `options` key
   *       live_chat: false
   *     }
   *   }
   * ]
   * ```
  */
  templates: NuxtTemplate<any>[],

  /**
   * Nuxt uses `webpack-bundle-analyzer` to visualize your bundles and how to optimize them.
   * 
   * Set to `true` to enable bundle analysis, or pass an object with options: [for webpack](https://github.com/webpack-contrib/webpack-bundle-analyzer#options-for-plugin) or [for vite](https://github.com/btd/rollup-plugin-visualizer#options).
   * 
   * @default false
   * 
   * @example
   * ```js
   * analyze: {
   *   analyzerMode: 'static'
   * }
   * ```
  */
  analyze: boolean | BundleAnalyzerPlugin.Options | PluginVisualizerOptions,
 },

 /**
  * Build time optimization configuration.
  * 
 */
 optimization: {
  /**
   * Functions to inject a key for.
   * 
   * As long as the number of arguments passed to the function is less than `argumentLength`, an additional magic string will be injected that can be used to deduplicate requests between server and client. You will need to take steps to handle this additional key.
   * The key will be unique based on the location of the function being invoked within the file.
   * 
   * @default [{"name":"defineNuxtComponent","argumentLength":2},{"name":"useState","argumentLength":2},{"name":"useFetch","argumentLength":3},{"name":"useAsyncData","argumentLength":3},{"name":"useLazyAsyncData","argumentLength":3},{"name":"useLazyFetch","argumentLength":3}]
  */
  keyedComposables: Array<{ name: string, source?: string | RegExp, argumentLength: number }>,

  /**
   * Tree shake code from specific builds.
   * 
  */
  treeShake: {
   /**
    * Tree shake composables from the server or client builds.
    * 
    * 
    * @example
    * ```js
    * treeShake: { client: { myPackage: ['useServerOnlyComposable'] } }
    * ```
   */
   composables: {
    server: {
     [key: string]: any
    },

    client: {
     [key: string]: any
    },
   },
  },

  /**
   * Options passed directly to the transformer from `unctx` that preserves async context after `await`.
   * 
  */
  asyncTransforms: TransformerOptions,
 },

 /**
  * Extend project from multiple local or remote sources.
  * 
  * Value should be either a string or array of strings pointing to source directories or config path relative to current config.
  * You can use `github:`, `gitlab:`, `bitbucket:` or `https://` to extend from a remote git repository.
  * 
 */
 extends: string|string[],

 /**
  * Extend project from a local or remote source.
  * 
  * Value should be a string pointing to source directory or config path relative to current config.
  * You can use `github:`, `gitlab:`, `bitbucket:` or `https://` to extend from a remote git repository.
  * 
  * @default null
 */
 theme: string,

 /**
  * Define the root directory of your application.
  * 
  * This property can be overwritten (for example, running `nuxt ./my-app/` will set the `rootDir` to the absolute path of `./my-app/` from the current/working directory.
  * It is normally not needed to configure this option.
  * 
  * @default "/<rootDir>"
 */
 rootDir: string,

 /**
  * Define the workspace directory of your application.
  * 
  * Often this is used when in a monorepo setup. Nuxt will attempt to detect your workspace directory automatically, but you can override it here.
  * It is normally not needed to configure this option.
  * 
  * @default "/<rootDir>"
 */
 workspaceDir: string,

 /**
  * Define the source directory of your Nuxt application.
  * 
  * If a relative path is specified, it will be relative to the `rootDir`.
  * 
  * @default "/<rootDir>"
  * 
  * @example
  * ```js
  * export default {
  *   srcDir: 'src/'
  * }
  * ```
  * This would work with the following folder structure:
  * ```bash
  * -| app/
  * ---| node_modules/
  * ---| nuxt.config.js
  * ---| package.json
  * ---| src/
  * ------| assets/
  * ------| components/
  * ------| layouts/
  * ------| middleware/
  * ------| pages/
  * ------| plugins/
  * ------| static/
  * ------| store/
  * ------| server/
  * ------| app.config.ts
  * ------| app.vue
  * ------| error.vue
  * ```
 */
 srcDir: string,

 /**
  * Define the server directory of your Nuxt application, where Nitro routes, middleware and plugins are kept.
  * 
  * If a relative path is specified, it will be relative to your `rootDir`.
  * 
  * @default "/<rootDir>/server"
 */
 serverDir: string,

 /**
  * Define the directory where your built Nuxt files will be placed.
  * 
  * Many tools assume that `.nuxt` is a hidden directory (because it starts with a `.`). If that is a problem, you can use this option to prevent that.
  * 
  * @default "/<rootDir>/.nuxt"
  * 
  * @example
  * ```js
  * export default {
  *   buildDir: 'nuxt-build'
  * }
  * ```
 */
 buildDir: string,

 /**
  * Used to set the modules directories for path resolving (for example, webpack's `resolveLoading`, `nodeExternals` and `postcss`).
  * 
  * The configuration path is relative to `options.rootDir` (default is current working directory).
  * Setting this field may be necessary if your project is organized as a yarn workspace-styled mono-repository.
  * 
  * @default ["/<rootDir>/node_modules","/tmp/testnitro/nuxt/packages/schema/node_modules"]
  * 
  * @example
  * ```js
  * export default {
  *   modulesDir: ['../../node_modules']
  * }
  * ```
 */
 modulesDir: Array<string>,

 /**
  * The directory where Nuxt will store the generated files when running `nuxt analyze`.
  * 
  * If a relative path is specified, it will be relative to your `rootDir`.
  * 
  * @default "/<rootDir>/.nuxt/analyze"
 */
 analyzeDir: string,

 /**
  * Whether Nuxt is running in development mode.
  * 
  * Normally, you should not need to set this.
  * 
  * @default false
 */
 dev: boolean,

 /**
  * Whether your app is being unit tested.
  * 
  * @default false
 */
 test: boolean,

 /**
  * Set to `true` to enable debug mode.
  * 
  * At the moment, it prints out hook names and timings on the server, and logs hook arguments as well in the browser.
  * 
  * @default false
 */
 debug: boolean,

 /**
  * Whether to enable rendering of HTML - either dynamically (in server mode) or at generate time. If set to `false` generated pages will have no content.
  * 
  * @default true
 */
 ssr: boolean,

 /**
  * Modules are Nuxt extensions which can extend its core functionality and add endless integrations.
  * 
  * Each module is either a string (which can refer to a package, or be a path to a file), a tuple with the module as first string and the options as a second object, or an inline module function.
  * Nuxt tries to resolve each item in the modules array using node require path (in `node_modules`) and then will be resolved from project `srcDir` if `~` alias is used.
  * 
  * 
  * @note Modules are executed sequentially so the order is important.
  * 
  * @example
  * ```js
  * modules: [
  *   // Using package name
  *   '@nuxtjs/axios',
  *   // Relative to your project srcDir
  *   '~/modules/awesome.js',
  *   // Providing options
  *   ['@nuxtjs/google-analytics', { ua: 'X1234567' }],
  *   // Inline definition
  *   function () {}
  * ]
  * ```
 */
 modules: (NuxtModule | string | [NuxtModule | string, Record<string, any>] | undefined | null | false)[],

 /**
  * Customize default directory structure used by Nuxt.
  * 
  * It is better to stick with defaults unless needed.
  * 
 */
 dir: {
  /**
   * The assets directory (aliased as `~assets` in your build).
   * 
   * @default "assets"
  */
  assets: string,

  /**
   * The layouts directory, each file of which will be auto-registered as a Nuxt layout.
   * 
   * @default "layouts"
  */
  layouts: string,

  /**
   * The middleware directory, each file of which will be auto-registered as a Nuxt middleware.
   * 
   * @default "middleware"
  */
  middleware: string,

  /**
   * The modules directory, each file in which will be auto-registered as a Nuxt module.
   * 
   * @default "modules"
  */
  modules: string,

  /**
   * The directory which will be processed to auto-generate your application page routes.
   * 
   * @default "pages"
  */
  pages: string,

  /**
   * The plugins directory, each file of which will be auto-registered as a Nuxt plugin.
   * 
   * @default "plugins"
  */
  plugins: string,

  /**
   * The directory containing your static files, which will be directly accessible via the Nuxt server and copied across into your `dist` folder when your app is generated.
   * 
   * @default "public"
  */
  public: string,

  /**
   * @default "public"
   * 
   * @deprecated use `dir.public` option instead
  */
  static: string,
 },

 /**
  * The extensions that should be resolved by the Nuxt resolver.
  * 
  * @default [".js",".jsx",".mjs",".ts",".tsx",".vue"]
 */
 extensions: Array<string>,

 /**
  * You can improve your DX by defining additional aliases to access custom directories within your JavaScript and CSS.
  * 
  * 
  * @note Within a webpack context (image sources, CSS - but not JavaScript) you _must_ access
  * your alias by prefixing it with `~`.
  * 
  * @note These aliases will be automatically added to the generated `.nuxt/tsconfig.json` so you can get full
  * type support and path auto-complete. In case you need to extend options provided by `./.nuxt/tsconfig.json`
  * further, make sure to add them here or within the `typescript.tsConfig` property in `nuxt.config`.
  * 
  * @example
  * ```js
  * export default {
  *   alias: {
  *     'images': fileURLToPath(new URL('./assets/images', import.meta.url)),
  *     'style': fileURLToPath(new URL('./assets/style', import.meta.url)),
  *     'data': fileURLToPath(new URL('./assets/other/data', import.meta.url))
  *   }
  * }
  * ```
  * 
  * ```html
  * <template>
  *   <img src="~images/main-bg.jpg">
  * </template>
  * 
  * <script>
  * import data from 'data/test.json'
  * </script>
  * 
  * <style>
  * // Uncomment the below
  * //@import '~style/variables.scss';
  * //@import '~style/utils.scss';
  * //@import '~style/base.scss';
  * body {
  *   background-image: url('~images/main-bg.jpg');
  * }
  * </style>
  * ```
 */
 alias: Record<string, string>,

 /**
  * Pass options directly to `node-ignore` (which is used by Nuxt to ignore files).
  * 
  * 
  * @see [node-ignore](https://github.com/kaelzhang/node-ignore)
  * 
  * @example
  * ```js
  * ignoreOptions: {
  *   ignorecase: false
  * }
  * ```
 */
 ignoreOptions: any,

 /**
  * Any file in `pages/`, `layouts/`, `middleware/` or `store/` will be ignored during building if its filename starts with the prefix specified by `ignorePrefix`.
  * 
  * @default "-"
 */
 ignorePrefix: string,

 /**
  * More customizable than `ignorePrefix`: all files matching glob patterns specified inside the `ignore` array will be ignored in building.
  * 
  * @default ["**\/*.stories.{js,cts,mts,ts,jsx,tsx}","**\/*.{spec,test}.{js,cts,mts,ts,jsx,tsx}","**\/*.d.{cts,mts,ts}","**\/.{pnpm-store,vercel,netlify,output,git,cache,data}",".nuxt/analyze",".nuxt","**\/-*.*"]
 */
 ignore: Array<string>,

 /**
  * The watch property lets you define patterns that will restart the Nuxt dev server when changed.
  * 
  * It is an array of strings or regular expressions. Strings should be either absolute paths or relative to the `srcDir` (and the `srcDir` of any layers). Regular expressions will be matched against the path relative to the project `srcDir` (and the `srcDir` of any layers).
  * 
 */
 watch: Array<string | RegExp>,

 /**
  * The watchers property lets you overwrite watchers configuration in your `nuxt.config`.
  * 
 */
 watchers: {
  /**
   * An array of event types, which, when received, will cause the watcher to restart.
   * 
  */
  rewatchOnRawEvents: any,

  /**
   * `watchOptions` to pass directly to webpack.
   * 
   * 
   * @see [webpack@4 watch options](https://v4.webpack.js.org/configuration/watch/#watchoptions).
  */
  webpack: {
   /** @default 1000 */
   aggregateTimeout: number,
  },

  /**
   * Options to pass directly to `chokidar`.
   * 
   * 
   * @see [chokidar](https://github.com/paulmillr/chokidar#api)
  */
  chokidar: {
   /** @default true */
   ignoreInitial: boolean,
  },
 },

 /**
  * Hooks are listeners to Nuxt events that are typically used in modules, but are also available in `nuxt.config`.
  * 
  * Internally, hooks follow a naming pattern using colons (e.g., build:done).
  * For ease of configuration, you can also structure them as an hierarchical object in `nuxt.config` (as below).
  * 
  * 
  * @example
  * ```js'node:fs'
  * import fs from 'node:fs'
  * import path from 'node:path'
  * export default {
  *   hooks: {
  *     build: {
  *       done(builder) {
  *         const extraFilePath = path.join(
  *           builder.nuxt.options.buildDir,
  *           'extra-file'
  *         )
  *         fs.writeFileSync(extraFilePath, 'Something extra')
  *       }
  *     }
  *   }
  * }
  * ```
 */
 hooks: NuxtHooks,

 /**
  * Runtime config allows passing dynamic config and environment variables to the Nuxt app context.
  * 
  * The value of this object is accessible from server only using `useRuntimeConfig`.
  * It mainly should hold _private_ configuration which is not exposed on the frontend. This could include a reference to your API secret tokens.
  * Anything under `public` and `app` will be exposed to the frontend as well.
  * Values are automatically replaced by matching env variables at runtime, e.g. setting an environment variable `NUXT_API_KEY=my-api-key NUXT_PUBLIC_BASE_URL=/foo/` would overwrite the two values in the example below.
  * 
  * 
  * @example
  * ```js
  * export default {
  *  runtimeConfig: {
  *     apiKey: '' // Default to an empty string, automatically set at runtime using process.env.NUXT_API_KEY
  *     public: {
  *        baseURL: '' // Exposed to the frontend as well.
  *     }
  *   }
  * }
  * ```
 */
 runtimeConfig: RuntimeConfig,

 /**
  * Additional app configuration
  * 
  * For programmatic usage and type support, you can directly provide app config with this option. It will be merged with `app.config` file as default value.
  * 
 */
 appConfig: AppConfig,

 devServer: {
  /**
   * Whether to enable HTTPS.
   * 
   * @default false
   * 
   * @example
   * ```
   * export default defineNuxtConfig({
   *   devServer: {
   *     https: {
   *       key: './server.key',
   *       cert: './server.crt'
   *     }
   *   }
   * })
   * ```
  */
  https: boolean | { key: string; cert: string },

  /**
   * Dev server listening port
   * 
   * @default 3000
  */
  port: number,

  /**
   * Dev server listening host
   * 
  */
  host: any,

  /**
   * Dev server listening socket
   * 
  */
  socket: any,

  /**
   * Listening dev server URL.
   * 
   * This should not be set directly as it will always be overridden by the dev server with the full URL (for module and internal use).
   * 
   * @default "http://localhost:3000"
  */
  url: string,

  /**
   * Template to show a loading screen
   * 
  */
  loadingTemplate: (data: { loading?: string }) => string,
 },

 experimental: {
  /**
   * Set to true to generate an async entry point for the Vue bundle (for module federation support).
   * 
   * @default false
  */
  asyncEntry: boolean,

  /**
   * Enable Vue's reactivity transform
   * 
   * @default false
   * 
   * @see https://vuejs.org/guide/extras/reactivity-transform.html
   * 
   * Warning: Reactivity transform feature has been marked as deprecated in Vue 3.3 and is planned to be
   * removed from core in Vue 3.4.
   * 
   * @see https://github.com/vuejs/rfcs/discussions/369#discussioncomment-5059028
  */
  reactivityTransform: boolean,

  /**
   * Externalize `vue`, `@vue/*` and `vue-router` when building.
   * 
   * @default true
   * 
   * @see https://github.com/nuxt/nuxt/issues/13632
  */
  externalVue: boolean,

  /**
   * Tree shakes contents of client-only components from server bundle.
   * 
   * @default true
   * 
   * @see https://github.com/nuxt/framework/pull/5750
  */
  treeshakeClientOnly: boolean,

  /**
   * Emit `app:chunkError` hook when there is an error loading vite/webpack chunks.
   * 
   * By default, Nuxt will also perform a hard reload of the new route when a chunk fails to load when navigating to a new route.
   * You can disable automatic handling by setting this to `false`, or handle chunk errors manually by setting it to `manual`.
   * 
   * @default "automatic"
   * 
   * @see https://github.com/nuxt/nuxt/pull/19038
  */
  emitRouteChunkError: false | 'manual' | 'automatic',

  /**
   * By default the route object returned by the auto-imported `useRoute()` composable is kept in sync with the current page in view in `<NuxtPage>`. This is not true for `vue-router`'s exported `useRoute` or for the default `$route` object available in your Vue templates.
   * 
   * By enabling this option a mixin will be injected to keep the `$route` template object in sync with Nuxt's managed `useRoute()`.
   * 
   * @default true
  */
  templateRouteInjection: boolean,

  /**
   * Whether to restore Nuxt app state from `sessionStorage` when reloading the page after a chunk error or manual `reloadNuxtApp()` call.
   * 
   * To avoid hydration errors, it will be applied only after the Vue app has been mounted, meaning there may be a flicker on initial load.
   * Consider carefully before enabling this as it can cause unexpected behavior, and consider providing explicit keys to `useState` as auto-generated keys may not match across builds.
   * 
   * @default false
  */
  restoreState: boolean,

  /**
   * Inline styles when rendering HTML (currently vite only).
   * 
   * You can also pass a function that receives the path of a Vue component and returns a boolean indicating whether to inline the styles for that component.
   * 
   * @default true
  */
  inlineSSRStyles: boolean | ((id?: string) => boolean),

  /**
   * Turn off rendering of Nuxt scripts and JS resource hints. You can also disable scripts more granularly within `routeRules`.
   * 
   * @default false
  */
  noScripts: boolean,

  /**
   * Render JSON payloads with support for revivifying complex types.
   * 
   * @default true
  */
  renderJsonPayloads: boolean,

  /**
   * Disable vue server renderer endpoint within nitro.
   * 
   * @default false
  */
  noVueServer: boolean,

  /**
   * When this option is enabled (by default) payload of pages that are prerendered are extracted
   * 
   * @default true
  */
  payloadExtraction: boolean | undefined,

  /**
   * Whether to enable the experimental `<NuxtClientFallback>` component for rendering content on the client if there's an error in SSR.
   * 
   * @default false
  */
  clientFallback: boolean,

  /**
   * Enable cross-origin prefetch using the Speculation Rules API.
   * 
   * @default false
  */
  crossOriginPrefetch: boolean,

  /**
   * Enable View Transition API integration with client-side router.
   * 
   * @default false
   * 
   * @see https://developer.chrome.com/docs/web-platform/view-transitions
  */
  viewTransition: boolean,

  /**
   * Write early hints when using node server.
   * 
   * @default false
   * 
   * @note nginx does not support 103 Early hints in the current version.
  */
  writeEarlyHints: boolean,

  /**
   * Experimental component islands support with <NuxtIsland> and .island.vue files.
   * 
   * @default false
  */
  componentIslands: true | 'local' | 'local+remote' | false,

  /**
   * Config schema support
   * 
   * @default true
   * 
   * @see https://github.com/nuxt/nuxt/issues/15592
  */
  configSchema: boolean,

  /**
   * This enables 'Bundler' module resolution mode for TypeScript, which is the recommended setting for frameworks like Nuxt and Vite.
   * 
   * It improves type support when using modern libraries with `exports`.
   * This is only not enabled by default because it could be a breaking change for some projects.
   * See https://github.com/microsoft/TypeScript/pull/51669
   * 
   * @default false
  */
  typescriptBundlerResolution: boolean,

  /**
   * Whether or not to add a compatibility layer for modules, plugins or user code relying on the old `@vueuse/head` API.
   * 
   * This can be disabled for most Nuxt sites to reduce the client-side bundle by ~0.5kb.
   * 
   * @default false
  */
  polyfillVueUseHead: boolean,

  /**
   * Allow disabling Nuxt SSR responses by setting the `x-nuxt-no-ssr` header.
   * 
   * @default false
  */
  respectNoSSRHeader: boolean,

  /**
   * Resolve `~`, `~~`, `@` and `@@` aliases located within layers with respect to their layer source and root directories.
   * 
   * @default true
  */
  localLayerAliases: boolean,

  /**
   * Enable the new experimental typed router using [unplugin-vue-router](https://github.com/posva/unplugin-vue-router).
   * 
   * @default false
  */
  typedPages: boolean,

  /**
   * Use app manifests to respect route rules on client-side.
   * 
   * @default true
  */
  appManifest: boolean,

  /**
   * Set an alternative watcher that will be used as the watching service for Nuxt.
   * 
   * Nuxt uses 'chokidar-granular' by default, which will ignore top-level directories (like `node_modules` and `.git`) that are excluded from watching.
   * You can set this instead to `parcel` to use `@parcel/watcher`, which may improve performance in large projects or on Windows platforms.
   * You can also set this to `chokidar` to watch all files in your source directory.
   * 
   * @default "chokidar-granular"
   * 
   * @see https://github.com/paulmillr/chokidar
   * 
   * @see https://github.com/parcel-bundler/watcher
  */
  watcher: 'chokidar' | 'parcel' | 'chokidar-granular',

  /**
   * Enable native async context to be accessible for nested composables
   * 
   * @default false
   * 
   * @see https://github.com/nuxt/nuxt/pull/20918
  */
  asyncContext: boolean,

  /**
   * Use new experimental head optimisations: - Add the capo.js head plugin in order to render tags in of the head in a more performant way. - Uses the hash hydration plugin to reduce initial hydration
   * 
   * @default false
   * 
   * @see https://github.com/nuxt/nuxt/discussions/22632
  */
  headNext: boolean,

  /**
   * Allow defining `routeRules` directly within your `~/pages` directory using `defineRouteRules`.
   * 
   * Rules are converted (based on the path) and applied for server requests. For example, a rule defined in `~/pages/foo/bar.vue` will be applied to `/foo/bar` requests. A rule in `~/pages/foo/[id].vue` will be applied to `/foo/**` requests.
   * For more control, such as if you are using a custom `path` or `alias` set in the page's `definePageMeta`, you should set `routeRules` directly within your `nuxt.config`.
   * 
   * @default false
  */
  inlineRouteRules: boolean,
 },

 generate: {
  /**
   * The routes to generate.
   * 
   * If you are using the crawler, this will be only the starting point for route generation. This is often necessary when using dynamic routes.
   * It is preferred to use `nitro.prerender.routes`.
   * 
   * 
   * @example
   * ```js
   * routes: ['/users/1', '/users/2', '/users/3']
   * ```
  */
  routes: string | string[],

  /**
   * This option is no longer used. Instead, use `nitro.prerender.ignore`.
   * 
   * 
   * @deprecated
  */
  exclude: Array<any>,
 },

 /**
  * @default 3
  * 
  * @private
 */
 _majorVersion: number,

 /**
  * @default false
  * 
  * @private
 */
 _legacyGenerate: boolean,

 /**
  * @default false
  * 
  * @private
 */
 _start: boolean,

 /**
  * @default false
  * 
  * @private
 */
 _build: boolean,

 /**
  * @default false
  * 
  * @private
 */
 _generate: boolean,

 /**
  * @default false
  * 
  * @private
 */
 _prepare: boolean,

 /**
  * @default false
  * 
  * @private
 */
 _cli: boolean,

 /**
  * 
  * @private
 */
 _requiredModules: any,

 /**
  * 
  * @private
 */
 _nuxtConfigFile: any,

 /**
  * 
  * @private
 */
 _nuxtConfigFiles: Array<any>,

 /**
  * @default ""
  * 
  * @private
 */
 appDir: string,

 /**
  * 
  * @private
 */
 _installedModules: Array<any>,

 /**
  * 
  * @private
 */
 _modules: Array<any>,

 /**
  * Configuration for Nitro.
  * 
  * 
  * @see https://nitro.unjs.io/config/
 */
 nitro: NitroConfig,

 /**
  * Global route options applied to matching server routes.
  * 
  * 
  * @experimental This is an experimental feature and API may change in the future.
  * 
  * @see https://nitro.unjs.io/config/#routerules
 */
 routeRules: NitroConfig['routeRules'],

 /**
  * Nitro server handlers.
  * 
  * Each handler accepts the following options: - handler: The path to the file defining the handler. - route: The route under which the handler is available. This follows the conventions of https://github.com/unjs/radix3. - method: The HTTP method of requests that should be handled. - middleware: Specifies whether it is a middleware handler. - lazy: Specifies whether to use lazy loading to import the handler.
  * 
  * 
  * @see https://nuxt.com/docs/guide/directory-structure/server
  * 
  * @note Files from `server/api`, `server/middleware` and `server/routes` will be automatically registered by Nuxt.
  * 
  * @example
  * ```js
  * serverHandlers: [
  *   { route: '/path/foo/**:name', handler: '~/server/foohandler.ts' }
  * ]
  * ```
 */
 serverHandlers: NitroEventHandler[],

 /**
  * Nitro development-only server handlers.
  * 
  * 
  * @see https://nitro.unjs.io/guide/routing
 */
 devServerHandlers: NitroDevEventHandler[],

 postcss: {
  /**
   * Options for configuring PostCSS plugins.
   * 
   * https://postcss.org/
   * 
  */
  plugins: Record<string, any>,
 },

 router: {
  /**
   * Additional options passed to `vue-router`.
   * 
   * Note: Only JSON serializable options should be passed by nuxt config.
   * For more control, you can use `app/router.options.ts` file.
   * 
   * 
   * @see [documentation](https://router.vuejs.org/api/interfaces/routeroptions.html).
  */
  options: RouterConfigSerializable,
 },

 /**
  * Configuration for Nuxt's TypeScript integration.
  * 
 */
 typescript: {
  /**
   * TypeScript comes with certain checks to give you more safety and analysis of your program. Once you’ve converted your codebase to TypeScript, you can start enabling these checks for greater safety. [Read More](https://www.typescriptlang.org/docs/handbook/migrating-from-javascript.html#getting-stricter-checks)
   * 
   * @default true
  */
  strict: boolean,

  /**
   * Which builder types to include for your project.
   * 
   * By default Nuxt infers this based on your `builder` option (defaulting to 'vite') but you can either turn off builder environment types (with `false`) to handle this fully yourself, or opt for a 'shared' option.
   * The 'shared' option is advised for module authors, who will want to support multiple possible builders.
   * 
  */
  builder: 'vite' | 'webpack' | 'shared' | false | undefined,

  /**
   * Include parent workspace in the Nuxt project. Mostly useful for themes and module authors.
   * 
   * @default false
  */
  includeWorkspace: boolean,

  /**
   * Enable build-time type checking.
   * 
   * If set to true, this will type check in development. You can restrict this to build-time type checking by setting it to `build`. Requires to install `typescript` and `vue-tsc` as dev dependencies.
   * 
   * @default false
   * 
   * @see https://nuxt.com/docs/guide/concepts/typescript
  */
  typeCheck: boolean | 'build',

  /**
   * You can extend generated `.nuxt/tsconfig.json` using this option.
   * 
  */
  tsConfig: TSConfig,

  /**
   * Generate a `*.vue` shim.
   * 
   * We recommend instead either enabling [**Take Over Mode**](https://vuejs.org/guide/typescript/overview.html#volar-takeover-mode) or adding TypeScript Vue Plugin (Volar)** 👉 [[Download](https://marketplace.visualstudio.com/items?itemName=Vue.vscode-typescript-vue-plugin)].
   * 
   * @default true
  */
  shim: boolean,
 },

 /**
  * Configuration that will be passed directly to Vite.
  * 
  * See https://vitejs.dev/config for more information. Please note that not all vite options are supported in Nuxt.
  * 
 */
 vite: ViteConfig & { $client?: ViteConfig, $server?: ViteConfig },

 webpack: {
  /**
   * Nuxt uses `webpack-bundle-analyzer` to visualize your bundles and how to optimize them.
   * 
   * Set to `true` to enable bundle analysis, or pass an object with options: [for webpack](https://github.com/webpack-contrib/webpack-bundle-analyzer#options-for-plugin) or [for vite](https://github.com/btd/rollup-plugin-visualizer#options).
   * 
   * @default false
   * 
   * @example
   * ```js
   * analyze: {
   *   analyzerMode: 'static'
   * }
   * ```
  */
  analyze: boolean | BundleAnalyzerPlugin.Options,

  /**
   * Enable the profiler in webpackbar.
   * 
   * It is normally enabled by CLI argument `--profile`.
   * 
   * @default false
   * 
   * @see [webpackbar](https://github.com/unjs/webpackbar#profile).
  */
  profile: boolean,

  /**
   * Enables Common CSS Extraction.
   * 
   * Using [mini-css-extract-plugin](https://github.com/webpack-contrib/mini-css-extract-plugin) under the hood, your CSS will be extracted into separate files, usually one per component. This allows caching your CSS and JavaScript separately.
   * 
   * @default true
   * 
   * @example
   * ```js
   * export default {
   *   webpack: {
   *     extractCSS: true,
   *     // or
   *     extractCSS: {
   *       ignoreOrder: true
   *     }
   *   }
   * }
   * ```
   * 
   * If you want to extract all your CSS to a single file, there is a workaround for this.
   * However, note that it is not recommended to extract everything into a single file.
   * Extracting into multiple CSS files is better for caching and preload isolation. It
   * can also improve page performance by downloading and resolving only those resources
   * that are needed.
   * 
   * @example
   * ```js
   * export default {
   *   webpack: {
   *     extractCSS: true,
   *     optimization: {
   *       splitChunks: {
   *         cacheGroups: {
   *           styles: {
   *             name: 'styles',
   *             test: /\.(css|vue)$/,
   *             chunks: 'all',
   *             enforce: true
   *           }
   *         }
   *       }
   *     }
   *   }
   * }
   * ```
  */
  extractCSS: boolean | PluginOptions,

  /**
   * Enables CSS source map support (defaults to `true` in development).
   * 
   * @default false
  */
  cssSourceMap: boolean,

  /**
   * The polyfill library to load to provide URL and URLSearchParams.
   * 
   * Defaults to `'url'` ([see package](https://www.npmjs.com/package/url)).
   * 
   * @default "url"
  */
  serverURLPolyfill: string,

  /**
   * Customize bundle filenames.
   * 
   * To understand a bit more about the use of manifests, take a look at [this webpack documentation](https://webpack.js.org/guides/code-splitting/).
   * 
   * 
   * @note Be careful when using non-hashed based filenames in production
   * as most browsers will cache the asset and not detect the changes on first load.
   * 
   * This example changes fancy chunk names to numerical ids:
   * 
   * @example
   * ```js
   * filenames: {
   *   chunk: ({ isDev }) => (isDev ? '[name].js' : '[id].[contenthash].js')
   * }
   * ```
  */
  filenames: 
   Record<
     string,
     string |
     ((
       ctx: {
         nuxt: Nuxt,
         options: Nuxt['options'],
         name: string,
         isDev: boolean,
         isServer: boolean,
         isClient: boolean,
         alias: { [index: string]: string | false | string[] },
         transpile: RegExp[]
       }) => string)
   >
  ,

  /**
   * Customize the options of Nuxt's integrated webpack loaders.
   * 
  */
  loaders: {
   /**
    * See https://github.com/esbuild-kit/esbuild-loader
    * 
   */
   esbuild: Omit<LoaderOptions, 'loader'>,

   /**
    * See: https://github.com/webpack-contrib/file-loader#options
    * 
    * 
    * @default
    * ```ts
    * { esModule: false }
    * ```
   */
   file: Omit<Options, 'name'>,

   /**
    * See: https://github.com/webpack-contrib/file-loader#options
    * 
    * 
    * @default
    * ```ts
    * { esModule: false, limit: 1000  }
    * ```
   */
   fontUrl: Omit<Options, 'name'>,

   /**
    * See: https://github.com/webpack-contrib/file-loader#options
    * 
    * 
    * @default
    * ```ts
    * { esModule: false, limit: 1000  }
    * ```
   */
   imgUrl: Omit<Options, 'name'>,

   /**
    * See: https://pugjs.org/api/reference.html#options
    * 
   */
   pugPlain: Options$1,

   /**
    * See [vue-loader](https://github.com/vuejs/vue-loader) for available options.
    * 
   */
   vue: Partial<VueLoaderOptions>,

   css: {
    /** @default 0 */
    importLoaders: number,

    url: {
     filter: () => any,
    },

    /** @default false */
    esModule: boolean,
   },

   cssModules: {
    /** @default 0 */
    importLoaders: number,

    url: {
     filter: () => any,
    },

    /** @default false */
    esModule: boolean,

    modules: {
     /** @default "[local]_[hash:base64:5]" */
     localIdentName: string,
    },
   },

   /**
    * See: https://github.com/webpack-contrib/less-loader#options
    * 
   */
   less: any,

   /**
    * See: https://github.com/webpack-contrib/sass-loader#options
    * 
    * 
    * @default
    * ```ts
    * {
    *   sassOptions: {
    *     indentedSyntax: true
    *   }
    * }
    * ```
   */
   sass: Options$2,

   /**
    * See: https://github.com/webpack-contrib/sass-loader#options
    * 
   */
   scss: Options$2,

   /**
    * See: https://github.com/webpack-contrib/stylus-loader#options
    * 
   */
   stylus: any,

   vueStyle: any,
  },

  /**
   * Add webpack plugins.
   * 
   * 
   * @example
   * ```js
   * import webpack from 'webpack'
   * import { version } from './package.json'
   * // ...
   * plugins: [
   *   new webpack.DefinePlugin({
   *     'process.VERSION': version
   *   })
   * ]
   * ```
  */
  plugins: Array<any>,

  /**
   * Hard-replaces `typeof process`, `typeof window` and `typeof document` to tree-shake bundle.
   * 
   * @default false
  */
  aggressiveCodeRemoval: boolean,

  /**
   * OptimizeCSSAssets plugin options.
   * 
   * Defaults to true when `extractCSS` is enabled.
   * 
   * @default false
   * 
   * @see [css-minimizer-webpack-plugin documentation](https://github.com/webpack-contrib/css-minimizer-webpack-plugin).
  */
  optimizeCSS: false | BasePluginOptions & DefinedDefaultMinimizerAndOptions<any>,

  /**
   * Configure [webpack optimization](https://webpack.js.org/configuration/optimization/).
   * 
  */
  optimization: false | Configuration['optimization'],

  /**
   * Customize PostCSS Loader. Same options as https://github.com/webpack-contrib/postcss-loader#options
   * 
  */
  postcss: { execute?: boolean, postcssOptions: ProcessOptions, sourceMap?: boolean, implementation?: any },

  /**
   * See [webpack-dev-middleware](https://github.com/webpack/webpack-dev-middleware) for available options.
   * 
  */
  devMiddleware: Options$3<IncomingMessage, ServerResponse>,

  /**
   * See [webpack-hot-middleware](https://github.com/webpack-contrib/webpack-hot-middleware) for available options.
   * 
  */
  hotMiddleware: MiddlewareOptions & { client?: ClientOptions },

  /**
   * Set to `false` to disable the overlay provided by [FriendlyErrorsWebpackPlugin](https://github.com/nuxt/friendly-errors-webpack-plugin).
   * 
   * @default true
  */
  friendlyErrors: boolean,

  /**
   * Filters to hide build warnings.
   * 
  */
  warningIgnoreFilters: Array<(warn: WebpackError) => boolean>,

  /**
   * Configure [webpack experiments](https://webpack.js.org/configuration/experiments/)
   * 
  */
  experiments: false | Configuration['experiments'],
 },
}

/** @deprecated Extend types from `@unhead/schema` directly. This may be removed in a future minor version. */
interface HeadAugmentations extends MergeHead {
    base?: {};
    link?: {};
    meta?: {};
    style?: {};
    script?: {};
    noscript?: {};
    htmlAttrs?: {};
    bodyAttrs?: {};
}
type MetaObjectRaw = Head<HeadAugmentations>;
type MetaObject = MetaObjectRaw;
type AppHeadMetaObject = MetaObjectRaw & {
    /**
     * The character encoding in which the document is encoded => `<meta charset="<value>" />`
     * @default `'utf-8'`
     */
    charset?: string;
    /**
     * Configuration of the viewport (the area of the window in which web content can be seen),
     * mapped to => `<meta name="viewport" content="<value>" />`
     * @default `'width=device-width, initial-scale=1'`
     */
    viewport?: string;
};

type DeepPartial<T> = T extends Function ? T : T extends Record<string, any> ? {
    [P in keyof T]?: DeepPartial<T[P]>;
} : T;
type ExtractUpperChunk<T extends string> = T extends `${infer A}${infer B}` ? A extends Uppercase<A> ? B extends `${Uppercase<string>}${infer Rest}` ? B extends `${infer C}${Rest}` ? `${A}${C}${ExtractUpperChunk<Rest>}` : never : A : '' : never;
type SliceLast<T extends string> = T extends `${infer A}${infer B}` ? B extends `${infer C}${infer D}` ? D extends '' ? A : `${A}${C}${SliceLast<D>}` : '' : never;
type UpperSnakeCase<T extends string, State extends 'start' | 'lower' | 'upper' = 'start'> = T extends `${infer A}${infer B}` ? A extends Uppercase<A> ? A extends `${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 0}` ? `${A}${UpperSnakeCase<B, 'lower'>}` : State extends 'lower' | 'upper' ? B extends `${SliceLast<ExtractUpperChunk<B>>}${infer Rest}` ? SliceLast<ExtractUpperChunk<B>> extends '' ? `_${A}_${UpperSnakeCase<B, 'start'>}` : `_${A}${SliceLast<ExtractUpperChunk<B>>}_${UpperSnakeCase<Rest, 'start'>}` : B extends Uppercase<B> ? `_${A}${B}` : `_${A}${UpperSnakeCase<B, 'lower'>}` : State extends 'start' ? `${A}${UpperSnakeCase<B, 'lower'>}` : never : State extends 'start' | 'lower' ? `${Uppercase<A>}${UpperSnakeCase<B, 'lower'>}` : `_${Uppercase<A>}${UpperSnakeCase<B, 'lower'>}` : Uppercase<T>;
declare const message: unique symbol;
type RuntimeValue<T, B extends string> = T & {
    [message]?: B;
};
type Overrideable<T extends Record<string, any>, Path extends string = ''> = {
    [K in keyof T]?: K extends string ? unknown extends T[K] ? unknown : T[K] extends Record<string, unknown> ? RuntimeValue<Overrideable<T[K], `${Path}_${UpperSnakeCase<K>}`>, `You can override this value at runtime with NUXT${Path}_${UpperSnakeCase<K>}`> : RuntimeValue<T[K], `You can override this value at runtime with NUXT${Path}_${UpperSnakeCase<K>}`> : K extends number ? T[K] : never;
};
type RuntimeConfigNamespace = Record<string, unknown>;
interface PublicRuntimeConfig extends RuntimeConfigNamespace {
}
interface RuntimeConfig extends RuntimeConfigNamespace {
    app: NitroRuntimeConfigApp;
    /** Only available on the server. */
    nitro?: NitroRuntimeConfig['nitro'];
    public: PublicRuntimeConfig;
}
interface NuxtConfig extends DeepPartial<Omit<ConfigSchema, 'vite' | 'runtimeConfig'>> {
    vite?: ConfigSchema['vite'];
    runtimeConfig?: Overrideable<RuntimeConfig>;
    webpack?: DeepPartial<ConfigSchema['webpack']> & {
        $client?: DeepPartial<ConfigSchema['webpack']>;
        $server?: DeepPartial<ConfigSchema['webpack']>;
    };
    /**
     * Experimental custom config schema
     * @see https://github.com/nuxt/nuxt/issues/15592
     */
    $schema?: SchemaDefinition;
}
interface ConfigLayer<T> {
    config: T;
    cwd: string;
    configFile: string;
}
type NuxtConfigLayer = ConfigLayer<NuxtConfig & {
    srcDir: ConfigSchema['srcDir'];
    rootDir: ConfigSchema['rootDir'];
}>;
interface NuxtBuilder {
    bundle: (nuxt: Nuxt) => Promise<void>;
}
interface NuxtOptions extends Omit<ConfigSchema, 'builder' | 'webpack'> {
    sourcemap: Required<Exclude<ConfigSchema['sourcemap'], boolean>>;
    builder: '@nuxt/vite-builder' | '@nuxt/webpack-builder' | NuxtBuilder;
    webpack: ConfigSchema['webpack'] & {
        $client: ConfigSchema['webpack'];
        $server: ConfigSchema['webpack'];
    };
    _layers: NuxtConfigLayer[];
    $schema: SchemaDefinition;
}
interface ViteConfig extends Omit<UserConfig, 'publicDir'> {
    /** The path to the entrypoint for the Vite build. */
    entry?: string;
    /**
     * Options passed to @vitejs/plugin-vue.
     * @see https://github.com/vitejs/vite-plugin-vue/tree/main/packages/plugin-vue
     */
    vue?: Options$4;
    /**
     * Options passed to @vitejs/plugin-vue-jsx.
     * @see https://github.com/vitejs/vite-plugin-vue/tree/main/packages/plugin-vue-jsx
     */
    vueJsx?: Options$5;
    /**
     * Bundler for dev time server-side rendering.
     * @default 'vite-node'
     */
    devBundler?: 'vite-node' | 'legacy';
    /**
     * Warmup vite entrypoint caches on dev startup.
     */
    warmupEntry?: boolean;
    /**
     * Use environment variables or top level `server` options to configure Nuxt server.
     */
    server?: Omit<ServerOptions, 'port' | 'host'>;
    /**
     * Directly configuring the `vite.publicDir` option is not supported. Instead, set `dir.public`.
     *
     * You can read more in <https://nuxt.com/docs/api/configuration/nuxt-config#public>.
     * @deprecated
     */
    publicDir?: never;
}
interface CustomAppConfig {
    [key: string]: unknown;
}
interface AppConfigInput extends CustomAppConfig {
    /** @deprecated reserved */
    private?: never;
    /** @deprecated reserved */
    nuxt?: never;
    /** @deprecated reserved */
    nitro?: never;
    /** @deprecated reserved */
    server?: never;
}
interface NuxtAppConfig {
    head: AppHeadMetaObject;
    layoutTransition: boolean | TransitionProps;
    pageTransition: boolean | TransitionProps;
    keepalive: boolean | KeepAliveProps;
}
interface AppConfig {
    [key: string]: unknown;
}

declare const _default: {
    [x: string]: untyped_dist_types_a304c6a0.J | untyped_dist_types_a304c6a0.I;
};

export { type AppConfig, type AppConfigInput, type AppHeadMetaObject, type Component, type ComponentsDir, type ComponentsOptions, type CustomAppConfig, type GenerateAppOptions, type HeadAugmentations, type HookResult, type ImportPresetWithDeprecation, type ImportsOptions, type MetaObject, type MetaObjectRaw, type ModuleDefinition, type ModuleMeta, type ModuleOptions, type ModuleSetupReturn, type Nuxt, type NuxtAnalyzeMeta, type NuxtApp, type NuxtAppConfig, type NuxtBuilder, type NuxtCompatibility, type NuxtCompatibilityIssue, type NuxtCompatibilityIssues, type NuxtConfig, type NuxtConfigLayer, _default as NuxtConfigSchema, type NuxtHookName, type NuxtHooks, type NuxtLayout, type NuxtMiddleware, type NuxtModule, type NuxtOptions, type NuxtPage, type NuxtPlugin, type NuxtPluginTemplate, type NuxtTemplate, type NuxtTypeTemplate, type PublicRuntimeConfig, type ResolvedNuxtTemplate, type RouterConfig, type RouterConfigSerializable, type RouterOptions, type RuntimeConfig, type RuntimeValue, type ScanDir, type TSReference, type ViteConfig, type WatchEvent };
