import { ModuleOptions, ModuleDefinition, NuxtModule, Nuxt, ModuleMeta, NuxtConfig, NuxtOptions, SchemaDefinition, ImportPresetWithDeprecation, NuxtCompatibility, NuxtCompatibilityIssues, ComponentsDir, Component, NuxtTemplate, NuxtHooks, NuxtMiddleware, NuxtPlugin, NuxtPluginTemplate, ResolvedNuxtTemplate, NuxtTypeTemplate } from '@nuxt/schema';
import { LoadConfigOptions } from 'c12';
import { Import } from 'unimport';
import { Configuration, WebpackPluginInstance } from 'webpack';
import { UserConfig, Plugin } from 'vite';
import * as unctx_index from 'unctx/index';
import { NitroRouteConfig, NitroEventHandler, NitroDevEventHandler, Nitro } from 'nitropack';
import * as consola_dist_core from 'consola/dist/core';
import { genSafeVariableName } from 'knitwork';

/**
 * Define a Nuxt module, automatically merging defaults with user provided options, installing
 * any hooks that are provided, and calling an optional setup function for full control.
 */
declare function defineNuxtModule<OptionsT extends ModuleOptions>(definition: ModuleDefinition<OptionsT> | NuxtModule<OptionsT>): NuxtModule<OptionsT>;

/** Installs a module on a Nuxt instance. */
declare function installModule(moduleToInstall: string | NuxtModule, inlineOptions?: any, nuxt?: Nuxt): Promise<void>;
declare const normalizeModuleTranspilePath: (p: string) => string;
declare function loadNuxtModuleInstance(nuxtModule: string | NuxtModule, nuxt?: Nuxt): Promise<{
    nuxtModule: NuxtModule<any>;
    buildTimeModuleMeta: ModuleMeta;
}>;

/**
 * Check if a Nuxt module is installed by name.
 *
 * This will check both the installed modules and the modules to be installed. Note
 * that it cannot detect if a module is _going to be_ installed programmatically by another module.
 */
declare function hasNuxtModule(moduleName: string, nuxt?: Nuxt): boolean;
/**
 * Checks if a Nuxt Module is compatible with a given semver version.
 */
declare function hasNuxtModuleCompatibility(module: string | NuxtModule, semverVersion: string, nuxt?: Nuxt): Promise<boolean>;
/**
 * Get the version of a Nuxt module.
 *
 * Scans installed modules for the version, if it's not found it will attempt to load the module instance and get the version from there.
 */
declare function getNuxtModuleVersion(module: string | NuxtModule, nuxt?: Nuxt | any): Promise<string | false>;

interface LoadNuxtConfigOptions extends LoadConfigOptions<NuxtConfig> {
}
declare function loadNuxtConfig(opts: LoadNuxtConfigOptions): Promise<NuxtOptions>;

declare function extendNuxtSchema(def: SchemaDefinition | (() => SchemaDefinition)): void;

interface LoadNuxtOptions extends LoadNuxtConfigOptions {
    /** Load nuxt with development mode */
    dev?: boolean;
    /** Use lazy initialization of nuxt if set to false */
    ready?: boolean;
    /** @deprecated Use cwd option */
    rootDir?: LoadNuxtConfigOptions['cwd'];
    /** @deprecated use overrides option */
    config?: LoadNuxtConfigOptions['overrides'];
}
declare function loadNuxt(opts: LoadNuxtOptions): Promise<Nuxt>;
declare function buildNuxt(nuxt: Nuxt): Promise<any>;

declare function addImports(imports: Import | Import[]): void;
declare function addImportsDir(dirs: string | string[], opts?: {
    prepend?: boolean;
}): void;
declare function addImportsSources(presets: ImportPresetWithDeprecation | ImportPresetWithDeprecation[]): void;

interface ExtendConfigOptions {
    /**
     * Install plugin on dev
     * @default true
     */
    dev?: boolean;
    /**
     * Install plugin on build
     * @default true
     */
    build?: boolean;
    /**
     * Install plugin on server side
     * @default true
     */
    server?: boolean;
    /**
     * Install plugin on client side
     * @default true
     */
    client?: boolean;
    /**
     * Prepends the plugin to the array with `unshift()` instead of `push()`.
     */
    prepend?: boolean;
}
interface ExtendWebpackConfigOptions extends ExtendConfigOptions {
}
interface ExtendViteConfigOptions extends ExtendConfigOptions {
}
/**
 * Extend webpack config
 *
 * The fallback function might be called multiple times
 * when applying to both client and server builds.
 */
