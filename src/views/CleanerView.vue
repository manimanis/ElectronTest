<script setup>
/**
 * CleanerView.vue - Folder cleaning page
 * Supports: trash, permanent delete, move, archive, search, sort, date filter
 * Keyboard shortcuts, range selection, context menu, session stats
 * Debounced search, Ctrl+clic, tab persistence, enhanced badges, tooltips, double confirm
 */
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { formatSize } from '../utils/format'

const folders = ref([])
const loading = ref(true)
const initialLoadDone = ref(false)
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
const sortCriteria = ref({})
const rawSearchQuery = ref('')
const searchQuery = ref('')
const lastClickedItemPath = ref(null)
const currentOperation = ref('')
const dateFilter = ref('all')
const sessionStats = ref({ itemsCleaned: 0, spaceFreed: 0, operationCount: 0 })
const contextMenu = ref({ visible: false, x: 0, y: 0, item: null })
// #21: Duplicate files detection
const duplicateFiles = ref([])
const loadingDuplicates = ref(false)
const showDuplicateSection = ref(false)
// Double confirmation for permanent delete
const deleteConfirmStep = ref(0) // 0: none, 1: first confirm, 2: typing confirm
const deleteConfirmText = ref('')
// Debounce timer
let searchDebounceTimer = null

// #29: Debounce search input (300ms)
watch(rawSearchQuery, (val) => {
  clearTimeout(searchDebounceTimer)
  searchDebounceTimer = setTimeout(() => {
    searchQuery.value = val
  }, 300)
})

// #34: Persist active tab
function saveActiveTab() {
  localStorage.setItem('cleaner_activeTab', String(activeTab.value))
}

onMounted(async () => {
  if (!initialLoadDone.value) {
    await loadFolders()
    await loadDuplicateShortcuts()
    await loadDuplicateFiles()
    await checkRecycleBin()
    initialLoadDone.value = true
    // Restore persisted tab
    const savedTab = parseInt(localStorage.getItem('cleaner_activeTab'), 10)
    if (!isNaN(savedTab) && savedTab < folders.value.length) {
      activeTab.value = savedTab
    }
  }
  document.addEventListener('keydown', handleKeydown)
  document.addEventListener('click', closeContextMenu)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  document.removeEventListener('click', closeContextMenu)
  clearTimeout(searchDebounceTimer)
})

watch(activeTab, saveActiveTab)

function handleKeydown(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return

  if (e.key === 'F5') { e.preventDefault(); refreshAllData(); return }
  if (e.key === 'Escape') { e.preventDefault(); unselectAll(); rawSearchQuery.value = ''; searchQuery.value = ''; closeContextMenu(); cancelDeleteConfirm(); return }
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
  const item = contextMenu.value.item; closeContextMenu()
  if (!item) return
  if (action === 'open') { try { await window.electronAPI.openInSystem(item.path) } catch(e) { console.error(e) } }
  else if (action === 'explorer') { try { await window.electronAPI.openInExplorer(item.path) } catch(e) { console.error(e) } }
  else if (action === 'select') { if (folders.value[activeTab.value]) toggleItem(folders.value[activeTab.value].path, item.path) }
  else if (action === 'trash') {
    const folder = folders.value[activeTab.value]
    if (folder) { const set = selectedItems.value[folder.path]; if (set) { set.clear(); set.add(item.path) }; executeAction('trash') }
  }
}

// ===== Double confirmation for delete =====
function startDeleteConfirm() { deleteConfirmStep.value = 1; deleteConfirmText.value = '' }
function cancelDeleteConfirm() { deleteConfirmStep.value = 0; deleteConfirmText.value = '' }
function confirmDeleteProceed() {
  if (deleteConfirmText.value === 'SUPPRIMER') {
    cancelDeleteConfirm()
    doExecuteAction('delete')
  }
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
  } catch (err) { error.value = 'Échec du chargement des dossiers : ' + err.message; console.error(err) }
  finally { loading.value = false }
}

async function loadDuplicateShortcuts() {
  loadingShortcuts.value = true
  try { duplicateShortcuts.value = await window.electronAPI.findDuplicateShortcuts(); if (duplicateShortcuts.value.length > 0) showShortcutSection.value = true }
  catch (err) { console.error('Échec du chargement des raccourcis dupliqués :', err) }
  finally { loadingShortcuts.value = false }
}

function getAllSelected() {
  const all = []
  for (const folder of folders.value) {
    const set = selectedItems.value[folder.path] || new Set()
    for (const item of folder.items) { if (set.has(item.path)) all.push(item) }
  }
  return all
}

function getSelectedItemsForFolder(fp) {
  const f = folders.value.find(f => f.path === fp); if (!f) return []
  const set = selectedItems.value[fp] || new Set()
  return f.items.filter(i => set.has(i.path))
}

// #32: Ctrl+clic — click row toggles item, shift+click for range
function toggleItem(folderPath, itemPath, event) {
  const set = selectedItems.value[folderPath]; if (!set) return
  const folder = folders.value.find(f => f.path === folderPath); if (!folder) return
  if (event && event.shiftKey && lastClickedItemPath.value !== null) {
    const sorted = getSortedItems(folder)
    const ci = sorted.findIndex(i => i.path === itemPath)
    const li = sorted.findIndex(i => i.path === lastClickedItemPath.value)
    if (ci >= 0 && li >= 0) {
      const [s, e] = [Math.min(ci, li), Math.max(ci, li)]
      for (let i = s; i <= e; i++) set.add(sorted[i].path)
      lastClickedItemPath.value = itemPath; return
    }
  }
  if (set.has(itemPath)) set.delete(itemPath); else set.add(itemPath)
  lastClickedItemPath.value = itemPath
}

// #32: Click on row (not checkbox) — supports Ctrl+clic for non-contiguous selection
function onRowClick(folderPath, itemPath, event) {
  // Only handle clicks directly on the row or item-name, not on checkboxes
  if (event.target.type === 'checkbox' || event.target.closest('label')) return
  toggleItem(folderPath, itemPath, event)
}

function toggleAll(fp, checked) {
  const f = folders.value.find(f => f.path === fp); if (!f) return
  const set = selectedItems.value[fp]; if (!set) return
  if (checked) { for (const i of getSortedItems(f)) set.add(i.path) } else set.clear()
}

