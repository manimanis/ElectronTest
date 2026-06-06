<script setup>
/**
 * CleanerView.vue - Folder cleaning page
 * Allows users to clean standard folders (Desktop, Documents, Downloads, Bac2026)
 * Supports: move to trash, permanent delete, move to folder
 * Skips shortcuts (.lnk files) from cleaning operations
 * Detects and removes duplicate shortcuts
 * Supports multi-column sorting: combine multiple sort criteria per folder
 *   - Click a sort button to sort by that field (ascending)
 *   - Click again to toggle ascending/descending
 *   - Shift+click to add a secondary sort criterion
 *   - Right-click or click a 3rd time on the same field to remove the criterion
 * Displays folders in tabs — each tab shows one folder's content with its own sort controls
 * Grid layout: left panel = selection, right panel = actions
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
const lastArchiveDest = ref('')
const recycleBinEmpty = ref(true)
const recycleBinCount = ref(0)
const activeTab = ref(0)
// Multi-sort state: each folder path maps to an ordered array of sort criteria
// Each criterion: { field: 'name'|'size'|'type', order: 'asc'|'desc' }
const sortCriteria = ref({})

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
      if (!sortCriteria.value[folder.path] || sortCriteria.value[folder.path].length === 0) {
        sortCriteria.value[folder.path] = [{ field: 'name', order: 'asc' }]
      }
    }
    // Reset active tab if folders changed
    if (activeTab.value >= folders.value.length) {
      activeTab.value = 0
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

function unselectAll() {
  for (const folder of folders.value) {
    const set = selectedItems.value[folder.path]
    if (set) {
      set.clear()
    }
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

  // Confirmation dialog for destructive operations
  if (action === 'trash') {
    const folderCount = selected.filter(item => item.isDirectory).length
    const fileCount = selected.length - folderCount
    let msg = 'Mettre ' + selected.length + ' élément' + (selected.length > 1 ? 's' : '') + ' à la corbeille ?'
    if (folderCount > 0) {
      msg += '\n\nDont ' + folderCount + ' dossier' + (folderCount > 1 ? 's' : '') + ' (tout le contenu sera déplacé).'
    }
    if (!confirm(msg)) return
  } else if (action === 'delete') {
    const folderCount = selected.filter(item => item.isDirectory).length
    const totalBytes = selected.reduce((sum, item) => sum + item.size, 0)
    let msg = 'Supprimer définitivement ' + selected.length + ' élément' + (selected.length > 1 ? 's' : '') + ' (' + formatSize(totalBytes) + ') ?'
    if (folderCount > 0) {
      msg += '\n\nDont ' + folderCount + ' dossier' + (folderCount > 1 ? 's' : '') + '.'
    }
    msg += '\n\nAttention : cette action est irréversible !'
    if (!confirm(msg)) return
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

async function archiveSelected() {
  const selected = getAllSelected()
  if (selected.length === 0) {
    showResult('No items selected', true)
    return
  }

  // First time: ask user to pick a destination folder
  if (!lastArchiveDest.value) {
    const dest = await window.electronAPI.selectDestinationFolder()
    if (!dest) return
    lastArchiveDest.value = dest
  }

  actionInProgress.value = true
  operationResult.value = ''
  const paths = selected.map(item => item.path)

  try {
    const result = await window.electronAPI.archiveTo7z(paths, lastArchiveDest.value)
    if (result.canceled) {
      return
    }
    if (result.success) {
      showResult('Archive créée : ' + result.archivePath, false)
    } else {
      showResult('Erreur d\'archivage : ' + result.error, true)
    }
  } catch (err) {
    showResult('Erreur d\'archivage : ' + err.message, true)
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

function getFileType(item) {
  if (item.isDirectory) return 'folder'
  const ext = item.name.includes('.') ? item.name.split('.').pop().toLowerCase() : ''
  return ext || 'file'
}

/**
 * Compare two items by a given field, for use in stable sort chains.
 * Returns -1, 0, or 1.
 */
function compareByField(a, b, field) {
  // Always place folders first, regardless of sort field
  if (a.isDirectory && !b.isDirectory) return -1
  if (!a.isDirectory && b.isDirectory) return 1

  if (field === 'name') {
    return a.name.localeCompare(b.name)
  }
  if (field === 'size') {
    return a.size - b.size
  }
  if (field === 'type') {
    const typeA = getFileType(a)
    const typeB = getFileType(b)
    // Folders are already handled above; compare extensions
    const typeCmp = typeA.localeCompare(typeB)
    if (typeCmp !== 0) return typeCmp
    // Same type: stable fallback to name
    return a.name.localeCompare(b.name)
  }
  return 0
}

