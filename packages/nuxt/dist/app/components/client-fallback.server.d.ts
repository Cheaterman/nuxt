declare const NuxtClientFallbackServer: import("vue").DefineComponent<{
    uid: {
        type: StringConstructor;
    };
    fallbackTag: {
        type: StringConstructor;
        default: () => string;
    };
    fallback: {
        type: StringConstructor;
        default: () => string;
    };
    placeholder: {
        type: StringConstructor;
    };
    placeholderTag: {
        type: StringConstructor;
    };
    keepFallback: {
        type: BooleanConstructor;
        default: () => boolean;
    };
}, {
    ssrFailed: import("vue").Ref<boolean>;
    ssrVNodes: {
        getBuffer(): import("./utils").SSRBuffer;
        push(item: import("./utils").SSRBufferItem): void;
    };
} | {
    ssrFailed: boolean;
    ssrVNodes: never[];
}, unknown, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {
    'ssr-error'(_error: unknown): boolean;
}, string, import("vue").VNodeProps & import("vue").AllowedComponentProps & import("vue").ComponentCustomProps, Readonly<import("vue").ExtractPropTypes<{
    uid: {
        type: StringConstructor;
    };
    fallbackTag: {
        type: StringConstructor;
        default: () => string;
    };
    fallback: {
        type: StringConstructor;
        default: () => string;
    };
    placeholder: {
        type: StringConstructor;
    };
    placeholderTag: {
        type: StringConstructor;
    };
    keepFallback: {
        type: BooleanConstructor;
        default: () => boolean;
    };
}>> & {
    "onSsr-error"?: ((_error: unknown) => any) | undefined;
}, {
    fallbackTag: string;
    fallback: string;
    keepFallback: boolean;
}, {}>;
export default NuxtClientFallbackServer;
