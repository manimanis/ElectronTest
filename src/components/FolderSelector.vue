<script setup>
/**
 * FolderSelector.vue
 * Displays a button to select a folder and shows the currently selected path
 */
defineProps({
  folderPath: { type: String, default: '' },
  isLoading: { type: Boolean, default: false }
})

const emit = defineEmits(['select-folder'])
</script>

<template>
  <div class="folder-selector">
    <button
      class="select-btn"
      :disabled="isLoading"
      @click="emit('select-folder')"
    >
      <span class="btn-icon">{{ isLoading ? '⏳' : '📁' }}</span>
      <span>{{ isLoading ? 'Analyzing...' : 'Select Folder' }}</span>
    </button>

    <div v-if="folderPath" class="selected-path">
      <span class="path-icon">📍</span>
      <span class="path-text" :title="folderPath">{{ folderPath }}</span>
    </div>
  </div>
</template>

<style scoped>
.folder-selector {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.select-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  background: linear-gradient(135deg, #6c63ff, #5a52d5);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 4px 15px rgba(108, 99, 255, 0.3);
}

.select-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(108, 99, 255, 0.4);
}

.select-btn:active:not(:disabled) {
  transform: translateY(0);
}

.select-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.btn-icon {
  font-size: 1.2rem;
}

.selected-path {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #1a1a2e;
  padding: 10px 16px;
  border-radius: 8px;
  border: 1px solid #2a2a3e;
  flex: 1;
  min-width: 200px;
}

.path-icon {
  font-size: 1.1rem;
}

.path-text {
  font-size: 0.85rem;
  color: #aaa;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: 'Consolas', 'Courier New', monospace;
}
</style>