/**
 * Sort items by multiple criteria (stable chain sort).
 * Each criterion: { field: 'name'|'size'|'type', order: 'asc'|'desc' }
 */
function getSortedItems(folder) {
  const criteria = sortCriteria.value[folder.path]
  if (!criteria || criteria.length === 0) {
    return [...folder.items]
  }

  // Use a stable multi-key sort: for each pair, compare; if equal, move to next criterion
  const items = [...folder.items]
  items.sort((a, b) => {
    for (const criterion of criteria) {
      const { field, order } = criterion
      let comparison = compareByField(a, b, field)
      if (order === 'desc') comparison = -comparison
      if (comparison !== 0) return comparison
    }
    return 0
  })
  return items
}

/**
 * Check if a folder is currently sorted by the given field.
 */
function isSortedBy(folderPath, field) {
  const criteria = sortCriteria.value[folderPath]
  if (!criteria) return false
  return criteria.some(c => c.field === field)
}

/**
 * Get the sort order for a given field in the first matching criterion for a folder.
 */
function getSortOrder(folderPath, field) {
  const criteria = sortCriteria.value[folderPath]
  if (!criteria) return null
  const criterion = criteria.find(c => c.field === field)
  return criterion ? criterion.order : null
}

/**
 * Get the priority (1-based index) of a sort field for a folder.
 * Returns 0 if the field is not used as a sort criterion.
 */
function getSortPriority(folderPath, field) {
  const criteria = sortCriteria.value[folderPath]
  if (!criteria) return 0
  const idx = criteria.findIndex(c => c.field === field)
  return idx >= 0 ? idx + 1 : 0
}

/**
 * Toggle sort for a folder.
 * Normal click: sort by field (toggle asc/desc if already sorted, or set as primary asc)
 * Shift+click: add as secondary/tertiary criterion
 */
