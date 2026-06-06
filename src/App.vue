<script setup>
/**
 * App.vue - Root component with navigation bar
 * Uses Vue Router for page transitions between Cleaner, Config and About
 * Supports dark/light theme toggle with CSS variables
 */
import { useRouter } from 'vue-router'
import { ref, onMounted } from 'vue'

const router = useRouter()
const isDarkTheme = ref(true)

onMounted(() => {
  const saved = localStorage.getItem('theme')
  if (saved === 'light') {
    isDarkTheme.value = false
    document.documentElement.classList.remove('dark')
    document.documentElement.classList.add('light')
  } else {
    document.documentElement.classList.add('dark')
  }
})

function toggleTheme() {
  isDarkTheme.value = !isDarkTheme.value
  if (isDarkTheme.value) {
    document.documentElement.classList.remove('light')
    document.documentElement.classList.add('dark')
    localStorage.setItem('theme', 'dark')
  } else {
    document.documentElement.classList.remove('dark')
    document.documentElement.classList.add('light')
    localStorage.setItem('theme', 'light')
  }
}

function navigateTo(routeName) {
  router.push({ name: routeName })
}
</script>

<template>
  <div class="app">
    <!-- Navigation bar -->
    <nav class="nav-bar">
      <div class="nav-brand">
        <span class="nav-icon">📂</span>
        <span class="nav-title">Folder Cleaner</span>
      </div>
      <div class="nav-links">
        <button
          class="nav-link"
          :class="{ active: $route.name === 'cleaner' }"
          @click="navigateTo('cleaner')"
        >
          🧹 Cleaner
        </button>
        <button
          class="nav-link"
          :class="{ active: $route.name === 'config' }"
          @click="navigateTo('config')"
        >
          ⚙️ Dossiers
        </button>
        <button
          class="nav-link"
          :class="{ active: $route.name === 'about' }"
          @click="navigateTo('about')"
        >
          ℹ️ About
        </button>
        <button
          class="theme-toggle"
          @click="toggleTheme"
          :title="isDarkTheme ? 'Passer en mode clair' : 'Passer en mode sombre'"
        >
          {{ isDarkTheme ? '☀️' : '🌙' }}
        </button>
      </div>
    </nav>

    <!-- Page content rendered by Vue Router -->
    <main class="app-main">
      <router-view v-slot="{ Component }">
        <keep-alive>
          <component :is="Component" />
        </keep-alive>
      </router-view>
    </main>
  </div>
</template>

<style>
/* ===== CSS VARIABLES FOR THEMING ===== */
:root, .dark {
  --bg-primary: #0f0f1a;
  --bg-secondary: #1a1a2e;
  --bg-tertiary: #151528;
  --bg-hover: #252540;
  --border-color: #2a2a3e;
  --border-focus: #6c63ff;
  --text-primary: #ffffff;
  --text-secondary: #e0e0e0;
  --text-muted: #888;
  --text-dim: #666;
  --accent: #6c63ff;
  --accent-light: #b8b4ff;
  --success: #6fcf97;
  --success-bg: rgba(39, 174, 96, 0.08);
  --danger: #ff6b6b;
  --danger-bg: rgba(255, 107, 107, 0.08);
  --warning: #ffb86b;
}

.light {
  --bg-primary: #f5f5f8;
  --bg-secondary: #ffffff;
  --bg-tertiary: #eaeaef;
  --bg-hover: #e0e0e8;
  --border-color: #d0d0d8;
  --border-focus: #5a52e0;
  --text-primary: #1a1a2e;
  --text-secondary: #333;
  --text-muted: #666;
  --text-dim: #999;
  --accent: #5a52e0;
  --accent-light: #7a72ff;
  --success: #27ae60;
  --success-bg: rgba(39, 174, 96, 0.08);
  --danger: #e74c3c;
  --danger-bg: rgba(231, 76, 60, 0.08);
  --warning: #e67e22;
}

/* Global reset and base styles */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen,
    Ubuntu, Cantarell, 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
  background: var(--bg-primary);
  color: var(--text-secondary);
  min-height: 100vh;
  transition: background 0.3s, color 0.3s;
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
  border-bottom: 1px solid var(--border-color);
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
  color: var(--text-primary);
}

.nav-links {
  display: flex;
  gap: 8px;
  align-items: center;
}

.nav-link {
  padding: 8px 16px;
  background: transparent;
  color: var(--text-muted);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
}

.nav-link:hover {
  background: var(--bg-secondary);
  color: var(--text-secondary);
}

.nav-link.active {
  background: var(--bg-secondary);
  border-color: var(--accent);
  color: var(--accent);
}

.theme-toggle {
  padding: 8px 10px;
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
  line-height: 1;
}

.theme-toggle:hover {
  background: var(--bg-secondary);
  border-color: var(--accent);
}

.app-main {
  flex: 1;
}
</style>