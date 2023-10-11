import { existsSync } from 'node:fs';
import * as vite from 'vite';
import { isFileServingAllowed } from 'vite';
import { dirname, normalize, isAbsolute, resolve as resolve$1, join, relative } from 'pathe';
import { useNuxt, logger, resolvePath, tryResolveModule, requireModule, isIgnored, addVitePlugin } from '@nuxt/kit';
import replace from '@rollup/plugin-replace';
import { resolve, findStaticImports, parseStaticImport, sanitizeFilePath } from 'mlly';
import { joinURL, parseURL, parseQuery, withoutLeadingSlash, withTrailingSlash } from 'ufo';
import { filename } from 'pathe/utils';
import { resolveTSConfig } from 'pkg-types';
import vuePlugin from '@vitejs/plugin-vue';
import viteJsxPlugin from '@vitejs/plugin-vue-jsx';
import { getPort } from 'get-port-please';
import { defu } from 'defu';
import { toNodeListener, createApp, defineEventHandler, defineLazyEventHandler, eventHandler, createError } from 'h3';
import MagicString from 'magic-string';
import { hash } from 'ohash';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createUnplugin } from 'unplugin';
import { stripLiteral } from 'strip-literal';
import { ViteNodeServer } from 'vite-node/server';
import fse from 'fs-extra';
import { normalizeViteManifest } from 'vue-bundle-renderer';
import { ExternalsDefaults, isExternal } from 'externality';
import escapeRE from 'escape-string-regexp';
import { hasTTY, isCI } from 'std-env';
import clear from 'clear';
import { walk } from 'estree-walker';
import { genObjectFromRawEntries, genImport } from 'knitwork';

const vitePreloadHelperId = "\0vite/preload-helper";
function chunkErrorPlugin(options) {
  return {
    name: "nuxt:chunk-error",
    transform(code, id) {
      if (!(id === vitePreloadHelperId || id === `${vitePreloadHelperId}.js`) || code.includes("nuxt.preloadError")) {
        return;
      }
      const s = new MagicString(code);
      s.replace(/__vitePreload/g, "___vitePreload");
      s.append(`
export const __vitePreload = (...args) => ___vitePreload(...args).catch(err => {
  const e = new Event("nuxt.preloadError");
  e.payload = err;
  window.dispatchEvent(e);
  throw err;
})`);
      return {
        code: s.toString(),
        map: options.sourcemap ? s.generateMap({ hires: true }) : void 0
      };
    }
  };
}

function uniq(arr) {
  return Array.from(new Set(arr));
}
const IS_CSS_RE = /\.(?:css|scss|sass|postcss|less|stylus|styl)(\?[^.]+)?$/;
function isCSS(file) {
  return IS_CSS_RE.test(file);
}
function hashId(id) {
  return "$id_" + hash(id);
}
function matchWithStringOrRegex(value, matcher) {
  if (typeof matcher === "string") {
    return value === matcher;
  } else if (matcher instanceof RegExp) {
    return matcher.test(value);
  }
  return false;
}

function devStyleSSRPlugin(options) {
  return {
    name: "nuxt:dev-style-ssr",
    apply: "serve",
    enforce: "post",
    transform(code, id) {
      if (!isCSS(id) || !code.includes("import.meta.hot")) {
        return;
      }
      let moduleId = id;
      if (moduleId.startsWith(options.srcDir)) {
        moduleId = moduleId.slice(options.srcDir.length);
      }
      const selectors = [joinURL(options.buildAssetsURL, moduleId), joinURL(options.buildAssetsURL, "@fs", moduleId)];
      return code + selectors.map((selector) => `
document.querySelectorAll(\`link[href="${selector}"]\`).forEach(i=>i.remove())`).join("");
    }
  };
}

const VITE_ASSET_RE = /__VITE_ASSET__|__VITE_PUBLIC_ASSET__/;
function runtimePathsPlugin(options) {
  return {
    name: "nuxt:runtime-paths-dep",
    enforce: "post",
    transform(code, id) {
      const { pathname, search } = parseURL(decodeURIComponent(pathToFileURL(id).href));
      if (isCSS(pathname)) {
        return;
      }
      if (pathname.endsWith(".vue")) {
        if (search && parseQuery(search).type === "style") {
          return;
        }
      }
      if (VITE_ASSET_RE.test(code)) {
        const s = new MagicString(code);
        s.prepend('import "#build/paths.mjs";');
        return {
          code: s.toString(),
          map: options.sourcemap ? s.generateMap({ hires: true }) : void 0
        };
      }
    }
  };
}

function typeCheckPlugin(options = {}) {
  let entry;
  return {
    name: "nuxt:type-check",
    configResolved(config) {
      const input = config.build.rollupOptions.input;
      if (input && typeof input !== "string" && !Array.isArray(input)) {
        entry = input.entry;
      }
    },
    transform(code, id) {
      if (id !== entry) {
        return;
      }
      const s = new MagicString(code);
      s.prepend('import "/@vite-plugin-checker-runtime-entry";\n');
      return {
        code: s.toString(),
        map: options.sourcemap ? s.generateMap({ hires: true }) : void 0
      };
    }
  };
}

function isVue(id, opts = {}) {
  const { search } = parseURL(decodeURIComponent(pathToFileURL(id).href));
  if (id.endsWith(".vue") && !search) {
    return true;
  }
  if (!search) {
    return false;
  }
  const query = parseQuery(search);
  if (query.nuxt_component) {
    return false;
  }
  if (query.macro && (!opts.type || opts.type.includes("script"))) {
    return true;
  }
  const type = "setup" in query ? "script" : query.type;
  if (!("vue" in query) || opts.type && !opts.type.includes(type)) {
    return false;
  }
  return true;
}
const JS_RE = /\.((c|m)?j|t)sx?$/;
function isJS(id) {
  const { pathname } = parseURL(decodeURIComponent(pathToFileURL(id).href));
  return JS_RE.test(pathname);
}

const pureAnnotationsPlugin = createUnplugin((options) => {
  const FUNCTION_RE = new RegExp(`(?<!\\/\\* #__PURE__ \\*\\/ )\\b(${options.functions.join("|")})\\s*\\(`, "g");
  const FUNCTION_RE_SINGLE = new RegExp(`(?<!\\/\\* #__PURE__ \\*\\/ )\\b(${options.functions.join("|")})\\s*\\(`);
  return {
    name: "nuxt:pure-annotations",
    enforce: "post",
    transformInclude(id) {
      return isVue(id, { type: ["script"] }) || isJS(id);
    },
    transform(code) {
      if (!FUNCTION_RE_SINGLE.test(code)) {
        return;
      }
      const s = new MagicString(code);
      const strippedCode = stripLiteral(code);
      for (const match of strippedCode.matchAll(FUNCTION_RE)) {
        s.overwrite(match.index, match.index + match[0].length, "/* #__PURE__ */ " + match[0]);
      }
      if (s.hasChanged()) {
        return {
          code: s.toString(),
          map: options.sourcemap ? s.generateMap({ hires: true }) : void 0
        };
      }
    }
  };
});

