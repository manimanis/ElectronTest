<script setup>
/**
 * ItemList.vue - Virtualized item list with sorting, search, and date filtering
 * Uses vue-virtual-scroller for performance with large folders
 */
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { RecycleScroller } from 'vue-virtual-scroller'
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'

const props = defineProps({
  folder: { type: Object, required: true },
  selectedItems: { type: Set, default: () => new Set() },
  sortCriteria: { type: Array, default: () => [] },
  rawSearchQuery: { type: String, default: '' },
  dateFilter: { type: String, default: 'all' },
  lastClickedItemPath: { type: String, default: null }
})

const scrollerHeight = ref(400)
function updateScrollerHeight() {
  // Calculate available height: viewport - header - tabs - sort - filters - margins
  const headerOffset = 380 // Approximate height of all elements above the scroller
  const available = window.innerHeight - headerOffset
  scrollerHeight.value = Math.max(200, Math.min(available, 700))
}

onMounted(() => {
  updateScrollerHeight()
  window.addEventListener('resize', updateScrollerHeight)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateScrollerHeight)
})

const emit = defineEmits([
  'toggle-item',
  'toggle-all',
  'toggle-sort',
  'update:rawSearchQuery',
  'update:dateFilter',
  'context-menu',
  'row-click'
])

const searchQuery = ref('')
const searchDebounceTimer = ref(null)
const activeDateFilter = ref(props.dateFilter)

watch(() => props.rawSearchQuery, (val) => {
  clearTimeout(searchDebounceTimer.value)
  searchDebounceTimer.value = setTimeout(() => {
    searchQuery.value = val
  }, 300)
})

watch(() => props.dateFilter, (val) => {
  activeDateFilter.value = val
})

function isWithinDateFilter(modifiedAt) {
  if (activeDateFilter.value === 'all' || !modifiedAt) return true
  const diff = Date.now() - new Date(modifiedAt).getTime()
  const d = 86400000
  switch (activeDateFilter.value) {
    case '7d': return diff <= 7 * d
    case '30d': return diff <= 30 * d
    case '90d': return diff <= 90 * d
    case '1y': return diff <= 365 * d
    default: return true
  }
}

function getFileType(item) {
  if (item.isDirectory) return 'folder'
  const ext = item.name.includes('.') ? item.name.split('.').pop().toLowerCase() : ''
  return ext || 'file'
}

function compareByField(a, b, field) {
  if (a.isDirectory && !b.isDirectory) return -1
  if (!a.isDirectory && b.isDirectory) return 1
  if (field === 'name') return a.name.localeCompare(b.name)
  if (field === 'size') return a.size - b.size
  if (field === 'type') {
    const c = getFileType(a).localeCompare(getFileType(b))
    return c !== 0 ? c : a.name.localeCompare(b.name)
  }
  return 0
}

const sortedItems = computed(() => {
  let items = [...props.folder.items]

  // Search filter
  const q = searchQuery.value.trim().toLowerCase()
  if (q) {
    items = items.filter(i => i.name.toLowerCase().includes(q))
  }

  // Date filter
  if (activeDateFilter.value !== 'all') {
    items = items.filter(i => isWithinDateFilter(i.modifiedAt))
  }

  // Sort
  const criteria = props.sortCriteria
  if (criteria && criteria.length > 0) {
    items.sort((a, b) => {
      for (const cr of criteria) {
        let cmp = compareByField(a, b, cr.field)
        if (cr.order === 'desc') cmp = -cmp
        if (cmp !== 0) return cmp
      }
      return 0
    })
  }

  return items
})

const isAllSelected = computed(() => {
  return sortedItems.value.length > 0 && sortedItems.value.every(i => props.selectedItems.has(i.path))
})

const isIndeterminate = computed(() => {
  const selectedCount = sortedItems.value.filter(i => props.selectedItems.has(i.path)).length
  return selectedCount > 0 && selectedCount < sortedItems.value.length
})
</script>