function toggleSort(folderPath, field, event) {
  const criteria = sortCriteria.value[folderPath]
  if (!criteria) {
    sortCriteria.value[folderPath] = [{ field, order: 'asc' }]
    return
  }

  const existingIdx = criteria.findIndex(c => c.field === field)

  if (event && event.shiftKey) {
    // Shift+click: add as additional criterion (if not already present), or skip
    if (existingIdx >= 0) {
      // Already present — toggle its order
      const newCriteria = [...criteria]
      const currentOrder = newCriteria[existingIdx].order
      newCriteria[existingIdx] = { field, order: currentOrder === 'asc' ? 'desc' : 'asc' }
      sortCriteria.value[folderPath] = newCriteria
    } else {
      // Add as new criterion (appended)
      sortCriteria.value[folderPath] = [...criteria, { field, order: 'asc' }]
    }
    return
  }

  // Normal click: replace primary sort with this field, or toggle order if it's already primary
  if (existingIdx === 0) {
    // Already primary — toggle order
    const newCriteria = [...criteria]
    const currentOrder = newCriteria[0].order
    if (currentOrder === 'asc') {
      newCriteria[0] = { field, order: 'desc' }
      sortCriteria.value[folderPath] = newCriteria
    } else {
      // Already desc — remove this criterion entirely (reset to default name asc)
      sortCriteria.value[folderPath] = [{ field: 'name', order: 'asc' }]
    }
  } else if (existingIdx > 0) {
    // Exists but not primary — move it to primary, keep secondary as-is
    const newCriteria = criteria.filter(c => c.field !== field)
    sortCriteria.value[folderPath] = [{ field, order: 'asc' }, ...newCriteria]
  } else {
    // Not in criteria — set as primary sort
    sortCriteria.value[folderPath] = [{ field, order: 'asc' }]
  }
}

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
      <p class="sort-hint">Conseil : utilisez <kbd>Shift</kbd>+clic pour ajouter un critère de tri secondaire ou
        tertiaire.</p>
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
      <div class="cleaner-layout">
        <!-- ===== LEFT PANEL: Selection zone ===== -->
        <div class="selection-panel">
          <!-- Tabs bar -->
          <div class="tabs-bar">
            <button v-for="(folder, index) in folders" :key="folder.path" class="tab-btn"
              :class="{ active: activeTab === index }" @click="activeTab = index">
              <span class="tab-icon">&#x1F4C1;</span>
              <span class="tab-label">{{ folder.name }}</span>
              <span class="tab-count" :class="{ 'has-selection': getSelectedItemsForFolder(folder.path).length > 0 }">
                <template v-if="getSelectedItemsForFolder(folder.path).length > 0">
                  {{ getSelectedItemsForFolder(folder.path).length }}<span class="tab-count-sep">/</span>{{ folder.items.length }}
                </template>
                <template v-else>
                  {{ folder.items.length }}
                </template>
              </span>
            </button>
          </div>

          <!-- Active folder content -->
          <template v-if="folders.length > 0">
            <div class="folder-panel">
              <p class="active-folder-info"><strong>Dossier actif :</strong> {{ folders[activeTab].path }}</p>
              <div class="folder-sort">
                <button v-for="field in ['name', 'size', 'type']" :key="field" class="sort-btn" :class="{
                  active: isSortedBy(folders[activeTab].path, field),
                  'sort-primary': getSortPriority(folders[activeTab].path, field) === 1,
                  'sort-secondary': getSortPriority(folders[activeTab].path, field) === 2,
                  'sort-tertiary': getSortPriority(folders[activeTab].path, field) === 3
                }" @click="toggleSort(folders[activeTab].path, field, $event)">
                  <span class="sort-label">{{ field === 'name' ? 'Nom' : field === 'size' ? 'Taille' : 'Type' }}</span>
                  <span class="sort-icon">
                    <template v-if="getSortPriority(folders[activeTab].path, field) > 0">
                      {{ getSortOrder(folders[activeTab].path, field) === 'asc' ? '▲' : '▼' }}
                      <span class="sort-priority">{{ getSortPriority(folders[activeTab].path, field) }}</span>
                    </template>
                    <template v-else>⇅</template>
                  </span>
                </button>
              </div>

              <div v-if="folders[activeTab].items.length > 0" class="select-all-row">
                <label class="checkbox-label select-all">
                  <input type="checkbox"
                    :checked="getSelectedItemsForFolder(folders[activeTab].path).length === folders[activeTab].items.length && folders[activeTab].items.length > 0"
                    :indeterminate="getSelectedItemsForFolder(folders[activeTab].path).length > 0 && getSelectedItemsForFolder(folders[activeTab].path).length < folders[activeTab].items.length"
                    @change="toggleAll(folders[activeTab].path, $event.target.checked)" />
                  <span>Sélectionner tout</span>
                </label>
              </div>

              <div v-if="folders[activeTab].items.length > 0" class="items-list">
                <div v-for="item in getSortedItems(folders[activeTab])" :key="item.path" class="item-row"
                  :class="{ selected: selectedItems[folders[activeTab].path]?.has(item.path) }">
                  <label class="checkbox-label">
                    <input type="checkbox" :checked="selectedItems[folders[activeTab].path]?.has(item.path) || false"
                      @change="toggleItem(folders[activeTab].path, item.path)" />
                    <span class="item-icon">{{ item.isDirectory ? '&#x1F4C2;' : '&#x1F4C4;' }}</span>
                    <span class="item-name">{{ item.name }}</span>
                  </label>
                  <span class="item-size">{{ item.formattedSize }}</span>
                </div>
              </div>

              <div v-else class="empty-state">
                <span class="empty-text">Ce dossier est vide ou ne contient que des raccourcis</span>
              </div>
            </div>
          </template>

          <div class="recycle-bin-bar" :class="{ 'recycle-empty': recycleBinEmpty }">
            <div class="recycle-bin-info">
              <span class="recycle-icon">&#x1F5D1;</span>
              <span>{{ recycleBinLabel }}</span>
            </div>
            <button class="action-btn recycle-btn" :disabled="actionInProgress || recycleBinEmpty"
              @click="emptyRecycleBin">Vider la corbeille</button>
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
        </div>

        <!-- ===== RIGHT PANEL: Action zone ===== -->
        <div class="action-panel">
          <div class="selection-info-box">
            <span class="selection-label">Sélection</span>
            <span class="selection-count">{{ totalSelected }} élément(s)</span>
            <span class="selection-size">{{ totalSelectedSize }}</span>
          </div>

          <div class="action-buttons-list">
            <button class="action-btn-full unselect-all-btn" :disabled="actionInProgress || totalSelected === 0"
              @click="unselectAll">
              <span class="btn-icon">✕</span>
              <span>Désélectionner tout</span>
            </button>

            <div class="action-separator"></div>

            <button class="action-btn-full archive-btn" :disabled="actionInProgress || totalSelected === 0"
              @click="archiveSelected">
              <span class="btn-icon">📦</span>
              <span>Archiver en 7z...</span>
            </button>

            <button class="action-btn-full move-btn" :disabled="actionInProgress || totalSelected === 0"
              @click="executeAction('moveToFolder')">
              <span class="btn-icon">📁</span>
              <span>Déplacer vers un dossier...</span>
            </button>

            <button class="action-btn-full trash-btn" :disabled="actionInProgress || totalSelected === 0"
              @click="executeAction('trash')">
              <span class="btn-icon">🗑️</span>
              <span>Mettre à la corbeille...</span>
            </button>
          </div>
        </div>
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