let _distDir = dirname(fileURLToPath(import.meta.url));
if (_distDir.match(/(chunks|shared)$/)) {
  _distDir = dirname(_distDir);
}
const distDir = _distDir;

function createIsExternal(viteServer, rootDir, modulesDirs) {
  const externalOpts = {
    inline: [
      /virtual:/,
      /\.ts$/,
      ...ExternalsDefaults.inline || [],
      ...Array.isArray(viteServer.config.ssr.noExternal) ? viteServer.config.ssr.noExternal : []
    ],
    external: [
      ...viteServer.config.ssr.external || [],
      /node_modules/
    ],
    resolve: {
      modules: modulesDirs,
      type: "module",
      extensions: [".ts", ".js", ".json", ".vue", ".mjs", ".jsx", ".tsx", ".wasm"]
    }
  };
  return (id) => isExternal(id, rootDir, externalOpts);
}

function transpile(envs) {
  const nuxt = useNuxt();
  const transpile2 = [];
  for (let pattern of nuxt.options.build.transpile) {
    if (typeof pattern === "function") {
      const result = pattern(envs);
      if (result) {
        pattern = result;
      }
    }
    if (typeof pattern === "string") {
      transpile2.push(new RegExp(escapeRE(normalize(pattern))));
    } else if (pattern instanceof RegExp) {
      transpile2.push(pattern);
    }
  }
  return transpile2;
}

function viteNodePlugin(ctx) {
  const invalidates = /* @__PURE__ */ new Set();
  function markInvalidate(mod) {
    if (!mod.id) {
      return;
    }
    if (invalidates.has(mod.id)) {
      return;
    }
    invalidates.add(mod.id);
    markInvalidates(mod.importers);
  }
  function markInvalidates(mods) {
    if (!mods) {
      return;
    }
    for (const mod of mods) {
      markInvalidate(mod);
    }
  }
  return {
    name: "nuxt:vite-node-server",
    enforce: "post",
    configureServer(server) {
      function invalidateVirtualModules() {
        for (const [id, mod] of server.moduleGraph.idToModuleMap) {
          if (id.startsWith("virtual:")) {
            markInvalidate(mod);
          }
        }
        for (const plugin of ctx.nuxt.options.plugins) {
          markInvalidates(server.moduleGraph.getModulesByFile(typeof plugin === "string" ? plugin : plugin.src));
        }
        for (const template of ctx.nuxt.options.build.templates) {
          markInvalidates(server.moduleGraph.getModulesByFile(template.dst));
        }
      }
      server.middlewares.use("/__nuxt_vite_node__", toNodeListener(createViteNodeApp(ctx, invalidates)));
      ctx.nuxt.hook("app:templatesGenerated", () => {
        invalidateVirtualModules();
      });
      server.watcher.on("all", (event, file) => {
        markInvalidates(server.moduleGraph.getModulesByFile(normalize(file)));
        if (event === "add" || event === "unlink") {
          invalidateVirtualModules();
        }
      });
    }
  };
}
function getManifest(ctx) {
  const css = Array.from(ctx.ssrServer.moduleGraph.urlToModuleMap.keys()).filter((i) => isCSS(i));
  const manifest = normalizeViteManifest({
    "@vite/client": {
      file: "@vite/client",
      css,
      module: true,
      isEntry: true
    },
    [ctx.entry]: {
      file: ctx.entry,
      isEntry: true,
      module: true,
      resourceType: "script"
    }
  });
  return manifest;
}
function createViteNodeApp(ctx, invalidates = /* @__PURE__ */ new Set()) {
  const app = createApp();
  app.use("/manifest", defineEventHandler(() => {
    const manifest = getManifest(ctx);
    return manifest;
  }));
  app.use("/invalidates", defineEventHandler(() => {
    const ids = Array.from(invalidates);
    invalidates.clear();
    return ids;
  }));
  app.use("/module", defineLazyEventHandler(() => {
    const viteServer = ctx.ssrServer;
    const node = new ViteNodeServer(viteServer, {
      deps: {
        inline: [
          /\/node_modules\/(.*\/)?(nuxt|nuxt3)\//,
          /^#/,
          ...transpile({ isServer: true, isDev: ctx.nuxt.options.dev })
        ]
      },
      transformMode: {
        ssr: [/.*/],
        web: []
      }
    });
    const isExternal = createIsExternal(viteServer, ctx.nuxt.options.rootDir, ctx.nuxt.options.modulesDir);
    node.shouldExternalize = async (id) => {
      const result = await isExternal(id);
      if (result?.external) {
        return resolve(result.id, { url: ctx.nuxt.options.modulesDir }).catch(() => false);
      }
      return false;
    };
    return eventHandler(async (event) => {
      const moduleId = decodeURI(event.path).substring(1);
      if (moduleId === "/") {
        throw createError({ statusCode: 400 });
      }
      if (isAbsolute(moduleId) && !isFileServingAllowed(moduleId, viteServer)) {
        throw createError({
          statusCode: 403
          /* Restricted */
        });
      }
      const module = await node.fetchModule(moduleId).catch((err) => {
        const errorData = {
          code: "VITE_ERROR",
          id: moduleId,
          stack: "",
          ...err
        };
        throw createError({ data: errorData });
      });
      return module;
    });
  }));
  return app;
}
async function initViteNodeServer(ctx) {
  const viteNodeServerOptions = {
    baseURL: `${ctx.nuxt.options.devServer.url}__nuxt_vite_node__`,
    root: ctx.nuxt.options.srcDir,
    entryPath: ctx.entry,
    base: ctx.ssrServer.config.base || "/_nuxt/"
  };
  process.env.NUXT_VITE_NODE_OPTIONS = JSON.stringify(viteNodeServerOptions);
  const serverResolvedPath = resolve$1(distDir, "runtime/vite-node.mjs");
  const manifestResolvedPath = resolve$1(distDir, "runtime/client.manifest.mjs");
  await fse.writeFile(
    resolve$1(ctx.nuxt.options.buildDir, "dist/server/server.mjs"),
    `export { default } from ${JSON.stringify(pathToFileURL(serverResolvedPath).href)}`
  );
  await fse.writeFile(
    resolve$1(ctx.nuxt.options.buildDir, "dist/server/client.manifest.mjs"),
    `export { default } from ${JSON.stringify(pathToFileURL(manifestResolvedPath).href)}`
  );
}

