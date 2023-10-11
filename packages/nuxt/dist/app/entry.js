import { createApp, createSSRApp, nextTick } from "vue";
import { $fetch } from "ofetch";
import { baseURL } from "#build/paths.mjs";
import { applyPlugins, createNuxtApp } from "#app/nuxt";
import "#build/css";
import plugins from "#build/plugins";
import RootComponent from "#build/root-component.mjs";
import { vueAppRootContainer } from "#build/nuxt.config.mjs";
if (!globalThis.$fetch) {
  globalThis.$fetch = $fetch.create({
    baseURL: baseURL()
  });
}
let entry;
if (import.meta.server) {
  entry = async function createNuxtAppServer(ssrContext) {
    const vueApp = createApp(RootComponent);
    const nuxt = createNuxtApp({ vueApp, ssrContext });
    try {
      await applyPlugins(nuxt, plugins);
      await nuxt.hooks.callHook("app:created", vueApp);
    } catch (err) {
      await nuxt.hooks.callHook("app:error", err);
      nuxt.payload.error = nuxt.payload.error || err;
    }
    if (ssrContext?._renderResponse) {
      throw new Error("skipping render");
    }
    return vueApp;
  };
}
if (import.meta.client) {
  if (import.meta.dev && import.meta.webpackHot) {
    import.meta.webpackHot.accept();
  }
  let vueAppPromise;
  entry = async function initApp() {
    if (vueAppPromise) {
      return vueAppPromise;
    }
    const isSSR = Boolean(
      window.__NUXT__?.serverRendered || document.getElementById("__NUXT_DATA__")?.dataset.ssr === "true"
    );
    const vueApp = isSSR ? createSSRApp(RootComponent) : createApp(RootComponent);
    const nuxt = createNuxtApp({ vueApp });
    try {
      await applyPlugins(nuxt, plugins);
    } catch (err) {
      await nuxt.callHook("app:error", err);
      nuxt.payload.error = nuxt.payload.error || err;
    }
    try {
      await nuxt.hooks.callHook("app:created", vueApp);
      await nuxt.hooks.callHook("app:beforeMount", vueApp);
      vueApp.mount(vueAppRootContainer);
      await nuxt.hooks.callHook("app:mounted", vueApp);
      await nextTick();
    } catch (err) {
      await nuxt.callHook("app:error", err);
      nuxt.payload.error = nuxt.payload.error || err;
    }
    return vueApp;
  };
  vueAppPromise = entry().catch((error) => {
    console.error("Error while mounting app:", error);
  });
}
export default (ctx) => entry(ctx);
