<script setup>
/**
 * CleanerView.vue - Folder cleaning page
 * Allows users to clean standard folders (Desktop, Documents, Downloads, Bac2026)
 * Supports: move to trash, permanent delete, move to folder
 * Skips shortcuts (.lnk files) from cleaning operations
 * Detects and removes duplicate shortcuts
 */
import { ref, computed, onMounted } from 'vue'

const folders = ref([])
const loading = ref(true)
const error = ref('')
const actionInProgress = ref(false)
const operationResult = ref('')
const selectedItems = ref({})
const duplicateShortcuts = ref([])
const loadingShortcuts = ref(false)
const showShortcutSection = ref(false)
const moveDestination = ref('')
const recycleBinEmpty = ref(true)
const recycleBinCount = ref(0)

onMounted(async () => {
  await loadFolders()
  await loadDuplicateShortcuts()
  await checkRecycleBin()
})

async function loadFolders() {
  loading.value = true
  error.value = ''
  try {
    folders.value = await window.electronAPI.getStandardFolders()
    for (const folder of folders.value) {
      selectedItems.value[folder.path] = new Set()
    }
  } catch (err) {
    error.value = 'Failed to load folders: ' + err.message
    console.error(err)
  } finally {
    loading.value = false
  }
}

async function loadDuplicateShortcuts() {
  loadingShortcuts.value = true
  try {
    duplicateShortcuts.value = await window.electronAPI.findDuplicateShortcuts()
    if (duplicateShortcuts.value.length > 0) {
      showShortcutSection.value = true
    }
  } catch (err) {
    console.error('Failed to load duplicate shortcuts:', err)
  } finally {
    loadingShortcuts.value = false
  }
}

function getAllSelected() {
  const allItems = []
  for (const folder of folders.value) {
    const folderSelected = selectedItems.value[folder.path] || new Set()
    for (const item of folder.items) {
      if (folderSelected.has(item.path)) {
        allItems.push(item)
      }
    }
  }
  return allItems
}

function getSelectedItemsForFolder(folderPath) {
  const folder = folders.value.find(f => f.path === folderPath)
  if (!folder) return []
  const folderSelected = selectedItems.value[folderPath] || new Set()
  return folder.items.filter(item => folderSelected.has(item.path))
}

function toggleItem(folderPath, itemPath) {
  const set = selectedItems.value[folderPath]
  if (!set) return
  if (set.has(itemPath)) {
    set.delete(itemPath)
  } else {
    set.add(itemPath)
  }
}

function toggleAll(folderPath, checked) {
  const folder = folders.value.find(f => f.path === folderPath)
  if (!folder) return
  const set = selectedItems.value[folderPath]
  if (!set) return
  if (checked) {
    for (const item of folder.items) {
      set.add(item.path)
    }
  } else {
    set.clear()
  }
}

const totalSelected = computed(() => {
  let count = 0
  for (const folder of folders.value) {
    const set = selectedItems.value[folder.path]
    if (set) count += set.size
  }
  return count
})

const totalSelectedSize = computed(() => {
  let total = 0
  for (const folder of folders.value) {
    const set = selectedItems.value[folder.path]
    if (set) {
      for (const item of folder.items) {
        if (set.has(item.path)) {
          total += item.size
        }
      }
    }
  }
  return formatSize(total)
})

function showResult(message, isError) {
  if (isError === undefined) isError = false
  operationResult.value = { message, isError }
  setTimeout(() => {
    operationResult.value = ''
  }, 4000)
}

function formatSize(bytes) {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + units[i]
}

async function executeAction(action) {
  const selected = getAllSelected()
  if (selected.length === 0) {
    showResult('No items selected', true)
    return
  }
  if (action === 'moveToFolder' && !moveDestination.value) {
    const dest = await window.electronAPI.selectDestinationFolder()
    if (!dest) return
    moveDestination.value = dest
  }
  actionInProgress.value = true
  operationResult.value = ''
  const paths = selected.map(item => item.path)
  try {
    let results
    switch (action) {
      case 'trash':
        results = await window.electronAPI.moveToTrash(paths)
        break
      case 'delete':
        results = await window.electronAPI.permanentDelete(paths)
        break
      case 'moveToFolder':
        results = await window.electronAPI.moveToFolder(paths, moveDestination.value)
        moveDestination.value = ''
        break
      default:
        return
    }
    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length
    if (failCount === 0) {
      showResult('Traitement réussi de ' + successCount + ' élément(s)', false)
    } else {
      showResult('Traitement de ' + successCount + ' élément(s), ' + failCount + ' échoué(s)', true)
    }
    await loadFolders()
  } catch (err) {
    showResult('Error: ' + err.message, true)
  } finally {
    actionInProgress.value = false
  }
}