declare function extendWebpackConfig(fn: ((config: Configuration) => void), options?: ExtendWebpackConfigOptions): void;
/**
 * Extend Vite config
 */
declare function extendViteConfig(fn: ((config: UserConfig) => void), options?: ExtendViteConfigOptions): (() => void) | undefined;
/**
 * Append webpack plugin to the config.
 */
declare function addWebpackPlugin(pluginOrGetter: WebpackPluginInstance | WebpackPluginInstance[] | (() => WebpackPluginInstance | WebpackPluginInstance[]), options?: ExtendWebpackConfigOptions): void;
/**
 * Append Vite plugin to the config.
 */
declare function addVitePlugin(pluginOrGetter: Plugin | Plugin[] | (() => Plugin | Plugin[]), options?: ExtendViteConfigOptions): void;
interface AddBuildPluginFactory {
    vite?: () => Plugin | Plugin[];
    webpack?: () => WebpackPluginInstance | WebpackPluginInstance[];
}
declare function addBuildPlugin(pluginFactory: AddBuildPluginFactory, options?: ExtendConfigOptions): void;

declare function normalizeSemanticVersion(version: string): string;
/**
 * Check version constraints and return incompatibility issues as an array
 */
declare function checkNuxtCompatibility(constraints: NuxtCompatibility, nuxt?: Nuxt): Promise<NuxtCompatibilityIssues>;
/**
 * Check version constraints and throw a detailed error if has any, otherwise returns true
 */
declare function assertNuxtCompatibility(constraints: NuxtCompatibility, nuxt?: Nuxt): Promise<true>;
/**
 * Check version constraints and return true if passed, otherwise returns false
 */
declare function hasNuxtCompatibility(constraints: NuxtCompatibility, nuxt?: Nuxt): Promise<boolean>;
/**
 * Check if current nuxt instance is version 2 legacy
 */
declare function isNuxt2(nuxt?: Nuxt): any;
/**
 * Check if current nuxt instance is version 3
 */
declare function isNuxt3(nuxt?: Nuxt): any;
/**
 * Get nuxt version
 */
declare function getNuxtVersion(nuxt?: Nuxt | any): any;

/**
 * Register a directory to be scanned for components and imported only when used.
 *
 * Requires Nuxt 2.13+
 */
declare function addComponentsDir(dir: ComponentsDir): Promise<void>;
type AddComponentOptions = {
    name: string;
    filePath: string;
} & Partial<Exclude<Component, 'shortPath' | 'async' | 'level' | 'import' | 'asyncImport'>>;
/**
 * Register a component by its name and filePath.
 *
 * Requires Nuxt 2.13+
 */
declare function addComponent(opts: AddComponentOptions): Promise<void>;

/** Direct access to the Nuxt context - see https://github.com/unjs/unctx. */
declare const nuxtCtx: unctx_index.UseContext<Nuxt>;
/**
 * Get access to Nuxt instance.
 *
 * Throws an error if Nuxt instance is unavailable.
 * @example
 * ```js
 * const nuxt = useNuxt()
 * ```
 */
declare function useNuxt(): Nuxt;
/**
 * Get access to Nuxt instance.
 *
 * Returns null if Nuxt instance is unavailable.
 * @example
 * ```js
 * const nuxt = tryUseNuxt()
 * if (nuxt) {
 *  // Do something
 * }
 * ```
 */
declare function tryUseNuxt(): Nuxt | null;

/**
 * Return a filter function to filter an array of paths
 */
declare function isIgnored(pathname: string): boolean;
declare function resolveIgnorePatterns(relativePath?: string): string[];

declare function addLayout(this: any, template: NuxtTemplate | string, name?: string): void;

