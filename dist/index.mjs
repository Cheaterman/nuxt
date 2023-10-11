import { defineUntypedSchema } from 'untyped';
import { defu } from 'defu';
import { resolve, join, relative } from 'pathe';
import { isTest, isDevelopment, isDebug } from 'std-env';
import { consola } from 'consola';
import { findWorkspaceDir } from 'pkg-types';
import { loading } from '@nuxt/ui-templates';
import createResolver from 'postcss-import-resolver';
import { withoutLeadingSlash } from 'ufo';

const adhoc = defineUntypedSchema({
  /**
   * Configure Nuxt component auto-registration.
   *
   * Any components in the directories configured here can be used throughout your
   * pages, layouts (and other components) without needing to explicitly import them.
   * @see https://nuxt.com/docs/guide/directory-structure/components
   * @type {boolean | typeof import('../src/types/components').ComponentsOptions | typeof import('../src/types/components').ComponentsOptions['dirs']}
   */
  components: {
    $resolve: (val) => {
      if (Array.isArray(val)) {
        return { dirs: val };
      }
      if (val === void 0 || val === true) {
        return { dirs: [{ path: "~/components/global", global: true }, "~/components"] };
      }
      return val;
    }
  },
  /**
   * Configure how Nuxt auto-imports composables into your application.
   * @see [Nuxt 3 documentation](https://nuxt.com/docs/guide/directory-structure/composables)
   * @type {typeof import('../src/types/imports').ImportsOptions}
   */
  imports: {
    global: false,
    /**
     * An array of custom directories that will be auto-imported.
     * Note that this option will not override the default directories (~/composables, ~/utils).
     * @example
     * ```js
     * imports: {
     *   // Auto-import pinia stores defined in `~/stores`
     *   dirs: ['stores']
     * }
     * ```
     */
    dirs: []
  },
  /**
   * Whether to use the vue-router integration in Nuxt 3. If you do not provide a value it will be
   * enabled if you have a `pages/` directory in your source folder.
   * @type {boolean}
   */
  pages: void 0,
  /**
   * Manually disable nuxt telemetry.
   * @see [Nuxt Telemetry](https://github.com/nuxt/telemetry) for more information.
   * @type {boolean | Record<string, any>}
   */
  telemetry: void 0,
  /**
   * Enable Nuxt DevTools for development.
   *
   * This is an experimental feature.
   * Breaking changes for devtools might not reflect on the version of Nuxt.
   * @see  [Nuxt DevTools](https://devtools.nuxtjs.org/) for more information.
   * @experimental
   * @type {boolean | { enabled: boolean, [key: string]: any }}
   */
  devtools: false
});

const app = defineUntypedSchema({
  /**
   * Vue.js config
   */
  vue: {
    /**
     * Options for the Vue compiler that will be passed at build time.
     * @see [documentation](https://vuejs.org/api/application.html#app-config-compileroptions)
     * @type {typeof import('@vue/compiler-core').CompilerOptions}
     */
    compilerOptions: {},
    /**
     * Include Vue compiler in runtime bundle.
     */
    runtimeCompiler: {
      $resolve: async (val, get) => val ?? await get("experimental.runtimeVueCompiler") ?? false
    },
    /**
     * Vue Experimental: Enable reactive destructure for `defineProps`
     * @see [Vue RFC#502](https://github.com/vuejs/rfcs/discussions/502)
     * @type {boolean}
     */
    propsDestructure: false,
    /**
     * Vue Experimental: Enable macro `defineModel`
     * @see [Vue RFC#503](https://github.com/vuejs/rfcs/discussions/503)
     * @type {boolean}
     */
    defineModel: false
  },
  /**
   * Nuxt App configuration.
   */
  app: {
    /**
     * The base path of your Nuxt application.
     *
     * This can be set at runtime by setting the NUXT_APP_BASE_URL environment variable.
     * @example
     * ```bash
     * NUXT_APP_BASE_URL=/prefix/ node .output/server/index.mjs
     * ```
     */
    baseURL: {
      $resolve: (val) => val || process.env.NUXT_APP_BASE_URL || "/"
    },
    /** The folder name for the built site assets, relative to `baseURL` (or `cdnURL` if set). This is set at build time and should not be customized at runtime. */
    buildAssetsDir: {
      $resolve: (val) => val || process.env.NUXT_APP_BUILD_ASSETS_DIR || "/_nuxt/"
    },
    /**
     * An absolute URL to serve the public folder from (production-only).
     *
     * This can be set to a different value at runtime by setting the `NUXT_APP_CDN_URL` environment variable.
     * @example
     * ```bash
     * NUXT_APP_CDN_URL=https://mycdn.org/ node .output/server/index.mjs
     * ```
     */
    cdnURL: {
      $resolve: async (val, get) => await get("dev") ? "" : (process.env.NUXT_APP_CDN_URL ?? val) || ""
    },
    /**
     * Set default configuration for `<head>` on every page.
     * @example
     * ```js
     * app: {
     *   head: {
     *     meta: [
     *       // <meta name="viewport" content="width=device-width, initial-scale=1">
     *       { name: 'viewport', content: 'width=device-width, initial-scale=1' }
     *     ],
     *     script: [
     *       // <script src="https://myawesome-lib.js"><\/script>
     *       { src: 'https://awesome-lib.js' }
     *     ],
     *     link: [
     *       // <link rel="stylesheet" href="https://myawesome-lib.css">
     *       { rel: 'stylesheet', href: 'https://awesome-lib.css' }
     *     ],
     *     // please note that this is an area that is likely to change
     *     style: [
     *       // <style type="text/css">:root { color: red }</style>
     *       { children: ':root { color: red }', type: 'text/css' }
     *     ],
     *     noscript: [
     *       // <noscript>JavaScript is required</noscript>
     *       { children: 'JavaScript is required' }
     *     ]
     *   }
     * }
     * ```
     * @type {typeof import('../src/types/config').NuxtAppConfig['head']}
     */
    head: {
      $resolve: async (val, get) => {
        const resolved = defu(val, await get("meta"), {
          meta: [],
          link: [],
          style: [],
          script: [],
          noscript: []
        });
        if (!resolved.meta.find((m) => m.charset)?.charset) {
          resolved.meta.unshift({ charset: resolved.charset || "utf-8" });
        }
        if (!resolved.meta.find((m) => m.name === "viewport")?.content) {
          resolved.meta.unshift({ name: "viewport", content: resolved.viewport || "width=device-width, initial-scale=1" });
        }
        resolved.meta = resolved.meta.filter(Boolean);
        resolved.link = resolved.link.filter(Boolean);
        resolved.style = resolved.style.filter(Boolean);
        resolved.script = resolved.script.filter(Boolean);
        resolved.noscript = resolved.noscript.filter(Boolean);
        return resolved;
      }
    },
    /**
     * Default values for layout transitions.
     *
     * This can be overridden with `definePageMeta` on an individual page.
     * Only JSON-serializable values are allowed.
     * @see https://vuejs.org/api/built-in-components.html#transition
     * @type {typeof import('../src/types/config').NuxtAppConfig['layoutTransition']}
     */
    layoutTransition: false,
    /**
     * Default values for page transitions.
     *
     * This can be overridden with `definePageMeta` on an individual page.
     * Only JSON-serializable values are allowed.
     * @see https://vuejs.org/api/built-in-components.html#transition
     * @type {typeof import('../src/types/config').NuxtAppConfig['pageTransition']}
     */
    pageTransition: false,
    /**
     * Default values for KeepAlive configuration between pages.
     *
     * This can be overridden with `definePageMeta` on an individual page.
     * Only JSON-serializable values are allowed.
     * @see https://vuejs.org/api/built-in-components.html#keepalive
     * @type {typeof import('../src/types/config').NuxtAppConfig['keepalive']}
     */
    keepalive: false,
    /**
     * Customize Nuxt root element id.
     * @type {string | false}
     */
    rootId: {
      $resolve: (val) => val === false ? false : val || "__nuxt"
    },
    /**
     * Customize Nuxt root element tag.
     */
    rootTag: {
      $resolve: (val) => val || "div"
    }
  },
  /**
   * Boolean or a path to an HTML file with the contents of which will be inserted into any HTML page
   * rendered with `ssr: false`.
   * - If it is unset, it will use `~/app/spa-loading-template.html` if it exists.
   * - If it is false, no SPA loading indicator will be loaded.
   * - If true, Nuxt will look for `~/app/spa-loading-template.html` file or a default Nuxt image will be used.
   *
   * Some good sources for spinners are [SpinKit](https://github.com/tobiasahlin/SpinKit) or [SVG Spinners](https://icones.js.org/collection/svg-spinners).
   * @example ~/app/spa-loading-template.html
   * ```html
   * <!-- https://github.com/barelyhuman/snips/blob/dev/pages/css-loader.md -->
   * <div class="loader"></div>
   * <style>
   * .loader {
   *   display: block;
   *   position: fixed;
   *   z-index: 1031;
   *   top: 50%;
   *   left: 50%;
   *   transform: translate(-50%, -50%);
   *   width: 18px;
   *   height: 18px;
   *   box-sizing: border-box;
   *   border: solid 2px transparent;
   *   border-top-color: #000;
   *   border-left-color: #000;
   *   border-bottom-color: #efefef;
   *   border-right-color: #efefef;
   *   border-radius: 50%;
   *   -webkit-animation: loader 400ms linear infinite;
   *   animation: loader 400ms linear infinite;
   * }
   *
   * \@-webkit-keyframes loader {
   *   0% {
   *     -webkit-transform: translate(-50%, -50%) rotate(0deg);
   *   }
   *   100% {
   *     -webkit-transform: translate(-50%, -50%) rotate(360deg);
   *   }
   * }
   * \@keyframes loader {
   *   0% {
   *     transform: translate(-50%, -50%) rotate(0deg);
   *   }
   *   100% {
   *     transform: translate(-50%, -50%) rotate(360deg);
   *   }
   * }
   * </style>
   * ```
   * @type {string | boolean}
   */
  spaLoadingTemplate: {
    $resolve: async (val, get) => typeof val === "string" ? resolve(await get("srcDir"), val) : val ?? null
  },
  /**
   * An array of nuxt app plugins.
   *
   * Each plugin can be a string (which can be an absolute or relative path to a file).
   * If it ends with `.client` or `.server` then it will be automatically loaded only
   * in the appropriate context.
   *
   * It can also be an object with `src` and `mode` keys.
   * @note Plugins are also auto-registered from the `~/plugins` directory
   * and these plugins do not need to be listed in `nuxt.config` unless you
   * need to customize their order. All plugins are deduplicated by their src path.
   * @see https://nuxt.com/docs/guide/directory-structure/plugins
   * @example
   * ```js
   * plugins: [
   *   '~/plugins/foo.client.js', // only in client side
   *   '~/plugins/bar.server.js', // only in server side
   *   '~/plugins/baz.js', // both client & server
   *   { src: '~/plugins/both-sides.js' },
   *   { src: '~/plugins/client-only.js', mode: 'client' }, // only on client side
   *   { src: '~/plugins/server-only.js', mode: 'server' } // only on server side
   * ]
   * ```
   * @type {(typeof import('../src/types/nuxt').NuxtPlugin | string)[]}
   */
  plugins: [],
  /**
   * You can define the CSS files/modules/libraries you want to set globally
   * (included in every page).
   *
   * Nuxt will automatically guess the file type by its extension and use the
   * appropriate pre-processor. You will still need to install the required
   * loader if you need to use them.
   * @example
   * ```js
   * css: [
   *   // Load a Node.js module directly (here it's a Sass file).
   *   'bulma',
   *   // CSS file in the project
   *   '@/assets/css/main.css',
   *   // SCSS file in the project
   *   '@/assets/css/main.scss'
   * ]
   * ```
   * @type {string[]}
   */
  css: {
    $resolve: (val) => (val ?? []).map((c) => c.src || c)
  }
});