let duplicateCount = 0;
let lastType = null;
let lastMsg = null;
const logLevelMap = {
  silent: "silent",
  info: "info",
  verbose: "info"
};
const logLevelMapReverse = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3
};
function createViteLogger(config) {
  const loggedErrors = /* @__PURE__ */ new WeakSet();
  const canClearScreen = hasTTY && !isCI && config.clearScreen;
  const clearScreen = canClearScreen ? clear : () => {
  };
  function output(type, msg, options = {}) {
    if (typeof msg === "string" && !process.env.DEBUG) {
      if (msg.startsWith("Sourcemap") && msg.includes("node_modules")) {
        return;
      }
    }
    const sameAsLast = lastType === type && lastMsg === msg;
    if (sameAsLast) {
      duplicateCount += 1;
      clearScreen();
    } else {
      duplicateCount = 0;
      lastType = type;
      lastMsg = msg;
      if (options.clear) {
        clearScreen();
      }
    }
    if (options.error) {
      loggedErrors.add(options.error);
    }
    const prevLevel = logger.level;
    logger.level = logLevelMapReverse[config.logLevel || "info"];
    logger[type](msg + (sameAsLast ? ` (x${duplicateCount + 1})` : ""));
    logger.level = prevLevel;
  }
  const warnedMessages = /* @__PURE__ */ new Set();
  const viteLogger = {
    hasWarned: false,
    info(msg, opts) {
      output("info", msg, opts);
    },
    warn(msg, opts) {
      viteLogger.hasWarned = true;
      output("warn", msg, opts);
    },
    warnOnce(msg, opts) {
      if (warnedMessages.has(msg)) {
        return;
      }
      viteLogger.hasWarned = true;
      output("warn", msg, opts);
      warnedMessages.add(msg);
    },
    error(msg, opts) {
      viteLogger.hasWarned = true;
      output("error", msg, opts);
    },
    clearScreen() {
      clear();
    },
    hasErrorLogged(error) {
      return loggedErrors.has(error);
    }
  };
  return viteLogger;
}

