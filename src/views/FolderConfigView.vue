<script setup>
/**
 * FolderConfigView.vue - Folder configuration page
 * Allows users to configure which folders are included in the application.
 * Supports regex patterns (glob-like with *) and full paths.
 * Configuration is persisted to disk and restored at startup.
 *
 * Toast system:
 *   - errorMessage: persistent banner (stays until next successful action)
 *   - toast: temporary notification (auto-dismisses after 3-4s)
 *   - success: both banner and toast disappear after a timeout
 *   - error: toast disappears but error banner stays
 */
import { ref, onMounted, computed, watch } from 'vue'

const config = ref({ folders: [] })
const loading = ref(true)
const saving = ref(false)
const errorMessage = ref('')
const toast = ref('')
const toastType = ref('') // 'success' or 'error'
const expandedIndex = ref(-1)
// #23: Live path validation state per folder index
const pathValidations = ref({})
let validationTimer = null

// Example patterns for reference
const examplePatterns = [
  { label: 'Tous les utilisateurs - Bureau', pattern: 'C:\\Users\\*\\Desktop' },
  { label: 'Tous les utilisateurs - Documents', pattern: 'C:\\Users\\*\\Documents' },
  { label: 'Tous les utilisateurs - Downloads', pattern: 'C:\\Users\\*\\Downloads' },
  { label: 'Dossier Bac sur toutes les partitions', pattern: '*:\\Bac*' },
  { label: 'Dossier spécifique', pattern: 'C:\\Users\\MonNom\\Desktop' }
]

onMounted(async () => {
  await loadConfig()
})

function showToast(message, type, duration = 3000) {
  toast.value = message
  toastType.value = type
  setTimeout(() => {
    toast.value = ''
    toastType.value = ''
  }, duration)
}

async function loadConfig() {
  loading.value = true
  errorMessage.value = ''
  try {
    const loaded = await window.electronAPI.loadFolderConfig()
    config.value = loaded
  } catch (err) {
    console.error('Failed to load config:', err)
    errorMessage.value = 'Erreur lors du chargement de la configuration : ' + err.message
    config.value = { folders: [] }
  } finally {
    loading.value = false
  }
}

async function saveConfig() {
  saving.value = true
  try {
    const success = await window.electronAPI.saveFolderConfig(JSON.stringify(config.value))
    if (success) {
      // Success: clear error banner and show success toast
      errorMessage.value = ''
      showToast('Configuration sauvegardée avec succès', 'success', 3000)
    } else {
      // Error saving: show persistent error banner + temporary error toast
      errorMessage.value = 'Erreur lors de la sauvegarde de la configuration'
      showToast('Erreur lors de la sauvegarde', 'error', 4000)
    }
  } catch (err) {
    console.error('Save config error:', err)
    errorMessage.value = 'Erreur : ' + err.message
    showToast('Erreur lors de la sauvegarde', 'error', 4000)
  } finally {
    saving.value = false
  }
}

async function resetToDefaults() {
  if (!confirm('Réinitialiser la configuration par défaut ?')) return
  errorMessage.value = ''
  try {
    const defaults = await window.electronAPI.getDefaultFolderConfig()
    config.value = defaults
    await saveConfig()
  } catch (err) {
    console.error('Failed to reset config:', err)
    errorMessage.value = 'Erreur lors de la réinitialisation : ' + err.message
  }
}

function addFolder() {
  config.value.folders.push({
    name: '',
    path: '',
    isRegex: false,
    enabled: true
  })
  expandedIndex.value = config.value.folders.length - 1
}

function removeFolder(index) {
  if (!confirm(`Supprimer le dossier "${config.value.folders[index].name || 'sans nom'}" ?`)) return
  config.value.folders.splice(index, 1)
  if (expandedIndex.value === index) {
    expandedIndex.value = -1
  } else if (expandedIndex.value > index) {
    expandedIndex.value--
  }
}

