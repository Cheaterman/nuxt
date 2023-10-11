import { Suspense, Transition, computed, defineComponent, h, inject, mergeProps, nextTick, onMounted, provide, ref, unref } from "vue";
import { _wrapIf } from "./utils.js";
import { LayoutMetaSymbol, PageRouteSymbol } from "./injections.js";
import { useRoute } from "#app/composables/router";
import { useNuxtApp } from "#app/nuxt";
import { useRoute as useVueRouterRoute } from "#build/pages";
import layouts from "#build/layouts";
import { appLayoutTransition as defaultLayoutTransition } from "#build/nuxt.config.mjs";
const LayoutLoader = defineComponent({
  name: "LayoutLoader",
  inheritAttrs: false,
  props: {
    name: String,
    layoutProps: Object
  },
  async setup(props, context) {
    const LayoutComponent = await layouts[props.name]().then((r) => r.default || r);
    return () => h(LayoutComponent, props.layoutProps, context.slots);
  }
});
export default defineComponent({
  name: "NuxtLayout",
  inheritAttrs: false,
  props: {
    name: {
      type: [String, Boolean, Object],
      default: null
    }
  },
  setup(props, context) {
    const nuxtApp = useNuxtApp();
    const injectedRoute = inject(PageRouteSymbol);
    const route = injectedRoute === useRoute() ? useVueRouterRoute() : injectedRoute;
    const layout = computed(() => unref(props.name) ?? route.meta.layout ?? "default");
    const layoutRef = ref();
    context.expose({ layoutRef });
    const done = nuxtApp.deferHydration();
    return () => {
      const hasLayout = layout.value && layout.value in layouts;
      if (import.meta.dev && layout.value && !hasLayout && layout.value !== "default") {
        console.warn(`Invalid layout \`${layout.value}\` selected.`);
      }
      const transitionProps = route.meta.layoutTransition ?? defaultLayoutTransition;
      return _wrapIf(Transition, hasLayout && transitionProps, {
        default: () => h(Suspense, { suspensible: true, onResolve: () => {
          nextTick(done);
        } }, {
          default: () => h(
            // @ts-expect-error seems to be an issue in vue types
            LayoutProvider,
            {
              layoutProps: mergeProps(context.attrs, { ref: layoutRef }),
              key: layout.value,
              name: layout.value,
              shouldProvide: !props.name,
              hasTransition: !!transitionProps
            },
            context.slots
          )
        })
      }).default();
    };
  }
});
const LayoutProvider = defineComponent({
  name: "NuxtLayoutProvider",
  inheritAttrs: false,
  props: {
    name: {
      type: [String, Boolean]
    },
    layoutProps: {
      type: Object
    },
    hasTransition: {
      type: Boolean
    },
    shouldProvide: {
      type: Boolean
    }
  },
  setup(props, context) {
    const name = props.name;
    if (props.shouldProvide) {
      provide(LayoutMetaSymbol, {
        isCurrent: (route) => name === (route.meta.layout ?? "default")
      });
    }
    let vnode;
    if (import.meta.dev && import.meta.client) {
      onMounted(() => {
        nextTick(() => {
          if (["#comment", "#text"].includes(vnode?.el?.nodeName)) {
            if (name) {
              console.warn(`[nuxt] \`${name}\` layout does not have a single root node and will cause errors when navigating between routes.`);
            } else {
              console.warn("[nuxt] `<NuxtLayout>` needs to be passed a single root node in its default slot.");
            }
          }
        });
      });
    }
    return () => {
      if (!name || typeof name === "string" && !(name in layouts)) {
        if (import.meta.dev && import.meta.client && props.hasTransition) {
          vnode = context.slots.default?.();
          return vnode;
        }
        return context.slots.default?.();
      }
      if (import.meta.dev && import.meta.client && props.hasTransition) {
        vnode = h(
          // @ts-expect-error seems to be an issue in vue types
          LayoutLoader,
          { key: name, layoutProps: props.layoutProps, name },
          context.slots
        );
        return vnode;
      }
      return h(
        // @ts-expect-error seems to be an issue in vue types
        LayoutLoader,
        { key: name, layoutProps: props.layoutProps, name },
        context.slots
      );
    };
  }
});