async function buildClient(ctx) {
  const clientConfig = vite.mergeConfig(ctx.config, vite.mergeConfig({
    configFile: false,
    base: ctx.nuxt.options.dev ? joinURL(ctx.nuxt.options.app.baseURL.replace(/^\.\//, "/") || "/", ctx.nuxt.options.app.buildAssetsDir) : "./",
    experimental: {
      renderBuiltUrl: (filename, { type, hostType }) => {
        if (hostType !== "js" || type === "asset") {
          return { relative: true };
        }
        return { runtime: `globalThis.__publicAssetsURL(${JSON.stringify(filename)})` };
      }
    },
    css: {
      devSourcemap: !!ctx.nuxt.options.sourcemap.client
    },
    define: {
      "process.env.NODE_ENV": JSON.stringify(ctx.config.mode),
      "process.server": false,
      "process.client": true,
      "process.browser": true,
      "process.nitro": false,
      "process.prerender": false,
      "import.meta.server": false,
      "import.meta.client": true,
      "import.meta.browser": true,
      "import.meta.nitro": false,
      "import.meta.prerender": false,
      "module.hot": false
    },
    optimizeDeps: {
      entries: [ctx.entry]
    },
    resolve: {
      alias: {
        "#build/plugins": resolve$1(ctx.nuxt.options.buildDir, "plugins/client"),
        "#internal/nitro": resolve$1(ctx.nuxt.options.buildDir, "nitro.client.mjs")
      },
      dedupe: [
        "vue"
      ]
    },
    cacheDir: resolve$1(ctx.nuxt.options.rootDir, "node_modules/.cache/vite", "client"),
    build: {
      sourcemap: ctx.nuxt.options.sourcemap.client ? ctx.config.build?.sourcemap ?? true : false,
      manifest: "manifest.json",
      outDir: resolve$1(ctx.nuxt.options.buildDir, "dist/client"),
      rollupOptions: {
        input: { entry: ctx.entry }
      }
    },
    plugins: [
      devStyleSSRPlugin({
        srcDir: ctx.nuxt.options.srcDir,
        buildAssetsURL: joinURL(ctx.nuxt.options.app.baseURL, ctx.nuxt.options.app.buildAssetsDir)
      }),
      runtimePathsPlugin({
        sourcemap: !!ctx.nuxt.options.sourcemap.client
      }),
      viteNodePlugin(ctx),
      pureAnnotationsPlugin.vite({
        sourcemap: !!ctx.nuxt.options.sourcemap.client,
        functions: ["defineComponent", "defineAsyncComponent", "defineNuxtLink", "createClientOnly", "defineNuxtPlugin", "defineNuxtRouteMiddleware", "defineNuxtComponent", "useRuntimeConfig", "defineRouteRules"]
      })
    ],
    appType: "custom",
    server: {
      middlewareMode: true
    }
  }, ctx.nuxt.options.vite.$client || {}));
  clientConfig.customLogger = createViteLogger(clientConfig);
  if (!ctx.nuxt.options.dev) {
    clientConfig.server.hmr = false;
  }
  if (ctx.nuxt.options.experimental.emitRouteChunkError) {
    clientConfig.plugins.push(chunkErrorPlugin({ sourcemap: !!ctx.nuxt.options.sourcemap.client }));
  }
  clientConfig.build.rollupOptions = defu(clientConfig.build.rollupOptions, {
    output: {
      chunkFileNames: ctx.nuxt.options.dev ? void 0 : withoutLeadingSlash(join(ctx.nuxt.options.app.buildAssetsDir, "[name].[hash].js")),
      entryFileNames: ctx.nuxt.options.dev ? "entry.js" : withoutLeadingSlash(join(ctx.nuxt.options.app.buildAssetsDir, "[name].[hash].js"))
    }
  });
  if (clientConfig.server && clientConfig.server.hmr !== false) {
    const hmrPortDefault = 24678;
    const hmrPort = await getPort({
      port: hmrPortDefault,
      ports: Array.from({ length: 20 }, (_, i) => hmrPortDefault + 1 + i)
    });
    clientConfig.server = defu(clientConfig.server, {
      https: ctx.nuxt.options.devServer.https,
      hmr: {
        protocol: ctx.nuxt.options.devServer.https ? "wss" : "ws",
        port: hmrPort
      }
    });
  }
  if (ctx.nuxt.options.build.analyze) {
    clientConfig.plugins.push(...await import('../chunks/analyze.mjs').then((r) => r.analyzePlugin(ctx)));
  }
  if (ctx.nuxt.options.typescript.typeCheck && ctx.nuxt.options.dev) {
    clientConfig.plugins.push(typeCheckPlugin({ sourcemap: !!ctx.nuxt.options.sourcemap.client }));
  }
  await ctx.nuxt.callHook("vite:extendConfig", clientConfig, { isClient: true, isServer: false });
  clientConfig.plugins.unshift(
    vuePlugin(clientConfig.vue),
    viteJsxPlugin(clientConfig.vueJsx)
  );
  await ctx.nuxt.callHook("vite:configResolved", clientConfig, { isClient: true, isServer: false });
  if (ctx.nuxt.options.dev) {
    const viteServer = await vite.createServer(clientConfig);
    ctx.clientServer = viteServer;
    await ctx.nuxt.callHook("vite:serverCreated", viteServer, { isClient: true, isServer: false });
    const transformHandler = viteServer.middlewares.stack.findIndex((m) => m.handle instanceof Function && m.handle.name === "viteTransformMiddleware");
    viteServer.middlewares.stack.splice(transformHandler, 0, {
      route: "",
      handle: (req, res, next) => {
        if (req._skip_transform) {
          req.url = joinURL("/__skip_vite", req.url);
        }
        next();
      }
    });
    const viteMiddleware = defineEventHandler(async (event) => {
      const viteRoutes = viteServer.middlewares.stack.map((m) => m.route).filter((r) => r.length > 1);
      if (!event.path.startsWith(clientConfig.base) && !viteRoutes.some((route) => event.path.startsWith(route))) {
        event.node.req._skip_transform = true;
      }
      const _originalPath = event.node.req.url;
      await new Promise((resolve2, reject) => {
        viteServer.middlewares.handle(event.node.req, event.node.res, (err) => {
          event.node.req.url = _originalPath;
          return err ? reject(err) : resolve2(null);
        });
      });
    });
    await ctx.nuxt.callHook("server:devHandler", viteMiddleware);
    ctx.nuxt.hook("close", async () => {
      await viteServer.close();
    });
  } else {
    logger.info("Building client...");
    const start = Date.now();
    logger.restoreAll();
    await vite.build(clientConfig);
    logger.wrapAll();
    await ctx.nuxt.callHook("vite:compiled");
    logger.success(`Client built in ${Date.now() - start}ms`);
  }
}

async function writeManifest(ctx, css = []) {
  var _a;
  const clientDist = resolve$1(ctx.nuxt.options.buildDir, "dist/client");
  const serverDist = resolve$1(ctx.nuxt.options.buildDir, "dist/server");
  const devClientManifest = {
    "@vite/client": {
      isEntry: true,
      file: "@vite/client",
      css,
      module: true,
      resourceType: "script"
    },
    [ctx.entry]: {
      isEntry: true,
      file: ctx.entry,
      module: true,
      resourceType: "script"
    }
  };
  const clientManifest = ctx.nuxt.options.dev ? devClientManifest : await fse.readJSON(resolve$1(clientDist, "manifest.json"));
  const buildAssetsDir = withTrailingSlash(withoutLeadingSlash(ctx.nuxt.options.app.buildAssetsDir));
  const BASE_RE = new RegExp(`^${escapeRE(buildAssetsDir)}`);
  for (const key in clientManifest) {
    if (clientManifest[key].file) {
      clientManifest[key].file = clientManifest[key].file.replace(BASE_RE, "");
    }
    for (const item of ["css", "assets"]) {
      if (clientManifest[key][item]) {
        clientManifest[key][item] = clientManifest[key][item].map((i) => i.replace(BASE_RE, ""));
      }
    }
  }
  await fse.mkdirp(serverDist);
  if (ctx.config.build?.cssCodeSplit === false) {
    const entryCSS = Object.values(clientManifest).find((val) => val.file?.endsWith(".css"))?.file;
    if (entryCSS) {
      const key = relative(ctx.config.root, ctx.entry);
      (_a = clientManifest[key]).css || (_a.css = []);
      clientManifest[key].css.push(entryCSS);
    }
  }
  const manifest = normalizeViteManifest(clientManifest);
  await ctx.nuxt.callHook("build:manifest", manifest);
  await fse.writeFile(resolve$1(serverDist, "client.manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
  await fse.writeFile(resolve$1(serverDist, "client.manifest.mjs"), "export default " + JSON.stringify(manifest, null, 2), "utf8");
  if (!ctx.nuxt.options.dev) {
    await fse.rm(resolve$1(clientDist, "manifest.json"), { force: true });
  }
}

async function buildServer(ctx) {
  const helper = ctx.nuxt.options.nitro.imports !== false ? "" : "globalThis.";
  const entry = ctx.nuxt.options.ssr ? ctx.entry : await resolvePath(resolve$1(ctx.nuxt.options.appDir, "entry-spa"));
  const serverConfig = vite.mergeConfig(ctx.config, vite.mergeConfig({
    configFile: false,
    base: ctx.nuxt.options.dev ? joinURL(ctx.nuxt.options.app.baseURL.replace(/^\.\//, "/") || "/", ctx.nuxt.options.app.buildAssetsDir) : void 0,
    experimental: {
      renderBuiltUrl: (filename, { type, hostType }) => {
        if (hostType !== "js") {
          return { relative: true };
        }
        if (type === "public") {
          return { runtime: `${helper}__publicAssetsURL(${JSON.stringify(filename)})` };
        }
        if (type === "asset") {
          const relativeFilename = filename.replace(withTrailingSlash(withoutLeadingSlash(ctx.nuxt.options.app.buildAssetsDir)), "");
          return { runtime: `${helper}__buildAssetsURL(${JSON.stringify(relativeFilename)})` };
        }
      }
    },
    css: {
      devSourcemap: !!ctx.nuxt.options.sourcemap.server
    },
    define: {
      "process.server": true,
      "process.client": false,
      "process.browser": false,
      "import.meta.server": true,
      "import.meta.client": false,
      "import.meta.browser": false,
      "typeof window": '"undefined"',
      "typeof document": '"undefined"',
      "typeof navigator": '"undefined"',
      "typeof location": '"undefined"',
      "typeof XMLHttpRequest": '"undefined"'
    },
    optimizeDeps: {
      entries: ctx.nuxt.options.ssr ? [ctx.entry] : []
    },
    resolve: {
      alias: {
        "#build/plugins": resolve$1(ctx.nuxt.options.buildDir, "plugins/server")
      }
    },
    ssr: {
      external: [
        "#internal/nitro",
        "#internal/nitro/utils"
      ],
      noExternal: [
        ...transpile({ isServer: true, isDev: ctx.nuxt.options.dev }),
        "/__vue-jsx",
        "#app",
        /^nuxt(\/|$)/,
        /(nuxt|nuxt3)\/(dist|src|app)/
      ]
    },
    cacheDir: resolve$1(ctx.nuxt.options.rootDir, "node_modules/.cache/vite", "server"),
    build: {
      // we'll display this in nitro build output
      reportCompressedSize: false,
      sourcemap: ctx.nuxt.options.sourcemap.server ? ctx.config.build?.sourcemap ?? true : false,
      outDir: resolve$1(ctx.nuxt.options.buildDir, "dist/server"),
      ssr: true,
      rollupOptions: {
        input: { server: entry },
        external: ["#internal/nitro"],
        output: {
          entryFileNames: "[name].mjs",
          format: "module",
          generatedCode: {
            constBindings: true
          }
        },
        onwarn(warning, rollupWarn) {
          if (warning.code && ["UNUSED_EXTERNAL_IMPORT"].includes(warning.code)) {
            return;
          }
          rollupWarn(warning);
        }
      }
    },
    server: {
      // https://github.com/vitest-dev/vitest/issues/229#issuecomment-1002685027
      preTransformRequests: false,
      hmr: false
    },
    plugins: [
      pureAnnotationsPlugin.vite({
        sourcemap: !!ctx.nuxt.options.sourcemap.server,
        functions: ["defineComponent", "defineAsyncComponent", "defineNuxtLink", "createClientOnly", "defineNuxtPlugin", "defineNuxtRouteMiddleware", "defineNuxtComponent", "useRuntimeConfig", "defineRouteRules"]
      })
    ]
  }, ctx.nuxt.options.vite.$server || {}));
  if (!ctx.nuxt.options.dev) {
    const nitroDependencies = await tryResolveModule("nitropack/package.json", ctx.nuxt.options.modulesDir).then((r) => import(r)).then((r) => Object.keys(r.dependencies || {})).catch(() => []);
    serverConfig.ssr.external.push(
      // explicit dependencies we use in our ssr renderer - these can be inlined (if necessary) in the nitro build
      "unhead",
      "@unhead/ssr",
      "unctx",
      "h3",
      "devalue",
      "@nuxt/devalue",
      "radix3",
      "unstorage",
      "hookable",
      ...nitroDependencies
    );
  }
  serverConfig.customLogger = createViteLogger(serverConfig);
  await ctx.nuxt.callHook("vite:extendConfig", serverConfig, { isClient: false, isServer: true });
  serverConfig.plugins.unshift(
    vuePlugin(serverConfig.vue),
    viteJsxPlugin(serverConfig.vueJsx)
  );
  await ctx.nuxt.callHook("vite:configResolved", serverConfig, { isClient: false, isServer: true });
  const onBuild = () => ctx.nuxt.callHook("vite:compiled");
  if (!ctx.nuxt.options.dev) {
    const start = Date.now();
    logger.info("Building server...");
    logger.restoreAll();
    await vite.build(serverConfig);
    logger.wrapAll();
    await writeManifest(ctx);
    await onBuild();
    logger.success(`Server built in ${Date.now() - start}ms`);
    return;
  }
  await writeManifest(ctx);
  if (!ctx.nuxt.options.ssr) {
    await onBuild();
    return;
  }
  const viteServer = await vite.createServer(serverConfig);
  ctx.ssrServer = viteServer;
  await ctx.nuxt.callHook("vite:serverCreated", viteServer, { isClient: false, isServer: true });
  ctx.nuxt.hook("close", () => viteServer.close());
  await viteServer.pluginContainer.buildStart({});
  if (ctx.config.devBundler !== "legacy") {
    await initViteNodeServer(ctx);
  } else {
    logger.info("Vite server using legacy server bundler...");
    await import('../chunks/dev-bundler.mjs').then((r) => r.initViteDevBundler(ctx, onBuild));
  }
}

const PREFIX = "virtual:nuxt:";
function virtual(vfs) {
  const extensions = ["", ".ts", ".vue", ".mjs", ".cjs", ".js", ".json"];
  const resolveWithExt = (id) => {
    for (const ext of extensions) {
      const rId = id + ext;
      if (rId in vfs) {
        return rId;
      }
    }
    return null;
  };
  return {
    name: "virtual",
    resolveId(id, importer) {
      if (process.platform === "win32" && isAbsolute(id)) {
        id = resolve$1(id);
      }
      const resolvedId = resolveWithExt(id);
      if (resolvedId) {
        return PREFIX + resolvedId;
      }
      if (importer && !isAbsolute(id)) {
        const importerNoPrefix = importer.startsWith(PREFIX) ? importer.slice(PREFIX.length) : importer;
        const importedDir = dirname(importerNoPrefix);
        const resolved = resolveWithExt(join(importedDir, id));
        if (resolved) {
          return PREFIX + resolved;
        }
      }
      return null;
    },
    load(id) {
      if (!id.startsWith(PREFIX)) {
        return null;
      }
      const idNoPrefix = id.slice(PREFIX.length);
      if (idNoPrefix in vfs) {
        return {
          code: vfs[idNoPrefix],
          map: null
        };
      }
    }
  };
}

async function warmupViteServer(server, entries, isServer) {
  const warmedUrls = /* @__PURE__ */ new Set();
  const warmup = async (url) => {
    if (warmedUrls.has(url)) {
      return;
    }
    warmedUrls.add(url);
    try {
      await server.transformRequest(url, { ssr: isServer });
    } catch (e) {
      logger.debug("Warmup for %s failed with: %s", url, e);
    }
    const mod = await server.moduleGraph.getModuleByUrl(url, isServer);
    const deps = mod?.ssrTransformResult?.deps || Array.from(mod?.importedModules || []).map((m) => m.url);
    await Promise.all(deps.map((m) => warmup(m.replace("/@id/__x00__", "\0"))));
  };
  await Promise.all(entries.map((entry) => warmup(entry)));
}

function resolveCSSOptions(nuxt) {
  const css = {
    postcss: {
      plugins: []
    }
  };
  const lastPlugins = ["autoprefixer", "cssnano"];
  css.postcss.plugins = Object.entries(nuxt.options.postcss.plugins).sort((a, b) => lastPlugins.indexOf(a[0]) - lastPlugins.indexOf(b[0])).filter(([, opts]) => opts).map(([name, opts]) => {
    const plugin = requireModule(name, {
      paths: [
        ...nuxt.options.modulesDir,
        distDir
      ]
    });
    return plugin(opts);
  });
  return css;
}

var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
const stringTypes = ["Literal", "TemplateLiteral"];
const NUXT_LIB_RE = /node_modules\/nuxt3?\//;
const SUPPORTED_EXT_RE = /\.(m?[jt]sx?|vue)/;
const composableKeysPlugin = createUnplugin((options) => {
  const composableMeta = Object.fromEntries(options.composables.map(({ name, ...meta }) => [name, meta]));
  const maxLength = Math.max(...options.composables.map(({ argumentLength }) => argumentLength));
  const keyedFunctions = new Set(options.composables.map(({ name }) => name));
  const KEYED_FUNCTIONS_RE = new RegExp(`\\b(${[...keyedFunctions].map((f) => escapeRE(f)).join("|")})\\b`);
  return {
    name: "nuxt:composable-keys",
    enforce: "post",
    transformInclude(id) {
      const { pathname, search } = parseURL(decodeURIComponent(pathToFileURL(id).href));
      return !NUXT_LIB_RE.test(pathname) && SUPPORTED_EXT_RE.test(pathname) && parseQuery(search).type !== "style" && !parseQuery(search).macro;
    },
    transform(code, id) {
      if (!KEYED_FUNCTIONS_RE.test(code)) {
        return;
      }
      const { 0: script = code, index: codeIndex = 0 } = code.match(/(?<=<script[^>]*>)[\S\s.]*?(?=<\/script>)/) || { index: 0, 0: code };
      const s = new MagicString(code);
      let imports;
      let count = 0;
      const relativeID = isAbsolute(id) ? relative(options.rootDir, id) : id;
      const { pathname: relativePathname } = parseURL(relativeID);
      const ast = this.parse(script, {
        sourceType: "module",
        ecmaVersion: "latest"
      });
      let scopeTracker = new ScopeTracker();
      const varCollector = new ScopedVarsCollector();
      walk(ast, {
        enter(_node) {
          if (_node.type === "BlockStatement") {
            scopeTracker.enterScope();
            varCollector.refresh(scopeTracker.curScopeKey);
          } else if (_node.type === "FunctionDeclaration" && _node.id) {
            varCollector.addVar(_node.id.name);
          } else if (_node.type === "VariableDeclarator") {
            varCollector.collect(_node.id);
          }
        },
        leave(_node) {
          if (_node.type === "BlockStatement") {
            scopeTracker.leaveScope();
            varCollector.refresh(scopeTracker.curScopeKey);
          }
        }
      });
      scopeTracker = new ScopeTracker();
      walk(ast, {
        enter(_node) {
          if (_node.type === "BlockStatement") {
            scopeTracker.enterScope();
          }
          if (_node.type !== "CallExpression" || _node.callee.type !== "Identifier") {
            return;
          }
          const node = _node;
          const name = "name" in node.callee && node.callee.name;
          if (!name || !keyedFunctions.has(name) || node.arguments.length >= maxLength) {
            return;
          }
          imports = imports || detectImportNames(script, composableMeta);
          if (imports.has(name)) {
            return;
          }
          const meta = composableMeta[name];
          if (varCollector.hasVar(scopeTracker.curScopeKey, name)) {
            let skip = true;
            if (meta.source) {
              skip = !matchWithStringOrRegex(relativePathname, meta.source);
            }
            if (skip) {
              return;
            }
          }
          if (node.arguments.length >= meta.argumentLength) {
            return;
          }
          switch (name) {
            case "useState":
              if (stringTypes.includes(node.arguments[0]?.type)) {
                return;
              }
              break;
            case "useFetch":
            case "useLazyFetch":
              if (stringTypes.includes(node.arguments[1]?.type)) {
                return;
              }
              break;
            case "useAsyncData":
            case "useLazyAsyncData":
              if (stringTypes.includes(node.arguments[0]?.type) || stringTypes.includes(node.arguments[node.arguments.length - 1]?.type)) {
                return;
              }
              break;
          }
          const endsWithComma = code.slice(codeIndex + node.start, codeIndex + node.end - 1).trim().endsWith(",");
          s.appendLeft(
            codeIndex + node.end - 1,
            (node.arguments.length && !endsWithComma ? ", " : "") + "'$" + hash(`${relativeID}-${++count}`) + "'"
          );
        },
        leave(_node) {
          if (_node.type === "BlockStatement") {
            scopeTracker.leaveScope();
          }
        }
      });
      if (s.hasChanged()) {
        return {
          code: s.toString(),
          map: options.sourcemap ? s.generateMap({ hires: true }) : void 0
        };
      }
    }
  };
});
class ScopeTracker {
  constructor() {
    // the top of the stack is not a part of current key, it is used for next level
    __publicField(this, "scopeIndexStack");
    __publicField(this, "curScopeKey");
    this.scopeIndexStack = [0];
    this.curScopeKey = "";
  }
  getKey() {
    return this.scopeIndexStack.slice(0, -1).join("-");
  }
  enterScope() {
    this.scopeIndexStack.push(0);
    this.curScopeKey = this.getKey();
  }
  leaveScope() {
    this.scopeIndexStack.pop();
    this.curScopeKey = this.getKey();
    this.scopeIndexStack[this.scopeIndexStack.length - 1]++;
  }
}
class ScopedVarsCollector {
  constructor() {
    __publicField(this, "curScopeKey");
    __publicField(this, "all");
    this.all = /* @__PURE__ */ new Map();
    this.curScopeKey = "";
  }
  refresh(scopeKey) {
    this.curScopeKey = scopeKey;
  }
  addVar(name) {
    let vars = this.all.get(this.curScopeKey);
    if (!vars) {
      vars = /* @__PURE__ */ new Set();
      this.all.set(this.curScopeKey, vars);
    }
    vars.add(name);
  }
  hasVar(scopeKey, name) {
    const indices = scopeKey.split("-").map(Number);
    for (let i = indices.length; i >= 0; i--) {
      if (this.all.get(indices.slice(0, i).join("-"))?.has(name)) {
        return true;
      }
    }
    return false;
  }
  collect(n) {
    const t = n.type;
    if (t === "Identifier") {
      this.addVar(n.name);
    } else if (t === "RestElement") {
      this.collect(n.argument);
    } else if (t === "AssignmentPattern") {
      this.collect(n.left);
    } else if (t === "ArrayPattern") {
      n.elements.forEach((e) => e && this.collect(e));
    } else if (t === "ObjectPattern") {
      n.properties.forEach((p) => {
        if (p.type === "RestElement") {
          this.collect(p);
        } else {
          this.collect(p.value);
        }
      });
    }
  }
}
const NUXT_IMPORT_RE = /nuxt|#app|#imports/;
function detectImportNames(code, composableMeta) {
  const imports = findStaticImports(code);
  const names = /* @__PURE__ */ new Set();
  for (const i of imports) {
    let addName = function(name) {
      const source = composableMeta[name]?.source;
      if (source && matchWithStringOrRegex(i.specifier, source)) {
        return;
      }
      names.add(name);
    };
    if (NUXT_IMPORT_RE.test(i.specifier)) {
      continue;
    }
    const { namedImports, defaultImport, namespacedImport } = parseStaticImport(i);
    for (const name in namedImports || {}) {
      addName(namedImports[name]);
    }
    if (defaultImport) {
      addName(defaultImport);
    }
    if (namespacedImport) {
      addName(namespacedImport);
    }
  }
  return names;
}

const SUPPORTED_FILES_RE = /\.(vue|((c|m)?j|t)sx?)$/;
function ssrStylesPlugin(options) {
  const cssMap = {};
  const idRefMap = {};
  const relativeToSrcDir = (path) => relative(options.srcDir, path);
  const warnCache = /* @__PURE__ */ new Set();
  const islands = options.components.filter(
    (component) => component.island || // .server components without a corresponding .client component will need to be rendered as an island
    component.mode === "server" && !options.components.some((c) => c.pascalName === component.pascalName && c.mode === "client")
  );
  return {
    name: "ssr-styles",
    resolveId: {
      order: "pre",
      async handler(id, importer, _options) {
        if (options.shouldInline === false || typeof options.shouldInline === "function" && !options.shouldInline(importer)) {
          return;
        }
        if (id === "#build/css" || id.endsWith(".vue") || isCSS(id)) {
          const res = await this.resolve(id, importer, { ..._options, skipSelf: true });
          if (res) {
            return {
              ...res,
              moduleSideEffects: false
            };
          }
        }
      }
    },
    generateBundle(outputOptions) {
      if (options.mode === "client") {
        return;
      }
      const emitted = {};
      for (const file in cssMap) {
        const { files, inBundle } = cssMap[file];
        if (!files.length || !inBundle) {
          continue;
        }
        const base = typeof outputOptions.assetFileNames === "string" ? outputOptions.assetFileNames : outputOptions.assetFileNames({
          type: "asset",
          name: `${filename(file)}-styles.mjs`,
          source: ""
        });
        const baseDir = dirname(base);
        emitted[file] = this.emitFile({
          type: "asset",
          name: `${filename(file)}-styles.mjs`,
          source: [
            ...files.map((css, i) => `import style_${i} from './${relative(baseDir, this.getFileName(css))}';`),
            `export default [${files.map((_, i) => `style_${i}`).join(", ")}]`
          ].join("\n")
        });
      }
      for (const key in emitted) {
        options.chunksWithInlinedCSS.add(key);
      }
      this.emitFile({
        type: "asset",
        fileName: "styles.mjs",
        source: [
          "const interopDefault = r => r.default || r || []",
          `export default ${genObjectFromRawEntries(
            Object.entries(emitted).map(([key, value]) => [key, `() => import('./${this.getFileName(value)}').then(interopDefault)`])
          )}`
        ].join("\n")
      });
    },
    renderChunk(_code, chunk) {
      var _a, _b;
      if (!chunk.facadeModuleId) {
        return null;
      }
      if (options.mode === "client") {
        (_a = options.clientCSSMap)[_b = chunk.facadeModuleId] || (_a[_b] = /* @__PURE__ */ new Set());
        for (const id2 of chunk.moduleIds) {
          if (isCSS(id2)) {
            options.clientCSSMap[chunk.facadeModuleId].add(id2);
          }
        }
        return;
      }
      const id = relativeToSrcDir(chunk.facadeModuleId);
      for (const file in chunk.modules) {
        const relativePath = relativeToSrcDir(file);
        if (relativePath in cssMap) {
          cssMap[relativePath].inBundle = cssMap[relativePath].inBundle ?? !!id;
        }
      }
      return null;
    },
    async transform(code, id) {
      var _a;
      if (options.mode === "client") {
        if (id === options.entry && (options.shouldInline === true || typeof options.shouldInline === "function" && options.shouldInline(id))) {
          const s = new MagicString(code);
          (_a = options.clientCSSMap)[id] || (_a[id] = /* @__PURE__ */ new Set());
          for (const file of options.globalCSS) {
            const resolved = await this.resolve(file) ?? await this.resolve(file, id);
            const res = await this.resolve(file + "?inline&used") ?? await this.resolve(file + "?inline&used", id);
            if (!resolved || !res) {
              if (!warnCache.has(file)) {
                warnCache.add(file);
                this.warn(`[nuxt] Cannot extract styles for \`${file}\`. Its styles will not be inlined when server-rendering.`);
              }
              s.prepend(`${genImport(file)}
`);
              continue;
            }
            options.clientCSSMap[id].add(resolved.id);
          }
          if (s.hasChanged()) {
            return {
              code: s.toString(),
              map: s.generateMap({ hires: true })
            };
          }
        }
        return;
      }
      const { pathname, search } = parseURL(decodeURIComponent(pathToFileURL(id).href));
      if (!(id in options.clientCSSMap) && !islands.some((c) => c.filePath === pathname)) {
        return;
      }
      const query = parseQuery(search);
      if (query.macro || query.nuxt_component) {
        return;
      }
      if (!islands.some((c) => c.filePath === pathname)) {
        if (options.shouldInline === false || typeof options.shouldInline === "function" && !options.shouldInline(id)) {
          return;
        }
      }
      const relativeId = relativeToSrcDir(id);
      cssMap[relativeId] = cssMap[relativeId] || { files: [] };
      const emittedIds = /* @__PURE__ */ new Set();
      let styleCtr = 0;
      const ids = options.clientCSSMap[id] || [];
      for (const file of ids) {
        const resolved = await this.resolve(file) ?? await this.resolve(file, id);
        const res = await this.resolve(file + "?inline&used") ?? await this.resolve(file + "?inline&used", id);
        if (!resolved || !res) {
          if (!warnCache.has(file)) {
            warnCache.add(file);
            this.warn(`[nuxt] Cannot extract styles for \`${file}\`. Its styles will not be inlined when server-rendering.`);
          }
          continue;
        }
        if (emittedIds.has(file)) {
          continue;
        }
        const ref = this.emitFile({
          type: "chunk",
          name: `${filename(id)}-styles-${++styleCtr}.mjs`,
          id: file + "?inline&used"
        });
        idRefMap[relativeToSrcDir(file)] = ref;
        cssMap[relativeId].files.push(ref);
      }
      if (!SUPPORTED_FILES_RE.test(pathname)) {
        return;
      }
      for (const i of findStaticImports(code)) {
        const { type } = parseQuery(i.specifier);
        if (type !== "style" && !i.specifier.endsWith(".css")) {
          continue;
        }
        const resolved = await this.resolve(i.specifier, id);
        if (!resolved) {
          continue;
        }
        if (!await this.resolve(resolved.id + "?inline&used")) {
          if (!warnCache.has(resolved.id)) {
            warnCache.add(resolved.id);
            this.warn(`[nuxt] Cannot extract styles for \`${i.specifier}\`. Its styles will not be inlined when server-rendering.`);
          }
          continue;
        }
        if (emittedIds.has(resolved.id)) {
          continue;
        }
        const ref = this.emitFile({
          type: "chunk",
          name: `${filename(id)}-styles-${++styleCtr}.mjs`,
          id: resolved.id + "?inline&used"
        });
        idRefMap[relativeToSrcDir(resolved.id)] = ref;
        cssMap[relativeId].files.push(ref);
      }
    }
  };
}

const bundle = async (nuxt) => {
  const useAsyncEntry = nuxt.options.experimental.asyncEntry || nuxt.options.vite.devBundler === "vite-node" && nuxt.options.dev;
  const entry = await resolvePath(resolve$1(nuxt.options.appDir, useAsyncEntry ? "entry.async" : "entry"));
  let allowDirs = [
    nuxt.options.appDir,
    nuxt.options.workspaceDir,
    ...nuxt.options._layers.map((l) => l.config.rootDir),
    ...Object.values(nuxt.apps).flatMap((app) => [
      ...app.components.map((c) => dirname(c.filePath)),
      ...app.plugins.map((p) => dirname(p.src)),
      ...app.middleware.map((m) => dirname(m.path)),
      ...Object.values(app.layouts || {}).map((l) => dirname(l.file)),
      dirname(nuxt.apps.default.rootComponent),
      dirname(nuxt.apps.default.errorComponent)
    ])
  ].filter((d) => d && existsSync(d));
  for (const dir of allowDirs) {
    allowDirs = allowDirs.filter((d) => !d.startsWith(dir) || d === dir);
  }
  const { $client, $server, ...viteConfig } = nuxt.options.vite;
  const ctx = {
    nuxt,
    entry,
    config: vite.mergeConfig(
      {
        logLevel: logLevelMap[nuxt.options.logLevel] ?? logLevelMap.info,
        resolve: {
          alias: {
            ...nuxt.options.alias,
            "#app": nuxt.options.appDir,
            // We need this resolution to be present before the following entry, but it
            // will be filled in client/server configs
            "#build/plugins": "",
            "#build": nuxt.options.buildDir,
            "web-streams-polyfill/ponyfill/es2018": "unenv/runtime/mock/empty",
            // Cannot destructure property 'AbortController' of ..
            "abort-controller": "unenv/runtime/mock/empty"
          }
        },
        optimizeDeps: {
          include: ["vue"],
          exclude: ["nuxt/app"]
        },
        css: resolveCSSOptions(nuxt),
        define: {
          __NUXT_VERSION__: JSON.stringify(nuxt._version),
          "process.env.NUXT_ASYNC_CONTEXT": nuxt.options.experimental.asyncContext
        },
        build: {
          copyPublicDir: false,
          rollupOptions: {
            output: {
              sourcemapIgnoreList: (relativeSourcePath) => {
                return relativeSourcePath.includes("node_modules") || relativeSourcePath.includes(ctx.nuxt.options.buildDir);
              },
              sanitizeFileName: sanitizeFilePath,
              // https://github.com/vitejs/vite/tree/main/packages/vite/src/node/build.ts#L464-L478
              assetFileNames: nuxt.options.dev ? void 0 : (chunk) => withoutLeadingSlash(join(nuxt.options.app.buildAssetsDir, `${sanitizeFilePath(filename(chunk.name))}.[hash].[ext]`))
            }
          },
          watch: {
            exclude: nuxt.options.ignore
          }
        },
        plugins: [
          composableKeysPlugin.vite({
            sourcemap: !!nuxt.options.sourcemap.server || !!nuxt.options.sourcemap.client,
            rootDir: nuxt.options.rootDir,
            composables: nuxt.options.optimization.keyedComposables
          }),
          replace({
            ...Object.fromEntries([";", "(", "{", "}", " ", "	", "\n"].map((d) => [`${d}global.`, `${d}globalThis.`])),
            preventAssignment: true
          }),
          virtual(nuxt.vfs)
        ],
        vue: {
          reactivityTransform: nuxt.options.experimental.reactivityTransform
        },
        server: {
          watch: { ignored: isIgnored },
          fs: {
            allow: [...new Set(allowDirs)]
          }
        }
      },
      viteConfig
    )
  };
  if (!nuxt.options.dev) {
    ctx.config.server.watch = void 0;
    ctx.config.build.watch = void 0;
  }
  if (ctx.nuxt.options.typescript.typeCheck === true || ctx.nuxt.options.typescript.typeCheck === "build" && !ctx.nuxt.options.dev) {
    const checker = await import('vite-plugin-checker').then((r) => r.default);
    addVitePlugin(checker({
      vueTsc: {
        tsconfigPath: await resolveTSConfig(ctx.nuxt.options.rootDir)
      }
    }), { server: nuxt.options.ssr });
  }
  await nuxt.callHook("vite:extend", ctx);
  nuxt.hook("vite:extendConfig", (config) => {
    config.plugins.push(replace({
      preventAssignment: true,
      ...Object.fromEntries(Object.entries(config.define).filter(([key]) => key.startsWith("import.meta.")))
    }));
  });
  if (!ctx.nuxt.options.dev) {
    const chunksWithInlinedCSS = /* @__PURE__ */ new Set();
    const clientCSSMap = {};
    nuxt.hook("vite:extendConfig", (config, { isServer }) => {
      config.plugins.push(ssrStylesPlugin({
        srcDir: ctx.nuxt.options.srcDir,
        clientCSSMap,
        chunksWithInlinedCSS,
        shouldInline: ctx.nuxt.options.experimental.inlineSSRStyles,
        components: ctx.nuxt.apps.default.components,
        globalCSS: ctx.nuxt.options.css,
        mode: isServer ? "server" : "client",
        entry: ctx.entry
      }));
    });
    ctx.nuxt.hook("build:manifest", (manifest) => {
      for (const key in manifest) {
        const entry2 = manifest[key];
        const shouldRemoveCSS = chunksWithInlinedCSS.has(key) && !entry2.isEntry;
        if (entry2.isEntry && chunksWithInlinedCSS.has(key)) {
          entry2._globalCSS = true;
        }
        if (shouldRemoveCSS && entry2.css) {
          entry2.css = [];
        }
      }
    });
  }
  nuxt.hook("vite:serverCreated", (server, env) => {
    ctx.nuxt.hook("app:templatesGenerated", () => {
      for (const [id, mod] of server.moduleGraph.idToModuleMap) {
        if (id.startsWith("virtual:")) {
          server.moduleGraph.invalidateModule(mod);
        }
      }
    });
    if (nuxt.options.vite.warmupEntry !== false && // https://github.com/nuxt/nuxt/issues/14898
    !(env.isServer && ctx.nuxt.options.vite.devBundler !== "legacy")) {
      const start = Date.now();
      warmupViteServer(server, [join("/@fs/", ctx.entry)], env.isServer).then(() => logger.info(`Vite ${env.isClient ? "client" : "server"} warmed up in ${Date.now() - start}ms`)).catch(logger.error);
    }
  });
  await buildClient(ctx);
  await buildServer(ctx);
};

export { bundle as b, createIsExternal as c, hashId as h, isCSS as i, uniq as u, writeManifest as w };
