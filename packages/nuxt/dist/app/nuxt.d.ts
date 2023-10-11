import type { App, Ref, VNode, onErrorCaptured } from 'vue';
import type { RouteLocationNormalizedLoaded } from '#vue-router';
import type { Hookable } from 'hookable';
import type { SSRContext, createRenderer } from 'vue-bundle-renderer/runtime';
import type { H3Event } from 'h3';
import type { AppConfig, AppConfigInput, RuntimeConfig } from 'nuxt/schema';
import type { RenderResponse } from 'nitropack';
import type { MergeHead, VueHeadClient } from '@unhead/vue';
import type { NuxtIslandContext } from '../core/runtime/nitro/renderer.js';
import type { RouteMiddleware } from '../../app.js';
import type { NuxtError } from '../app/composables/error.js';
import type { AsyncDataRequestStatus } from '../app/composables/asyncData.js';
import type { NuxtAppManifestMeta } from '#app/composables';
type HookResult = Promise<void> | void;
type AppRenderedContext = {
    ssrContext: NuxtApp['ssrContext'];
    renderResult: null | Awaited<ReturnType<ReturnType<typeof createRenderer>['renderToString']>>;
};
export interface RuntimeNuxtHooks {
    'app:created': (app: App<Element>) => HookResult;
    'app:beforeMount': (app: App<Element>) => HookResult;
    'app:mounted': (app: App<Element>) => HookResult;
    'app:rendered': (ctx: AppRenderedContext) => HookResult;
    'app:redirected': () => HookResult;
    'app:suspense:resolve': (Component?: VNode) => HookResult;
    'app:error': (err: any) => HookResult;
    'app:error:cleared': (options: {
        redirect?: string;
    }) => HookResult;
    'app:chunkError': (options: {
        error: any;
    }) => HookResult;
    'app:data:refresh': (keys?: string[]) => HookResult;
    'app:manifest:update': (meta?: NuxtAppManifestMeta) => HookResult;
    'link:prefetch': (link: string) => HookResult;
    'page:start': (Component?: VNode) => HookResult;
    'page:finish': (Component?: VNode) => HookResult;
    'page:transition:start': () => HookResult;
    'page:transition:finish': (Component?: VNode) => HookResult;
    'vue:setup': () => void;
    'vue:error': (...args: Parameters<Parameters<typeof onErrorCaptured>[0]>) => HookResult;
}
export interface NuxtSSRContext extends SSRContext {
    url: string;
    event: H3Event;
    runtimeConfig: RuntimeConfig;
    noSSR: boolean;
    /** whether we are rendering an SSR error */
    error?: boolean;
    nuxt: _NuxtApp;
    payload: NuxtPayload;
    head: VueHeadClient<MergeHead>;
    /** This is used solely to render runtime config with SPA renderer. */
    config?: Pick<RuntimeConfig, 'public' | 'app'>;
    teleports?: Record<string, string>;
    islandContext?: NuxtIslandContext;
    /** @internal */
    _renderResponse?: Partial<RenderResponse>;
    /** @internal */
    _payloadReducers: Record<string, (data: any) => any>;
}
export interface NuxtPayload {
    path?: string;
    serverRendered?: boolean;
    prerenderedAt?: number;
    data: Record<string, any>;
    state: Record<string, any>;
    config?: Pick<RuntimeConfig, 'public' | 'app'>;
    error?: Error | {
        url: string;
        statusCode: number;
        statusMessage: string;
        message: string;
        description: string;
        data?: any;
    } | null;
    _errors: Record<string, NuxtError | null>;
    [key: string]: unknown;
}
interface _NuxtApp {
    vueApp: App<Element>;
    globalName: string;
    versions: Record<string, string>;
    hooks: Hookable<RuntimeNuxtHooks>;
    hook: _NuxtApp['hooks']['hook'];
    callHook: _NuxtApp['hooks']['callHook'];
    runWithContext: <T extends () => any>(fn: T) => ReturnType<T> | Promise<Awaited<ReturnType<T>>>;
    [key: string]: unknown;
    /** @internal */
    _asyncDataPromises: Record<string, Promise<any> | undefined>;
    /** @internal */
    _asyncData: Record<string, {
        data: Ref<any>;
        pending: Ref<boolean>;
        error: Ref<Error | null>;
        status: Ref<AsyncDataRequestStatus>;
    } | undefined>;
    /** @internal */
    _middleware: {
        global: RouteMiddleware[];
        named: Record<string, RouteMiddleware>;
    };
    /** @internal */
    _observer?: {
        observe: (element: Element, callback: () => void) => () => void;
    };
    /** @internal */
    _payloadCache?: Record<string, Promise<Record<string, any>> | Record<string, any> | null>;
    /** @internal */
    _appConfig: AppConfig;
    /** @internal */
    _route: RouteLocationNormalizedLoaded;
    /** @internal */
    _islandPromises?: Record<string, Promise<any>>;
    /** @internal */
    _payloadRevivers: Record<string, (data: any) => any>;
    $config: RuntimeConfig;
    isHydrating?: boolean;
    deferHydration: () => () => void | Promise<void>;
    ssrContext?: NuxtSSRContext;
    payload: NuxtPayload;
    static: {
        data: Record<string, any>;
    };
    provide: (name: string, value: any) => void;
}
export interface NuxtApp extends _NuxtApp {
}
export declare const NuxtPluginIndicator = "__nuxt_plugin";
export interface PluginMeta {
    name?: string;
    enforce?: 'pre' | 'default' | 'post';
    /**
     * This allows more granular control over plugin order and should only be used by advanced users.
     * It overrides the value of `enforce` and is used to sort plugins.
     */
    order?: number;
}
export interface PluginEnvContext {
    /**
     * This enable the plugin for islands components.
     * Require `experimental.componentsIslands`.
     * @default true
     */
    islands?: boolean;
}
export interface ResolvedPluginMeta {
    name?: string;
    parallel?: boolean;
}
export interface Plugin<Injections extends Record<string, unknown> = Record<string, unknown>> {
    (nuxt: _NuxtApp): Promise<void> | Promise<{
        provide?: Injections;
    }> | void | {
        provide?: Injections;
    };
    [NuxtPluginIndicator]?: true;
    meta?: ResolvedPluginMeta;
}
export interface ObjectPlugin<Injections extends Record<string, unknown> = Record<string, unknown>> extends PluginMeta {
    hooks?: Partial<RuntimeNuxtHooks>;
    setup?: Plugin<Injections>;
    env?: PluginEnvContext;
    /**
     * Execute plugin in parallel with other parallel plugins.
     * @default false
     */
    parallel?: boolean;
}
/** @deprecated Use `ObjectPlugin` */
export type ObjectPluginInput<Injections extends Record<string, unknown> = Record<string, unknown>> = ObjectPlugin<Injections>;
export interface CreateOptions {
    vueApp: NuxtApp['vueApp'];
    ssrContext?: NuxtApp['ssrContext'];
    globalName?: NuxtApp['globalName'];
}
export declare function createNuxtApp(options: CreateOptions): NuxtApp;
export declare function applyPlugin(nuxtApp: NuxtApp, plugin: Plugin & ObjectPlugin<any>): Promise<void>;
export declare function applyPlugins(nuxtApp: NuxtApp, plugins: Array<Plugin & ObjectPlugin<any>>): Promise<void>;
/*! @__NO_SIDE_EFFECTS__ */
export declare function defineNuxtPlugin<T extends Record<string, unknown>>(plugin: Plugin<T> | ObjectPlugin<T>): Plugin<T> & ObjectPlugin<T>;
/*! @__NO_SIDE_EFFECTS__ */
export declare const definePayloadPlugin: typeof defineNuxtPlugin;
export declare function isNuxtPlugin(plugin: unknown): boolean;
/**
 * Ensures that the setup function passed in has access to the Nuxt instance via `useNuxt`.
 * @param nuxt A Nuxt instance
 * @param setup The function to call
 */
export declare function callWithNuxt<T extends (...args: any[]) => any>(nuxt: NuxtApp | _NuxtApp, setup: T, args?: Parameters<T>): ReturnType<T> | Promise<ReturnType<T>>;
/*! @__NO_SIDE_EFFECTS__ */
/**
 * Returns the current Nuxt instance.
 */
export declare function useNuxtApp(): NuxtApp;
/*! @__NO_SIDE_EFFECTS__ */
export declare function useRuntimeConfig(): RuntimeConfig;
export declare function defineAppConfig<C extends AppConfigInput>(config: C): C;
export {};
