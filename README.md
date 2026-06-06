# 📂 Folder Cleaner

Application desktop construite avec **Vue.js 3** et **Electron** pour nettoyer vos dossiers standard (Bureau, Documents, Téléchargements) et les dossiers `Bac###` détectés automatiquement sur les racines des lecteurs.

![Technologies](https://img.shields.io/badge/Vue.js-3-4FC08D?logo=vue.js)
![Technologies](https://img.shields.io/badge/Electron-41-47848F?logo=electron)
![Technologies](https://img.shields.io/badge/Vite-6-646CFF?logo=vite)
![Technologies](https://img.shields.io/badge/7zip--bin-5-FF6600)
![License](https://img.shields.io/badge/License-MIT-green)

---

## ✨ Fonctionnalités

### Interface utilisateur

| Fonctionnalité | Description |
|---------------|-------------|
| **Tabulation par dossier** | Chaque dossier s'affiche dans un onglet avec compteur d'éléments et compteur de sélection |
| **Mise en page Grid** | Panneau de sélection à gauche, panneau d'actions à droite (sticky) |
| **Tri multi-colonnes** | Clic pour tri par un champ, Shift+clic pour ajouter un critère secondaire ou tertiaire |
| **Tri toujours dossiers d'abord** | Les dossiers apparaissent avant les fichiers quel que soit le critère de tri |
| **Sélection globale** | Sélectionner/sélectionner tout dans n'importe quel onglet |
| **Confirmation avant suppression** | Dialogue de confirmation affichant le nombre de dossiers/fichiers sélectionnés |

### Détecter et nettoyer

| Fonctionnalité | Description |
|---------------|-------------|
| **Dossiers standard** | Bureau, Documents, Téléchargements toujours affichés |
| **Dossiers Bac###** | Détection automatique sur toutes les racines des lecteurs (ex: `Bac2026`, `Bac2025`) |
| **Raccourcis dupliqués** | Détection des raccourcis .lnk en double sur le Bureau |
| **Exclusion .lnk** | Les fichiers raccourcis sont automatiquement exclus du nettoyage |

### Actions

| Action | Description |
|--------|-------------|
| **📦 Archiver en 7z** | Crée une archive 7zip au nom du dossier parent + horodatage ISO |
| **📁 Déplacer** | Déplace les éléments sélectionnés vers un autre dossier |
| **🗑️ Corbeille** | Envoie les éléments sélectionnés à la Corbeille (Windows) |
| **🗑️ Vider la corbeille** | Affiche l'état de la Corbeille et permet de la vider |
| **✕ Désélectionner tout** | Réinitialise toutes les sélections |

---

## 🚀 Démarrage rapide

### Prérequis

- [Node.js](https://nodejs.org/) (v18 ou supérieur)
- [npm](https://www.npmjs.com/) (v9 ou supérieur)

### Installation

```bash
git clone https://github.com/manimanis/ElectronTest.git
cd ElectronTest
npm install
```

### Mode développement

```bash
npm run dev
```

Lance :
1. **Vite dev server** pour le frontend Vue (port 5173)
2. **Electron main process** avec le preload script
3. **Hot Module Replacement** pour les mises à jour instantanées

### Build de production

```bash
npm run build
```

Le script `prebuild` génère automatiquement l'icône ICO depuis la source SVG.

### Générer l'exécutable (.exe)

```bash
npm run dist
```

Output dans `release/` :
- `Folder Cleaner-1.0.0-portable.exe` — Exécutable portable autonome

---

## 🏗️ Structure du projet

```
ElectronTest/
├── electron/                  # Electron main process
│   ├── main.js                # Fenêtre, handlers IPC, logique filesystem
│   └── preload.js             # Secure bridge (contextBridge API)
├── src/                       # Vue 3 frontend
│   ├── main.js                # Point d'entrée Vue
│   ├── App.vue                # Composant racine avec navigation
│   ├── router/
│   │   └── index.js           # Vue Router (CleanerView, AboutView)
│   └── views/
│       ├── CleanerView.vue    # Page principale de nettoyage
│       └── AboutView.vue      # Page À propos
├── build/                     # Assets de l'application
│   └── icon.svg               # Icône SVG source
├── scripts/                   # Scripts d'aide au build
│   ├── generate-icon.mjs      # Conversion SVG → ICO/PNG (ESM)
│   └── generate-icon.js       # Script documenté (CommonJS)
├── index.html                 # HTML d'entrée
├── vite.config.js             # Configuration Vite + electron plugin
└── package.json               # Dépendances et scripts
```

---

## 🔧 Stack technique

| Couche | Technologie |
|--------|------------|
| **Frontend** | Vue.js 3 (Composition API, `<script setup>`) |
| **Routing** | Vue Router 4 (Memory history pour Electron) |
| **Build Tool** | Vite 6 |
| **Shell Electron** | Electron 41 |
| **Packaging** | electron-builder 26 (cible portable) |
| **File System** | Node.js `fs` module (via main process) |
| **7zip** | 7zip-bin (7za.exe binaire inclus) |
| **Icône** | Sharp + png-to-ico |
| **Communication** | IPC + contextBridge (sécurisé) |

---

## 🛡️ Architecture de sécurité

- **`contextIsolation: true`** — Le renderer ne peut pas accéder aux APIs Node.js ou Electron directement
- **`nodeIntegration: false`** — Pas de globals Node.js dans le renderer
- **Preload Script** — `contextBridge` expose uniquement les APIs spécifiques et sûres au renderer
- Toutes les opérations filesystem se font exclusivement dans le **main process**

---

## 🎨 Fonctionnement du tri

Le tri supporte jusqu'à 3 critères par dossier :

| Action | Résultat |
|--------|----------|
| **Clic** sur un bouton de tri | Trie par ce champ en ascendant |
| **Clic** encore | Passe en descendant |
| **Clic** encore | Réinitialise au tri par défaut (Nom ascendant) |
| **Shift+clic** | Ajoute le champ comme critère secondaire |
| **Shift+clic** sur un critère existant | Inverse son ordre |

Les critères s'affichent avec un code couleur :
- 🔵 **Primaire** (fond violet) — 1er critère
- 🟣 **Secondaire** (fond violet foncé) — 2e critère
- ⚫ **Tertiaire** (fond très sombre) — 3e critère

---

## 📁 Nommage des archives 7z

Lors de l'archivage, le fichier 7z est automatiquement nommé avec :
- Le nom du dossier parent des éléments sélectionnés
- La date et l'heure système au format ISO

Exemple : `Desktop_2026-06-06T08-30-42.7z`

---

## ⚠️ Dépannage

### Electron ne s'est pas installé correctement

**Message d'erreur :**
```
Error: Electron failed to install correctly
```

**Solution rapide :**

Vérifiez que `package.json` contient :
```json
"allowScripts": {
  "electron@41.7.1": true,
  "sharp@0.34.5": true,
  "esbuild@0.25.12": true,
  "electron-winstaller@5.4.0": true
}
```

Puis réinstallez :
```bash
rmdir /s /q node_modules\electron
npm install
```

### Détecteur de Bac### introuvable

Si aucun dossier `Bac###` n'apparaît, vérifiez que vous avez des dossiers comme `Bac2026`, `Bac2025` à la racine d'un lecteur (ex: `D:\Bac2026`). Les lettres de lecteur C–Z sont scannées automatiquement.

---

## 📝 Licence

Ce projet est sous licence **MIT** — voir le fichier [LICENSE.md](LICENSE.md) pour les détails.

---

## 🤝 Contribuer

Les contributions sont les bienvenues ! N'hésitez pas à ouvrir des issues ou soumettre des pull requests.