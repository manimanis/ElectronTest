<script setup>
/**
 * CleanerView.vue - Nettoyage des dossiers
 * Réécrit avec des sous-composants extraits et virtualisation des listes
 */
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { formatSize } from '../utils/format'
import TabBar from '../components/TabBar.vue'
import ItemList from '../components/ItemList.vue'
import ActionPanel from '../components/ActionPanel.vue'
import ShortcutSection from '../components/ShortcutSection.vue'
import RecycleBinBar from '../components/RecycleBinBar.vue'
import ContextMenu from '../components/ContextMenu.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'

// ===== State =====
const folders = ref([])
const loading = ref(true)
const initialLoadDone = ref(false)
const error = ref('')
const loadingFolder = ref(null) // path of folder currently loading
const foldersLoaded = ref(new Set()) // set of folder paths that have items loaded
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
const sortCriteria = ref({})
const rawSearchQuery = ref('')
const lastClickedItemPath = ref(null)
const currentOperation = ref('')
const dateFilter = ref('all')
const sessionStats = ref({ itemsCleaned: 0, spaceFreed: 0, operationCount: 0 })
const contextMenu = ref({ visible: false, x: 0, y: 0, item: null })
const deleteConfirmStep = ref(0)
const deleteConfirmText = ref('')
const recycleBinConfirmDialog = ref(null)
const deleteConfirmDialog = ref(null)

// ConfirmDialog states
const trashConfirm = ref({ visible: false, message: '' })
const shortcutConfirm = ref({ visible: false, message: '' })
const recycleBinConfirm = ref({ visible: false, message: '', challenge: null })
const deleteConfirm = ref({ visible: false, message: '', challenge: null })
let pendingTrashAction = null
let pendingShortcutAction = null
let pendingRecycleBinAction = null
let pendingDeleteAction = null

const CHALLENGE_WORDS = ['SUPPRIMER', 'CONFIRMER', 'DÉTRUIRE', 'EFFACER', 'DANGER', 'IRRÉVERSIBLE']
function randomWord() {
  return CHALLENGE_WORDS[Math.floor(Math.random() * CHALLENGE_WORDS.length)]
}

// ===== Computed =====
const totalSelected = computed(() => {
  let c = 0
  for (const f of folders.value) {
    const s = selectedItems.value[f.path]
    if (s) c += s.size
  }
  return c
})

const totalSelectedSize = computed(() => {
  let t = 0
  for (const f of folders.value) {
    const s = selectedItems.value[f.path]
    if (s) {
      for (const i of f.items) {
        if (s.has(i.path)) t += i.size
      }
    }
  }
  return formatSize(t)
})

const duplicateNames = computed(() => {
  const n = new Map(), dp = new Set()
  for (const f of folders.value) {
    if (n.has(f.name)) { dp.add(f.path); dp.add(n.get(f.name)) }
    else n.set(f.name, f.path)
  }
  return dp
})

// ===== Helpers =====
function getTabSubtitle(f) {
  if (!duplicateNames.value.has(f.path)) return ''
  const p = f.path.replace(/\\/g, '/').split('/').filter(Boolean)
  if (p.length >= 3) {
    const dr = p[0].endsWith(':') ? p[0] : ''
    const l = p.slice(-2)
    return dr ? `${dr}/.../${l.join('/')}` : `.../${l.join('/')}`
  }
  return f.path
}

function getSelectedItemsForFolder(fp) {
  const f = folders.value.find(f => f.path === fp)
  if (!f) return []
  const set = selectedItems.value[fp] || new Set()
  return f.items.filter(i => set.has(i.path))
}

function getAllSelected() {
  const all = []
  for (const folder of folders.value) {
    const set = selectedItems.value[folder.path] || new Set()
    for (const item of folder.items) {
      if (set.has(item.path)) all.push(item)
    }
  }
  return all
}

function showResult(message, isError = false) {
  operationResult.value = { message, isError }
  setTimeout(() => { operationResult.value = '' }, 4000)
}

