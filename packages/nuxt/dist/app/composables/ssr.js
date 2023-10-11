import { setResponseStatus as _setResponseStatus, appendHeader, getRequestHeaders } from "h3";
import { useNuxtApp } from "../nuxt.js";
export function useRequestHeaders(include) {
  if (import.meta.client) {
    return {};
  }
  const event = useNuxtApp().ssrContext?.event;
  const headers = event ? getRequestHeaders(event) : {};
  if (!include) {
    return headers;
  }
  return Object.fromEntries(include.map((key) => key.toLowerCase()).filter((key) => headers[key]).map((key) => [key, headers[key]]));
}
export function useRequestEvent(nuxtApp = useNuxtApp()) {
  return nuxtApp.ssrContext?.event;
}
export function useRequestFetch() {
  if (import.meta.client) {
    return globalThis.$fetch;
  }
  const event = useNuxtApp().ssrContext?.event;
  return event?.$fetch || globalThis.$fetch;
}
export function setResponseStatus(arg1, arg2, arg3) {
  if (import.meta.client) {
    return;
  }
  if (arg1 && typeof arg1 !== "number") {
    return _setResponseStatus(arg1, arg2, arg3);
  }
  return _setResponseStatus(useRequestEvent(), arg1, arg2);
}
export function prerenderRoutes(path) {
  if (!process.server || !process.env.prerender) {
    return;
  }
  const paths = Array.isArray(path) ? path : [path];
  appendHeader(useRequestEvent(), "x-nitro-prerender", paths.map((p) => encodeURIComponent(p)).join(", "));
}
