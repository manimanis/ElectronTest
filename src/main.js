/**
 * Vue application entry point
 * Sets up Vue with Router for multi-page navigation
 */
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

const app = createApp(App)
app.use(router)
app.mount('#app')