function buildItemsPreview(items) {
  const max = 5
  const fc = items.filter(i => i.isDirectory).length
  const fic = items.length - fc
  const tb = items.reduce((s, i) => s + i.size, 0)
  let m = items.length + ' élément' + (items.length > 1 ? 's' : '') + ' (' + formatSize(tb) + ')'
  if (fc > 0 && fic > 0) m += '\n  ' + fc + ' dossier' + (fc > 1 ? 's' : '') + ', ' + fic + ' fichier' + (fic > 1 ? 's' : '')
  else if (fc > 0) m += '\n  ' + fc + ' dossier' + (fc > 1 ? 's' : '')
  m += '\n\n'
  for (const i of items.slice(0, max)) {
    m += (i.isDirectory ? '📁' : '📄') + ' ' + i.name
    if (!i.isDirectory) m += ' (' + i.formattedSize + ')'
    m += '\n'
  }
  if (items.length > max) m += '... et ' + (items.length - max) + ' autre(s)\n'
  return m
}

function updateSessionStats(count, bytes) {
  sessionStats.value.itemsCleaned += count
  sessionStats.value.spaceFreed += bytes
  sessionStats.value.operationCount++
}

// ===== Data loading =====
async function loadFolders() {
  loading.value = true; error.value = ''
  try {
    folders.value = await window.electronAPI.getStandardFolders()
    for (const folder of folders.value) {
      selectedItems.value[folder.path] = new Set()
      if (!sortCriteria.value[folder.path] || sortCriteria.value[folder.path].length === 0) {
        sortCriteria.value[folder.path] = [{ field: 'name', order: 'asc' }]
      }
    }
    if (activeTab.value >= folders.value.length) activeTab.value = 0
  } catch (err) {
    error.value = 'Échec du chargement des dossiers : ' + err.message
    console.error(err)
  } finally {
    loading.value = false
  }
}

/**
 * Lazy-load items for a specific folder when its tab is selected.
 * Only loads if items haven't been loaded yet.
 */
async function loadFolderItems(folderPath) {
  if (foldersLoaded.value.has(folderPath)) return
  const folder = folders.value.find(f => f.path === folderPath)
  if (!folder) return

  loadingFolder.value = folderPath
  try {
    folder.items = await window.electronAPI.scanFolder(folderPath)
    foldersLoaded.value = new Set([...foldersLoaded.value, folderPath])
  } catch (err) {
    console.error('Failed to load items for', folderPath, err.message)
  } finally {
    loadingFolder.value = null
  }
}

/** Watch activeTab changes to lazy-load folder contents */
watch(activeTab, (newTab) => {
  if (folders.value[newTab]) {
    loadFolderItems(folders.value[newTab].path)
  }
})

async function loadDuplicateShortcuts() {
  loadingShortcuts.value = true
  try {
    duplicateShortcuts.value = await window.electronAPI.findDuplicateShortcuts()
    if (duplicateShortcuts.value.length > 0) showShortcutSection.value = true
  } catch (err) {
    console.error('Échec du chargement des raccourcis dupliqués :', err)
  } finally {
    loadingShortcuts.value = false
  }
}

async function checkRecycleBin() {
  try {
    const r = await window.electronAPI.isRecycleBinEmpty()
    if (r.success) { recycleBinEmpty.value = r.count === 0; recycleBinCount.value = r.count }
  } catch (e) { console.error(e) }
}

// ===== Selection =====
function toggleItem(folderPath, itemPath, event) {
  const set = selectedItems.value[folderPath]
  if (!set) return
  const folder = folders.value.find(f => f.path === folderPath)
  if (!folder) return

  if (event && event.shiftKey && lastClickedItemPath.value !== null) {
    const sorted = [...folder.items]
    const ci = sorted.findIndex(i => i.path === itemPath)
    const li = sorted.findIndex(i => i.path === lastClickedItemPath.value)
    if (ci >= 0 && li >= 0) {
      const [s, e] = [Math.min(ci, li), Math.max(ci, li)]
      for (let i = s; i <= e; i++) set.add(sorted[i].path)
      lastClickedItemPath.value = itemPath
      return
    }
  }

  if (set.has(itemPath)) set.delete(itemPath)
  else set.add(itemPath)
  lastClickedItemPath.value = itemPath
}

