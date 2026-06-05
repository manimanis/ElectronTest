# 📂 Folder Analyzer

A **desktop application** built with **Vue.js 3** and **Electron** that allows you to select a local folder and analyze its contents in a structured tree view.

![Technologies](https://img.shields.io/badge/Vue.js-3.4-4FC08D?logo=vue.js)
![Technologies](https://img.shields.io/badge/Electron-30-47848F?logo=electron)
![Technologies](https://img.shields.io/badge/Vite-5-646CFF?logo=vite)
![License](https://img.shields.io/badge/License-MIT-green)

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| **📁 Folder Selection** | Native OS dialog to pick any directory on your computer |
| **🔍 Folder Analysis** | Recursive scanning of all files and subdirectories |
| **🌳 Tree View** | Hierarchical display with expand/collapse (auto-expands first 2 levels) |
| **📊 Summary Stats** | Total files, folders, and cumulative size |
| **🔎 Filtering** | Search by filename and filter by file extension |
| **🎨 File Type Icons** | 50+ contextual icons for code, media, documents, archives, etc. |
| **🖼️ Application Icon** | Custom SVG icon with auto-generated ICO for Windows builds |
| **🔒 Security** | `contextIsolation` enabled, `nodeIntegration` disabled, secure IPC bridge |

---

## 🚀 Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- [npm](https://www.npmjs.com/) (v9 or higher)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd folder-analyzer

# Install dependencies
npm install
```

### Development

Run the application in development mode with hot-reload:

```bash
npm run dev
```

This starts:
1. **Vite dev server** for the Vue frontend (port 5173)
2. **Electron main process** with the preload script
3. **Hot Module Replacement** for instant UI updates

### Build for Production

Build the Vue frontend and Electron files:

```bash
npm run build
```

The `prebuild` script automatically generates the ICO icon from the SVG source.

Output:
- `dist/` — Built Vue frontend (HTML, CSS, JS)
- `dist-electron/` — Built Electron main + preload scripts

### Generate Executable (.exe)

Package the app into a Windows portable executable using **electron-builder**:

```bash
npm run dist
```

The `predist` script automatically generates the ICO icon before packaging.

Output: `release/` folder containing:
- `Folder Analyzer-1.0.0-portable.exe` — Standalone portable executable
- `win-unpacked/` — Unpacked application directory

---

## 🏗️ Project Structure

```
folder-analyzer/
├── electron/                  # Electron main process
│   ├── main.js                # App window, IPC handlers, filesystem logic
│   └── preload.js             # Secure bridge (contextBridge API)
├── src/                       # Vue 3 frontend
│   ├── main.js                # Vue app entry point
│   ├── App.vue                # Root component with state management
│   └── components/
│       ├── FolderSelector.vue # "Select Folder" button + path display
│       ├── StatsSummary.vue   # File/folder count + total size cards
│       ├── FilterBar.vue      # Search input + extension filter
│       └── TreeView.vue       # Recursive tree node component
├── build/                     # Application assets
│   └── icon.svg               # Source SVG icon (256x256)
├── scripts/                   # Build helper scripts
│   ├── generate-icon.mjs      # SVG → ICO/PNG conversion (ESM)
│   └── generate-icon.js       # Documentation script (CommonJS)
├── index.html                 # Entry HTML file
├── vite.config.js             # Vite + electron plugin configuration
├── package.json               # Dependencies and scripts
├── .gitignore                 # Git exclusion rules
├── LICENSE.md                 # MIT License
└── README.md                  # This file
```

---

## 🔧 Technology Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Vue.js 3 (Composition API, `<script setup>`) |
| **Build Tool** | Vite 5 |
| **Desktop Shell** | Electron 30 |
| **Packaging** | electron-builder (portable target) |
| **File System** | Node.js `fs` module (via main process) |
| **Icon Processing** | Sharp + png-to-ico |
| **Communication** | IPC + contextBridge (secure) |

---

## 🖼️ Application Icon

The application includes a custom-designed icon with three formats:

| Format | File | Size | Purpose |
|--------|------|------|---------|
| **SVG** | `build/icon.svg` | 1.9 KB | Source vector, window title bar, dev favicon |
| **ICO** | `build/icon.ico` | 370 KB | Windows executable (16/32/48/64/128/256px) |
| **PNG** | `build/icon-256.png` | 7.8 KB | Fallback for Linux/macOS |

The icon is automatically generated before each build via the `prebuild` / `predist` scripts.

### Icon Design

- **Purple gradient circle** (#6c63ff → #4834d4) — matches the UI accent color
- **Orange folder** with tab — represents directory scanning
- **White document** with text lines — represents file analysis
- **Magnifying glass overlay** — represents the search/inspection feature

---

## 🛡️ Security Architecture

The application follows Electron security best practices:

- **`contextIsolation: true`** — The renderer process cannot access Node.js or Electron APIs directly
- **`nodeIntegration: false`** — No Node.js globals in the renderer
- **Preload Script** — Uses `contextBridge` to expose only specific safe APIs to the renderer:
  - `selectFolder()` — Open native folder dialog
  - `analyzeFolder(path)` — Scan folder contents
  - `getFileInfo(path)` — Get single file details

All filesystem operations happen exclusively in the **main process**, keeping the renderer secure.

---

## 📊 Data Flow

```
[User] → Clicks "Select Folder"
         ↓
[Vue Component] → window.electronAPI.selectFolder()
                   ↓ (IPC invoke)
[Preload Script] → contextBridge → ipcRenderer.invoke()
                   ↓
[Main Process] → dialog.showOpenDialog()
                 ↓
                 Returns folder path to renderer
                 ↓
[Vue Component] → window.electronAPI.analyzeFolder(path)
                   ↓ (IPC invoke)
[Main Process] → fs.readdirSync() + fs.statSync()
                 ↓
                 Returns { tree, stats }
                 ↓
[TreeView.vue] → Recursive rendering with expand/collapse
```

---

## 🗂️ File Type Icons

The app includes mapped icons for 50+ file extensions, grouped by category:

| Category | Extensions |
|----------|-----------|
| **Code** | `.js` `.ts` `.vue` `.py` `.java` `.go` `.rs` `.cpp` |
| **Web** | `.html` `.css` `.scss` `.jsx` `.tsx` |
| **Media** | `.png` `.jpg` `.gif` `.svg` `.mp4` `.mp3` |
| **Documents** | `.pdf` `.docx` `.xlsx` `.md` `.txt` |
| **Archives** | `.zip` `.rar` `.7z` `.tar` `.gz` |
| **Executables** | `.exe` `.msi` `.sh` `.bat` |

---

## 📝 License

This project is licensed under the **MIT License** — see the [LICENSE.md](LICENSE.md) file for details.

---

## 🤝 Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.

1. Fork the project
2. Create your feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m 'Add my feature'`
4. Push to the branch: `git push origin feature/my-feature`
5. Open a Pull Request