async function deleteSelectedShortcuts() {
  const selectedSc = duplicateShortcuts.value.filter(sc => sc.selected)
  if (selectedSc.length === 0) {
    showResult('No duplicate shortcuts selected', true)
    return
  }
  actionInProgress.value = true
  try {
    const paths = selectedSc.map(sc => sc.path)
    const results = await window.electronAPI.deleteShortcuts(paths)
    const successCount = results.filter(r => r.success).length
    showResult('Suppression de ' + successCount + ' raccourci(s) dupliqué(s)', false)
    await loadDuplicateShortcuts()
    await loadFolders()
  } catch (err) {
    showResult('Erreur: ' + err.message, true)
  } finally {
    actionInProgress.value = false
  }
}

function toggleShortcut(scPath) {
  const sc = duplicateShortcuts.value.find(s => s.path === scPath)
  if (sc) {
    sc.selected = !sc.selected
  }
}

function toggleAllShortcuts(checked) {
  for (const sc of duplicateShortcuts.value) {
    sc.selected = checked
  }
}

const recycleBinLabel = computed(() => {
  if (recycleBinEmpty.value) return 'La corbeille est vide.'
  const suffix = recycleBinCount.value !== 1 ? 's' : ''
  return 'La corbeille contient ' + recycleBinCount.value + ' élément' + suffix + '.'
})

async function checkRecycleBin() {
  try {
    const result = await window.electronAPI.isRecycleBinEmpty()
    if (result.success) {
      recycleBinEmpty.value = result.count === 0
      recycleBinCount.value = result.count
    }
  } catch (err) {
    console.error('Échec de la vérification de la Corbeille :', err)
  }
}

async function emptyRecycleBin() {
  if (!confirm('Vider la corbeille ? Attention : la suppression est définitive ! (' + recycleBinCount.value + ' élément' + (recycleBinCount.value !== 1 ? 's' : '') + ')')) {
    return
  }

  actionInProgress.value = true
  operationResult.value = ''
  try {
    const result = await window.electronAPI.emptyRecycleBin()
    if (result.success) {
      showResult('La corbeille a été vidée.', false)
    } else {
      showResult('Erreur: ' + result.error, true)
    }
    await checkRecycleBin()
  } catch (err) {
    showResult('Erreur: ' + err.message, true)
  } finally {
    actionInProgress.value = false
  }
}
</script>