<template>
  <div class="item-list-container">
    <!-- Folder header -->
    <div class="folder-panel-header">
      <p class="active-folder-info"><strong>Dossier actif :</strong> {{ folder.path }}</p>
      <button
        class="open-explorer-btn"
        @click="window.electronAPI?.openInExplorer(folder.path)"
        title="Ouvrir dans l'Explorateur Windows"
      >
        <span>📂</span><span class="open-explorer-label">Ouvrir</span>
      </button>
    </div>

    <!-- Sort buttons -->
    <div class="folder-sort">
      <button
        v-for="field in ['name', 'size', 'type']"
        :key="field"
        class="sort-btn"
        :class="{
          'sort-primary': props.sortCriteria?.[0]?.field === field,
          'sort-secondary': props.sortCriteria?.[1]?.field === field,
          'sort-tertiary': props.sortCriteria?.[2]?.field === field
        }"
        @click="emit('toggle-sort', field, $event)"
        :title="'Trier par ' + field"
      >
        <span class="sort-label">{{ field === 'name' ? 'Nom' : field === 'size' ? 'Taille' : 'Type' }}</span>
        <span class="sort-icon">
          <template v-if="props.sortCriteria?.some(x => x.field === field)">
            {{ props.sortCriteria.find(x => x.field === field)?.order === 'asc' ? '▲' : '▼' }}
            <span class="sort-priority">{{ props.sortCriteria.findIndex(x => x.field === field) + 1 }}</span>
          </template>
          <template v-else>⇅</template>
        </span>
      </button>
    </div>

    <!-- Filter row -->
    <div v-if="folder.items.length > 0" class="filter-row">
      <div class="search-bar">
        <span class="search-icon">🔍</span>
        <input
          type="text"
          class="search-input"
          :value="props.rawSearchQuery"
          @input="emit('update:rawSearchQuery', $event.target.value)"
          placeholder="Filtrer par nom..."
        />
        <button
          v-if="props.rawSearchQuery"
          class="search-clear"
          @click="emit('update:rawSearchQuery', '')"
          title="Effacer le filtre"
        >✕</button>
      </div>
      <div class="date-filter">
        <button
          v-for="opt in [{v:'all',l:'Tout'},{v:'7d',l:'7j'},{v:'30d',l:'30j'},{v:'90d',l:'90j'},{v:'1y',l:'1an'}]"
          :key="opt.v"
          class="date-btn"
          :class="{ active: activeDateFilter === opt.v }"
          @click="activeDateFilter = opt.v; emit('update:dateFilter', opt.v)"
          :title="'Afficher les éléments modifiés il y a ' + opt.l"
        >{{ opt.l }}</button>
      </div>
    </div>

    <!-- Select all row -->
    <div v-if="folder.items.length > 0" class="select-all-row">
      <label class="checkbox-label select-all">
        <input
          type="checkbox"
          :checked="isAllSelected"
          :indeterminate="isIndeterminate"
          @change="emit('toggle-all', $event.target.checked)"
        />
        <span>Sélectionner tout</span>
        <span v-if="props.rawSearchQuery || activeDateFilter !== 'all'" class="filter-info">
          ({{ sortedItems.length }}/{{ folder.items.length }} affiché(s))
        </span>
      </label>
    </div>

    <!-- Virtualized items list -->
    <div v-if="folder.items.length > 0 && sortedItems.length > 0" class="items-list">
      <RecycleScroller
        :items="sortedItems"
        :item-size="42"
        key-field="path"
        v-slot="{ item }"
        class="virtual-scroller"
      >
        <div
          class="item-row"
          :class="{ selected: props.selectedItems.has(item.path) }"
          @contextmenu.prevent="emit('context-menu', $event, item)"
          @click="emit('row-click', item.path, $event)"
        >
          <label class="checkbox-label" @click.stop>
            <input
              type="checkbox"
              :checked="props.selectedItems.has(item.path) || false"
              @change="emit('toggle-item', item.path, $event)"
            />
            <span class="item-icon">{{ item.isDirectory ? '📁' : '📄' }}</span>
            <span class="item-name">{{ item.name }}</span>
          </label>
          <span class="item-size">{{ item.formattedSize }}</span>
        </div>
      </RecycleScroller>
    </div>

    <!-- Empty states -->
    <div v-else-if="props.rawSearchQuery || activeDateFilter !== 'all'" class="empty-state">
      <span class="empty-text">Aucun résultat avec les filtres actifs</span>
    </div>
    <div v-else class="empty-state">
      <span class="empty-text">Ce dossier est vide ou ne contient que des raccourcis</span>
    </div>
  </div>
</template>