function unselectAll() {
  for (const f of folders.value) { const s = selectedItems.value[f.path]; if (s) s.clear() }
  lastClickedItemPath.value = null
}

const totalSelected = computed(() => { let c = 0; for (const f of folders.value) { const s = selectedItems.value[f.path]; if (s) c += s.size }; return c })
const totalSelectedSize = computed(() => {
  let t = 0
  for (const f of folders.value) { const s = selectedItems.value[f.path]; if (s) { for (const i of f.items) { if (s.has(i.path)) t += i.size } } }
  return formatSize(t)
})

function showResult(message, isError = false) {
  operationResult.value = { message, isError }
  setTimeout(() => { operationResult.value = '' }, 4000)
}

function buildItemsPreview(items) {
  const max = 5, fc = items.filter(i => i.isDirectory).length, fic = items.length - fc
  const tb = items.reduce((s, i) => s + i.size, 0)
  let m = items.length + ' élément' + (items.length > 1 ? 's' : '') + ' (' + formatSize(tb) + ')'
  if (fc > 0 && fic > 0) m += '\n  ' + fc + ' dossier' + (fc > 1 ? 's' : '') + ', ' + fic + ' fichier' + (fic > 1 ? 's' : '')
  else if (fc > 0) m += '\n  ' + fc + ' dossier' + (fc > 1 ? 's' : '')
  m += '\n\n'
  for (const i of items.slice(0, max)) { m += (i.isDirectory ? '📁' : '📄') + ' ' + i.name; if (!i.isDirectory) m += ' (' + i.formattedSize + ')'; m += '\n' }
  if (items.length > max) m += '... et ' + (items.length - max) + ' autre(s)\n'
  return m
}

function updateSessionStats(count, bytes) { sessionStats.value.itemsCleaned += count; sessionStats.value.spaceFreed += bytes; sessionStats.value.operationCount++ }

async function executeAction(action) {
  const selected = getAllSelected()
  if (selected.length === 0) { showResult('Aucun élément sélectionné', true); return }

  if (action === 'trash') {
    if (!confirm('🗑️ Mettre à la corbeille ?\n\n' + buildItemsPreview(selected))) return
  } else if (action === 'delete') {
    // #25: Double confirmation — step 1
    startDeleteConfirm()
    return
  }

  await doExecuteAction(action)
}

async function doExecuteAction(action) {
  const selected = getAllSelected()
  if (selected.length === 0) { showResult('Aucun élément sélectionné', true); return }

  if (action === 'moveToFolder' && !moveDestination.value) {
    const dest = await window.electronAPI.selectDestinationFolder(); if (!dest) return; moveDestination.value = dest
  }

  const labels = { trash: 'Mise à la corbeille', delete: 'Suppression définitive', moveToFolder: 'Déplacement' }
  actionInProgress.value = true; operationResult.value = ''
  currentOperation.value = labels[action] + ' en cours...'
  const paths = selected.map(i => i.path)
  const freedBytes = selected.reduce((s, i) => s + i.size, 0)
  try {
    let results
    switch (action) {
      case 'trash': results = await window.electronAPI.moveToTrash(paths); break
      case 'delete': results = await window.electronAPI.permanentDelete(paths); break
      case 'moveToFolder': results = await window.electronAPI.moveToFolder(paths, moveDestination.value); moveDestination.value = ''; break
      default: currentOperation.value = ''; return
    }
    const sc = results.filter(r => r.success).length, fc = results.filter(r => !r.success).length
    if (fc === 0) { showResult('Traitement réussi de ' + sc + ' élément(s)', false); updateSessionStats(sc, freedBytes) }
    else { showResult('Traitement de ' + sc + ' élément(s), ' + fc + ' échoué(s)', true); if (sc > 0) updateSessionStats(sc, freedBytes) }
    await loadFolders()
  } catch (err) { showResult('Erreur : ' + err.message, true) }
  finally { actionInProgress.value = false; currentOperation.value = '' }
}

async function archiveSelected() {
  const selected = getAllSelected()
  if (selected.length === 0) { showResult('Aucun élément sélectionné', true); return }
  if (!lastArchiveDest.value) { const d = await window.electronAPI.selectDestinationFolder(); if (!d) return; lastArchiveDest.value = d }
  actionInProgress.value = true; operationResult.value = ''; currentOperation.value = 'Archivage en cours...'
  try {
    const r = await window.electronAPI.archiveTo7z(selected.map(i => i.path), lastArchiveDest.value)
    if (r.canceled) return
    if (r.success) showResult('Archive créée : ' + r.archivePath, false); else showResult('Erreur d\'archivage : ' + r.error, true)
  } catch (err) { showResult('Erreur d\'archivage : ' + err.message, true) }
  finally { actionInProgress.value = false; currentOperation.value = '' }
}

async function deleteSelectedShortcuts() {
  const sc = duplicateShortcuts.value.filter(s => s.selected)
  if (sc.length === 0) { showResult('Aucun raccourci dupliqué sélectionné', true); return }
  let msg = '🗑️ Supprimer ' + sc.length + ' raccourci(s) dupliqué(s) ?\n\n'
  for (const s of sc.slice(0, 5)) msg += '🔗 ' + s.name + '\n'
  if (sc.length > 5) msg += '... et ' + (sc.length - 5) + ' autre(s)\n'
  if (!confirm(msg)) return
  actionInProgress.value = true; currentOperation.value = 'Suppression des raccourcis...'
  try { const r = await window.electronAPI.deleteShortcuts(sc.map(s => s.path)); showResult('Suppression de ' + r.filter(x => x.success).length + ' raccourci(s)', false); await loadDuplicateShortcuts(); await loadFolders() }
  catch (err) { showResult('Erreur : ' + err.message, true) }
  finally { actionInProgress.value = false; currentOperation.value = '' }
}

function toggleShortcut(p) { const s = duplicateShortcuts.value.find(x => x.path === p); if (s) s.selected = !s.selected }
function toggleAllShortcuts(c) { for (const s of duplicateShortcuts.value) s.selected = c }

async function openActiveFolderInExplorer() {
  if (!folders.value[activeTab.value]) return
  try { await window.electronAPI.openInExplorer(folders.value[activeTab.value].path) } catch (e) { console.error(e) }
}