const build = defineUntypedSchema({
  /**
   * The builder to use for bundling the Vue part of your application.
   * @type {'vite' | 'webpack' | { bundle: (nuxt: typeof import('../src/types/nuxt').Nuxt) => Promise<void> }}
   */
  builder: {
    $resolve: async (val, get) => {
      if (typeof val === "object") {
        return val;
      }
      const map = {
        vite: "@nuxt/vite-builder",
        webpack: "@nuxt/webpack-builder"
      };
      return map[val] || val || (await get("vite") === false ? map.webpack : map.vite);
    }
  },
  /**
   * Whether to generate sourcemaps.
   * @type {boolean | { server?: boolean | 'hidden', client?: boolean | 'hidden' }}
   */
  sourcemap: {
    $resolve: async (val, get) => {
      if (typeof val === "boolean") {
        return { server: val, client: val };
      }
      return defu(val, {
        server: true,
        client: await get("dev")
      });
    }
  },
  /**
   * Log level when building logs.
   *
   * Defaults to 'silent' when running in CI or when a TTY is not available.
   * This option is then used as 'silent' in Vite and 'none' in Webpack
   * @type {'silent' | 'info' | 'verbose'}
   */
  logLevel: {
    $resolve: (val) => {
      if (val && !["silent", "info", "verbose"].includes(val)) {
        consola.warn(`Invalid \`logLevel\` option: \`${val}\`. Must be one of: \`silent\`, \`info\`, \`verbose\`.`);
      }
      return val ?? (isTest ? "silent" : "info");
    }
  },
  /**
   * Shared build configuration.
   */
  build: {
    /**
     * If you want to transpile specific dependencies with Babel, you can add them here.
     * Each item in transpile can be a package name, a function, a string or regex object matching the
     * dependency's file name.
     *
     * You can also use a function to conditionally transpile. The function will receive an object ({ isDev, isServer, isClient, isModern, isLegacy }).
     * @example
     * ```js
     transpile: [({ isLegacy }) => isLegacy && 'ky']
     * ```
     * @type {Array<string | RegExp | ((ctx: { isClient?: boolean; isServer?: boolean; isDev: boolean }) => string | RegExp | false)>}
     */
    transpile: {
      $resolve: (val) => [].concat(val).filter(Boolean)
    },
    /**
     * You can provide your own templates which will be rendered based
     * on Nuxt configuration. This feature is specially useful for using with modules.
     *
     * Templates are rendered using [`lodash/template`](https://lodash.com/docs/4.17.15#template).
     * @example
     * ```js
     * templates: [
     *   {
     *     src: '~/modules/support/plugin.js', // `src` can be absolute or relative
     *     dst: 'support.js', // `dst` is relative to project `.nuxt` dir
     *     options: {
     *       // Options are provided to template as `options` key
     *       live_chat: false
     *     }
     *   }
     * ]
     * ```
     * @type {typeof import('../src/types/nuxt').NuxtTemplate<any>[]}
     */
    templates: [],
    /**
     * Nuxt uses `webpack-bundle-analyzer` to visualize your bundles and how to optimize them.
     *
     * Set to `true` to enable bundle analysis, or pass an object with options: [for webpack](https://github.com/webpack-contrib/webpack-bundle-analyzer#options-for-plugin) or [for vite](https://github.com/btd/rollup-plugin-visualizer#options).
     * @example
     * ```js
     * analyze: {
     *   analyzerMode: 'static'
     * }
     * ```
     * @type {boolean | typeof import('webpack-bundle-analyzer').BundleAnalyzerPlugin.Options | typeof import('rollup-plugin-visualizer').PluginVisualizerOptions}
     */
    analyze: {
      $resolve: async (val, get) => {
        if (val !== true) {
          return val ?? false;
        }
        const rootDir = await get("rootDir");
        const analyzeDir = await get("analyzeDir");
        return {
          template: "treemap",
          projectRoot: rootDir,
          filename: join(analyzeDir, "{name}.html")
        };
      }
    }
  },
  /**
   * Build time optimization configuration.
   */
  optimization: {
    /**
     * Functions to inject a key for.
     *
     * As long as the number of arguments passed to the function is less than `argumentLength`, an
     * additional magic string will be injected that can be used to deduplicate requests between server
     * and client. You will need to take steps to handle this additional key.
     *
     * The key will be unique based on the location of the function being invoked within the file.
     * @type {Array<{ name: string, source?: string | RegExp, argumentLength: number }>}
     */
    keyedComposables: {
      $resolve: (val) => [
        { name: "defineNuxtComponent", argumentLength: 2 },
        { name: "useState", argumentLength: 2 },
        { name: "useFetch", argumentLength: 3 },
        { name: "useAsyncData", argumentLength: 3 },
        { name: "useLazyAsyncData", argumentLength: 3 },
        { name: "useLazyFetch", argumentLength: 3 }
      ].concat(val).filter(Boolean)
    },
    /**
     * Tree shake code from specific builds.
     */
    treeShake: {
      /**
       * Tree shake composables from the server or client builds.
       * @example
       * ```js
       * treeShake: { client: { myPackage: ['useServerOnlyComposable'] } }
       * ```
       */
      composables: {
        server: {
          $resolve: async (val, get) => defu(
            val || {},
            await get("dev") ? {} : {
              vue: ["onBeforeMount", "onMounted", "onBeforeUpdate", "onRenderTracked", "onRenderTriggered", "onActivated", "onDeactivated", "onBeforeUnmount"],
              "#app": ["definePayloadReviver", "definePageMeta"]
            }
          )
        },
        client: {
          $resolve: async (val, get) => defu(
            val || {},
            await get("dev") ? {} : {
              vue: ["onServerPrefetch", "onRenderTracked", "onRenderTriggered"],
              "#app": ["definePayloadReducer", "definePageMeta"]
            }
          )
        }
      }
    },
    /**
     * Options passed directly to the transformer from `unctx` that preserves async context
     * after `await`.
     * @type {typeof import('unctx/transform').TransformerOptions}
     */
    asyncTransforms: {
      asyncFunctions: ["defineNuxtPlugin", "defineNuxtRouteMiddleware"],
      objectDefinitions: {
        defineNuxtComponent: ["asyncData", "setup"],
        defineNuxtPlugin: ["setup"],
        definePageMeta: ["middleware", "validate"]
      }
    }
  }
});

