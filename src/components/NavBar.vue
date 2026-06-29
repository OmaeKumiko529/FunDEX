<script lang="ts" setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import type { Component } from 'vue'
import type { NavItem } from '@/types/nav'
import navData from '@/data/navData.json'

import IconMarket from '@/components/icons/IconMarket.vue'
import IconNews from '@/components/icons/IconNews.vue'
import IconProfile from '@/components/icons/IconProfile.vue'

const route = useRoute()

const iconMap: Record<string, Component> = {
  IconMarket,
  IconNews,
  IconProfile,
}

interface ProcessedNavItem extends NavItem {
  iconComponent: Component
}

const navItems = computed<ProcessedNavItem[]>(() => {
  return (navData as NavItem[]).map((item) => ({
    ...item,
    iconComponent: iconMap[item.icon] as Component,
  }))
})

const activeColor = '#1890ff'
const inactiveColor = '#999999'
</script>

<template>
  <nav class="NavBody safe-area-bottom">
    <router-link
      v-for="item in navItems"
      :key="item.id"
      :to="item.route"
      class="nav-item"
      :class="{ active: route.path === item.route }"
    >
      <component
        :is="item.iconComponent"
        :size="'28'"
        :color="route.path === item.route ? activeColor : inactiveColor"
      />
      <span
        class="nav-label"
        :class="{ active: route.path === item.route }"
      >
        {{ item.label }}
      </span>
    </router-link>
  </nav>
</template>

<style scoped>
.NavBody {
  position: fixed;
  bottom: 0;
  left: 0;
  width: 100%;
  max-width: 480px;
  right: 0;
  margin: 0 auto;
  height: var(--nav-height, 10vh);
  min-height: var(--nav-min-height, 56px);
  display: flex;
  justify-content: space-around;
  align-items: center;
  background: var(--color-white, #ffffff);
  border-top: 1px solid var(--color-border, #e8e8e8);
  border-radius: 5vh 5vh 0 0;
  box-shadow: var(--shadow-nav, 0 -2px 8px rgba(0, 0, 0, 0.06));
  z-index: 100;
  padding-bottom: var(--safe-area-bottom, 0px);
  transition: box-shadow var(--duration-normal, 0.2s) var(--ease-out, ease);
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  text-decoration: none;
  flex: 1;
  padding: 4px 0;
  -webkit-tap-highlight-color: transparent;
  position: relative;
  min-height: 44px;
}

.nav-item:active {
  opacity: 0.7;
  transition: opacity var(--duration-fast, 0.15s);
}

/* 底部活跃指示条 */
.nav-item::after {
  content: '';
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%) scaleX(0);
  width: 20px;
  height: 3px;
  background: var(--color-primary, #1890ff);
  border-radius: 0 0 2px 2px;
  transition: transform var(--duration-slow, 0.3s) var(--ease-out, cubic-bezier(0.25, 0.46, 0.45, 0.94));
}

.nav-item.active::after {
  transform: translateX(-50%) scaleX(1);
}

.nav-label {
  font-size: var(--font-xs, 12px);
  line-height: 1;
  transition: color var(--duration-normal, 0.2s) var(--ease-out, ease);
  color: var(--color-text-tertiary, #999);
}

.nav-label.active {
  color: var(--color-primary, #1890ff);
}
</style>