<template>
  <div class="cleaner-view">
    <div class="page-header">
      <h1>Folder Cleaner</h1>
      <p class="page-subtitle">Nettoyez vos dossiers standard. Les raccourcis (fichiers .lnk) sont automatiquement
        exclus du nettoyage.</p>
    </div>

    <div v-if="operationResult" class="result-banner" :class="{ error: operationResult.isError }">
      <span>{{ operationResult.message }}</span>
    </div>

    <div v-if="error" class="error-banner">
      <span class="error-icon">!</span>
      <span>{{ error }}</span>
    </div>

    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>Chargement des dossiers...</p>
    </div>

    <template v-if="!loading">
      <div class="recycle-bin-bar" :class="{ 'recycle-empty': recycleBinEmpty }">
        <div class="recycle-bin-info">
          <span class="recycle-icon">&#x1F5D1;</span>
          <span>{{ recycleBinLabel }}</span>
        </div>
        <button class="action-btn recycle-btn" :disabled="actionInProgress || recycleBinEmpty"
          @click="emptyRecycleBin">Vider la corbeille</button>
      </div>

      <div v-if="totalSelected > 0" class="action-toolbar">
        <div class="selection-info">
          <span class="selection-count">{{ totalSelected }} item(s) selected</span>
          <span class="selection-size">({{ totalSelectedSize }})</span>
        </div>
        <div class="action-buttons">
          <button class="action-btn trash-btn" :disabled="actionInProgress" @click="executeAction('trash')">Mettre à la
            corbeille</button>
          <button class="action-btn delete-btn" :disabled="actionInProgress" @click="executeAction('delete')">Supprimer
            définitivement</button>
          <button class="action-btn move-btn" :disabled="actionInProgress"
            @click="executeAction('moveToFolder')">Déplacer vers un dossier...</button>
        </div>
      </div>

      <div class="folders-grid">
        <div v-for="folder in folders" :key="folder.path" class="folder-card"
          :class="{ 'folder-empty': folder.items.length === 0 }">
          <div class="folder-header">
            <div class="folder-info">
              <span class="folder-icon">&#x1F4C1;</span>
              <div class="folder-title-group">
                <h3 class="folder-name">{{ folder.name }}</h3>
                <span class="folder-path">{{ folder.path }}</span>
              </div>
            </div>
            <span class="item-count">{{ folder.items.length }} élément(s)</span>
          </div>

          <div v-if="folder.items.length > 0" class="select-all-row">
            <label class="checkbox-label select-all">
              <input type="checkbox"
                :checked="getSelectedItemsForFolder(folder.path).length === folder.items.length && folder.items.length > 0"
                :indeterminate="getSelectedItemsForFolder(folder.path).length > 0 && getSelectedItemsForFolder(folder.path).length < folder.items.length"
                @change="toggleAll(folder.path, $event.target.checked)" />
              <span>Sélectionner tout</span>
            </label>
          </div>

          <div v-if="folder.items.length > 0" class="items-list">
            <div v-for="item in folder.items" :key="item.path" class="item-row"
              :class="{ selected: selectedItems[folder.path]?.has(item.path) }">
              <label class="checkbox-label">
                <input type="checkbox" :checked="selectedItems[folder.path]?.has(item.path) || false"
                  @change="toggleItem(folder.path, item.path)" />
                <span class="item-icon">{{ item.isDirectory ? '&#x1F4C2;' : '&#x1F4C4;' }}</span>
                <span class="item-name">{{ item.name }}</span>
              </label>
              <span class="item-size">{{ item.formattedSize }}</span>
            </div>
          </div>

          <div v-else class="empty-folder">
            <span class="empty-text">Ce dossier est vide ou ne contient que des raccourcis</span>
          </div>
        </div>
      </div>

      <div v-if="showShortcutSection && duplicateShortcuts.length > 0" class="shortcuts-section">
        <div class="section-header">
          <h2>Raccourcis dupliqués sur le bureau</h2>
          <p class="section-subtitle">Les raccourcis suivants ont des doublons (même application). Conservez le plus
            récent et supprimez les autres.</p>
        </div>

        <div v-if="loadingShortcuts" class="loading-state small">
          <div class="spinner"></div>
          <p>Recherche des raccourcis...</p>
        </div>

        <template v-if="!loadingShortcuts">
          <div class="shortcut-toolbar">
            <label class="checkbox-label select-all">
              <input type="checkbox"
                :checked="duplicateShortcuts.length > 0 && duplicateShortcuts.every(s => s.selected)"
                @change="toggleAllShortcuts($event.target.checked)" />
              <span>Sélectionner tous les doublons</span>
            </label>
            <button class="action-btn delete-btn small"
              :disabled="actionInProgress || duplicateShortcuts.every(s => !s.selected)"
              @click="deleteSelectedShortcuts">Supprimer la sélection</button>
          </div>

          <div class="shortcuts-list">
            <div v-for="sc in duplicateShortcuts" :key="sc.path" class="shortcut-row"
              :class="{ selected: sc.selected }">
              <label class="checkbox-label">
                <input type="checkbox" :checked="sc.selected || false" @change="toggleShortcut(sc.path)" />
                <span class="item-icon">&#x1F517;</span>
                <span class="item-name">{{ sc.name }}</span>
              </label>
              <span class="item-size">{{ sc.targetName }}</span>
            </div>
          </div>
        </template>
      </div>
    </template>
  </div>
</template>

<style scoped>
.cleaner-view {
  min-height: 400px;
  width: 100%;
  overflow-x: hidden;
}

.page-header {
  margin-bottom: 24px;
}

.page-header h1 {
  font-size: 1.6rem;
  color: #ffffff;
  margin-bottom: 8px;
}

.page-subtitle {
  color: #888;
  font-size: 0.9rem;
  line-height: 1.5;
}

.result-banner {
  background: #1a3a1a;
  border: 1px solid #27ae60;
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 16px;
  color: #6fcf97;
  font-size: 0.9rem;
}