const common = defineUntypedSchema({
  /**
   * Extend project from multiple local or remote sources.
   *
   * Value should be either a string or array of strings pointing to source directories or config path relative to current config.
   *
   * You can use `github:`, `gitlab:`, `bitbucket:` or `https://` to extend from a remote git repository.
   * @type {string|string[]}
   */
  extends: null,
  /**
   * Extend project from a local or remote source.
   *
   * Value should be a string pointing to source directory or config path relative to current config.
   *
   * You can use `github:`, `gitlab:`, `bitbucket:` or `https://` to extend from a remote git repository.
   * @type {string}
   */
  theme: null,
  /**
   * Define the root directory of your application.
   *
   * This property can be overwritten (for example, running `nuxt ./my-app/`
   * will set the `rootDir` to the absolute path of `./my-app/` from the
   * current/working directory.
   *
   * It is normally not needed to configure this option.
   */
  rootDir: {
    $resolve: (val) => typeof val === "string" ? resolve(val) : process.cwd()
  },
  /**
   * Define the workspace directory of your application.
   *
   * Often this is used when in a monorepo setup. Nuxt will attempt to detect
   * your workspace directory automatically, but you can override it here.
   *
   * It is normally not needed to configure this option.
   */
  workspaceDir: {
    $resolve: async (val, get) => val ? resolve(await get("rootDir"), val) : await findWorkspaceDir(await get("rootDir")).catch(() => get("rootDir"))
  },
  /**
   * Define the source directory of your Nuxt application.
   *
   * If a relative path is specified, it will be relative to the `rootDir`.
   * @example
   * ```js
   * export default {
   *   srcDir: 'src/'
   * }
   * ```
   * This would work with the following folder structure:
   * ```bash
   * -| app/
   * ---| node_modules/
   * ---| nuxt.config.js
   * ---| package.json
   * ---| src/
   * ------| assets/
   * ------| components/
   * ------| layouts/
   * ------| middleware/
   * ------| pages/
   * ------| plugins/
   * ------| static/
   * ------| store/
   * ------| server/
   * ------| app.config.ts
   * ------| app.vue
   * ------| error.vue
   * ```
   */
  srcDir: {
    $resolve: async (val, get) => resolve(await get("rootDir"), val || ".")
  },
  /**
   * Define the server directory of your Nuxt application, where Nitro
   * routes, middleware and plugins are kept.
   *
   * If a relative path is specified, it will be relative to your `rootDir`.
   *
   */
  serverDir: {
    $resolve: async (val, get) => resolve(await get("rootDir"), val || resolve(await get("srcDir"), "server"))
  },
  /**
   * Define the directory where your built Nuxt files will be placed.
   *
   * Many tools assume that `.nuxt` is a hidden directory (because it starts
   * with a `.`). If that is a problem, you can use this option to prevent that.
   * @example
   * ```js
   * export default {
   *   buildDir: 'nuxt-build'
   * }
   * ```
   */
  buildDir: {
    $resolve: async (val, get) => resolve(await get("rootDir"), val || ".nuxt")
  },
  /**
   * Used to set the modules directories for path resolving (for example, webpack's
   * `resolveLoading`, `nodeExternals` and `postcss`).
   *
   * The configuration path is relative to `options.rootDir` (default is current working directory).
   *
   * Setting this field may be necessary if your project is organized as a yarn workspace-styled mono-repository.
   * @example
   * ```js
   * export default {
   *   modulesDir: ['../../node_modules']
   * }
   * ```
   */
  modulesDir: {
    $default: ["node_modules"],
    $resolve: async (val, get) => [
      ...await Promise.all(val.map(async (dir) => resolve(await get("rootDir"), dir))),
      resolve(process.cwd(), "node_modules")
    ]
  },
  /**
   * The directory where Nuxt will store the generated files when running `nuxt analyze`.
   *
   * If a relative path is specified, it will be relative to your `rootDir`.
   */
  analyzeDir: {
    $resolve: async (val, get) => val ? resolve(await get("rootDir"), val) : resolve(await get("buildDir"), "analyze")
  },
  /**
   * Whether Nuxt is running in development mode.
   *
   * Normally, you should not need to set this.
   */
  dev: Boolean(isDevelopment),
  /**
   * Whether your app is being unit tested.
   */
  test: Boolean(isDevelopment),
  /**
   * Set to `true` to enable debug mode.
   *
   * At the moment, it prints out hook names and timings on the server, and
   * logs hook arguments as well in the browser.
   *
   */
  debug: {
    $resolve: (val) => val ?? isDebug
  },
  /**
   * Whether to enable rendering of HTML - either dynamically (in server mode) or at generate time.
   * If set to `false` generated pages will have no content.
   */
  ssr: {
    $resolve: (val) => val ?? true
  },
  /**
   * Modules are Nuxt extensions which can extend its core functionality and add endless integrations.
   *
   * Each module is either a string (which can refer to a package, or be a path to a file), a
   * tuple with the module as first string and the options as a second object, or an inline module function.
   *
   * Nuxt tries to resolve each item in the modules array using node require path
   * (in `node_modules`) and then will be resolved from project `srcDir` if `~` alias is used.
   * @note Modules are executed sequentially so the order is important.
   * @example
   * ```js
   * modules: [
   *   // Using package name
   *   '@nuxtjs/axios',
   *   // Relative to your project srcDir
   *   '~/modules/awesome.js',
   *   // Providing options
   *   ['@nuxtjs/google-analytics', { ua: 'X1234567' }],
   *   // Inline definition
   *   function () {}
   * ]
   * ```
   * @type {(typeof import('../src/types/module').NuxtModule | string | [typeof import('../src/types/module').NuxtModule | string, Record<string, any>] | undefined | null | false)[]}
   */
  modules: {
    $resolve: (val) => [].concat(val).filter(Boolean)
  },
  /**
   * Customize default directory structure used by Nuxt.
   *
   * It is better to stick with defaults unless needed.
   */
  dir: {
    /**
     * The assets directory (aliased as `~assets` in your build).
     */
    assets: "assets",
    /**
     * The layouts directory, each file of which will be auto-registered as a Nuxt layout.
     */
    layouts: "layouts",
    /**
     * The middleware directory, each file of which will be auto-registered as a Nuxt middleware.
     */
    middleware: "middleware",
    /**
     * The modules directory, each file in which will be auto-registered as a Nuxt module.
     */
    modules: "modules",
    /**
     * The directory which will be processed to auto-generate your application page routes.
     */
    pages: "pages",
    /**
     * The plugins directory, each file of which will be auto-registered as a Nuxt plugin.
     */
    plugins: "plugins",
    /**
     * The directory containing your static files, which will be directly accessible via the Nuxt server
     * and copied across into your `dist` folder when your app is generated.
     */
    public: {
      $resolve: async (val, get) => val || await get("dir.static") || "public"
    },
    static: {
      $schema: { deprecated: "use `dir.public` option instead" },
      $resolve: async (val, get) => val || await get("dir.public") || "public"
    }
  },
  /**
   * The extensions that should be resolved by the Nuxt resolver.
   */
  extensions: {
    $resolve: (val) => [".js", ".jsx", ".mjs", ".ts", ".tsx", ".vue"].concat(val).filter(Boolean)
  },
  /**
   * You can improve your DX by defining additional aliases to access custom directories
   * within your JavaScript and CSS.
   * @note Within a webpack context (image sources, CSS - but not JavaScript) you _must_ access
   * your alias by prefixing it with `~`.
   * @note These aliases will be automatically added to the generated `.nuxt/tsconfig.json` so you can get full
   * type support and path auto-complete. In case you need to extend options provided by `./.nuxt/tsconfig.json`
   * further, make sure to add them here or within the `typescript.tsConfig` property in `nuxt.config`.
   * @example
   * ```js
   * export default {
   *   alias: {
   *     'images': fileURLToPath(new URL('./assets/images', import.meta.url)),
   *     'style': fileURLToPath(new URL('./assets/style', import.meta.url)),
   *     'data': fileURLToPath(new URL('./assets/other/data', import.meta.url))
   *   }
   * }
   * ```
   *
   * ```html
   * <template>
   *   <img src="~images/main-bg.jpg">
   * </template>
   *
   * <script>
   * import data from 'data/test.json'
   * <\/script>
   *
   * <style>
   * // Uncomment the below
   * //@import '~style/variables.scss';
   * //@import '~style/utils.scss';
   * //@import '~style/base.scss';
   * body {
   *   background-image: url('~images/main-bg.jpg');
   * }
   * </style>
   * ```
   * @type {Record<string, string>}
   */
  alias: {
    $resolve: async (val, get) => ({
      "~": await get("srcDir"),
      "@": await get("srcDir"),
      "~~": await get("rootDir"),
      "@@": await get("rootDir"),
      [await get("dir.assets")]: join(await get("srcDir"), await get("dir.assets")),
      [await get("dir.public")]: join(await get("srcDir"), await get("dir.public")),
      ...val
    })
  },
  /**
   * Pass options directly to `node-ignore` (which is used by Nuxt to ignore files).
   * @see [node-ignore](https://github.com/kaelzhang/node-ignore)
   * @example
   * ```js
   * ignoreOptions: {
   *   ignorecase: false
   * }
   * ```
   */
  ignoreOptions: void 0,
  /**
   * Any file in `pages/`, `layouts/`, `middleware/` or `store/` will be ignored during
   * building if its filename starts with the prefix specified by `ignorePrefix`.
   */
  ignorePrefix: {
    $resolve: (val) => val ?? "-"
  },
  /**
   * More customizable than `ignorePrefix`: all files matching glob patterns specified
   * inside the `ignore` array will be ignored in building.
   */
  ignore: {
    $resolve: async (val, get) => [
      "**/*.stories.{js,cts,mts,ts,jsx,tsx}",
      // ignore storybook files
      "**/*.{spec,test}.{js,cts,mts,ts,jsx,tsx}",
      // ignore tests
      "**/*.d.{cts,mts,ts}",
      // ignore type declarations
      "**/.{pnpm-store,vercel,netlify,output,git,cache,data}",
      relative(await get("rootDir"), await get("analyzeDir")),
      relative(await get("rootDir"), await get("buildDir")),
      await get("ignorePrefix") && `**/${await get("ignorePrefix")}*.*`
    ].concat(val).filter(Boolean)
  },
  /**
   * The watch property lets you define patterns that will restart the Nuxt dev server when changed.
   *
   * It is an array of strings or regular expressions. Strings should be either absolute paths or
   * relative to the `srcDir` (and the `srcDir` of any layers). Regular expressions will be matched
   * against the path relative to the project `srcDir` (and the `srcDir` of any layers).
   * @type {Array<string | RegExp>}
   */
  watch: {
    $resolve: (val) => [].concat(val).filter((b) => typeof b === "string" || b instanceof RegExp)
  },
  /**
   * The watchers property lets you overwrite watchers configuration in your `nuxt.config`.
   */
  watchers: {
    /** An array of event types, which, when received, will cause the watcher to restart. */
    rewatchOnRawEvents: void 0,
    /**
     * `watchOptions` to pass directly to webpack.
     * @see [webpack@4 watch options](https://v4.webpack.js.org/configuration/watch/#watchoptions).
     */
    webpack: {
      aggregateTimeout: 1e3
    },
    /**
     * Options to pass directly to `chokidar`.
     * @see [chokidar](https://github.com/paulmillr/chokidar#api)
     */
    chokidar: {
      ignoreInitial: true
    }
  },
  /**
   * Hooks are listeners to Nuxt events that are typically used in modules,
   * but are also available in `nuxt.config`.
   *
   * Internally, hooks follow a naming pattern using colons (e.g., build:done).
   *
   * For ease of configuration, you can also structure them as an hierarchical
   * object in `nuxt.config` (as below).
   * @example
   * ```js'node:fs'
   * import fs from 'node:fs'
   * import path from 'node:path'
   * export default {
   *   hooks: {
   *     build: {
   *       done(builder) {
   *         const extraFilePath = path.join(
   *           builder.nuxt.options.buildDir,
   *           'extra-file'
   *         )
   *         fs.writeFileSync(extraFilePath, 'Something extra')
   *       }
   *     }
   *   }
   * }
   * ```
   * @type {typeof import('../src/types/hooks').NuxtHooks}
   */
  hooks: null,
  /**
   * Runtime config allows passing dynamic config and environment variables to the Nuxt app context.
   *
   * The value of this object is accessible from server only using `useRuntimeConfig`.
   *
   * It mainly should hold _private_ configuration which is not exposed on the frontend.
   * This could include a reference to your API secret tokens.
   *
   * Anything under `public` and `app` will be exposed to the frontend as well.
   *
   * Values are automatically replaced by matching env variables at runtime, e.g. setting an environment
   * variable `NUXT_API_KEY=my-api-key NUXT_PUBLIC_BASE_URL=/foo/` would overwrite the two values in the example below.
   * @example
   * ```js
   * export default {
   *  runtimeConfig: {
   *     apiKey: '' // Default to an empty string, automatically set at runtime using process.env.NUXT_API_KEY
   *     public: {
   *        baseURL: '' // Exposed to the frontend as well.
   *     }
   *   }
   * }
   * ```
   * @type {typeof import('../src/types/config').RuntimeConfig}
   */
  runtimeConfig: {
    $resolve: async (val, get) => {
      provideFallbackValues(val);
      return defu(val, {
        public: {},
        app: {
          baseURL: (await get("app")).baseURL,
          buildAssetsDir: (await get("app")).buildAssetsDir,
          cdnURL: (await get("app")).cdnURL
        }
      });
    }
  },
  /**
   * Additional app configuration
   *
   * For programmatic usage and type support, you can directly provide app config with this option.
   * It will be merged with `app.config` file as default value.
   * @type {typeof import('../src/types/config').AppConfig}
   */
  appConfig: {
    nuxt: {}
  },
  $schema: {}
});
function provideFallbackValues(obj) {
  for (const key in obj) {
    if (typeof obj[key] === "undefined" || obj[key] === null) {
      obj[key] = "";
    } else if (typeof obj[key] === "object") {
      provideFallbackValues(obj[key]);
    }
  }
}

