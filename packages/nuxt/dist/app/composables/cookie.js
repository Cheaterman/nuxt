import { getCurrentInstance, nextTick, onUnmounted, ref, watch } from "vue";
import { parse, serialize } from "cookie-es";
import { deleteCookie, getCookie, getRequestHeader, setCookie } from "h3";
import destr from "destr";
import { isEqual } from "ohash";
import { useNuxtApp } from "../nuxt.js";
import { useRequestEvent } from "./ssr.js";
const CookieDefaults = {
  path: "/",
  watch: true,
  decode: (val) => destr(decodeURIComponent(val)),
  encode: (val) => encodeURIComponent(typeof val === "string" ? val : JSON.stringify(val))
};
export function useCookie(name, _opts) {
  const opts = { ...CookieDefaults, ..._opts };
  const cookies = readRawCookies(opts) || {};
  const cookie = ref(cookies[name] ?? opts.default?.());
  if (import.meta.client) {
    const channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(`nuxt:cookies:${name}`);
    if (getCurrentInstance()) {
      onUnmounted(() => {
        channel?.close();
      });
    }
    const callback = () => {
      writeClientCookie(name, cookie.value, opts);
      channel?.postMessage(opts.encode(cookie.value));
    };
    let watchPaused = false;
    if (channel) {
      channel.onmessage = (event) => {
        watchPaused = true;
        cookie.value = opts.decode(event.data);
        nextTick(() => {
          watchPaused = false;
        });
      };
    }
    if (opts.watch) {
      watch(
        cookie,
        () => {
          if (watchPaused) {
            return;
          }
          callback();
        },
        { deep: opts.watch !== "shallow" }
      );
    } else {
      callback();
    }
  } else if (import.meta.server) {
    const nuxtApp = useNuxtApp();
    const writeFinalCookieValue = () => {
      if (!isEqual(cookie.value, cookies[name])) {
        writeServerCookie(useRequestEvent(nuxtApp), name, cookie.value, opts);
      }
    };
    const unhook = nuxtApp.hooks.hookOnce("app:rendered", writeFinalCookieValue);
    nuxtApp.hooks.hookOnce("app:error", () => {
      unhook();
      return writeFinalCookieValue();
    });
  }
  return cookie;
}
function readRawCookies(opts = {}) {
  if (import.meta.server) {
    return parse(getRequestHeader(useRequestEvent(), "cookie") || "", opts);
  } else if (import.meta.client) {
    return parse(document.cookie, opts);
  }
}
function serializeCookie(name, value, opts = {}) {
  if (value === null || value === void 0) {
    return serialize(name, value, { ...opts, maxAge: -1 });
  }
  return serialize(name, value, opts);
}
function writeClientCookie(name, value, opts = {}) {
  if (import.meta.client) {
    document.cookie = serializeCookie(name, value, opts);
  }
}
function writeServerCookie(event, name, value, opts = {}) {
  if (event) {
    if (value !== null && value !== void 0) {
      return setCookie(event, name, value, opts);
    }
    if (getCookie(event, name) !== void 0) {
      return deleteCookie(event, name, opts);
    }
  }
}
