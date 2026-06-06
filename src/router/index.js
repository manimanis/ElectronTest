/**
 * Vue Router configuration
 * Provides navigation between Home and About views
 */
import { createRouter, createMemoryHistory } from 'vue-router'
import CleanerView from '../views/CleanerView.vue'
import AboutView from '../views/AboutView.vue'

const routes = [
  {
    path: '/',
    name: 'cleaner',
    component: CleanerView,
    meta: { title: 'Folder Cleaner' }
  },
  {
    path: '/about',
    name: 'about',
    component: AboutView,
    meta: { title: 'Folder Cleaner - About' }
  }
]

const router = createRouter({
  history: createMemoryHistory(), // Memory history for Electron (no URL bar)
  routes
})

export default router