const dev = defineUntypedSchema({
  devServer: {
    /**
     * Whether to enable HTTPS.
     * @example
     * ```
     * export default defineNuxtConfig({
     *   devServer: {
     *     https: {
     *       key: './server.key',
     *       cert: './server.crt'
     *     }
     *   }
     * })
     * ```
     * @type {boolean | { key: string; cert: string }}
     */
    https: false,
    /** Dev server listening port */
    port: process.env.NUXT_PORT || process.env.NITRO_PORT || process.env.PORT || 3e3,
    /** Dev server listening host */
    host: process.env.NUXT_HOST || process.env.NITRO_HOST || process.env.HOST || void 0,
    /** Dev server listening socket */
    socket: process.env.NUXT_SOCKET || process.env.NITRO_SOCKET || process.env.SOCKET || void 0,
    /**
     * Listening dev server URL.
     *
     * This should not be set directly as it will always be overridden by the
     * dev server with the full URL (for module and internal use).
     */
    url: "http://localhost:3000",
    /**
     * Template to show a loading screen
     * @type {(data: { loading?: string }) => string}
     */
    loadingTemplate: loading
  }
});

const experimental = defineUntypedSchema({
  experimental: {
    /**
     * Set to true to generate an async entry point for the Vue bundle (for module federation support).
     */
    asyncEntry: {
      $resolve: (val) => val ?? false
    },
    /**
     * Enable Vue's reactivity transform
     * @see https://vuejs.org/guide/extras/reactivity-transform.html
     *
     * Warning: Reactivity transform feature has been marked as deprecated in Vue 3.3 and is planned to be
     * removed from core in Vue 3.4.
     * @see https://github.com/vuejs/rfcs/discussions/369#discussioncomment-5059028
     */
    reactivityTransform: false,
    // TODO: Remove when nitro has support for mocking traced dependencies
    // https://github.com/unjs/nitro/issues/1118
    /**
     * Externalize `vue`, `@vue/*` and `vue-router` when building.
     * @see https://github.com/nuxt/nuxt/issues/13632
     */
    externalVue: true,
    /**
     * Tree shakes contents of client-only components from server bundle.
     * @see https://github.com/nuxt/framework/pull/5750
     */
    treeshakeClientOnly: true,
    /**
     * Emit `app:chunkError` hook when there is an error loading vite/webpack
     * chunks.
     *
     * By default, Nuxt will also perform a hard reload of the new route
     * when a chunk fails to load when navigating to a new route.
     *
     * You can disable automatic handling by setting this to `false`, or handle
     * chunk errors manually by setting it to `manual`.
     * @see https://github.com/nuxt/nuxt/pull/19038
     * @type {false | 'manual' | 'automatic'}
     */
    emitRouteChunkError: {
      $resolve: (val) => {
        if (val === true) {
          return "manual";
        }
        if (val === "reload") {
          return "automatic";
        }
        return val ?? "automatic";
      }
    },
    /**
     * By default the route object returned by the auto-imported `useRoute()` composable
     * is kept in sync with the current page in view in `<NuxtPage>`. This is not true for
     * `vue-router`'s exported `useRoute` or for the default `$route` object available in your
     * Vue templates.
     *
     * By enabling this option a mixin will be injected to keep the `$route` template object
     * in sync with Nuxt's managed `useRoute()`.
     */
    templateRouteInjection: true,
    /**
     * Whether to restore Nuxt app state from `sessionStorage` when reloading the page
     * after a chunk error or manual `reloadNuxtApp()` call.
     *
     * To avoid hydration errors, it will be applied only after the Vue app has been mounted,
     * meaning there may be a flicker on initial load.
     *
     * Consider carefully before enabling this as it can cause unexpected behavior, and
     * consider providing explicit keys to `useState` as auto-generated keys may not match
     * across builds.
     * @type {boolean}
     */
    restoreState: false,
    /**
     * Inline styles when rendering HTML (currently vite only).
     *
     * You can also pass a function that receives the path of a Vue component
     * and returns a boolean indicating whether to inline the styles for that component.
     * @type {boolean | ((id?: string) => boolean)}
     */
    inlineSSRStyles: {
      async $resolve(val, get) {
        if (val === false || await get("dev") || await get("ssr") === false || await get("builder") === "@nuxt/webpack-builder") {
          return false;
        }
        return val ?? true;
      }
    },
    /**
     * Turn off rendering of Nuxt scripts and JS resource hints.
     * You can also disable scripts more granularly within `routeRules`.
     */
    noScripts: false,
    /** Render JSON payloads with support for revivifying complex types. */
    renderJsonPayloads: true,
    /**
     * Disable vue server renderer endpoint within nitro.
     */
    noVueServer: false,
    /**
     * When this option is enabled (by default) payload of pages that are prerendered are extracted
     * @type {boolean | undefined}
     */
    payloadExtraction: true,
    /**
     * Whether to enable the experimental `<NuxtClientFallback>` component for rendering content on the client
     * if there's an error in SSR.
     */
    clientFallback: false,
    /** Enable cross-origin prefetch using the Speculation Rules API. */
    crossOriginPrefetch: false,
    /**
     * Enable View Transition API integration with client-side router.
     * @see https://developer.chrome.com/docs/web-platform/view-transitions
     */
    viewTransition: false,
    /**
     * Write early hints when using node server.
     * @note nginx does not support 103 Early hints in the current version.
     */
    writeEarlyHints: false,
    /**
     * Experimental component islands support with <NuxtIsland> and .island.vue files.
     * @type {true | 'local' | 'local+remote' | false}
     */
    componentIslands: {
      $resolve: (val) => {
        if (typeof val === "string") {
          return val;
        }
        if (val === true) {
          return "local";
        }
        return false;
      }
    },
    /**
     * Config schema support
     * @see https://github.com/nuxt/nuxt/issues/15592
     */
    configSchema: true,
    /**
     * This enables 'Bundler' module resolution mode for TypeScript, which is the recommended setting
     * for frameworks like Nuxt and Vite.
     *
     * It improves type support when using modern libraries with `exports`.
     *
     * This is only not enabled by default because it could be a breaking change for some projects.
     *
     * See https://github.com/microsoft/TypeScript/pull/51669
     */
    typescriptBundlerResolution: {
      async $resolve(val, get) {
        if (typeof val === "boolean") {
          return val;
        }
        const setting = await get("typescript.tsConfig.compilerOptions.moduleResolution");
        if (setting) {
          return setting.toLowerCase() === "bundler";
        }
        return false;
      }
    },
    /**
     * Whether or not to add a compatibility layer for modules, plugins or user code relying on the old
     * `@vueuse/head` API.
     *
     * This can be disabled for most Nuxt sites to reduce the client-side bundle by ~0.5kb.
     */
    polyfillVueUseHead: false,
    /** Allow disabling Nuxt SSR responses by setting the `x-nuxt-no-ssr` header. */
    respectNoSSRHeader: false,
    /** Resolve `~`, `~~`, `@` and `@@` aliases located within layers with respect to their layer source and root directories. */
    localLayerAliases: true,
    /** Enable the new experimental typed router using [unplugin-vue-router](https://github.com/posva/unplugin-vue-router). */
    typedPages: false,
    /**
     * Use app manifests to respect route rules on client-side.
     */
    appManifest: true,
    // This is enabled when `experimental.payloadExtraction` is set to `true`.
    // appManifest: {
    //   $resolve: (val, get) => val ?? get('experimental.payloadExtraction')
    // },
    /**
     * Set an alternative watcher that will be used as the watching service for Nuxt.
     *
     * Nuxt uses 'chokidar-granular' by default, which will ignore top-level directories
     * (like `node_modules` and `.git`) that are excluded from watching.
     *
     * You can set this instead to `parcel` to use `@parcel/watcher`, which may improve
     * performance in large projects or on Windows platforms.
     *
     * You can also set this to `chokidar` to watch all files in your source directory.
     * @see https://github.com/paulmillr/chokidar
     * @see https://github.com/parcel-bundler/watcher
     * @type {'chokidar' | 'parcel' | 'chokidar-granular'}
     */
    watcher: "chokidar-granular",
    /**
     * Enable native async context to be accessible for nested composables
     * @see https://github.com/nuxt/nuxt/pull/20918
     */
    asyncContext: false,
    /**
     * Use new experimental head optimisations:
     * - Add the capo.js head plugin in order to render tags in of the head in a more performant way.
     * - Uses the hash hydration plugin to reduce initial hydration
     * @see https://github.com/nuxt/nuxt/discussions/22632
     */
    headNext: false,
    /**
     * Allow defining `routeRules` directly within your `~/pages` directory using `defineRouteRules`.
     *
     * Rules are converted (based on the path) and applied for server requests. For example, a rule
     * defined in `~/pages/foo/bar.vue` will be applied to `/foo/bar` requests. A rule in `~/pages/foo/[id].vue`
     * will be applied to `/foo/**` requests.
     *
     * For more control, such as if you are using a custom `path` or `alias` set in the page's `definePageMeta`, you
     * should set `routeRules` directly within your `nuxt.config`.
     */
    inlineRouteRules: false
  }
});