function toggleFolder(index) {
  config.value.folders[index].enabled = !config.value.folders[index].enabled
}

function toggleExpand(index) {
  expandedIndex.value = expandedIndex.value === index ? -1 : index
}

const enabledCount = computed(() => {
  return config.value.folders.filter(f => f.enabled).length
})

function selectFolderPath(index) {
  window.electronAPI.selectFolder().then(folderPath => {
    if (folderPath) {
      config.value.folders[index].path = folderPath
      config.value.folders[index].isRegex = false
      if (!config.value.folders[index].name) {
        const parts = folderPath.split('\\')
        config.value.folders[index].name = parts[parts.length - 1]
      }
    }
  })
}

function applyExample(pattern) {
  config.value.folders.push({
    name: pattern.label,
    path: pattern.pattern,
    isRegex: pattern.pattern.includes('*'),
    enabled: true
  })
  expandedIndex.value = config.value.folders.length - 1
}

// #23: Live path validation with debounce
function validatePathDebounced(index) {
  clearTimeout(validationTimer)
  const entry = config.value.folders[index]
  if (!entry || !entry.path) {
    pathValidations.value[index] = null
    return
  }
  pathValidations.value[index] = { checking: true }
  validationTimer = setTimeout(async () => {
    try {
      const result = await window.electronAPI.validateFolderPath(JSON.stringify(entry))
      pathValidations.value[index] = result
    } catch (err) {
      pathValidations.value[index] = { valid: false, error: err.message }
    }
  }, 400)
}

function getPathValidation(index) {
  return pathValidations.value[index] || null
}
</script>

