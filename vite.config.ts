import { defineConfig, loadEnv, createLogger } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import { fileURLToPath } from 'url'
import viteCompression from 'vite-plugin-compression'
import Components from 'unplugin-vue-components/vite'
import AutoImport from 'unplugin-auto-import/vite'
import ElementPlus from 'unplugin-element-plus/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import tailwindcss from '@tailwindcss/vite'
import monacoEditorPluginModule from 'vite-plugin-monaco-editor'

const monacoEditorPlugin =
  typeof monacoEditorPluginModule === 'function'
    ? monacoEditorPluginModule
    : (monacoEditorPluginModule as { default: typeof monacoEditorPluginModule }).default
// import { visualizer } from 'rollup-plugin-visualizer'

export default ({ mode }: { mode: string }) => {
  const root = process.cwd()
  const env = loadEnv(mode, root)
  const {
    VITE_VERSION,
    VITE_PORT,
    VITE_BASE_URL,
    VITE_API_URL,
    VITE_API_PROXY_URL,
    VITE_PIXIU_PROXY_URL
  } = env

  console.log(`🚀 API_URL = ${VITE_API_URL}`)
  console.log(`🚀 VERSION = ${VITE_VERSION}`)

  const logger = createLogger()
  const loggerWarn = logger.warn
  logger.warn = (msg, options) => {
    if (msg.includes('new dependencies optimized') || msg.includes('optimized dependencies changed')) return
    loggerWarn(msg, options)
  }
  logger.info = (msg, options) => {
    if (msg.includes('new dependencies optimized') || msg.includes('optimized dependencies changed')) return
    createLogger().info(msg, options)
  }

  return defineConfig({
    define: {
      __APP_VERSION__: JSON.stringify(VITE_VERSION)
    },
    base: VITE_BASE_URL,
    customLogger: logger,
    server: {
      port: Number(VITE_PORT),
      proxy: {
        '/pixiu': {
          target: VITE_PIXIU_PROXY_URL || 'http://localhost:8091',
          changeOrigin: true,
          // WebSocket（节点 SSH、Pod 终端等）必须显式开启，否则握手停留在 Vite，Pixiu 后端收不到请求
          ws: true
        },
        '/api': {
          target: VITE_API_PROXY_URL,
          changeOrigin: true
        }
      },
      host: true
    },
    // 路径别名
    resolve: {
      // 避免 element-plus 嵌套 @vueuse 与根依赖双份，减少 Rollup PURE 注解告警
      dedupe: ['vue', '@vueuse/core', '@vueuse/shared'],
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        '@views': resolvePath('src/views'),
        '@imgs': resolvePath('src/assets/images'),
        '@icons': resolvePath('src/assets/icons'),
        '@utils': resolvePath('src/utils'),
        '@stores': resolvePath('src/store'),
        '@styles': resolvePath('src/assets/styles')
      }
    },
    build: {
      target: 'es2015',
      outDir: 'dist',
      chunkSizeWarningLimit: 2500,
      minify: 'terser',
      terserOptions: {
        compress: {
          // 保留 warn/error 便于线上排障；剥离调试类输出
          drop_debugger: true,
          pure_funcs: ['console.log', 'console.info', 'console.debug']
        }
      },
      dynamicImportVarsOptions: {
        warnOnError: true,
        exclude: [],
        include: ['src/views/**/*.vue']
      },
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return
            if (id.includes('monaco-editor')) return 'monaco-editor'
            if (id.includes('echarts')) return 'echarts'
            if (id.includes('@xterm')) return 'xterm'
            if (id.includes('element-plus') || id.includes('@element-plus')) return 'element-plus'
            if (id.includes('@vueuse')) return 'vueuse'
            if (
              id.includes('/vue/') ||
              id.includes('\\vue\\') ||
              id.includes('vue-router') ||
              id.includes('pinia') ||
              id.includes('vue-i18n') ||
              id.includes('@vue/')
            ) {
              return 'vue-vendor'
            }
            if (
              id.includes('axios') ||
              id.includes('dayjs') ||
              id.includes('nprogress') ||
              id.includes('js-yaml') ||
              id.includes('crypto-js') ||
              id.includes('lodash') ||
              id.includes('mitt') ||
              id.includes('ohash')
            ) {
              return 'utils'
            }
          }
        }
      }
    },
    plugins: [
      vue(),
      monacoEditorPlugin({
        languageWorkers: ['editorWorkerService']
      }),
      tailwindcss(),
      // 自动按需导入 API
      AutoImport({
        imports: ['vue', 'vue-router', 'pinia', '@vueuse/core'],
        dts: 'src/types/import/auto-imports.d.ts',
        resolvers: [ElementPlusResolver()],
        eslintrc: {
          enabled: true,
          filepath: './.auto-import.json',
          globalsPropValue: true
        }
      }),
      // 自动按需导入组件
      Components({
        dts: 'src/types/import/components.d.ts',
        resolvers: [ElementPlusResolver()]
      }),
      // 按需定制主题配置
      ElementPlus({
        useSource: true
      }),
      // 压缩
      viteCompression({
        verbose: false, // 是否在控制台输出压缩结果
        disable: false, // 是否禁用
        algorithm: 'gzip', // 压缩算法
        ext: '.gz', // 压缩后的文件名后缀
        threshold: 10240, // 只有大小大于该值的资源会被处理 10240B = 10KB
        deleteOriginFile: false // 压缩后是否删除原文件
      })
      // 打包分析
      // visualizer({
      //   open: true,
      //   gzipSize: true,
      //   brotliSize: true,
      //   filename: 'dist/stats.html' // 分析图生成的文件名及路径
      // }),
    ],
    // 依赖预构建：避免运行时重复请求与转换，提升首次加载速度
    optimizeDeps: {
      include: [
        'echarts/core',
        'echarts/charts',
        'echarts/components',
        'echarts/renderers',
        'xgplayer',
        'crypto-js',
        'file-saver',
        'vue-img-cutter',
        'element-plus/es',
        'element-plus/es/components/*/style/css',
        'element-plus/es/components/*/style/index'
      ]
    },
    css: {
      preprocessorOptions: {
        // sass variable and mixin
        scss: {
          additionalData: `
            @use "@styles/core/el-light.scss" as *; 
            @use "@styles/core/mixin.scss" as *;
          `
        }
      },
      postcss: {
        plugins: [
          {
            postcssPlugin: 'internal:charset-removal',
            AtRule: {
              charset: (atRule) => {
                if (atRule.name === 'charset') {
                  atRule.remove()
                }
              }
            }
          }
        ]
      }
    }
  })
}

function resolvePath(paths: string) {
  return path.resolve(__dirname, paths)
}
