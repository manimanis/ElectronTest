<script setup>
/**
 * ShortcutSection.vue - Duplicate shortcuts management section
 */
defineProps({
  duplicateShortcuts: { type: Array, default: () => [] },
  loadingShortcuts: { type: Boolean, default: false },
  actionInProgress: { type: Boolean, default: false }
})

const emit = defineEmits([
  'toggle-shortcut',
  'toggle-all-shortcuts',
  'delete-selected-shortcuts'
])

function isAllSelected() {
  return false // Will be computed from parent
}
</script>

<template>
  <div class="shortcuts-section">
    <div class="section-header">
      <h2>Raccourcis dupliqués sur le bureau</h2>
      <p class="section-subtitle">Conservez le plus récent et supprimez les doublons.</p>
    </div>

    <div v-if="loadingShortcuts" class="loading-state small">
      <div class="spinner"></div>
      <p>Recherche...</p>
    </div>

    <template v-if="!loadingShortcuts">
      <div class="shortcut-toolbar">
        <label class="checkbox-label select-all">
          <input
            type="checkbox"
            :checked="duplicateShortcuts.length > 0 && duplicateShortcuts.every(s => s.selected)"
            @change="emit('toggle-all-shortcuts', $event.target.checked)"
          />
          <span>Sélectionner tous les doublons</span>
        </label>
        <button
          class="action-btn delete-btn small"
          :disabled="actionInProgress || duplicateShortcuts.every(s => !s.selected)"
          @click="emit('delete-selected-shortcuts')"
          title="Supprimer les raccourcis sélectionnés"
        >Supprimer la sélection</button>
      </div>

      <div class="shortcuts-list">
        <div
          v-for="sc in duplicateShortcuts"
          :key="sc.path"
          class="shortcut-row"
          :class="{ selected: sc.selected }"
        >
          <label class="checkbox-label">
            <input
              type="checkbox"
              :checked="sc.selected || false"
              @change="emit('toggle-shortcut', sc.path)"
            />
            <span class="item-icon">🔗</span>
            <span class="item-name">{{ sc.name }}</span>
          </label>
          <span class="item-size">{{ sc.targetName }}</span>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.shortcuts-section {
  background: var(--bg-secondary, #1a1a2e);
  border: 1px solid var(--border-color, #2a2a3e);
  border-radius: 10px;
  padding: 20px;
  margin-top: 8px;
}

.section-header { margin-bottom: 16px; }
.section-header h2 { font-size: 1.15rem; color: var(--text-secondary, #e0e0e0); margin-bottom: 4px; }
.section-subtitle { color: #888; font-size: 0.85rem; }

.shortcut-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-color, #2a2a3e);
  flex-wrap: wrap;
  gap: 8px;
}

.shortcuts-list { max-height: 250px; overflow-y: auto; }

.shortcut-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px;
  border-radius: 6px;
  transition: background 0.15s;
}

.shortcut-row:hover { background: var(--bg-hover, #252540); }
.shortcut-row.selected { background: rgba(108, 99, 255, 0.1); }

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

.checkbox-label { display: flex; align-items: center; gap: 8px; cursor: pointer; min-width: 0; flex: 1; }
.checkbox-label input[type="checkbox"] { accent-color: #6c63ff; cursor: pointer; flex-shrink: 0; }
.checkbox-label.select-all { color: #aaa; font-size: 0.85rem; }

.item-icon { font-size: 1rem; flex-shrink: 0; }
.item-name { font-size: 0.85rem; color: var(--text-secondary, #ccc); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.item-size { font-size: 0.78rem; color: #777; flex-shrink: 0; margin-left: 8px; font-family: 'Consolas', monospace; }

.action-btn.small { padding: 6px 14px; font-size: 0.8rem; }
.delete-btn { background: #3d1a1a; color: #ff6b6b; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; transition: all 0.2s; white-space: nowrap; }
.delete-btn:hover:not(:disabled) { background: #4d2222; }
.delete-btn:disabled { opacity: 0.35; cursor: not-allowed; }

@keyframes spin { to { transform: rotate(360deg); } }
</style>