<template>
  <div class="config-view">
    <div class="page-header">
      <h1>Configuration des dossiers</h1>
      <p class="page-subtitle">
        Gérez les dossiers inclus dans l'application. Vous pouvez utiliser des motifs avec <code>*</code>
        comme joker pour un dossier, ou des chemins complets.
      </p>
    </div>

    <!-- Toast notification (temporary, auto-dismisses) -->
    <Transition name="toast">
      <div v-if="toast" class="toast-notification" :class="toastType">
        <span class="toast-icon">{{ toastType === 'error' ? '✕' : '✓' }}</span>
        <span class="toast-text">{{ toast }}</span>
      </div>
    </Transition>

    <!-- Error banner (persistent, stays until next success) -->
    <div v-if="errorMessage" class="error-banner">
      <span class="error-banner-icon">⚠</span>
      <span class="error-banner-text">{{ errorMessage }}</span>
    </div>

    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>Chargement de la configuration...</p>
    </div>

    <template v-if="!loading">
      <!-- Quick examples panel -->
      <div class="examples-panel">
        <h3>Exemples de motifs</h3>
        <div class="example-chips">
          <button
            v-for="example in examplePatterns"
            :key="example.label"
            class="example-chip"
            :title="'Ajouter : ' + example.pattern"
            @click="applyExample(example)"
          >
            <span class="chip-icon">+</span>
            <span class="chip-label">{{ example.label }}</span>
            <code class="chip-pattern">{{ example.pattern }}</code>
          </button>
        </div>
      </div>

      <!-- Config summary bar -->
      <div class="config-summary">
        <span class="summary-text">
          <strong>{{ config.folders.length }}</strong> dossier(s) configuré(s),
          <strong>{{ enabledCount }}</strong> actif(s)
        </span>
        <div class="summary-actions">
          <button class="action-btn secondary-btn" @click="resetToDefaults">
            ↺ Réinitialiser
          </button>
          <button class="action-btn primary-btn" :disabled="saving" @click="saveConfig">
            {{ saving ? 'Sauvegarde...' : '💾 Sauvegarder' }}
          </button>
        </div>
      </div>

      <!-- Folder list -->
      <div v-if="config.folders.length === 0" class="empty-state">
        <span class="empty-icon">📂</span>
        <span class="empty-text">Aucun dossier configuré. Ajoutez-en un !</span>
      </div>

      <div v-for="(folder, index) in config.folders" :key="index" class="folder-card"
        :class="{ expanded: expandedIndex === index, disabled: !folder.enabled }">
        <div class="card-header" @click="toggleExpand(index)">
          <div class="card-title-row">
            <span class="drag-handle">⠿</span>
            <input
              type="checkbox"
              :checked="folder.enabled"
              class="toggle-checkbox"
              @click.stop
              @change="toggleFolder(index)"
              :title="folder.enabled ? 'Désactiver' : 'Activer'"
            />
            <span class="folder-name" :class="{ 'unnamed': !folder.name }">
              {{ folder.name || 'Sans nom' }}
            </span>
            <code class="folder-path-display">{{ folder.path }}</code>
            <span class="folder-badge" :class="{ regex: folder.isRegex }">
              {{ folder.isRegex ? 'Motif' : 'Chemin' }}
            </span>
          </div>
          <div class="card-actions">
            <button class="icon-btn remove-btn" @click.stop="removeFolder(index)" title="Supprimer ce dossier">
              ✕
            </button>
            <span class="expand-icon">{{ expandedIndex === index ? '▼' : '▶' }}</span>
          </div>
        </div>

        <div v-if="expandedIndex === index" class="card-body">
          <div class="form-group">
            <label class="form-label">Nom du dossier</label>
            <input
              type="text"
              class="form-input"
              v-model="folder.name"
              placeholder="Ex: Desktop, Documents, Bac2026..."
            />
          </div>

          <div class="form-group">
            <label class="form-label">
              Chemin ou motif
              <span class="label-hint">(utilisez <code>*</code> pour un joker dossier)</span>
            </label>
            <div class="input-with-button">
              <input
                type="text"
                class="form-input mono"
                :class="{ 'path-valid': getPathValidation(index)?.valid === true, 'path-invalid': getPathValidation(index)?.valid === false }"
                v-model="folder.path"
                placeholder="Ex: C:\Users\*\Desktop ou C:\Users\MonNom\Desktop"
                @input="validatePathDebounced(index)"
              />
              <button class="icon-btn browse-btn" @click="selectFolderPath(index)" title="Parcourir...">
                📁
              </button>
            </div>
            <!-- #23: Live validation indicator -->
            <div v-if="getPathValidation(index)" class="path-validation" :class="{ valid: getPathValidation(index).valid, error: !getPathValidation(index).valid && !getPathValidation(index).checking }">
              <template v-if="getPathValidation(index).checking">
                <span class="val-icon spin">⏳</span> Vérification...
              </template>
              <template v-else-if="getPathValidation(index).valid">
                <span class="val-icon">✅</span>
                <span v-if="getPathValidation(index).resolved" class="val-detail">{{ getPathValidation(index).resolved.length }} dossier(s) trouvé(s)</span>
              </template>
              <template v-else>
                <span class="val-icon">❌</span>
                <span class="val-detail">{{ getPathValidation(index).error || 'Chemin introuvable' }}</span>
              </template>
            </div>
          </div>

          <div class="form-group checkbox-group">
            <label class="checkbox-label-inline">
              <input type="checkbox" v-model="folder.isRegex" />
              <span>Utiliser comme motif (avec <code>*</code> comme joker)</span>
            </label>
            <p class="form-help">
              Si activé, <code>*</code> correspond à n'importe quel nom de dossier.
              Ex: <code>C:\Users\*\Desktop</code> trouvera le bureau de tous les utilisateurs.
            </p>
          </div>
        </div>
      </div>

      <!-- Add button -->
      <div class="add-folder-area">
        <button class="action-btn add-btn" @click="addFolder">
          + Ajouter un dossier
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.config-view {
  min-height: 400px;
  width: 100%;
  position: relative;
}

.page-header {
  margin-bottom: 20px;
}