function onRowClick(folderPath, itemPath, event) {
  if (event.target.type === 'checkbox' || event.target.closest('label')) return
  toggleItem(folderPath, itemPath, event)
}

function toggleAll(fp, checked) {
  const f = folders.value.find(f => f.path === fp)
  if (!f) return
  const set = selectedItems.value[fp]
  if (!set) return
  if (checked) { for (const i of f.items) set.add(i.path) }
  else set.clear()
}

function unselectAll() {
  for (const f of folders.value) {
    const s = selectedItems.value[f.path]
    if (s) s.clear()
  }
  lastClickedItemPath.value = null
}

// ===== Sort =====
function toggleSort(fp, field, ev) {
  const c = sortCriteria.value[fp]
  if (!c) { sortCriteria.value[fp] = [{ field, order: 'asc' }]; return }
  const ei = c.findIndex(x => x.field === field)
  if (ev && ev.shiftKey) {
    if (ei >= 0) {
      const nc = [...c]
      nc[ei] = { field, order: nc[ei].order === 'asc' ? 'desc' : 'asc' }
      sortCriteria.value[fp] = nc
    } else {
      sortCriteria.value[fp] = [...c, { field, order: 'asc' }]
    }
    return
  }
  if (ei === 0) {
    const nc = [...c]
    if (nc[0].order === 'asc') { nc[0] = { field, order: 'desc' }; sortCriteria.value[fp] = nc }
    else sortCriteria.value[fp] = [{ field: 'name', order: 'asc' }]
  } else if (ei > 0) {
    sortCriteria.value[fp] = [{ field, order: 'asc' }, ...c.filter(x => x.field !== field)]
  } else {
    sortCriteria.value[fp] = [{ field, order: 'asc' }]
  }
}

// ===== Actions =====
async function doExecuteAction(action) {
  const selected = getAllSelected()
  if (selected.length === 0) { showResult('Aucun élément sélectionné', true); return }

  if (action === 'moveToFolder' && !moveDestination.value) {
    const dest = await window.electronAPI.selectDestinationFolder()
    if (!dest) return
    moveDestination.value = dest
  }

  const labels = { 
    trash: 'Mise à la corbeille', 
    delete: 'Suppression définitive', 
    moveToFolder: 'Déplacement' 
  }
  actionInProgress.value = true; operationResult.value = ''
  currentOperation.value = labels[action] + ' en cours...'
  const paths = selected.map(i => i.path)
  const freedBytes = selected.reduce((s, i) => s + i.size, 0)

  try {
    let results
    switch (action) {
      case 'trash': 
        results = await window.electronAPI.moveToTrash(paths); 
        break
      case 'delete': 
        results = await window.electronAPI.permanentDelete(paths); 
        break
      case 'moveToFolder': 
        results = await window.electronAPI.moveToFolder(paths, moveDestination.value); 
        moveDestination.value = ''; 
        break
      default: 
        currentOperation.value = ''; 
        return
    }
    const sc = results.filter(r => r.success).length
    const fc = results.filter(r => !r.success).length
    if (fc === 0) {
      showResult('Traitement réussi de ' + sc + ' élément(s)', false)
      updateSessionStats(sc, freedBytes)
    } else {
      showResult('Traitement de ' + sc + ' élément(s), ' + fc + ' échoué(s)', true)
      if (sc > 0) updateSessionStats(sc, freedBytes)
    }
    // Recharge les dossiers et leur contenu après modification
    await refreshAllData()
  } catch (err) {
    showResult('Erreur : ' + err.message, true)
  } finally {
    actionInProgress.value = false; currentOperation.value = ''
  }
}

