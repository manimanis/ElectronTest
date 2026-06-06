<script setup>
/**
 * TabBar.vue - Folder tabs navigation
 * Displays configured folders as tabs with selection counts
 */
defineProps({
  folders: { type: Array, required: true },
  activeTab: { type: Number, required: true },
  selectedItems: { type: Object, required: true },
  getTabSubtitle: { type: Function, default: () => '' },
  getSelectedItemsForFolder: { type: Function, default: () => [] }
})

const emit = defineEmits(['update:activeTab'])
</script>

<template>
  <div class="tabs-bar">
    <button
      v-for="(folder, index) in folders"
      :key="folder.path"
      class="tab-btn"
      :class="{ active: activeTab === index }"
      @click="emit('update:activeTab', index)"
    >
      <span class="tab-icon">📁</span>
      <span class="tab-label">{{ folder.name }}</span>
      <span v-if="getTabSubtitle(folder)" class="tab-subtitle" :title="folder.path">
        {{ getTabSubtitle(folder) }}
      </span>
      <span
        class="tab-count"
        :class="{ 'has-selection': getSelectedItemsForFolder(folder.path).length > 0 }"
      >
        <template v-if="getSelectedItemsForFolder(folder.path).length > 0">
          {{ getSelectedItemsForFolder(folder.path).length }}<span class="tab-count-sep">/</span>{{ folder.items.length }}
        </template>
        <template v-else>{{ folder.items.length }}</template>
      </span>
    </button>
  </div>
</template>

<style scoped>
.tabs-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 10px 12px 6px;
  background: var(--bg-tertiary, #151528);
  border: 1px solid var(--border-color, #2a2a3e);
  border-radius: 12px 12px 0 0;
  border-bottom: none;
}

.tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--text-dim, #666);
  font-size: 0.82rem;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  flex: 0 0 auto;
  line-height: 1.3;
}

.tab-btn:hover {
  background: rgba(108, 99, 255, 0.08);
  border-color: rgba(108, 99, 255, 0.15);
  color: #aaa;
}

.tab-btn.active {
  background: rgba(108, 99, 255, 0.15);
  border-color: rgba(108, 99, 255, 0.3);
  color: #fff;
}

.tab-icon {
  font-size: 0.95rem;
  opacity: 0.7;
  flex-shrink: 0;
}

.tab-btn.active .tab-icon {
  opacity: 1;
}

.tab-label {
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tab-subtitle {
  font-size: 0.65rem;
  font-weight: 400;
  color: #777;
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex-shrink: 1;
  min-width: 0;
}

.tab-btn.active .tab-subtitle {
  color: #9988dd;
}

.tab-count {
  font-size: 0.65rem;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-dim, #666);
  border-radius: 5px;
  padding: 1px 6px;
  min-width: 16px;
  text-align: center;
  line-height: 1.4;
  flex-shrink: 0;
}

.tab-btn.active .tab-count {
  background: rgba(108, 99, 255, 0.25);
  color: #b8b4ff;
}

.tab-count-sep {
  opacity: 0.4;
  margin: 0 2px;
  font-weight: 400;
}

.tab-count.has-selection {
  background: rgba(231, 76, 60, 0.25);
  color: #ff6b6b;
  animation: badge-pulse 1.5s ease-in-out infinite;
}

.tab-btn.active .tab-count.has-selection {
  background: rgba(39, 174, 96, 0.3);
  color: #8fefb7;
  animation: none;
}

@keyframes badge-pulse {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.15);
  }
}
</style>