declare const _default: import("vue").DefineComponent<{
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
}, () => import("vue").VNode<import("vue").RendererNode, import("vue").RendererElement, {
    [key: string]: any;
}>[] | import("vue").VNode<import("vue").RendererNode, import("vue").RendererElement, {
    [key: string]: any;
}> | undefined, unknown, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, "ssr-error"[], "ssr-error", import("vue").VNodeProps & import("vue").AllowedComponentProps & import("vue").ComponentCustomProps, Readonly<import("vue").ExtractPropTypes<{
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
    "onSsr-error"?: ((...args: any[]) => any) | undefined;
}, {
    fallbackTag: string;
    fallback: string;
    keepFallback: boolean;
}, {}>;
export default _default;
