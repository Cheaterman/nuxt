import type { Component, RendererNode } from 'vue';
/**
 * Internal utility
 * @private
 */
export declare const _wrapIf: (component: Component, props: any, slots: any) => {
    default: () => any;
};
export type SSRBuffer = SSRBufferItem[] & {
    hasAsync?: boolean;
};
export type SSRBufferItem = string | SSRBuffer | Promise<SSRBuffer>;
/**
 * create buffer retrieved from @vue/server-renderer
 * @see https://github.com/vuejs/core/blob/9617dd4b2abc07a5dc40de6e5b759e851b4d0da1/packages/server-renderer/src/render.ts#L57
 * @private
 */
export declare function createBuffer(): {
    getBuffer(): SSRBuffer;
    push(item: SSRBufferItem): void;
};
export declare function decodeHtmlEntities(html: string): string;
/**
 * helper for NuxtIsland to generate a correct array for scoped data
 */
export declare function vforToArray(source: any): any[];
/**
 * Retrieve the HTML content from an element
 * Handles `<!--[-->` Fragment elements
 * @param element the element to retrieve the HTML
 * @param withoutSlots purge all slots from the HTML string retrieved
 * @returns {string[]} An array of string which represent the content of each element. Use `.join('')` to retrieve a component vnode.el HTML
 */
export declare function getFragmentHTML(element: RendererNode | null, withoutSlots?: boolean): any[];
export declare function getSlotProps(html: string): Record<string, any>;
