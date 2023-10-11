import { AsyncLocalStorage } from "node:async_hooks";
import {
  createRenderer,
  getPrefetchLinks,
  getPreloadLinks,
  getRequestDependencies,
  renderResourceHeaders
} from "vue-bundle-renderer/runtime";
import { appendResponseHeader, createError, getQuery, getResponseStatus, getResponseStatusText, readBody, writeEarlyHints } from "h3";
import devalue from "@nuxt/devalue";
import { stringify, uneval } from "devalue";
import destr from "destr";
import { joinURL, withoutTrailingSlash } from "ufo";
import { renderToString as _renderToString } from "vue/server-renderer";
import { hash } from "ohash";
import { renderSSRHead } from "@unhead/ssr";
import { defineRenderHandler, getRouteRules, useRuntimeConfig, useStorage } from "#internal/nitro";
import { useNitroApp } from "#internal/nitro/app";
import { createServerHead } from "@unhead/vue";
import unheadPlugins from "#internal/unhead-plugins.mjs";
import { appHead, appRootId, appRootTag } from "#internal/nuxt.config.mjs";
import { buildAssetsURL, publicAssetsURL } from "#paths";
globalThis.__buildAssetsURL = buildAssetsURL;
globalThis.__publicAssetsURL = publicAssetsURL;
if (process.env.NUXT_ASYNC_CONTEXT && !("AsyncLocalStorage" in globalThis)) {
  globalThis.AsyncLocalStorage = AsyncLocalStorage;
}
const getClientManifest = () => import("#build/dist/server/client.manifest.mjs").then((r) => r.default || r).then((r) => typeof r === "function" ? r() : r);
const getEntryIds = () => getClientManifest().then((r) => Object.values(r).filter(
  (r2) => (
    // @ts-expect-error internal key set by CSS inlining configuration
    r2._globalCSS
  )
).map((r2) => r2.src));
const getServerEntry = () => import("#build/dist/server/server.mjs").then((r) => r.default || r);
const getSSRStyles = lazyCachedFunction(() => import("#build/dist/server/styles.mjs").then((r) => r.default || r));
const getSSRRenderer = lazyCachedFunction(async () => {
  const manifest = await getClientManifest();
  if (!manifest) {
    throw new Error("client.manifest is not available");
  }
  const createSSRApp = await getServerEntry();
  if (!createSSRApp) {
    throw new Error("Server bundle is not available");
  }
  const options = {
    manifest,
    renderToString,
    buildAssetsURL
  };
  const renderer = createRenderer(createSSRApp, options);
  async function renderToString(input, context) {
    const html = await _renderToString(input, context);
    if (import.meta.dev && process.env.NUXT_VITE_NODE_OPTIONS) {
      renderer.rendererContext.updateManifest(await getClientManifest());
    }
    return `<${appRootTag}${appRootId ? ` id="${appRootId}"` : ""}>${html}</${appRootTag}>`;
  }
  return renderer;
});
const getSPARenderer = lazyCachedFunction(async () => {
  const manifest = await getClientManifest();
  const spaTemplate = await import("#spa-template").then((r) => r.template).catch(() => "");
  const options = {
    manifest,
    renderToString: () => `<${appRootTag}${appRootId ? ` id="${appRootId}"` : ""}>${spaTemplate}</${appRootTag}>`,
    buildAssetsURL
  };
  const renderer = createRenderer(() => () => {
  }, options);
  const result = await renderer.renderToString({});
  const renderToString = (ssrContext) => {
    const config = useRuntimeConfig();
    ssrContext.modules = ssrContext.modules || /* @__PURE__ */ new Set();
    ssrContext.payload = {
      _errors: {},
      serverRendered: false,
      data: {},
      state: {}
    };
    ssrContext.config = {
      public: config.public,
      app: config.app
    };
    return Promise.resolve(result);
  };
  return {
    rendererContext: renderer.rendererContext,
    renderToString
  };
});
const payloadCache = import.meta.prerender ? useStorage("internal:nuxt:prerender:payload") : null;
const islandCache = import.meta.prerender ? useStorage("internal:nuxt:prerender:island") : null;
const islandPropCache = import.meta.prerender ? useStorage("internal:nuxt:prerender:island-props") : null;
async function getIslandContext(event) {
  let url = event.path || "";
  if (import.meta.prerender && event.path && await islandPropCache.hasItem(event.path)) {
    url = await islandPropCache.getItem(event.path);
  }
  url = url.substring("/__nuxt_island".length + 1) || "";
  const [componentName, hashId] = url.split("?")[0].split("_");
  const context = event.method === "GET" ? getQuery(event) : await readBody(event);
  const ctx = {
    url: "/",
    ...context,
    id: hashId,
    name: componentName,
    props: destr(context.props) || {},
    uid: destr(context.uid) || void 0
  };
  return ctx;
}
const PAYLOAD_URL_RE = process.env.NUXT_JSON_PAYLOADS ? /\/_payload(\.[a-zA-Z0-9]+)?.json(\?.*)?$/ : /\/_payload(\.[a-zA-Z0-9]+)?.js(\?.*)?$/;
const ROOT_NODE_REGEX = new RegExp(`^<${appRootTag}${appRootId ? ` id="${appRootId}"` : ""}>([\\s\\S]*)</${appRootTag}>$`);
const PRERENDER_NO_SSR_ROUTES = /* @__PURE__ */ new Set(["/index.html", "/200.html", "/404.html"]);
export default defineRenderHandler(async (event) => {
  const nitroApp = useNitroApp();
  const ssrError = event.path.startsWith("/__nuxt_error") ? getQuery(event) : null;
  if (ssrError && ssrError.statusCode) {
    ssrError.statusCode = parseInt(ssrError.statusCode);
  }
  if (ssrError && !("__unenv__" in event.node.req)) {
    throw createError({
      statusCode: 404,
      statusMessage: "Page Not Found: /__nuxt_error"
    });
  }
  const islandContext = process.env.NUXT_COMPONENT_ISLANDS && event.path.startsWith("/__nuxt_island") ? await getIslandContext(event) : void 0;
  if (import.meta.prerender && islandContext && event.path && await islandCache.hasItem(event.path)) {
    return islandCache.getItem(event.path);
  }
  let url = ssrError?.url || islandContext?.url || event.path;
  const isRenderingPayload = PAYLOAD_URL_RE.test(url) && !islandContext;
  if (isRenderingPayload) {
    url = url.substring(0, url.lastIndexOf("/")) || "/";
    event._path = url;
    event.node.req.url = url;
    if (import.meta.prerender && await payloadCache.hasItem(url)) {
      return payloadCache.getItem(url);
    }
  }
  const routeOptions = getRouteRules(event);
  const head = createServerHead({
    plugins: unheadPlugins
  });
  const headEntryOptions = { mode: "server" };
  head.push(appHead, headEntryOptions);
  const ssrContext = {
    url,
    event,
    runtimeConfig: useRuntimeConfig(),
    noSSR: !!process.env.NUXT_NO_SSR || event.context.nuxt?.noSSR || routeOptions.ssr === false && !islandContext || (import.meta.prerender ? PRERENDER_NO_SSR_ROUTES.has(url) : false),
    head,
    error: !!ssrError,
    nuxt: void 0,
    /* NuxtApp */
    payload: ssrError ? { error: ssrError } : {},
    _payloadReducers: {},
    islandContext
  };
  const _PAYLOAD_EXTRACTION = import.meta.prerender && process.env.NUXT_PAYLOAD_EXTRACTION && !ssrContext.noSSR && !islandContext;
  const payloadURL = _PAYLOAD_EXTRACTION ? joinURL(useRuntimeConfig().app.baseURL, url, process.env.NUXT_JSON_PAYLOADS ? "_payload.json" : "_payload.js") : void 0;
  if (import.meta.prerender) {
    ssrContext.payload.prerenderedAt = Date.now();
  }
  const renderer = process.env.NUXT_NO_SSR || ssrContext.noSSR ? await getSPARenderer() : await getSSRRenderer();
  if (process.env.NUXT_EARLY_HINTS && !isRenderingPayload && !import.meta.prerender) {
    const { link } = renderResourceHeaders({}, renderer.rendererContext);
    writeEarlyHints(event, link);
  }
  const _rendered = await renderer.renderToString(ssrContext).catch(async (error) => {
    if (ssrContext._renderResponse && error.message === "skipping render") {
      return {};
    }
    const _err = !ssrError && ssrContext.payload?.error || error;
    await ssrContext.nuxt?.hooks.callHook("app:error", _err);
    throw _err;
  });
  await ssrContext.nuxt?.hooks.callHook("app:rendered", { ssrContext, renderResult: _rendered });
  if (ssrContext._renderResponse) {
    return ssrContext._renderResponse;
  }
  if (ssrContext.payload?.error && !ssrError) {
    throw ssrContext.payload.error;
  }
  if (isRenderingPayload) {
    const response2 = renderPayloadResponse(ssrContext);
    if (import.meta.prerender) {
      await payloadCache.setItem(url, response2);
    }
    return response2;
  }
  if (_PAYLOAD_EXTRACTION) {
    appendResponseHeader(event, "x-nitro-prerender", joinURL(url, process.env.NUXT_JSON_PAYLOADS ? "_payload.json" : "_payload.js"));
    await payloadCache.setItem(withoutTrailingSlash(url), renderPayloadResponse(ssrContext));
  }
  if (process.env.NUXT_INLINE_STYLES && !islandContext) {
    const source = ssrContext.modules ?? ssrContext._registeredComponents;
    if (source) {
      for (const id of await getEntryIds()) {
        source.add(id);
      }
    }
  }
  const inlinedStyles = process.env.NUXT_INLINE_STYLES || Boolean(islandContext) ? await renderInlineStyles(ssrContext.modules ?? ssrContext._registeredComponents ?? []) : [];
  const NO_SCRIPTS = process.env.NUXT_NO_SCRIPTS || routeOptions.experimentalNoScripts;
  const { styles, scripts } = getRequestDependencies(ssrContext, renderer.rendererContext);
  if (_PAYLOAD_EXTRACTION) {
    head.push({
      link: [
        process.env.NUXT_JSON_PAYLOADS ? { rel: "preload", as: "fetch", crossorigin: "anonymous", href: payloadURL } : { rel: "modulepreload", href: payloadURL }
      ]
    }, headEntryOptions);
  }
  head.push({ style: inlinedStyles });
  head.push({
    link: Object.values(styles).map(
      (resource) => ({ rel: "stylesheet", href: renderer.rendererContext.buildAssetsURL(resource.file) })
    )
  }, headEntryOptions);
  if (!NO_SCRIPTS) {
    head.push({
      link: getPreloadLinks(ssrContext, renderer.rendererContext)
    }, headEntryOptions);
    head.push({
      link: getPrefetchLinks(ssrContext, renderer.rendererContext)
    }, headEntryOptions);
    head.push({
      script: _PAYLOAD_EXTRACTION ? process.env.NUXT_JSON_PAYLOADS ? renderPayloadJsonScript({ id: "__NUXT_DATA__", ssrContext, data: splitPayload(ssrContext).initial, src: payloadURL }) : renderPayloadScript({ ssrContext, data: splitPayload(ssrContext).initial, src: payloadURL }) : process.env.NUXT_JSON_PAYLOADS ? renderPayloadJsonScript({ id: "__NUXT_DATA__", ssrContext, data: ssrContext.payload }) : renderPayloadScript({ ssrContext, data: ssrContext.payload })
    }, {
      ...headEntryOptions,
      // this should come before another end of body scripts
      tagPosition: "bodyClose",
      tagPriority: "high"
    });
  }
  if (!routeOptions.experimentalNoScripts) {
    head.push({
      script: Object.values(scripts).map((resource) => ({
        type: resource.module ? "module" : null,
        src: renderer.rendererContext.buildAssetsURL(resource.file),
        defer: resource.module ? null : true,
        crossorigin: ""
      }))
    }, headEntryOptions);
  }
  const { headTags, bodyTags, bodyTagsOpen, htmlAttrs, bodyAttrs } = await renderSSRHead(head);
  const htmlContext = {
    island: Boolean(islandContext),
    htmlAttrs: [htmlAttrs],
    head: normalizeChunks([headTags, ssrContext.styles]),
    bodyAttrs: [bodyAttrs],
    bodyPrepend: normalizeChunks([bodyTagsOpen, ssrContext.teleports?.body]),
    body: [process.env.NUXT_COMPONENT_ISLANDS ? replaceServerOnlyComponentsSlots(ssrContext, _rendered.html) : _rendered.html],
    bodyAppend: [bodyTags]
  };
  await nitroApp.hooks.callHook("render:html", htmlContext, { event });
  if (process.env.NUXT_COMPONENT_ISLANDS && islandContext) {
    const islandHead = {
      link: [],
      style: []
    };
    for (const tag of await head.resolveTags()) {
      if (tag.tag === "link" && tag.props.rel === "stylesheet" && tag.props.href.includes("scoped") && !tag.props.href.includes("pages/")) {
        islandHead.link.push({ ...tag.props, key: "island-link-" + hash(tag.props.href) });
      }
      if (tag.tag === "style" && tag.innerHTML) {
        islandHead.style.push({ key: "island-style-" + hash(tag.innerHTML), innerHTML: tag.innerHTML });
      }
    }
    const islandResponse = {
      id: islandContext.id,
      head: islandHead,
      html: getServerComponentHTML(htmlContext.body),
      state: ssrContext.payload.state
    };
    await nitroApp.hooks.callHook("render:island", islandResponse, { event, islandContext });
    const response2 = {
      body: JSON.stringify(islandResponse, null, 2),
      statusCode: getResponseStatus(event),
      statusMessage: getResponseStatusText(event),
      headers: {
        "content-type": "application/json;charset=utf-8",
        "x-powered-by": "Nuxt"
      }
    };
    if (import.meta.prerender) {
      await islandCache.setItem(`/__nuxt_island/${islandContext.name}_${islandContext.id}`, response2);
      await islandPropCache.setItem(`/__nuxt_island/${islandContext.name}_${islandContext.id}`, event.path);
    }
    return response2;
  }
  const response = {
    body: renderHTMLDocument(htmlContext),
    statusCode: getResponseStatus(event),
    statusMessage: getResponseStatusText(event),
    headers: {
      "content-type": "text/html;charset=utf-8",
      "x-powered-by": "Nuxt"
    }
  };
  return response;
});
function lazyCachedFunction(fn) {
  let res = null;
  return () => {
    if (res === null) {
      res = fn().catch((err) => {
        res = null;
        throw err;
      });
    }
    return res;
  };
}
function normalizeChunks(chunks) {
  return chunks.filter(Boolean).map((i) => i.trim());
}
function joinTags(tags) {
  return tags.join("");
}
function joinAttrs(chunks) {
  return chunks.join(" ");
}
function renderHTMLDocument(html) {
  return `<!DOCTYPE html>
<html ${joinAttrs(html.htmlAttrs)}>
<head>${joinTags(html.head)}</head>
<body ${joinAttrs(html.bodyAttrs)}>${joinTags(html.bodyPrepend)}${joinTags(html.body)}${joinTags(html.bodyAppend)}</body>
</html>`;
}
async function renderInlineStyles(usedModules) {
  const styleMap = await getSSRStyles();
  const inlinedStyles = /* @__PURE__ */ new Set();
  for (const mod of usedModules) {
    if (mod in styleMap) {
      for (const style of await styleMap[mod]()) {
        inlinedStyles.add(style);
      }
    }
  }
  return Array.from(inlinedStyles).map((style) => ({ innerHTML: style }));
}
function renderPayloadResponse(ssrContext) {
  return {
    body: process.env.NUXT_JSON_PAYLOADS ? stringify(splitPayload(ssrContext).payload, ssrContext._payloadReducers) : `export default ${devalue(splitPayload(ssrContext).payload)}`,
    statusCode: getResponseStatus(ssrContext.event),
    statusMessage: getResponseStatusText(ssrContext.event),
    headers: {
      "content-type": process.env.NUXT_JSON_PAYLOADS ? "application/json;charset=utf-8" : "text/javascript;charset=utf-8",
      "x-powered-by": "Nuxt"
    }
  };
}
function renderPayloadJsonScript(opts) {
  const contents = opts.data ? stringify(opts.data, opts.ssrContext._payloadReducers) : "";
  const payload = {
    type: "application/json",
    id: opts.id,
    innerHTML: contents,
    "data-ssr": !(process.env.NUXT_NO_SSR || opts.ssrContext.noSSR)
  };
  if (opts.src) {
    payload["data-src"] = opts.src;
  }
  return [
    payload,
    {
      innerHTML: `window.__NUXT__={};window.__NUXT__.config=${uneval(opts.ssrContext.config)}`
    }
  ];
}
function renderPayloadScript(opts) {
  opts.data.config = opts.ssrContext.config;
  const _PAYLOAD_EXTRACTION = import.meta.prerender && process.env.NUXT_PAYLOAD_EXTRACTION && !opts.ssrContext.noSSR;
  if (_PAYLOAD_EXTRACTION) {
    return [
      {
        type: "module",
        innerHTML: `import p from "${opts.src}";window.__NUXT__={...p,...(${devalue(opts.data)})`
      }
    ];
  }
  return [
    {
      innerHTML: `window.__NUXT__=${devalue(opts.data)}`
    }
  ];
}
function splitPayload(ssrContext) {
  const { data, prerenderedAt, ...initial } = ssrContext.payload;
  return {
    initial: { ...initial, prerenderedAt },
    payload: { data, prerenderedAt }
  };
}
function getServerComponentHTML(body) {
  const match = body[0].match(ROOT_NODE_REGEX);
  return match ? match[1] : body[0];
}
const SSR_TELEPORT_MARKER = /^uid=([^;]*);slot=(.*)$/;
function replaceServerOnlyComponentsSlots(ssrContext, html) {
  const { teleports, islandContext } = ssrContext;
  if (islandContext || !teleports) {
    return html;
  }
  for (const key in teleports) {
    const match = key.match(SSR_TELEPORT_MARKER);
    if (!match) {
      continue;
    }
    const [, uid, slot] = match;
    if (!uid || !slot) {
      continue;
    }
    html = html.replace(new RegExp(`<div nuxt-ssr-component-uid="${uid}"[^>]*>((?!nuxt-ssr-slot-name="${slot}"|nuxt-ssr-component-uid)[\\s\\S])*<div [^>]*nuxt-ssr-slot-name="${slot}"[^>]*>`), (full) => {
      return full + teleports[key];
    });
  }
  return html;
}