declare function extendPages(cb: NuxtHooks['pages:extend']): void;
interface ExtendRouteRulesOptions {
    /**
     * Override route rule config
     * @default false
     */
    override?: boolean;
}
declare function extendRouteRules(route: string, rule: NitroRouteConfig, options?: ExtendRouteRulesOptions): void;
interface AddRouteMiddlewareOptions {
    /**
     * Override existing middleware with the same name, if it exists
     * @default false
     */
    override?: boolean;
}
declare function addRouteMiddleware(input: NuxtMiddleware | NuxtMiddleware[], options?: AddRouteMiddlewareOptions): void;

/**
 * Normalize a nuxt plugin object
 */
declare function normalizePlugin(plugin: NuxtPlugin | string): NuxtPlugin;
/**
 * Registers a nuxt plugin and to the plugins array.
 *
 * Note: You can use mode or .client and .server modifiers with fileName option
 * to use plugin only in client or server side.
 *
 * Note: By default plugin is prepended to the plugins array. You can use second argument to append (push) instead.
 * @example
 * ```js
 * addPlugin({
 *   src: path.resolve(__dirname, 'templates/foo.js'),
 *   filename: 'foo.server.js' // [optional] only include in server bundle
 * })
 * ```
 */
interface AddPluginOptions {
    append?: boolean;
}
declare function addPlugin(_plugin: NuxtPlugin | string, opts?: AddPluginOptions): NuxtPlugin;
/**
 * Adds a template and registers as a nuxt plugin.
 */
declare function addPluginTemplate(plugin: NuxtPluginTemplate | string, opts?: AddPluginOptions): NuxtPlugin;

interface ResolvePathOptions {
    /** Base for resolving paths from. Default is Nuxt rootDir. */
    cwd?: string;
    /** An object of aliases. Default is Nuxt configured aliases. */
    alias?: Record<string, string>;
    /** The file extensions to try. Default is Nuxt configured extensions. */
    extensions?: string[];
}
/**
 * Resolve full path to a file or directory respecting Nuxt alias and extensions options
 *
 * If path could not be resolved, normalized input path will be returned
 */
declare function resolvePath(path: string, opts?: ResolvePathOptions): Promise<string>;
/**
 * Try to resolve first existing file in paths
 */
declare function findPath(paths: string | string[], opts?: ResolvePathOptions, pathType?: 'file' | 'dir'): Promise<string | null>;
/**
 * Resolve path aliases respecting Nuxt alias options
 */
declare function resolveAlias(path: string, alias?: Record<string, string>): string;
interface Resolver {
    resolve(...path: string[]): string;
    resolvePath(path: string, opts?: ResolvePathOptions): Promise<string>;
}
/**
 * Create a relative resolver
 */
declare function createResolver(base: string | URL): Resolver;
declare function resolveNuxtModule(base: string, paths: string[]): Promise<string[]>;
declare function resolveFiles(path: string, pattern: string | string[], opts?: {
    followSymbolicLinks?: boolean;
}): Promise<string[]>;

/**
 * Adds a nitro server handler
 *
 */
declare function addServerHandler(handler: NitroEventHandler): void;
/**
 * Adds a nitro server handler for development-only
 *
 */
declare function addDevServerHandler(handler: NitroDevEventHandler): void;
/**
 * Adds a Nitro plugin
 */
declare function addServerPlugin(plugin: string): void;
/**
 * Adds routes to be prerendered
 */
declare function addPrerenderRoutes(routes: string | string[]): void;
/**
 * Access to the Nitro instance
 *
 * **Note:** You can call `useNitro()` only after `ready` hook.
 *
 * **Note:** Changes to the Nitro instance configuration are not applied.
 * @example
 *
 * ```ts
 * nuxt.hook('ready', () => {
 *   console.log(useNitro())
 * })
 * ```
 */
declare function useNitro(): Nitro;
/**
 * Add server imports to be auto-imported by Nitro
 */
declare function addServerImports(imports: Import[]): void;
/**
 * Add directories to be scanned by Nitro
 */
declare function addServerImportsDir(dirs: string | string[], opts?: {
    prepend?: boolean;
}): void;

/**
 * Renders given template using lodash template during build into the project buildDir
 */
declare function addTemplate(_template: NuxtTemplate<any> | string): ResolvedNuxtTemplate<any>;
/**
 * Renders given types using lodash template during build into the project buildDir
 * and register them as types.
 */
