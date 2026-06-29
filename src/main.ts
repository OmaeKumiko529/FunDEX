import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'

// 全局样式
import './styles/variables.css'
import './styles/base.css'
import './styles/animations.css'

// 全局字体
import './assests/fonts.css'

// ── 动态 viewport 高度（解决 iOS Safari 100vh 问题） ──
function setVH() {
  const vh = window.innerHeight * 0.01
  document.documentElement.style.setProperty('--vh', `${vh}px`)
}
setVH()
window.addEventListener('resize', setVH)
window.addEventListener('orientationchange', () => setTimeout(setVH, 150))

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
