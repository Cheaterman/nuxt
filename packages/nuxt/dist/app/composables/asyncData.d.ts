import type { Ref, WatchSource } from 'vue';
import type { NuxtApp } from '../nuxt.js';
export type AsyncDataRequestStatus = 'idle' | 'pending' | 'success' | 'error';
export type _Transform<Input = any, Output = any> = (input: Input) => Output;
export type PickFrom<T, K extends Array<string>> = T extends Array<any> ? T : T extends Record<string, any> ? keyof T extends K[number] ? T : K[number] extends never ? T : Pick<T, K[number]> : T;
export type KeysOf<T> = Array<T extends T ? keyof T extends string ? keyof T : never : never>;
export type KeyOfRes<Transform extends _Transform> = KeysOf<ReturnType<Transform>>;
export type MultiWatchSources = (WatchSource<unknown> | object)[];
export interface AsyncDataOptions<ResT, DataT = ResT, PickKeys extends KeysOf<DataT> = KeysOf<DataT>, DefaultT = null> {
    server?: boolean;
    lazy?: boolean;
    default?: () => DefaultT | Ref<DefaultT>;
    transform?: _Transform<ResT, DataT>;
    pick?: PickKeys;
    watch?: MultiWatchSources;
    immediate?: boolean;
}
export interface AsyncDataExecuteOptions {
    _initial?: boolean;
    /**
     * Force a refresh, even if there is already a pending request. Previous requests will
     * not be cancelled, but their result will not affect the data/pending state - and any
     * previously awaited promises will not resolve until this new request resolves.
     */
    dedupe?: boolean;
}
export interface _AsyncData<DataT, ErrorT> {
    data: Ref<DataT>;
    pending: Ref<boolean>;
    refresh: (opts?: AsyncDataExecuteOptions) => Promise<void>;
    execute: (opts?: AsyncDataExecuteOptions) => Promise<void>;
    error: Ref<ErrorT | null>;
    status: Ref<AsyncDataRequestStatus>;
}
export type AsyncData<Data, Error> = _AsyncData<Data, Error> & Promise<_AsyncData<Data, Error>>;
export declare function useAsyncData<ResT, DataE = Error, DataT = ResT, PickKeys extends KeysOf<DataT> = KeysOf<DataT>, DefaultT = null>(handler: (ctx?: NuxtApp) => Promise<ResT>, options?: AsyncDataOptions<ResT, DataT, PickKeys, DefaultT>): AsyncData<PickFrom<DataT, PickKeys> | DefaultT, DataE | null>;
export declare function useAsyncData<ResT, DataE = Error, DataT = ResT, PickKeys extends KeysOf<DataT> = KeysOf<DataT>, DefaultT = DataT>(handler: (ctx?: NuxtApp) => Promise<ResT>, options?: AsyncDataOptions<ResT, DataT, PickKeys, DefaultT>): AsyncData<PickFrom<DataT, PickKeys> | DefaultT, DataE | null>;
export declare function useAsyncData<ResT, DataE = Error, DataT = ResT, PickKeys extends KeysOf<DataT> = KeysOf<DataT>, DefaultT = null>(key: string, handler: (ctx?: NuxtApp) => Promise<ResT>, options?: AsyncDataOptions<ResT, DataT, PickKeys, DefaultT>): AsyncData<PickFrom<DataT, PickKeys> | DefaultT, DataE | null>;
export declare function useAsyncData<ResT, DataE = Error, DataT = ResT, PickKeys extends KeysOf<DataT> = KeysOf<DataT>, DefaultT = DataT>(key: string, handler: (ctx?: NuxtApp) => Promise<ResT>, options?: AsyncDataOptions<ResT, DataT, PickKeys, DefaultT>): AsyncData<PickFrom<DataT, PickKeys> | DefaultT, DataE | null>;
export declare function useLazyAsyncData<ResT, DataE = Error, DataT = ResT, PickKeys extends KeysOf<DataT> = KeysOf<DataT>, DefaultT = null>(handler: (ctx?: NuxtApp) => Promise<ResT>, options?: Omit<AsyncDataOptions<ResT, DataT, PickKeys, DefaultT>, 'lazy'>): AsyncData<PickFrom<DataT, PickKeys> | DefaultT, DataE | null>;
export declare function useLazyAsyncData<ResT, DataE = Error, DataT = ResT, PickKeys extends KeysOf<DataT> = KeysOf<DataT>, DefaultT = DataT>(handler: (ctx?: NuxtApp) => Promise<ResT>, options?: Omit<AsyncDataOptions<ResT, DataT, PickKeys, DefaultT>, 'lazy'>): AsyncData<PickFrom<DataT, PickKeys> | DefaultT, DataE | null>;
export declare function useLazyAsyncData<ResT, DataE = Error, DataT = ResT, PickKeys extends KeysOf<DataT> = KeysOf<DataT>, DefaultT = null>(key: string, handler: (ctx?: NuxtApp) => Promise<ResT>, options?: Omit<AsyncDataOptions<ResT, DataT, PickKeys, DefaultT>, 'lazy'>): AsyncData<PickFrom<DataT, PickKeys> | DefaultT, DataE | null>;
export declare function useLazyAsyncData<ResT, DataE = Error, DataT = ResT, PickKeys extends KeysOf<DataT> = KeysOf<DataT>, DefaultT = DataT>(key: string, handler: (ctx?: NuxtApp) => Promise<ResT>, options?: Omit<AsyncDataOptions<ResT, DataT, PickKeys, DefaultT>, 'lazy'>): AsyncData<PickFrom<DataT, PickKeys> | DefaultT, DataE | null>;
export declare function useNuxtData<DataT = any>(key: string): {
    data: Ref<DataT | null>;
};
export declare function refreshNuxtData(keys?: string | string[]): Promise<void>;
export declare function clearNuxtData(keys?: string | string[] | ((key: string) => boolean)): void;