const generate = defineUntypedSchema({
  generate: {
    /**
     * The routes to generate.
     *
     * If you are using the crawler, this will be only the starting point for route generation.
     * This is often necessary when using dynamic routes.
     *
     * It is preferred to use `nitro.prerender.routes`.
     * @example
     * ```js
     * routes: ['/users/1', '/users/2', '/users/3']
     * ```
     * @type {string | string[]}
     */
    routes: [],
    /**
     * This option is no longer used. Instead, use `nitro.prerender.ignore`.
     * @deprecated
     */
    exclude: []
  }
});

const internal = defineUntypedSchema({
  /** @private */
  _majorVersion: 3,
  /** @private */
  _legacyGenerate: false,
  /** @private */
  _start: false,
  /** @private */
  _build: false,
  /** @private */
  _generate: false,
  /** @private */
  _prepare: false,
  /** @private */
  _cli: false,
  /** @private */
  _requiredModules: {},
  /** @private */
  _nuxtConfigFile: void 0,
  /** @private */
  _nuxtConfigFiles: [],
  /** @private */
  appDir: "",
  /** @private */
  _installedModules: [],
  /** @private */
  _modules: []
});

const nitro = defineUntypedSchema({
  /**
   * Configuration for Nitro.
   * @see https://nitro.unjs.io/config/
   * @type {typeof import('nitropack')['NitroConfig']}
   */
  nitro: {
    routeRules: {
      $resolve: async (val, get) => ({
        ...await get("routeRules") || {},
        ...val || {}
      })
    }
  },
  /**
   * Global route options applied to matching server routes.
   * @experimental This is an experimental feature and API may change in the future.
   * @see https://nitro.unjs.io/config/#routerules
   * @type {typeof import('nitropack')['NitroConfig']['routeRules']}
   */
  routeRules: {},
  /**
   * Nitro server handlers.
   *
   * Each handler accepts the following options:
   * - handler: The path to the file defining the handler.
   * - route: The route under which the handler is available. This follows the conventions of https://github.com/unjs/radix3.
   * - method: The HTTP method of requests that should be handled.
   * - middleware: Specifies whether it is a middleware handler.
   * - lazy: Specifies whether to use lazy loading to import the handler.
   * @see https://nuxt.com/docs/guide/directory-structure/server
   * @note Files from `server/api`, `server/middleware` and `server/routes` will be automatically registered by Nuxt.
   * @example
   * ```js
   * serverHandlers: [
   *   { route: '/path/foo/**:name', handler: '~/server/foohandler.ts' }
   * ]
   * ```
   * @type {typeof import('nitropack')['NitroEventHandler'][]}
   */
  serverHandlers: [],
  /**
   * Nitro development-only server handlers.
   * @see https://nitro.unjs.io/guide/routing
   * @type {typeof import('nitropack')['NitroDevEventHandler'][]}
   */
  devServerHandlers: []
});