async function executeAction(action) {
  const selected = getAllSelected()
  if (selected.length === 0) { 
    showResult('Aucun élément sélectionné', true); 
    return 
  }

  if (action === 'trash') {
    pendingTrashAction = selected
    trashConfirm.value = { 
      visible: true, 
      message: buildItemsPreview(selected)
    }
    return
  } else if (action === 'delete') {
    pendingDeleteAction = selected
    const challenge = deleteConfirmDialog.value?.generateChallenge('word')
    console.log('challenge', challenge)
    deleteConfirm.value = {
      visible: true,
      message: buildItemsPreview(selected),
      challenge: challenge
    }
    return
  }

  await doExecuteAction(action)
}

function onConfirmTrash() {
  trashConfirm.value.visible = false
  if (pendingTrashAction) {
    doExecuteAction('trash')
    pendingTrashAction = null
  }
}
function onCancelTrash() {
  trashConfirm.value.visible = false
  pendingTrashAction = null
}

function onConfirmDelete() {
  deleteConfirm.value = { visible: false, message: '', challenge: null }
  if (pendingDeleteAction) {
    doExecuteAction('delete')
    pendingDeleteAction = null
  }
}
function onCancelDelete() {
  deleteConfirm.value = { visible: false, message: '', challenge: null }
  pendingDeleteAction = null
}

async function archiveSelected() {
  const selected = getAllSelected()
  if (selected.length === 0) { showResult('Aucun élément sélectionné', true); return }
  if (!lastArchiveDest.value) {
    const d = await window.electronAPI.selectDestinationFolder()
    if (!d) return
    lastArchiveDest.value = d
  }
  actionInProgress.value = true; operationResult.value = ''
  currentOperation.value = 'Archivage en cours...'
  try {
    const r = await window.electronAPI.archiveTo7z(selected.map(i => i.path), lastArchiveDest.value)
    if (r.canceled) return
    if (r.success) showResult('Archive créée : ' + r.archivePath, false)
    else showResult("Erreur d'archivage : " + r.error, true)
  } catch (err) {
    showResult("Erreur d'archivage : " + err.message, true)
  } finally {
    actionInProgress.value = false; currentOperation.value = ''
  }
}

async function deleteSelectedShortcuts() {
  const sc = duplicateShortcuts.value.filter(s => s.selected)
  if (sc.length === 0) { showResult('Aucun raccourci dupliqué sélectionné', true); return }
  pendingShortcutAction = sc
  let msg = '🗑️ ' + sc.length + ' raccourci(s) dupliqué(s) :\n\n'
  for (const s of sc.slice(0, 5)) msg += '🔗 ' + s.name + '\n'
  if (sc.length > 5) msg += '... et ' + (sc.length - 5) + ' autre(s)\n'
  shortcutConfirm.value = { visible: true, message: msg }
}

function onConfirmShortcut() {
  shortcutConfirm.value.visible = false
  if (!pendingShortcutAction) return
  const sc = pendingShortcutAction
  pendingShortcutAction = null
  actionInProgress.value = true; currentOperation.value = 'Suppression des raccourcis...'
  doDeleteShortcuts(sc)
}
function onCancelShortcut() {
  shortcutConfirm.value.visible = false
  pendingShortcutAction = null
}

async function doDeleteShortcuts(sc) {
  try {
    const r = await window.electronAPI.deleteShortcuts(sc.map(s => s.path))
    showResult('Suppression de ' + r.filter(x => x.success).length + ' raccourci(s)', false)
    await refreshAllData()
  } catch (err) { showResult('Erreur : ' + err.message, true) }
  finally { actionInProgress.value = false; currentOperation.value = '' }
}

async function emptyRecycleBin() {
  recycleBinConfirm.value = {
    visible: true,
    message: 'La corbeille contient ' + recycleBinCount.value + ' élément' + (recycleBinCount.value !== 1 ? 's' : '') + '.\n\n⚠️ Attention : la suppression est définitive !',
    challenge: recycleBinConfirmDialog.value?.generateChallenge('word')
  }
}

