import pify from 'pify';
import { join, resolve, normalize, dirname, isAbsolute } from 'pathe';
import { fromNodeMiddleware, defineEventHandler, handleCors, getRequestHeader, createError, setHeader } from 'h3';
import webpackDevMiddleware from 'webpack-dev-middleware';
import webpackHotMiddleware from 'webpack-hot-middleware';
import { defu } from 'defu';
import { joinURL } from 'ufo';
import { logger, importModule, useNitro, useNuxt } from '@nuxt/kit';
import { createUnplugin } from 'unplugin';
import MagicString from 'magic-string';
import { webpack, WebpackBarPlugin, builder, MiniCssExtractPlugin } from '#builder';
import { createFsFromVolume, Volume } from 'memfs';
import querystring from 'node:querystring';
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer';
import ForkTSCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin';
import { defineEnv } from 'unenv';
import TimeFixPlugin from 'time-fix-plugin';
import FriendlyErrorsWebpackPlugin from '@nuxt/friendly-errors-webpack-plugin';
import escapeRegExp from 'escape-string-regexp';
import { isTest } from 'std-env';
import { EsbuildPlugin } from 'esbuild-loader';
import CssMinimizerPlugin from 'css-minimizer-webpack-plugin';
import createResolver from 'postcss-import-resolver';
import { createJiti } from 'jiti';
import VueLoaderPlugin from 'vue-loader/dist/pluginWebpack5.js';
import { mkdir, writeFile } from 'node:fs/promises';
import { normalizeWebpackManifest } from 'vue-bundle-renderer';
import { hash } from 'ohash';
import { globby } from 'globby';
import { genSafeVariableName } from 'knitwork';