const postcss = defineUntypedSchema({
  postcss: {
    /**
     * Options for configuring PostCSS plugins.
     *
     * https://postcss.org/
     * @type {Record<string, any>}
     */
    plugins: {
      /**
       * https://github.com/postcss/postcss-import
       */
      "postcss-import": {
        $resolve: async (val, get) => val !== false ? defu(val || {}, {
          resolve: createResolver({
            alias: { ...await get("alias") },
            modules: [
              await get("srcDir"),
              await get("rootDir"),
              ...await get("modulesDir")
            ]
          })
        }) : val
      },
      /**
       * https://github.com/postcss/postcss-url
       */
      "postcss-url": {},
      /**
       * https://github.com/postcss/autoprefixer
       */
      autoprefixer: {},
      cssnano: {
        $resolve: async (val, get) => val ?? !(await get("dev") && {
          preset: ["default", {
            // Keep quotes in font values to prevent from HEX conversion
            // https://github.com/nuxt/nuxt/issues/6306
            minifyFontValues: { removeQuotes: false }
          }]
        })
      }
    }
  }
});

const router = defineUntypedSchema({
  router: {
    /**
     * Additional options passed to `vue-router`.
     *
     * Note: Only JSON serializable options should be passed by nuxt config.
     *
     * For more control, you can use `app/router.options.ts` file.
     * @see [documentation](https://router.vuejs.org/api/interfaces/routeroptions.html).
     * @type {typeof import('../src/types/router').RouterConfigSerializable}
     */
    options: {}
  }
});

