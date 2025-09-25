import { createRouter, createWebHistory } from 'vue-router'

// ⚠️ Garde ces imports si tu préfères le non lazy-loading.
// Sinon, tu peux aussi tout lazy-loader (voir plus bas).
import HomeView from '../views/HomeView.vue'
import GameView from '../views/GameView.vue'
import ProfileView from '../views/ProfileView.vue'
import LoginView from '../views/LoginView.vue'
import SocialView from '../views/social/SocialView.vue'

const routes = [
  {
    path: '/',
    name: 'home',
    component: HomeView,
  },
  {
    path: '/game',
    name: 'game',
    component: GameView,
    meta: { requiresAuth: false },
  },
  {
    path: '/login',
    name: 'login',
    component: LoginView,
    meta: { guestOnly: true },
  },
  {
    path: '/social',
    name: 'social',
    component: SocialView,
    meta: { requiresAuth: true },
  },
  {
    // une seule route /profile, paramètre username optionnel
    path: '/profile/:username?',
    name: 'profile',
    component: ProfileView,
    meta: { requiresAuth: true },
  },
  // 404 -> home (ou une page dédiée si tu veux)
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    redirect: '/',
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

// Guard global propre
router.beforeEach((to, from, next) => {
  const isLoggedIn = !!localStorage.getItem('username')

  if (to.meta.requiresAuth && !isLoggedIn) {
    next({ name: 'login', query: { redirect: to.fullPath } })
    return
  }

  if (to.meta.guestOnly && isLoggedIn) {
    next({ name: 'profile' })
    return
  }

  next()
})

export default router