.sort-hint {
  color: #666;
  font-size: 0.8rem;
  margin-top: 4px;
}

.sort-hint kbd {
  background: #2a2a3e;
  border: 1px solid #3a3a5e;
  border-radius: 3px;
  padding: 1px 5px;
  font-size: 0.75rem;
  color: #aaa;
  font-family: inherit;
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

/* ===== GRID LAYOUT ===== */
.cleaner-layout {
  display: grid;
  grid-template-columns: 1fr 260px;
  gap: 20px;
  align-items: start;
}

@media (max-width: 900px) {
  .cleaner-layout {
    grid-template-columns: 1fr;
  }
}

/* ===== LEFT: SELECTION PANEL ===== */
.selection-panel {
  min-width: 0;
  overflow: hidden;
}

/* ===== RIGHT: ACTION PANEL ===== */
.action-panel {
  background: #1a1a2e;
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
  border-bottom: 1px solid #2a2a3e;
}

.selection-label {
  font-size: 0.75rem;
  color: #666;
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

.action-buttons-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

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

.action-btn-full:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.btn-icon {
  font-size: 1.1rem;
  flex-shrink: 0;
  width: 24px;
  text-align: center;
}

.trash-btn {
  background: #1a3a1a;
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

.unselect-all-btn {
  background: #2a2a3e;
  color: #888;
}

.unselect-all-btn:hover:not(:disabled) {
  background: #3a3a4e;
}

.archive-btn {
  background: #3d2a1a;
  color: #ffb86b;
}

.archive-btn:hover:not(:disabled) {
  background: #4d3a2a;
}

.action-separator {
  height: 1px;
  background: #2a2a3e;
  margin: 4px 0;
}

.action-btn.small {
  padding: 6px 14px;
  font-size: 0.8rem;
}

/* Tabs bar */
.tabs-bar {
  display: flex;
  gap: 4px;
  margin-bottom: 0;
  overflow-x: auto;
  padding-bottom: 0;
}

.tabs-bar::-webkit-scrollbar {
  height: 4px;
}

.tabs-bar::-webkit-scrollbar-track {
  background: transparent;
}

.tabs-bar::-webkit-scrollbar-thumb {
  background: #2a2a3e;
  border-radius: 2px;
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  border: 1px solid #2a2a3e;
  border-bottom: none;
  border-radius: 8px 8px 0 0;
  background: #151528;
  color: #888;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
  position: relative;
  flex-shrink: 0;
}

.tab-btn:hover {
  background: #1a1a2e;
  color: #aaa;
  border-color: #3a3a5e;
}

.tab-btn.active {
  background: #1a1a2e;
  border-color: #6c63ff;
  color: #fff;
  z-index: 1;
}

.tab-icon {
  font-size: 1rem;
}

.tab-count {
  font-size: 0.7rem;
  background: #2a2a3e;
  color: #888;
  border-radius: 10px;
  padding: 1px 6px;
  min-width: 18px;
  text-align: center;
}

.tab-btn.active .tab-count {
  background: #6c63ff;
  color: #fff;
}

.tab-count.has-selection {
  background: #27ae60;
  color: #fff;
}

.tab-count-sep {
  opacity: 0.6;
  margin: 0 1px;
}

/* Active folder panel */
.folder-panel {
  background: #1a1a2e;
  border: 1px solid #2a2a3e;
  border-top: 1px solid #6c63ff;
  border-radius: 0 0 10px 10px;
  padding: 16px;
  margin-bottom: 24px;
}

.folder-panel:only-of-type {
  border-top-width: 1px;
  border-top-color: #2a2a3e;
}

.active-folder-info {
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #2a2a3e;
  color: #888;
  font-size: 0.85rem;
}

.folder-sort {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #2a2a3e;
}

.sort-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: 1px solid #2a2a3e;
  border-radius: 4px;
  background: #1a1a2e;
  color: #aaa;
  font-size: 0.78rem;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.sort-btn:hover {
  background: #252540;
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

.sort-label {
  font-weight: 500;
}

.sort-icon {
  font-size: 0.7rem;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  transition: transform 0.2s;
}

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

.select-all-row {
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid #252540;
}

.items-list {
  max-height: 400px;
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

.empty-state {
  padding: 48px 8px;
  text-align: center;
}

.empty-text {
  color: #666;
  font-size: 0.9rem;
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
  color: #ccc;
  font-size: 0.85rem;
}

.recycle-icon {
  font-size: 1.1rem;
}

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

.recycle-btn:hover:not(:disabled) {
  background: #4d3a2a;
}

.recycle-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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