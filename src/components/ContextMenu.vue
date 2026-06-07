<script setup>
/**
 * ContextMenu.vue - Right-click context menu for items
 */
import { onMounted, onUnmounted } from 'vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  x: { type: Number, default: 0 },
  y: { type: Number, default: 0 },
  item: { type: Object, default: null }
})

const emit = defineEmits(['close', 'action'])

function handleClickOutside() {
  if (props.visible) emit('close')
}

function handleEscape(e) {
  if (e.key === 'Escape' && props.visible) emit('close')
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('keydown', handleEscape)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('keydown', handleEscape)
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="context-menu"
      :style="{ left: x + 'px', top: y + 'px' }"
      @click.stop
    >
      <button class="ctx-item" @click="emit('action', 'open')">
        <span class="ctx-icon">📤</span> Ouvrir
      </button>
      <button class="ctx-item" @click="emit('action', 'explorer')">
        <span class="ctx-icon">📂</span> Ouvrir dans l'Explorateur
      </button>
      <div class="ctx-separator"></div>
      <button class="ctx-item" @click="emit('action', 'select')">
        <span class="ctx-icon">☑</span> Sélectionner
      </button>
      <button class="ctx-item ctx-danger" @click="emit('action', 'trash')">
        <span class="ctx-icon">🗑️</span> Mettre à la corbeille
      </button>
    </div>
  </Teleport>
</template>

<style scoped>
.context-menu {
  position: fixed;
  z-index: 10000;
  background: #1e1e30;
  border: 1px solid #3a3a5e;
  border-radius: 8px;
  padding: 4px 0;
  min-width: 200px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
  animation: ctx-in 0.15s ease-out;
}

@keyframes ctx-in {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

.ctx-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 14px;
  background: transparent;
  border: none;
  color: #ccc;
  font-size: 0.85rem;
  cursor: pointer;
  transition: background 0.15s;
  text-align: left;
}

.ctx-item:hover { background: rgba(108, 99, 255, 0.15); color: #fff; }
.ctx-item.ctx-danger { color: #ff6b6b; }
.ctx-item.ctx-danger:hover { background: rgba(255, 107, 107, 0.15); }
.ctx-icon { font-size: 0.9rem; width: 18px; text-align: center; flex-shrink: 0; }
.ctx-separator { height: 1px; background: #2a2a3e; margin: 4px 8px; }
</style>