.result-banner.error {
  background: #3d1a1a;
  border-color: #e74c3c;
  color: #ff6b6b;
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

.loading-state.small {
  padding: 20px;
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
  to {
    transform: rotate(360deg);
  }
}

.action-toolbar {
  background: #1a1a2e;
  border: 1px solid #6c63ff;
  border-radius: 10px;
  padding: 16px 20px;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}

.selection-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.selection-count {
  font-weight: 600;
  color: #6c63ff;
  font-size: 0.95rem;
}

.selection-size {
  color: #888;
  font-size: 0.85rem;
}

.action-buttons {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.action-btn {
  padding: 10px 18px;
  border: none;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.trash-btn {
  background: #2a3d2a;
  color: #6fcf97;
}

.trash-btn:hover:not(:disabled) {
  background: #1a4a2a;
}

.delete-btn {
  background: #3d1a1a;
  color: #ff6b6b;
}

.delete-btn:hover:not(:disabled) {
  background: #4d2222;
}

.move-btn {
  background: #1a2a3d;
  color: #6fa8cf;
}

.move-btn:hover:not(:disabled) {
  background: #1a3a4a;
}

.action-btn.small {
  padding: 6px 14px;
  font-size: 0.8rem;
}

.folders-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 24px;
  width: 100%;
}

@media (max-width: 900px) {
  .folders-grid {
    grid-template-columns: 1fr;
  }
}

.folder-card {
  background: #1a1a2e;
  border: 1px solid #2a2a3e;
  border-radius: 10px;
  padding: 16px;
  transition: border-color 0.2s;
  min-width: 0;
  overflow: hidden;
}

.folder-card:hover {
  border-color: #3a3a5e;
}

.folder-card.folder-empty {
  opacity: 0.7;
}

.folder-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid #2a2a3e;
}

.folder-info {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-width: 0;
}

.folder-icon {
  font-size: 1.4rem;
  flex-shrink: 0;
}

.folder-title-group {
  min-width: 0;
  overflow: hidden;
}

.folder-name {
  font-size: 1rem;
  color: #e0e0e0;
  font-weight: 600;
  margin-bottom: 2px;
}

.folder-path {
  display: block;
  font-size: 0.7rem;
  color: #666;
  word-break: break-all;
  font-family: 'Consolas', monospace;
}

.item-count {
  font-size: 0.8rem;
  color: #888;
  flex-shrink: 0;
  margin-left: 8px;
}

.select-all-row {
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid #252540;
}

.items-list {
  max-height: 300px;
  overflow-y: auto;
}

.items-list::-webkit-scrollbar {
  width: 6px;
}

.items-list::-webkit-scrollbar-track {
  background: transparent;
}

.items-list::-webkit-scrollbar-thumb {
  background: #2a2a3e;
  border-radius: 3px;
}

.item-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px;
  border-radius: 6px;
  transition: background 0.15s;
}

.item-row:hover {
  background: #252540;
}

.item-row.selected {
  background: #1a1a3a;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  min-width: 0;
  flex: 1;
}

.checkbox-label input[type="checkbox"] {
  accent-color: #6c63ff;
  cursor: pointer;
  flex-shrink: 0;
}

.checkbox-label.select-all {
  color: #aaa;
  font-size: 0.85rem;
}

.item-icon {
  font-size: 1rem;
  flex-shrink: 0;
}

.item-name {
  font-size: 0.85rem;
  color: #ccc;
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

.empty-folder {
  padding: 24px 8px;
  text-align: center;
}

.empty-text {
  color: #666;
  font-size: 0.85rem;
}

.shortcuts-section {
  background: #1a1a2e;
  border: 1px solid #2a2a3e;
  border-radius: 10px;
  padding: 20px;
  margin-top: 8px;
}

.section-header {
  margin-bottom: 16px;
}

.section-header h2 {
  font-size: 1.15rem;
  color: #e0e0e0;
  margin-bottom: 4px;
}

.section-subtitle {
  color: #888;
  font-size: 0.85rem;
}

.shortcut-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid #2a2a3e;
  flex-wrap: wrap;
  gap: 8px;
}

.shortcuts-list {
  max-height: 250px;
  overflow-y: auto;
}

.shortcuts-list::-webkit-scrollbar {
  width: 6px;
}

.shortcuts-list::-webkit-scrollbar-track {
  background: transparent;
}

.shortcuts-list::-webkit-scrollbar-thumb {
  background: #2a2a3e;
  border-radius: 3px;
}

.shortcut-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px;
  border-radius: 6px;
  transition: background 0.15s;
}

.shortcut-row:hover {
  background: #252540;
}

.shortcut-row.selected {
  background: #1a1a3a;
}

.recycle-bin-bar {
  background: #1a1a2e;
  border: 1px solid #3a2a2a;
  border-radius: 10px;
  padding: 16px 20px;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}

.recycle-bin-info {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #ccc;
  font-size: 0.9rem;
}

.recycle-icon {
  font-size: 1.3rem;
}

.recycle-btn {
  background: #3d2a1a;
  color: #ffb86b;
}

.recycle-btn:hover:not(:disabled) {
  background: #4d3a2a;
}

.recycle-empty {
  border-color: #2a3a2a;
  opacity: 0.6;
}

.recycle-empty .recycle-btn {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>