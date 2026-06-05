<script setup>
/**
 * App.vue - Main application component
 * Orchestrates folder selection, analysis, and display
 */
import { ref, computed } from 'vue'
import FolderSelector from './components/FolderSelector.vue'
import StatsSummary from './components/StatsSummary.vue'
import FilterBar from './components/FilterBar.vue'
import TreeView from './components/TreeView.vue'

// Reactive state
const folderPath = ref('')
const treeData = ref(null)
const stats = ref({ totalFiles: 0, totalFolders: 0, totalSize: 0 })
const isLoading = ref(false)
const error = ref('')

// Filter state
const searchQuery = ref('')
const extensionFilter = ref('')

/**
 * Handles folder selection - opens native dialog via IPC
 */
async function handleSelectFolder() {
  error.value = ''
  try {
    const selectedPath = await window.electronAPI.selectFolder()
    if (selectedPath) {
      await loadFolder(selectedPath)
    }
  } catch (err) {
    error.value = `Failed to select folder: ${err.message}`
    console.error(err)
  }
}

/**
 * Loads and analyzes the selected folder
 */
async function loadFolder(path) {
  isLoading.value = true
  error.value = ''
  try {
    folderPath.value = path
    const result = await window.electronAPI.analyzeFolder(path)
    treeData.value = result.tree
    stats.value = result.stats
  } catch (err) {
    error.value = `Failed to analyze folder: ${err.message}`
    console.error(err)
    treeData.value = null
  } finally {
    isLoading.value = false
  }
}

/**
 * Recursively filter tree nodes by search query
 */
function filterTree(nodes, query, extFilter) {
  if (!query && !extFilter) return nodes

  const queryLower = query.toLowerCase()
  const extLower = extFilter.toLowerCase()

  return nodes
    .map(node => {
      // Check if this node itself matches
      let matches = false
      if (query && node.name.toLowerCase().includes(queryLower)) {
        matches = true
      }
      if (extFilter && node.type === 'file') {
        const ext = node.name.includes('.') 
          ? node.name.split('.').pop().toLowerCase()
          : ''
        if (ext === extLower) matches = true
      }

      // For folders, check children recursively
      let filteredChildren = []
      if (node.type === 'folder' && node.children) {
        filteredChildren = filterTree(node.children, query, extFilter)
      }

      // Include if matches OR has matching children
      if (matches || filteredChildren.length > 0) {
        return {
          ...node,
          children: filteredChildren
        }
      }
      return null
    })
    .filter(Boolean)
}

// Computed filtered tree based on search/extension filter
const filteredTree = computed(() => {
  if (!treeData.value) return null
  return filterTree(
    [treeData.value],
    searchQuery.value,
    extensionFilter.value
  )[0] || null
})
</script>

<template>
  <div class="app">
    <!-- Header -->
    <header class="app-header">
      <h1 class="app-title">
        <span class="icon">📂</span> Folder Analyzer
      </h1>
      <p class="app-subtitle">Analyze your local folders in a structured tree view</p>
    </header>

    <!-- Main content -->
    <main class="app-main">
      <!-- Folder selection -->
      <FolderSelector
        :folderPath="folderPath"
        :isLoading="isLoading"
        @select-folder="handleSelectFolder"
      />

      <!-- Error display -->
      <div v-if="error" class="error-banner">
        <span class="error-icon">⚠️</span>
        <span>{{ error }}</span>
      </div>

      <!-- Loading state -->
      <div v-if="isLoading" class="loading-state">
        <div class="spinner"></div>
        <p>Analyzing folder structure...</p>
      </div>

      <!-- Analysis results -->
      <template v-if="treeData && !isLoading">
        <!-- Stats summary -->
        <StatsSummary
          :folderPath="folderPath"
          :stats="stats"
        />

        <!-- Filters -->
        <FilterBar
          v-model:search="searchQuery"
          v-model:extension="extensionFilter"
        />

        <!-- Tree view -->
        <div class="tree-container">
          <TreeView
            v-if="filteredTree"
            :node="filteredTree"
            :depth="0"
          />
          <div v-else-if="searchQuery || extensionFilter" class="no-results">
            <span class="no-results-icon">🔍</span>
            <p>No files match your filter criteria</p>
          </div>
        </div>
      </template>

      <!-- Empty state (no folder selected) -->
      <div v-if="!folderPath && !isLoading" class="empty-state">
        <div class="empty-icon">📁</div>
        <h2>Select a folder to get started</h2>
        <p>Click the button above to choose a folder and analyze its contents</p>
      </div>
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
}

.app {
  max-width: 1100px;
  margin: 0 auto;
  padding: 24px;
}

.app-header {
  text-align: center;
  padding: 32px 0 24px;
  border-bottom: 1px solid #2a2a3e;
  margin-bottom: 24px;
}

.app-title {
  font-size: 2rem;
  font-weight: 700;
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.app-title .icon {
  font-size: 2rem;
}

.app-subtitle {
  color: #888;
  margin-top: 8px;
  font-size: 0.95rem;
}

.app-main {
  min-height: 400px;
}

.error-banner {
  background: #3d1a1a;
  border: 1px solid #e74c3c;
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 10px;
  color: #ff6b6b;
  font-size: 0.9rem;
}

.error-icon {
  font-size: 1.2rem;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: #888;
  gap: 16px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #2a2a3e;
  border-top-color: #6c63ff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.tree-container {
  background: #1a1a2e;
  border-radius: 8px;
  padding: 16px;
  min-height: 100px;
  border: 1px solid #2a2a3e;
}

.no-results {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 20px;
  color: #888;
  gap: 8px;
}

.no-results-icon {
  font-size: 2rem;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  color: #666;
  text-align: center;
}

.empty-icon {
  font-size: 5rem;
  margin-bottom: 16px;
  opacity: 0.6;
}

.empty-state h2 {
  font-size: 1.4rem;
  color: #aaa;
  margin-bottom: 8px;
}

.empty-state p {
  font-size: 0.95rem;
  max-width: 400px;
}
</style>