const typescript = defineUntypedSchema({
  /**
   * Configuration for Nuxt's TypeScript integration.
   *
   */
  typescript: {
    /**
     * TypeScript comes with certain checks to give you more safety and analysis of your program.
     * Once you’ve converted your codebase to TypeScript, you can start enabling these checks for greater safety.
     * [Read More](https://www.typescriptlang.org/docs/handbook/migrating-from-javascript.html#getting-stricter-checks)
     */
    strict: true,
    /**
     * Which builder types to include for your project.
     *
     * By default Nuxt infers this based on your `builder` option (defaulting to 'vite') but you can either turn off
     * builder environment types (with `false`) to handle this fully yourself, or opt for a 'shared' option.
     *
     * The 'shared' option is advised for module authors, who will want to support multiple possible builders.
     * @type {'vite' | 'webpack' | 'shared' | false | undefined}
     */
    builder: {
      $resolve: (val) => val ?? null
    },
    /**
     * Include parent workspace in the Nuxt project. Mostly useful for themes and module authors.
     */
    includeWorkspace: false,
    /**
     * Enable build-time type checking.
     *
     * If set to true, this will type check in development. You can restrict this to build-time type checking by setting it to `build`.
     * Requires to install `typescript` and `vue-tsc` as dev dependencies.
     * @see https://nuxt.com/docs/guide/concepts/typescript
     * @type {boolean | 'build'}
     */
    typeCheck: false,
    /**
     * You can extend generated `.nuxt/tsconfig.json` using this option.
     * @type {typeof import('pkg-types')['TSConfig']}
     */
    tsConfig: {},
    /**
     * Generate a `*.vue` shim.
     *
     * We recommend instead either enabling [**Take Over Mode**](https://vuejs.org/guide/typescript/overview.html#volar-takeover-mode) or adding
     * TypeScript Vue Plugin (Volar)** 👉 [[Download](https://marketplace.visualstudio.com/items?itemName=Vue.vscode-typescript-vue-plugin)].
     */
    shim: true
  }
});

const vite = defineUntypedSchema({
  /**
   * Configuration that will be passed directly to Vite.
   *
   * See https://vitejs.dev/config for more information.
   * Please note that not all vite options are supported in Nuxt.
   * @type {typeof import('../src/types/config').ViteConfig & { $client?: typeof import('../src/types/config').ViteConfig, $server?: typeof import('../src/types/config').ViteConfig }}
   */
  vite: {
    root: {
      $resolve: async (val, get) => val ?? await get("srcDir")
    },
    mode: {
      $resolve: async (val, get) => val ?? (await get("dev") ? "development" : "production")
    },
    define: {
      $resolve: async (val, get) => ({
        "process.dev": await get("dev"),
        "import.meta.dev": await get("dev"),
        "process.test": isTest,
        "import.meta.test": isTest,
        ...val || {}
      })
    },
    resolve: {
      extensions: [".mjs", ".js", ".ts", ".jsx", ".tsx", ".json", ".vue"]
    },
    publicDir: {
      $resolve: async (val, get) => {
        if (val) {
          consola.warn("Directly configuring the `vite.publicDir` option is not supported. Instead, set `dir.public`. You can read more in `https://nuxt.com/docs/api/configuration/nuxt-config#public`.");
        }
        return val ?? resolve(await get("srcDir"), (await get("dir")).public);
      }
    },
    vue: {
      isProduction: {
        $resolve: async (val, get) => val ?? !await get("dev")
      },
      template: {
        compilerOptions: {
          $resolve: async (val, get) => val ?? (await get("vue")).compilerOptions
        }
      },
      script: {
        propsDestructure: {
          $resolve: async (val, get) => val ?? Boolean((await get("vue")).propsDestructure)
        },
        defineModel: {
          $resolve: async (val, get) => val ?? Boolean((await get("vue")).defineModel)
        }
      }
    },
    vueJsx: {
      $resolve: async (val, get) => {
        return {
          isCustomElement: (await get("vue")).compilerOptions?.isCustomElement,
          ...val || {}
        };
      }
    },
    optimizeDeps: {
      exclude: {
        $resolve: async (val, get) => [
          ...val || [],
          ...(await get("build.transpile")).filter((i) => typeof i === "string"),
          "vue-demi"
        ]
      }
    },
    esbuild: {
      jsxFactory: "h",
      jsxFragment: "Fragment",
      tsconfigRaw: "{}"
    },
    clearScreen: true,
    build: {
      assetsDir: {
        $resolve: async (val, get) => val ?? withoutLeadingSlash((await get("app")).buildAssetsDir)
      },
      emptyOutDir: false
    },
    server: {
      fs: {
        allow: {
          $resolve: async (val, get) => [
            await get("buildDir"),
            await get("srcDir"),
            await get("rootDir"),
            await get("workspaceDir"),
            ...await get("modulesDir"),
            ...val ?? []
          ]
        }
      }
    }
  }
});

