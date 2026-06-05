<script setup>
/**
 * TreeView.vue
 * Recursive component that renders a tree node (file or folder)
 * Supports expanding/collapsing folders and shows size + modified date
 */
import { ref, computed } from 'vue'

const props = defineProps({
  node: { type: Object, required: true },
  depth: { type: Number, default: 0 }
})

// Track expanded/collapsed state for folders
const isExpanded = ref(props.depth < 2) // Auto-expand first 2 levels

/**
 * Toggle folder expand/collapse
 */
function toggleExpand() {
  if (props.node.type === 'folder') {
    isExpanded.value = !isExpanded.value
  }
}

/**
 * Get the appropriate icon based on file type/extension
 */
const fileIcon = computed(() => {
  if (props.node.type === 'folder') {
    return isExpanded.value ? '📂' : '📁'
  }

  const ext = props.node.name.includes('.')
    ? props.node.name.split('.').pop().toLowerCase()
    : ''

  const iconMap = {
    // Code
    js: '🟨', jsx: '⚛️', ts: '🔵', tsx: '⚛️',
    vue: '💚', html: '🟠', css: '🔷', scss: '🔷',
    py: '🐍', rb: '💎', php: '🐘', java: '☕',
    c: '🔧', cpp: '🔧', cs: '🔷', go: '🔵',
    rs: '🦀', swift: '🐦', kt: '🟣',
    // Data
    json: '📋', xml: '📋', yaml: '📋', yml: '📋',
    csv: '📊', sql: '🗄️',
    // Config
    env: '🔒', config: '⚙️', conf: '⚙️',
    // Media
    png: '🖼️', jpg: '🖼️', jpeg: '🖼️', gif: '🖼️',
    svg: '🖼️', webp: '🖼️', ico: '🖼️',
    mp4: '🎬', avi: '🎬', mov: '🎬', mkv: '🎬',
    mp3: '🎵', wav: '🎵', flac: '🎵', ogg: '🎵',
    // Documents
    pdf: '📕', doc: '📘', docx: '📘', xls: '📗',
    xlsx: '📗', ppt: '📙', pptx: '📙', txt: '📄',
    md: '📝', rtf: '📄',
    // Archives
    zip: '📦', rar: '📦', '7z': '📦', tar: '📦',
    gz: '📦', gzip: '📦',
    // Executables
    exe: '⚡', msi: '⚡', dmg: '⚡', app: '⚡',
    sh: '🐚', bat: '🐚', ps1: '🐚',
    // Other
    log: '📃', tmp: '🗑️', lock: '🔒'
  }

  return iconMap[ext] || '📄'
})

/**
 * Format the modified date to a readable string
 */
const formattedDate = computed(() => {
  if (!props.node.modifiedAt) return ''
  const date = new Date(props.node.modifiedAt)
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
})

/**
 * Format file size
 */
const formattedSize = computed(() => {
  if (props.node.type === 'folder') return ''
  const bytes = props.node.size
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + units[i]
})

/**
 * Indentation style based on depth
 */
const indentStyle = computed(() => ({
  paddingLeft: `${12 + props.depth * 20}px`
}))
</script>

<template>
  <div class="tree-node">
    <!-- Node row -->
    <div
      class="node-row"
      :class="{ 'is-folder': node.type === 'folder', 'is-file': node.type === 'file' }"
      :style="indentStyle"
      @click="toggleExpand"
    >
      <!-- Expand/collapse arrow for folders -->
      <span v-if="node.type === 'folder'" class="expand-arrow">
        {{ isExpanded ? '▼' : '▶' }}
      </span>
      <span v-else class="expand-arrow spacer"></span>

      <!-- File type icon -->
      <span class="file-icon">{{ fileIcon }}</span>

      <!-- File/folder name -->
      <span class="node-name" :title="node.path">{{ node.name }}</span>

      <!-- File size -->
      <span v-if="node.type === 'file'" class="node-size">{{ formattedSize }}</span>

      <!-- Last modified date -->
      <span class="node-date">{{ formattedDate }}</span>

      <!-- Child count badge for collapsed folders -->
      <span
        v-if="node.type === 'folder' && !isExpanded && node.children.length > 0"
        class="child-count"
      >
        {{ node.children.length }} items
      </span>
    </div>

    <!-- Children (rendered recursively) -->
    <div v-if="node.type === 'folder' && isExpanded && node.children.length > 0" class="node-children">
      <TreeView
        v-for="(child, index) in node.children"
        :key="child.path + '-' + index"
        :node="child"
        :depth="depth + 1"
      />
    </div>

    <!-- Empty folder message -->
    <div
      v-if="node.type === 'folder' && isExpanded && node.children.length === 0"
      class="empty-folder"
      :style="indentStyle"
    >
      <span class="empty-text">(empty folder)</span>
    </div>
  </div>
</template>

<style scoped>
.tree-node {
  user-select: none;
}

.node-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: default;
  transition: background 0.15s;
  min-height: 34px;
}

.node-row:hover {
  background: #25253e;
}

.node-row.is-folder {
  cursor: pointer;
}

.expand-arrow {
  font-size: 0.6rem;
  color: #666;
  width: 12px;
  flex-shrink: 0;
  transition: transform 0.2s;
}

.expand-arrow.spacer {
  visibility: hidden;
}

.file-icon {
  font-size: 1rem;
  flex-shrink: 0;
  width: 20px;
  text-align: center;
}

.node-name {
  flex: 1;
  font-size: 0.9rem;
  color: #ddd;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.is-folder .node-name {
  color: #f0f0ff;
  font-weight: 500;
}

.node-size {
  font-size: 0.8rem;
  color: #888;
  font-family: 'Consolas', 'Courier New', monospace;
  min-width: 70px;
  text-align: right;
  flex-shrink: 0;
}

.node-date {
  font-size: 0.75rem;
  color: #666;
  min-width: 140px;
  text-align: right;
  flex-shrink: 0;
}

.child-count {
  font-size: 0.7rem;
  color: #555;
  background: #1a1a2e;
  padding: 2px 8px;
  border-radius: 10px;
  border: 1px solid #2a2a3e;
  flex-shrink: 0;
}

.node-children {
  border-left: 1px solid #2a2a3e;
  margin-left: 24px;
}

.empty-folder {
  padding: 8px 12px;
  color: #555;
  font-size: 0.8rem;
  font-style: italic;
}

.empty-text {
  margin-left: 20px;
}
</style>