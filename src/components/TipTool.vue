<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  visible: boolean
  fundCode: string
  fundName: string
  isPinned: boolean
  /** 触摸触发坐标 (clientX, clientY) */
  position: { x: number; y: number }
}>()

const emit = defineEmits<{
  close: []
  remove: [fundCode: string]
  togglePin: [fundCode: string]
}>()

// 计算菜单位置：优先在手指上方弹出，空间不够则在下方
const menuStyle = computed(() => {
  const gap = 12
  const menuWidth = 180
  const menuItemHeight = 48
  const estimatedMenuHeight = 3 * menuItemHeight + 16 // 3 items + padding
  const winH = window.innerHeight
  const winW = window.innerWidth

  let top: number
  if (props.position.y - estimatedMenuHeight - gap > 0) {
    // 上方有足够空间
    top = props.position.y - estimatedMenuHeight - gap
  } else {
    // 否则在上方
    top = props.position.y + gap
  }

  let left = props.position.x - menuWidth / 2
  if (left < 16) left = 16
  if (left + menuWidth > winW - 16) left = winW - menuWidth - 16

  return {
    top: `${Math.round(top)}px`,
    left: `${Math.round(left)}px`,
  }
})

function onRemove() {
  emit('remove', props.fundCode)
  emit('close')
}

function onTogglePin() {
  emit('togglePin', props.fundCode)
  emit('close')
}

function onOverlayClick() {
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="visible" class="tip-overlay" @click="onOverlayClick" @touchmove.prevent>
        <Transition name="scale-in" appear>
          <div v-if="visible" class="tip-menu" :style="menuStyle" @click.stop>
            <div class="menu-header">
              <span class="menu-fund-name">{{ fundName }}</span>
              <span class="menu-fund-code">{{ fundCode }}</span>
            </div>
            <div class="menu-divider"></div>
            <button class="menu-item" @click="onTogglePin">
              <span class="menu-icon">{{ isPinned ? '📌' : '📌' }}</span>
              <span>{{ isPinned ? '取消置顶' : '置顶' }}</span>
            </button>
            <button class="menu-item menu-item-danger" @click="onRemove">
              <span class="menu-icon">🗑️</span>
              <span>从自选列表中移除</span>
            </button>
            <!-- <div class="menu-divider"></div>
            <button class="menu-item" disabled>
              <span class="menu-icon">📤</span>
              <span class="disabled-text">分享（即将上线）</span>
            </button> -->
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.tip-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.3);
  -webkit-tap-highlight-color: transparent;
}

.tip-menu {
  position: fixed;
  z-index: 1001;
  width: 180px;
  background: var(--color-white, #ffffff);
  border-radius: var(--radius-lg, 12px);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  transform-origin: center top;
}

.menu-header {
  padding: var(--spacing-md, 12px) var(--spacing-lg, 16px);
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.menu-fund-name {
  font-size: var(--font-sm, 12px);
  font-weight: 600;
  color: var(--color-text-primary, #1a1a1a);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.menu-fund-code {
  font-size: var(--font-xs, 11px);
  color: var(--color-text-tertiary, #999);
}

.menu-divider {
  height: 1px;
  background: var(--color-border-light, #f0f0f0);
  margin: 0 var(--spacing-sm, 8px);
}

.menu-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm, 8px);
  width: 100%;
  padding: var(--spacing-md, 12px) var(--spacing-lg, 16px);
  border: none;
  background: transparent;
  font-size: var(--font-base, 14px);
  color: var(--color-text-primary, #1a1a1a);
  cursor: pointer;
  transition: background var(--duration-fast, 0.15s);
  -webkit-tap-highlight-color: transparent;
}

.menu-item:active {
  background: var(--color-border-light, #f0f0f0);
}

.menu-item-danger {
  color: var(--color-danger, #ff4d4f);
}

.menu-icon {
  font-size: 16px;
  line-height: 1;
  width: 20px;
  text-align: center;
}

.disabled-text {
  color: var(--color-text-muted, #bbb);
}

/* ── 过渡动画 ── */
.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--duration-normal, 0.2s) var(--ease-out, ease);
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.scale-in-enter-active {
  transition: all var(--duration-normal, 0.2s) var(--ease-out, ease);
}
.scale-in-leave-active {
  transition: all var(--duration-fast, 0.15s) var(--ease-in-out, ease);
}
.scale-in-enter-from {
  opacity: 0;
  transform: scale(0.85);
}
.scale-in-leave-to {
  opacity: 0;
  transform: scale(0.85);
}
</style>