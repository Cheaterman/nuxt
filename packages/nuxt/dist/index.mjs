import { dirname, resolve, basename, extname, relative, normalize, isAbsolute, join } from 'pathe';
import { createHooks, createDebugger } from 'hookable';
import { useNuxt, resolveFiles, logger, defineNuxtModule, addTemplate, addPlugin, addComponent, updateTemplates, addVitePlugin, addWebpackPlugin, addBuildPlugin, findPath, addImportsSources, tryResolveModule, isIgnored, resolveAlias, addPluginTemplate, normalizeModuleTranspilePath, resolveNuxtModule, resolveIgnorePatterns, createResolver, nuxtCtx, addRouteMiddleware, resolvePath as resolvePath$1, installModule, useNitro, loadNuxtConfig, normalizeTemplate, compileTemplate, normalizePlugin, templateUtils } from '@nuxt/kit';
import escapeRE from 'escape-string-regexp';
import fse from 'fs-extra';
import { parseURL, parseQuery, withLeadingSlash, joinURL, encodePath, withTrailingSlash, withoutLeadingSlash } from 'ufo';
import defu$1, { defu } from 'defu';
import fs, { existsSync, readdirSync, statSync, promises, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { genArrayFromRaw, genSafeVariableName, genImport, genDynamicImport, genObjectFromRawEntries, genString, genExport } from 'knitwork';
import { createRoutesContext } from 'unplugin-vue-router';
import { resolveOptions } from 'unplugin-vue-router/options';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { filename } from 'pathe/utils';
import { hash } from 'ohash';
import { transform } from 'esbuild';
import { parse } from 'acorn';
import { kebabCase, splitByCase, pascalCase, camelCase } from 'scule';
import { runInNewContext } from 'node:vm';
import { walk } from 'estree-walker';
import { createUnplugin } from 'unplugin';
import { findStaticImports, findExports, parseStaticImport, parseNodeModulePath, lookupNodeModuleSubpath, interopDefault, resolvePath } from 'mlly';
import MagicString from 'magic-string';
import { globby } from 'globby';
import { hyphenate } from '@vue/shared';
import { parse as parse$1, walk as walk$1, ELEMENT_NODE } from 'ultrahtml';
import { createUnimport, defineUnimportPreset, scanDirExports } from 'unimport';
import { parseQuery as parseQuery$1 } from 'vue-router';
import { createRequire } from 'node:module';
import { createTransformer } from 'unctx/transform';
import { stripLiteral } from 'strip-literal';
import { cpus } from 'node:os';
import { toRouteMatcher, createRouter, exportMatcher } from 'radix3';
import { randomUUID } from 'uncrypto';
import { createNitro, scanHandlers, writeTypes, build as build$1, prepare, copyPublicAssets, prerender, createDevServer } from 'nitropack';
import { dynamicEventHandler } from 'h3';
import { template } from '@nuxt/ui-templates/templates/spa-loading-icon.mjs';
import chokidar from 'chokidar';
import { debounce } from 'perfect-debounce';
import { resolveSchema, generateTypes } from 'untyped';
import untypedPlugin from 'untyped/babel-plugin';
import jiti from 'jiti';

let _distDir = dirname(fileURLToPath(import.meta.url));
if (_distDir.match(/(chunks|shared)$/)) {
  _distDir = dirname(_distDir);
}
const distDir = _distDir;
const pkgDir = resolve(distDir, "..");

function getNameFromPath(path) {
  return kebabCase(basename(path).replace(extname(path), "")).replace(/["']/g, "");
}
function hasSuffix(path, suffix) {
  return basename(path).replace(extname(path), "").endsWith(suffix);
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

function uniqueBy(arr, key) {
  const res = [];
  const seen = /* @__PURE__ */ new Set();
  for (const item of arr) {
    if (seen.has(item[key])) {
      continue;
    }
    seen.add(item[key]);
    res.push(item);
  }
  return res;
}

async function resolvePagesRoutes() {
  const nuxt = useNuxt();
  const pagesDirs = nuxt.options._layers.map(
    (layer) => resolve(layer.config.srcDir, (layer.config.rootDir === nuxt.options.rootDir ? nuxt.options : layer.config).dir?.pages || "pages")
  );
  const scannedFiles = [];
  for (const dir of pagesDirs) {
    const files = await resolveFiles(dir, `**/*{${nuxt.options.extensions.join(",")}}`);
    scannedFiles.push(...files.map((file) => ({ relativePath: relative(dir, file), absolutePath: file })));
  }
  scannedFiles.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  const allRoutes = await generateRoutesFromFiles(uniqueBy(scannedFiles, "relativePath"), nuxt.options.experimental.typedPages, nuxt.vfs);
  return uniqueBy(allRoutes, "path");
}
async function generateRoutesFromFiles(files, shouldExtractBuildMeta = false, vfs) {
  const routes = [];
  for (const file of files) {
    const segments = file.relativePath.replace(new RegExp(`${escapeRE(extname(file.relativePath))}$`), "").split("/");
    const route = {
      name: "",
      path: "",
      file: file.absolutePath,
      children: []
    };
    let parent = routes;
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const tokens = parseSegment(segment);
      const segmentName = tokens.map(({ value }) => value).join("");
      route.name += (route.name && "/") + segmentName;
      const path = withLeadingSlash(joinURL(route.path, getRoutePath(tokens).replace(/\/index$/, "/")));
      const child = parent.find((parentRoute) => parentRoute.name === route.name && parentRoute.path === path);
      if (child && child.children) {
        parent = child.children;
        route.path = "";
      } else if (segmentName === "index" && !route.path) {
        route.path += "/";
      } else if (segmentName !== "index") {
        route.path += getRoutePath(tokens);
      }
    }
    if (shouldExtractBuildMeta && vfs) {
      const fileContent = file.absolutePath in vfs ? vfs[file.absolutePath] : fs.readFileSync(file.absolutePath, "utf-8");
      const overrideRouteName = await getRouteName(fileContent);
      if (overrideRouteName) {
        route.name = overrideRouteName;
      }
    }
    parent.push(route);
  }
  return prepareRoutes(routes);
}
const SFC_SCRIPT_RE = /<script\s*[^>]*>([\s\S]*?)<\/script\s*[^>]*>/i;
function extractScriptContent(html) {
  const match = html.match(SFC_SCRIPT_RE);
  if (match && match[1]) {
    return match[1].trim();
  }
  return null;
}
const PAGE_META_RE = /(definePageMeta\([\s\S]*?\))/;
async function getRouteName(file) {
  const script = extractScriptContent(file);
  if (!script) {
    return null;
  }
  if (!PAGE_META_RE.test(script)) {
    return null;
  }
  const js = await transform(script, { loader: "ts" });
  const ast = parse(js.code, {
    sourceType: "module",
    ecmaVersion: "latest"
  });
  const pageMetaAST = ast.body.find((node) => node.type === "ExpressionStatement" && node.expression.type === "CallExpression" && node.expression.callee.type === "Identifier" && node.expression.callee.name === "definePageMeta");
  if (!pageMetaAST) {
    return null;
  }
  const pageMetaArgument = pageMetaAST.expression.arguments[0];
  const nameProperty = pageMetaArgument.properties.find((property) => property.type === "Property" && property.key.type === "Identifier" && property.key.name === "name");
  if (!nameProperty || nameProperty.value.type !== "Literal" || typeof nameProperty.value.value !== "string") {
    return null;
  }
  return nameProperty.value.value;
}
function getRoutePath(tokens) {
  return tokens.reduce((path, token) => {
    return path + (token.type === 2 /* optional */ ? `:${token.value}?` : token.type === 1 /* dynamic */ ? `:${token.value}()` : token.type === 3 /* catchall */ ? `:${token.value}(.*)*` : encodePath(token.value).replace(/:/g, "\\:"));
  }, "/");
}
const PARAM_CHAR_RE = /[\w\d_.]/;
function parseSegment(segment) {
  let state = 0 /* initial */;
  let i = 0;
  let buffer = "";
  const tokens = [];
  function consumeBuffer() {
    if (!buffer) {
      return;
    }
    if (state === 0 /* initial */) {
      throw new Error("wrong state");
    }
    tokens.push({
      type: state === 1 /* static */ ? 0 /* static */ : state === 2 /* dynamic */ ? 1 /* dynamic */ : state === 3 /* optional */ ? 2 /* optional */ : 3 /* catchall */,
      value: buffer
    });
    buffer = "";
  }
  while (i < segment.length) {
    const c = segment[i];
    switch (state) {
      case 0 /* initial */:
        buffer = "";
        if (c === "[") {
          state = 2 /* dynamic */;
        } else {
          i--;
          state = 1 /* static */;
        }
        break;
      case 1 /* static */:
        if (c === "[") {
          consumeBuffer();
          state = 2 /* dynamic */;
        } else {
          buffer += c;
        }
        break;
      case 4 /* catchall */:
      case 2 /* dynamic */:
      case 3 /* optional */:
        if (buffer === "...") {
          buffer = "";
          state = 4 /* catchall */;
        }
        if (c === "[" && state === 2 /* dynamic */) {
          state = 3 /* optional */;
        }
        if (c === "]" && (state !== 3 /* optional */ || segment[i - 1] === "]")) {
          if (!buffer) {
            throw new Error("Empty param");
          } else {
            consumeBuffer();
          }
          state = 0 /* initial */;
        } else if (PARAM_CHAR_RE.test(c)) {
          buffer += c;
        } else ;
        break;
    }
    i++;
  }
  if (state === 2 /* dynamic */) {
    throw new Error(`Unfinished param "${buffer}"`);
  }
  consumeBuffer();
  return tokens;
}
function findRouteByName(name, routes) {
  for (const route of routes) {
    if (route.name === name) {
      return route;
    }
  }
  return findRouteByName(name, routes);
}
function prepareRoutes(routes, parent, names = /* @__PURE__ */ new Set()) {
  for (const route of routes) {
    if (route.name) {
      route.name = route.name.replace(/\/index$/, "").replace(/\//g, "-");
      if (names.has(route.name)) {
        const existingRoute = findRouteByName(route.name, routes);
        const extra = existingRoute?.name ? `is the same as \`${existingRoute.file}\`` : "is a duplicate";
        logger.warn(`Route name generated for \`${route.file}\` ${extra}. You may wish to set a custom name using \`definePageMeta\` within the page file.`);
      }
    }
    if (parent && route.path.startsWith("/")) {
      route.path = route.path.slice(1);
    }
    if (route.children?.length) {
      route.children = prepareRoutes(route.children, route, names);
    }
    if (route.children?.find((childRoute) => childRoute.path === "")) {
      delete route.name;
    }
    if (route.name) {
      names.add(route.name);
    }
  }
  return routes;
}
function normalizeRoutes(routes, metaImports = /* @__PURE__ */ new Set()) {
  return {
    imports: metaImports,
    routes: genArrayFromRaw(routes.map((page) => {
      const route = Object.fromEntries(
        Object.entries(page).filter(([key, value]) => key !== "file" && (Array.isArray(value) ? value.length : value)).map(([key, value]) => [key, JSON.stringify(value)])
      );
      if (page.children?.length) {
        route.children = normalizeRoutes(page.children, metaImports).routes;
      }
      if (!page.file) {
        for (const key of ["name", "path", "meta", "alias", "redirect"]) {
          if (page[key]) {
            route[key] = JSON.stringify(page[key]);
          }
        }
        return route;
      }
      const file = normalize(page.file);
      const metaImportName = genSafeVariableName(filename(file) + hash(file)) + "Meta";
      metaImports.add(genImport(`${file}?macro=true`, [{ name: "default", as: metaImportName }]));
      let aliasCode = `${metaImportName}?.alias || []`;
      const alias = Array.isArray(page.alias) ? page.alias : [page.alias].filter(Boolean);
      if (alias.length) {
        aliasCode = `${JSON.stringify(alias)}.concat(${aliasCode})`;
      }
      route.name = `${metaImportName}?.name ?? ${page.name ? JSON.stringify(page.name) : "undefined"}`;
      route.path = `${metaImportName}?.path ?? ${JSON.stringify(page.path)}`;
      route.meta = page.meta && Object.values(page.meta).filter((value) => value !== void 0).length ? `{...(${metaImportName} || {}), ...${JSON.stringify(page.meta)}}` : `${metaImportName} || {}`;
      route.alias = aliasCode;
      route.redirect = page.redirect ? JSON.stringify(page.redirect) : `${metaImportName}?.redirect || undefined`;
      route.component = genDynamicImport(file, { interopDefault: true });
      return route;
    }))
  };
}
function pathToNitroGlob(path) {
  if (!path) {
    return null;
  }
  if (path.indexOf(":") !== path.lastIndexOf(":")) {
    return null;
  }
  return path.replace(/\/(?:[^:/]+)?:\w+.*$/, "/**");
}

const ROUTE_RULE_RE = /\bdefineRouteRules\(/;
const ruleCache = {};
async function extractRouteRules(code) {
  if (code in ruleCache) {
    return ruleCache[code];
  }
  if (!ROUTE_RULE_RE.test(code)) {
    return null;
  }
  code = extractScriptContent(code) || code;
  let rule = null;
  const js = await transform(code, { loader: "ts" });
  walk(parse(js.code, {
    sourceType: "module",
    ecmaVersion: "latest"
  }), {
    enter(_node) {
      if (_node.type !== "CallExpression" || _node.callee.type !== "Identifier") {
        return;
      }
      const node = _node;
      const name = "name" in node.callee && node.callee.name;
      if (name === "defineRouteRules") {
        const rulesString = js.code.slice(node.start, node.end);
        try {
          rule = JSON.parse(runInNewContext(rulesString.replace("defineRouteRules", "JSON.stringify"), {}));
        } catch {
          throw new Error("[nuxt] Error parsing route rules. They should be JSON-serializable.");
        }
      }
    }
  });
  ruleCache[code] = rule;
  return rule;
}
function getMappedPages(pages, paths = {}, prefix = "") {
  for (const page of pages) {
    if (page.file) {
      const filename = normalize(page.file);
      paths[filename] = pathToNitroGlob(prefix + page.path);
    }
    if (page.children) {
      getMappedPages(page.children, paths, page.path + "/");
    }
  }
  return paths;
}

const HAS_MACRO_RE = /\bdefinePageMeta\s*\(\s*/;
const CODE_EMPTY = `
const __nuxt_page_meta = null
export default __nuxt_page_meta
`;
const CODE_HMR = `
// Vite
if (import.meta.hot) {
  import.meta.hot.accept(mod => {
    Object.assign(__nuxt_page_meta, mod)
  })
}
// webpack
if (import.meta.webpackHot) {
  import.meta.webpackHot.accept((err) => {
    if (err) { window.location = window.location.href }
  })
}`;
const PageMetaPlugin = createUnplugin((options) => {
  return {
    name: "nuxt:pages-macros-transform",
    enforce: "post",
    transformInclude(id) {
      return !!parseMacroQuery(id).macro;
    },
    transform(code, id) {
      const query = parseMacroQuery(id);
      if (query.type && query.type !== "script") {
        return;
      }
      const s = new MagicString(code);
      function result() {
        if (s.hasChanged()) {
          return {
            code: s.toString(),
            map: options.sourcemap ? s.generateMap({ hires: true }) : void 0
          };
        }
      }
      const hasMacro = HAS_MACRO_RE.test(code);
      const imports = findStaticImports(code);
      const scriptImport = imports.find((i) => parseMacroQuery(i.specifier).type === "script");
      if (scriptImport) {
        const reorderedQuery = rewriteQuery(scriptImport.specifier);
        const quotedSpecifier = getQuotedSpecifier(scriptImport.code)?.replace(scriptImport.specifier, reorderedQuery) ?? JSON.stringify(reorderedQuery);
        s.overwrite(0, code.length, `export { default } from ${quotedSpecifier}`);
        return result();
      }
      const currentExports = findExports(code);
      for (const match of currentExports) {
        if (match.type !== "default" || !match.specifier) {
          continue;
        }
        const reorderedQuery = rewriteQuery(match.specifier);
        const quotedSpecifier = getQuotedSpecifier(match.code)?.replace(match.specifier, reorderedQuery) ?? JSON.stringify(reorderedQuery);
        s.overwrite(0, code.length, `export { default } from ${quotedSpecifier}`);
        return result();
      }
      if (!hasMacro && !code.includes("export { default }") && !code.includes("__nuxt_page_meta")) {
        if (!code) {
          s.append(CODE_EMPTY + (options.dev ? CODE_HMR : ""));
          const { pathname } = parseURL(decodeURIComponent(pathToFileURL(id).href));
          logger.error(`The file \`${pathname}\` is not a valid page as it has no content.`);
        } else {
          s.overwrite(0, code.length, CODE_EMPTY + (options.dev ? CODE_HMR : ""));
        }
        return result();
      }
      const importMap = /* @__PURE__ */ new Map();
      const addedImports = /* @__PURE__ */ new Set();
      for (const i of imports) {
        const parsed = parseStaticImport(i);
        for (const name of [
          parsed.defaultImport,
          ...Object.values(parsed.namedImports || {}),
          parsed.namespacedImport
        ].filter(Boolean)) {
          importMap.set(name, i);
        }
      }
      walk(this.parse(code, {
        sourceType: "module",
        ecmaVersion: "latest"
      }), {
        enter(_node) {
          if (_node.type !== "CallExpression" || _node.callee.type !== "Identifier") {
            return;
          }
          const node = _node;
          const name = "name" in node.callee && node.callee.name;
          if (name !== "definePageMeta") {
            return;
          }
          const meta = node.arguments[0];
          let contents = `const __nuxt_page_meta = ${code.slice(meta.start, meta.end) || "null"}
export default __nuxt_page_meta` + (options.dev ? CODE_HMR : "");
          function addImport(name2) {
            if (name2 && importMap.has(name2)) {
              const importValue = importMap.get(name2).code;
              if (!addedImports.has(importValue)) {
                contents = importMap.get(name2).code + "\n" + contents;
                addedImports.add(importValue);
              }
            }
          }
          walk(meta, {
            enter(_node2) {
              if (_node2.type === "CallExpression") {
                const node2 = _node2;
                addImport("name" in node2.callee && node2.callee.name);
              }
              if (_node2.type === "Identifier") {
                const node2 = _node2;
                addImport(node2.name);
              }
            }
          });
          s.overwrite(0, code.length, contents);
        }
      });
      if (!s.hasChanged() && !code.includes("__nuxt_page_meta")) {
        s.overwrite(0, code.length, CODE_EMPTY + (options.dev ? CODE_HMR : ""));
      }
      return result();
    },
    vite: {
      handleHotUpdate: {
        order: "pre",
        handler: ({ modules }) => {
          const index = modules.findIndex((i) => i.id?.includes("?macro=true"));
          if (index !== -1) {
            modules.splice(index, 1);
          }
        }
      }
    }
  };
});
function rewriteQuery(id) {
  return id.replace(/\?.+$/, (r) => "?macro=true&" + r.replace(/^\?/, "").replace(/&macro=true/, ""));
}
function parseMacroQuery(id) {
  const { search } = parseURL(decodeURIComponent(isAbsolute(id) ? pathToFileURL(id).href : id).replace(/\?macro=true$/, ""));
  const query = parseQuery(search);
  if (id.includes("?macro=true")) {
    return { macro: "true", ...query };
  }
  return query;
}
function getQuotedSpecifier(id) {
  return id.match(/(["']).*\1/)?.[0];
}

const INJECTION_RE = /\b_ctx\.\$route\b/g;
const INJECTION_SINGLE_RE = /\b_ctx\.\$route\b/;
const RouteInjectionPlugin = (nuxt) => createUnplugin(() => {
  return {
    name: "nuxt:route-injection-plugin",
    enforce: "post",
    transformInclude(id) {
      return isVue(id, { type: ["template", "script"] });
    },
    transform(code) {
      if (!INJECTION_SINGLE_RE.test(code) || code.includes("_ctx._.provides[__nuxt_route_symbol")) {
        return;
      }
      let replaced = false;
      const s = new MagicString(code);
      s.replace(INJECTION_RE, () => {
        replaced = true;
        return "(_ctx._.provides[__nuxt_route_symbol] || _ctx.$route)";
      });
      if (replaced) {
        s.prepend("import { PageRouteSymbol as __nuxt_route_symbol } from '#app/components/injections';\n");
      }
      if (s.hasChanged()) {
        return {
          code: s.toString(),
          map: nuxt.options.sourcemap.client || nuxt.options.sourcemap.server ? s.generateMap({ hires: true }) : void 0
        };
      }
    }
  };
});

const OPTIONAL_PARAM_RE = /^\/?:.*(\?|\(\.\*\)\*)$/;
const pagesModule = defineNuxtModule({
  meta: {
    name: "pages"
  },
  async setup(_options, nuxt) {
    const useExperimentalTypedPages = nuxt.options.experimental.typedPages;
    const pagesDirs = nuxt.options._layers.map(
      (layer) => resolve(layer.config.srcDir, (layer.config.rootDir === nuxt.options.rootDir ? nuxt.options : layer.config).dir?.pages || "pages")
    );
    const isNonEmptyDir = (dir) => existsSync(dir) && readdirSync(dir).length;
    const userPreference = nuxt.options.pages;
    const isPagesEnabled = async () => {
      if (typeof userPreference === "boolean") {
        return userPreference;
      }
      if (nuxt.options._layers.some((layer) => existsSync(resolve(layer.config.srcDir, "app/router.options.ts")))) {
        return true;
      }
      if (pagesDirs.some((dir) => isNonEmptyDir(dir))) {
        return true;
      }
      const pages = await resolvePagesRoutes();
      await nuxt.callHook("pages:extend", pages);
      if (pages.length) {
        return true;
      }
      return false;
    };
    nuxt.options.pages = await isPagesEnabled();
    const restartPaths = nuxt.options._layers.flatMap((layer) => {
      const pagesDir = (layer.config.rootDir === nuxt.options.rootDir ? nuxt.options : layer.config).dir?.pages || "pages";
      return [
        join(layer.config.srcDir || layer.cwd, "app/router.options.ts"),
        join(layer.config.srcDir || layer.cwd, pagesDir)
      ];
    });
    nuxt.hooks.hook("builder:watch", async (event, relativePath) => {
      const path = resolve(nuxt.options.srcDir, relativePath);
      if (restartPaths.some((p) => p === path || path.startsWith(p + "/"))) {
        const newSetting = await isPagesEnabled();
        if (nuxt.options.pages !== newSetting) {
          logger.info("Pages", newSetting ? "enabled" : "disabled");
          return nuxt.callHook("restart");
        }
      }
    });
    addTemplate({
      filename: "vue-router-stub.d.ts",
      getContents: () => `export * from '${useExperimentalTypedPages ? "vue-router/auto" : "vue-router"}'`
    });
    nuxt.options.alias["#vue-router"] = join(nuxt.options.buildDir, "vue-router-stub");
    if (!nuxt.options.pages) {
      addPlugin(resolve(distDir, "app/plugins/router"));
      addTemplate({
        filename: "pages.mjs",
        getContents: () => "export { useRoute } from '#app'"
      });
      addComponent({
        name: "NuxtPage",
        priority: 10,
        // built-in that we do not expect the user to override
        filePath: resolve(distDir, "pages/runtime/page-placeholder")
      });
      return;
    }
    addTemplate({
      filename: "vue-router-stub.mjs",
      // TODO: use `vue-router/auto` when we have support for page metadata
      getContents: () => "export * from 'vue-router';"
    });
    if (useExperimentalTypedPages) {
      const declarationFile = "./types/typed-router.d.ts";
      const options = {
        routesFolder: [],
        dts: resolve(nuxt.options.buildDir, declarationFile),
        logs: nuxt.options.debug,
        async beforeWriteFiles(rootPage) {
          rootPage.children.forEach((child) => child.delete());
          const pages = await resolvePagesRoutes();
          await nuxt.callHook("pages:extend", pages);
          function addPage(parent, page) {
            const route = parent.insert(page.path, page.file);
            if (page.meta) {
              route.addToMeta(page.meta);
            }
            if (page.alias) {
              route.addAlias(page.alias);
            }
            if (page.name) {
              route.name = page.name;
            }
            if (page.children) {
              page.children.forEach((child) => addPage(route, child));
            }
          }
          for (const page of pages) {
            addPage(rootPage, page);
          }
        }
      };
      nuxt.hook("prepare:types", ({ references }) => {
        references.push({ path: declarationFile });
      });
      const context = createRoutesContext(resolveOptions(options));
      const dtsFile = resolve(nuxt.options.buildDir, declarationFile);
      await mkdir(dirname(dtsFile), { recursive: true });
      await context.scanPages(false);
      if (nuxt.options._prepare) {
        const dts = await readFile(dtsFile, "utf-8");
        addTemplate({
          filename: "types/typed-router.d.ts",
          getContents: () => dts
        });
      }
      nuxt.hook("builder:generateApp", async (options2) => {
        if (!options2?.filter || options2.filter({ filename: "routes.mjs" })) {
          await context.scanPages();
        }
      });
    }
    const runtimeDir = resolve(distDir, "pages/runtime");
    nuxt.hook("prepare:types", ({ references }) => {
      references.push({ types: useExperimentalTypedPages ? "vue-router/auto" : "vue-router" });
    });
    nuxt.hook("imports:sources", (sources) => {
      const routerImports = sources.find((s) => s.from === "#app" && s.imports.includes("onBeforeRouteLeave"));
      if (routerImports) {
        routerImports.from = "#vue-router";
      }
    });
    const updateTemplatePaths = nuxt.options._layers.flatMap((l) => {
      const dir = (l.config.rootDir === nuxt.options.rootDir ? nuxt.options : l.config).dir;
      return [
        join(l.config.srcDir || l.cwd, dir?.pages || "pages") + "/",
        join(l.config.srcDir || l.cwd, dir?.layouts || "layouts") + "/",
        join(l.config.srcDir || l.cwd, dir?.middleware || "middleware") + "/"
      ];
    });
    nuxt.hook("builder:watch", async (event, relativePath) => {
      if (event === "change") {
        return;
      }
      const path = resolve(nuxt.options.srcDir, relativePath);
      if (updateTemplatePaths.some((dir) => path.startsWith(dir))) {
        await updateTemplates({
          filter: (template) => template.filename === "routes.mjs"
        });
      }
    });
    nuxt.hook("app:resolve", (app) => {
      if (app.mainComponent.includes("@nuxt/ui-templates")) {
        app.mainComponent = resolve(runtimeDir, "app.vue");
      }
      app.middleware.unshift({
        name: "validate",
        path: resolve(runtimeDir, "validate"),
        global: true
      });
    });
    nuxt.hook("nitro:init", (nitro) => {
      if (nuxt.options.dev || !nitro.options.static) {
        return;
      }
      const prerenderRoutes = /* @__PURE__ */ new Set();
      nuxt.hook("pages:extend", (pages) => {
        prerenderRoutes.clear();
        const processPages = (pages2, currentPath = "/") => {
          for (const page of pages2) {
            if (OPTIONAL_PARAM_RE.test(page.path) && !page.children?.length) {
              prerenderRoutes.add(currentPath);
            }
            if (page.path.includes(":")) {
              continue;
            }
            const route = joinURL(currentPath, page.path);
            prerenderRoutes.add(route);
            if (page.children) {
              processPages(page.children, route);
            }
          }
        };
        processPages(pages);
      });
      nuxt.hook("nitro:build:before", (nitro2) => {
        for (const route of nitro2.options.prerender.routes || []) {
          if (route === "/") {
            continue;
          }
          prerenderRoutes.add(route);
        }
        nitro2.options.prerender.routes = Array.from(prerenderRoutes);
      });
    });
    nuxt.hook("imports:extend", (imports) => {
      imports.push(
        { name: "definePageMeta", as: "definePageMeta", from: resolve(runtimeDir, "composables") },
        { name: "useLink", as: "useLink", from: "#vue-router" }
      );
      if (nuxt.options.experimental.inlineRouteRules) {
        imports.push({ name: "defineRouteRules", as: "defineRouteRules", from: resolve(runtimeDir, "composables") });
      }
    });
    if (nuxt.options.experimental.inlineRouteRules) {
      let pageToGlobMap = {};
      nuxt.hook("pages:extend", (pages) => {
        pageToGlobMap = getMappedPages(pages);
      });
      const inlineRules = {};
      let updateRouteConfig;
      nuxt.hook("nitro:init", (nitro) => {
        updateRouteConfig = () => nitro.updateConfig({ routeRules: defu(inlineRules, nitro.options._config.routeRules) });
      });
      async function updatePage(path) {
        const glob = pageToGlobMap[path];
        const code = path in nuxt.vfs ? nuxt.vfs[path] : await readFile(path, "utf-8");
        try {
          const extractedRule = await extractRouteRules(code);
          if (extractedRule) {
            if (!glob) {
              const relativePath = relative(nuxt.options.srcDir, path);
              logger.error(`Could not set inline route rules in \`~/${relativePath}\` as it could not be mapped to a Nitro route.`);
              return;
            }
            inlineRules[glob] = extractedRule;
          } else if (glob) {
            delete inlineRules[glob];
          }
        } catch (e) {
          if (e.toString().includes("Error parsing route rules")) {
            const relativePath = relative(nuxt.options.srcDir, path);
            logger.error(`Error parsing route rules within \`~/${relativePath}\`. They should be JSON-serializable.`);
          } else {
            logger.error(e);
          }
        }
      }
      nuxt.hook("builder:watch", async (event, relativePath) => {
        const path = join(nuxt.options.srcDir, relativePath);
        if (!(path in pageToGlobMap)) {
          return;
        }
        if (event === "unlink") {
          delete inlineRules[path];
          delete pageToGlobMap[path];
        } else {
          await updatePage(path);
        }
        await updateRouteConfig?.();
      });
      nuxt.hooks.hookOnce("pages:extend", async () => {
        for (const page in pageToGlobMap) {
          await updatePage(page);
        }
        await updateRouteConfig?.();
      });
    }
    const pageMetaOptions = {
      dev: nuxt.options.dev,
      sourcemap: !!nuxt.options.sourcemap.server || !!nuxt.options.sourcemap.client
    };
    nuxt.hook("modules:done", () => {
      addVitePlugin(() => PageMetaPlugin.vite(pageMetaOptions));
      addWebpackPlugin(() => PageMetaPlugin.webpack(pageMetaOptions));
    });
    addPlugin(resolve(runtimeDir, "plugins/prefetch.client"));
    if (nuxt.options.experimental.templateRouteInjection) {
      addBuildPlugin(RouteInjectionPlugin(nuxt), { server: false });
    }
    addPlugin(resolve(runtimeDir, "plugins/router"));
    const getSources = (pages) => pages.filter((p) => Boolean(p.file)).flatMap(
      (p) => [relative(nuxt.options.srcDir, p.file), ...getSources(p.children || [])]
    );
    nuxt.hook("build:manifest", async (manifest) => {
      if (nuxt.options.dev) {
        return;
      }
      const pages = await resolvePagesRoutes();
      await nuxt.callHook("pages:extend", pages);
      const sourceFiles = getSources(pages);
      for (const key in manifest) {
        if (manifest[key].isEntry) {
          manifest[key].dynamicImports = manifest[key].dynamicImports?.filter((i) => !sourceFiles.includes(i));
        }
      }
    });
    addTemplate({
      filename: "routes.mjs",
      async getContents() {
        const pages = await resolvePagesRoutes();
        await nuxt.callHook("pages:extend", pages);
        const { routes, imports } = normalizeRoutes(pages);
        return [...imports, `export default ${routes}`].join("\n");
      }
    });
    addTemplate({
      filename: "pages.mjs",
      getContents: () => "export { useRoute } from 'vue-router'"
    });
    nuxt.options.vite.optimizeDeps = nuxt.options.vite.optimizeDeps || {};
    nuxt.options.vite.optimizeDeps.include = nuxt.options.vite.optimizeDeps.include || [];
    nuxt.options.vite.optimizeDeps.include.push("vue-router");
    nuxt.options.vite.resolve = nuxt.options.vite.resolve || {};
    nuxt.options.vite.resolve.dedupe = nuxt.options.vite.resolve.dedupe || [];
    nuxt.options.vite.resolve.dedupe.push("vue-router");
    addTemplate({
      filename: "router.options.mjs",
      getContents: async () => {
        const routerOptionsFiles = (await Promise.all(nuxt.options._layers.map(
          async (layer) => await findPath(resolve(layer.config.srcDir, "app/router.options"))
        ))).filter(Boolean);
        routerOptionsFiles.push(resolve(runtimeDir, "router.options"));
        const configRouterOptions = genObjectFromRawEntries(Object.entries(nuxt.options.router.options).map(([key, value]) => [key, genString(value)]));
        return [
          ...routerOptionsFiles.map((file, index) => genImport(file, `routerOptions${index}`)),
          `const configRouterOptions = ${configRouterOptions}`,
          "export default {",
          "...configRouterOptions,",
          // We need to reverse spreading order to respect layers priority
          ...routerOptionsFiles.map((_, index) => `...routerOptions${index},`).reverse(),
          "}"
        ].join("\n");
      }
    });
    addTemplate({
      filename: "types/middleware.d.ts",
      getContents: ({ nuxt: nuxt2, app }) => {
        const composablesFile = relative(join(nuxt2.options.buildDir, "types"), resolve(runtimeDir, "composables"));
        const namedMiddleware = app.middleware.filter((mw) => !mw.global);
        return [
          "import type { NavigationGuard } from 'vue-router'",
          `export type MiddlewareKey = ${namedMiddleware.map((mw) => genString(mw.name)).join(" | ") || "string"}`,
          `declare module ${genString(composablesFile)} {`,
          "  interface PageMeta {",
          "    middleware?: MiddlewareKey | NavigationGuard | Array<MiddlewareKey | NavigationGuard>",
          "  }",
          "}"
        ].join("\n");
      }
    });
    addTemplate({
      filename: "types/layouts.d.ts",
      getContents: ({ nuxt: nuxt2, app }) => {
        const composablesFile = relative(join(nuxt2.options.buildDir, "types"), resolve(runtimeDir, "composables"));
        return [
          "import { ComputedRef, MaybeRef } from 'vue'",
          `export type LayoutKey = ${Object.keys(app.layouts).map((name) => genString(name)).join(" | ") || "string"}`,
          `declare module ${genString(composablesFile)} {`,
          "  interface PageMeta {",
          "    layout?: MaybeRef<LayoutKey | false> | ComputedRef<LayoutKey | false>",
          "  }",
          "}"
        ].join("\n");
      }
    });
    addComponent({
      name: "NuxtPage",
      priority: 10,
      // built-in that we do not expect the user to override
      filePath: resolve(distDir, "pages/runtime/page")
    });
    nuxt.hook("prepare:types", ({ references }) => {
      references.push({ path: resolve(nuxt.options.buildDir, "types/middleware.d.ts") });
      references.push({ path: resolve(nuxt.options.buildDir, "types/layouts.d.ts") });
      references.push({ path: resolve(nuxt.options.buildDir, "vue-router-stub.d.ts") });
    });
  }
});

const components = ["NoScript", "Link", "Base", "Title", "Meta", "Style", "Head", "Html", "Body"];
const metaModule = defineNuxtModule({
  meta: {
    name: "meta"
  },
  async setup(options, nuxt) {
    const runtimeDir = resolve(distDir, "head/runtime");
    nuxt.options.build.transpile.push("@unhead/vue");
    const componentsPath = resolve(runtimeDir, "components");
    for (const componentName of components) {
      addComponent({
        name: componentName,
        filePath: componentsPath,
        export: componentName,
        // built-in that we do not expect the user to override
        priority: 10,
        // kebab case version of these tags is not valid
        kebabName: componentName
      });
    }
    nuxt.options.optimization.treeShake.composables.client["@unhead/vue"] = [
      "useServerHead",
      "useServerSeoMeta",
      "useServerHeadSafe"
    ];
    addImportsSources({
      from: "@unhead/vue",
      // hard-coded for now we so don't support auto-imports on the deprecated composables
      imports: [
        "injectHead",
        "useHead",
        "useSeoMeta",
        "useHeadSafe",
        "useServerHead",
        "useServerSeoMeta",
        "useServerHeadSafe"
      ]
    });
    if (nuxt.options.experimental.polyfillVueUseHead) {
      nuxt.options.alias["@vueuse/head"] = await tryResolveModule("@unhead/vue", nuxt.options.modulesDir) || "@unhead/vue";
      addPlugin({ src: resolve(runtimeDir, "plugins/vueuse-head-polyfill") });
    }
    addTemplate({
      filename: "unhead-plugins.mjs",
      getContents() {
        if (!nuxt.options.experimental.headNext) {
          return "export default []";
        }
        return `import { CapoPlugin } from '@unhead/vue';
export default process.server ? [CapoPlugin({ track: true })] : [];`;
      }
    });
    nuxt.hooks.hook("nitro:config", (config) => {
      config.virtual["#internal/unhead-plugins.mjs"] = () => nuxt.vfs["#build/unhead-plugins"];
    });
    addPlugin({ src: resolve(runtimeDir, "plugins/unhead") });
  }
});

const CLIENT_FALLBACK_RE = /<(NuxtClientFallback|nuxt-client-fallback)( [^>]*)?>/;
const CLIENT_FALLBACK_GLOBAL_RE = /<(NuxtClientFallback|nuxt-client-fallback)( [^>]*)?>/g;
const clientFallbackAutoIdPlugin = createUnplugin((options) => {
  const exclude = options.transform?.exclude || [];
  const include = options.transform?.include || [];
  return {
    name: "nuxt:client-fallback-auto-id",
    enforce: "pre",
    transformInclude(id) {
      if (exclude.some((pattern) => pattern.test(id))) {
        return false;
      }
      if (include.some((pattern) => pattern.test(id))) {
        return true;
      }
      return isVue(id);
    },
    transform(code, id) {
      if (!CLIENT_FALLBACK_RE.test(code)) {
        return;
      }
      const s = new MagicString(code);
      const relativeID = isAbsolute(id) ? relative(options.rootDir, id) : id;
      let count = 0;
      s.replace(CLIENT_FALLBACK_GLOBAL_RE, (full, name, attrs) => {
        count++;
        if (/ :?uid=/g.test(attrs)) {
          return full;
        }
        return `<${name} :uid="'${hash(relativeID)}' + JSON.stringify($props) + '${count}'"  ${attrs ?? ""}>`;
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

const createImportMagicComments = (options) => {
  const { chunkName, prefetch, preload } = options;
  return [
    `webpackChunkName: "${chunkName}"`,
    prefetch === true || typeof prefetch === "number" ? `webpackPrefetch: ${prefetch}` : false,
    preload === true || typeof preload === "number" ? `webpackPreload: ${preload}` : false
  ].filter(Boolean).join(", ");
};
const emptyComponentsPlugin = `
import { defineNuxtPlugin } from '#app/nuxt'
export default defineNuxtPlugin({
  name: 'nuxt:global-components',
})
`;
const componentsPluginTemplate = {
  filename: "components.plugin.mjs",
  getContents({ app }) {
    const lazyGlobalComponents = /* @__PURE__ */ new Set();
    const syncGlobalComponents = /* @__PURE__ */ new Set();
    for (const component of app.components) {
      if (component.global === "sync") {
        syncGlobalComponents.add(component.pascalName);
      } else if (component.global) {
        lazyGlobalComponents.add(component.pascalName);
      }
    }
    if (!lazyGlobalComponents.size && !syncGlobalComponents.size) {
      return emptyComponentsPlugin;
    }
    const lazyComponents = [...lazyGlobalComponents];
    const syncComponents = [...syncGlobalComponents];
    return `import { defineNuxtPlugin } from '#app/nuxt'
import { ${[...lazyComponents.map((c) => "Lazy" + c), ...syncComponents].join(", ")} } from '#components'
const lazyGlobalComponents = [
  ${lazyComponents.map((c) => `["${c}", Lazy${c}]`).join(",\n")},
  ${syncComponents.map((c) => `["${c}", ${c}]`).join(",\n")}
]

export default defineNuxtPlugin({
  name: 'nuxt:global-components',
  setup (nuxtApp) {
    for (const [name, component] of lazyGlobalComponents) {
      nuxtApp.vueApp.component(name, component)
      nuxtApp.vueApp.component('Lazy' + name, component)
    }
  }
})
`;
  }
};
const componentNamesTemplate = {
  filename: "component-names.mjs",
  getContents({ app }) {
    return `export const componentNames = ${JSON.stringify(app.components.filter((c) => !c.island).map((c) => c.pascalName))}`;
  }
};
const componentsIslandsTemplate = {
  // components.islands.mjs'
  getContents({ app }) {
    const components = app.components;
    const islands = components.filter(
      (component) => component.island || // .server components without a corresponding .client component will need to be rendered as an island
      component.mode === "server" && !components.some((c) => c.pascalName === component.pascalName && c.mode === "client")
    );
    return ["import { defineAsyncComponent } from 'vue'", ...islands.map(
      (c) => {
        const exp = c.export === "default" ? "c.default || c" : `c['${c.export}']`;
        const comment = createImportMagicComments(c);
        return `export const ${c.pascalName} = /* #__PURE__ */ defineAsyncComponent(${genDynamicImport(c.filePath, { comment })}.then(c => ${exp}))`;
      }
    )].join("\n");
  }
};
const componentsTypeTemplate = {
  filename: "components.d.ts",
  getContents: ({ app, nuxt }) => {
    const buildDir = nuxt.options.buildDir;
    const componentTypes = app.components.filter((c) => !c.island).map((c) => [
      c.pascalName,
      `typeof ${genDynamicImport(isAbsolute(c.filePath) ? relative(buildDir, c.filePath).replace(/(?<=\w)\.(?!vue)\w+$/g, "") : c.filePath.replace(/(?<=\w)\.(?!vue)\w+$/g, ""), { wrapper: false })}['${c.export}']`
    ]);
    return `// Generated by components discovery
declare module 'vue' {
  export interface GlobalComponents {
${componentTypes.map(([pascalName, type]) => `    '${pascalName}': ${type}`).join("\n")}
${componentTypes.map(([pascalName, type]) => `    'Lazy${pascalName}': ${type}`).join("\n")}
  }
}

${componentTypes.map(([pascalName, type]) => `export const ${pascalName}: ${type}`).join("\n")}
${componentTypes.map(([pascalName, type]) => `export const Lazy${pascalName}: ${type}`).join("\n")}

export const componentNames: string[]
`;
  }
};

async function scanComponents(dirs, srcDir) {
  const components = [];
  const filePaths = /* @__PURE__ */ new Set();
  const scannedPaths = [];
  for (const dir of dirs) {
    const resolvedNames = /* @__PURE__ */ new Map();
    const files = (await globby(dir.pattern, { cwd: dir.path, ignore: dir.ignore })).sort();
    if (files.length) {
      const siblings = await readdir(dirname(dir.path)).catch(() => []);
      const directory = basename(dir.path);
      if (!siblings.includes(directory)) {
        const directoryLowerCase = directory.toLowerCase();
        const caseCorrected = siblings.find((sibling) => sibling.toLowerCase() === directoryLowerCase);
        if (caseCorrected) {
          const nuxt = useNuxt();
          const original = relative(nuxt.options.srcDir, dir.path);
          const corrected = relative(nuxt.options.srcDir, join(dirname(dir.path), caseCorrected));
          logger.warn(`Components not scanned from \`~/${corrected}\`. Did you mean to name the directory \`~/${original}\` instead?`);
          continue;
        }
      }
    }
    for (const _file of files) {
      const filePath = join(dir.path, _file);
      if (scannedPaths.find((d) => filePath.startsWith(withTrailingSlash(d))) || isIgnored(filePath)) {
        continue;
      }
      if (filePaths.has(filePath)) {
        continue;
      }
      filePaths.add(filePath);
      const prefixParts = [].concat(
        dir.prefix ? splitByCase(dir.prefix) : [],
        dir.pathPrefix !== false ? splitByCase(relative(dir.path, dirname(filePath))) : []
      );
      let fileName = basename(filePath, extname(filePath));
      const island = /\.(island)(\.global)?$/.test(fileName) || dir.island;
      const global = /\.(global)(\.island)?$/.test(fileName) || dir.global;
      const mode = island ? "server" : fileName.match(/(?<=\.)(client|server)(\.global|\.island)*$/)?.[1] || "all";
      fileName = fileName.replace(/(\.(client|server))?(\.global|\.island)*$/, "");
      if (fileName.toLowerCase() === "index") {
        fileName = dir.pathPrefix === false ? basename(dirname(filePath)) : "";
      }
      const suffix = mode !== "all" ? `-${mode}` : "";
      const componentName = resolveComponentName(fileName, prefixParts);
      if (resolvedNames.has(componentName + suffix) || resolvedNames.has(componentName)) {
        warnAboutDuplicateComponent(componentName, filePath, resolvedNames.get(componentName) || resolvedNames.get(componentName + suffix));
        continue;
      }
      resolvedNames.set(componentName + suffix, filePath);
      const pascalName = pascalCase(componentName).replace(/["']/g, "");
      const kebabName = hyphenate(componentName);
      const shortPath = relative(srcDir, filePath);
      const chunkName = "components/" + kebabName + suffix;
      let component = {
        // inheritable from directory configuration
        mode,
        global,
        island,
        prefetch: Boolean(dir.prefetch),
        preload: Boolean(dir.preload),
        // specific to the file
        filePath,
        pascalName,
        kebabName,
        chunkName,
        shortPath,
        export: "default",
        // by default, give priority to scanned components
        priority: dir.priority ?? 1
      };
      if (typeof dir.extendComponent === "function") {
        component = await dir.extendComponent(component) || component;
      }
      if (!componentName) {
        logger.warn(`Component did not resolve to a file name in \`~/${relative(srcDir, filePath)}\`.`);
        continue;
      }
      const existingComponent = components.find((c) => c.pascalName === component.pascalName && ["all", component.mode].includes(c.mode));
      if (existingComponent) {
        const existingPriority = existingComponent.priority ?? 0;
        const newPriority = component.priority ?? 0;
        if (newPriority > existingPriority) {
          components.splice(components.indexOf(existingComponent), 1, component);
        }
        if (newPriority > 0 && newPriority === existingPriority) {
          warnAboutDuplicateComponent(componentName, filePath, existingComponent.filePath);
        }
        continue;
      }
      components.push(component);
    }
    scannedPaths.push(dir.path);
  }
  return components;
}
function resolveComponentName(fileName, prefixParts) {
  const fileNameParts = splitByCase(fileName);
  const fileNamePartsContent = fileNameParts.join("/").toLowerCase();
  const componentNameParts = [...prefixParts];
  let index = prefixParts.length - 1;
  const matchedSuffix = [];
  while (index >= 0) {
    matchedSuffix.unshift(...splitByCase(prefixParts[index] || "").map((p) => p.toLowerCase()));
    const matchedSuffixContent = matchedSuffix.join("/");
    if (fileNamePartsContent === matchedSuffixContent || fileNamePartsContent.startsWith(matchedSuffixContent + "/") || // e.g Item/Item/Item.vue -> Item
    prefixParts[index].toLowerCase() === fileNamePartsContent && prefixParts[index + 1] && prefixParts[index] === prefixParts[index + 1]) {
      componentNameParts.length = index;
    }
    index--;
  }
  return pascalCase(componentNameParts) + pascalCase(fileNameParts);
}
function warnAboutDuplicateComponent(componentName, filePath, duplicatePath) {
  logger.warn(
    `Two component files resolving to the same name \`${componentName}\`:

 - ${filePath}
 - ${duplicatePath}`
  );
}

const loaderPlugin = createUnplugin((options) => {
  const exclude = options.transform?.exclude || [];
  const include = options.transform?.include || [];
  const serverComponentRuntime = resolve(distDir, "components/runtime/server-component");
  return {
    name: "nuxt:components-loader",
    enforce: "post",
    transformInclude(id) {
      if (exclude.some((pattern) => pattern.test(id))) {
        return false;
      }
      if (include.some((pattern) => pattern.test(id))) {
        return true;
      }
      return isVue(id, { type: ["template", "script"] }) || !!id.match(/\.[tj]sx$/);
    },
    transform(code) {
      const components = options.getComponents();
      let num = 0;
      const imports = /* @__PURE__ */ new Set();
      const map = /* @__PURE__ */ new Map();
      const s = new MagicString(code);
      s.replace(/(?<=[ (])_?resolveComponent\(\s*["'](lazy-|Lazy)?([^'"]*?)["'][\s,]*[^)]*\)/g, (full, lazy, name) => {
        const component = findComponent(components, name, options.mode);
        if (component) {
          let identifier = map.get(component) || `__nuxt_component_${num++}`;
          map.set(component, identifier);
          const isServerOnly = !component._raw && component.mode === "server" && !components.some((c) => c.pascalName === component.pascalName && c.mode === "client");
          if (isServerOnly) {
            imports.add(genImport(serverComponentRuntime, [{ name: "createServerComponent" }]));
            imports.add(`const ${identifier} = createServerComponent(${JSON.stringify(name)})`);
            if (!options.experimentalComponentIslands) {
              logger.warn(`Standalone server components (\`${name}\`) are not yet supported without enabling \`experimental.componentIslands\`.`);
            }
            return identifier;
          }
          const isClientOnly = !component._raw && component.mode === "client";
          if (isClientOnly) {
            imports.add(genImport("#app/components/client-only", [{ name: "createClientOnly" }]));
            identifier += "_client";
          }
          if (lazy) {
            imports.add(genImport("vue", [{ name: "defineAsyncComponent", as: "__defineAsyncComponent" }]));
            identifier += "_lazy";
            imports.add(`const ${identifier} = /*#__PURE__*/ __defineAsyncComponent(${genDynamicImport(component.filePath, { interopDefault: true })}${isClientOnly ? ".then(c => createClientOnly(c))" : ""})`);
          } else {
            imports.add(genImport(component.filePath, [{ name: component.export, as: identifier }]));
            if (isClientOnly) {
              imports.add(`const ${identifier}_wrapped = /*#__PURE__*/ createClientOnly(${identifier})`);
              identifier += "_wrapped";
            }
          }
          return identifier;
        }
        return full;
      });
      if (imports.size) {
        s.prepend([...imports, ""].join("\n"));
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
function findComponent(components, name, mode) {
  const id = pascalCase(name).replace(/["']/g, "");
  const component = components.find((component2) => id === component2.pascalName && ["all", mode, void 0].includes(component2.mode));
  if (component) {
    return component;
  }
  const otherModeComponent = components.find((component2) => id === component2.pascalName);
  if (mode === "server" && otherModeComponent) {
    return components.find((c) => c.pascalName === "ServerPlaceholder");
  }
  return otherModeComponent;
}

const SSR_RENDER_RE = /ssrRenderComponent/;
const PLACEHOLDER_EXACT_RE = /^(fallback|placeholder)$/;
const CLIENT_ONLY_NAME_RE = /^(?:_unref\()?(?:_component_)?(?:Lazy|lazy_)?(?:client_only|ClientOnly\)?)$/;
const PARSER_OPTIONS = { sourceType: "module", ecmaVersion: "latest" };
const TreeShakeTemplatePlugin = createUnplugin((options) => {
  const regexpMap = /* @__PURE__ */ new WeakMap();
  return {
    name: "nuxt:tree-shake-template",
    enforce: "post",
    transformInclude(id) {
      const { pathname } = parseURL(decodeURIComponent(pathToFileURL(id).href));
      return pathname.endsWith(".vue");
    },
    transform(code) {
      const components = options.getComponents();
      if (!regexpMap.has(components)) {
        const clientOnlyComponents = components.filter((c) => c.mode === "client" && !components.some((other) => other.mode !== "client" && other.pascalName === c.pascalName && other.filePath !== resolve(distDir, "app/components/server-placeholder"))).flatMap((c) => [c.pascalName, c.kebabName.replaceAll("-", "_")]).concat(["ClientOnly", "client_only"]);
        regexpMap.set(components, [new RegExp(`(${clientOnlyComponents.join("|")})`), new RegExp(`^(${clientOnlyComponents.map((c) => `(?:(?:_unref\\()?(?:_component_)?(?:Lazy|lazy_)?${c}\\)?)`).join("|")})$`), clientOnlyComponents]);
      }
      const s = new MagicString(code);
      const [COMPONENTS_RE, COMPONENTS_IDENTIFIERS_RE] = regexpMap.get(components);
      if (!COMPONENTS_RE.test(code)) {
        return;
      }
      const codeAst = this.parse(code, PARSER_OPTIONS);
      const componentsToRemoveSet = /* @__PURE__ */ new Set();
      walk(codeAst, {
        enter: (_node) => {
          const node = _node;
          if (isSsrRender(node)) {
            const [componentCall, _, children] = node.arguments;
            if (componentCall.type === "Identifier" || componentCall.type === "MemberExpression" || componentCall.type === "CallExpression") {
              const componentName = getComponentName(node);
              const isClientComponent = COMPONENTS_IDENTIFIERS_RE.test(componentName);
              const isClientOnlyComponent = CLIENT_ONLY_NAME_RE.test(componentName);
              if (isClientComponent && children?.type === "ObjectExpression") {
                const slotsToRemove = isClientOnlyComponent ? children.properties.filter((prop) => prop.type === "Property" && prop.key.type === "Identifier" && !PLACEHOLDER_EXACT_RE.test(prop.key.name)) : children.properties;
                for (const slot of slotsToRemove) {
                  s.remove(slot.start, slot.end + 1);
                  const removedCode = `({${code.slice(slot.start, slot.end + 1)}})`;
                  const currentCodeAst = this.parse(s.toString(), PARSER_OPTIONS);
                  walk(this.parse(removedCode, PARSER_OPTIONS), {
                    enter: (_node2) => {
                      const node2 = _node2;
                      if (isSsrRender(node2)) {
                        const name = getComponentName(node2);
                        const nameToRemove = isComponentNotCalledInSetup(currentCodeAst, name);
                        if (nameToRemove) {
                          componentsToRemoveSet.add(nameToRemove);
                        }
                      }
                    }
                  });
                }
              }
            }
          }
        }
      });
      const componentsToRemove = [...componentsToRemoveSet];
      const removedNodes = /* @__PURE__ */ new WeakSet();
      for (const componentName of componentsToRemove) {
        removeImportDeclaration(codeAst, componentName, s);
        removeVariableDeclarator(codeAst, componentName, s, removedNodes);
        removeFromSetupReturn(codeAst, componentName, s);
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
function removeFromSetupReturn(codeAst, name, magicString) {
  let walkedInSetup = false;
  walk(codeAst, {
    enter(node) {
      if (walkedInSetup) {
        this.skip();
      } else if (node.type === "Property" && node.key.type === "Identifier" && node.key.name === "setup" && (node.value.type === "FunctionExpression" || node.value.type === "ArrowFunctionExpression")) {
        walkedInSetup = true;
        if (node.value.body.type === "BlockStatement") {
          const returnStatement = node.value.body.body.find((statement) => statement.type === "ReturnStatement");
          if (returnStatement && returnStatement.argument?.type === "ObjectExpression") {
            removePropertyFromObject(returnStatement.argument, name, magicString);
          }
          const variableList = node.value.body.body.filter((statement) => statement.type === "VariableDeclaration");
          const returnedVariableDeclaration = variableList.find((declaration) => declaration.declarations[0]?.id.type === "Identifier" && declaration.declarations[0]?.id.name === "__returned__" && declaration.declarations[0]?.init?.type === "ObjectExpression");
          if (returnedVariableDeclaration) {
            const init = returnedVariableDeclaration.declarations[0].init;
            removePropertyFromObject(init, name, magicString);
          }
        }
      }
    }
  });
}
function removePropertyFromObject(node, name, magicString) {
  for (const property of node.properties) {
    if (property.type === "Property" && property.key.type === "Identifier" && property.key.name === name) {
      magicString.remove(property.start, property.end + 1);
      return true;
    }
  }
  return false;
}
function isSsrRender(node) {
  return node.type === "CallExpression" && node.callee.type === "Identifier" && SSR_RENDER_RE.test(node.callee.name);
}
function removeImportDeclaration(ast, importName, magicString) {
  for (const node of ast.body) {
    if (node.type === "ImportDeclaration") {
      const specifier = node.specifiers.find((s) => s.local.name === importName);
      if (specifier) {
        if (node.specifiers.length > 1) {
          const specifierIndex = node.specifiers.findIndex((s) => s.local.name === importName);
          if (specifierIndex > -1) {
            magicString.remove(node.specifiers[specifierIndex].start, node.specifiers[specifierIndex].end + 1);
            node.specifiers.splice(specifierIndex, 1);
          }
        } else {
          magicString.remove(node.start, node.end);
        }
        return true;
      }
    }
  }
  return false;
}
function isComponentNotCalledInSetup(codeAst, name) {
  if (name) {
    let found = false;
    walk(codeAst, {
      enter(node) {
        if (node.type === "Property" && node.key.type === "Identifier" && node.value.type === "FunctionExpression" && node.key.name === "setup" || node.type === "FunctionDeclaration" && node.id?.name === "_sfc_ssrRender") {
          walk(node, {
            enter(node2) {
              if (found || node2.type === "VariableDeclaration") {
                this.skip();
              } else if (node2.type === "Identifier" && node2.name === name) {
                found = true;
              } else if (node2.type === "MemberExpression") {
                found = node2.property.type === "Literal" && node2.property.value === name || node2.property.type === "Identifier" && node2.property.name === name;
              }
            }
          });
        }
      }
    });
    if (!found) {
      return name;
    }
  }
}
function getComponentName(ssrRenderNode) {
  const componentCall = ssrRenderNode.arguments[0];
  if (componentCall.type === "Identifier") {
    return componentCall.name;
  } else if (componentCall.type === "MemberExpression") {
    return componentCall.property.value;
  }
  return componentCall.arguments[0].name;
}
function removeVariableDeclarator(codeAst, name, magicString, removedNodes) {
  walk(codeAst, {
    enter(node) {
      if (node.type === "VariableDeclaration") {
        for (const declarator of node.declarations) {
          const toRemove = findMatchingPatternToRemove(declarator.id, node, name, removedNodes);
          if (toRemove) {
            magicString.remove(toRemove.start, toRemove.end + 1);
            removedNodes.add(toRemove);
            return toRemove;
          }
        }
      }
    }
  });
}
function findMatchingPatternToRemove(node, toRemoveIfMatched, name, removedNodeSet) {
  if (node.type === "Identifier") {
    if (node.name === name) {
      return toRemoveIfMatched;
    }
  } else if (node.type === "ArrayPattern") {
    const elements = node.elements.filter((e) => e !== null && !removedNodeSet.has(e));
    for (const element of elements) {
      const matched = findMatchingPatternToRemove(element, elements.length > 1 ? element : toRemoveIfMatched, name, removedNodeSet);
      if (matched) {
        return matched;
      }
    }
  } else if (node.type === "ObjectPattern") {
    const properties = node.properties.filter((e) => e.type === "Property" && !removedNodeSet.has(e));
    for (const [index, property] of properties.entries()) {
      let nodeToRemove = property;
      if (properties.length < 2) {
        nodeToRemove = toRemoveIfMatched;
      }
      const matched = findMatchingPatternToRemove(property.value, nodeToRemove, name, removedNodeSet);
      if (matched) {
        if (matched === property) {
          properties.splice(index, 1);
        }
        return matched;
      }
    }
  } else if (node.type === "AssignmentPattern") {
    const matched = findMatchingPatternToRemove(node.left, toRemoveIfMatched, name, removedNodeSet);
    if (matched) {
      return matched;
    }
  }
}

const SCRIPT_RE = /<script[^>]*>/g;
const HAS_SLOT_RE = /<slot[^>]*>/;
const TEMPLATE_RE = /<template>([\s\S]*)<\/template>/;
const islandsTransform = createUnplugin((options) => {
  return {
    name: "server-only-component-transform",
    enforce: "pre",
    transformInclude(id) {
      if (!isVue(id)) {
        return false;
      }
      const components = options.getComponents();
      const islands = components.filter(
        (component) => component.island || component.mode === "server" && !components.some((c) => c.pascalName === component.pascalName && c.mode === "client")
      );
      const { pathname } = parseURL(decodeURIComponent(pathToFileURL(id).href));
      return islands.some((c) => c.filePath === pathname);
    },
    async transform(code, id) {
      if (!HAS_SLOT_RE.test(code)) {
        return;
      }
      const template = code.match(TEMPLATE_RE);
      if (!template) {
        return;
      }
      const startingIndex = template.index || 0;
      const s = new MagicString(code);
      s.replace(SCRIPT_RE, (full) => {
        return full + "\nimport { vforToArray as __vforToArray } from '#app/components/utils'";
      });
      const ast = parse$1(template[0]);
      await walk$1(ast, (node) => {
        if (node.type === ELEMENT_NODE && node.name === "slot") {
          const { attributes, children, loc, isSelfClosingTag } = node;
          const slotName = attributes.name ?? "default";
          let vfor;
          if (attributes["v-for"]) {
            vfor = attributes["v-for"].split(" in ").map((v) => v.trim());
            delete attributes["v-for"];
          }
          if (attributes.name) {
            delete attributes.name;
          }
          if (attributes["v-bind"]) {
            attributes._bind = attributes["v-bind"];
            delete attributes["v-bind"];
          }
          const bindings = getBindings(attributes, vfor);
          if (isSelfClosingTag) {
            s.overwrite(startingIndex + loc[0].start, startingIndex + loc[0].end, `<div style="display: contents;" nuxt-ssr-slot-name="${slotName}" ${bindings}/>`);
          } else {
            s.overwrite(startingIndex + loc[0].start, startingIndex + loc[0].end, `<div style="display: contents;" nuxt-ssr-slot-name="${slotName}" ${bindings}>`);
            s.overwrite(startingIndex + loc[1].start, startingIndex + loc[1].end, "</div>");
            if (children.length > 1) {
              const wrapperTag = `<div ${vfor ? `v-for="${vfor[0]} in ${vfor[1]}"` : ""} style="display: contents;">`;
              s.appendRight(startingIndex + loc[0].end, `<div nuxt-slot-fallback-start="${slotName}"/>${wrapperTag}`);
              s.appendLeft(startingIndex + loc[1].start, "</div><div nuxt-slot-fallback-end/>");
            } else if (children.length === 1) {
              if (vfor && children[0].type === ELEMENT_NODE) {
                const { loc: loc2, name, attributes: attributes2, isSelfClosingTag: isSelfClosingTag2 } = children[0];
                const attrs = Object.entries(attributes2).map(([attr, val]) => `${attr}="${val}"`).join(" ");
                s.overwrite(startingIndex + loc2[0].start, startingIndex + loc2[0].end, `<${name} v-for="${vfor[0]} in ${vfor[1]}" ${attrs} ${isSelfClosingTag2 ? "/" : ""}>`);
              }
              s.appendRight(startingIndex + loc[0].end, `<div nuxt-slot-fallback-start="${slotName}"/>`);
              s.appendLeft(startingIndex + loc[1].start, "<div nuxt-slot-fallback-end/>");
            }
          }
        }
      });
      if (s.hasChanged()) {
        return {
          code: s.toString(),
          map: s.generateMap({ source: id, includeContent: true })
        };
      }
    }
  };
});
function isBinding(attr) {
  return attr.startsWith(":");
}
function getBindings(bindings, vfor) {
  if (Object.keys(bindings).length === 0) {
    return "";
  }
  const content = Object.entries(bindings).filter((b) => b[0] !== "_bind").map(([name, value]) => isBinding(name) ? `${name.slice(1)}: ${value}` : `${name}: \`${value}\``).join(",");
  const data = bindings._bind ? `mergeProps(${bindings._bind}, { ${content} })` : `{ ${content} }`;
  if (!vfor) {
    return `:nuxt-ssr-slot-data="JSON.stringify([${data}])"`;
  } else {
    return `:nuxt-ssr-slot-data="JSON.stringify(__vforToArray(${vfor[1]}).map(${vfor[0]} => (${data})))"`;
  }
}

const COMPONENT_QUERY_RE = /[?&]nuxt_component=/;
function createTransformPlugin(nuxt, getComponents, mode) {
  const serverComponentRuntime = resolve(distDir, "components/runtime/server-component");
  const componentUnimport = createUnimport({
    imports: [
      {
        name: "componentNames",
        from: "#build/component-names"
      }
    ],
    virtualImports: ["#components"]
  });
  function getComponentsImports() {
    const components = getComponents(mode);
    return components.flatMap((c) => {
      const withMode = (mode3) => mode3 ? `${c.filePath}${c.filePath.includes("?") ? "&" : "?"}nuxt_component=${mode3}&nuxt_component_name=${c.pascalName}` : c.filePath;
      const mode2 = !c._raw && c.mode && ["client", "server"].includes(c.mode) ? c.mode : void 0;
      return [
        {
          as: c.pascalName,
          from: withMode(mode2),
          name: "default"
        },
        {
          as: "Lazy" + c.pascalName,
          from: withMode([mode2, "async"].filter(Boolean).join(",")),
          name: "default"
        }
      ];
    });
  }
  return createUnplugin(() => ({
    name: "nuxt:components:imports",
    transformInclude(id) {
      id = normalize(id);
      return id.startsWith("virtual:") || id.startsWith("\0virtual:") || id.startsWith(nuxt.options.buildDir) || !isIgnored(id);
    },
    async transform(code, id) {
      if (COMPONENT_QUERY_RE.test(id)) {
        const { search } = parseURL(id);
        const query = parseQuery$1(search);
        const mode2 = query.nuxt_component;
        const bare = id.replace(/\?.*/, "");
        if (mode2 === "async") {
          return {
            code: [
              'import { defineAsyncComponent } from "vue"',
              `export default defineAsyncComponent(() => import(${JSON.stringify(bare)}).then(r => r.default))`
            ].join("\n"),
            map: null
          };
        } else if (mode2 === "client") {
          return {
            code: [
              `import __component from ${JSON.stringify(bare)}`,
              'import { createClientOnly } from "#app/components/client-only"',
              "export default createClientOnly(__component)"
            ].join("\n"),
            map: null
          };
        } else if (mode2 === "client,async") {
          return {
            code: [
              'import { defineAsyncComponent } from "vue"',
              'import { createClientOnly } from "#app/components/client-only"',
              `export default defineAsyncComponent(() => import(${JSON.stringify(bare)}).then(r => createClientOnly(r.default)))`
            ].join("\n"),
            map: null
          };
        } else if (mode2 === "server" || mode2 === "server,async") {
          const name = query.nuxt_component_name;
          return {
            code: [
              `import { createServerComponent } from ${JSON.stringify(serverComponentRuntime)}`,
              `export default createServerComponent(${JSON.stringify(name)})`
            ].join("\n"),
            map: null
          };
        } else {
          throw new Error(`Unknown component mode: ${mode2}, this might be an internal bug of Nuxt.`);
        }
      }
      if (!code.includes("#components")) {
        return;
      }
      componentUnimport.modifyDynamicImports((imports) => {
        imports.length = 0;
        imports.push(...getComponentsImports());
        return imports;
      });
      const result = await componentUnimport.injectImports(code, id, { autoImport: false, transformVirtualImports: true });
      if (!result) {
        return;
      }
      return {
        code: result.code,
        map: nuxt.options.sourcemap.server || nuxt.options.sourcemap.client ? result.s.generateMap({ hires: true }) : void 0
      };
    }
  }));
}

const isPureObjectOrString = (val) => !Array.isArray(val) && typeof val === "object" || typeof val === "string";
const isDirectory = (p) => {
  try {
    return statSync(p).isDirectory();
  } catch (_e) {
    return false;
  }
};
function compareDirByPathLength({ path: pathA }, { path: pathB }) {
  return pathB.split(/[\\/]/).filter(Boolean).length - pathA.split(/[\\/]/).filter(Boolean).length;
}
const DEFAULT_COMPONENTS_DIRS_RE = /\/components(\/global|\/islands)?$/;
const componentsModule = defineNuxtModule({
  meta: {
    name: "components",
    configKey: "components"
  },
  defaults: {
    dirs: []
  },
  setup(componentOptions, nuxt) {
    let componentDirs = [];
    const context = {
      components: []
    };
    const getComponents = (mode) => {
      return mode && mode !== "all" ? context.components.filter((c) => c.mode === mode || c.mode === "all" || c.mode === "server" && !context.components.some((otherComponent) => otherComponent.mode !== "server" && otherComponent.pascalName === c.pascalName)) : context.components;
    };
    const normalizeDirs = (dir, cwd, options) => {
      if (Array.isArray(dir)) {
        return dir.map((dir2) => normalizeDirs(dir2, cwd, options)).flat().sort(compareDirByPathLength);
      }
      if (dir === true || dir === void 0) {
        return [
          { priority: options?.priority || 0, path: resolve(cwd, "components/islands"), island: true },
          { priority: options?.priority || 0, path: resolve(cwd, "components/global"), global: true },
          { priority: options?.priority || 0, path: resolve(cwd, "components") }
        ];
      }
      if (typeof dir === "string") {
        return [
          { priority: options?.priority || 0, path: resolve(cwd, resolveAlias(dir)) }
        ];
      }
      if (!dir) {
        return [];
      }
      const dirs = (dir.dirs || [dir]).map((dir2) => typeof dir2 === "string" ? { path: dir2 } : dir2).filter((_dir) => _dir.path);
      return dirs.map((_dir) => ({
        priority: options?.priority || 0,
        ..._dir,
        path: resolve(cwd, resolveAlias(_dir.path))
      }));
    };
    nuxt.hook("app:resolve", async () => {
      const allDirs = nuxt.options._layers.map((layer) => normalizeDirs(layer.config.components, layer.config.srcDir, { priority: layer.config.srcDir === nuxt.options.srcDir ? 1 : 0 })).flat();
      await nuxt.callHook("components:dirs", allDirs);
      componentDirs = allDirs.filter(isPureObjectOrString).map((dir) => {
        const dirOptions = typeof dir === "object" ? dir : { path: dir };
        const dirPath = resolveAlias(dirOptions.path);
        const transpile = typeof dirOptions.transpile === "boolean" ? dirOptions.transpile : "auto";
        const extensions = (dirOptions.extensions || nuxt.options.extensions).map((e) => e.replace(/^\./g, ""));
        const present = isDirectory(dirPath);
        if (!present && !DEFAULT_COMPONENTS_DIRS_RE.test(dirOptions.path)) {
          logger.warn("Components directory not found: `" + dirPath + "`");
        }
        return {
          global: componentOptions.global,
          ...dirOptions,
          // TODO: https://github.com/nuxt/framework/pull/251
          enabled: true,
          path: dirPath,
          extensions,
          pattern: dirOptions.pattern || `**/*.{${extensions.join(",")},}`,
          ignore: [
            "**/*{M,.m,-m}ixin.{js,ts,jsx,tsx}",
            // ignore mixins
            "**/*.d.{cts,mts,ts}",
            // .d.ts files
            ...dirOptions.ignore || []
          ],
          transpile: transpile === "auto" ? dirPath.includes("node_modules") : transpile
        };
      }).filter((d) => d.enabled);
      componentDirs = [
        ...componentDirs.filter((dir) => !dir.path.includes("node_modules")),
        ...componentDirs.filter((dir) => dir.path.includes("node_modules"))
      ];
      nuxt.options.build.transpile.push(...componentDirs.filter((dir) => dir.transpile).map((dir) => dir.path));
    });
    addTemplate(componentsTypeTemplate);
    addPluginTemplate(componentsPluginTemplate);
    addTemplate(componentNamesTemplate);
    if (nuxt.options.experimental.componentIslands) {
      addTemplate({ ...componentsIslandsTemplate, filename: "components.islands.mjs" });
    } else {
      addTemplate({ filename: "components.islands.mjs", getContents: () => "export default {}" });
    }
    const unpluginServer = createTransformPlugin(nuxt, getComponents, "server");
    const unpluginClient = createTransformPlugin(nuxt, getComponents, "client");
    addVitePlugin(() => unpluginServer.vite(), { server: true, client: false });
    addVitePlugin(() => unpluginClient.vite(), { server: false, client: true });
    addWebpackPlugin(() => unpluginServer.webpack(), { server: true, client: false });
    addWebpackPlugin(() => unpluginClient.webpack(), { server: false, client: true });
    nuxt.hook("build:manifest", (manifest) => {
      const sourceFiles = getComponents().filter((c) => c.global).map((c) => relative(nuxt.options.srcDir, c.filePath));
      for (const key in manifest) {
        if (manifest[key].isEntry) {
          manifest[key].dynamicImports = manifest[key].dynamicImports?.filter((i) => !sourceFiles.includes(i));
        }
      }
    });
    nuxt.hook("builder:watch", (event, relativePath) => {
      if (!["addDir", "unlinkDir"].includes(event)) {
        return;
      }
      const path = resolve(nuxt.options.srcDir, relativePath);
      if (componentDirs.some((dir) => dir.path === path)) {
        logger.info(`Directory \`${relativePath}/\` ${event === "addDir" ? "created" : "removed"}`);
        return nuxt.callHook("restart");
      }
    });
    nuxt.hook("app:templates", async (app) => {
      const newComponents = await scanComponents(componentDirs, nuxt.options.srcDir);
      await nuxt.callHook("components:extend", newComponents);
      for (const component of newComponents) {
        if (component.mode === "client" && !newComponents.some((c) => c.pascalName === component.pascalName && c.mode === "server")) {
          newComponents.push({
            ...component,
            _raw: true,
            mode: "server",
            filePath: resolve(distDir, "app/components/server-placeholder"),
            chunkName: "components/" + component.kebabName
          });
        }
      }
      context.components = newComponents;
      app.components = newComponents;
    });
    nuxt.hook("prepare:types", ({ references, tsConfig }) => {
      tsConfig.compilerOptions.paths["#components"] = [resolve(nuxt.options.buildDir, "components")];
      references.push({ path: resolve(nuxt.options.buildDir, "components.d.ts") });
    });
    nuxt.hook("builder:watch", async (event, relativePath) => {
      if (!["add", "unlink"].includes(event)) {
        return;
      }
      const path = resolve(nuxt.options.srcDir, relativePath);
      if (componentDirs.some((dir) => path.startsWith(dir.path + "/"))) {
        await updateTemplates({
          filter: (template) => [
            "components.plugin.mjs",
            "components.d.ts",
            "components.server.mjs",
            "components.client.mjs"
          ].includes(template.filename)
        });
      }
    });
    nuxt.hook("vite:extendConfig", (config, { isClient, isServer }) => {
      const mode = isClient ? "client" : "server";
      config.plugins = config.plugins || [];
      if (nuxt.options.experimental.treeshakeClientOnly && isServer) {
        config.plugins.push(TreeShakeTemplatePlugin.vite({
          sourcemap: !!nuxt.options.sourcemap[mode],
          getComponents
        }));
      }
      config.plugins.push(clientFallbackAutoIdPlugin.vite({
        sourcemap: !!nuxt.options.sourcemap[mode],
        rootDir: nuxt.options.rootDir
      }));
      config.plugins.push(loaderPlugin.vite({
        sourcemap: !!nuxt.options.sourcemap[mode],
        getComponents,
        mode,
        transform: typeof nuxt.options.components === "object" && !Array.isArray(nuxt.options.components) ? nuxt.options.components.transform : void 0,
        experimentalComponentIslands: !!nuxt.options.experimental.componentIslands
      }));
      if (isServer && nuxt.options.experimental.componentIslands) {
        config.plugins.push(islandsTransform.vite({
          getComponents
        }));
      }
      if (!isServer && nuxt.options.experimental.componentIslands) {
        config.plugins.push({
          name: "nuxt-server-component-hmr",
          handleHotUpdate(ctx) {
            const components = getComponents();
            const filePath = normalize(ctx.file);
            const comp = components.find((c) => c.filePath === filePath);
            if (comp?.mode === "server") {
              ctx.server.ws.send({
                event: `nuxt-server-component:${comp.pascalName}`,
                type: "custom"
              });
            }
          }
        });
      }
    });
    nuxt.hook("webpack:config", (configs) => {
      configs.forEach((config) => {
        const mode = config.name === "client" ? "client" : "server";
        config.plugins = config.plugins || [];
        if (nuxt.options.experimental.treeshakeClientOnly && mode === "server") {
          config.plugins.push(TreeShakeTemplatePlugin.webpack({
            sourcemap: !!nuxt.options.sourcemap[mode],
            getComponents
          }));
        }
        config.plugins.push(clientFallbackAutoIdPlugin.webpack({
          sourcemap: !!nuxt.options.sourcemap[mode],
          rootDir: nuxt.options.rootDir
        }));
        config.plugins.push(loaderPlugin.webpack({
          sourcemap: !!nuxt.options.sourcemap[mode],
          getComponents,
          mode,
          transform: typeof nuxt.options.components === "object" && !Array.isArray(nuxt.options.components) ? nuxt.options.components.transform : void 0,
          experimentalComponentIslands: !!nuxt.options.experimental.componentIslands
        }));
        if (nuxt.options.experimental.componentIslands && mode === "server") {
          config.plugins.push(islandsTransform.webpack({
            getComponents
          }));
        }
      });
    });
  }
});

const NODE_MODULES_RE = /[\\/]node_modules[\\/]/;
const IMPORTS_RE = /(['"])#imports\1/;
const TransformPlugin = createUnplugin(({ ctx, options, sourcemap }) => {
  return {
    name: "nuxt:imports-transform",
    enforce: "post",
    transformInclude(id) {
      if (options.transform?.include?.some((pattern) => pattern.test(id))) {
        return true;
      }
      if (options.transform?.exclude?.some((pattern) => pattern.test(id))) {
        return false;
      }
      if (isVue(id, { type: ["script", "template"] })) {
        return true;
      }
      return isJS(id);
    },
    async transform(code, id) {
      id = normalize(id);
      const isNodeModule = NODE_MODULES_RE.test(id) && !options.transform?.include?.some((pattern) => pattern.test(id));
      if (isNodeModule && !IMPORTS_RE.test(code)) {
        return;
      }
      const { s } = await ctx.injectImports(code, id, { autoImport: options.autoImport && !isNodeModule });
      if (s.hasChanged()) {
        return {
          code: s.toString(),
          map: sourcemap ? s.generateMap({ hires: true }) : void 0
        };
      }
    }
  };
});

const commonPresets = [
  // vue-demi (mocked)
  defineUnimportPreset({
    from: "vue-demi",
    imports: [
      "isVue2",
      "isVue3"
    ]
  })
];
const appPreset = defineUnimportPreset({
  from: "#app",
  imports: [
    "useAsyncData",
    "useLazyAsyncData",
    "useNuxtData",
    "refreshNuxtData",
    "clearNuxtData",
    "defineNuxtComponent",
    "useNuxtApp",
    "defineNuxtPlugin",
    "definePayloadPlugin",
    "reloadNuxtApp",
    "useRuntimeConfig",
    "useState",
    "clearNuxtState",
    "useFetch",
    "useLazyFetch",
    "useCookie",
    "useRequestHeaders",
    "useRequestEvent",
    "useRequestFetch",
    "useRequestURL",
    "setResponseStatus",
    "setPageLayout",
    "prerenderRoutes",
    "onNuxtReady",
    "useRouter",
    "useRoute",
    "defineNuxtRouteMiddleware",
    "navigateTo",
    "abortNavigation",
    "addRouteMiddleware",
    "showError",
    "clearError",
    "isNuxtError",
    "useError",
    "createError",
    "defineNuxtLink",
    "useAppConfig",
    "updateAppConfig",
    "defineAppConfig",
    "preloadComponents",
    "preloadRouteComponents",
    "prefetchComponents",
    "loadPayload",
    "preloadPayload",
    "isPrerendered",
    "getAppManifest",
    "getRouteRules",
    "definePayloadReducer",
    "definePayloadReviver",
    "requestIdleCallback",
    "cancelIdleCallback"
  ]
});
const routerPreset = defineUnimportPreset({
  from: "#app",
  imports: [
    "onBeforeRouteLeave",
    "onBeforeRouteUpdate"
  ]
});
const vuePreset = defineUnimportPreset({
  from: "vue",
  imports: [
    // <script setup>
    "withCtx",
    "withDirectives",
    "withKeys",
    "withMemo",
    "withModifiers",
    "withScopeId",
    // Lifecycle
    "onActivated",
    "onBeforeMount",
    "onBeforeUnmount",
    "onBeforeUpdate",
    "onDeactivated",
    "onErrorCaptured",
    "onMounted",
    "onRenderTracked",
    "onRenderTriggered",
    "onServerPrefetch",
    "onUnmounted",
    "onUpdated",
    // Reactivity
    "computed",
    "customRef",
    "isProxy",
    "isReactive",
    "isReadonly",
    "isRef",
    "markRaw",
    "proxyRefs",
    "reactive",
    "readonly",
    "ref",
    "shallowReactive",
    "shallowReadonly",
    "shallowRef",
    "toRaw",
    "toRef",
    "toRefs",
    "triggerRef",
    "unref",
    "watch",
    "watchEffect",
    "watchPostEffect",
    "watchSyncEffect",
    "isShallow",
    // effect
    "effect",
    "effectScope",
    "getCurrentScope",
    "onScopeDispose",
    // Component
    "defineComponent",
    "defineAsyncComponent",
    "resolveComponent",
    "getCurrentInstance",
    "h",
    "inject",
    "hasInjectionContext",
    "nextTick",
    "provide",
    "defineModel",
    "defineOptions",
    "defineSlots",
    "mergeModels",
    "toValue",
    "useModel",
    "useAttrs",
    "useCssModule",
    "useCssVars",
    "useSlots",
    "useTransitionState"
  ]
});
const vueTypesPreset = defineUnimportPreset({
  from: "vue",
  type: true,
  imports: [
    "Component",
    "ComponentPublicInstance",
    "ComputedRef",
    "ExtractPropTypes",
    "ExtractPublicPropTypes",
    "InjectionKey",
    "PropType",
    "Ref",
    "MaybeRef",
    "MaybeRefOrGetter",
    "VNode"
  ]
});
const defaultPresets = [
  ...commonPresets,
  appPreset,
  routerPreset,
  vuePreset,
  vueTypesPreset
];

const importsModule = defineNuxtModule({
  meta: {
    name: "imports",
    configKey: "imports"
  },
  defaults: {
    autoImport: true,
    presets: defaultPresets,
    global: false,
    imports: [],
    dirs: [],
    transform: {
      include: [],
      exclude: void 0
    },
    virtualImports: ["#imports"]
  },
  async setup(options, nuxt) {
    const presets = JSON.parse(JSON.stringify(options.presets));
    await nuxt.callHook("imports:sources", presets);
    const ctx = createUnimport({
      ...options,
      addons: {
        vueTemplate: options.autoImport,
        ...options.addons
      },
      presets
    });
    await nuxt.callHook("imports:context", ctx);
    let composablesDirs = [];
    for (const layer of nuxt.options._layers) {
      composablesDirs.push(resolve(layer.config.srcDir, "composables"));
      composablesDirs.push(resolve(layer.config.srcDir, "utils"));
      for (const dir of layer.config.imports?.dirs ?? []) {
        if (!dir) {
          continue;
        }
        composablesDirs.push(resolve(layer.config.srcDir, dir));
      }
    }
    await nuxt.callHook("imports:dirs", composablesDirs);
    composablesDirs = composablesDirs.map((dir) => normalize(dir));
    nuxt.hook("builder:watch", (event, relativePath) => {
      if (!["addDir", "unlinkDir"].includes(event)) {
        return;
      }
      const path = resolve(nuxt.options.srcDir, relativePath);
      if (composablesDirs.includes(path)) {
        logger.info(`Directory \`${relativePath}/\` ${event === "addDir" ? "created" : "removed"}`);
        return nuxt.callHook("restart");
      }
    });
    addTemplate({
      filename: "imports.mjs",
      getContents: async () => await ctx.toExports() + '\nif (import.meta.dev) { console.warn("[nuxt] `#imports` should be transformed with real imports. There seems to be something wrong with the imports plugin.") }'
    });
    nuxt.options.alias["#imports"] = join(nuxt.options.buildDir, "imports");
    addVitePlugin(() => TransformPlugin.vite({ ctx, options, sourcemap: !!nuxt.options.sourcemap.server || !!nuxt.options.sourcemap.client }));
    addWebpackPlugin(() => TransformPlugin.webpack({ ctx, options, sourcemap: !!nuxt.options.sourcemap.server || !!nuxt.options.sourcemap.client }));
    const priorities = nuxt.options._layers.map((layer, i) => [layer.config.srcDir, -i]).sort(([a], [b]) => b.length - a.length);
    const regenerateImports = async () => {
      await ctx.modifyDynamicImports(async (imports) => {
        imports.length = 0;
        const composableImports = await scanDirExports(composablesDirs, {
          fileFilter: (file) => !isIgnored(file)
        });
        for (const i of composableImports) {
          i.priority = i.priority || priorities.find(([dir]) => i.from.startsWith(dir))?.[1];
        }
        imports.push(...composableImports);
        await nuxt.callHook("imports:extend", imports);
        return imports;
      });
    };
    await regenerateImports();
    addDeclarationTemplates(ctx, options);
    nuxt.hook("prepare:types", ({ references }) => {
      references.push({ path: resolve(nuxt.options.buildDir, "types/imports.d.ts") });
      references.push({ path: resolve(nuxt.options.buildDir, "imports.d.ts") });
    });
    const templates = [
      "types/imports.d.ts",
      "imports.d.ts",
      "imports.mjs"
    ];
    nuxt.hook("builder:watch", async (_, relativePath) => {
      const path = resolve(nuxt.options.srcDir, relativePath);
      if (composablesDirs.some((dir) => dir === path || path.startsWith(dir + "/"))) {
        await updateTemplates({
          filter: (template) => templates.includes(template.filename)
        });
      }
    });
    nuxt.hook("app:templatesGenerated", async () => {
      await regenerateImports();
    });
  }
});
function addDeclarationTemplates(ctx, options) {
  const nuxt = useNuxt();
  const stripExtension = (path) => path.replace(/\.[a-z]+$/, "");
  const resolvedImportPathMap = /* @__PURE__ */ new Map();
  const r = ({ from }) => resolvedImportPathMap.get(from);
  async function cacheImportPaths(imports) {
    for (const i of imports) {
      if (resolvedImportPathMap.has(i.from)) {
        continue;
      }
      let path = resolveAlias(i.from);
      if (!isAbsolute(path)) {
        path = await tryResolveModule(i.from, nuxt.options.modulesDir).then(async (r2) => {
          if (!r2) {
            return r2;
          }
          const { dir, name } = parseNodeModulePath(r2);
          if (!dir || !name) {
            return r2;
          }
          const subpath = await lookupNodeModuleSubpath(r2);
          return join(dir, name, subpath || "");
        }) ?? path;
      }
      if (isAbsolute(path)) {
        path = relative(join(nuxt.options.buildDir, "types"), path);
      }
      path = stripExtension(path);
      resolvedImportPathMap.set(i.from, path);
    }
  }
  addTemplate({
    filename: "imports.d.ts",
    getContents: () => ctx.toExports(nuxt.options.buildDir, true)
  });
  addTemplate({
    filename: "types/imports.d.ts",
    getContents: async () => {
      const imports = await ctx.getImports().then((r2) => r2.filter((i) => !i.type));
      await cacheImportPaths(imports);
      return "// Generated by auto imports\n" + (options.autoImport ? await ctx.generateTypeDeclarations({ resolvePath: r }) : "// Implicit auto importing is disabled, you can use explicitly import from `#imports` instead.");
    }
  });
}

const version = "3.7.4";

const _require = createRequire(import.meta.url);
const vueAppPatterns = (nuxt) => [
  [/^(nuxt3|nuxt)$/, "`nuxt3`/`nuxt` cannot be imported directly. Instead, import runtime Nuxt composables from `#app` or `#imports`."],
  [/^((|~|~~|@|@@)\/)?nuxt\.config(\.|$)/, "Importing directly from a `nuxt.config` file is not allowed. Instead, use runtime config or a module."],
  [/(^|node_modules\/)@vue\/composition-api/],
  ...nuxt.options.modules.filter((m) => typeof m === "string").map((m) => [new RegExp(`^${escapeRE(m)}$`), "Importing directly from module entry points is not allowed."]),
  ...[/(^|node_modules\/)@nuxt\/kit/, /(^|node_modules\/)nuxt\/(config|kit|schema)/, /^nitropack/].map((i) => [i, "This module cannot be imported in the Vue part of your app."]),
  [new RegExp(escapeRE(join(nuxt.options.srcDir, nuxt.options.dir.server || "server")) + "\\/(api|routes|middleware|plugins)\\/"), "Importing from server is not allowed in the Vue part of your app."]
];
const ImportProtectionPlugin = createUnplugin(function(options) {
  const cache = {};
  const importersToExclude = options?.exclude || [];
  return {
    name: "nuxt:import-protection",
    enforce: "pre",
    resolveId(id, importer) {
      if (!importer) {
        return;
      }
      if (id.startsWith(".")) {
        id = join(importer, "..", id);
      }
      if (isAbsolute(id)) {
        id = relative(options.rootDir, id);
      }
      if (importersToExclude.some((p) => typeof p === "string" ? importer === p : p.test(importer))) {
        return;
      }
      const invalidImports = options.patterns.filter(([pattern]) => pattern instanceof RegExp ? pattern.test(id) : pattern === id);
      let matched = false;
      for (const match of invalidImports) {
        cache[id] = cache[id] || /* @__PURE__ */ new Map();
        const [pattern, warning] = match;
        if (cache[id].has(pattern)) {
          continue;
        }
        const relativeImporter = isAbsolute(importer) ? relative(options.rootDir, importer) : importer;
        logger.error(warning || "Invalid import", `[importing \`${id}\` from \`${relativeImporter}\`]`);
        cache[id].set(pattern, true);
        matched = true;
      }
      if (matched) {
        return _require.resolve("unenv/runtime/mock/proxy");
      }
      return null;
    }
  };
});

const TRANSFORM_MARKER = "/* _processed_nuxt_unctx_transform */\n";
const UnctxTransformPlugin = createUnplugin((options) => {
  const transformer = createTransformer(options.transformerOptions);
  return {
    name: "unctx:transform",
    enforce: "post",
    transformInclude(id) {
      return isVue(id) || isJS(id);
    },
    transform(code) {
      if (code.startsWith(TRANSFORM_MARKER) || !transformer.shouldTransform(code)) {
        return;
      }
      const result = transformer.transform(code);
      if (result) {
        return {
          code: TRANSFORM_MARKER + result.code,
          map: options.sourcemap ? result.magicString.generateMap({ hires: true }) : void 0
        };
      }
    }
  };
});

const TreeShakeComposablesPlugin = createUnplugin((options) => {
  const composableNames = Object.values(options.composables).flat();
  const regexp = `(^\\s*)(${composableNames.join("|")})(?=\\((?!\\) \\{))`;
  const COMPOSABLE_RE = new RegExp(regexp, "m");
  const COMPOSABLE_RE_GLOBAL = new RegExp(regexp, "gm");
  return {
    name: "nuxt:tree-shake-composables:transform",
    enforce: "post",
    transformInclude(id) {
      return isVue(id, { type: ["script"] }) || isJS(id);
    },
    transform(code) {
      if (!COMPOSABLE_RE.test(code)) {
        return;
      }
      const s = new MagicString(code);
      const strippedCode = stripLiteral(code);
      for (const match of strippedCode.matchAll(COMPOSABLE_RE_GLOBAL) || []) {
        s.overwrite(match.index, match.index + match[0].length, `${match[1]} /*#__PURE__*/ false && ${match[2]}`);
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

const DevOnlyPlugin = createUnplugin((options, meta) => {
  const DEVONLY_COMP_RE = /<(?:dev-only|DevOnly)>[\s\S]*?<\/(?:dev-only|DevOnly)>/g;
  return {
    name: "nuxt:server-devonly:transform",
    enforce: "pre",
    transformInclude(id) {
      const { pathname, search } = parseURL(decodeURIComponent(pathToFileURL(id).href));
      const { type } = parseQuery(search);
      if (pathname.endsWith(".vue") && (meta.framework === "webpack" || type === "template" || !search)) {
        return true;
      }
    },
    transform(code) {
      if (!DEVONLY_COMP_RE.test(code)) {
        return;
      }
      const s = new MagicString(code);
      const strippedCode = stripLiteral(code);
      for (const match of strippedCode.matchAll(DEVONLY_COMP_RE) || []) {
        const ast = parse$1(match[0]).children[0];
        const fallback = ast.children?.find((n) => n.name === "template" && Object.values(n.attributes).includes("#fallback"));
        const replacement = fallback ? match[0].slice(fallback.loc[0].end, fallback.loc[fallback.loc.length - 1].start) : "";
        s.overwrite(match.index, match.index + match[0].length, replacement);
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

const ALIAS_RE = /(?<=['"])[~@]{1,2}(?=\/)/g;
const ALIAS_RE_SINGLE = /(?<=['"])[~@]{1,2}(?=\/)/;
const LayerAliasingPlugin = createUnplugin((options) => {
  const aliases = Object.fromEntries(options.layers.map((l) => {
    const srcDir = l.config.srcDir || l.cwd;
    const rootDir = l.config.rootDir || l.cwd;
    const publicDir = join(srcDir, l.config?.dir?.public || "public");
    return [srcDir, {
      aliases: {
        "~": l.config?.alias?.["~"] || srcDir,
        "@": l.config?.alias?.["@"] || srcDir,
        "~~": l.config?.alias?.["~~"] || rootDir,
        "@@": l.config?.alias?.["@@"] || rootDir
      },
      prefix: relative(options.root, publicDir),
      publicDir: !options.dev && existsSync(publicDir) && publicDir
    }];
  }));
  const layers = Object.keys(aliases).sort((a, b) => b.length - a.length);
  return {
    name: "nuxt:layer-aliasing",
    enforce: "pre",
    vite: {
      resolveId: {
        order: "pre",
        async handler(id, importer) {
          if (!importer) {
            return;
          }
          const layer = layers.find((l) => importer.startsWith(l));
          if (!layer) {
            return;
          }
          const publicDir = aliases[layer].publicDir;
          if (id.startsWith("/") && publicDir && readdirSync(publicDir).some((file) => file === id.slice(1) || id.startsWith("/" + file + "/"))) {
            const resolvedId2 = "/" + join(aliases[layer].prefix, id.slice(1));
            return await this.resolve(resolvedId2, importer, { skipSelf: true });
          }
          const resolvedId = resolveAlias(id, aliases[layer].aliases);
          if (resolvedId !== id) {
            return await this.resolve(resolvedId, importer, { skipSelf: true });
          }
        }
      }
    },
    // webpack-only transform
    transformInclude: (id) => {
      if (!options.transform) {
        return false;
      }
      const _id = normalize(id);
      return layers.some((dir) => _id.startsWith(dir));
    },
    transform(code, id) {
      if (!options.transform) {
        return;
      }
      const _id = normalize(id);
      const layer = layers.find((l) => _id.startsWith(l));
      if (!layer || !ALIAS_RE_SINGLE.test(code)) {
        return;
      }
      const s = new MagicString(code);
      s.replace(ALIAS_RE, (r) => aliases[layer].aliases[r] || r);
      if (s.hasChanged()) {
        return {
          code: s.toString(),
          map: options.sourcemap ? s.generateMap({ hires: true }) : void 0
        };
      }
    }
  };
});

const addModuleTranspiles = (opts = {}) => {
  const nuxt = useNuxt();
  const modules = [
    ...opts.additionalModules || [],
    ...nuxt.options.modules,
    ...nuxt.options._modules
  ].map((m) => typeof m === "string" ? m : Array.isArray(m) ? m[0] : m.src).filter((m) => typeof m === "string").map(normalizeModuleTranspilePath);
  nuxt.options.build.transpile = nuxt.options.build.transpile.map((m) => typeof m === "string" ? m.split("node_modules/").pop() : m).filter((x) => !!x);
  function isTranspilePresent(mod) {
    return nuxt.options.build.transpile.some((t) => !(t instanceof Function) && (t instanceof RegExp ? t.test(mod) : new RegExp(t).test(mod)));
  }
  for (const module of modules) {
    if (!isTranspilePresent(module)) {
      nuxt.options.build.transpile.push(module);
    }
  }
};

async function initNitro(nuxt) {
  var _a, _b;
  const _nitroConfig = nuxt.options.nitro || {};
  const excludePaths = nuxt.options._layers.flatMap((l) => [
    l.cwd.match(/(?<=\/)node_modules\/(.+)$/)?.[1],
    l.cwd.match(/\.pnpm\/.+\/node_modules\/(.+)$/)?.[1]
  ]).filter((dir) => Boolean(dir)).map((dir) => escapeRE(dir));
  const excludePattern = excludePaths.length ? [new RegExp(`node_modules\\/(?!${excludePaths.join("|")})`)] : [/node_modules/];
  const rootDirWithSlash = withTrailingSlash(nuxt.options.rootDir);
  const modules = await resolveNuxtModule(
    rootDirWithSlash,
    nuxt.options._installedModules.filter((m) => m.entryPath).map((m) => m.entryPath)
  );
  const nitroConfig = defu(_nitroConfig, {
    debug: nuxt.options.debug,
    rootDir: nuxt.options.rootDir,
    workspaceDir: nuxt.options.workspaceDir,
    srcDir: nuxt.options.serverDir,
    dev: nuxt.options.dev,
    buildDir: nuxt.options.buildDir,
    experimental: {
      asyncContext: nuxt.options.experimental.asyncContext,
      typescriptBundlerResolution: nuxt.options.experimental.typescriptBundlerResolution || nuxt.options.typescript?.tsConfig?.compilerOptions?.moduleResolution?.toLowerCase() === "bundler" || _nitroConfig.typescript?.tsConfig?.compilerOptions?.moduleResolution?.toLowerCase() === "bundler"
    },
    imports: {
      autoImport: nuxt.options.imports.autoImport,
      imports: [
        {
          as: "__buildAssetsURL",
          name: "buildAssetsURL",
          from: resolve(distDir, "core/runtime/nitro/paths")
        },
        {
          as: "__publicAssetsURL",
          name: "publicAssetsURL",
          from: resolve(distDir, "core/runtime/nitro/paths")
        },
        {
          // TODO: Remove after https://github.com/unjs/nitro/issues/1049
          as: "defineAppConfig",
          name: "defineAppConfig",
          from: resolve(distDir, "core/runtime/nitro/config"),
          priority: -1
        }
      ],
      exclude: [...excludePattern, /[\\/]\.git[\\/]/]
    },
    esbuild: {
      options: { exclude: excludePattern }
    },
    analyze: nuxt.options.build.analyze && {
      template: "treemap",
      projectRoot: nuxt.options.rootDir,
      filename: join(nuxt.options.analyzeDir, "{name}.html")
    },
    scanDirs: nuxt.options._layers.map((layer) => (layer.config.serverDir || layer.config.srcDir) && resolve(layer.cwd, layer.config.serverDir || resolve(layer.config.srcDir, "server"))).filter(Boolean),
    renderer: resolve(distDir, "core/runtime/nitro/renderer"),
    errorHandler: resolve(distDir, "core/runtime/nitro/error"),
    nodeModulesDirs: nuxt.options.modulesDir,
    handlers: nuxt.options.serverHandlers,
    devHandlers: [],
    baseURL: nuxt.options.app.baseURL,
    virtual: {
      "#internal/nuxt.config.mjs": () => nuxt.vfs["#build/nuxt.config"],
      "#spa-template": () => `export const template = ${JSON.stringify(spaLoadingTemplate(nuxt))}`
    },
    routeRules: {
      "/__nuxt_error": { cache: false }
    },
    runtimeConfig: {
      ...nuxt.options.runtimeConfig,
      nitro: {
        envPrefix: "NUXT_",
        ...nuxt.options.runtimeConfig.nitro
      }
    },
    appConfig: nuxt.options.appConfig,
    appConfigFiles: nuxt.options._layers.map(
      (layer) => resolve(layer.config.srcDir, "app.config")
    ),
    typescript: {
      strict: true,
      generateTsConfig: true,
      tsconfigPath: "tsconfig.server.json",
      tsConfig: {
        include: [
          join(nuxt.options.buildDir, "types/nitro-nuxt.d.ts"),
          ...modules.map((m) => join(relativeWithDot(nuxt.options.buildDir, m), "runtime/server"))
        ],
        exclude: [
          ...nuxt.options.modulesDir.map((m) => relativeWithDot(nuxt.options.buildDir, m)),
          // nitro generate output: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/core/nitro.ts#L186
          relativeWithDot(nuxt.options.buildDir, resolve(nuxt.options.rootDir, "dist"))
        ]
      }
    },
    publicAssets: [
      nuxt.options.dev ? { dir: resolve(nuxt.options.buildDir, "dist/client") } : {
        dir: join(nuxt.options.buildDir, "dist/client", nuxt.options.app.buildAssetsDir),
        maxAge: 31536e3,
        baseURL: nuxt.options.app.buildAssetsDir
      },
      ...nuxt.options._layers.map((layer) => join(layer.config.srcDir, (layer.config.rootDir === nuxt.options.rootDir ? nuxt.options : layer.config).dir?.public || "public")).filter((dir) => existsSync(dir)).map((dir) => ({ dir }))
    ],
    prerender: {
      failOnError: true,
      concurrency: cpus().length * 4 || 4,
      routes: [].concat(nuxt.options.generate.routes)
    },
    sourceMap: nuxt.options.sourcemap.server,
    externals: {
      inline: [
        ...nuxt.options.dev ? [] : [
          ...nuxt.options.experimental.externalVue ? [] : ["vue", "@vue/"],
          "@nuxt/",
          nuxt.options.buildDir
        ],
        ...nuxt.options.build.transpile.filter((i) => typeof i === "string"),
        "nuxt/dist",
        "nuxt3/dist",
        distDir
      ],
      traceInclude: [
        // force include files used in generated code from the runtime-compiler
        ...nuxt.options.vue.runtimeCompiler && !nuxt.options.experimental.externalVue ? [
          ...nuxt.options.modulesDir.reduce((targets, path) => {
            const serverRendererPath = resolve(path, "vue/server-renderer/index.js");
            if (existsSync(serverRendererPath)) {
              targets.push(serverRendererPath);
            }
            return targets;
          }, [])
        ] : []
      ]
    },
    alias: {
      // Vue 3 mocks
      ...nuxt.options.vue.runtimeCompiler || nuxt.options.experimental.externalVue ? {} : {
        "estree-walker": "unenv/runtime/mock/proxy",
        "@babel/parser": "unenv/runtime/mock/proxy",
        "@vue/compiler-core": "unenv/runtime/mock/proxy",
        "@vue/compiler-dom": "unenv/runtime/mock/proxy",
        "@vue/compiler-ssr": "unenv/runtime/mock/proxy"
      },
      "@vue/devtools-api": "vue-devtools-stub",
      // Paths
      "#paths": resolve(distDir, "core/runtime/nitro/paths"),
      // Nuxt aliases
      ...nuxt.options.alias
    },
    replace: {
      "process.env.NUXT_NO_SSR": nuxt.options.ssr === false,
      "process.env.NUXT_EARLY_HINTS": nuxt.options.experimental.writeEarlyHints !== false,
      "process.env.NUXT_NO_SCRIPTS": !!nuxt.options.experimental.noScripts && !nuxt.options.dev,
      "process.env.NUXT_INLINE_STYLES": !!nuxt.options.experimental.inlineSSRStyles,
      "process.env.NUXT_JSON_PAYLOADS": !!nuxt.options.experimental.renderJsonPayloads,
      "process.env.NUXT_COMPONENT_ISLANDS": !!nuxt.options.experimental.componentIslands,
      "process.env.NUXT_ASYNC_CONTEXT": !!nuxt.options.experimental.asyncContext,
      "process.dev": nuxt.options.dev,
      __VUE_PROD_DEVTOOLS__: false
    },
    rollupConfig: {
      output: {},
      plugins: []
    }
  });
  nitroConfig.srcDir = resolve(nuxt.options.rootDir, nuxt.options.srcDir, nitroConfig.srcDir);
  nitroConfig.ignore = [...nitroConfig.ignore || [], ...resolveIgnorePatterns(nitroConfig.srcDir)];
  if (nuxt.options.experimental.appManifest) {
    const buildId = (_a = nuxt.options.appConfig.nuxt).buildId || (_a.buildId = nuxt.options.test ? "test" : nuxt.options.dev ? "dev" : randomUUID());
    const buildTimestamp = Date.now();
    const manifestPrefix = joinURL(nuxt.options.app.buildAssetsDir, "builds");
    const tempDir = join(nuxt.options.buildDir, "manifest");
    nitroConfig.publicAssets.unshift(
      // build manifest
      {
        dir: join(tempDir, "meta"),
        maxAge: 31536e3,
        baseURL: joinURL(manifestPrefix, "meta")
      },
      // latest build
      {
        dir: tempDir,
        maxAge: 1,
        baseURL: manifestPrefix
      }
    );
    nuxt.hook("nitro:build:before", async (nitro2) => {
      const routeRules = {};
      const _routeRules = nitro2.options.routeRules;
      for (const key in _routeRules) {
        if (key === "/__nuxt_error") {
          continue;
        }
        const filteredRules = Object.entries(_routeRules[key]).filter(([key2, value]) => ["prerender", "redirect"].includes(key2) && value).map(([key2, value]) => {
          if (key2 === "redirect") {
            return [key2, typeof value === "string" ? value : value.to];
          }
          return [key2, value];
        });
        if (filteredRules.length > 0) {
          routeRules[key] = Object.fromEntries(filteredRules);
        }
      }
      const prerenderedRoutes = /* @__PURE__ */ new Set();
      const routeRulesMatcher = toRouteMatcher(
        createRouter({ routes: routeRules })
      );
      const payloadSuffix = nuxt.options.experimental.renderJsonPayloads ? "/_payload.json" : "/_payload.js";
      for (const route of nitro2._prerenderedRoutes || []) {
        if (!route.error && route.route.endsWith(payloadSuffix)) {
          const url = route.route.slice(0, -payloadSuffix.length) || "/";
          const rules = defu({}, ...routeRulesMatcher.matchAll(url).reverse());
          if (!rules.prerender) {
            prerenderedRoutes.add(url);
          }
        }
      }
      const manifest = {
        id: buildId,
        timestamp: buildTimestamp,
        matcher: exportMatcher(routeRulesMatcher),
        prerendered: nuxt.options.dev ? [] : [...prerenderedRoutes]
      };
      await promises.mkdir(join(tempDir, "meta"), { recursive: true });
      await promises.writeFile(join(tempDir, "latest.json"), JSON.stringify({
        id: buildId,
        timestamp: buildTimestamp
      }));
      await promises.writeFile(join(tempDir, `meta/${buildId}.json`), JSON.stringify(manifest));
    });
  }
  if (!nuxt.options.ssr) {
    nitroConfig.virtual["#build/dist/server/server.mjs"] = "export default () => {}";
    if (process.platform === "win32") {
      nitroConfig.virtual["#build/dist/server/server.mjs".replace(/\//g, "\\")] = "export default () => {}";
    }
  }
  if (nuxt.options.builder === "@nuxt/webpack-builder" || nuxt.options.dev) {
    nitroConfig.virtual["#build/dist/server/styles.mjs"] = "export default {}";
    if (process.platform === "win32") {
      nitroConfig.virtual["#build/dist/server/styles.mjs".replace(/\//g, "\\")] = "export default {}";
    }
  }
  if (nuxt.options.experimental.respectNoSSRHeader) {
    nitroConfig.handlers = nitroConfig.handlers || [];
    nitroConfig.handlers.push({
      handler: resolve(distDir, "core/runtime/nitro/no-ssr"),
      middleware: true
    });
  }
  nitroConfig.rollupConfig.plugins = await nitroConfig.rollupConfig.plugins || [];
  nitroConfig.rollupConfig.plugins = Array.isArray(nitroConfig.rollupConfig.plugins) ? nitroConfig.rollupConfig.plugins : [nitroConfig.rollupConfig.plugins];
  nitroConfig.rollupConfig.plugins.push(
    ImportProtectionPlugin.rollup({
      rootDir: nuxt.options.rootDir,
      patterns: [
        ...["#app", /^#build(\/|$)/].map((p) => [p, "Vue app aliases are not allowed in server routes."])
      ],
      exclude: [/core[\\/]runtime[\\/]nitro[\\/]renderer/]
    })
  );
  await nuxt.callHook("nitro:config", nitroConfig);
  const excludedAlias = [/^@vue\/.*$/, "#imports", "#vue-router", "vue-demi", /^#app/];
  const basePath = nitroConfig.typescript.tsConfig.compilerOptions?.baseUrl ? resolve(nuxt.options.buildDir, nitroConfig.typescript.tsConfig.compilerOptions?.baseUrl) : nuxt.options.buildDir;
  const aliases = nitroConfig.alias;
  const tsConfig = nitroConfig.typescript.tsConfig;
  tsConfig.compilerOptions = tsConfig.compilerOptions || {};
  tsConfig.compilerOptions.paths = tsConfig.compilerOptions.paths || {};
  for (const _alias in aliases) {
    const alias = _alias;
    if (excludedAlias.some((pattern) => typeof pattern === "string" ? alias === pattern : pattern.test(alias))) {
      continue;
    }
    if (alias in tsConfig.compilerOptions.paths) {
      continue;
    }
    const absolutePath = resolve(basePath, aliases[alias]);
    const stats = await promises.stat(absolutePath).catch(
      () => null
      /* file does not exist */
    );
    if (stats?.isDirectory()) {
      tsConfig.compilerOptions.paths[alias] = [absolutePath];
      tsConfig.compilerOptions.paths[`${alias}/*`] = [`${absolutePath}/*`];
    } else {
      tsConfig.compilerOptions.paths[alias] = [absolutePath.replace(/(?<=\w)\.\w+$/g, "")];
    }
  }
  const nitro = await createNitro(nitroConfig);
  (_b = nitro.options._config).storage || (_b.storage = {});
  nitro.options._config.storage["internal:nuxt:prerender"] = { driver: "memory" };
  nitro.options._config.storage["internal:nuxt:prerender:island"] = { driver: "lruCache", max: 1e3 };
  nitro.options._config.storage["internal:nuxt:prerender:payload"] = { driver: "lruCache", max: 1e3 };
  nuxt._nitro = nitro;
  await nuxt.callHook("nitro:init", nitro);
  nitro.vfs = nuxt.vfs = nitro.vfs || nuxt.vfs || {};
  nuxt.hook("close", () => nitro.hooks.callHook("close"));
  nitro.hooks.hook("prerender:routes", (routes) => {
    return nuxt.callHook("prerender:routes", { routes });
  });
  if (nuxt.options.vue.runtimeCompiler) {
    nuxt.hook("vite:extendConfig", (config, { isClient }) => {
      if (isClient) {
        if (Array.isArray(config.resolve.alias)) {
          config.resolve.alias.push({
            find: "vue",
            replacement: "vue/dist/vue.esm-bundler"
          });
        } else {
          config.resolve.alias = {
            ...config.resolve.alias,
            vue: "vue/dist/vue.esm-bundler"
          };
        }
      }
    });
    nuxt.hook("webpack:config", (configuration) => {
      const clientConfig = configuration.find((config) => config.name === "client");
      if (!clientConfig.resolve) {
        clientConfig.resolve.alias = {};
      }
      if (Array.isArray(clientConfig.resolve.alias)) {
        clientConfig.resolve.alias.push({
          name: "vue",
          alias: "vue/dist/vue.esm-bundler"
        });
      } else {
        clientConfig.resolve.alias.vue = "vue/dist/vue.esm-bundler";
      }
    });
  }
  const devMiddlewareHandler = dynamicEventHandler();
  nitro.options.devHandlers.unshift({ handler: devMiddlewareHandler });
  nitro.options.devHandlers.push(...nuxt.options.devServerHandlers);
  nitro.options.handlers.unshift({
    route: "/__nuxt_error",
    lazy: true,
    handler: resolve(distDir, "core/runtime/nitro/renderer")
  });
  if (!nuxt.options.dev && nuxt.options.experimental.noVueServer) {
    nitro.hooks.hook("rollup:before", (nitro2) => {
      if (nitro2.options.preset === "nitro-prerender") {
        return;
      }
      const nuxtErrorHandler = nitro2.options.handlers.findIndex((h) => h.route === "/__nuxt_error");
      if (nuxtErrorHandler >= 0) {
        nitro2.options.handlers.splice(nuxtErrorHandler, 1);
      }
      nitro2.options.renderer = void 0;
      nitro2.options.errorHandler = "#internal/nitro/error";
    });
  }
  nuxt.hook("prepare:types", async (opts) => {
    if (!nuxt.options.dev) {
      await scanHandlers(nitro);
      await writeTypes(nitro);
    }
    opts.tsConfig.exclude = opts.tsConfig.exclude || [];
    opts.tsConfig.exclude.push(relative(nuxt.options.buildDir, resolve(nuxt.options.rootDir, nitro.options.output.dir)));
    opts.references.push({ path: resolve(nuxt.options.buildDir, "types/nitro.d.ts") });
  });
  if (nitro.options.static) {
    nitro.hooks.hook("prerender:routes", (routes) => {
      for (const route of [nuxt.options.ssr ? "/" : "/index.html", "/200.html", "/404.html"]) {
        routes.add(route);
      }
    });
  }
  nuxt.hook("build:done", async () => {
    await nuxt.callHook("nitro:build:before", nitro);
    if (nuxt.options.dev) {
      await build$1(nitro);
    } else {
      await prepare(nitro);
      await copyPublicAssets(nitro);
      await nuxt.callHook("nitro:build:public-assets", nitro);
      await prerender(nitro);
      logger.restoreAll();
      await build$1(nitro);
      logger.wrapAll();
      if (nitro.options.static) {
        const distDir2 = resolve(nuxt.options.rootDir, "dist");
        if (!existsSync(distDir2)) {
          await promises.symlink(nitro.options.output.publicDir, distDir2, "junction").catch(() => {
          });
        }
      }
    }
  });
  if (nuxt.options.dev) {
    nuxt.hook("webpack:compile", ({ compiler }) => {
      compiler.outputFileSystem = { ...fse, join };
    });
    nuxt.hook("webpack:compiled", () => {
      nuxt.server.reload();
    });
    nuxt.hook("vite:compiled", () => {
      nuxt.server.reload();
    });
    nuxt.hook("server:devHandler", (h) => {
      devMiddlewareHandler.set(h);
    });
    nuxt.server = createDevServer(nitro);
    const waitUntilCompile = new Promise((resolve2) => nitro.hooks.hook("compiled", () => resolve2()));
    nuxt.hook("build:done", () => waitUntilCompile);
  }
}
function relativeWithDot(from, to) {
  return relative(from, to).replace(/^([^.])/, "./$1") || ".";
}
function spaLoadingTemplate(nuxt) {
  if (nuxt.options.spaLoadingTemplate === false) {
    return "";
  }
  const spaLoadingTemplate2 = typeof nuxt.options.spaLoadingTemplate === "string" ? nuxt.options.spaLoadingTemplate : resolve(nuxt.options.srcDir, "app/spa-loading-template.html");
  try {
    if (existsSync(spaLoadingTemplate2)) {
      return readFileSync(spaLoadingTemplate2, "utf-8");
    }
  } catch {
  }
  if (nuxt.options.spaLoadingTemplate === true) {
    return template({});
  }
  if (nuxt.options.spaLoadingTemplate) {
    logger.warn(`Could not load custom \`spaLoadingTemplate\` path as it does not exist: \`${nuxt.options.spaLoadingTemplate}\`.`);
  }
  return "";
}

const schemaModule = defineNuxtModule({
  meta: {
    name: "nuxt-config-schema"
  },
  async setup(_, nuxt) {
    if (!nuxt.options.experimental.configSchema) {
      return;
    }
    const resolver = createResolver(import.meta.url);
    const _resolveSchema = jiti(dirname(import.meta.url), {
      esmResolve: true,
      interopDefault: true,
      cache: false,
      requireCache: false,
      transformOptions: {
        babel: {
          plugins: [untypedPlugin]
        }
      }
    });
    nuxt.hook("prepare:types", async (ctx) => {
      ctx.references.push({ path: "nuxt-config-schema" });
      ctx.references.push({ path: "schema/nuxt.schema.d.ts" });
      if (nuxt.options._prepare) {
        await writeSchema(schema);
      }
    });
    let schema;
    nuxt.hook("modules:done", async () => {
      schema = await resolveSchema$1();
    });
    nuxt.hooks.hook("build:done", () => writeSchema(schema));
    if (nuxt.options.dev) {
      const onChange = debounce(async () => {
        schema = await resolveSchema$1();
        await writeSchema(schema);
      });
      if (nuxt.options.experimental.watcher === "parcel") {
        const watcherPath = await tryResolveModule("@parcel/watcher", [nuxt.options.rootDir, ...nuxt.options.modulesDir]);
        if (watcherPath) {
          const { subscribe } = await import(pathToFileURL(watcherPath).href).then(interopDefault);
          for (const layer of nuxt.options._layers) {
            const subscription = await subscribe(layer.config.rootDir, onChange, {
              ignore: ["!nuxt.schema.*"]
            });
            nuxt.hook("close", () => subscription.unsubscribe());
          }
          return;
        }
        logger.warn("Falling back to `chokidar-granular` as `@parcel/watcher` cannot be resolved in your project.");
      }
      const filesToWatch = await Promise.all(nuxt.options._layers.map(
        (layer) => resolver.resolve(layer.config.rootDir, "nuxt.schema.*")
      ));
      const watcher = chokidar.watch(filesToWatch, {
        ...nuxt.options.watchers.chokidar,
        ignoreInitial: true
      });
      watcher.on("all", onChange);
      nuxt.hook("close", () => watcher.close());
    }
    async function resolveSchema$1() {
      globalThis.defineNuxtSchema = (val) => val;
      const schemaDefs = [nuxt.options.$schema];
      for (const layer of nuxt.options._layers) {
        const filePath = await resolver.resolvePath(resolve(layer.config.rootDir, "nuxt.schema"));
        if (filePath && existsSync(filePath)) {
          let loadedConfig;
          try {
            loadedConfig = _resolveSchema(filePath);
          } catch (err) {
            logger.warn(
              "Unable to load schema from",
              filePath,
              err
            );
            continue;
          }
          schemaDefs.push(loadedConfig);
        }
      }
      await nuxt.hooks.callHook("schema:extend", schemaDefs);
      const schemas = await Promise.all(
        schemaDefs.map((schemaDef) => resolveSchema(schemaDef))
      );
      const schema2 = defu(...schemas);
      await nuxt.hooks.callHook("schema:resolved", schema2);
      return schema2;
    }
    async function writeSchema(schema2) {
      await nuxt.hooks.callHook("schema:beforeWrite", schema2);
      await mkdir(resolve(nuxt.options.buildDir, "schema"), { recursive: true });
      await writeFile(
        resolve(nuxt.options.buildDir, "schema/nuxt.schema.json"),
        JSON.stringify(schema2, null, 2),
        "utf8"
      );
      const _types = generateTypes(schema2, {
        addExport: true,
        interfaceName: "NuxtCustomSchema",
        partial: true,
        allowExtraKeys: false
      });
      const types = _types + `
export type CustomAppConfig = Exclude<NuxtCustomSchema['appConfig'], undefined>
type _CustomAppConfig = CustomAppConfig

declare module '@nuxt/schema' {
  interface NuxtConfig extends Omit<NuxtCustomSchema, 'appConfig'> {}
  interface NuxtOptions extends Omit<NuxtCustomSchema, 'appConfig'> {}
  interface CustomAppConfig extends _CustomAppConfig {}
}

declare module 'nuxt/schema' {
  interface NuxtConfig extends Omit<NuxtCustomSchema, 'appConfig'> {}
  interface NuxtOptions extends Omit<NuxtCustomSchema, 'appConfig'> {}
  interface CustomAppConfig extends _CustomAppConfig {}
}
`;
      const typesPath = resolve(
        nuxt.options.buildDir,
        "schema/nuxt.schema.d.ts"
      );
      await writeFile(typesPath, types, "utf8");
      await nuxt.hooks.callHook("schema:written");
    }
  }
});

const internalOrderMap = {
  // -50: pre-all (nuxt)
  "nuxt-pre-all": -50,
  // -40: custom payload revivers (user)
  "user-revivers": -40,
  // -30: payload reviving (nuxt)
  "nuxt-revivers": -30,
  // -20: pre (user) <-- pre mapped to this
  "user-pre": -20,
  // -10: default (nuxt)
  "nuxt-default": -10,
  // 0: default (user) <-- default behavior
  "user-default": 0,
  // +10: post (nuxt)
  "nuxt-post": 10,
  // +20: post (user) <-- post mapped to this
  "user-post": 20,
  // +30: post-all (nuxt)
  "nuxt-post-all": 30
};
const orderMap = {
  pre: internalOrderMap["user-pre"],
  default: internalOrderMap["user-default"],
  post: internalOrderMap["user-post"]
};
const metaCache = {};
async function extractMetadata(code) {
  let meta = {};
  if (metaCache[code]) {
    return metaCache[code];
  }
  const js = await transform(code, { loader: "ts" });
  walk(parse(js.code, {
    sourceType: "module",
    ecmaVersion: "latest"
  }), {
    enter(_node) {
      if (_node.type !== "CallExpression" || _node.callee.type !== "Identifier") {
        return;
      }
      const node = _node;
      const name = "name" in node.callee && node.callee.name;
      if (name !== "defineNuxtPlugin" && name !== "definePayloadPlugin") {
        return;
      }
      if (name === "definePayloadPlugin") {
        meta.order = internalOrderMap["user-revivers"];
      }
      const metaArg = node.arguments[1];
      if (metaArg) {
        if (metaArg.type !== "ObjectExpression") {
          throw new Error("Invalid plugin metadata");
        }
        meta = extractMetaFromObject(metaArg.properties);
      }
      const plugin = node.arguments[0];
      if (plugin.type === "ObjectExpression") {
        meta = defu(extractMetaFromObject(plugin.properties), meta);
      }
      meta.order = meta.order || orderMap[meta.enforce || "default"] || orderMap.default;
      delete meta.enforce;
    }
  });
  metaCache[code] = meta;
  return meta;
}
const keys = {
  name: "name",
  order: "order",
  enforce: "enforce"
};
function isMetadataKey(key) {
  return key in keys;
}
function extractMetaFromObject(properties) {
  const meta = {};
  for (const property of properties) {
    if (property.type === "SpreadElement" || !("name" in property.key)) {
      throw new Error("Invalid plugin metadata");
    }
    const propertyKey = property.key.name;
    if (!isMetadataKey(propertyKey)) {
      continue;
    }
    if (property.value.type === "Literal") {
      meta[propertyKey] = property.value.value;
    }
    if (property.value.type === "UnaryExpression" && property.value.argument.type === "Literal") {
      meta[propertyKey] = JSON.parse(property.value.operator + property.value.argument.raw);
    }
  }
  return meta;
}
const RemovePluginMetadataPlugin = (nuxt) => createUnplugin(() => {
  return {
    name: "nuxt:remove-plugin-metadata",
    transform(code, id) {
      id = normalize(id);
      const plugin = nuxt.apps.default.plugins.find((p) => p.src === id);
      if (!plugin) {
        return;
      }
      const s = new MagicString(code);
      const exports = findExports(code);
      const defaultExport = exports.find((e) => e.type === "default" || e.name === "default");
      if (!defaultExport) {
        logger.warn(`Plugin \`${plugin.src}\` has no default export and will be ignored at build time. Add \`export default defineNuxtPlugin(() => {})\` to your plugin.`);
        s.overwrite(0, code.length, "export default () => {}");
        return {
          code: s.toString(),
          map: nuxt.options.sourcemap.client || nuxt.options.sourcemap.server ? s.generateMap({ hires: true }) : null
        };
      }
      let wrapped = false;
      try {
        walk(this.parse(code, {
          sourceType: "module",
          ecmaVersion: "latest"
        }), {
          enter(_node) {
            if (_node.type === "ExportDefaultDeclaration" && (_node.declaration.type === "FunctionDeclaration" || _node.declaration.type === "ArrowFunctionExpression")) {
              if ("params" in _node.declaration && _node.declaration.params.length > 1) {
                logger.warn(`Plugin \`${plugin.src}\` is in legacy Nuxt 2 format (context, inject) which is likely to be broken and will be ignored.`);
                s.overwrite(0, code.length, "export default () => {}");
                wrapped = true;
                return;
              }
            }
            if (_node.type !== "CallExpression" || _node.callee.type !== "Identifier") {
              return;
            }
            const node = _node;
            const name = "name" in node.callee && node.callee.name;
            if (name !== "defineNuxtPlugin" && name !== "definePayloadPlugin") {
              return;
            }
            wrapped = true;
            if (node.arguments[0].type !== "ObjectExpression") {
              if ("params" in node.arguments[0] && node.arguments[0].params.length > 1) {
                logger.warn(`Plugin \`${plugin.src}\` is in legacy Nuxt 2 format (context, inject) which is likely to be broken and will be ignored.`);
                s.overwrite(0, code.length, "export default () => {}");
                return;
              }
            }
            if (!("order" in plugin) && !("name" in plugin)) {
              return;
            }
            for (const [argIndex, _arg] of node.arguments.entries()) {
              if (_arg.type !== "ObjectExpression") {
                continue;
              }
              const arg = _arg;
              for (const [propertyIndex, _property] of arg.properties.entries()) {
                if (_property.type === "SpreadElement" || !("name" in _property.key)) {
                  continue;
                }
                const property = _property;
                const propertyKey = _property.key.name;
                if (propertyKey === "order" || propertyKey === "enforce" || propertyKey === "name") {
                  const _nextNode = arg.properties[propertyIndex + 1] || node.arguments[argIndex + 1];
                  const nextNode = _nextNode;
                  const nextIndex = nextNode?.start || arg.end - 1;
                  s.remove(property.start, nextIndex);
                }
              }
            }
          }
        });
      } catch (e) {
        logger.error(e);
        return;
      }
      if (!wrapped) {
        logger.warn(`Plugin \`${plugin.src}\` is not wrapped in \`defineNuxtPlugin\`. It is advised to wrap your plugins as in the future this may enable enhancements.`);
      }
      if (s.hasChanged()) {
        return {
          code: s.toString(),
          map: nuxt.options.sourcemap.client || nuxt.options.sourcemap.server ? s.generateMap({ hires: true }) : null
        };
      }
    }
  };
});

const AsyncContextInjectionPlugin = (nuxt) => createUnplugin(() => {
  return {
    name: "nuxt:vue-async-context",
    transformInclude(id) {
      return isVue(id, { type: ["template", "script"] });
    },
    transform(code) {
      if (!code.includes("_withAsyncContext")) {
        return;
      }
      const s = new MagicString(code);
      s.prepend('import { withAsyncContext as _withAsyncContext } from "#app/composables/asyncContext";\n');
      s.replace(/withAsyncContext as _withAsyncContext,?/, "");
      if (s.hasChanged()) {
        return {
          code: s.toString(),
          map: nuxt.options.sourcemap.client || nuxt.options.sourcemap.server ? s.generateMap({ hires: true }) : void 0
        };
      }
    }
  };
});

function resolveDeepImportsPlugin(nuxt) {
  const exclude = ["virtual:", "\0virtual:", "/__skip_vite"];
  return {
    name: "nuxt:resolve-bare-imports",
    enforce: "post",
    async resolveId(id, importer, options) {
      if (!importer || isAbsolute(id) || !isAbsolute(importer) || exclude.some((e) => id.startsWith(e))) {
        return;
      }
      id = normalize(id);
      id = resolveAlias(id, nuxt.options.alias);
      const { dir } = parseNodeModulePath(importer);
      return await this.resolve?.(id, dir || pkgDir, { skipSelf: true }) ?? await resolvePath(id, {
        url: [dir || pkgDir, ...nuxt.options.modulesDir],
        // TODO: respect nitro runtime conditions
        conditions: options.ssr ? ["node", "import", "require"] : ["import", "require"]
      }).catch(() => {
        logger.debug("Could not resolve id", id, importer);
        return null;
      });
    }
  };
}

function createNuxt(options) {
  const hooks = createHooks();
  const nuxt = {
    _version: version,
    options,
    hooks,
    callHook: hooks.callHook,
    addHooks: hooks.addHooks,
    hook: hooks.hook,
    ready: () => initNuxt(nuxt),
    close: () => Promise.resolve(hooks.callHook("close", nuxt)),
    vfs: {},
    apps: {}
  };
  return nuxt;
}
async function initNuxt(nuxt) {
  var _a;
  nuxt.hooks.addHooks(nuxt.options.hooks);
  nuxtCtx.set(nuxt);
  nuxt.hook("close", () => nuxtCtx.unset());
  nuxt.hook("prepare:types", (opts) => {
    opts.references.push({ types: "nuxt" });
    opts.references.push({ path: resolve(nuxt.options.buildDir, "types/plugins.d.ts") });
    if (nuxt.options.typescript.shim) {
      opts.references.push({ path: resolve(nuxt.options.buildDir, "types/vue-shim.d.ts") });
    }
    opts.references.push({ path: resolve(nuxt.options.buildDir, "types/schema.d.ts") });
    opts.references.push({ path: resolve(nuxt.options.buildDir, "types/app.config.d.ts") });
    for (const layer of nuxt.options._layers) {
      const declaration = join(layer.cwd, "index.d.ts");
      if (fse.existsSync(declaration)) {
        opts.references.push({ path: declaration });
      }
    }
  });
  addBuildPlugin(RemovePluginMetadataPlugin(nuxt));
  const config = {
    rootDir: nuxt.options.rootDir,
    // Exclude top-level resolutions by plugins
    exclude: [join(nuxt.options.rootDir, "index.html")],
    patterns: vueAppPatterns(nuxt)
  };
  addVitePlugin(() => ImportProtectionPlugin.vite(config));
  addWebpackPlugin(() => ImportProtectionPlugin.webpack(config));
  if (nuxt.options.experimental.appManifest) {
    addRouteMiddleware({
      name: "manifest-route-rule",
      path: resolve(nuxt.options.appDir, "middleware/manifest-route-rule"),
      global: true
    });
    addPlugin(resolve(nuxt.options.appDir, "plugins/check-outdated-build.client"));
  }
  addVitePlugin(() => resolveDeepImportsPlugin(nuxt));
  if (nuxt.options.experimental.localLayerAliases) {
    addVitePlugin(() => LayerAliasingPlugin.vite({
      sourcemap: !!nuxt.options.sourcemap.server || !!nuxt.options.sourcemap.client,
      dev: nuxt.options.dev,
      root: nuxt.options.srcDir,
      // skip top-level layer (user's project) as the aliases will already be correctly resolved
      layers: nuxt.options._layers.slice(1)
    }));
    addWebpackPlugin(() => LayerAliasingPlugin.webpack({
      sourcemap: !!nuxt.options.sourcemap.server || !!nuxt.options.sourcemap.client,
      dev: nuxt.options.dev,
      root: nuxt.options.srcDir,
      // skip top-level layer (user's project) as the aliases will already be correctly resolved
      layers: nuxt.options._layers.slice(1),
      transform: true
    }));
  }
  nuxt.hook("modules:done", async () => {
    const options = {
      sourcemap: !!nuxt.options.sourcemap.server || !!nuxt.options.sourcemap.client,
      transformerOptions: {
        ...nuxt.options.optimization.asyncTransforms,
        helperModule: await tryResolveModule("unctx", nuxt.options.modulesDir) ?? "unctx"
      }
    };
    addVitePlugin(() => UnctxTransformPlugin.vite(options));
    addWebpackPlugin(() => UnctxTransformPlugin.webpack(options));
    const serverTreeShakeOptions = {
      sourcemap: !!nuxt.options.sourcemap.server,
      composables: nuxt.options.optimization.treeShake.composables.server
    };
    if (Object.keys(serverTreeShakeOptions.composables).length) {
      addVitePlugin(() => TreeShakeComposablesPlugin.vite(serverTreeShakeOptions), { client: false });
      addWebpackPlugin(() => TreeShakeComposablesPlugin.webpack(serverTreeShakeOptions), { client: false });
    }
    const clientTreeShakeOptions = {
      sourcemap: !!nuxt.options.sourcemap.client,
      composables: nuxt.options.optimization.treeShake.composables.client
    };
    if (Object.keys(clientTreeShakeOptions.composables).length) {
      addVitePlugin(() => TreeShakeComposablesPlugin.vite(clientTreeShakeOptions), { server: false });
      addWebpackPlugin(() => TreeShakeComposablesPlugin.webpack(clientTreeShakeOptions), { server: false });
    }
  });
  if (!nuxt.options.dev) {
    addVitePlugin(() => DevOnlyPlugin.vite({ sourcemap: !!nuxt.options.sourcemap.server || !!nuxt.options.sourcemap.client }));
    addWebpackPlugin(() => DevOnlyPlugin.webpack({ sourcemap: !!nuxt.options.sourcemap.server || !!nuxt.options.sourcemap.client }));
  }
  if (nuxt.options.experimental.asyncContext) {
    addBuildPlugin(AsyncContextInjectionPlugin(nuxt));
  }
  if (nuxt.options.experimental.noScripts && !nuxt.options.dev) {
    nuxt.hook("build:manifest", async (manifest) => {
      for (const file in manifest) {
        if (manifest[file].resourceType === "script") {
          await fse.rm(resolve(nuxt.options.buildDir, "dist/client", withoutLeadingSlash(nuxt.options.app.buildAssetsDir), manifest[file].file), { force: true });
          manifest[file].file = "";
        }
      }
    });
  }
  nuxt.options.build.transpile.push("nuxt/app");
  nuxt.options.build.transpile.push(
    ...nuxt.options._layers.filter((i) => i.cwd.includes("node_modules")).map((i) => i.cwd)
  );
  await nuxt.callHook("modules:before");
  const modulesToInstall = [];
  const watchedPaths = /* @__PURE__ */ new Set();
  const specifiedModules = /* @__PURE__ */ new Set();
  for (const _mod of nuxt.options.modules) {
    const mod = Array.isArray(_mod) ? _mod[0] : _mod;
    if (typeof mod !== "string") {
      continue;
    }
    const modPath = await resolvePath$1(resolveAlias(mod));
    specifiedModules.add(modPath);
  }
  for (const config2 of nuxt.options._layers.map((layer) => layer.config).reverse()) {
    const modulesDir = (config2.rootDir === nuxt.options.rootDir ? nuxt.options : config2).dir?.modules || "modules";
    const layerModules = await resolveFiles(config2.srcDir, [
      `${modulesDir}/*{${nuxt.options.extensions.join(",")}}`,
      `${modulesDir}/*/index{${nuxt.options.extensions.join(",")}}`
    ]);
    for (const mod of layerModules) {
      watchedPaths.add(mod);
      if (specifiedModules.has(mod)) {
        continue;
      }
      specifiedModules.add(mod);
      modulesToInstall.push(mod);
    }
  }
  modulesToInstall.push(...nuxt.options.modules, ...nuxt.options._modules);
  addComponent({
    name: "NuxtWelcome",
    priority: 10,
    // built-in that we do not expect the user to override
    filePath: await tryResolveModule("@nuxt/ui-templates/templates/welcome.vue", nuxt.options.modulesDir)
  });
  addComponent({
    name: "NuxtLayout",
    priority: 10,
    // built-in that we do not expect the user to override
    filePath: resolve(nuxt.options.appDir, "components/nuxt-layout")
  });
  addComponent({
    name: "NuxtErrorBoundary",
    priority: 10,
    // built-in that we do not expect the user to override
    filePath: resolve(nuxt.options.appDir, "components/nuxt-error-boundary")
  });
  addComponent({
    name: "ClientOnly",
    priority: 10,
    // built-in that we do not expect the user to override
    filePath: resolve(nuxt.options.appDir, "components/client-only")
  });
  addComponent({
    name: "DevOnly",
    priority: 10,
    // built-in that we do not expect the user to override
    filePath: resolve(nuxt.options.appDir, "components/dev-only")
  });
  addComponent({
    name: "ServerPlaceholder",
    priority: 10,
    // built-in that we do not expect the user to override
    filePath: resolve(nuxt.options.appDir, "components/server-placeholder")
  });
  addComponent({
    name: "NuxtLink",
    priority: 10,
    // built-in that we do not expect the user to override
    filePath: resolve(nuxt.options.appDir, "components/nuxt-link")
  });
  addComponent({
    name: "NuxtLoadingIndicator",
    priority: 10,
    // built-in that we do not expect the user to override
    filePath: resolve(nuxt.options.appDir, "components/nuxt-loading-indicator")
  });
  if (nuxt.options.experimental.clientFallback) {
    addComponent({
      name: "NuxtClientFallback",
      _raw: true,
      priority: 10,
      // built-in that we do not expect the user to override
      filePath: resolve(nuxt.options.appDir, "components/client-fallback.client"),
      mode: "client"
    });
    addComponent({
      name: "NuxtClientFallback",
      _raw: true,
      priority: 10,
      // built-in that we do not expect the user to override
      filePath: resolve(nuxt.options.appDir, "components/client-fallback.server"),
      mode: "server"
    });
  }
  if (nuxt.options.experimental.componentIslands) {
    addComponent({
      name: "NuxtIsland",
      priority: 10,
      // built-in that we do not expect the user to override
      filePath: resolve(nuxt.options.appDir, "components/nuxt-island")
    });
    if (!nuxt.options.ssr) {
      nuxt.options.ssr = true;
      (_a = nuxt.options.nitro).routeRules || (_a.routeRules = {});
      nuxt.options.nitro.routeRules["/**"] = defu$1(nuxt.options.nitro.routeRules["/**"], { ssr: false });
    }
  }
  if (!nuxt.options.dev && nuxt.options.experimental.payloadExtraction) {
    addPlugin(resolve(nuxt.options.appDir, "plugins/payload.client"));
  }
  if (nuxt.options.experimental.crossOriginPrefetch) {
    addPlugin(resolve(nuxt.options.appDir, "plugins/cross-origin-prefetch.client"));
  }
  if (nuxt.options.experimental.emitRouteChunkError === "automatic") {
    addPlugin(resolve(nuxt.options.appDir, "plugins/chunk-reload.client"));
  }
  if (nuxt.options.experimental.restoreState) {
    addPlugin(resolve(nuxt.options.appDir, "plugins/restore-state.client"));
  }
  if (nuxt.options.experimental.viewTransition) {
    addPlugin(resolve(nuxt.options.appDir, "plugins/view-transitions.client"));
  }
  if (nuxt.options.experimental.renderJsonPayloads) {
    nuxt.hooks.hook("modules:done", () => {
      addPlugin(resolve(nuxt.options.appDir, "plugins/revive-payload.client"));
      addPlugin(resolve(nuxt.options.appDir, "plugins/revive-payload.server"));
    });
  }
  if (nuxt.options.builder === "@nuxt/webpack-builder") {
    addPlugin(resolve(nuxt.options.appDir, "plugins/preload.server"));
  }
  const envMap = {
    // defaults from `builder` based on package name
    "@nuxt/vite-builder": "vite/client",
    "@nuxt/webpack-builder": "webpack/module",
    // simpler overrides from `typescript.builder` for better DX
    vite: "vite/client",
    webpack: "webpack/module",
    // default 'merged' builder environment for module authors
    shared: "@nuxt/schema/builder-env"
  };
  nuxt.hook("prepare:types", ({ references }) => {
    if (nuxt.options.typescript.builder === false) {
      return;
    }
    const overrideEnv = nuxt.options.typescript.builder && envMap[nuxt.options.typescript.builder];
    const defaultEnv = typeof nuxt.options.builder === "string" ? envMap[nuxt.options.builder] : false;
    const types = overrideEnv || defaultEnv;
    if (types) {
      references.push({ types });
    }
  });
  if (nuxt.options.debug) {
    addPlugin(resolve(nuxt.options.appDir, "plugins/debug"));
  }
  for (const m of modulesToInstall) {
    if (Array.isArray(m)) {
      await installModule(m[0], m[1]);
    } else {
      await installModule(m, {});
    }
  }
  await nuxt.callHook("modules:done");
  nuxt.hooks.hook("builder:watch", (event, relativePath) => {
    const path = resolve(nuxt.options.srcDir, relativePath);
    if (watchedPaths.has(path)) {
      return nuxt.callHook("restart", { hard: true });
    }
    const layerRelativePaths = nuxt.options._layers.map((l) => relative(l.config.srcDir || l.cwd, path));
    for (const pattern of nuxt.options.watch) {
      if (typeof pattern === "string") {
        if (pattern === path || layerRelativePaths.includes(pattern)) {
          return nuxt.callHook("restart");
        }
        continue;
      }
      if (layerRelativePaths.some((p) => pattern.test(p))) {
        return nuxt.callHook("restart");
      }
    }
    const isFileChange = ["add", "unlink"].includes(event);
    if (isFileChange && RESTART_RE.test(path)) {
      logger.info(`\`${path}\` ${event === "add" ? "created" : "removed"}`);
      return nuxt.callHook("restart");
    }
  });
  nuxt.options.build.transpile = nuxt.options.build.transpile.map((t) => typeof t === "string" ? normalize(t) : t);
  addModuleTranspiles();
  await initNitro(nuxt);
  const nitro = useNitro();
  if (nitro.options.static && nuxt.options.experimental.payloadExtraction === void 0) {
    logger.warn("Using experimental payload extraction for full-static output. You can opt-out by setting `experimental.payloadExtraction` to `false`.");
    nuxt.options.experimental.payloadExtraction = true;
  }
  nitro.options.replace["process.env.NUXT_PAYLOAD_EXTRACTION"] = String(!!nuxt.options.experimental.payloadExtraction);
  nitro.options._config.replace["process.env.NUXT_PAYLOAD_EXTRACTION"] = String(!!nuxt.options.experimental.payloadExtraction);
  if (!nuxt.options.dev && nuxt.options.experimental.payloadExtraction) {
    addPlugin(resolve(nuxt.options.appDir, "plugins/payload.client"));
  }
  await nuxt.callHook("ready", nuxt);
}
async function loadNuxt(opts) {
  const options = await loadNuxtConfig(opts);
  options.appDir = options.alias["#app"] = resolve(distDir, "app");
  options._majorVersion = 3;
  if (options.devtools === true || options.devtools && options.devtools.enabled !== false) {
    if (await import('./chunks/features.mjs').then((r) => r.ensurePackageInstalled("@nuxt/devtools", {
      rootDir: options.rootDir,
      searchPaths: options.modulesDir
    }))) {
      options._modules.push("@nuxt/devtools");
    } else {
      logger.warn("Failed to install `@nuxt/devtools`, please install it manually, or disable `devtools` in `nuxt.config`");
    }
  }
  if (options.builder === "@nuxt/webpack-builder") {
    if (!await import('./chunks/features.mjs').then((r) => r.ensurePackageInstalled("@nuxt/webpack-builder", {
      rootDir: options.rootDir,
      searchPaths: options.modulesDir
    }))) {
      logger.warn("Failed to install `@nuxt/webpack-builder`, please install it manually, or change the `builder` option to vite in `nuxt.config`");
    }
  }
  options._modules.push(pagesModule, metaModule, componentsModule);
  options._modules.push([importsModule, {
    transform: {
      include: options._layers.filter((i) => i.cwd && i.cwd.includes("node_modules")).map((i) => new RegExp(`(^|\\/)${escapeRE(i.cwd.split("node_modules/").pop())}(\\/|$)(?!node_modules\\/)`))
    }
  }]);
  options._modules.push(schemaModule);
  options.modulesDir.push(resolve(options.workspaceDir, "node_modules"));
  options.modulesDir.push(resolve(pkgDir, "node_modules"));
  options.build.transpile.push(
    "@nuxt/ui-templates",
    // this exposes vue SFCs
    "std-env"
    // we need to statically replace process.env when used in runtime code
  );
  options.alias["vue-demi"] = resolve(options.appDir, "compat/vue-demi");
  options.alias["@vue/composition-api"] = resolve(options.appDir, "compat/capi");
  if (options.telemetry !== false && !process.env.NUXT_TELEMETRY_DISABLED) {
    options._modules.push("@nuxt/telemetry");
  }
  const nuxt = createNuxt(options);
  if (nuxt.options.debug) {
    createDebugger(nuxt.hooks, { tag: "nuxt" });
  }
  if (opts.ready !== false) {
    await nuxt.ready();
  }
  return nuxt;
}
const RESTART_RE = /^(app|error|app\.config)\.(js|ts|mjs|jsx|tsx|vue)$/i;

const vueShim = {
  filename: "types/vue-shim.d.ts",
  getContents: ({ nuxt }) => {
    if (!nuxt.options.typescript.shim) {
      return "";
    }
    return [
      "declare module '*.vue' {",
      "  import { DefineComponent } from 'vue'",
      "  const component: DefineComponent<{}, {}, any>",
      "  export default component",
      "}"
    ].join("\n");
  }
};
const appComponentTemplate = {
  filename: "app-component.mjs",
  getContents: (ctx) => genExport(ctx.app.mainComponent, ["default"])
};
const rootComponentTemplate = {
  filename: "root-component.mjs",
  getContents: (ctx) => genExport(ctx.app.rootComponent, ["default"])
};
const errorComponentTemplate = {
  filename: "error-component.mjs",
  getContents: (ctx) => genExport(ctx.app.errorComponent, ["default"])
};
const testComponentWrapperTemplate = {
  filename: "test-component-wrapper.mjs",
  getContents: (ctx) => genExport(resolve(ctx.nuxt.options.appDir, "components/test-component-wrapper"), ["default"])
};
const cssTemplate = {
  filename: "css.mjs",
  getContents: (ctx) => ctx.nuxt.options.css.map((i) => genImport(i)).join("\n")
};
const clientPluginTemplate = {
  filename: "plugins/client.mjs",
  async getContents(ctx) {
    const clientPlugins = await annotatePlugins(ctx.nuxt, ctx.app.plugins.filter((p) => !p.mode || p.mode !== "server"));
    await annotatePlugins(ctx.nuxt, clientPlugins);
    const exports = [];
    const imports = [];
    for (const plugin of clientPlugins) {
      const path = relative(ctx.nuxt.options.rootDir, plugin.src);
      const variable = genSafeVariableName(filename(plugin.src)).replace(/_(45|46|47)/g, "_") + "_" + hash(path);
      exports.push(variable);
      imports.push(genImport(plugin.src, variable));
    }
    return [
      ...imports,
      `export default ${genArrayFromRaw(exports)}`
    ].join("\n");
  }
};
const serverPluginTemplate = {
  filename: "plugins/server.mjs",
  async getContents(ctx) {
    const serverPlugins = await annotatePlugins(ctx.nuxt, ctx.app.plugins.filter((p) => !p.mode || p.mode !== "client"));
    const exports = [];
    const imports = [];
    for (const plugin of serverPlugins) {
      const path = relative(ctx.nuxt.options.rootDir, plugin.src);
      const variable = genSafeVariableName(filename(path)).replace(/_(45|46|47)/g, "_") + "_" + hash(path);
      exports.push(variable);
      imports.push(genImport(plugin.src, variable));
    }
    return [
      ...imports,
      `export default ${genArrayFromRaw(exports)}`
    ].join("\n");
  }
};
const pluginsDeclaration = {
  filename: "types/plugins.d.ts",
  getContents: (ctx) => {
    const EXTENSION_RE = new RegExp(`(?<=\\w)(${ctx.nuxt.options.extensions.map((e) => escapeRE(e)).join("|")})$`, "g");
    const tsImports = ctx.app.plugins.filter((p) => !isAbsolute(p.src) || existsSync(p.src) || existsSync(p.src.replace(EXTENSION_RE, ".d.ts"))).map((p) => (isAbsolute(p.src) ? relative(join(ctx.nuxt.options.buildDir, "types"), p.src) : p.src).replace(EXTENSION_RE, ""));
    return `// Generated by Nuxt'
import type { Plugin } from '#app'

type Decorate<T extends Record<string, any>> = { [K in keyof T as K extends string ? \`$\${K}\` : never]: T[K] }

type InjectionType<A extends Plugin> = A extends Plugin<infer T> ? Decorate<T> : unknown

type NuxtAppInjections = 
  ${tsImports.map((p) => `InjectionType<typeof ${genDynamicImport(p, { wrapper: false })}.default>`).join(" &\n  ")}

declare module '#app' {
  interface NuxtApp extends NuxtAppInjections { }
}

declare module 'vue' {
  interface ComponentCustomProperties extends NuxtAppInjections { }
}

export { }
`;
  }
};
const adHocModules = ["router", "pages", "imports", "meta", "components", "nuxt-config-schema"];
const schemaTemplate = {
  filename: "types/schema.d.ts",
  getContents: async ({ nuxt }) => {
    const moduleInfo = nuxt.options._installedModules.map((m) => ({
      ...m.meta || {},
      importName: m.entryPath || m.meta?.name
    })).filter((m) => m.configKey && m.name && !adHocModules.includes(m.name));
    const relativeRoot = relative(resolve(nuxt.options.buildDir, "types"), nuxt.options.rootDir);
    const getImportName = (name) => (name.startsWith(".") ? "./" + join(relativeRoot, name) : name).replace(/\.\w+$/, "");
    const modules = moduleInfo.map((meta) => [genString(meta.configKey), getImportName(meta.importName)]);
    return [
      "import { NuxtModule, RuntimeConfig } from 'nuxt/schema'",
      "declare module 'nuxt/schema' {",
      "  interface NuxtConfig {",
      ...modules.map(
        ([configKey, importName]) => `    [${configKey}]?: typeof ${genDynamicImport(importName, { wrapper: false })}.default extends NuxtModule<infer O> ? Partial<O> : Record<string, any>`
      ),
      modules.length > 0 ? `    modules?: (undefined | null | false | NuxtModule | string | [NuxtModule | string, Record<string, any>] | ${modules.map(([configKey, importName]) => `[${genString(importName)}, Exclude<NuxtConfig[${configKey}], boolean>]`).join(" | ")})[],` : "",
      "  }",
      generateTypes(
        await resolveSchema(Object.fromEntries(Object.entries(nuxt.options.runtimeConfig).filter(([key]) => key !== "public"))),
        {
          interfaceName: "RuntimeConfig",
          addExport: false,
          addDefaults: false,
          allowExtraKeys: false,
          indentation: 2
        }
      ),
      generateTypes(
        await resolveSchema(nuxt.options.runtimeConfig.public),
        {
          interfaceName: "PublicRuntimeConfig",
          addExport: false,
          addDefaults: false,
          allowExtraKeys: false,
          indentation: 2
        }
      ),
      "}",
      `declare module 'vue' {
        interface ComponentCustomProperties {
          $config: RuntimeConfig
        }
      }`
    ].join("\n");
  }
};
const layoutTemplate = {
  filename: "layouts.mjs",
  getContents({ app }) {
    const layoutsObject = genObjectFromRawEntries(Object.values(app.layouts).map(({ name, file }) => {
      return [name, genDynamicImport(file, { interopDefault: true })];
    }));
    return [
      `export default ${layoutsObject}`
    ].join("\n");
  }
};
const middlewareTemplate = {
  filename: "middleware.mjs",
  getContents({ app }) {
    const globalMiddleware = app.middleware.filter((mw) => mw.global);
    const namedMiddleware = app.middleware.filter((mw) => !mw.global);
    const namedMiddlewareObject = genObjectFromRawEntries(namedMiddleware.map((mw) => [mw.name, genDynamicImport(mw.path)]));
    return [
      ...globalMiddleware.map((mw) => genImport(mw.path, genSafeVariableName(mw.name))),
      `export const globalMiddleware = ${genArrayFromRaw(globalMiddleware.map((mw) => genSafeVariableName(mw.name)))}`,
      `export const namedMiddleware = ${namedMiddlewareObject}`
    ].join("\n");
  }
};
const nitroSchemaTemplate = {
  filename: "types/nitro-nuxt.d.ts",
  getContents: () => {
    return (
      /* typescript */
      `
/// <reference path="./schema.d.ts" />

import type { RuntimeConfig } from 'nuxt/schema'
import type { H3Event } from 'h3'
import type { NuxtIslandContext, NuxtIslandResponse, NuxtRenderHTMLContext } from 'nuxt/dist/core/runtime/nitro/renderer'

declare module 'nitropack' {
  interface NitroRuntimeConfigApp {
    buildAssetsDir: string
    cdnURL: string
  }
  interface NitroRuntimeConfig extends RuntimeConfig {}
  interface NitroRouteConfig {
    ssr?: boolean
    experimentalNoScripts?: boolean
  }
  interface NitroRouteRules {
    ssr?: boolean
    experimentalNoScripts?: boolean
  }
  interface NitroRuntimeHooks {
    'render:html': (htmlContext: NuxtRenderHTMLContext, context: { event: H3Event }) => void | Promise<void>
    'render:island': (islandResponse: NuxtIslandResponse, context: { event: H3Event, islandContext: NuxtIslandContext }) => void | Promise<void>
  }
}
`
    );
  }
};
const clientConfigTemplate = {
  filename: "nitro.client.mjs",
  getContents: () => `
export const useRuntimeConfig = () => window?.__NUXT__?.config || {}
`
};
const appConfigDeclarationTemplate = {
  filename: "types/app.config.d.ts",
  getContents: ({ app, nuxt }) => {
    return `
import type { CustomAppConfig } from 'nuxt/schema'
import type { Defu } from 'defu'
${app.configs.map((id, index) => `import ${`cfg${index}`} from ${JSON.stringify(id.replace(/(?<=\w)\.\w+$/g, ""))}`).join("\n")}

declare const inlineConfig = ${JSON.stringify(nuxt.options.appConfig, null, 2)}
type ResolvedAppConfig = Defu<typeof inlineConfig, [${app.configs.map((_id, index) => `typeof cfg${index}`).join(", ")}]>
type IsAny<T> = 0 extends 1 & T ? true : false

type MergedAppConfig<Resolved extends Record<string, unknown>, Custom extends Record<string, unknown>> = {
  [K in keyof (Resolved & Custom)]: K extends keyof Custom
    ? unknown extends Custom[K]
      ? Resolved[K]
      : IsAny<Custom[K]> extends true
        ? Resolved[K]
        : Custom[K] extends Record<string, any>
            ? Resolved[K] extends Record<string, any>
              ? MergedAppConfig<Resolved[K], Custom[K]>
              : Exclude<Custom[K], undefined>
            : Exclude<Custom[K], undefined>
    : Resolved[K]
}

declare module 'nuxt/schema' {
  interface AppConfig extends MergedAppConfig<ResolvedAppConfig, CustomAppConfig> { }
}
declare module '@nuxt/schema' {
  interface AppConfig extends MergedAppConfig<ResolvedAppConfig, CustomAppConfig> { }
}
`;
  }
};
const appConfigTemplate = {
  filename: "app.config.mjs",
  write: true,
  getContents: async ({ app, nuxt }) => {
    return `
import { updateAppConfig } from '#app'
import { defuFn } from '${await _resolveId("defu")}'

const inlineConfig = ${JSON.stringify(nuxt.options.appConfig, null, 2)}

// Vite - webpack is handled directly in #app/config
if (import.meta.hot) {
  import.meta.hot.accept((newModule) => {
    updateAppConfig(newModule.default)
  })
}

${app.configs.map((id, index) => `import ${`cfg${index}`} from ${JSON.stringify(id)}`).join("\n")}

export default /* #__PURE__ */ defuFn(${app.configs.map((_id, index) => `cfg${index}`).concat(["inlineConfig"]).join(", ")})
`;
  }
};
const publicPathTemplate = {
  filename: "paths.mjs",
  async getContents({ nuxt }) {
    return [
      `import { joinURL } from '${await _resolveId("ufo")}'`,
      !nuxt.options.dev && "import { useRuntimeConfig } from '#internal/nitro'",
      nuxt.options.dev ? `const appConfig = ${JSON.stringify(nuxt.options.app)}` : "const appConfig = useRuntimeConfig().app",
      "export const baseURL = () => appConfig.baseURL",
      "export const buildAssetsDir = () => appConfig.buildAssetsDir",
      "export const buildAssetsURL = (...path) => joinURL(publicAssetsURL(), buildAssetsDir(), ...path)",
      "export const publicAssetsURL = (...path) => {",
      "  const publicBase = appConfig.cdnURL || appConfig.baseURL",
      "  return path.length ? joinURL(publicBase, ...path) : publicBase",
      "}",
      // On server these are registered directly in packages/nuxt/src/core/runtime/nitro/renderer.ts
      "if (import.meta.client) {",
      "  globalThis.__buildAssetsURL = buildAssetsURL",
      "  globalThis.__publicAssetsURL = publicAssetsURL",
      "}"
    ].filter(Boolean).join("\n");
  }
};
const nuxtConfigTemplate = {
  filename: "nuxt.config.mjs",
  getContents: (ctx) => {
    return [
      ...Object.entries(ctx.nuxt.options.app).map(([k, v]) => `export const ${camelCase("app-" + k)} = ${JSON.stringify(v)}`),
      `export const renderJsonPayloads = ${!!ctx.nuxt.options.experimental.renderJsonPayloads}`,
      `export const componentIslands = ${!!ctx.nuxt.options.experimental.componentIslands}`,
      `export const payloadExtraction = ${!!ctx.nuxt.options.experimental.payloadExtraction}`,
      `export const appManifest = ${!!ctx.nuxt.options.experimental.appManifest}`,
      `export const remoteComponentIslands = ${ctx.nuxt.options.experimental.componentIslands === "local+remote"}`,
      `export const devPagesDir = ${ctx.nuxt.options.dev ? JSON.stringify(ctx.nuxt.options.dir.pages) : "null"}`,
      `export const devRootDir = ${ctx.nuxt.options.dev ? JSON.stringify(ctx.nuxt.options.rootDir) : "null"}`,
      `export const vueAppRootContainer = ${ctx.nuxt.options.app.rootId ? `'#${ctx.nuxt.options.app.rootId}'` : `'body > ${ctx.nuxt.options.app.rootTag}'`}`
    ].join("\n\n");
  }
};
function _resolveId(id) {
  return resolvePath(id, {
    url: [
      ...typeof global.__NUXT_PREPATHS__ === "string" ? [global.__NUXT_PREPATHS__] : global.__NUXT_PREPATHS__ || [],
      import.meta.url,
      process.cwd(),
      ...typeof global.__NUXT_PATHS__ === "string" ? [global.__NUXT_PATHS__] : global.__NUXT_PATHS__ || []
    ]
  });
}

const defaultTemplates = {
  __proto__: null,
  appComponentTemplate: appComponentTemplate,
  appConfigDeclarationTemplate: appConfigDeclarationTemplate,
  appConfigTemplate: appConfigTemplate,
  clientConfigTemplate: clientConfigTemplate,
  clientPluginTemplate: clientPluginTemplate,
  cssTemplate: cssTemplate,
  errorComponentTemplate: errorComponentTemplate,
  layoutTemplate: layoutTemplate,
  middlewareTemplate: middlewareTemplate,
  nitroSchemaTemplate: nitroSchemaTemplate,
  nuxtConfigTemplate: nuxtConfigTemplate,
  pluginsDeclaration: pluginsDeclaration,
  publicPathTemplate: publicPathTemplate,
  rootComponentTemplate: rootComponentTemplate,
  schemaTemplate: schemaTemplate,
  serverPluginTemplate: serverPluginTemplate,
  testComponentWrapperTemplate: testComponentWrapperTemplate,
  vueShim: vueShim
};

function createApp(nuxt, options = {}) {
  return defu(options, {
    dir: nuxt.options.srcDir,
    extensions: nuxt.options.extensions,
    plugins: [],
    components: [],
    templates: []
  });
}
async function generateApp(nuxt, app, options = {}) {
  await resolveApp(nuxt, app);
  app.templates = Object.values(defaultTemplates).concat(nuxt.options.build.templates);
  await nuxt.callHook("app:templates", app);
  app.templates = app.templates.map((tmpl) => normalizeTemplate(tmpl));
  const templateContext = { utils: templateUtils, nuxt, app };
  const filteredTemplates = app.templates.filter((template) => !options.filter || options.filter(template));
  const writes = [];
  await Promise.allSettled(filteredTemplates.map(async (template) => {
    const fullPath = template.dst || resolve(nuxt.options.buildDir, template.filename);
    const mark = performance.mark(fullPath);
    const contents = await compileTemplate(template, templateContext).catch((e) => {
      logger.error(`Could not compile template \`${template.filename}\`.`);
      throw e;
    });
    nuxt.vfs[fullPath] = contents;
    const aliasPath = "#build/" + template.filename.replace(/\.\w+$/, "");
    nuxt.vfs[aliasPath] = contents;
    if (process.platform === "win32") {
      nuxt.vfs[fullPath.replace(/\//g, "\\")] = contents;
    }
    const perf = performance.measure(fullPath, mark?.name);
    const setupTime = perf ? Math.round(perf.duration * 100) / 100 : 0;
    if (nuxt.options.debug || setupTime > 500) {
      logger.info(`Compiled \`${template.filename}\` in ${setupTime}ms`);
    }
    if (template.write) {
      writes.push(() => {
        mkdirSync(dirname(fullPath), { recursive: true });
        writeFileSync(fullPath, contents, "utf8");
      });
    }
  }));
  for (const write of writes) {
    write();
  }
  await nuxt.callHook("app:templatesGenerated", app, filteredTemplates, options);
}
async function resolveApp(nuxt, app) {
  if (!app.mainComponent) {
    app.mainComponent = await findPath(
      nuxt.options._layers.flatMap((layer) => [
        join(layer.config.srcDir, "App"),
        join(layer.config.srcDir, "app")
      ])
    );
  }
  if (!app.mainComponent) {
    app.mainComponent = await tryResolveModule("@nuxt/ui-templates/templates/welcome.vue", nuxt.options.modulesDir) ?? "@nuxt/ui-templates/templates/welcome.vue";
  }
  if (!app.rootComponent) {
    app.rootComponent = await findPath(["~/app.root", resolve(nuxt.options.appDir, "components/nuxt-root.vue")]);
  }
  if (!app.errorComponent) {
    app.errorComponent = await findPath(
      nuxt.options._layers.map((layer) => join(layer.config.srcDir, "error"))
    ) ?? resolve(nuxt.options.appDir, "components/nuxt-error-page.vue");
  }
  app.layouts = {};
  for (const config of nuxt.options._layers.map((layer) => layer.config)) {
    const layoutDir = (config.rootDir === nuxt.options.rootDir ? nuxt.options : config).dir?.layouts || "layouts";
    const layoutFiles = await resolveFiles(config.srcDir, `${layoutDir}/*{${nuxt.options.extensions.join(",")}}`);
    for (const file of layoutFiles) {
      const name = getNameFromPath(file);
      app.layouts[name] = app.layouts[name] || { name, file };
    }
  }
  app.middleware = [];
  for (const config of nuxt.options._layers.map((layer) => layer.config).reverse()) {
    const middlewareDir = (config.rootDir === nuxt.options.rootDir ? nuxt.options : config).dir?.middleware || "middleware";
    const middlewareFiles = await resolveFiles(config.srcDir, `${middlewareDir}/*{${nuxt.options.extensions.join(",")}}`);
    app.middleware.push(...middlewareFiles.map((file) => {
      const name = getNameFromPath(file);
      return { name, path: file, global: hasSuffix(file, ".global") };
    }));
  }
  app.plugins = [];
  for (const config of nuxt.options._layers.map((layer) => layer.config).reverse()) {
    const pluginDir = (config.rootDir === nuxt.options.rootDir ? nuxt.options : config).dir?.plugins || "plugins";
    app.plugins.push(...[
      ...config.plugins || [],
      ...config.srcDir ? await resolveFiles(config.srcDir, [
        `${pluginDir}/*.{ts,js,mjs,cjs,mts,cts}`,
        `${pluginDir}/*/index.*{ts,js,mjs,cjs,mts,cts}`
        // TODO: remove, only scan top-level plugins #18418
      ]) : []
    ].map((plugin) => normalizePlugin(plugin)));
  }
  for (const p of [...nuxt.options.plugins].reverse()) {
    const plugin = normalizePlugin(p);
    if (!app.plugins.some((p2) => p2.src === plugin.src)) {
      app.plugins.unshift(plugin);
    }
  }
  app.middleware = uniqueBy(await resolvePaths(app.middleware, "path"), "name");
  app.plugins = uniqueBy(await resolvePaths(app.plugins, "src"), "src");
  app.configs = [];
  for (const config of nuxt.options._layers.map((layer) => layer.config)) {
    const appConfigPath = await findPath(resolve(config.srcDir, "app.config"));
    if (appConfigPath) {
      app.configs.push(appConfigPath);
    }
  }
  await nuxt.callHook("app:resolve", app);
  app.middleware = uniqueBy(await resolvePaths(app.middleware, "path"), "name");
  app.plugins = uniqueBy(await resolvePaths(app.plugins, "src"), "src");
}
function resolvePaths(items, key) {
  return Promise.all(items.map(async (item) => {
    if (!item[key]) {
      return item;
    }
    return {
      ...item,
      [key]: await resolvePath$1(resolveAlias(item[key]))
    };
  }));
}
async function annotatePlugins(nuxt, plugins) {
  const _plugins = [];
  for (const plugin of plugins) {
    try {
      const code = plugin.src in nuxt.vfs ? nuxt.vfs[plugin.src] : await promises.readFile(plugin.src, "utf-8");
      _plugins.push({
        ...await extractMetadata(code),
        ...plugin
      });
    } catch (e) {
      logger.warn(`Could not resolve \`${plugin.src}\`.`);
      _plugins.push(plugin);
    }
  }
  return _plugins.sort((a, b) => (a.order ?? orderMap.default) - (b.order ?? orderMap.default));
}

async function checkForExternalConfigurationFiles() {
  const checkResults = await Promise.all([checkViteConfig(), checkWebpackConfig(), checkNitroConfig(), checkPostCSSConfig()]);
  const warningMessages = checkResults.filter(Boolean);
  if (!warningMessages.length) {
    return;
  }
  const foundOneExternalConfig = warningMessages.length === 1;
  if (foundOneExternalConfig) {
    logger.warn(warningMessages[0]);
  } else {
    const warningsAsList = warningMessages.map((message) => `- ${message}`).join("\n");
    const warning = `Found multiple external configuration files: 

${warningsAsList}`;
    logger.warn(warning);
  }
}
async function checkViteConfig() {
  return await checkAndWarnAboutConfigFileExistence({
    fileName: "vite.config",
    extensions: [".js", ".mjs", ".ts", ".cjs", ".mts", ".cts"],
    createWarningMessage: (foundFile) => `Using \`${foundFile}\` is not supported together with Nuxt. Use \`options.vite\` instead. You can read more in \`https://nuxt.com/docs/api/configuration/nuxt-config#vite\`.`
  });
}
async function checkWebpackConfig() {
  return await checkAndWarnAboutConfigFileExistence({
    fileName: "webpack.config",
    extensions: [".js", ".mjs", ".ts", ".cjs", ".mts", ".cts", "coffee"],
    createWarningMessage: (foundFile) => `Using \`${foundFile}\` is not supported together with Nuxt. Use \`options.webpack\` instead. You can read more in \`https://nuxt.com/docs/api/configuration/nuxt-config#webpack-1\`.`
  });
}
async function checkNitroConfig() {
  return await checkAndWarnAboutConfigFileExistence({
    fileName: "nitro.config",
    extensions: [".ts", ".mts"],
    createWarningMessage: (foundFile) => `Using \`${foundFile}\` is not supported together with Nuxt. Use \`options.nitro\` instead. You can read more in \`https://nuxt.com/docs/api/configuration/nuxt-config#nitro\`.`
  });
}
async function checkPostCSSConfig() {
  return await checkAndWarnAboutConfigFileExistence({
    fileName: "postcss.config",
    extensions: [".js", ".cjs"],
    createWarningMessage: (foundFile) => `Using \`${foundFile}\` is not supported together with Nuxt. Use \`options.postcss\` instead. You can read more in \`https://nuxt.com/docs/api/configuration/nuxt-config#postcss\`.`
  });
}
async function checkAndWarnAboutConfigFileExistence(options) {
  const { fileName, extensions, createWarningMessage } = options;
  const configFile = await findPath(fileName, { extensions }).catch(() => null);
  if (configFile) {
    return createWarningMessage(basename(configFile));
  }
}

async function build(nuxt) {
  const app = createApp(nuxt);
  nuxt.apps.default = app;
  const generateApp$1 = debounce(() => generateApp(nuxt, app), void 0, { leading: true });
  await generateApp$1();
  if (nuxt.options.dev) {
    watch(nuxt);
    nuxt.hook("builder:watch", async (event, relativePath) => {
      if (event === "change") {
        return;
      }
      const path = resolve(nuxt.options.srcDir, relativePath);
      const relativePaths = nuxt.options._layers.map((l) => relative(l.config.srcDir || l.cwd, path));
      const restartPath = relativePaths.find((relativePath2) => /^(app\.|error\.|plugins\/|middleware\/|layouts\/)/i.test(relativePath2));
      if (restartPath) {
        if (restartPath.startsWith("app")) {
          app.mainComponent = void 0;
        }
        if (restartPath.startsWith("error")) {
          app.errorComponent = void 0;
        }
        await generateApp$1();
      }
    });
    nuxt.hook("builder:generateApp", (options) => {
      if (options) {
        return generateApp(nuxt, app, options);
      }
      return generateApp$1();
    });
  }
  await nuxt.callHook("build:before");
  if (!nuxt.options._prepare) {
    await Promise.all([checkForExternalConfigurationFiles(), bundle(nuxt)]);
    await nuxt.callHook("build:done");
  }
  if (!nuxt.options.dev) {
    await nuxt.callHook("close", nuxt);
  }
}
const watchEvents = {
  create: "add",
  delete: "unlink",
  update: "change"
};
async function watch(nuxt) {
  if (nuxt.options.experimental.watcher === "parcel") {
    const success = await createParcelWatcher();
    if (success) {
      return;
    }
  }
  if (nuxt.options.experimental.watcher === "chokidar") {
    return createWatcher();
  }
  return createGranularWatcher();
}
function createWatcher() {
  const nuxt = useNuxt();
  const watcher = chokidar.watch(nuxt.options._layers.map((i) => i.config.srcDir).filter(Boolean), {
    ...nuxt.options.watchers.chokidar,
    ignoreInitial: true,
    ignored: [
      isIgnored,
      "node_modules"
    ]
  });
  watcher.on("all", (event, path) => nuxt.callHook("builder:watch", event, normalize(relative(nuxt.options.srcDir, path))));
  nuxt.hook("close", () => watcher?.close());
}
function createGranularWatcher() {
  const nuxt = useNuxt();
  if (nuxt.options.debug) {
    console.time("[nuxt] builder:chokidar:watch");
  }
  let pending = 0;
  const ignoredDirs = /* @__PURE__ */ new Set([...nuxt.options.modulesDir, nuxt.options.buildDir]);
  const pathsToWatch = nuxt.options._layers.map((layer) => layer.config.srcDir || layer.cwd).filter((d) => d && !isIgnored(d));
  for (const pattern of nuxt.options.watch) {
    if (typeof pattern !== "string") {
      continue;
    }
    const path = resolve(nuxt.options.srcDir, pattern);
    if (pathsToWatch.some((w) => path.startsWith(w.replace(/[^/]$/, "$&/")))) {
      continue;
    }
    pathsToWatch.push(path);
  }
  for (const dir of pathsToWatch) {
    pending++;
    const watcher = chokidar.watch(dir, { ...nuxt.options.watchers.chokidar, ignoreInitial: false, depth: 0, ignored: [isIgnored, "**/node_modules"] });
    const watchers = {};
    watcher.on("all", (event, path) => {
      path = normalize(path);
      if (!pending) {
        nuxt.callHook("builder:watch", event, relative(nuxt.options.srcDir, path));
      }
      if (event === "unlinkDir" && path in watchers) {
        watchers[path]?.close();
        delete watchers[path];
      }
      if (event === "addDir" && path !== dir && !ignoredDirs.has(path) && !pathsToWatch.includes(path) && !(path in watchers) && !isIgnored(path)) {
        watchers[path] = chokidar.watch(path, { ...nuxt.options.watchers.chokidar, ignored: [isIgnored] });
        watchers[path].on("all", (event2, p) => nuxt.callHook("builder:watch", event2, normalize(relative(nuxt.options.srcDir, p))));
        nuxt.hook("close", () => watchers[path]?.close());
      }
    });
    watcher.on("ready", () => {
      pending--;
      if (nuxt.options.debug && !pending) {
        console.timeEnd("[nuxt] builder:chokidar:watch");
      }
    });
  }
}
async function createParcelWatcher() {
  const nuxt = useNuxt();
  if (nuxt.options.debug) {
    console.time("[nuxt] builder:parcel:watch");
  }
  const watcherPath = await tryResolveModule("@parcel/watcher", [nuxt.options.rootDir, ...nuxt.options.modulesDir]);
  if (watcherPath) {
    const { subscribe } = await import(pathToFileURL(watcherPath).href).then(interopDefault);
    for (const layer of nuxt.options._layers) {
      if (!layer.config.srcDir) {
        continue;
      }
      const watcher = subscribe(layer.config.srcDir, (err, events) => {
        if (err) {
          return;
        }
        for (const event of events) {
          if (isIgnored(event.path)) {
            continue;
          }
          nuxt.callHook("builder:watch", watchEvents[event.type], normalize(relative(nuxt.options.srcDir, event.path)));
        }
      }, {
        ignore: [
          ...nuxt.options.ignore,
          "node_modules"
        ]
      });
      watcher.then((subscription) => {
        if (nuxt.options.debug) {
          console.timeEnd("[nuxt] builder:parcel:watch");
        }
        nuxt.hook("close", () => subscription.unsubscribe());
      });
    }
    return true;
  }
  logger.warn("Falling back to `chokidar-granular` as `@parcel/watcher` cannot be resolved in your project.");
  return false;
}
async function bundle(nuxt) {
  try {
    const { bundle: bundle2 } = typeof nuxt.options.builder === "string" ? await loadBuilder(nuxt, nuxt.options.builder) : nuxt.options.builder;
    await bundle2(nuxt);
  } catch (error) {
    await nuxt.callHook("build:error", error);
    if (error.toString().includes("Cannot find module '@nuxt/webpack-builder'")) {
      throw new Error("Could not load `@nuxt/webpack-builder`. You may need to add it to your project dependencies, following the steps in `https://github.com/nuxt/framework/pull/2812`.");
    }
    throw error;
  }
}
async function loadBuilder(nuxt, builder) {
  const builderPath = await tryResolveModule(builder, [nuxt.options.rootDir, import.meta.url]);
  if (!builderPath) {
    throw new Error(`Loading \`${builder}\` builder failed. You can read more about the nuxt \`builder\` option at: \`https://nuxt.com/docs/api/configuration/nuxt-config#builder\``);
  }
  return import(pathToFileURL(builderPath).href);
}

export { build, createNuxt, loadNuxt };