.page-header h1 {
  font-size: 1.6rem;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.page-subtitle {
  color: var(--text-dim);
  font-size: 0.9rem;
  line-height: 1.5;
}

.page-subtitle code {
  background: var(--bg-tertiary);
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 0.85rem;
  color: var(--accent);
}

/* ===== Toast notification ===== */
.toast-notification {
  position: fixed;
  top: 20px;
  right: 20px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 20px;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 600;
  z-index: 9999;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
  min-width: 280px;
  max-width: 450px;
}

.toast-notification.success {
  background: var(--success-bg);
  border: 1px solid var(--success);
  color: var(--success);
}

.toast-notification.error {
  background: var(--danger-bg);
  border: 1px solid var(--danger);
  color: var(--danger);
}

.toast-icon {
  font-size: 1.1rem;
  flex-shrink: 0;
}

.toast-text {
  flex: 1;
}

/* Toast transitions */
.toast-enter-active {
  animation: toast-in 0.3s ease-out;
}

.toast-leave-active {
  animation: toast-out 0.3s ease-in;
}

@keyframes toast-in {
  from {
    opacity: 0;
    transform: translateX(100px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes toast-out {
  from {
    opacity: 1;
    transform: translateX(0);
  }
  to {
    opacity: 0;
    transform: translateX(100px);
  }
}

/* ===== Error banner (persistent) ===== */
.error-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--danger-bg);
  border: 1px solid var(--danger);
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 16px;
  color: var(--danger);
  font-size: 0.9rem;
}

.error-banner-icon {
  font-size: 1.2rem;
  flex-shrink: 0;
}

.error-banner-text {
  flex: 1;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: var(--text-dim);
  gap: 16px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid var(--border-color);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ===== Examples panel ===== */
.examples-panel {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 16px;
  margin-bottom: 16px;
}

.examples-panel h3 {
  font-size: 0.85rem;
  color: var(--text-dim);
  margin-bottom: 10px;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.example-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.example-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-muted);
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s;
}

.example-chip:hover {
  border-color: var(--accent);
  background: var(--bg-hover);
  color: var(--text-secondary);
}

.chip-icon {
  color: var(--accent);
  font-weight: bold;
  font-size: 0.9rem;
}

.chip-label {
  white-space: nowrap;
}

.chip-pattern {
  background: var(--bg-tertiary);
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 0.75rem;
  color: var(--accent);
}

/* ===== Config summary ===== */
.config-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  margin-bottom: 16px;
}

.summary-text {
  font-size: 0.9rem;
  color: var(--text-muted);
}

.summary-text strong {
  color: var(--accent);
}

.summary-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.primary-btn {
  background: var(--accent);
  color: #fff;
}

.primary-btn:hover:not(:disabled) {
  background: var(--border-focus);
}

.secondary-btn {
  background: var(--bg-tertiary);
  color: var(--text-dim);
}

.secondary-btn:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--text-muted);
}

.add-btn {
  background: var(--success-bg);
  color: var(--success);
  padding: 12px 24px;
  font-size: 0.9rem;
  border: 1px solid transparent;
}

.add-btn:hover {
  background: rgba(39, 174, 96, 0.15);
}

/* ===== Folder cards ===== */
.folder-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  margin-bottom: 8px;
  transition: all 0.2s;
  overflow: hidden;
}

.folder-card:hover {
  border-color: var(--bg-hover);
}

.folder-card.expanded {
  border-color: var(--accent);
}

.folder-card.disabled {
  opacity: 0.55;
}

.folder-card.disabled:hover {
  opacity: 0.7;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  cursor: pointer;
  user-select: none;
}

.card-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.drag-handle {
  color: var(--text-dim);
  font-size: 1.1rem;
  margin-right: 4px;
  cursor: grab;
}

.toggle-checkbox {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: var(--accent);
}

.folder-name {
  font-weight: 600;
  color: var(--text-secondary);
  font-size: 0.9rem;
  white-space: nowrap;
}

