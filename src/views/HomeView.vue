<script setup>
/**
 * HomeView.vue - Main analysis page
 * Handles folder selection, analysis, filtering, and tree display
 * Supports async scanning with progress for large folders
 */
import { ref, computed, onUnmounted } from 'vue'
import FolderSelector from '../components/FolderSelector.vue'
import StatsSummary from '../components/StatsSummary.vue'
import FilterBar from '../components/FilterBar.vue'
import TreeView from '../components/TreeView.vue'

// Reactive state
const folderPath = ref('')
const treeData = ref(null)
const stats = ref({ totalFiles: 0, totalFolders: 0, totalSize: 0 })
const isLoading = ref(false)
const error = ref('')
const scanProgress = ref('')
const abortController = ref(null)

// Filter state
const searchQuery = ref('')
const extensionFilter = ref('')

// Cleanup on unmount
onUnmounted(() => {
  if (abortController.value) {
    abortController.value.abort()
  }
})

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
 * Loads and analyzes the selected folder with progress updates
 * Uses async scanning for large folders to keep UI responsive
 */
async function loadFolder(path) {
  // Cancel any previous scan
  if (abortController.value) {
    abortController.value.abort()
  }

  isLoading.value = true
  error.value = ''
  scanProgress.value = 'Starting analysis...'
  folderPath.value = path

  // Create abort controller for cancellation
  abortController.value = new AbortController()
  const signal = abortController.value.signal

  try {
    // Use the async analysis API with progress
    const result = await window.electronAPI.analyzeFolderAsync(path, (progress) => {
      if (signal.aborted) return
      scanProgress.value = progress
    })

    if (signal.aborted) return

    treeData.value = result.tree
    stats.value = result.stats
    scanProgress.value = ''
  } catch (err) {
    if (err.message === 'canceled') {
      scanProgress.value = 'Scan cancelled'
      return
    }
    error.value = `Failed to analyze folder: ${err.message}`
    console.error(err)
    treeData.value = null
  } finally {
    isLoading.value = false
    abortController.value = null
  }
}

/**
 * Cancel the current scan
 */
function cancelScan() {
  if (abortController.value) {
    abortController.value.abort()
    abortController.value = null
  }
  // Also tell main process to cancel
  window.electronAPI.cancelScan().catch(() => {})
  isLoading.value = false
  scanProgress.value = 'Scan cancelled'
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
      let matches = false
      if (query && node.name.toLowerCase().includes(queryLower)) {
        matches = true
      }
      if (extFilter && node.type === 'file') {
        const ext = node.name.includes('.')
          ? '.' + node.name.split('.').pop().toLowerCase()
          : ''
        if (ext === extLower) matches = true
      }

      let filteredChildren = []
      if (node.type === 'folder' && node.children) {
        filteredChildren = filterTree(node.children, query, extFilter)
      }

      if (matches || filteredChildren.length > 0) {
        return { ...node, children: filteredChildren }
      }
      return null
    })
    .filter(Boolean)
}

// Computed filtered tree
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
  <div class="home-view">
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

    <!-- Loading state with progress and cancel -->
    <div v-if="isLoading" class="loading-state">
      <div class="spinner"></div>
      <p class="loading-text">{{ scanProgress || 'Analyzing folder structure...' }}</p>
      <button class="cancel-btn" @click="cancelScan">Cancel</button>
    </div>

    <!-- Analysis results -->
    <template v-if="treeData && !isLoading">
      <StatsSummary
        :folderPath="folderPath"
        :stats="stats"
      />

      <FilterBar
        v-model:search="searchQuery"
        v-model:extension="extensionFilter"
      />

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

    <!-- Empty state -->
    <div v-if="!folderPath && !isLoading" class="empty-state">
      <div class="empty-icon">📁</div>
      <h2>Select a folder to get started</h2>
      <p>Click the button above to choose a folder and analyze its contents</p>
    </div>
  </div>
</template>

<style scoped>
.home-view {
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

.loading-text {
  font-size: 0.95rem;
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

.cancel-btn {
  padding: 8px 20px;
  background: #3d1a1a;
  color: #ff6b6b;
  border: 1px solid #e74c3c;
  border-radius: 6px;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
}

.cancel-btn:hover {
  background: #4d2222;
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