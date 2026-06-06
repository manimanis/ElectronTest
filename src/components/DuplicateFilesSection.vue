<script setup>
/**
 * DuplicateFilesSection.vue - Duplicate files detection and display
 */
defineProps({
  duplicateFiles: { type: Array, default: () => [] },
  loadingDuplicates: { type: Boolean, default: false }
})
</script>

<template>
  <div class="duplicates-section">
    <div class="section-header">
      <h2>📋 Fichiers en double</h2>
      <p class="section-subtitle">Ces fichiers portent le même nom dans plusieurs dossiers configurés.</p>
    </div>

    <div v-if="loadingDuplicates" class="loading-state small">
      <div class="spinner"></div>
      <p>Recherche...</p>
    </div>

    <template v-else>
      <div v-for="group in duplicateFiles" :key="group.name" class="duplicate-group">
        <div class="dup-group-header">
          <span class="dup-icon">📄</span>
          <span class="dup-name">{{ group.name }}</span>
          <span class="dup-count">{{ group.files.length }} copies</span>
        </div>
        <div v-for="file in group.files" :key="file.path" class="dup-file-row">
          <span class="dup-folder-badge">{{ file.folder }}</span>
          <span class="dup-path" :title="file.path">{{ file.path }}</span>
          <span class="dup-size">{{ file.formattedSize }}</span>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.duplicates-section {
  background: var(--bg-secondary, #1a1a2e);
  border: 1px solid var(--border-color, #2a2a3e);
  border-radius: 10px;
  padding: 20px;
  margin-top: 8px;
}

.section-header { margin-bottom: 16px; }
.section-header h2 { font-size: 1.15rem; color: var(--text-secondary, #e0e0e0); margin-bottom: 4px; }
.section-subtitle { color: #888; font-size: 0.85rem; }

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #2a2a3e;
  border-top-color: #6c63ff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.loading-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px; color: #888; gap: 16px; }
.loading-state.small { padding: 20px; }

.duplicate-group {
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid #252540;
}

.duplicate-group:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }

.dup-group-header { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.dup-icon { flex-shrink: 0; }
.dup-name { font-weight: 600; color: var(--text-secondary, #ddd); font-size: 0.88rem; }
.dup-count {
  font-size: 0.72rem;
  color: #ff6b6b;
  background: rgba(255, 107, 107, 0.12);
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 600;
}

.dup-file-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  margin-left: 24px;
  font-size: 0.78rem;
}

.dup-folder-badge {
  background: #2a2a3e;
  color: #6c63ff;
  padding: 1px 6px;
  border-radius: 3px;
  font-weight: 600;
  flex-shrink: 0;
  font-size: 0.7rem;
}

.dup-path {
  color: #888;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  flex: 1;
}

.dup-size {
  color: #777;
  flex-shrink: 0;
  font-family: 'Consolas', monospace;
}

@keyframes spin { to { transform: rotate(360deg); } }
</style>