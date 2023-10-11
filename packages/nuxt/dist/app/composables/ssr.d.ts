import type { H3Event } from 'h3';
import type { NuxtApp } from '../nuxt.js';
export declare function useRequestHeaders<K extends string = string>(include: K[]): {
    [key in Lowercase<K>]?: string;
};
export declare function useRequestHeaders(): Readonly<Record<string, string>>;
export declare function useRequestEvent(nuxtApp?: NuxtApp): H3Event;
export declare function useRequestFetch(): typeof global.$fetch;
export declare function setResponseStatus(event: H3Event, code?: number, message?: string): void;
/** @deprecated Pass `event` as first option. */
export declare function setResponseStatus(code: number, message?: string): void;
export declare function prerenderRoutes(path: string | string[]): void;