function onConfirmRecycleBin() {
  recycleBinConfirm.value.visible = false
  actionInProgress.value = true; operationResult.value = ''; currentOperation.value = 'Vidage de la corbeille...'
  doEmptyRecycleBin()
}
function onCancelRecycleBin() {
  recycleBinConfirm.value.visible = false
}

async function doEmptyRecycleBin() {
  try {
    const r = await window.electronAPI.emptyRecycleBin()
    if (r.success) showResult('La corbeille a été vidée.', false)
    else showResult('Erreur : ' + r.error, true)
    await checkRecycleBin()
  } catch (err) { showResult('Erreur : ' + err.message, true) }
  finally { actionInProgress.value = false; currentOperation.value = '' }
}

function startDeleteConfirm() { deleteConfirmStep.value = 1; deleteConfirmText.value = '' }
function cancelDeleteConfirm() { deleteConfirmStep.value = 0; deleteConfirmText.value = '' }
function confirmDeleteProceed() {
  if (deleteConfirmText.value === 'SUPPRIMER') {
    cancelDeleteConfirm()
    doExecuteAction('delete')
  }
}

function openActiveFolderInExplorer() {
  if (!folders.value[activeTab.value]) return
  try { window.electronAPI.openInExplorer(folders.value[activeTab.value].path) } catch (e) { console.error(e) }
}

async function refreshAllData() {
  // Clear lazy-load cache so all folders reload on next tab click
  foldersLoaded.value = new Set()
  // Clear item arrays from all folders
  for (const f of folders.value) {
    f.items = []
  }
  await loadFolders()
  // Reload items for current active tab
  if (folders.value[activeTab.value]) {
    await loadFolderItems(folders.value[activeTab.value].path)
  }
  await loadDuplicateShortcuts()
  await checkRecycleBin()
}

// ===== Keyboard shortcuts =====
function handleKeydown(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return

  if (e.key === 'F5') { e.preventDefault(); refreshAllData(); return }
  if (e.key === 'Escape') {
    e.preventDefault()
    unselectAll()
    rawSearchQuery.value = ''
    closeContextMenu()
    cancelDeleteConfirm()
    return
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
    e.preventDefault()
    if (folders.value.length > 0 && activeTab.value < folders.value.length) {
      toggleAll(folders.value[activeTab.value].path, true)
    }
    return
  }
  if (e.key === 'Delete') {
    e.preventDefault()
    if (totalSelected.value > 0) executeAction('trash')
    return
  }
}

// ===== Context menu =====
function openContextMenu(event, item) {
  event.preventDefault(); event.stopPropagation()
  contextMenu.value = { visible: true, x: event.clientX, y: event.clientY, item }
}
function closeContextMenu() { contextMenu.value.visible = false }
async function contextAction(action) {
  const item = contextMenu.value.item
  closeContextMenu()
  if (!item) return
  if (action === 'open') { try { await window.electronAPI.openInSystem(item.path) } catch (e) { console.error(e) } }
  else if (action === 'explorer') { try { await window.electronAPI.openInExplorer(item.path) } catch (e) { console.error(e) } }
  else if (action === 'select') { if (folders.value[activeTab.value]) toggleItem(folders.value[activeTab.value].path, item.path) }
  else if (action === 'trash') {
    const folder = folders.value[activeTab.value]
    if (folder) {
      const set = selectedItems.value[folder.path]
      if (set) { set.clear(); set.add(item.path) }
      executeAction('trash')
    }
  }
}

// ===== Shortcut helpers for child components =====
function toggleShortcut(p) {
  const s = duplicateShortcuts.value.find(x => x.path === p)
  if (s) s.selected = !s.selected
}
function toggleAllShortcuts(c) {
  for (const s of duplicateShortcuts.value) s.selected = c
}

// ===== Lifecycle =====
function saveActiveTab() {
  localStorage.setItem('cleaner_activeTab', String(activeTab.value))
}
watch(activeTab, saveActiveTab)