const defaults = {
  globalPublicPath: "__webpack_public_path__",
  sourcemap: true
};
const ENTRY_RE = /import ["']#build\/css["'];/;
const DynamicBasePlugin = createUnplugin((options = {}) => {
  options = { ...defaults, ...options };
  return {
    name: "nuxt:dynamic-base-path",
    enforce: "post",
    transform(code, id) {
      if (!id.includes("entry") || !ENTRY_RE.test(code)) {
        return;
      }
      const s = new MagicString(code);
      s.prepend(`import { buildAssetsURL } from '#internal/nuxt/paths';
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
class ChunkErrorPlugin {
  script = `
if (typeof ${webpack.RuntimeGlobals.require} !== "undefined") {
  var _ensureChunk = ${webpack.RuntimeGlobals.ensureChunk};
  ${webpack.RuntimeGlobals.ensureChunk} = function (chunkId) {
    return Promise.resolve(_ensureChunk(chunkId)).catch(error => {
      const e = new Event('nuxt:preloadError', { cancelable: true })
      e.payload = error
      window.dispatchEvent(e)
      throw error
    });
  };
};`;
  apply(compiler) {
    compiler.hooks.thisCompilation.tap(
      pluginName,
      (compilation) => compilation.mainTemplate.hooks.localVars.tap(
        { name: pluginName, stage: 1 },
        (source) => source + this.script
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

function toArray(value) {
  return Array.isArray(value) ? value : [value];
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
async function applyPresets(ctx, presets) {
  for (const preset of toArray(presets)) {
    if (Array.isArray(preset)) {
      await preset[0](ctx, preset[1]);
    } else {
      await preset(ctx);
    }
  }
}
function fileName(ctx, key) {
  let fileName2 = ctx.userConfig.filenames[key];
  if (typeof fileName2 === "function") {
    fileName2 = fileName2(ctx);
  }
  if (typeof fileName2 === "string" && ctx.options.dev) {
    const hash = /\[(chunkhash|contenthash|hash)(?::\d+)?\]/.exec(fileName2);
    if (hash) {
      logger.warn(`Notice: Please do not use ${hash[1]} in dev mode to prevent memory leak`);
    }
  }
  return fileName2;
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

class WarningIgnorePlugin {
  filter;
  constructor(filter) {
    this.filter = filter;
  }
  apply(compiler) {
    compiler.hooks.done.tap("warnfix-plugin", (stats) => {
      stats.compilation.warnings = stats.compilation.warnings.filter(this.filter);
    });
  }
}

async function base(ctx) {
  await applyPresets(ctx, [
    baseAlias,
    baseConfig,
    basePlugins,
    baseResolve,
    baseTranspile
  ]);
}
function baseConfig(ctx) {
  ctx.config = defu({}, {
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
  });
}
function basePlugins(ctx) {
  ctx.config.plugins ||= [];
  if (ctx.options.dev) {
    if (ctx.nuxt.options.builder !== "@nuxt/rspack-builder") {
      ctx.config.plugins.push(new TimeFixPlugin());
    }
  }
  ctx.config.plugins.push(...ctx.userConfig.plugins || []);
  if (ctx.nuxt.options.builder !== "@nuxt/rspack-builder") {
    ctx.config.plugins.push(new WarningIgnorePlugin(getWarningIgnoreFilter(ctx)));
  }
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
    ctx.config.plugins.push(new WebpackBarPlugin({
      name: ctx.name,
      color: colors[ctx.name],
      reporters: ["stats"],
      // @ts-expect-error TODO: this is a valid option for Webpack.ProgressPlugin and needs to be declared for WebpackBar
      stats: !ctx.isDev,
      reporter: {
        reporter: {
          change: (_, { shortPath }) => {
            if (!ctx.isServer) {
              ctx.nuxt.callHook(`${builder}:change`, shortPath);
            }
          },
          done: (_, { stats }) => {
            if (stats.hasErrors()) {
              ctx.nuxt.callHook(`${builder}:error`);
            } else {
              logger.success(`Finished building ${stats.compilation.name ?? "Nuxt app"}`);
            }
          },
          allDone: () => {
            ctx.nuxt.callHook(`${builder}:done`);
          },
          progress: ({ webpackbar }) => {
            ctx.nuxt.callHook(`${builder}:progress`, webpackbar.statesArray);
          }
        }
      }
    }));
  }
}
function baseAlias(ctx) {
  ctx.alias = {
    "#app": ctx.options.appDir,
    ...ctx.options.alias,
    ...ctx.alias
  };
  if (ctx.isClient) {
    ctx.alias["nitro/runtime"] = resolve(ctx.nuxt.options.buildDir, "nitro.client.mjs");
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
    /(^|\/)nuxt\/(src\/|dist\/)?(app|[^/]+\/runtime)($|\/)/
  ];
  for (let pattern of ctx.options.build.transpile) {
    if (typeof pattern === "function") {
      const result = pattern(ctx);
      if (result) {
        pattern = result;
      }
    }
    if (typeof pattern === "string") {
      transpile.push(new RegExp(escapeRegExp(normalize(pattern))));
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
    "__NUXT_VERSION__": JSON.stringify(ctx.nuxt._version),
    "__NUXT_ASYNC_CONTEXT__": ctx.options.experimental.asyncContext,
    "process.env.VUE_ENV": JSON.stringify(ctx.name),
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
        const lastSegment = file.split("node_modules", 2)[1];
        if (!lastSegment) {
          return false;
        }
        return !ctx.transpile.some((module) => module.test(lastSegment));
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
function sortPlugins({ plugins, order }) {
  const names = Object.keys(plugins);
  return typeof order === "function" ? order(names) : order || names;
}
async function getPostcssConfig(nuxt) {
  if (!nuxt.options.webpack.postcss || !nuxt.options.postcss) {
    return false;
  }
  const postcssOptions = defu({}, nuxt.options.postcss, {
    plugins: {
      /**
       * https://github.com/postcss/postcss-import
       */
      "postcss-import": {
        resolve: createResolver({
          alias: { ...nuxt.options.alias },
          modules: nuxt.options.modulesDir
        })
      },
      /**
       * https://github.com/postcss/postcss-url
       */
      "postcss-url": {}
    },
    sourceMap: nuxt.options.webpack.cssSourceMap
  });
  const jiti = createJiti(nuxt.options.rootDir, { alias: nuxt.options.alias });
  if (!Array.isArray(postcssOptions.plugins) && isPureObject(postcssOptions.plugins)) {
    const plugins = [];
    for (const pluginName of sortPlugins(postcssOptions)) {
      const pluginOptions = postcssOptions.plugins[pluginName];
      if (!pluginOptions) {
        continue;
      }
      let pluginFn;
      for (const parentURL of nuxt.options.modulesDir) {
        pluginFn = await jiti.import(pluginName, { parentURL: parentURL.replace(/\/node_modules\/?$/, ""), try: true, default: true });
        if (typeof pluginFn === "function") {
          plugins.push(pluginFn(pluginOptions));
          break;
        }
      }
      if (typeof pluginFn !== "function") {
        console.warn(`[nuxt] could not import postcss plugin \`${pluginName}\`. Please report this as a bug.`);
      }
    }
    postcssOptions.plugins = plugins;
  }
  return {
    sourceMap: nuxt.options.webpack.cssSourceMap,
    ...nuxt.options.webpack.postcss,
    postcssOptions
  };
}

async function style(ctx) {
  await applyPresets(ctx, [
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
  const config = ctx.userConfig.extractCSS;
  if (!config) {
    return;
  }
  const filename = fileName(ctx, "css");
  ctx.config.plugins.push(new MiniCssExtractPlugin({
    filename,
    chunkFilename: filename,
    ...config === true ? {} : config
  }));
}
async function loaders(ctx) {
  ctx.config.module.rules.push(await createdStyleRule("css", /\.css$/i, null, ctx));
  ctx.config.module.rules.push(await createdStyleRule("postcss", /\.p(ost)?css$/i, null, ctx));
  const lessLoader = { loader: "less-loader", options: ctx.userConfig.loaders.less };
  ctx.config.module.rules.push(await createdStyleRule("less", /\.less$/i, lessLoader, ctx));
  const sassLoader = { loader: "sass-loader", options: ctx.userConfig.loaders.sass };
  ctx.config.module.rules.push(await createdStyleRule("sass", /\.sass$/i, sassLoader, ctx));
  const scssLoader = { loader: "sass-loader", options: ctx.userConfig.loaders.scss };
  ctx.config.module.rules.push(await createdStyleRule("scss", /\.scss$/i, scssLoader, ctx));
  const stylusLoader = { loader: "stylus-loader", options: ctx.userConfig.loaders.stylus };
  ctx.config.module.rules.push(await createdStyleRule("stylus", /\.styl(us)?$/i, stylusLoader, ctx));
}
async function createdStyleRule(lang, test, processorLoader, ctx) {
  const styleLoaders = [
    await createPostcssLoadersRule(ctx),
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
        cssLoader.options.modules.exportOnlyLocals ??= true;
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
async function createPostcssLoadersRule(ctx) {
  if (!ctx.options.postcss) {
    return;
  }
  const config = await getPostcssConfig(ctx.nuxt);
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
const isCSSRegExp = /\.css(?:\?[^.]+)?$/;
const isCSS = (file) => isCSSRegExp.test(file);
const isHotUpdate = (file) => file.includes("hot-update");

class VueSSRClientPlugin {
  options;
  constructor(options) {
    this.options = Object.assign({
      filename: null
    }, options);
  }
  apply(compiler) {
    compiler.hooks.afterEmit.tap("VueSSRClientPlugin", async (compilation) => {
      const stats = compilation.getStats().toJson();
      const initialFiles = /* @__PURE__ */ new Set();
      for (const { assets } of Object.values(stats.entrypoints)) {
        if (!assets) {
          continue;
        }
        for (const asset of assets) {
          const file = asset.name;
          if ((isJS(file) || isCSS(file)) && !isHotUpdate(file)) {
            initialFiles.add(file);
          }
        }
      }
      const allFiles = /* @__PURE__ */ new Set();
      const asyncFiles = /* @__PURE__ */ new Set();
      const assetsMapping = {};
      for (const { name: file, chunkNames = [] } of stats.assets) {
        if (isHotUpdate(file)) {
          continue;
        }
        allFiles.add(file);
        const isFileJS = isJS(file);
        if (!initialFiles.has(file) && (isFileJS || isCSS(file))) {
          asyncFiles.add(file);
        }
        if (isFileJS) {
          const componentHash = hash(chunkNames.join("|"));
          const map = assetsMapping[componentHash] ||= [];
          map.push(file);
        }
      }
      const webpackManifest = {
        publicPath: stats.publicPath,
        all: [...allFiles],
        initial: [...initialFiles],
        async: [...asyncFiles],
        modules: {
          /* [identifier: string]: Array<index: number> */
        },
        assetsMapping
      };
      const { entrypoints = {}, namedChunkGroups = {} } = stats;
      const fileToIndex = (file) => webpackManifest.all.indexOf(String(file));
      for (const m of stats.modules) {
        if (m.chunks?.length !== 1) {
          continue;
        }
        const [cid] = m.chunks;
        const chunk = stats.chunks.find((c) => c.id === cid);
        if (!chunk || !chunk.files || !cid) {
          continue;
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
        webpackManifest.modules[hash(id)] = files;
        if (Array.isArray(m.modules)) {
          for (const concatenatedModule of m.modules) {
            const id2 = hash(concatenatedModule.identifier.replace(/\s\w+$/, ""));
            webpackManifest.modules[id2] ||= files;
          }
        }
        if (stats.modules) {
          for (const m2 of stats.modules) {
            if (m2.assets?.length && m2.chunks?.includes(cid)) {
              files.push(...m2.assets.map(fileToIndex));
            }
          }
        }
      }
      const manifest = normalizeWebpackManifest(webpackManifest);
      await this.options.nuxt.callHook("build:manifest", manifest);
      const src = JSON.stringify(manifest, null, 2);
      await mkdir(dirname(this.options.filename), { recursive: true });
      await writeFile(this.options.filename, src);
      const mjsSrc = "export default " + src;
      await writeFile(this.options.filename.replace(".json", ".mjs"), mjsSrc);
    });
  }
}

const JS_MAP_RE = /\.js\.map$/;
class VueSSRServerPlugin {
  options;
  constructor(options = {}) {
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
    options: ctx.userConfig.loaders.vue
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
    "__VUE_OPTIONS_API__": "true",
    "__VUE_PROD_DEVTOOLS__": "false",
    "__VUE_PROD_HYDRATION_MISMATCH_DETAILS__": ctx.nuxt.options.debug && ctx.nuxt.options.debug.hydration
  }));
}

async function nuxt(ctx) {
  await applyPresets(ctx, [
    base,
    assets,
    esbuild,
    pug,
    style,
    vue
  ]);
}

async function client(ctx) {
  ctx.name = "client";
  ctx.isClient = true;
  await applyPresets(ctx, [
    nuxt,
    clientPlugins,
    clientOptimization,
    clientDevtool,
    clientPerformance,
    clientHMR,
    clientNodeCompat
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
function clientNodeCompat(ctx) {
  if (!ctx.nuxt.options.experimental.clientNodeCompat) {
    return;
  }
  ctx.config.plugins.push(new webpack.DefinePlugin({ global: "globalThis" }));
  ctx.config.resolve ||= {};
  ctx.config.resolve.fallback = {
    ...defineEnv({
      nodeCompat: true,
      resolve: true
    }).env.alias,
    ...ctx.config.resolve.fallback
  };
  ctx.config.plugins.unshift(new webpack.NormalModuleReplacementPlugin(/node:/, (resource) => {
    resource.request = resource.request.replace(/^node:/, "");
  }));
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
  ctx.config.plugins ||= [];
  ctx.config.plugins.push(new webpack.HotModuleReplacementPlugin());
}
function clientOptimization(_ctx) {
}
function clientPlugins(ctx) {
  if (!ctx.isDev && !ctx.nuxt.options.test && ctx.name === "client" && ctx.userConfig.analyze && (ctx.userConfig.analyze === true || ctx.userConfig.analyze.enabled)) {
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
    if (!ctx.nuxt.options.test && (ctx.nuxt.options.typescript.typeCheck === true || ctx.nuxt.options.typescript.typeCheck === "build" && !ctx.nuxt.options.dev)) {
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
    maxEntrypointSize: Number.POSITIVE_INFINITY,
    maxAssetSize: Number.POSITIVE_INFINITY
  };
}

const assetPattern = /\.(?:css|s[ca]ss|png|jpe?g|gif|svg|woff2?|eot|ttf|otf|webp|webm|mp4|ogv)(?:\?.*)?$/i;
async function server(ctx) {
  ctx.name = "server";
  ctx.isServer = true;
  await applyPresets(ctx, [
    nuxt,
    node,
    serverStandalone,
    serverPreset,
    serverPlugins
  ]);
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
    "nuxt-nightly",
    "!",
    "-!",
    "~",
    "@/",
    "#",
    ...ctx.options.build.transpile
  ];
  const external = [
    "nitro/runtime",
    "#shared",
    resolve(ctx.nuxt.options.rootDir, ctx.nuxt.options.dir.shared)
  ];
  if (!ctx.nuxt.options.dev) {
    external.push("#internal/nuxt/paths", "#internal/nuxt/app-config", "#app-manifest");
  }
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
  ctx.config.plugins ||= [];
  if (ctx.userConfig.serverURLPolyfill) {
    ctx.config.plugins.push(new webpack.ProvidePlugin({
      URL: [ctx.userConfig.serverURLPolyfill, "URL"],
      URLSearchParams: [ctx.userConfig.serverURLPolyfill, "URLSearchParams"]
    }));
  }
  if (!ctx.nuxt.options.test && (ctx.nuxt.options.typescript.typeCheck === true || ctx.nuxt.options.typescript.typeCheck === "build" && !ctx.nuxt.options.dev)) {
    ctx.config.plugins.push(new ForkTSCheckerWebpackPlugin({
      logger
    }));
  }
}

const PLUGIN_NAME = "dynamic-require";
const HELPER_DYNAMIC = `\0${PLUGIN_NAME}.mjs`;
const DYNAMIC_REQUIRE_RE = /import\("\.\/" ?\+(.*)\).then/g;
const BACKWARD_SLASH_RE = /\\/g;
function dynamicRequire({ dir, ignore, inline }) {
  return {
    name: PLUGIN_NAME,
    transform(code, _id) {
      return {
        code: code.replace(
          DYNAMIC_REQUIRE_RE,
          `import('${HELPER_DYNAMIC}').then(r => r.default || r).then(dynamicRequire => dynamicRequire($1)).then`
        ),
        map: null
      };
    },
    resolveId(id) {
      return id === HELPER_DYNAMIC ? id : null;
    },
    // TODO: Async chunk loading over network!
    // renderDynamicImport () {
    //   return {
    //     left: 'fetch(', right: ')'
    //   }
    // },
    async load(_id) {
      if (_id !== HELPER_DYNAMIC) {
        return null;
      }
      let files = [];
      try {
        const wpManifest = resolve(dir, "./server.manifest.json");
        files = await importModule(wpManifest).then((r) => Object.keys(r.files).filter((file) => !ignore.includes(file)));
      } catch {
        files = await globby("**/*.{cjs,mjs,js}", {
          cwd: dir,
          absolute: false,
          ignore
        });
      }
      const chunks = (await Promise.all(
        files.map(async (id) => ({
          id,
          src: resolve(dir, id).replace(BACKWARD_SLASH_RE, "/"),
          name: genSafeVariableName(id),
          meta: await getWebpackChunkMeta(resolve(dir, id))
        }))
      )).filter((chunk) => chunk.meta);
      return inline ? TMPL_INLINE({ chunks }) : TMPL_LAZY({ chunks });
    }
  };
}
async function getWebpackChunkMeta(src) {
  const chunk = await importModule(src) || {};
  const { __webpack_id__, __webpack_ids__, __webpack_modules__, id = __webpack_id__, ids = __webpack_ids__, modules = __webpack_modules__ } = chunk;
  if (!id && !ids) {
    return null;
  }
  return {
    id,
    ids,
    moduleIds: Object.keys(modules || {})
  };
}
function TMPL_INLINE({ chunks }) {
  return `${chunks.map((i) => `import * as ${i.name} from '${i.src}'`).join("\n")}
const dynamicChunks = {
  ${chunks.map((i) => ` ['${i.id}']: ${i.name}`).join(",\n")}
};

export default function dynamicRequire(id) {
  return Promise.resolve(dynamicChunks[id]);
};`;
}
function TMPL_LAZY({ chunks }) {
  return `
const dynamicChunks = {
${chunks.map((i) => ` ['${i.id}']: () => import('${i.src}')`).join(",\n")}
};

export default function dynamicRequire(id) {
  return dynamicChunks[id]();
};`;
}

const bundle = async (nuxt) => {
  const webpackConfigs = await Promise.all([client, ...nuxt.options.ssr ? [server] : []].map(async (preset) => {
    const ctx = createWebpackConfigContext(nuxt);
    ctx.userConfig = defu(nuxt.options.webpack[`$${preset.name}`], ctx.userConfig);
    await applyPresets(ctx, preset);
    return ctx.config;
  }));
  if (!nuxt.options.dev) {
    const nitro = useNitro();
    const dynamicRequirePlugin = dynamicRequire({
      dir: resolve(nuxt.options.buildDir, "dist/server"),
      inline: nitro.options.node === false || nitro.options.inlineDynamicImports,
      ignore: [
        "client.manifest.mjs",
        "server.js",
        "server.cjs",
        "server.mjs",
        "server.manifest.mjs"
      ]
    });
    const prerenderRollupPlugins = nitro.options._config.rollupConfig.plugins;
    const rollupPlugins = nitro.options.rollupConfig.plugins;
    prerenderRollupPlugins.push(dynamicRequirePlugin);
    rollupPlugins.push(dynamicRequirePlugin);
  }
  await nuxt.callHook(`${builder}:config`, webpackConfigs);
  const mfs = nuxt.options.dev ? createMFS() : null;
  for (const config of webpackConfigs) {
    config.plugins.push(DynamicBasePlugin.webpack({
      sourcemap: !!nuxt.options.sourcemap[config.name]
    }));
    if (config.name === "client" && nuxt.options.experimental.emitRouteChunkError && nuxt.options.builder !== "@nuxt/rspack-builder") {
      config.plugins.push(new ChunkErrorPlugin());
    }
  }
  await nuxt.callHook(`${builder}:configResolved`, webpackConfigs);
  const compilers = webpackConfigs.map((config) => {
    const compiler = webpack(config);
    if (nuxt.options.dev) {
      compiler.outputFileSystem = mfs;
    }
    return compiler;
  });
  nuxt.hook("close", async () => {
    for (const compiler of compilers) {
      await new Promise((resolve2) => compiler.close(resolve2));
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
  const devHandler = wdmToH3Handler(devMiddleware, nuxt.options.devServer.cors);
  const hotHandler = fromNodeMiddleware(hotMiddleware);
  await nuxt.callHook("server:devHandler", defineEventHandler(async (event) => {
    const body = await devHandler(event);
    if (body !== void 0) {
      return body;
    }
    await hotHandler(event);
  }));
  return devMiddleware;
}
function wdmToH3Handler(devMiddleware, corsOptions) {
  return defineEventHandler(async (event) => {
    const isPreflight = handleCors(event, corsOptions);
    if (isPreflight) {
      return null;
    }
    if (getRequestHeader(event, "sec-fetch-mode") === "no-cors" && getRequestHeader(event, "sec-fetch-site") === "cross-site") {
      throw createError({ statusCode: 403 });
    }
    setHeader(event, "Vary", "Origin");
    event.context.webpack = {
      ...event.context.webpack,
      devMiddleware: devMiddleware.context
    };
    const { req, res } = event.node;
    const body = await new Promise((resolve2, reject) => {
      res.stream = (stream) => {
        resolve2(stream);
      };
      res.send = (data) => {
        resolve2(data);
      };
      res.finish = (data) => {
        resolve2(data);
      };
      devMiddleware(req, res, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve2(void 0);
        }
      });
    });
    return body;
  });
}
async function compile(compiler) {
  const nuxt = useNuxt();
  await nuxt.callHook(`${builder}:compile`, { name: compiler.options.name, compiler });
  compiler.hooks.done.tap("load-resources", async (stats2) => {
    await nuxt.callHook(`${builder}:compiled`, { name: compiler.options.name, compiler, stats: stats2 });
  });
  if (nuxt.options.dev) {
    const compilersWatching = [];
    nuxt.hook("close", async () => {
      await Promise.all(compilersWatching.map((watching) => pify(watching.close.bind(watching))()));
    });
    if (compiler.options.name === "client") {
      return new Promise((resolve2, reject) => {
        compiler.hooks.done.tap("nuxt-dev", () => {
          resolve2(null);
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
    return new Promise((resolve2, reject) => {
      const watching = compiler.watch(nuxt.options.watchers.webpack, (err) => {
        if (err) {
          return reject(err);
        }
        resolve2(null);
      });
      compilersWatching.push(watching);
    });
  }
  const stats = await new Promise((resolve2, reject) => compiler.run((err, stats2) => err ? reject(err) : resolve2(stats2)));
  if (stats.hasErrors()) {
    const error = new Error("Nuxt build error");
    error.stack = stats.toString("errors-only");
    throw error;
  }
}

export { bundle };
