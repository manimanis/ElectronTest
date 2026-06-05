<script setup>
/**
 * StatsSummary.vue
 * Displays summary statistics for the analyzed folder
 * Shows totals for files, folders, and overall size
 */
import { computed } from 'vue'

const props = defineProps({
  folderPath: { type: String, default: '' },
  stats: {
    type: Object,
    default: () => ({ totalFiles: 0, totalFolders: 0, totalSize: 0 })
  }
})

// Extract folder name from the full path
const folderName = computed(() => {
  const parts = props.folderPath.replace(/\\/g, '/').split('/')
  return parts[parts.length - 1] || props.folderPath
})

/**
 * Format bytes to a human-readable string
 */
function formatSize(bytes) {
  if (!bytes || bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + units[i]
}
</script>

<template>
  <div class="stats-summary">
    <div class="stat-card folder-name">
      <div class="stat-label">Folder</div>
      <div class="stat-value">{{ folderName }}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Files</div>
      <div class="stat-value files">{{ stats.totalFiles.toLocaleString() }}</div>
      <div class="stat-icon">📄</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Folders</div>
      <div class="stat-value folders">{{ stats.totalFolders.toLocaleString() }}</div>
      <div class="stat-icon">📁</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Total Size</div>
      <div class="stat-value size">{{ formatSize(stats.totalSize) }}</div>
      <div class="stat-icon">💾</div>
    </div>
  </div>
</template>

<style scoped>
.stats-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.stat-card {
  background: #1a1a2e;
  border: 1px solid #2a2a3e;
  border-radius: 8px;
  padding: 16px;
  position: relative;
  overflow: hidden;
}

.stat-card.folder-name {
  grid-column: 1 / -1;
}

.stat-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #666;
  margin-bottom: 4px;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: #ffffff;
}

.stat-value.files {
  color: #6c63ff;
}

.stat-value.folders {
  color: #f39c12;
}

.stat-value.size {
  color: #2ecc71;
}

.stat-icon {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 2rem;
  opacity: 0.15;
}

.folder-name .stat-value {
  font-size: 1rem;
  font-weight: 400;
  color: #aaa;
  font-family: 'Consolas', 'Courier New', monospace;
  word-break: break-all;
}
</style>