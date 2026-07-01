import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/market'
    },
    {
      path: '/market',
      name: 'market',
      component: () => import('@/pages/MarketPage.vue')
    },
    {
      path: '/fund/:fundCode',
      name: 'fund-detail',
      component: () => import('@/pages/FundDetailPage.vue')
    },
    {
      path: '/news',
      name: 'news',
      component: () => import('@/pages/NewsPage.vue')
    },
    {
      path: '/profile',
      name: 'profile',
      component: () => import('@/pages/ProfilePage.vue')
    },
    {
      path: '/search',
      name: 'search',
      component: () => import('@/pages/SearchPage.vue')
    },
    {
      path: '/auth',
      name: 'auth',
      component: () => import('@/pages/AuthPage.vue')
    }
  ],
})

export default router