declare function addTypeTemplate(_template: NuxtTypeTemplate<any>): ResolvedNuxtTemplate<any>;
/**
 * Normalize a nuxt template object
 */
declare function normalizeTemplate(template: NuxtTemplate<any> | string): ResolvedNuxtTemplate<any>;
/**
 * Trigger rebuilding Nuxt templates
 *
 * You can pass a filter within the options to selectively regenerate a subset of templates.
 */
declare function updateTemplates(options?: {
    filter?: (template: ResolvedNuxtTemplate<any>) => boolean;
}): Promise<any>;
declare function writeTypes(nuxt: Nuxt): Promise<void>;

declare const logger: consola_dist_core.ConsolaInstance;
declare function useLogger(tag?: string): consola_dist_core.ConsolaInstance;

/** @deprecated Do not use CJS utils */
interface ResolveModuleOptions {
    paths?: string | string[];
}
/** @deprecated Do not use CJS utils */
interface RequireModuleOptions extends ResolveModuleOptions {
    /** Clear the require cache (force fresh require) but only if not within `node_modules` */
    clearCache?: boolean;
    /** Automatically de-default the result of requiring the module. */
    interopDefault?: boolean;
}
/** @deprecated Do not use CJS utils */
declare function resolveModule(id: string, opts?: ResolveModuleOptions): string;
/** @deprecated Do not use CJS utils */
declare function requireModule(id: string, opts?: RequireModuleOptions): any;
/** @deprecated Do not use CJS utils */
declare function importModule(id: string, opts?: RequireModuleOptions): Promise<any>;
/** @deprecated Do not use CJS utils */
declare function tryImportModule(id: string, opts?: RequireModuleOptions): Promise<any> | undefined;
/** @deprecated Do not use CJS utils */
declare function tryRequireModule(id: string, opts?: RequireModuleOptions): any;

/**
 * Resolve a module from a given root path using an algorithm patterned on
 * the upcoming `import.meta.resolve`. It returns a file URL
 *
 * @internal
 */
declare function tryResolveModule(id: string, url?: string | string[]): Promise<string | undefined>;

/** @deprecated */
declare function compileTemplate(template: NuxtTemplate, ctx: any): Promise<string>;
/** @deprecated */
declare const templateUtils: {
    serialize: (data: any) => string;
    importName: typeof genSafeVariableName;
    importSources: (sources: string | string[], { lazy }?: {
        lazy?: boolean | undefined;
    }) => string;
};

export { type AddComponentOptions, type AddPluginOptions, type AddRouteMiddlewareOptions, type ExtendConfigOptions, type ExtendRouteRulesOptions, type ExtendViteConfigOptions, type ExtendWebpackConfigOptions, type LoadNuxtConfigOptions, type LoadNuxtOptions, type RequireModuleOptions, type ResolveModuleOptions, type ResolvePathOptions, type Resolver, addBuildPlugin, addComponent, addComponentsDir, addDevServerHandler, addImports, addImportsDir, addImportsSources, addLayout, addPlugin, addPluginTemplate, addPrerenderRoutes, addRouteMiddleware, addServerHandler, addServerImports, addServerImportsDir, addServerPlugin, addTemplate, addTypeTemplate, addVitePlugin, addWebpackPlugin, assertNuxtCompatibility, buildNuxt, checkNuxtCompatibility, compileTemplate, createResolver, defineNuxtModule, extendNuxtSchema, extendPages, extendRouteRules, extendViteConfig, extendWebpackConfig, findPath, getNuxtModuleVersion, getNuxtVersion, hasNuxtCompatibility, hasNuxtModule, hasNuxtModuleCompatibility, importModule, installModule, isIgnored, isNuxt2, isNuxt3, loadNuxt, loadNuxtConfig, loadNuxtModuleInstance, logger, normalizeModuleTranspilePath, normalizePlugin, normalizeSemanticVersion, normalizeTemplate, nuxtCtx, requireModule, resolveAlias, resolveFiles, resolveIgnorePatterns, resolveModule, resolveNuxtModule, resolvePath, templateUtils, tryImportModule, tryRequireModule, tryResolveModule, tryUseNuxt, updateTemplates, useLogger, useNitro, useNuxt, writeTypes };
