import { isReadonly, reactive, shallowReactive, shallowRef } from "vue";
import {
  START_LOCATION,
  createMemoryHistory,
  createRouter,
  createWebHashHistory,
  createWebHistory
} from "#vue-router";
import { createError } from "h3";
import { isEqual, withoutBase } from "ufo";
import { defineNuxtPlugin, useRuntimeConfig } from "#app/nuxt";
import { clearError, showError, useError } from "#app/composables/error";
import { navigateTo } from "#app/composables/router";
import _routes from "#build/routes";
import routerOptions from "#build/router.options";
import { globalMiddleware, namedMiddleware } from "#build/middleware";
function createCurrentLocation(base, location, renderedPath) {
  const { pathname, search, hash } = location;
  const hashPos = base.indexOf("#");
  if (hashPos > -1) {
    const slicePos = hash.includes(base.slice(hashPos)) ? base.slice(hashPos).length : 1;
    let pathFromHash = hash.slice(slicePos);
    if (pathFromHash[0] !== "/") {
      pathFromHash = "/" + pathFromHash;
    }
    return withoutBase(pathFromHash, "");
  }
  const displayedPath = withoutBase(pathname, base);
  const path = !renderedPath || isEqual(displayedPath, renderedPath, { trailingSlash: true }) ? displayedPath : renderedPath;
  return path + (path.includes("?") ? "" : search) + hash;
}
const plugin = defineNuxtPlugin({
  name: "nuxt:router",
  enforce: "pre",
  async setup(nuxtApp) {
    let routerBase = useRuntimeConfig().app.baseURL;
    if (routerOptions.hashMode && !routerBase.includes("#")) {
      routerBase += "#";
    }
    const history = routerOptions.history?.(routerBase) ?? (import.meta.client ? routerOptions.hashMode ? createWebHashHistory(routerBase) : createWebHistory(routerBase) : createMemoryHistory(routerBase));
    const routes = routerOptions.routes?.(_routes) ?? _routes;
    let startPosition;
    const initialURL = import.meta.server ? nuxtApp.ssrContext.url : createCurrentLocation(routerBase, window.location, nuxtApp.payload.path);
    const router = createRouter({
      ...routerOptions,
      scrollBehavior: (to, from, savedPosition) => {
        if (from === START_LOCATION) {
          startPosition = savedPosition;
          return;
        }
        router.options.scrollBehavior = routerOptions.scrollBehavior;
        return routerOptions.scrollBehavior?.(to, START_LOCATION, startPosition || savedPosition);
      },
      history,
      routes
    });
    nuxtApp.vueApp.use(router);
    const previousRoute = shallowRef(router.currentRoute.value);
    router.afterEach((_to, from) => {
      previousRoute.value = from;
    });
    Object.defineProperty(nuxtApp.vueApp.config.globalProperties, "previousRoute", {
      get: () => previousRoute.value
    });
    const _route = shallowRef(router.resolve(initialURL));
    const syncCurrentRoute = () => {
      _route.value = router.currentRoute.value;
    };
    nuxtApp.hook("page:finish", syncCurrentRoute);
    router.afterEach((to, from) => {
      if (to.matched[0]?.components?.default === from.matched[0]?.components?.default) {
        syncCurrentRoute();
      }
    });
    const route = {};
    for (const key in _route.value) {
      Object.defineProperty(route, key, {
        get: () => _route.value[key]
      });
    }
    nuxtApp._route = shallowReactive(route);
    nuxtApp._middleware = nuxtApp._middleware || {
      global: [],
      named: {}
    };
    const error = useError();
    try {
      if (import.meta.server) {
        await router.push(initialURL);
      }
      await router.isReady();
    } catch (error2) {
      await nuxtApp.runWithContext(() => showError(error2));
    }
    const initialLayout = nuxtApp.payload.state._layout;
    router.beforeEach(async (to, from) => {
      to.meta = reactive(to.meta);
      if (nuxtApp.isHydrating && initialLayout && !isReadonly(to.meta.layout)) {
        to.meta.layout = initialLayout;
      }
      nuxtApp._processingMiddleware = true;
      if (import.meta.client || !nuxtApp.ssrContext?.islandContext) {
        const middlewareEntries = /* @__PURE__ */ new Set([...globalMiddleware, ...nuxtApp._middleware.global]);
        for (const component of to.matched) {
          const componentMiddleware = component.meta.middleware;
          if (!componentMiddleware) {
            continue;
          }
          if (Array.isArray(componentMiddleware)) {
            for (const entry of componentMiddleware) {
              middlewareEntries.add(entry);
            }
          } else {
            middlewareEntries.add(componentMiddleware);
          }
        }
        for (const entry of middlewareEntries) {
          const middleware = typeof entry === "string" ? nuxtApp._middleware.named[entry] || await namedMiddleware[entry]?.().then((r) => r.default || r) : entry;
          if (!middleware) {
            if (import.meta.dev) {
              throw new Error(`Unknown route middleware: '${entry}'. Valid middleware: ${Object.keys(namedMiddleware).map((mw) => `'${mw}'`).join(", ")}.`);
            }
            throw new Error(`Unknown route middleware: '${entry}'.`);
          }
          const result = await nuxtApp.runWithContext(() => middleware(to, from));
          if (import.meta.server || !nuxtApp.payload.serverRendered && nuxtApp.isHydrating) {
            if (result === false || result instanceof Error) {
              const error2 = result || createError({
                statusCode: 404,
                statusMessage: `Page Not Found: ${initialURL}`
              });
              await nuxtApp.runWithContext(() => showError(error2));
              return false;
            }
          }
          if (result === true) {
            continue;
          }
          if (result || result === false) {
            return result;
          }
        }
      }
    });
    router.onError(() => {
      delete nuxtApp._processingMiddleware;
    });
    router.afterEach(async (to, _from, failure) => {
      delete nuxtApp._processingMiddleware;
      if (import.meta.client && !nuxtApp.isHydrating && error.value) {
        await nuxtApp.runWithContext(clearError);
      }
      if (import.meta.server && failure?.type === 4) {
        return;
      }
      if (to.matched.length === 0 && (!import.meta.server || !nuxtApp.ssrContext?.islandContext)) {
        await nuxtApp.runWithContext(() => showError(createError({
          statusCode: 404,
          fatal: false,
          statusMessage: `Page not found: ${to.fullPath}`
        })));
      } else if (import.meta.server && to.redirectedFrom && to.fullPath !== initialURL) {
        await nuxtApp.runWithContext(() => navigateTo(to.fullPath || "/"));
      }
    });
    nuxtApp.hooks.hookOnce("app:created", async () => {
      try {
        await router.replace({
          ...router.resolve(initialURL),
          name: void 0,
          // #4920, #4982
          force: true
        });
        router.options.scrollBehavior = routerOptions.scrollBehavior;
      } catch (error2) {
        await nuxtApp.runWithContext(() => showError(error2));
      }
    });
    return { provide: { router } };
  }
});
export default plugin;
