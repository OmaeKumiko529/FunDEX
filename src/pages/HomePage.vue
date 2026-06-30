<script lang="ts" setup>
import { useRouter } from 'vue-router'
import { ref, watch } from 'vue'
import NavBar from '../components/NavBar.vue'

const router = useRouter()
const transitionName = ref('slide-right')

watch(
  () => router.currentRoute.value,
  (to, from) => {
    if (!from) return
    const toDepth = to.path.split('/').length
    const fromDepth = from.path.split('/').length
    transitionName.value = toDepth >= fromDepth ? 'slide-left' : 'slide-right'
  },
)
</script>

<template>
  <div class="app-container">
    <main class="content-area">
      <Transition :name="transitionName" mode="out-in">
        <router-view />
      </Transition>
    </main>
    <NavBar />
  </div>
</template>

<style scoped>
.app-container {
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
  min-height: 100vh;
  min-height: calc(var(--vh, 1vh) * 100);
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
}

.content-area {
  flex: 1;
  padding-top: var(--safe-area-top, 0px);
  padding-bottom: calc(max(var(--nav-height, 10vh), var(--nav-min-height, 56px)) + var(--safe-area-bottom, 0px));
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

/* ── 路由过渡动画 ── */
.slide-left-enter-active,
.slide-left-leave-active,
.slide-right-enter-active,
.slide-right-leave-active {
  transition: all var(--duration-slow, 0.3s) var(--ease-out, cubic-bezier(0.25, 0.46, 0.45, 0.94));
}

/* 前进：新页面从右滑入，旧页面向左滑出 */
.slide-left-enter-from {
  opacity: 0;
  transform: translateX(30px);
}
.slide-left-leave-to {
  opacity: 0;
  transform: translateX(-30px);
}

/* 后退：新页面从左滑入，旧页面向右滑出 */
.slide-right-enter-from {
  opacity: 0;
  transform: translateX(-30px);
}
.slide-right-leave-to {
  opacity: 0;
  transform: translateX(30px);
}
</style>