onMounted(async () => {
  if (!initialLoadDone.value) {
    await loadFolders()
    await loadDuplicateShortcuts()
    await checkRecycleBin()
    initialLoadDone.value = true
    const savedTab = parseInt(localStorage.getItem('cleaner_activeTab'), 10)
    if (!isNaN(savedTab) && savedTab < folders.value.length) {
      activeTab.value = savedTab
    }
    // Load items for the initial active tab only
    if (folders.value[activeTab.value]) {
      await loadFolderItems(folders.value[activeTab.value].path)
    }
  }
  document.addEventListener('keydown', handleKeydown)
  document.addEventListener('click', closeContextMenu)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  document.removeEventListener('click', closeContextMenu)
})
</script>

<template>
  <div class="cleaner-view" @click="closeContextMenu">
    <div class="page-header">
      <h1>Folder Cleaner</h1>
      <p class="page-subtitle">Nettoyez vos dossiers standard. Les raccourcis (.lnk) sont automatiquement exclus.</p>
      <p class="sort-hint">
        <kbd>Shift</kbd>+clic = tri/plage &nbsp;|&nbsp;
        <kbd>Ctrl</kbd>+A = tout &nbsp;|&nbsp;
        <kbd>Suppr</kbd> = corbeille &nbsp;|&nbsp;
        <kbd>F5</kbd> = recharger &nbsp;|&nbsp;
        <kbd>Échap</kbd> = désélectionner &nbsp;|&nbsp;
        Clic droit = actions rapides
      </p>
    </div>

    <div v-if="operationResult" class="result-banner" :class="{ error: operationResult.isError }">
      <span>{{ operationResult.message }}</span>
    </div>

    <div v-if="error" class="error-banner"><span class="error-icon">!</span><span>{{ error }}</span></div>

    <!-- Skeleton loader -->
    <div v-if="loading && folders.length === 0" class="skeleton-state">
      <div class="skeleton-tabs"><div class="skel skel-tab" v-for="i in 3" :key="i"></div></div>
      <div class="skeleton-panel">
        <div class="skel skel-header"></div>
        <div class="skel skel-row" v-for="i in 6" :key="i" :style="{ width: (50 + Math.random() * 40) + '%' }"></div>
      </div>
      <p class="skel-text">Chargement des dossiers...</p>
    </div>

    <div v-if="loading && folders.length > 0" class="loading-overlay">
      <div class="spinner small-spinner"></div><span>Rechargement...</span>
    </div>

    <div class="page-actions">
      <button class="action-btn refresh-btn" :disabled="loading || actionInProgress" @click="refreshAllData" title="Recharger toutes les données (F5)">
        <span class="btn-icon">↻</span><span>{{ loading ? 'Rechargement...' : 'Recharger' }}</span>
      </button>
    </div>

    <div class="cleaner-layout">
      <div class="selection-panel">
        <!-- Tabs component -->
        <TabBar
          :folders="folders"
          :active-tab="activeTab"
          :selected-items="selectedItems"
          :get-tab-subtitle="getTabSubtitle"
          :get-selected-items-for-folder="getSelectedItemsForFolder"
          @update:activeTab="activeTab = $event"
        />

