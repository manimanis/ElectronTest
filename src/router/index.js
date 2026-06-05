/**
 * Vue Router configuration
 * Provides navigation between Home and About views
 */
import { createRouter, createMemoryHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import AboutView from '../views/AboutView.vue'
import CleanerView from '../views/CleanerView.vue'

const routes = [
  {
    path: '/',
    name: 'home',
    component: HomeView,
    meta: { title: 'Folder Analyzer - Analyze' }
  },
  {
    path: '/cleaner',
    name: 'cleaner',
    component: CleanerView,
    meta: { title: 'Folder Analyzer - Cleaner' }
  },
  {
    path: '/about',
    name: 'about',
    component: AboutView,
    meta: { title: 'Folder Analyzer - About' }
  }
]

const router = createRouter({
  history: createMemoryHistory(), // Memory history for Electron (no URL bar)
  routes
})

export default router