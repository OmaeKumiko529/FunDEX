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
    host: true,           // 监听所有网络接口（0.0.0.0）
    port: 5173,           // 固定端口（与 Tauri 默认一致）
    strictPort: false,    // 如果端口被占用则尝试下一个，但最好保证空闲
    watch: {
      // 忽略Tauri的Rust编译输出目录
      ignored: [
        '**/src-tauri/target/**',
        '**/src-tauri/gen/**',   // 新增：忽略整个生成的 Android 目录
      ],
    },
    hmr: {
      host: '192.168.31.250', // 使用您的主机 IP
      clientPort: 5173,       // 确保客户端使用正确的端口
    },
  }
})