<template v-if="folders.length > 0">
  <!-- Loading state for current folder -->
  <div v-if="loadingFolder === folders[activeTab].path" class="loading-overlay inline">
    <div class="spinner small-spinner"></div><span>Chargement du contenu...</span>
  </div>

  <!-- Item list with virtual scroller -->
  <ItemList
    :folder="folders[activeTab]"
    :selected-items="selectedItems[folders[activeTab].path] || new Set()"
    :sort-criteria="sortCriteria[folders[activeTab].path] || []"
    :raw-search-query="rawSearchQuery"
    :date-filter="dateFilter"
    @toggle-item="(itemPath, event) => toggleItem(folders[activeTab].path, itemPath, event)"
    @toggle-all="(checked) => toggleAll(folders[activeTab].path, checked)"
    @toggle-sort="(field, event) => toggleSort(folders[activeTab].path, field, event)"
    @update:rawSearchQuery="rawSearchQuery = $event"
    @update:dateFilter="dateFilter = $event"
    @context-menu="(e, item) => openContextMenu(e, item)"
    @row-click="(itemPath, event) => onRowClick(folders[activeTab].path, itemPath, event)"
  />

          <!-- Recycle bin -->
          <RecycleBinBar
            :recycle-bin-empty="recycleBinEmpty"
            :recycle-bin-count="recycleBinCount"
            :action-in-progress="actionInProgress"
            @empty-recycle-bin="emptyRecycleBin"
          />

          <!-- Shortcuts section -->
          <ShortcutSection
            :duplicate-shortcuts="duplicateShortcuts"
            :loading-shortcuts="loadingShortcuts"
            :action-in-progress="actionInProgress"
            @toggle-shortcut="toggleShortcut"
            @toggle-all-shortcuts="toggleAllShortcuts"
            @delete-selected-shortcuts="deleteSelectedShortcuts"
          />
        </template>

        <div v-if="folders.length === 0 && !loading" class="empty-state no-folders">
          <span class="empty-icon">📁</span>
          <span class="empty-text">Aucun dossier trouvé. Vérifiez la configuration ou rechargez.</span>
        </div>
      </div>

      <!-- Action panel (right sidebar) -->
      <ActionPanel
        :total-selected="totalSelected"
        :total-selected-size="totalSelectedSize"
        :current-operation="currentOperation"
        :action-in-progress="actionInProgress"
        :session-stats="sessionStats"
        :delete-confirm-step="deleteConfirmStep"
        :delete-confirm-text="deleteConfirmText"
        @unselect-all="unselectAll"
        @archive-selected="archiveSelected"
        @move-to-folder="executeAction('moveToFolder')"
        @trash="executeAction('trash')"
        @delete="executeAction('delete')"
        @confirm-delete="confirmDeleteProceed"
        @cancel-delete="cancelDeleteConfirm"
        @update:deleteConfirmText="deleteConfirmText = $event"
      />
    </div>

    <!-- Context menu -->
    <ContextMenu
      :visible="contextMenu.visible"
      :x="contextMenu.x"
      :y="contextMenu.y"
      :item="contextMenu.item"
      @close="closeContextMenu"
      @action="contextAction"
    />

    <!-- Confirm dialogs (#17) -->
    <ConfirmDialog
      :visible="trashConfirm.visible"
      title="🗑️ Mettre à la corbeille ?"
      :message="trashConfirm.message"
      confirm-text="Mettre à la corbeille"
      danger
      @confirm="onConfirmTrash"
      @cancel="onCancelTrash"
    />

    <ConfirmDialog
      :visible="shortcutConfirm.visible"
      title="🗑️ Supprimer les raccourcis ?"
      :message="shortcutConfirm.message"
      confirm-text="Supprimer"
      danger
      @confirm="onConfirmShortcut"
      @cancel="onCancelShortcut"
    />

    <ConfirmDialog
      ref="recycleBinConfirmDialog"
      :visible="recycleBinConfirm.visible"
      title="🗑️ Vider la corbeille ?"
      :message="recycleBinConfirm.message"
      :challenge="recycleBinConfirm.challenge"
      confirm-text="Vider la corbeille"
      cancel-text="Annuler"
      danger
      @confirm="onConfirmRecycleBin"
      @cancel="onCancelRecycleBin"
    />

    <ConfirmDialog
      ref="deleteConfirmDialog"
      :visible="deleteConfirm.visible"
      title="⚠️ Suppression définitive"
      :message="deleteConfirm.message"
      :challenge="deleteConfirm.challenge"
      confirm-text="Confirmer"
      cancel-text="Annuler"
      danger
      @confirm="onConfirmDelete"
      @cancel="onCancelDelete"
    />
  </div>
</template>

<style scoped>
.cleaner-view { min-height: 400px; width: 100%; overflow-x: hidden; }
.page-header { margin-bottom: 24px; }
.page-header h1 { font-size: 1.6rem; color: var(--text-primary, #fff); margin-bottom: 8px; }
.page-subtitle { color: var(--text-muted, #888); font-size: 0.9rem; line-height: 1.5; }
.sort-hint { color: var(--text-dim, #666); font-size: 0.8rem; margin-top: 4px; }
.sort-hint kbd { background: var(--bg-tertiary, #2a2a3e); border: 1px solid #3a3a5e; border-radius: 3px; padding: 1px 5px; font-size: 0.75rem; color: #aaa; font-family: inherit; }

.result-banner { background: #1a3a1a; border: 1px solid #27ae60; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; color: #6fcf97; font-size: 0.9rem; }
.result-banner.error { background: #3d1a1a; border-color: #e74c3c; color: #ff6b6b; }
.error-banner { background: #3d1a1a; border: 1px solid #e74c3c; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; display: flex; align-items: center; gap: 10px; color: #ff6b6b; font-size: 0.9rem; }
.error-icon { font-size: 1.2rem; }

.cleaner-layout { display: grid; grid-template-columns: 1fr 260px; gap: 20px; align-items: start; }

@media (max-width: 900px) {
  .cleaner-layout { grid-template-columns: 1fr; }
  .selection-panel { padding-bottom: 80px; }
}

.selection-panel { min-width: 0; overflow: hidden; }

.page-actions { display: flex; justify-content: flex-end; margin-bottom: 16px; }
.refresh-btn { display: flex; align-items: center; gap: 8px; padding: 8px 18px; background: #1a2a3d; border: 1px solid #2a4a5e; border-radius: 6px; color: #6fa8cf; font-size: 0.85rem; font-weight: 600; cursor: pointer; transition: all 0.2s; }
.refresh-btn:hover:not(:disabled) { background: #1a3a4a; border-color: #3a6a8e; color: #7fc0e0; }
.refresh-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.loading-overlay { position: fixed; top: 70px; right: 20px; display: flex; align-items: center; gap: 10px; padding: 10px 16px; background: var(--bg-secondary, #1a1a2e); border: 1px solid #6c63ff; border-radius: 8px; color: #6c63ff; font-size: 0.8rem; font-weight: 600; z-index: 1000; box-shadow: 0 4px 16px rgba(0,0,0,0.4); animation: overlay-in 0.3s ease-out; }
@keyframes overlay-in { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
.small-spinner { width: 18px; height: 18px; border-width: 2px; }

.spinner { width: 40px; height: 40px; border: 4px solid #2a2a3e; border-top-color: #6c63ff; border-radius: 50%; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.skeleton-state { padding: 20px 0; }
.skeleton-tabs { display: flex; gap: 8px; margin-bottom: 12px; }
.skel { background: linear-gradient(90deg, #1a1a2e 25%, #252540 50%, #1a1a2e 75%); background-size: 200% 100%; animation: skel-shimmer 1.5s infinite; border-radius: 6px; }
@keyframes skel-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
.skel-tab { width: 80px; height: 36px; flex-shrink: 0; }
.skel-header { height: 20px; width: 60%; margin-bottom: 12px; }
.skel-row { height: 32px; margin-bottom: 8px; }
.skeleton-panel { background: var(--bg-secondary, #1a1a2e); border: 1px solid var(--border-color, #2a2a3e); border-radius: 10px; padding: 16px; margin-bottom: 16px; }
.skel-text { color: #888; font-size: 0.85rem; text-align: center; margin-top: 12px; }

.empty-state { padding: 48px 8px; text-align: center; }
.empty-icon { font-size: 2rem; display: block; margin-bottom: 8px; }
.empty-text { color: var(--text-dim, #666); font-size: 0.9rem; }
.no-folders { background: var(--bg-secondary, #1a1a2e); border: 1px solid var(--border-color, #2a2a3e); border-radius: 10px; margin-bottom: 24px; }
</style>