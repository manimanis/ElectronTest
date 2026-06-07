<script setup>
/**
 * ActionPanel.vue - Right sidebar with action buttons and selection info
 * La confirmation de suppression se fait via ConfirmDialog (dans CleanerView)
 */
import { formatSize } from '../utils/format'

defineProps({
  totalSelected: { type: Number, default: 0 },
  totalSelectedSize: { type: String, default: '0 B' },
  currentOperation: { type: String, default: '' },
  actionInProgress: { type: Boolean, default: false },
  sessionStats: { type: Object, default: () => ({ itemsCleaned: 0, spaceFreed: 0, operationCount: 0 }) }
})

const emit = defineEmits([
  'unselect-all',
  'archive-selected',
  'move-to-folder',
  'trash',
  'delete'
])
</script>

<template>
  <div class="action-panel">
    <div class="selection-info-box">
      <span class="selection-label">Sélection</span>
      <span class="selection-count">{{ totalSelected }} élément(s)</span>
      <span class="selection-size">{{ totalSelectedSize }}</span>
    </div>

    <div v-if="currentOperation" class="operation-indicator">
      <div class="spinner tiny-spinner"></div>
      <span class="operation-label">{{ currentOperation }}</span>
    </div>

    <div v-if="sessionStats.operationCount > 0" class="session-stats">
      <span class="stats-label">📊 Session</span>
      <span class="stats-detail">
        {{ sessionStats.operationCount }} opération(s) —
        {{ sessionStats.itemsCleaned }} élément(s) —
        {{ formatSize(sessionStats.spaceFreed) }}
      </span>
    </div>

    <div class="action-buttons-list">
      <button
        class="action-btn-full unselect-all-btn"
        :disabled="actionInProgress || totalSelected === 0"
        @click="emit('unselect-all')"
        title="Désélectionner tous les éléments (Échap)"
      >
        <span class="btn-icon">✕</span><span>Désélectionner tout</span>
      </button>

      <div class="action-separator"></div>

      <button
        class="action-btn-full archive-btn"
        :disabled="actionInProgress || totalSelected === 0"
        @click="emit('archive-selected')"
        title="Créer une archive 7z avec les éléments sélectionnés"
      >
        <span class="btn-icon">📦</span><span>Archiver en 7z...</span>
      </button>

      <button
        class="action-btn-full move-btn"
        :disabled="actionInProgress || totalSelected === 0"
        @click="emit('move-to-folder')"
        title="Déplacer les éléments vers un dossier choisi"
      >
        <span class="btn-icon">📁</span><span>Déplacer vers un dossier...</span>
      </button>

      <button
        class="action-btn-full trash-btn"
        :disabled="actionInProgress || totalSelected === 0"
        @click="emit('trash')"
        title="Mettre les éléments à la corbeille (Suppr)"
      >
        <span class="btn-icon">🗑️</span><span>Mettre à la corbeille...</span>
      </button>

      <div class="action-separator"></div>

      <button
        class="action-btn-full delete-btn"
        :disabled="actionInProgress || totalSelected === 0"
        @click="emit('delete')"
        title="Supprimer définitivement les éléments sélectionnés (irreversible)"
      >
        <span class="btn-icon">⚠</span><span>Supprimer définitivement...</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.action-panel {
  background: var(--bg-secondary, #1a1a2e);
  border: 1px solid #6c63ff;
  border-radius: 10px;
  padding: 20px;
  position: sticky;
  top: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.selection-info-box {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border-color, #2a2a3e);
}

.selection-label {
  font-size: 0.75rem;
  color: var(--text-dim, #666);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.selection-count {
  font-size: 1.1rem;
  font-weight: 700;
  color: #6c63ff;
}

.selection-size {
  font-size: 0.85rem;
  color: #888;
}

.operation-indicator {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: rgba(108, 99, 255, 0.1);
  border: 1px solid rgba(108, 99, 255, 0.2);
  border-radius: 6px;
}

.operation-label {
  color: #6c63ff;
  font-size: 0.8rem;
  font-weight: 600;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #2a2a3e;
  border-top-color: #6c63ff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.tiny-spinner {
  width: 14px;
  height: 14px;
  border-width: 2px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.session-stats {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 12px;
  background: rgba(39, 174, 96, 0.08);
  border: 1px solid rgba(39, 174, 96, 0.2);
  border-radius: 6px;
}

.stats-label {
  font-size: 0.75rem;
  color: #6fcf97;
  font-weight: 600;
}

.stats-detail {
  font-size: 0.72rem;
  color: #888;
}

.action-buttons-list { display: flex; flex-direction: column; gap: 8px; }

.action-btn-full {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border: none;
  border-radius: 8px;
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
  width: 100%;
}

.action-btn-full:disabled { opacity: 0.35; cursor: not-allowed; }

.btn-icon { font-size: 1.1rem; flex-shrink: 0; width: 24px; text-align: center; }

.trash-btn { background: #1a3a1a; color: #6fcf97; }
.trash-btn:hover:not(:disabled) { background: #1a4a2a; }
.delete-btn { background: #3d1a1a; color: #ff6b6b; }
.delete-btn:hover:not(:disabled) { background: #4d2222; }
.move-btn { background: #1a2a3d; color: #6fa8cf; }
.move-btn:hover:not(:disabled) { background: #1a3a4a; }
.unselect-all-btn { background: var(--bg-tertiary, #2a2a3e); color: #888; }
.unselect-all-btn:hover:not(:disabled) { background: var(--bg-hover, #3a3a4e); }
.archive-btn { background: #3d2a1a; color: #ffb86b; }
.archive-btn:hover:not(:disabled) { background: #4d3a2a; }

.action-separator {
  height: 1px;
  background: var(--border-color, #2a2a3e);
  margin: 4px 0;
}

@media (max-width: 900px) {
  .action-panel {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    border-radius: 12px 12px 0 0;
    padding: 12px 16px;
    z-index: 100;
    flex-direction: row;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.5);
  }

  .selection-info-box {
    flex-direction: row;
    gap: 8px;
    padding-bottom: 0;
    border-bottom: none;
    border-right: 1px solid #2a2a3e;
    padding-right: 12px;
  }

  .selection-label { font-size: 0.65rem; }

  .action-buttons-list { flex-direction: row; gap: 6px; flex-wrap: wrap; }
  .action-btn-full { padding: 8px 12px; font-size: 0.8rem; }
  .action-btn-full span:not(.btn-icon) { display: none; }
  .btn-icon { width: auto; font-size: 1.2rem; }
  .action-separator { display: none; }
}
</style>