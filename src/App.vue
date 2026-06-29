<script setup lang="ts">
import { useRouter } from 'vue-router'
import { ref, watch } from 'vue'
import Homepage from './pages/HomePage.vue'

const router = useRouter()
const transitionName = ref('slide-right')

// 根据路由深度决定过渡方向
watch(
  () => router.currentRoute.value,
  (to, from) => {
    if (!from) return
    const toDepth = to.path.split('/').length
    const fromDepth = from.path.split('/').length
    transitionName.value = toDepth > fromDepth ? 'slide-left' : 'slide-right'
  },
)
</script>

<template>
  <Homepage />
</template>

<style scoped>
</style>