.folder-name.unnamed {
  color: var(--text-dim);
  font-style: italic;
}

.folder-path-display {
  background: var(--bg-tertiary);
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  color: var(--text-dim);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 300px;
  font-family: 'Consolas', 'Courier New', monospace;
}

.folder-badge {
  font-size: 0.7rem;
  padding: 2px 8px;
  border-radius: 10px;
  background: var(--bg-tertiary);
  color: var(--text-dim);
  white-space: nowrap;
}

.folder-badge.regex {
  background: rgba(255, 184, 107, 0.12);
  color: var(--warning);
}

.card-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: 12px;
}

.icon-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 0.9rem;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s;
}

.remove-btn {
  color: var(--danger);
  opacity: 0.6;
}

.remove-btn:hover {
  background: var(--danger-bg);
  opacity: 1;
}

.browse-btn {
  color: var(--accent);
  font-size: 1.1rem;
  padding: 6px;
}

.browse-btn:hover {
  background: var(--bg-hover);
}

.expand-icon {
  color: var(--text-dim);
  font-size: 0.7rem;
}

/* ===== Card body ===== */
.card-body {
  padding: 0 16px 16px;
  border-top: 1px solid var(--border-color);
}

.form-group {
  margin-top: 14px;
}

.form-label {
  display: block;
  font-size: 0.8rem;
  color: var(--text-muted);
  margin-bottom: 6px;
  font-weight: 500;
}

.label-hint {
  font-weight: normal;
  font-size: 0.75rem;
  color: var(--text-dim);
}

.label-hint code {
  background: var(--bg-tertiary);
  padding: 0 4px;
  border-radius: 2px;
  color: var(--accent);
}

.form-input {
  width: 100%;
  padding: 10px 12px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-secondary);
  font-size: 0.9rem;
  transition: border-color 0.2s;
}

.form-input:focus {
  outline: none;
  border-color: var(--accent);
}

.form-input.mono {
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 0.85rem;
}

.input-with-button {
  display: flex;
  gap: 8px;
}

.input-with-button .form-input {
  flex: 1;
}

/* #23: Path validation indicator */
.path-validation {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  font-size: 0.78rem;
  padding: 4px 8px;
  border-radius: 4px;
}

.path-validation.valid {
  color: var(--success);
  background: var(--success-bg);
}

.path-validation.error {
  color: var(--danger);
  background: var(--danger-bg);
}

.path-validation.checking {
  color: var(--text-dim);
}

.val-icon { flex-shrink: 0; }
.val-detail { color: inherit; opacity: 0.8; }
.val-icon.spin { animation: spin 1s linear infinite; display: inline-block; }

.path-valid {
  border-color: var(--success) !important;
}

.path-invalid {
  border-color: var(--danger) !important;
}

.checkbox-group {
  margin-top: 16px;
}

.checkbox-label-inline {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-muted);
  font-size: 0.85rem;
  cursor: pointer;
}

.checkbox-label-inline input[type="checkbox"] {
  width: 18px;
  height: 18px;
  accent-color: var(--accent);
  cursor: pointer;
}

.checkbox-label-inline code {
  background: var(--bg-tertiary);
  padding: 0 4px;
  border-radius: 2px;
  color: var(--accent);
}

.form-help {
  font-size: 0.75rem;
  color: var(--text-dim);
  margin-top: 6px;
  line-height: 1.5;
  padding-left: 26px;
}

.form-help code {
  background: var(--bg-tertiary);
  padding: 0 4px;
  border-radius: 2px;
  color: var(--accent);
}

/* ===== Empty state ===== */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 20px;
  color: var(--text-dim);
  gap: 12px;
}

.empty-icon {
  font-size: 2.5rem;
}

.empty-text {
  font-size: 1rem;
}

/* ===== Add area ===== */
.add-folder-area {
  display: flex;
  justify-content: center;
  margin-top: 12px;
}
</style>