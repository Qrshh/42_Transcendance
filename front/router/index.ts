import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import Game from '../views/GameView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/game',
      name: 'game',
      component: Game,
    },
    {
      path: '/about',
      name: 'about',
      component: () => import('../views/LoginView.vue'),

      //Ce fichier est la pour vous montrer qu'il existe
      //deux moyens d'implementer un componant
    },
  ],
})

export default router
