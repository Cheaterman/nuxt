import pify from 'pify';
import webpack from 'webpack';
import { fromNodeMiddleware, defineEventHandler } from 'h3';
import webpackDevMiddleware from 'webpack-dev-middleware';
import webpackHotMiddleware from 'webpack-hot-middleware';
import { defu } from 'defu';
import { parseURL, parseQuery, joinURL } from 'ufo';
import { useNuxt, logger, requireModule } from '@nuxt/kit';
import { pathToFileURL } from 'node:url';
import { createUnplugin } from 'unplugin';
import { isAbsolute, relative, join, resolve, normalize, dirname } from 'pathe';
import { walk } from 'estree-walker';
import MagicString from 'magic-string';
import { hash } from 'ohash';
import escapeRE from 'escape-string-regexp';
import { findStaticImports, parseStaticImport, createCommonJS } from 'mlly';
import { createFsFromVolume, Volume } from 'memfs';
import VirtualModulesPlugin from 'webpack-virtual-modules';
import querystring from 'node:querystring';
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer';
import ForkTSCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin';
import { cloneDeep, defaults as defaults$1, merge, uniq } from 'lodash-es';
import TimeFixPlugin from 'time-fix-plugin';
import WebpackBar from 'webpackbar';
import FriendlyErrorsWebpackPlugin from '@nuxt/friendly-errors-webpack-plugin';
import { isTest } from 'std-env';
import { EsbuildPlugin } from 'esbuild-loader';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import CssMinimizerPlugin from 'css-minimizer-webpack-plugin';
import VueLoaderPlugin from 'vue-loader/dist/pluginWebpack5.js';
import { normalizeWebpackManifest } from 'vue-bundle-renderer';
import hash$1 from 'hash-sum';
import fse from 'fs-extra';

function matchWithStringOrRegex(value, matcher) {
  if (typeof matcher === "string") {
    return value === matcher;
  } else if (matcher instanceof RegExp) {
    return matcher.test(value);
  }
  return false;
}

