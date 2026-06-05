<script setup>
/**
 * App.vue - Root component with navigation bar
 * Uses Vue Router for page transitions between Home and About
 */
import { useRouter } from 'vue-router'

const router = useRouter()

/**
 * Navigate to the given route
 */
function navigateTo(routeName) {
  router.push({ name: routeName })
}
</script>

<template>
  <div class="app">
    <!-- Navigation bar -->
    <nav class="nav-bar">
      <div class="nav-brand" @click="navigateTo('home')">
        <span class="nav-icon">📂</span>
        <span class="nav-title">Folder Analyzer</span>
      </div>
      <div class="nav-links">
        <button
          class="nav-link"
          :class="{ active: $route.name === 'home' }"
          @click="navigateTo('home')"
        >
          🏠 Home
        </button>
        <button
          class="nav-link"
          :class="{ active: $route.name === 'cleaner' }"
          @click="navigateTo('cleaner')"
        >
          🧹 Cleaner
        </button>
        <button
          class="nav-link"
          :class="{ active: $route.name === 'about' }"
          @click="navigateTo('about')"
        >
          ℹ️ About
        </button>
      </div>
    </nav>

    <!-- Page content rendered by Vue Router -->
    <main class="app-main">
      <router-view />
    </main>
  </div>
</template>

<style>
/* Global reset and base styles */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen,
    Ubuntu, Cantarell, 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
  background: #0f0f1a;
  color: #e0e0e0;
  min-height: 100vh;
}

#app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app {
  max-width: 1100px;
  margin: 0 auto;
  padding: 0 24px 24px;
  width: 100%;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.nav-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 0;
  border-bottom: 1px solid #2a2a3e;
  margin-bottom: 24px;
}

.nav-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  user-select: none;
}

.nav-icon {
  font-size: 1.5rem;
}

.nav-title {
  font-size: 1.2rem;
  font-weight: 700;
  color: #ffffff;
}

.nav-links {
  display: flex;
  gap: 8px;
}

.nav-link {
  padding: 8px 16px;
  background: transparent;
  color: #888;
  border: 1px solid #2a2a3e;
  border-radius: 6px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
}

.nav-link:hover {
  background: #1a1a2e;
  color: #ddd;
}

.nav-link.active {
  background: #1a1a2e;
  border-color: #6c63ff;
  color: #6c63ff;
}

.app-main {
  flex: 1;
}
</style>