import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import GameView from '../views/GameView.vue'
import ProfileView from '../views/ProfileView.vue'
import LoginView from '../views/LoginView.vue'
import SocialView from '../views/social/SocialView.vue'
import UserProfile from '../views/UserProfile.vue'

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
    path: '/profile',
    name: 'profile',
    component: ProfileView,
    meta: { requiresAuth: true }, // Protégé aussi
  },
  {
    path: '/about',
    name: 'about',
    component: LoginView,
    meta: { guestOnly: true }, // Accessible uniquement si NON connecté
  },
  {
	  path: '/social',
	  name: 'social',
	  component: SocialView,
	  meta: {requiresAuth: true},
  },
  {
    path: '/profile',
    name: 'profile',
    component: UserProfile,
    meta: { requiresAuth: true } // Optionnel : protection de route
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/LoginView.vue'),
  },
  //{
  //  path: '/register', 
  //  name: 'register',
  //  component: () => import('../views/RegisterView.vue'),
  //},
  // Route pour gérer les 404
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    redirect: '/'
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

// ✅ Guard global
router.beforeEach((to, from, next) => {
  const isLoggedIn = !!localStorage.getItem('username')

  if (to.meta.requiresAuth && !isLoggedIn) {
    // Non connecté → redirigé vers page de login
    next({ name: 'about' })
  } else if (to.meta.guestOnly && isLoggedIn) {
    // Déjà connecté → interdit d’aller sur login/register
    next({ name: 'profile' })
  } else {
    next()
  }
})

export default router
