<script setup>
/**
 * RecycleBinBar.vue - Recycle bin status and empty action
 */
defineProps({
  recycleBinEmpty: { type: Boolean, default: true },
  recycleBinCount: { type: Number, default: 0 },
  actionInProgress: { type: Boolean, default: false }
})

const emit = defineEmits(['empty-recycle-bin'])

</script>

<template>
  <div class="recycle-bin-bar" :class="{ 'recycle-empty': recycleBinEmpty }">
    <div class="recycle-bin-info">
      <span class="recycle-icon">🗑️</span>
      <span>
        {{ recycleBinEmpty
          ? 'La corbeille est vide.'
          : 'La corbeille contient ' + recycleBinCount + ' élément' + (recycleBinCount !== 1 ? 's' : '') + '.'
        }}
      </span>
    </div>
    <button
      class="action-btn recycle-btn"
      :disabled="actionInProgress || recycleBinEmpty"
      @click="emit('empty-recycle-bin')"
      title="Vider définitivement toute la corbeille Windows"
    >Vider la corbeille</button>
  </div>
</template>

<style scoped>
.recycle-bin-bar {
  background: var(--bg-secondary, #1a1a2e);
  border: 1px solid #3a2a2a;
  border-radius: 10px;
  padding: 12px 16px;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
}

.recycle-bin-info {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-secondary, #ccc);
  font-size: 0.85rem;
}

.recycle-icon { font-size: 1.1rem; }

.recycle-btn {
  background: #3d2a1a;
  color: #ffb86b;
  padding: 6px 14px;
  font-size: 0.8rem;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.recycle-btn:hover:not(:disabled) { background: #4d3a2a; }
.recycle-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.recycle-empty { border-color: #2a3a2a; opacity: 0.6; }
</style>