const webpack = defineUntypedSchema({
  webpack: {
    /**
     * Nuxt uses `webpack-bundle-analyzer` to visualize your bundles and how to optimize them.
     *
     * Set to `true` to enable bundle analysis, or pass an object with options: [for webpack](https://github.com/webpack-contrib/webpack-bundle-analyzer#options-for-plugin) or [for vite](https://github.com/btd/rollup-plugin-visualizer#options).
     * @example
     * ```js
     * analyze: {
     *   analyzerMode: 'static'
     * }
     * ```
     * @type {boolean | typeof import('webpack-bundle-analyzer').BundleAnalyzerPlugin.Options}
     */
    analyze: {
      $resolve: async (val, get) => {
        if (val !== true) {
          return val ?? false;
        }
        const rootDir = await get("rootDir");
        const analyzeDir = await get("analyzeDir");
        return {
          template: "treemap",
          projectRoot: rootDir,
          filename: join(analyzeDir, "{name}.html")
        };
      }
    },
    /**
     * Enable the profiler in webpackbar.
     *
     * It is normally enabled by CLI argument `--profile`.
     * @see [webpackbar](https://github.com/unjs/webpackbar#profile).
     */
    profile: process.argv.includes("--profile"),
    /**
     * Enables Common CSS Extraction.
     *
     * Using [mini-css-extract-plugin](https://github.com/webpack-contrib/mini-css-extract-plugin) under the hood, your CSS will be extracted
     * into separate files, usually one per component. This allows caching your CSS and
     * JavaScript separately.
     * @example
     * ```js
     * export default {
     *   webpack: {
     *     extractCSS: true,
     *     // or
     *     extractCSS: {
     *       ignoreOrder: true
     *     }
     *   }
     * }
     * ```
     *
     * If you want to extract all your CSS to a single file, there is a workaround for this.
     * However, note that it is not recommended to extract everything into a single file.
     * Extracting into multiple CSS files is better for caching and preload isolation. It
     * can also improve page performance by downloading and resolving only those resources
     * that are needed.
     * @example
     * ```js
     * export default {
     *   webpack: {
     *     extractCSS: true,
     *     optimization: {
     *       splitChunks: {
     *         cacheGroups: {
     *           styles: {
     *             name: 'styles',
     *             test: /\.(css|vue)$/,
     *             chunks: 'all',
     *             enforce: true
     *           }
     *         }
     *       }
     *     }
     *   }
     * }
     * ```
     * @type {boolean | typeof import('mini-css-extract-plugin').PluginOptions}
     */
    extractCSS: true,
    /**
     * Enables CSS source map support (defaults to `true` in development).
     */
    cssSourceMap: {
      $resolve: async (val, get) => val ?? await get("dev")
    },
    /**
     * The polyfill library to load to provide URL and URLSearchParams.
     *
     * Defaults to `'url'` ([see package](https://www.npmjs.com/package/url)).
     */
    serverURLPolyfill: "url",
    /**
     * Customize bundle filenames.
     *
     * To understand a bit more about the use of manifests, take a look at [this webpack documentation](https://webpack.js.org/guides/code-splitting/).
     * @note Be careful when using non-hashed based filenames in production
     * as most browsers will cache the asset and not detect the changes on first load.
     *
     * This example changes fancy chunk names to numerical ids:
     * @example
     * ```js
     * filenames: {
     *   chunk: ({ isDev }) => (isDev ? '[name].js' : '[id].[contenthash].js')
     * }
     * ```
     * @type {
     *  Record<
     *    string,
     *    string |
     *    ((
     *      ctx: {
     *        nuxt: import('../src/types/nuxt').Nuxt,
     *        options: import('../src/types/nuxt').Nuxt['options'],
     *        name: string,
     *        isDev: boolean,
     *        isServer: boolean,
     *        isClient: boolean,
     *        alias: { [index: string]: string | false | string[] },
     *        transpile: RegExp[]
     *      }) => string)
     *  >
     * }
     */
    filenames: {
      app: ({ isDev }) => isDev ? "[name].js" : "[contenthash:7].js",
      chunk: ({ isDev }) => isDev ? "[name].js" : "[contenthash:7].js",
      css: ({ isDev }) => isDev ? "[name].css" : "css/[contenthash:7].css",
      img: ({ isDev }) => isDev ? "[path][name].[ext]" : "img/[name].[contenthash:7].[ext]",
      font: ({ isDev }) => isDev ? "[path][name].[ext]" : "fonts/[name].[contenthash:7].[ext]",
      video: ({ isDev }) => isDev ? "[path][name].[ext]" : "videos/[name].[contenthash:7].[ext]"
    },
    /**
     * Customize the options of Nuxt's integrated webpack loaders.
     */
    loaders: {
      $resolve: async (val, get) => {
        const styleLoaders = [
          "css",
          "cssModules",
          "less",
          "sass",
          "scss",
          "stylus",
          "vueStyle"
        ];
        for (const name of styleLoaders) {
          const loader = val[name];
          if (loader && loader.sourceMap === void 0) {
            loader.sourceMap = Boolean(await get("build.cssSourceMap"));
          }
        }
        return val;
      },
      /**
       * See https://github.com/esbuild-kit/esbuild-loader
       * @type {Omit<typeof import('esbuild-loader')['LoaderOptions'], 'loader'>}
       */
      esbuild: {},
      /**
       * See: https://github.com/webpack-contrib/file-loader#options
       * @type {Omit<typeof import('file-loader')['Options'], 'name'>}
       * @default
       * ```ts
       * { esModule: false }
       * ```
       */
      file: { esModule: false },
      /**
       * See: https://github.com/webpack-contrib/file-loader#options
       * @type {Omit<typeof import('file-loader')['Options'], 'name'>}
       * @default
       * ```ts
       * { esModule: false, limit: 1000  }
       * ```
       */
      fontUrl: { esModule: false, limit: 1e3 },
      /**
       * See: https://github.com/webpack-contrib/file-loader#options
       * @type {Omit<typeof import('file-loader')['Options'], 'name'>}
       * @default
       * ```ts
       * { esModule: false, limit: 1000  }
       * ```
       */
      imgUrl: { esModule: false, limit: 1e3 },
      /**
       * See: https://pugjs.org/api/reference.html#options
       * @type {typeof import('pug')['Options']}
       */
      pugPlain: {},
      /**
       * See [vue-loader](https://github.com/vuejs/vue-loader) for available options.
       * @type {Partial<typeof import('vue-loader')['VueLoaderOptions']>}
       */
      vue: {
        transformAssetUrls: {
          video: "src",
          source: "src",
          object: "src",
          embed: "src"
        },
        compilerOptions: { $resolve: async (val, get) => val ?? await get("vue.compilerOptions") },
        propsDestructure: { $resolve: async (val, get) => val ?? Boolean(await get("vue.propsDestructure")) },
        defineModel: { $resolve: async (val, get) => val ?? Boolean(await get("vue.defineModel")) }
      },
      css: {
        importLoaders: 0,
        url: {
          filter: (url, _resourcePath) => !url.startsWith("/")
        },
        esModule: false
      },
      cssModules: {
        importLoaders: 0,
        url: {
          filter: (url, _resourcePath) => !url.startsWith("/")
        },
        esModule: false,
        modules: {
          localIdentName: "[local]_[hash:base64:5]"
        }
      },
      /**
       * See: https://github.com/webpack-contrib/less-loader#options
       */
      less: {},
      /**
       * See: https://github.com/webpack-contrib/sass-loader#options
       * @type {typeof import('sass-loader')['Options']}
       * @default
       * ```ts
       * {
       *   sassOptions: {
       *     indentedSyntax: true
       *   }
       * }
       * ```
       */
      sass: {
        sassOptions: {
          indentedSyntax: true
        }
      },
      /**
       * See: https://github.com/webpack-contrib/sass-loader#options
       * @type {typeof import('sass-loader')['Options']}
       */
      scss: {},
      /**
       * See: https://github.com/webpack-contrib/stylus-loader#options
       */
      stylus: {},
      vueStyle: {}
    },
    /**
     * Add webpack plugins.
     * @example
     * ```js
     * import webpack from 'webpack'
     * import { version } from './package.json'
     * // ...
     * plugins: [
     *   new webpack.DefinePlugin({
     *     'process.VERSION': version
     *   })
     * ]
     * ```
     */
    plugins: [],
    /**
     * Hard-replaces `typeof process`, `typeof window` and `typeof document` to tree-shake bundle.
     */
    aggressiveCodeRemoval: false,
    /**
     * OptimizeCSSAssets plugin options.
     *
     * Defaults to true when `extractCSS` is enabled.
     * @see [css-minimizer-webpack-plugin documentation](https://github.com/webpack-contrib/css-minimizer-webpack-plugin).
     * @type {false | typeof import('css-minimizer-webpack-plugin').BasePluginOptions & typeof import('css-minimizer-webpack-plugin').DefinedDefaultMinimizerAndOptions<any>}
     */
    optimizeCSS: {
      $resolve: async (val, get) => val ?? (await get("build.extractCSS") ? {} : false)
    },
    /**
     * Configure [webpack optimization](https://webpack.js.org/configuration/optimization/).
     * @type {false | typeof import('webpack').Configuration['optimization']}
     */
    optimization: {
      runtimeChunk: "single",
      /** Set minimize to `false` to disable all minimizers. (It is disabled in development by default). */
      minimize: { $resolve: async (val, get) => val ?? !await get("dev") },
      /** You can set minimizer to a customized array of plugins. */
      minimizer: void 0,
      splitChunks: {
        chunks: "all",
        automaticNameDelimiter: "/",
        cacheGroups: {}
      }
    },
    /**
     * Customize PostCSS Loader.
     * Same options as https://github.com/webpack-contrib/postcss-loader#options
     * @type {{ execute?: boolean, postcssOptions: typeof import('postcss').ProcessOptions, sourceMap?: boolean, implementation?: any }}
     */
    postcss: {
      postcssOptions: {
        config: {
          $resolve: async (val, get) => val ?? await get("postcss.config")
        },
        plugins: {
          $resolve: async (val, get) => val ?? await get("postcss.plugins")
        }
      }
    },
    /**
     * See [webpack-dev-middleware](https://github.com/webpack/webpack-dev-middleware) for available options.
     * @type {typeof import('webpack-dev-middleware').Options<typeof import('http').IncomingMessage, typeof import('http').ServerResponse>}
     */
    devMiddleware: {
      stats: "none"
    },
    /**
     * See [webpack-hot-middleware](https://github.com/webpack-contrib/webpack-hot-middleware) for available options.
     * @type {typeof import('webpack-hot-middleware').MiddlewareOptions & { client?: typeof import('webpack-hot-middleware').ClientOptions }}
     */
    hotMiddleware: {},
    /**
     * Set to `false` to disable the overlay provided by [FriendlyErrorsWebpackPlugin](https://github.com/nuxt/friendly-errors-webpack-plugin).
     */
    friendlyErrors: true,
    /**
     * Filters to hide build warnings.
     * @type {Array<(warn: typeof import('webpack').WebpackError) => boolean>}
     */
    warningIgnoreFilters: [],
    /**
     * Configure [webpack experiments](https://webpack.js.org/configuration/experiments/)
     * @type {false | typeof import('webpack').Configuration['experiments']}
     */
    experiments: {}
  }
});

const index = {
  ...adhoc,
  ...app,
  ...build,
  ...common,
  ...dev,
  ...experimental,
  ...generate,
  ...internal,
  ...nitro,
  ...postcss,
  ...router,
  ...typescript,
  ...vite,
  ...webpack
};

export { index as NuxtConfigSchema };