function isWithinDateFilter(modifiedAt) {
  if (dateFilter.value === 'all' || !modifiedAt) return true
  const diff = Date.now() - new Date(modifiedAt).getTime(), d = 86400000
  switch (dateFilter.value) { case '7d': return diff <= 7*d; case '30d': return diff <= 30*d; case '90d': return diff <= 90*d; case '1y': return diff <= 365*d; default: return true }
}

const duplicateNames = computed(() => { const n = new Map(), dp = new Set(); for (const f of folders.value) { if (n.has(f.name)) { dp.add(f.path); dp.add(n.get(f.name)) } else n.set(f.name, f.path) }; return dp })
function getTabSubtitle(f) {
  if (!duplicateNames.value.has(f.path)) return ''
  const p = f.path.replace(/\\/g, '/').split('/').filter(Boolean)
  if (p.length >= 3) { const dr = p[0].endsWith(':') ? p[0] : ''; const l = p.slice(-2); return dr ? `${dr}/.../${l.join('/')}` : `.../${l.join('/')}` }
  return f.path
}
const recycleBinLabel = computed(() => recycleBinEmpty.value ? 'La corbeille est vide.' : 'La corbeille contient ' + recycleBinCount.value + ' élément' + (recycleBinCount.value !== 1 ? 's' : '') + '.')
function getFileType(i) { if (i.isDirectory) return 'folder'; const e = i.name.includes('.') ? i.name.split('.').pop().toLowerCase() : ''; return e || 'file' }

function compareByField(a, b, f) {
  if (a.isDirectory && !b.isDirectory) return -1; if (!a.isDirectory && b.isDirectory) return 1
  if (f === 'name') return a.name.localeCompare(b.name)
  if (f === 'size') return a.size - b.size
  if (f === 'type') { const c = getFileType(a).localeCompare(getFileType(b)); return c !== 0 ? c : a.name.localeCompare(b.name) }
  return 0
}

function getFilteredItems(items) {
  let r = items
  const q = searchQuery.value.trim().toLowerCase()
  if (q) r = r.filter(i => i.name.toLowerCase().includes(q))
  if (dateFilter.value !== 'all') r = r.filter(i => isWithinDateFilter(i.modifiedAt))
  return r
}

function getSortedItems(folder) {
  const c = sortCriteria.value[folder.path]; let items
  if (!c || c.length === 0) items = [...folder.items]
  else { items = [...folder.items]; items.sort((a, b) => { for (const cr of c) { let cmp = compareByField(a, b, cr.field); if (cr.order === 'desc') cmp = -cmp; if (cmp !== 0) return cmp }; return 0 }) }
  return getFilteredItems(items)
}

function isSortedBy(fp, f) { const c = sortCriteria.value[fp]; return c ? c.some(x => x.field === f) : false }
function getSortOrder(fp, f) { const c = sortCriteria.value[fp]; if (!c) return null; const x = c.find(x => x.field === f); return x ? x.order : null }
function getSortPriority(fp, f) { const c = sortCriteria.value[fp]; if (!c) return 0; const i = c.findIndex(x => x.field === f); return i >= 0 ? i + 1 : 0 }

function toggleSort(fp, f, ev) {
  const c = sortCriteria.value[fp]; if (!c) { sortCriteria.value[fp] = [{ field: f, order: 'asc' }]; return }
  const ei = c.findIndex(x => x.field === f)
  if (ev && ev.shiftKey) { if (ei >= 0) { const nc = [...c]; nc[ei] = { field: f, order: nc[ei].order === 'asc' ? 'desc' : 'asc' }; sortCriteria.value[fp] = nc } else sortCriteria.value[fp] = [...c, { field: f, order: 'asc' }] ; return }
  if (ei === 0) { const nc = [...c]; if (nc[0].order === 'asc') { nc[0] = { field: f, order: 'desc' }; sortCriteria.value[fp] = nc } else sortCriteria.value[fp] = [{ field: 'name', order: 'asc' }] }
  else if (ei > 0) { sortCriteria.value[fp] = [{ field: f, order: 'asc' }, ...c.filter(x => x.field !== f)] }
  else sortCriteria.value[fp] = [{ field: f, order: 'asc' }]
}

async function checkRecycleBin() { try { const r = await window.electronAPI.isRecycleBinEmpty(); if (r.success) { recycleBinEmpty.value = r.count === 0; recycleBinCount.value = r.count } } catch (e) { console.error(e) } }

async function emptyRecycleBin() {
  if (!confirm('🗑️ Vider la corbeille ?\n\nLa corbeille contient ' + recycleBinCount.value + ' élément' + (recycleBinCount.value !== 1 ? 's' : '') + '.\n\n⚠️ Attention : la suppression est définitive !')) return
  actionInProgress.value = true; operationResult.value = ''; currentOperation.value = 'Vidage de la corbeille...'
  try { const r = await window.electronAPI.emptyRecycleBin(); if (r.success) showResult('La corbeille a été vidée.', false); else showResult('Erreur : ' + r.error, true); await checkRecycleBin() }
  catch (err) { showResult('Erreur : ' + err.message, true) }
  finally { actionInProgress.value = false; currentOperation.value = '' }
}

async function loadDuplicateFiles() {
  loadingDuplicates.value = true
  try {
    duplicateFiles.value = await window.electronAPI.findDuplicateFiles()
    if (duplicateFiles.value.length > 0) showDuplicateSection.value = true
  } catch (err) { console.error('Erreur chargement doublons:', err) }
  finally { loadingDuplicates.value = false }
}

async function refreshAllData() { await loadFolders(); await loadDuplicateShortcuts(); await loadDuplicateFiles(); await checkRecycleBin() }
</script>