var __defProp$3 = Object.defineProperty;
var __defNormalProp$3 = (obj, key, value) => key in obj ? __defProp$3(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$3 = (obj, key, value) => {
  __defNormalProp$3(obj, typeof key !== "symbol" ? key + "" : key, value);
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
    __publicField$3(this, "scopeIndexStack");
    __publicField$3(this, "curScopeKey");
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
    __publicField$3(this, "curScopeKey");
    __publicField$3(this, "all");
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

const defaults = {
  globalPublicPath: "__webpack_public_path__",
  sourcemap: true
};
const DynamicBasePlugin = createUnplugin((options = {}) => {
  options = { ...defaults, ...options };
  return {
    name: "nuxt:dynamic-base-path",
    enforce: "post",
    transform(code, id) {
      if (!id.includes("paths.mjs") || !code.includes("const appConfig = ")) {
        return;
      }
      const s = new MagicString(code);
      s.append(`
${options.globalPublicPath} = buildAssetsURL();
`);
      return {
        code: s.toString(),
        map: options.sourcemap ? s.generateMap({ hires: true }) : void 0
      };
    }
  };
});

const pluginName = "ChunkErrorPlugin";
const script = `
if (typeof ${webpack.RuntimeGlobals.require} !== "undefined") {
  var _ensureChunk = ${webpack.RuntimeGlobals.ensureChunk};
  ${webpack.RuntimeGlobals.ensureChunk} = function (chunkId) {
    return Promise.resolve(_ensureChunk(chunkId)).catch(err => {
      const e = new Event("nuxt.preloadError");
      e.payload = err;
      window.dispatchEvent(e);
      throw err;
    });
  };
};`;
class ChunkErrorPlugin {
  apply(compiler) {
    compiler.hooks.thisCompilation.tap(
      pluginName,
      (compilation) => compilation.mainTemplate.hooks.localVars.tap(
        { name: pluginName, stage: 1 },
        (source) => source + script
      )
    );
  }
}

function createMFS() {
  const fs = createFsFromVolume(new Volume());
  const _fs = { ...fs };
  _fs.join = join;
  _fs.exists = (p) => Promise.resolve(_fs.existsSync(p));
  _fs.readFile = pify(_fs.readFile);
  return _fs;
}

function registerVirtualModules() {
  const nuxt = useNuxt();
  const virtualModules = new VirtualModulesPlugin(nuxt.vfs);
  const writeFiles = () => {
    for (const filePath in nuxt.vfs) {
      virtualModules.writeModule(filePath, nuxt.vfs[filePath]);
    }
  };
  nuxt.hook("webpack:compile", ({ compiler }) => {
    if (compiler.name === "server") {
      writeFiles();
    }
  });
  nuxt.hook("app:templatesGenerated", writeFiles);
  nuxt.hook("webpack:config", (configs) => configs.forEach((config) => {
    config.plugins.push(virtualModules);
  }));
}

function createWebpackConfigContext(nuxt) {
  return {
    nuxt,
    options: nuxt.options,
    userConfig: nuxt.options.webpack,
    config: {},
    name: "base",
    isDev: nuxt.options.dev,
    isServer: false,
    isClient: false,
    alias: {},
    transpile: []
  };
}
function applyPresets(ctx, presets) {
  if (!Array.isArray(presets)) {
    presets = [presets];
  }
  for (const preset of presets) {
    if (Array.isArray(preset)) {
      preset[0](ctx, preset[1]);
    } else {
      preset(ctx);
    }
  }
}
function fileName(ctx, key) {
  let fileName2 = ctx.userConfig.filenames[key];
  if (typeof fileName2 === "function") {
    fileName2 = fileName2(ctx);
  }
  if (typeof fileName2 === "string" && ctx.options.dev) {
    const hash = /\[(chunkhash|contenthash|hash)(?::(\d+))?]/.exec(fileName2);
    if (hash) {
      logger.warn(`Notice: Please do not use ${hash[1]} in dev mode to prevent memory leak`);
    }
  }
  return fileName2;
}
function getWebpackConfig(ctx) {
  return cloneDeep(ctx.config);
}

function assets(ctx) {
  ctx.config.module.rules.push(
    {
      test: /\.(png|jpe?g|gif|svg|webp)$/i,
      use: [{
        loader: "url-loader",
        options: {
          ...ctx.userConfig.loaders.imgUrl,
          name: fileName(ctx, "img")
        }
      }]
    },
    {
      test: /\.(woff2?|eot|ttf|otf)(\?.*)?$/i,
      use: [{
        loader: "url-loader",
        options: {
          ...ctx.userConfig.loaders.fontUrl,
          name: fileName(ctx, "font")
        }
      }]
    },
    {
      test: /\.(webm|mp4|ogv)$/i,
      use: [{
        loader: "file-loader",
        options: {
          ...ctx.userConfig.loaders.file,
          name: fileName(ctx, "video")
        }
      }]
    }
  );
}

var __defProp$2 = Object.defineProperty;
var __defNormalProp$2 = (obj, key, value) => key in obj ? __defProp$2(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$2 = (obj, key, value) => {
  __defNormalProp$2(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
class WarningIgnorePlugin {
  constructor(filter) {
    __publicField$2(this, "filter");
    this.filter = filter;
  }
  apply(compiler) {
    compiler.hooks.done.tap("warnfix-plugin", (stats) => {
      stats.compilation.warnings = stats.compilation.warnings.filter(this.filter);
    });
  }
}

function base(ctx) {
  applyPresets(ctx, [
    baseAlias,
    baseConfig,
    basePlugins,
    baseResolve,
    baseTranspile
  ]);
}
function baseConfig(ctx) {
  ctx.config = {
    name: ctx.name,
    entry: { app: [resolve(ctx.options.appDir, ctx.options.experimental.asyncEntry ? "entry.async" : "entry")] },
    module: { rules: [] },
    plugins: [],
    externals: [],
    optimization: {
      ...ctx.userConfig.optimization,
      minimizer: []
    },
    experiments: {
      ...ctx.userConfig.experiments
    },
    mode: ctx.isDev ? "development" : "production",
    cache: getCache(ctx),
    output: getOutput(ctx),
    stats: statsMap[ctx.nuxt.options.logLevel] ?? statsMap.info,
    ...ctx.config
  };
}
function basePlugins(ctx) {
  ctx.config.plugins = ctx.config.plugins || [];
  if (ctx.options.dev) {
    ctx.config.plugins.push(new TimeFixPlugin());
  }
  ctx.config.plugins.push(...ctx.userConfig.plugins || []);
  ctx.config.plugins.push(new WarningIgnorePlugin(getWarningIgnoreFilter(ctx)));
  ctx.config.plugins.push(new webpack.DefinePlugin(getEnv(ctx)));
  if (ctx.isServer || ctx.isDev && ctx.userConfig.friendlyErrors) {
    ctx.config.plugins.push(
      new FriendlyErrorsWebpackPlugin({
        clearConsole: false,
        reporter: "consola",
        logLevel: "ERROR"
        // TODO
      })
    );
  }
  if (ctx.nuxt.options.webpack.profile) {
    const colors = {
      client: "green",
      server: "orange",
      modern: "blue"
    };
    ctx.config.plugins.push(new WebpackBar({
      name: ctx.name,
      color: colors[ctx.name],
      reporters: ["stats"],
      // @ts-expect-error TODO: this is a valid option for Webpack.ProgressPlugin and needs to be declared for WebpackBar
      stats: !ctx.isDev,
      reporter: {
        reporter: {
          change: (_, { shortPath }) => {
            if (!ctx.isServer) {
              ctx.nuxt.callHook("webpack:change", shortPath);
            }
          },
          done: ({ state }) => {
            if (state.hasErrors) {
              ctx.nuxt.callHook("webpack:error");
            } else {
              logger.success(`${state.name} ${state.message}`);
            }
          },
          allDone: () => {
            ctx.nuxt.callHook("webpack:done");
          },
          progress({ statesArray }) {
            ctx.nuxt.callHook("webpack:progress", statesArray);
          }
        }
      }
    }));
  }
}
function baseAlias(ctx) {
  ctx.alias = {
    "#app": ctx.options.appDir,
    "#build/plugins": resolve(ctx.options.buildDir, "plugins", ctx.isClient ? "client" : "server"),
    "#build": ctx.options.buildDir,
    ...ctx.options.alias,
    ...ctx.alias
  };
  if (ctx.isClient) {
    ctx.alias["#internal/nitro"] = resolve(ctx.nuxt.options.buildDir, "nitro.client.mjs");
  }
}
function baseResolve(ctx) {
  const webpackModulesDir = ["node_modules"].concat(ctx.options.modulesDir);
  ctx.config.resolve = {
    extensions: [".wasm", ".mjs", ".js", ".ts", ".json", ".vue", ".jsx", ".tsx"],
    alias: ctx.alias,
    modules: webpackModulesDir,
    fullySpecified: false,
    ...ctx.config.resolve
  };
  ctx.config.resolveLoader = {
    modules: webpackModulesDir,
    ...ctx.config.resolveLoader
  };
}
function baseTranspile(ctx) {
  const transpile = [
    /\.vue\.js/i,
    // include SFCs in node_modules
    /consola\/src/,
    /vue-demi/,
    /(^|\/)nuxt\/(dist\/)?(app|[^/]+\/runtime)($|\/)/
  ];
  for (let pattern of ctx.options.build.transpile) {
    if (typeof pattern === "function") {
      const result = pattern(ctx);
      if (result) {
        pattern = result;
      }
    }
    if (typeof pattern === "string") {
      transpile.push(new RegExp(escapeRE(normalize(pattern))));
    } else if (pattern instanceof RegExp) {
      transpile.push(pattern);
    }
  }
  ctx.transpile = [...transpile, ...ctx.transpile];
}
function getCache(ctx) {
  if (!ctx.options.dev) {
    return false;
  }
}
function getOutput(ctx) {
  return {
    path: resolve(ctx.options.buildDir, "dist", ctx.isServer ? "server" : joinURL("client", ctx.options.app.buildAssetsDir)),
    filename: fileName(ctx, "app"),
    chunkFilename: fileName(ctx, "chunk"),
    publicPath: joinURL(ctx.options.app.baseURL, ctx.options.app.buildAssetsDir)
  };
}
function getWarningIgnoreFilter(ctx) {
  const filters = [
    // Hide warnings about plugins without a default export (#1179)
    (warn) => warn.name === "ModuleDependencyWarning" && warn.message.includes("export 'default'") && warn.message.includes("nuxt_plugin_"),
    ...ctx.userConfig.warningIgnoreFilters || []
  ];
  return (warn) => !filters.some((ignoreFilter) => ignoreFilter(warn));
}
function getEnv(ctx) {
  const _env = {
    "process.env.NODE_ENV": JSON.stringify(ctx.config.mode),
    __NUXT_VERSION__: JSON.stringify(ctx.nuxt._version),
    "process.env.VUE_ENV": JSON.stringify(ctx.name),
    "process.env.NUXT_ASYNC_CONTEXT": ctx.options.experimental.asyncContext,
    "process.dev": ctx.options.dev,
    "process.test": isTest,
    "process.browser": ctx.isClient,
    "process.client": ctx.isClient,
    "process.server": ctx.isServer,
    "import.meta.dev": ctx.options.dev,
    "import.meta.test": isTest,
    "import.meta.browser": ctx.isClient,
    "import.meta.client": ctx.isClient,
    "import.meta.server": ctx.isServer
  };
  if (ctx.userConfig.aggressiveCodeRemoval) {
    _env["typeof process"] = JSON.stringify(ctx.isServer ? "object" : "undefined");
    _env["typeof window"] = _env["typeof document"] = JSON.stringify(!ctx.isServer ? "object" : "undefined");
  }
  return _env;
}
const statsMap = {
  silent: "none",
  info: "normal",
  verbose: "verbose"
};

function esbuild(ctx) {
  const target = ctx.isServer ? "es2020" : "chrome85";
  ctx.config.optimization.minimizer.push(new EsbuildPlugin());
  ctx.config.module.rules.push(
    {
      test: /\.m?[jt]s$/i,
      loader: "esbuild-loader",
      exclude: (file) => {
        file = file.split("node_modules", 2)[1];
        if (!file) {
          return false;
        }
        return !ctx.transpile.some((module) => module.test(file));
      },
      resolve: {
        fullySpecified: false
      },
      options: {
        target,
        ...ctx.nuxt.options.webpack.loaders.esbuild,
        loader: "ts"
      }
    },
    {
      test: /\.m?[jt]sx$/,
      loader: "esbuild-loader",
      options: {
        target,
        ...ctx.nuxt.options.webpack.loaders.esbuild,
        loader: "tsx"
      }
    }
  );
}

function pug(ctx) {
  ctx.config.module.rules.push({
    test: /\.pug$/i,
    oneOf: [
      {
        resourceQuery: /^\?vue/i,
        use: [{
          loader: "pug-plain-loader",
          options: ctx.userConfig.loaders.pugPlain
        }]
      },
      {
        use: [
          "raw-loader",
          {
            loader: "pug-plain-loader",
            options: ctx.userConfig.loaders.pugPlain
          }
        ]
      }
    ]
  });
}

const isPureObject = (obj) => obj !== null && !Array.isArray(obj) && typeof obj === "object";
const orderPresets = {
  cssnanoLast(names) {
    const nanoIndex = names.indexOf("cssnano");
    if (nanoIndex !== names.length - 1) {
      names.push(names.splice(nanoIndex, 1)[0]);
    }
    return names;
  },
  autoprefixerLast(names) {
    const nanoIndex = names.indexOf("autoprefixer");
    if (nanoIndex !== names.length - 1) {
      names.push(names.splice(nanoIndex, 1)[0]);
    }
    return names;
  },
  autoprefixerAndCssnanoLast(names) {
    return orderPresets.cssnanoLast(orderPresets.autoprefixerLast(names));
  }
};
const getPostcssConfig = (nuxt) => {
  function defaultConfig() {
    return {
      sourceMap: nuxt.options.webpack.cssSourceMap,
      plugins: nuxt.options.postcss.plugins,
      // Array, String or Function
      order: "autoprefixerAndCssnanoLast"
    };
  }
  function sortPlugins({ plugins, order }) {
    const names = Object.keys(plugins);
    if (typeof order === "string") {
      order = orderPresets[order];
    }
    return typeof order === "function" ? order(names, orderPresets) : order || names;
  }
  function loadPlugins(config) {
    if (!isPureObject(config.plugins)) {
      return;
    }
    const cjs = createCommonJS(import.meta.url);
    config.plugins = sortPlugins(config).map((pluginName) => {
      const pluginFn = requireModule(pluginName, { paths: [cjs.__dirname] });
      const pluginOptions = config.plugins[pluginName];
      if (!pluginOptions || typeof pluginFn !== "function") {
        return null;
      }
      return pluginFn(pluginOptions);
    }).filter(Boolean);
  }
  if (!nuxt.options.webpack.postcss || !nuxt.options.postcss) {
    return false;
  }
  let postcssOptions = cloneDeep(nuxt.options.postcss);
  if (isPureObject(postcssOptions)) {
    if (Array.isArray(postcssOptions.plugins)) {
      defaults$1(postcssOptions, defaultConfig());
    } else {
      postcssOptions = merge({}, defaultConfig(), postcssOptions);
      loadPlugins(postcssOptions);
    }
    return {
      sourceMap: nuxt.options.webpack.cssSourceMap,
      ...nuxt.options.webpack.postcss,
      postcssOptions
    };
  }
};

function style(ctx) {
  applyPresets(ctx, [
    loaders,
    extractCSS,
    minimizer
  ]);
}
function minimizer(ctx) {
  if (ctx.userConfig.optimizeCSS && Array.isArray(ctx.config.optimization.minimizer)) {
    ctx.config.optimization.minimizer.push(new CssMinimizerPlugin({
      ...ctx.userConfig.optimizeCSS
    }));
  }
}
function extractCSS(ctx) {
  if (ctx.userConfig.extractCSS) {
    ctx.config.plugins.push(new MiniCssExtractPlugin({
      filename: fileName(ctx, "css"),
      chunkFilename: fileName(ctx, "css"),
      ...ctx.userConfig.extractCSS === true ? {} : ctx.userConfig.extractCSS
    }));
  }
}
function loaders(ctx) {
  ctx.config.module.rules.push(createdStyleRule("css", /\.css$/i, null, ctx));
  ctx.config.module.rules.push(createdStyleRule("postcss", /\.p(ost)?css$/i, null, ctx));
  const lessLoader = { loader: "less-loader", options: ctx.userConfig.loaders.less };
  ctx.config.module.rules.push(createdStyleRule("less", /\.less$/i, lessLoader, ctx));
  const sassLoader = { loader: "sass-loader", options: ctx.userConfig.loaders.sass };
  ctx.config.module.rules.push(createdStyleRule("sass", /\.sass$/i, sassLoader, ctx));
  const scssLoader = { loader: "sass-loader", options: ctx.userConfig.loaders.scss };
  ctx.config.module.rules.push(createdStyleRule("scss", /\.scss$/i, scssLoader, ctx));
  const stylusLoader = { loader: "stylus-loader", options: ctx.userConfig.loaders.stylus };
  ctx.config.module.rules.push(createdStyleRule("stylus", /\.styl(us)?$/i, stylusLoader, ctx));
}
function createdStyleRule(lang, test, processorLoader, ctx) {
  const styleLoaders = [
    createPostcssLoadersRule(ctx),
    processorLoader
  ].filter(Boolean);
  ctx.userConfig.loaders.css.importLoaders = ctx.userConfig.loaders.cssModules.importLoaders = styleLoaders.length;
  const cssLoaders = createCssLoadersRule(ctx, ctx.userConfig.loaders.css);
  const cssModuleLoaders = createCssLoadersRule(ctx, ctx.userConfig.loaders.cssModules);
  return {
    test,
    oneOf: [
      // This matches <style module>
      {
        resourceQuery: /module/,
        use: cssModuleLoaders.concat(styleLoaders)
      },
      // This matches plain <style> or <style scoped>
      {
        use: cssLoaders.concat(styleLoaders)
      }
    ]
  };
}
function createCssLoadersRule(ctx, cssLoaderOptions) {
  const cssLoader = { loader: "css-loader", options: cssLoaderOptions };
  if (ctx.userConfig.extractCSS) {
    if (ctx.isServer) {
      if (cssLoader.options.modules) {
        cssLoader.options.modules.exportOnlyLocals = cssLoader.options.modules.exportOnlyLocals ?? true;
      }
      return [cssLoader];
    }
    return [
      {
        loader: MiniCssExtractPlugin.loader
      },
      cssLoader
    ];
  }
  return [
    // https://github.com/vuejs/vue-style-loader/issues/56
    // {
    //   loader: 'vue-style-loader',
    //   options: options.webpack.loaders.vueStyle
    // },
    cssLoader
  ];
}
function createPostcssLoadersRule(ctx) {
  if (!ctx.options.postcss) {
    return;
  }
  const config = getPostcssConfig(ctx.nuxt);
  if (!config) {
    return;
  }
  return {
    loader: "postcss-loader",
    options: config
  };
}

const validate = (compiler) => {
  if (compiler.options.target !== "node") {
    logger.warn('webpack config `target` should be "node".');
  }
  if (!compiler.options.externals) {
    logger.info(
      "It is recommended to externalize dependencies in the server build for better build performance."
    );
  }
};
const isJSRegExp = /\.[cm]?js(\?[^.]+)?$/;
const isJS = (file) => isJSRegExp.test(file);
const extractQueryPartJS = (file) => isJSRegExp.exec(file)?.[1];
const isCSS = (file) => /\.css(\?[^.]+)?$/.test(file);
const isHotUpdate = (file) => file.includes("hot-update");

var __defProp$1 = Object.defineProperty;
var __defNormalProp$1 = (obj, key, value) => key in obj ? __defProp$1(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$1 = (obj, key, value) => {
  __defNormalProp$1(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
class VueSSRClientPlugin {
  constructor(options) {
    __publicField$1(this, "options");
    this.options = Object.assign({
      filename: null
    }, options);
  }
  apply(compiler) {
    compiler.hooks.afterEmit.tap("VueSSRClientPlugin", async (compilation) => {
      const stats = compilation.getStats().toJson();
      const allFiles = uniq(stats.assets.map((a) => a.name)).filter((file) => !isHotUpdate(file));
      const initialFiles = uniq(Object.keys(stats.entrypoints).map((name) => stats.entrypoints[name].assets).reduce((files, entryAssets) => files.concat(entryAssets.map((entryAsset) => entryAsset.name)), []).filter((file) => isJS(file) || isCSS(file))).filter((file) => !isHotUpdate(file));
      const asyncFiles = allFiles.filter((file) => isJS(file) || isCSS(file)).filter((file) => !initialFiles.includes(file)).filter((file) => !isHotUpdate(file));
      const assetsMapping = {};
      stats.assets.filter(({ name }) => isJS(name)).filter(({ name }) => !isHotUpdate(name)).forEach(({ name, chunkNames = [] }) => {
        const componentHash = hash$1(chunkNames.join("|"));
        if (!assetsMapping[componentHash]) {
          assetsMapping[componentHash] = [];
        }
        assetsMapping[componentHash].push(name);
      });
      const webpackManifest = {
        publicPath: stats.publicPath,
        all: allFiles,
        initial: initialFiles,
        async: asyncFiles,
        modules: {
          /* [identifier: string]: Array<index: number> */
        },
        assetsMapping
      };
      const { entrypoints = {}, namedChunkGroups = {} } = stats;
      const assetModules = stats.modules.filter((m) => m.assets.length);
      const fileToIndex = (file) => webpackManifest.all.indexOf(file);
      stats.modules.forEach((m) => {
        if (m.chunks.length === 1) {
          const [cid] = m.chunks;
          const chunk = stats.chunks.find((c) => c.id === cid);
          if (!chunk || !chunk.files) {
            return;
          }
          const id = m.identifier.replace(/\s\w+$/, "");
          const filesSet = new Set(chunk.files.map(fileToIndex).filter((i) => i !== -1));
          for (const chunkName of chunk.names) {
            if (!entrypoints[chunkName]) {
              const chunkGroup = namedChunkGroups[chunkName];
              if (chunkGroup) {
                for (const asset of chunkGroup.assets) {
                  filesSet.add(fileToIndex(asset.name));
                }
              }
            }
          }
          const files = Array.from(filesSet);
          webpackManifest.modules[hash$1(id)] = files;
          if (Array.isArray(m.modules)) {
            for (const concatenatedModule of m.modules) {
              const id2 = hash$1(concatenatedModule.identifier.replace(/\s\w+$/, ""));
              if (!webpackManifest.modules[id2]) {
                webpackManifest.modules[id2] = files;
              }
            }
          }
          assetModules.forEach((m2) => {
            if (m2.chunks.includes(cid)) {
              files.push(...m2.assets.map(fileToIndex));
            }
          });
        }
      });
      const manifest = normalizeWebpackManifest(webpackManifest);
      await this.options.nuxt.callHook("build:manifest", manifest);
      const src = JSON.stringify(manifest, null, 2);
      await fse.mkdirp(dirname(this.options.filename));
      await fse.writeFile(this.options.filename, src);
      const mjsSrc = "export default " + src;
      await fse.writeFile(this.options.filename.replace(".json", ".mjs"), mjsSrc);
    });
  }
}

var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
const JS_MAP_RE = /\.js\.map$/;
class VueSSRServerPlugin {
  constructor(options = {}) {
    __publicField(this, "options");
    this.options = Object.assign({
      filename: null
    }, options);
  }
  apply(compiler) {
    validate(compiler);
    compiler.hooks.make.tap("VueSSRServerPlugin", (compilation) => {
      compilation.hooks.processAssets.tapAsync({
        name: "VueSSRServerPlugin",
        stage: webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL
      }, (assets, cb) => {
        const stats = compilation.getStats().toJson();
        const [entryName] = Object.keys(stats.entrypoints);
        const entryInfo = stats.entrypoints[entryName];
        if (!entryInfo) {
          return cb();
        }
        const entryAssets = entryInfo.assets.filter((asset) => isJS(asset.name));
        if (entryAssets.length > 1) {
          throw new Error(
            "Server-side bundle should have one single entry file. Avoid using CommonsChunkPlugin in the server config."
          );
        }
        const [entry] = entryAssets;
        if (!entry || typeof entry.name !== "string") {
          throw new Error(
            `Entry "${entryName}" not found. Did you specify the correct entry option?`
          );
        }
        const bundle = {
          entry: entry.name,
          files: {},
          maps: {}
        };
        stats.assets.forEach((asset) => {
          if (isJS(asset.name)) {
            const queryPart = extractQueryPartJS(asset.name);
            if (queryPart !== void 0) {
              bundle.files[asset.name] = asset.name.replace(queryPart, "");
            } else {
              bundle.files[asset.name] = asset.name;
            }
          } else if (JS_MAP_RE.test(asset.name)) {
            bundle.maps[asset.name.replace(/\.map$/, "")] = asset.name;
          } else {
            delete assets[asset.name];
          }
        });
        const src = JSON.stringify(bundle, null, 2);
        assets[this.options.filename] = {
          source: () => src,
          size: () => src.length
        };
        const mjsSrc = "export default " + src;
        assets[this.options.filename.replace(".json", ".mjs")] = {
          source: () => mjsSrc,
          map: () => null,
          size: () => mjsSrc.length
        };
        cb();
      });
    });
  }
}

function vue(ctx) {
  ctx.config.plugins.push(new (VueLoaderPlugin.default || VueLoaderPlugin)());
  ctx.config.module.rules.push({
    test: /\.vue$/i,
    loader: "vue-loader",
    options: {
      reactivityTransform: ctx.nuxt.options.experimental.reactivityTransform,
      ...ctx.userConfig.loaders.vue
    }
  });
  if (ctx.isClient) {
    ctx.config.plugins.push(new VueSSRClientPlugin({
      filename: resolve(ctx.options.buildDir, "dist/server", `${ctx.name}.manifest.json`),
      nuxt: ctx.nuxt
    }));
  } else {
    ctx.config.plugins.push(new VueSSRServerPlugin({
      filename: `${ctx.name}.manifest.json`
    }));
  }
  ctx.config.plugins.push(new webpack.DefinePlugin({
    __VUE_OPTIONS_API__: "true",
    __VUE_PROD_DEVTOOLS__: "false"
  }));
}

function nuxt(ctx) {
  applyPresets(ctx, [
    base,
    assets,
    esbuild,
    pug,
    style,
    vue
  ]);
}

function client(ctx) {
  ctx.name = "client";
  ctx.isClient = true;
  applyPresets(ctx, [
    nuxt,
    clientPlugins,
    clientOptimization,
    clientDevtool,
    clientPerformance,
    clientHMR
  ]);
}
function clientDevtool(ctx) {
  if (!ctx.nuxt.options.sourcemap.client) {
    ctx.config.devtool = false;
    return;
  }
  const prefix = ctx.nuxt.options.sourcemap.client === "hidden" ? "hidden-" : "";
  if (!ctx.isDev) {
    ctx.config.devtool = prefix + "source-map";
    return;
  }
  ctx.config.devtool = prefix + "eval-cheap-module-source-map";
}
function clientPerformance(ctx) {
  ctx.config.performance = {
    maxEntrypointSize: 1e3 * 1024,
    hints: ctx.isDev ? false : "warning",
    ...ctx.config.performance
  };
}
function clientHMR(ctx) {
  if (!ctx.isDev) {
    return;
  }
  const clientOptions = ctx.userConfig.hotMiddleware?.client || {};
  const hotMiddlewareClientOptions = {
    reload: true,
    timeout: 3e4,
    path: joinURL(ctx.options.app.baseURL, "__webpack_hmr", ctx.name),
    ...clientOptions,
    ansiColors: JSON.stringify(clientOptions.ansiColors || {}),
    overlayStyles: JSON.stringify(clientOptions.overlayStyles || {}),
    name: ctx.name
  };
  const hotMiddlewareClientOptionsStr = querystring.stringify(hotMiddlewareClientOptions);
  const app = ctx.config.entry.app;
  app.unshift(
    // https://github.com/glenjamin/webpack-hot-middleware#config
    `webpack-hot-middleware/client?${hotMiddlewareClientOptionsStr}`
  );
  ctx.config.plugins = ctx.config.plugins || [];
  ctx.config.plugins.push(new webpack.HotModuleReplacementPlugin());
}
function clientOptimization(_ctx) {
}
function clientPlugins(ctx) {
  if (!ctx.isDev && ctx.name === "client" && ctx.userConfig.analyze) {
    const statsDir = resolve(ctx.options.analyzeDir);
    ctx.config.plugins.push(new BundleAnalyzerPlugin({
      analyzerMode: "static",
      defaultSizes: "gzip",
      generateStatsFile: true,
      openAnalyzer: true,
      reportFilename: resolve(statsDir, `${ctx.name}.html`),
      statsFilename: resolve(statsDir, `${ctx.name}.json`),
      ...ctx.userConfig.analyze === true ? {} : ctx.userConfig.analyze
    }));
  }
  if (!ctx.nuxt.options.ssr) {
    if (ctx.nuxt.options.typescript.typeCheck === true || ctx.nuxt.options.typescript.typeCheck === "build" && !ctx.nuxt.options.dev) {
      ctx.config.plugins.push(new ForkTSCheckerWebpackPlugin({
        logger
      }));
    }
  }
}

function node(ctx) {
  ctx.config.target = "node";
  ctx.config.node = false;
  ctx.config.experiments.outputModule = true;
  ctx.config.output = {
    ...ctx.config.output,
    chunkFilename: "[name].mjs",
    chunkFormat: "module",
    chunkLoading: "import",
    module: true,
    environment: {
      module: true,
      arrowFunction: true,
      bigIntLiteral: true,
      const: true,
      destructuring: true,
      dynamicImport: true,
      forOf: true
    },
    library: {
      type: "module"
    }
  };
  ctx.config.performance = {
    ...ctx.config.performance,
    hints: false,
    maxEntrypointSize: Infinity,
    maxAssetSize: Infinity
  };
}

const assetPattern = /\.(css|s[ca]ss|png|jpe?g|gif|svg|woff2?|eot|ttf|otf|webp|webm|mp4|ogv)(\?.*)?$/i;
function server(ctx) {
  ctx.name = "server";
  ctx.isServer = true;
  applyPresets(ctx, [
    nuxt,
    node,
    serverStandalone,
    serverPreset,
    serverPlugins
  ]);
  return getWebpackConfig(ctx);
}
function serverPreset(ctx) {
  ctx.config.output.filename = "server.mjs";
  if (ctx.nuxt.options.sourcemap.server) {
    const prefix = ctx.nuxt.options.sourcemap.server === "hidden" ? "hidden-" : "";
    ctx.config.devtool = prefix + ctx.isDev ? "cheap-module-source-map" : "source-map";
  } else {
    ctx.config.devtool = false;
  }
  ctx.config.optimization = {
    splitChunks: false,
    minimize: false
  };
}
function serverStandalone(ctx) {
  const inline = [
    "src/",
    "#app",
    "nuxt",
    "nuxt3",
    "!",
    "-!",
    "~",
    "@/",
    "#",
    ...ctx.options.build.transpile
  ];
  const external = ["#internal/nitro"];
  if (!Array.isArray(ctx.config.externals)) {
    return;
  }
  ctx.config.externals.push(({ request }, cb) => {
    if (!request) {
      return cb(void 0, false);
    }
    if (external.includes(request)) {
      return cb(void 0, true);
    }
    if (request[0] === "." || isAbsolute(request) || inline.find((prefix) => typeof prefix === "string" && request.startsWith(prefix)) || assetPattern.test(request)) {
      return cb(void 0, false);
    }
    return cb(void 0, true);
  });
}
function serverPlugins(ctx) {
  ctx.config.plugins = ctx.config.plugins || [];
  if (ctx.userConfig.serverURLPolyfill) {
    ctx.config.plugins.push(new webpack.ProvidePlugin({
      URL: [ctx.userConfig.serverURLPolyfill, "URL"],
      URLSearchParams: [ctx.userConfig.serverURLPolyfill, "URLSearchParams"]
    }));
  }
  if (ctx.nuxt.options.typescript.typeCheck === true || ctx.nuxt.options.typescript.typeCheck === "build" && !ctx.nuxt.options.dev) {
    ctx.config.plugins.push(new ForkTSCheckerWebpackPlugin({
      logger
    }));
  }
}

const bundle = async (nuxt) => {
  registerVirtualModules();
  const webpackConfigs = [client, ...nuxt.options.ssr ? [server] : []].map((preset) => {
    const ctx = createWebpackConfigContext(nuxt);
    ctx.userConfig = defu(nuxt.options.webpack[`$${preset.name}`], ctx.userConfig);
    applyPresets(ctx, preset);
    return getWebpackConfig(ctx);
  });
  await nuxt.callHook("webpack:config", webpackConfigs);
  const mfs = nuxt.options.dev ? createMFS() : null;
  for (const config of webpackConfigs) {
    config.plugins.push(DynamicBasePlugin.webpack({
      sourcemap: !!nuxt.options.sourcemap[config.name]
    }));
    if (config.name === "client" && nuxt.options.experimental.emitRouteChunkError) {
      config.plugins.push(new ChunkErrorPlugin());
    }
    config.plugins.push(composableKeysPlugin.webpack({
      sourcemap: !!nuxt.options.sourcemap[config.name],
      rootDir: nuxt.options.rootDir,
      composables: nuxt.options.optimization.keyedComposables
    }));
  }
  await nuxt.callHook("webpack:configResolved", webpackConfigs);
  const compilers = webpackConfigs.map((config) => {
    const compiler = webpack(config);
    if (nuxt.options.dev) {
      compiler.outputFileSystem = mfs;
    }
    return compiler;
  });
  nuxt.hook("close", async () => {
    for (const compiler of compilers) {
      await new Promise((resolve) => compiler.close(resolve));
    }
  });
  if (nuxt.options.dev) {
    await Promise.all(compilers.map((c) => compile(c)));
    return;
  }
  for (const c of compilers) {
    await compile(c);
  }
};
async function createDevMiddleware(compiler) {
  const nuxt = useNuxt();
  logger.debug("Creating webpack middleware...");
  const devMiddleware = webpackDevMiddleware(compiler, {
    publicPath: joinURL(nuxt.options.app.baseURL, nuxt.options.app.buildAssetsDir),
    outputFileSystem: compiler.outputFileSystem,
    stats: "none",
    ...nuxt.options.webpack.devMiddleware
  });
  nuxt.hook("close", () => pify(devMiddleware.close.bind(devMiddleware))());
  const { client: _client, ...hotMiddlewareOptions } = nuxt.options.webpack.hotMiddleware || {};
  const hotMiddleware = webpackHotMiddleware(compiler, {
    log: false,
    heartbeat: 1e4,
    path: joinURL(nuxt.options.app.baseURL, "__webpack_hmr", compiler.options.name),
    ...hotMiddlewareOptions
  });
  const devHandler = fromNodeMiddleware(devMiddleware);
  const hotHandler = fromNodeMiddleware(hotMiddleware);
  await nuxt.callHook("server:devHandler", defineEventHandler(async (event) => {
    await devHandler(event);
    await hotHandler(event);
  }));
  return devMiddleware;
}
async function compile(compiler) {
  const nuxt = useNuxt();
  await nuxt.callHook("webpack:compile", { name: compiler.options.name, compiler });
  compiler.hooks.done.tap("load-resources", async (stats2) => {
    await nuxt.callHook("webpack:compiled", { name: compiler.options.name, compiler, stats: stats2 });
  });
  if (nuxt.options.dev) {
    const compilersWatching = [];
    nuxt.hook("close", async () => {
      await Promise.all(compilersWatching.map((watching) => pify(watching.close.bind(watching))()));
    });
    if (compiler.options.name === "client") {
      return new Promise((resolve, reject) => {
        compiler.hooks.done.tap("nuxt-dev", () => {
          resolve(null);
        });
        compiler.hooks.failed.tap("nuxt-errorlog", (err) => {
          reject(err);
        });
        createDevMiddleware(compiler).then((devMiddleware) => {
          if (devMiddleware.context.watching) {
            compilersWatching.push(devMiddleware.context.watching);
          }
        });
      });
    }
    return new Promise((resolve, reject) => {
      const watching = compiler.watch(nuxt.options.watchers.webpack, (err) => {
        if (err) {
          return reject(err);
        }
        resolve(null);
      });
      compilersWatching.push(watching);
    });
  }
  const stats = await new Promise((resolve, reject) => compiler.run((err, stats2) => err ? reject(err) : resolve(stats2)));
  if (stats.hasErrors()) {
    const error = new Error("Nuxt build error");
    error.stack = stats.toString("errors-only");
    throw error;
  }
}

export { bundle };