<style scoped>
.item-list-container {
  background: var(--bg-secondary, #1a1a2e);
  border: 1px solid var(--border-color, #2a2a3e);
  border-radius: 0 0 10px 10px;
  padding: 16px;
  margin-bottom: 24px;
}

.folder-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-color, #2a2a3e);
}

.active-folder-info {
  margin: 0;
  color: #888;
  font-size: 0.85rem;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.open-explorer-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: var(--bg-hover, #252540);
  border: 1px solid #3a3a5e;
  border-radius: 5px;
  color: #aaa;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
  flex-shrink: 0;
}

.open-explorer-btn:hover {
  background: #2a2a50;
  border-color: #6c63ff;
  color: #ddd;
}

.folder-sort {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-color, #2a2a3e);
}

.sort-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: 1px solid var(--border-color, #2a2a3e);
  border-radius: 4px;
  background: var(--bg-secondary, #1a1a2e);
  color: #aaa;
  font-size: 0.78rem;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.sort-btn:hover {
  background: var(--bg-hover, #252540);
  border-color: #3a3a5e;
  color: #ccc;
}

.sort-btn.sort-primary {
  background: #6c63ff;
  border-color: #6c63ff;
  color: #fff;
}

.sort-btn.sort-secondary {
  background: #4a42b0;
  border-color: #5a52d0;
  color: #ddd;
}

.sort-btn.sort-tertiary {
  background: #3a3280;
  border-color: #4a4290;
  color: #bbb;
}

.sort-label { font-weight: 500; }
.sort-icon { font-size: 0.7rem; display: inline-flex; align-items: center; gap: 2px; }
.sort-priority {
  font-size: 0.6rem;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  width: 14px;
  height: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.filter-row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  align-items: stretch;
}

.search-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: var(--bg-tertiary, #151528);
  border: 1px solid var(--border-color, #2a2a3e);
  border-radius: 6px;
  transition: border-color 0.2s;
  flex: 1;
  min-width: 0;
}

.search-bar:focus-within { border-color: #6c63ff; }

.search-icon { font-size: 0.9rem; flex-shrink: 0; opacity: 0.5; }

.search-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-secondary, #ccc);
  font-size: 0.85rem;
  font-family: inherit;
  min-width: 0;
}

.search-input::placeholder { color: var(--text-dim, #555); }

.search-clear {
  background: transparent;
  border: none;
  color: #666;
  cursor: pointer;
  font-size: 0.85rem;
  padding: 2px 4px;
  border-radius: 3px;
  flex-shrink: 0;
}

.search-clear:hover { color: #ff6b6b; }

.date-filter { display: flex; gap: 2px; flex-shrink: 0; }

.date-btn {
  padding: 4px 8px;
  background: var(--bg-tertiary, #151528);
  border: 1px solid var(--border-color, #2a2a3e);
  border-radius: 4px;
  color: var(--text-dim, #666);
  font-size: 0.72rem;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
  font-weight: 600;
}

.date-btn:hover { background: var(--bg-hover, #252540); color: #aaa; }
.date-btn.active { background: #6c63ff; border-color: #6c63ff; color: #fff; }

.filter-info { color: #666; font-size: 0.78rem; margin-left: 4px; }
.select-all-row { margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid #252540; }

.virtual-scroller {
  overflow-y: auto;
  transition: max-height 0.2s ease;
}

.items-list {} /* placeholder */

.item-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px;
  border-radius: 6px;
  transition: background 0.15s;
  cursor: pointer;
  height: 42px;
  box-sizing: border-box;
}

.item-row:hover { background: var(--bg-hover, #252540); }
.item-row.selected { background: rgba(108, 99, 255, 0.1); }

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  min-width: 0;
  flex: 1;
}

.checkbox-label input[type="checkbox"] { accent-color: #6c63ff; cursor: pointer; flex-shrink: 0; }
.checkbox-label.select-all { color: #aaa; font-size: 0.85rem; }

.item-icon { font-size: 1rem; flex-shrink: 0; }
.item-name {
  font-size: 0.85rem;
  color: var(--text-secondary, #ccc);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.item-size {
  font-size: 0.78rem;
  color: #777;
  flex-shrink: 0;
  margin-left: 8px;
  font-family: 'Consolas', monospace;
}

.empty-state {
  padding: 48px 8px;
  text-align: center;
}

.empty-text { color: var(--text-dim, #666); font-size: 0.9rem; }
</style>