<template>
  <div class="cleaner-view" @click="closeContextMenu">
    <div class="page-header">
      <h1>Folder Cleaner</h1>
      <p class="page-subtitle">Nettoyez vos dossiers standard. Les raccourcis (.lnk) sont automatiquement exclus.</p>
      <p class="sort-hint">
        <kbd>Shift</kbd>+clic = tri/plage &nbsp;|&nbsp;
        <kbd>Ctrl</kbd>+clic = sélection &nbsp;|&nbsp;
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
    <!-- #6: Skeleton loader on initial load -->
    <div v-if="loading && folders.length === 0" class="skeleton-state">
      <div class="skeleton-tabs"><div class="skel skel-tab" v-for="i in 3" :key="i"></div></div>
      <div class="skeleton-panel">
        <div class="skel skel-header"></div>
        <div class="skel skel-row" v-for="i in 6" :key="i" :style="{ width: (50 + Math.random() * 40) + '%' }"></div>
      </div>
      <p class="skel-text">Chargement des dossiers...</p>
    </div>
    <div v-if="loading && folders.length > 0" class="loading-overlay"><div class="spinner small-spinner"></div><span>Rechargement...</span></div>

    <div class="page-actions">
      <button class="action-btn refresh-btn" :disabled="loading || actionInProgress" @click="refreshAllData" title="Recharger toutes les données (F5)">
        <span class="btn-icon">&#x21BB;</span><span>{{ loading ? 'Rechargement...' : 'Recharger' }}</span>
      </button>
    </div>

    <div class="cleaner-layout">
      <div class="selection-panel">
        <div class="tabs-bar">
          <button v-for="(folder, index) in folders" :key="folder.path" class="tab-btn"
            :class="{ active: activeTab === index }" @click="activeTab = index">
            <span class="tab-icon">&#x1F4C1;</span>
            <span class="tab-label">{{ folder.name }}</span>
            <span v-if="getTabSubtitle(folder)" class="tab-subtitle" :title="folder.path">{{ getTabSubtitle(folder) }}</span>
            <span class="tab-count" :class="{ 'has-selection': getSelectedItemsForFolder(folder.path).length > 0 }">
              <template v-if="getSelectedItemsForFolder(folder.path).length > 0">
                {{ getSelectedItemsForFolder(folder.path).length }}<span class="tab-count-sep">/</span>{{ folder.items.length }}
              </template>
              <template v-else>{{ folder.items.length }}</template>
            </span>
          </button>
        </div>

        <template v-if="folders.length > 0">
          <div class="folder-panel">
            <div class="folder-panel-header">
              <p class="active-folder-info"><strong>Dossier actif :</strong> {{ folders[activeTab].path }}</p>
              <button class="open-explorer-btn" @click="openActiveFolderInExplorer" title="Ouvrir ce dossier dans l'Explorateur Windows">
                <span>&#x1F4C2;</span><span class="open-explorer-label">Ouvrir</span>
              </button>
            </div>
            <div class="folder-sort">
              <button v-for="field in ['name', 'size', 'type']" :key="field" class="sort-btn" :class="{
                active: isSortedBy(folders[activeTab].path, field),
                'sort-primary': getSortPriority(folders[activeTab].path, field) === 1,
                'sort-secondary': getSortPriority(folders[activeTab].path, field) === 2,
                'sort-tertiary': getSortPriority(folders[activeTab].path, field) === 3
              }" @click="toggleSort(folders[activeTab].path, field, $event)"
              :title="'Trier par ' + field + (event && event.shiftKey ? ' (secondaire)' : '')">
                <span class="sort-label">{{ field === 'name' ? 'Nom' : field === 'size' ? 'Taille' : 'Type' }}</span>
                <span class="sort-icon">
                  <template v-if="getSortPriority(folders[activeTab].path, field) > 0">
                    {{ getSortOrder(folders[activeTab].path, field) === 'asc' ? '▲' : '▼' }}
                    <span class="sort-priority">{{ getSortPriority(folders[activeTab].path, field) }}</span>
                  </template>
                  <template v-else>&#x21C5;</template>
                </span>
              </button>
            </div>

            <div v-if="folders[activeTab].items.length > 0" class="filter-row">
              <div class="search-bar">
                <span class="search-icon">&#x1F50D;</span>
                <input type="text" class="search-input" v-model="rawSearchQuery" placeholder="Filtrer par nom..." />
                <button v-if="rawSearchQuery" class="search-clear" @click="rawSearchQuery = ''; searchQuery = ''" title="Effacer le filtre">✕</button>
              </div>
              <div class="date-filter">
                <button v-for="opt in [{v:'all',l:'Tout'},{v:'7d',l:'7j'},{v:'30d',l:'30j'},{v:'90d',l:'90j'},{v:'1y',l:'1an'}]"
                  :key="opt.v" class="date-btn" :class="{ active: dateFilter === opt.v }" @click="dateFilter = opt.v"
                  :title="'Afficher les éléments modifiés il y a ' + opt.l">{{ opt.l }}</button>
              </div>
            </div>

            <div v-if="folders[activeTab].items.length > 0" class="select-all-row">
              <label class="checkbox-label select-all">
                <input type="checkbox"
                  :checked="getSelectedItemsForFolder(folders[activeTab].path).length === folders[activeTab].items.length && folders[activeTab].items.length > 0"
                  :indeterminate="getSelectedItemsForFolder(folders[activeTab].path).length > 0 && getSelectedItemsForFolder(folders[activeTab].path).length < folders[activeTab].items.length"
                  @change="toggleAll(folders[activeTab].path, $event.target.checked)" />
                <span>Sélectionner tout</span>
                <span v-if="rawSearchQuery || dateFilter !== 'all'" class="filter-info">
                  ({{ getSortedItems(folders[activeTab]).length }}/{{ folders[activeTab].items.length }} affiché(s))
                </span>
              </label>
            </div>

            <div v-if="folders[activeTab].items.length > 0" class="items-list">
              <div v-for="item in getSortedItems(folders[activeTab])" :key="item.path" class="item-row"
                :class="{ selected: selectedItems[folders[activeTab].path]?.has(item.path) }"
                @contextmenu="openContextMenu($event, item)"
                @click="onRowClick(folders[activeTab].path, item.path, $event)">
                <label class="checkbox-label" @click.stop>
                  <input type="checkbox" :checked="selectedItems[folders[activeTab].path]?.has(item.path) || false"
                    @change="toggleItem(folders[activeTab].path, item.path, $event)" />
                  <span class="item-icon">{{ item.isDirectory ? '&#x1F4C2;' : '&#x1F4C4;' }}</span>
                  <span class="item-name">{{ item.name }}</span>
                </label>
                <span class="item-size">{{ item.formattedSize }}</span>
              </div>
            </div>

            <div v-else-if="rawSearchQuery || dateFilter !== 'all'" class="empty-state">
              <span class="empty-text">Aucun résultat avec les filtres actifs</span>
            </div>
            <div v-else class="empty-state">
              <span class="empty-text">Ce dossier est vide ou ne contient que des raccourcis</span>
            </div>
          </div>
        </template>

        <div v-if="folders.length === 0 && !loading" class="empty-state no-folders">
          <span class="empty-icon">&#x1F4C1;</span>
          <span class="empty-text">Aucun dossier trouvé. Vérifiez la configuration ou rechargez.</span>
        </div>

        <div class="recycle-bin-bar" :class="{ 'recycle-empty': recycleBinEmpty }">
          <div class="recycle-bin-info"><span class="recycle-icon">&#x1F5D1;</span><span>{{ recycleBinLabel }}</span></div>
          <button class="action-btn recycle-btn" :disabled="actionInProgress || recycleBinEmpty" @click="emptyRecycleBin"
            title="Vider définitivement toute la corbeille Windows">Vider la corbeille</button>
        </div>

        <div v-if="showShortcutSection && duplicateShortcuts.length > 0" class="shortcuts-section">
          <div class="section-header">
            <h2>Raccourcis dupliqués sur le bureau</h2>
            <p class="section-subtitle">Conservez le plus récent et supprimez les doublons.</p>
          </div>
          <div v-if="loadingShortcuts" class="loading-state small"><div class="spinner"></div><p>Recherche...</p></div>
          <template v-if="!loadingShortcuts">
            <div class="shortcut-toolbar">
              <label class="checkbox-label select-all">
                <input type="checkbox" :checked="duplicateShortcuts.length > 0 && duplicateShortcuts.every(s => s.selected)" @change="toggleAllShortcuts($event.target.checked)" />
                <span>Sélectionner tous les doublons</span>
              </label>
              <button class="action-btn delete-btn small" :disabled="actionInProgress || duplicateShortcuts.every(s => !s.selected)" @click="deleteSelectedShortcuts"
                title="Supprimer les raccourcis sélectionnés">Supprimer la sélection</button>
            </div>
            <div class="shortcuts-list">
              <div v-for="sc in duplicateShortcuts" :key="sc.path" class="shortcut-row" :class="{ selected: sc.selected }">
                <label class="checkbox-label">
                  <input type="checkbox" :checked="sc.selected || false" @change="toggleShortcut(sc.path)" />
                  <span class="item-icon">&#x1F517;</span><span class="item-name">{{ sc.name }}</span>
                </label>
                <span class="item-size">{{ sc.targetName }}</span>
              </div>
            </div>
          </template>
        </div>

        <!-- #21: Duplicate files section -->
        <div v-if="showDuplicateSection && duplicateFiles.length > 0" class="duplicates-section">
          <div class="section-header">
            <h2>📋 Fichiers en double</h2>
            <p class="section-subtitle">Ces fichiers portent le même nom dans plusieurs dossiers configurés.</p>
          </div>
          <div v-if="loadingDuplicates" class="loading-state small"><div class="spinner"></div><p>Recherche...</p></div>
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
      </div>

      <!-- ===== RIGHT PANEL ===== -->
      <div class="action-panel">
        <div class="selection-info-box">
          <span class="selection-label">Sélection</span>
          <span class="selection-count">{{ totalSelected }} élément(s)</span>
          <span class="selection-size">{{ totalSelectedSize }}</span>
        </div>

        <div v-if="currentOperation" class="operation-indicator">
          <div class="spinner tiny-spinner"></div><span class="operation-label">{{ currentOperation }}</span>
        </div>

        <div v-if="sessionStats.operationCount > 0" class="session-stats">
          <span class="stats-label">📊 Session</span>
          <span class="stats-detail">{{ sessionStats.operationCount }} opération(s) — {{ sessionStats.itemsCleaned }} élément(s) — {{ formatSize(sessionStats.spaceFreed) }}</span>
        </div>

        <!-- #25: Double confirmation for delete -->
        <div v-if="deleteConfirmStep === 1" class="delete-confirm-box">
          <p class="confirm-title">⚠️ Suppression définitive</p>
          <p class="confirm-desc">Tapez <strong>SUPPRIMER</strong> pour confirmer :</p>
          <div class="confirm-input-row">
            <input type="text" class="confirm-input" v-model="deleteConfirmText" placeholder="SUPPRIMER" autofocus
              @keyup.enter="confirmDeleteProceed" @keyup.esc="cancelDeleteConfirm" />
            <button class="confirm-btn" :disabled="deleteConfirmText !== 'SUPPRIMER'" @click="confirmDeleteProceed">Confirmer</button>
            <button class="cancel-btn" @click="cancelDeleteConfirm">Annuler</button>
          </div>
        </div>

        <div class="action-buttons-list">
          <button class="action-btn-full unselect-all-btn" :disabled="actionInProgress || totalSelected === 0" @click="unselectAll"
            title="Désélectionner tous les éléments (Échap)">
            <span class="btn-icon">&#x2715;</span><span>Désélectionner tout</span>
          </button>
          <div class="action-separator"></div>
          <button class="action-btn-full archive-btn" :disabled="actionInProgress || totalSelected === 0" @click="archiveSelected"
            title="Créer une archive 7z avec les éléments sélectionnés">
            <span class="btn-icon">&#x1F4E6;</span><span>Archiver en 7z...</span>
          </button>
          <button class="action-btn-full move-btn" :disabled="actionInProgress || totalSelected === 0" @click="executeAction('moveToFolder')"
            title="Déplacer les éléments vers un dossier choisi">
            <span class="btn-icon">&#x1F4C1;</span><span>Déplacer vers un dossier...</span>
          </button>
          <button class="action-btn-full trash-btn" :disabled="actionInProgress || totalSelected === 0" @click="executeAction('trash')"
            title="Mettre les éléments à la corbeille (Suppr)">
            <span class="btn-icon">&#x1F5D1;</span><span>Mettre à la corbeille...</span>
          </button>
          <div class="action-separator"></div>
          <button class="action-btn-full delete-btn" :disabled="actionInProgress || totalSelected === 0" @click="executeAction('delete')"
            title="Supprimer définitivement les éléments sélectionnés (irreversible)">
            <span class="btn-icon">&#x26A0;</span><span>Supprimer définitivement...</span>
          </button>
        </div>
      </div>
    </div>

    <!-- ===== CONTEXT MENU ===== -->
    <Teleport to="body">
      <div v-if="contextMenu.visible" class="context-menu" :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }" @click.stop>
        <button class="ctx-item" @click="contextAction('open')"><span class="ctx-icon">&#x1F4E4;</span> Ouvrir</button>
        <button class="ctx-item" @click="contextAction('explorer')"><span class="ctx-icon">&#x1F4C2;</span> Ouvrir dans l'Explorateur</button>
        <div class="ctx-separator"></div>
        <button class="ctx-item" @click="contextAction('select')"><span class="ctx-icon">&#x2611;</span> Sélectionner</button>
        <button class="ctx-item ctx-danger" @click="contextAction('trash')"><span class="ctx-icon">&#x1F5D1;</span> Mettre à la corbeille</button>
      </div>
    </Teleport>
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
.loading-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px; color: #888; gap: 16px; }
.loading-state.small { padding: 20px; }
.spinner { width: 40px; height: 40px; border: 4px solid #2a2a3e; border-top-color: #6c63ff; border-radius: 50%; animation: spin 0.8s linear infinite; }
.tiny-spinner { width: 14px; height: 14px; border-width: 2px; }
@keyframes spin { to { transform: rotate(360deg); } }

.cleaner-layout { display: grid; grid-template-columns: 1fr 260px; gap: 20px; align-items: start; }
@media (max-width: 900px) {
  .cleaner-layout { grid-template-columns: 1fr; }
  .action-panel { position: fixed; bottom: 0; left: 0; right: 0; border-radius: 12px 12px 0 0; padding: 12px 16px; z-index: 100; flex-direction: row; align-items: center; gap: 12px; flex-wrap: wrap; box-shadow: 0 -4px 20px rgba(0,0,0,0.5); }
  .selection-info-box { flex-direction: row; gap: 8px; padding-bottom: 0; border-bottom: none; border-right: 1px solid #2a2a3e; padding-right: 12px; }
  .selection-label { font-size: 0.65rem; }
  .action-buttons-list { flex-direction: row; gap: 6px; flex-wrap: wrap; }
  .action-btn-full { padding: 8px 12px; font-size: 0.8rem; }
  .action-btn-full span:not(.btn-icon) { display: none; }
  .btn-icon { width: auto; font-size: 1.2rem; }
  .action-separator { display: none; }
  .selection-panel { padding-bottom: 80px; }
  .delete-confirm-box { position: fixed; bottom: 70px; left: 50%; transform: translateX(-50%); z-index: 200; }
}

.selection-panel { min-width: 0; overflow: hidden; }

.action-panel { background: var(--bg-secondary, #1a1a2e); border: 1px solid #6c63ff; border-radius: 10px; padding: 20px; position: sticky; top: 16px; display: flex; flex-direction: column; gap: 16px; }
.selection-info-box { display: flex; flex-direction: column; gap: 4px; padding-bottom: 16px; border-bottom: 1px solid var(--border-color, #2a2a3e); }
.selection-label { font-size: 0.75rem; color: var(--text-dim, #666); text-transform: uppercase; letter-spacing: 1px; }
.selection-count { font-size: 1.1rem; font-weight: 700; color: #6c63ff; }
.selection-size { font-size: 0.85rem; color: #888; }

.operation-indicator { display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: rgba(108,99,255,0.1); border: 1px solid rgba(108,99,255,0.2); border-radius: 6px; }
.operation-label { color: #6c63ff; font-size: 0.8rem; font-weight: 600; }
.session-stats { display: flex; flex-direction: column; gap: 2px; padding: 8px 12px; background: rgba(39,174,96,0.08); border: 1px solid rgba(39,174,96,0.2); border-radius: 6px; }
.stats-label { font-size: 0.75rem; color: #6fcf97; font-weight: 600; }
.stats-detail { font-size: 0.72rem; color: #888; }

/* #25: Double confirmation box */
.delete-confirm-box { padding: 12px; background: rgba(61,26,26,0.6); border: 1px solid #e74c3c; border-radius: 8px; }
.confirm-title { font-size: 0.9rem; color: #ff6b6b; font-weight: 700; margin-bottom: 4px; }
.confirm-desc { font-size: 0.8rem; color: #ccc; margin-bottom: 8px; }
.confirm-input-row { display: flex; gap: 6px; align-items: center; }
.confirm-input { flex: 1; padding: 6px 10px; background: #151528; border: 1px solid #e74c3c; border-radius: 4px; color: #ff6b6b; font-size: 0.85rem; outline: none; font-family: monospace; }
.confirm-input::placeholder { color: #663333; }
.confirm-btn { padding: 6px 12px; background: #e74c3c; border: none; border-radius: 4px; color: #fff; font-size: 0.8rem; font-weight: 600; cursor: pointer; white-space: nowrap; }
.confirm-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.cancel-btn { padding: 6px 12px; background: #2a2a3e; border: none; border-radius: 4px; color: #888; font-size: 0.8rem; cursor: pointer; white-space: nowrap; }
.cancel-btn:hover { background: #3a3a4e; color: #ccc; }

/* Enhanced badges — #7 */
.tab-count.has-selection { background: rgba(231,76,60,0.25); color: #ff6b6b; animation: badge-pulse 1.5s ease-in-out infinite; }
.tab-btn.active .tab-count.has-selection { background: rgba(39,174,96,0.3); color: #8fefb7; animation: none; }
@keyframes badge-pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.15); } }

.action-buttons-list { display: flex; flex-direction: column; gap: 8px; }
.action-btn-full { display: flex; align-items: center; gap: 10px; padding: 12px 16px; border: none; border-radius: 8px; font-size: 0.88rem; font-weight: 600; cursor: pointer; transition: all 0.2s; text-align: left; width: 100%; }
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
.action-separator { height: 1px; background: var(--border-color, #2a2a3e); margin: 4px 0; }
.action-btn.small { padding: 6px 14px; font-size: 0.8rem; }

/* Tabs */
.tabs-bar { display: flex; flex-wrap: wrap; gap: 4px; padding: 10px 12px 6px; background: var(--bg-tertiary, #151528); border: 1px solid var(--border-color, #2a2a3e); border-radius: 12px 12px 0 0; border-bottom: none; }
.tab-btn { display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px; border: 1px solid transparent; border-radius: 8px; background: transparent; color: var(--text-dim, #666); font-size: 0.82rem; cursor: pointer; transition: all 0.2s ease; white-space: nowrap; flex: 0 0 auto; line-height: 1.3; }
.tab-btn:hover { background: rgba(108,99,255,0.08); border-color: rgba(108,99,255,0.15); color: #aaa; }
.tab-btn.active { background: rgba(108,99,255,0.15); border-color: rgba(108,99,255,0.3); color: #fff; }
.tab-icon { font-size: 0.95rem; opacity: 0.7; flex-shrink: 0; }
.tab-btn.active .tab-icon { opacity: 1; }
.tab-label { font-weight: 500; overflow: hidden; text-overflow: ellipsis; }
.tab-subtitle { font-size: 0.65rem; font-weight: 400; color: #777; max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex-shrink: 1; min-width: 0; }
.tab-btn.active .tab-subtitle { color: #9988dd; }
.tab-count { font-size: 0.65rem; font-weight: 600; background: rgba(255,255,255,0.06); color: var(--text-dim, #666); border-radius: 5px; padding: 1px 6px; min-width: 16px; text-align: center; line-height: 1.4; flex-shrink: 0; }
.tab-btn.active .tab-count { background: rgba(108,99,255,0.25); color: #b8b4ff; }
.tab-count-sep { opacity: 0.4; margin: 0 2px; font-weight: 400; }

/* Folder panel */
.folder-panel { background: var(--bg-secondary, #1a1a2e); border: 1px solid var(--border-color, #2a2a3e); border-radius: 0 0 10px 10px; padding: 16px; margin-bottom: 24px; }
.folder-panel-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--border-color, #2a2a3e); }
.active-folder-info { margin: 0; color: #888; font-size: 0.85rem; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.open-explorer-btn { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; background: var(--bg-hover, #252540); border: 1px solid #3a3a5e; border-radius: 5px; color: #aaa; font-size: 0.75rem; cursor: pointer; transition: all 0.2s; white-space: nowrap; flex-shrink: 0; }
.open-explorer-btn:hover { background: #2a2a50; border-color: #6c63ff; color: #ddd; }

.folder-sort { display: flex; gap: 8px; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--border-color, #2a2a3e); }
.sort-btn { display: flex; align-items: center; gap: 4px; padding: 4px 10px; border: 1px solid var(--border-color, #2a2a3e); border-radius: 4px; background: var(--bg-secondary, #1a1a2e); color: #aaa; font-size: 0.78rem; cursor: pointer; transition: all 0.2s; white-space: nowrap; }
.sort-btn:hover { background: var(--bg-hover, #252540); border-color: #3a3a5e; color: #ccc; }
.sort-btn.sort-primary { background: #6c63ff; border-color: #6c63ff; color: #fff; }
.sort-btn.sort-secondary { background: #4a42b0; border-color: #5a52d0; color: #ddd; }
.sort-btn.sort-tertiary { background: #3a3280; border-color: #4a4290; color: #bbb; }
.sort-label { font-weight: 500; }
.sort-icon { font-size: 0.7rem; display: inline-flex; align-items: center; gap: 2px; }
.sort-priority { font-size: 0.6rem; background: rgba(255,255,255,0.2); border-radius: 50%; width: 14px; height: 14px; display: inline-flex; align-items: center; justify-content: center; line-height: 1; }

/* Filter row */
.filter-row { display: flex; gap: 8px; margin-bottom: 8px; align-items: stretch; }
.search-bar { display: flex; align-items: center; gap: 8px; padding: 6px 10px; background: var(--bg-tertiary, #151528); border: 1px solid var(--border-color, #2a2a3e); border-radius: 6px; transition: border-color 0.2s; flex: 1; min-width: 0; }
.search-bar:focus-within { border-color: #6c63ff; }
.search-icon { font-size: 0.9rem; flex-shrink: 0; opacity: 0.5; }
.search-input { flex: 1; background: transparent; border: none; outline: none; color: var(--text-secondary, #ccc); font-size: 0.85rem; font-family: inherit; min-width: 0; }
.search-input::placeholder { color: var(--text-dim, #555); }
.search-clear { background: transparent; border: none; color: #666; cursor: pointer; font-size: 0.85rem; padding: 2px 4px; border-radius: 3px; flex-shrink: 0; }
.search-clear:hover { color: #ff6b6b; }
.date-filter { display: flex; gap: 2px; flex-shrink: 0; }
.date-btn { padding: 4px 8px; background: var(--bg-tertiary, #151528); border: 1px solid var(--border-color, #2a2a3e); border-radius: 4px; color: var(--text-dim, #666); font-size: 0.72rem; cursor: pointer; transition: all 0.2s; white-space: nowrap; font-weight: 600; }
.date-btn:hover { background: var(--bg-hover, #252540); color: #aaa; }
.date-btn.active { background: #6c63ff; border-color: #6c63ff; color: #fff; }

.filter-info { color: #666; font-size: 0.78rem; margin-left: 4px; }
.select-all-row { margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid #252540; }
.items-list { max-height: 400px; overflow-y: auto; }
.items-list::-webkit-scrollbar { width: 6px; }
.items-list::-webkit-scrollbar-track { background: transparent; }
.items-list::-webkit-scrollbar-thumb { background: #2a2a3e; border-radius: 3px; }
.item-row { display: flex; align-items: center; justify-content: space-between; padding: 6px 8px; border-radius: 6px; transition: background 0.15s; cursor: pointer; }
.item-row:hover { background: var(--bg-hover, #252540); }
.item-row.selected { background: rgba(108,99,255,0.1); }
.checkbox-label { display: flex; align-items: center; gap: 8px; cursor: pointer; min-width: 0; flex: 1; }
.checkbox-label input[type="checkbox"] { accent-color: #6c63ff; cursor: pointer; flex-shrink: 0; }
.checkbox-label.select-all { color: #aaa; font-size: 0.85rem; }
.item-icon { font-size: 1rem; flex-shrink: 0; }
.item-name { font-size: 0.85rem; color: var(--text-secondary, #ccc); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.item-size { font-size: 0.78rem; color: #777; flex-shrink: 0; margin-left: 8px; font-family: 'Consolas', monospace; }

.page-actions { display: flex; justify-content: flex-end; margin-bottom: 16px; }
.refresh-btn { display: flex; align-items: center; gap: 8px; padding: 8px 18px; background: #1a2a3d; border: 1px solid #2a4a5e; border-radius: 6px; color: #6fa8cf; font-size: 0.85rem; font-weight: 600; cursor: pointer; transition: all 0.2s; }
.refresh-btn:hover:not(:disabled) { background: #1a3a4a; border-color: #3a6a8e; color: #7fc0e0; }
.refresh-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.loading-overlay { position: fixed; top: 70px; right: 20px; display: flex; align-items: center; gap: 10px; padding: 10px 16px; background: var(--bg-secondary, #1a1a2e); border: 1px solid #6c63ff; border-radius: 8px; color: #6c63ff; font-size: 0.8rem; font-weight: 600; z-index: 1000; box-shadow: 0 4px 16px rgba(0,0,0,0.4); animation: overlay-in 0.3s ease-out; }
@keyframes overlay-in { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
.small-spinner { width: 18px; height: 18px; border-width: 2px; }
.no-folders { background: var(--bg-secondary, #1a1a2e); border: 1px solid var(--border-color, #2a2a3e); border-radius: 10px; margin-bottom: 24px; }
.empty-state { padding: 48px 8px; text-align: center; }
.empty-icon { font-size: 2rem; display: block; margin-bottom: 8px; }
.empty-text { color: var(--text-dim, #666); font-size: 0.9rem; }

.shortcuts-section { background: var(--bg-secondary, #1a1a2e); border: 1px solid var(--border-color, #2a2a3e); border-radius: 10px; padding: 20px; margin-top: 8px; }
.section-header { margin-bottom: 16px; }
.section-header h2 { font-size: 1.15rem; color: var(--text-secondary, #e0e0e0); margin-bottom: 4px; }
.section-subtitle { color: #888; font-size: 0.85rem; }
.shortcut-toolbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid var(--border-color, #2a2a3e); flex-wrap: wrap; gap: 8px; }
.shortcuts-list { max-height: 250px; overflow-y: auto; }
.shortcut-row { display: flex; align-items: center; justify-content: space-between; padding: 6px 8px; border-radius: 6px; transition: background 0.15s; }
.shortcut-row:hover { background: var(--bg-hover, #252540); }
.shortcut-row.selected { background: rgba(108,99,255,0.1); }

.recycle-bin-bar { background: var(--bg-secondary, #1a1a2e); border: 1px solid #3a2a2a; border-radius: 10px; padding: 12px 16px; margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
.recycle-bin-info { display: flex; align-items: center; gap: 8px; color: var(--text-secondary, #ccc); font-size: 0.85rem; }
.recycle-icon { font-size: 1.1rem; }
.recycle-btn { background: #3d2a1a; color: #ffb86b; padding: 6px 14px; font-size: 0.8rem; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; transition: all 0.2s; white-space: nowrap; }
.recycle-btn:hover:not(:disabled) { background: #4d3a2a; }
.recycle-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.recycle-empty { border-color: #2a3a2a; opacity: 0.6; }

/* #6: Skeleton loader */
.skeleton-state { padding: 20px 0; }
.skeleton-tabs { display: flex; gap: 8px; margin-bottom: 12px; }
.skel { background: linear-gradient(90deg, #1a1a2e 25%, #252540 50%, #1a1a2e 75%); background-size: 200% 100%; animation: skel-shimmer 1.5s infinite; border-radius: 6px; }
@keyframes skel-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
.skel-tab { width: 80px; height: 36px; flex-shrink: 0; }
.skel-header { height: 20px; width: 60%; margin-bottom: 12px; }
.skel-row { height: 32px; margin-bottom: 8px; }
.skeleton-panel { background: var(--bg-secondary, #1a1a2e); border: 1px solid var(--border-color, #2a2a3e); border-radius: 10px; padding: 16px; margin-bottom: 16px; }
.skel-text { color: #888; font-size: 0.85rem; text-align: center; margin-top: 12px; }

/* #21: Duplicate files section */
.duplicates-section { background: var(--bg-secondary, #1a1a2e); border: 1px solid var(--border-color, #2a2a3e); border-radius: 10px; padding: 20px; margin-top: 8px; }
.duplicate-group { margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #252540; }
.duplicate-group:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
.dup-group-header { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.dup-icon { flex-shrink: 0; }
.dup-name { font-weight: 600; color: var(--text-secondary, #ddd); font-size: 0.88rem; }
.dup-count { font-size: 0.72rem; color: #ff6b6b; background: rgba(255,107,107,0.12); padding: 2px 8px; border-radius: 10px; font-weight: 600; }
.dup-file-row { display: flex; align-items: center; gap: 8px; padding: 4px 8px; margin-left: 24px; font-size: 0.78rem; }
.dup-folder-badge { background: #2a2a3e; color: #6c63ff; padding: 1px 6px; border-radius: 3px; font-weight: 600; flex-shrink: 0; font-size: 0.7rem; }
.dup-path { color: #888; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; flex: 1; }
.dup-size { color: #777; flex-shrink: 0; font-family: 'Consolas', monospace; }
</style>

<style>
.context-menu { position: fixed; z-index: 10000; background: #1e1e30; border: 1px solid #3a3a5e; border-radius: 8px; padding: 4px 0; min-width: 200px; box-shadow: 0 8px 24px rgba(0,0,0,0.6); animation: ctx-in 0.15s ease-out; }
@keyframes ctx-in { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
.ctx-item { display: flex; align-items: center; gap: 10px; width: 100%; padding: 8px 14px; background: transparent; border: none; color: #ccc; font-size: 0.85rem; cursor: pointer; transition: background 0.15s; text-align: left; }
.ctx-item:hover { background: rgba(108,99,255,0.15); color: #fff; }
.ctx-item.ctx-danger { color: #ff6b6b; }
.ctx-item.ctx-danger:hover { background: rgba(255,107,107,0.15); }
.ctx-icon { font-size: 0.9rem; width: 18px; text-align: center; flex-shrink: 0; }
.ctx-separator { height: 1px; background: #2a2a3e; margin: 4px 8px; }
</style>