import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: '0.0.0.0',        // 监听所有网络接口，手机/虚拟机/本机都可访问
    port: 5173,
    strictPort: false,
    watch: {
      ignored: [
        '**/src-tauri/target/**',
        '**/src-tauri/gen/**',
      ],
    },
    // proxy: 所有 /api 请求自动转发到后端（本机 Express :3000）
    // 前端用相对路径 fetch('/api/...')，由 Vite 代理到后端
    // 这样本机浏览器 / 手机ADB / 虚拟机 三种场景都不需要修改地址
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
    hmr: {
      host: '0.0.0.0',   // 任何来源的 HMR 连接都接受
    },
  },
})