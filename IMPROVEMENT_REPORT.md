# 📋 Rapport d'améliorations — Folder Cleaner

Analyse complète du projet Electron + Vue.js 3. Ce rapport identifie **les améliorations encore pertinentes** en tenant compte de ce qui a déjà été implémenté.

> **Note** : Ce rapport est mis à jour régulièrement. Les cases cochées ci-dessous reflètent l'état actuel du code.

---

## 🔴 Problèmes critiques (Sécurité)

### 1. `nodeIntegration: true` — VULNÉRABILITÉ SÉCURITÉ
- **Fichier** : `electron/main.js` ligne 359
- **Problème** : `nodeIntegration` est `true` alors qu'il y a un commentaire TODO disant qu'il devrait être `false`. Avec `contextIsolation: true` et un preload script, **nodeIntegration devrait être `false`** pour éviter les attaques XSS qui pourraient accéder au système de fichiers.
- **Solution** : Mettre `nodeIntegration: false` dans les `webPreferences`. Le code utilise déjà le preload script correctement, donc cela devrait fonctionner.
- **Impact** : 🔴 Sécurité critique — un site web malveillant chargé dans le renderer pourrait exécuter du code Node.js.

### 2. ~~`console.log` écrasé globalement — crash potentiel~~ ✅ Corrigé
- **Fichier** : `electron/main.js` lignes 15-20
- **Statut** : Corrigé — null check sur `mainWindow` + appel à `originalLog` ajouté.

---

## 🟠 Problèmes de qualité du code

### 3. `formatSize()` dupliqué entre main.js et format.js
- **Fichiers** : `electron/main.js` (ligne 23) et `src/utils/format.js`
- **Problème** : La fonction `formatSize()` existe dans les deux fichiers avec exactement le même code. Le rapport précédent suggérait de créer `src/utils/format.js` — c'est fait côté frontend, mais **main.js n'utilise toujours pas le module partagé**.
- **Solution** : Supprimer `formatSize()` de `main.js` et l'importer depuis un module partagé, ou accepter la duplication pour le processus principal (qui ne peut pas importer des modules ES).
- **Impact** : Maintenance, cohérence.

### 4. Code mort (dead code)
- **`getStandardFolders()`** (`electron/main.js` ligne 664-677) : Jamais appelée, remplacée par `getConfiguredFolders()`.
- **`findBacFolders()`** (`electron/main.js` ligne 638-658) : Jamais appelée.
- **`isAllSelected()`** (`src/components/ShortcutSection.vue` ligne 17-19) : Toujours retourne `false`, non utilisée.
- **`logger`** (`src/utils/logger.js`) : Module jamais importé nulle part dans le projet.
- **Solution** : Supprimer tout le code mort.
- **Impact** : Lisibilité, taille du bundle.

### 5. ~~Import redondant de `shell` dans les IPC handlers~~ ✅ Corrigé
- **Statut** : Corrigé — les `require('electron')` redondants dans les IPC handlers ont été supprimés.

### 6. ~~`require('child_process')` appelé en inline~~ ✅ Corrigé
- **Statut** : Corrigé — `execSync` est maintenant importé en haut du fichier.

### 7. ~~`path` importé mais jamais utilisé dans vite.config.js~~ ✅ Corrigé
- **Statut** : Corrigé — l'import inutilisé a été supprimé.

### 8. ~~`jsdom` en devDependencies mais inutilisé~~ ✅ Corrigé
- **Statut** : Corrigé — `jsdom` a été supprimé des devDependencies.

### 9. Scripts d'icônes dupliqués
- **Fichiers** : `scripts/generate-icon.js` et `scripts/generate-icon.mjs`
- **Problème** : Deux scripts pour générer l'icône, potentiellement confus.
- **Solution** : Supprimer l'ancien `generate-icon.js` et garder uniquement `generate-icon.mjs`.
- **Impact** : Clarté.

---

## 🟠 Architecture & Design

### 10. ~~Tests unitaires~~ ✅ Implémenté
- **Statut** : 38 tests sur 4 fichiers couvrant `formatSize`, `TabBar`, `RecycleBinBar`, `ActionPanel`. Config `vitest.config.ts` avec `happy-dom` et globals.
- **Note** : Vitest 4.x nécessite `"type": "module"` dans `package.json` et ne supporte pas les imports explicites de `describe`/`it`/`expect` depuis `vitest` (utiliser les globals).

### 11. ~~Configuration ESLint/Prettier~~ ✅ Implémenté
- **Statut** : `eslint.config.js` (flat config), `.prettierrc`, `.prettierignore` créés. Dépendances installées.
- **Note** : Il reste à exécuter le lint sur le code existant pour corriger les erreurs.

### 12. Pas de CI/CD
- **Problème** : Pas de pipeline de build/test automatique.
- **Solution** : Ajouter un workflow GitHub Actions pour :
  - Lint le code
  - Lancer les tests
  - Builder l'application
- **Impact** : Qualité continue.

### 13. Application Windows-only sans gestion multi-plateforme
- **Problème** : L'application est entièrement conçue pour Windows :
  - `wmic` pour lister les disques (ligne 609)
  - PowerShell/VBS pour la corbeille (lignes 1082-1127)
  - Détection `.lnk` pour les raccourcis Windows
  - Patterns de chemins avec `\`
- **Solution** :
  - Ajouter des vérifications `process.platform` avant les appels Windows-specific
  - Fournir des fallbacks ou des messages d'erreur clairs sur macOS/Linux
  - Ou documenter clairement que l'app est Windows-only
- **Impact** : Portabilité.

### 14. `createMemoryHistory` vs `createWebHashHistory`
- **Fichier** : `src/router/index.js`
- **Problème** : `createMemoryHistory` empêche la navigation par URL. Pour Electron, `createWebHashHistory` est souvent préféré car il permet le back/forward navigation.
- **Solution** : Évaluer le passage à `createWebHashHistory` si la navigation historique est souhaitée.
- **Impact** : UX navigation.

---

## 🟡 Améliorations fonctionnelles restantes

### 15. Pas de gestion des erreurs individuelles en batch
- **Problème** : Dans `cleaner:moveToTrash`, `cleaner:permanentDelete`, `cleaner:moveToFolder` — si un élément échoue, les suivants sont quand même traités, mais il n'y a pas de rapport détaillé par élément dans l'UI.
- **Solution** : Afficher un résumé détaillé après chaque opération batch (ex: "3 réussis, 1 échoué — accès refusé pour `fichier.pdf`").
- **Impact** : Transparence.

### 16. Aucune annulation possible pendant les opérations batch
- **Problème** : Les opérations `moveToTrash`, `permanentDelete`, `moveToFolder` traitent tous les éléments séquentiellement sans possibilité d'annulation intermédiaire.
- **Solution** : Ajouter un flag d'annulation dans la boucle de traitement, similaire à `currentScanAbort` pour le scan.
- **Impact** : UX, sécurité.

### 17. `confirm()` natif utilise au lieu de modales personnalisées
- **Fichiers** : `CleanerView.vue` (lignes 290, 339), `FolderConfigView.vue` (lignes 111, 134)
- **Problème** : Les boîtes de dialogue `confirm()` sont natives et n'ont pas le thème de l'application.
- **Solution** : Créer un composant `ConfirmDialog.vue` réutilisable avec le thème de l'app, ou utiliser une bibliothèque légère.
- **Impact** : Cohérence visuelle.

### 18. Pas de progression pendant l'archivage 7z
- **Fichier** : `electron/main.js` ligne 1051
- **Problème** : `execSync` bloque le processus principal pendant l'archivage (timeout 5 minutes). Aucune progression n'est renvoyée à l'utilisateur.
- **Solution** :
  - Utiliser `exec` (async) au lieu de `execSync`
  - Parser la sortie de 7zip pour extraire le pourcentage de progression
  - Envoyer des mises à jour via `mainWindow.webContents.send('archive:progress', percent)`
- **Impact** : UX pour les gros volumes.

### 19. Recherche non effacée au changement d'onglet
- **Fichier** : `CleanerView.vue`
- **Problème** : La variable `rawSearchQuery` est partagée entre tous les onglets. Quand on change d'onglet, la recherche reste active.
- **Solution** : Réinitialiser `rawSearchQuery` quand `activeTab` change, ou stocker la recherche par onglet.
- **Impact** : UX.

### 20. La virtualisation a une hauteur fixe (400px)
- **Fichier** : `src/components/ItemList.vue` ligne 422
- **Problème** : Le `RecycleScroller` a un `max-height: 400px` fixe, ce qui gaspille de l'espace sur les grands écrans et en manque sur les petits.
- **Solution** : Calculer la hauteur dynamiquement en fonction de la taille de la fenêtre, ou utiliser un `ResizeObserver`.
- **Impact** : Responsive.

### 21. ~~Styles du ContextMenu non scoped~~ ✅ Corrigé
- **Statut** : Corrigé — le `<style>` est maintenant `scoped`.

### 22. `lastClickedItemPath` déclaré comme prop dans ItemList mais jamais passé
- **Fichier** : `src/components/ItemList.vue` ligne 16
- **Problème** : La prop `lastClickedItemPath` est définie dans ItemList mais jamais transmise depuis CleanerView.
- **Solution** : Soit supprimer la prop (non utilisée dans le template), soit la connecter si elle est nécessaire pour un futur usage.
- **Impact** : Propreté du code.

---

## 🟡 Performance

### 23. Calcul synchrone des tailles de dossiers
- **Fichier** : `electron/main.js` — `getDirectorySize()` (ligne 767) et `scanFolderForCleaning()` (ligne 795)
- **Problème** : Le calcul des tailles est **synchrone et bloquant**. Pour un dossier avec des milliers de fichiers, cela bloque le processus principal.
- **Solution** :
  - Utiliser des versions asynchrones (`fs.promises.stat`, `fs.promises.readdir`)
  - Ou calculer les tailles en arrière-plan avec un Worker
  - Ou envoyer la progression pendant le calcul
- **Impact** : Responsive UI pendant le scan.

### 24. Risque de stack overflow avec `getDirectorySize` récursif
- **Fichier** : `electron/main.js` ligne 767
- **Problème** : `getDirectorySize` est récursif sans limite de profondeur. Un lien symbolique circulaire ou un dossier très profond pourrait provoquer un stack overflow.
- **Solution** : Ajouter un paramètre `maxDepth` et un Set de chemins visités pour détecter les cycles.
- **Impact** : Stabilité.

### 25. Aucun cache des résultats de scan
- **Problème** : Chaque appel à `cleaner:getStandardFolders` rescanne entièrement tous les dossiers. Si l'utilisateur navigue entre les pages, les mêmes dossiers sont rescanés.
- **Solution** : Implémenter un cache TTL (time-to-live) des résultats de scan, ou n'invalider le cache que lorsque l'utilisateur clique sur "Recharger".
- **Impact** : Performance.

---

## 🟢 Améliorations UX mineures

### 26. Pas de tooltip sur les boutons d'action
- **Problème** : Les boutons de l'ActionPanel ont des `title` mais pas de tooltip visuel styled.
- **Solution** : Créer un composant `Tooltip` ou utiliser CSS `:hover::after` pour des tooltips stylisés.

### 27. Absence de raccourci Ctrl+Z (annulation)
- **Problème** : Le raccourci Ctrl+Z n'est pas implémenté.
- **Solution** : Implémenter un système d'historique d'annulation (undo stack) pour les opérations de suppression/déplacement.

### 28. La version dans AboutView est en dur
- **Fichier** : `src/views/AboutView.vue` ligne 11
- **Problème** : `Version 1.0.0` est écrite en dur au lieu d'être lue depuis `package.json`.
- **Solution** : Utiliser `import.meta.env.VITE_APP_VERSION` ou passer la version via le preload script.

### 29. Pas d'icône d'app dans la titlebar Electron
- **Fichier** : `electron/main.js`
- **Problème** : L'icône SVG est utilisée pour la fenêtre, mais Electron peut avoir des problèmes avec les SVG comme icônes de fenêtre sur Windows.
- **Solution** : Utiliser l'icône `.ico` générée par `generate-icon.mjs` pour la fenêtre en production.

### 30. `allowScripts` dans package.json pourrait être plus restrictif
- **Fichier** : `package.json` lignes 52-57
- **Problème** : Les flags `allowScripts` pour `sharp`, `esbuild`, `electron-winstaller` sont à `true`. Cela pourrait poser des risques supply chain.
- **Solution** : Évaluer si chaque package a vraiment besoin d'exécuter des scripts d'installation.

---

## 📊 Résumé des priorités

| Priorité | # | Amélioration | Impact | Difficulté |
|----------|---|-------------|--------|------------|
| 🔴 Critique | 1 | `nodeIntegration: false` | 🔒 Sécurité | Très faible |
| 🟠 Haute | 10 | Tests unitaires (plus de fichiers) | 🧪 Fiabilité | Moyenne |
| 🟠 Haute | 11 | Config ESLint/Prettier | 🔧 Qualité | Faible |
| 🟠 Haute | 23 | Scan async non-bloquant | ⚡ Performance | Élevée |
| 🟠 Haute | 24 | Stack overflow protection | 💥 Stabilité | Faible |
| 🟠 Haute | 18 | Progression archivage | 📊 UX | Moyenne |
| 🟠 Haute | 17 | Modales de confirmation custom | 🎨 UI | Moyenne |
| 🟠 Moyenne | 4 | Supprimer `findBacFolders()` + `logger.js` | 🧹 Propreté | Faible |
| 🟠 Moyenne | 3 | Dedup formatSize | 🔧 Maintenance | Faible |
| 🟠 Moyenne | 15 | Rapport erreurs batch | 📊 UX | Moyenne |
| 🟠 Moyenne | 16 | Annulation batch | 📊 UX | Moyenne |
| 🟡 Basse | 9 | Supprimer `generate-icon.js` | 🧹 Propreté | Très faible |
| 🟡 Basse | 13 | Multi-plateforme | 🖥️ Portabilité | Élevée |
| 🟡 Basse | 19 | Reset recherche par onglet | 📊 UX | Faible |
| 🟡 Basse | 20 | Hauteur scroller dynamique | 📊 Responsive | Moyenne |
| 🟡 Basse | 22 | Prop inutilisée ItemList | 🧹 Propreté | Très faible |
| 🟡 Basse | 25 | Cache résultats scan | ⚡ Performance | Moyenne |
| 🟢 Mineure | 28 | Version dynamique About | 🧹 Propreté | Faible |
| 🟢 Mineure | 12 | CI/CD | 🔧 DevOps | Moyenne |
| 🟢 Mineure | 27 | Ctrl+Z annulation | 📊 UX | Élevée |

---

## ✅ Améliorations déjà implémentées (depuis le dernier rapport)

Les améliorations suivantes du rapport précédent ont été **correctement implémentées** :

| # | Amélioration | Statut |
|---|-------------|--------|
| 2 | Composants extraits (TabBar, ItemList, ActionPanel, etc.) | ✅ Fait |
| 4 | Transitions route (keep-alive) | ✅ Fait |
| 5 | Thème sombre/clair avec toggle | ✅ Fait |
| 6 | Skeleton loader | ✅ Fait |
| 7 | Badges colorés dans les onglets | ✅ Fait |
| 11 | Recherche/filtrage dans les listes | ✅ Fait |
| 12 | Sélection par plage (Shift+clic) | ✅ Fait |
| 13 | Raccourcis clavier (Ctrl+A, Échap, Suppr, F5) | ✅ Fait |
| 16 | Sauvegarde automatique config (debounce) | ✅ Fait |
| 17 | Prévisualisation avant action | ✅ Fait |
| 18 | Statistiques de session | ✅ Fait |
| 19 | Filtrage par date (7j, 30j, 90j, 1an) | ✅ Fait |
| 20 | Bouton "Ouvrir dans l'Explorateur" | ✅ Fait |
| 23 | Validation en temps réel des chemins | ✅ Fait |
| 25 | Double confirmation suppression (taper "SUPPRIMER") | ✅ Fait |
| 27 | Virtualisation des listes (vue-virtual-scroller) | ✅ Fait |
| 29 | Debounce sur la recherche (300ms) | ✅ Fait |
| 31 | Menu contextuel (clic droit) | ✅ Fait |
| 34 | Persistance de l'onglet actif | ✅ Fait |

---

## 🔄 Corrections récentes (7 juin 2026)

Les améliorations suivantes du rapport ont été **récemment corrigées manuellement** :

| # | Amélioration | Statut |
|---|-------------|--------|
| 2 | Fix `console.log` crash (null check + originalLog) | ✅ Corrigé |
| 4 (partiel) | Suppression de `getStandardFolders()` (code mort) | ✅ Corrigé |
| 5 | Import redondant de `shell` supprimé des IPC handlers | ✅ Corrigé |
| 6 | `execSync` importé en haut de `main.js` | ✅ Corrigé |
| 7 | Import `path` inutilisé supprimé de `vite.config.js` | ✅ Corrigé |
| 8 | `jsdom` supprimé des devDependencies | ✅ Corrigé |
| 10 (partiel) | Tests unitaires créés (`tests/format.test.js`) | ✅ Corrigé |
| 11 (partiel) | ESLint + Prettier ajoutés aux devDependencies | ✅ Corrigé |
| 21 | Styles du ContextMenu passés en `scoped` | ✅ Corrigé |

### Corrections restantes à faire

| # | Amélioration | Raison |
|---|-------------|--------|
| 1 | `nodeIntegration: true` → `false` | 🔴 Sécurité — toujours en `true` |
| 4 (suite) | Supprimer `findBacFolders()` + `logger.js` | Code mort toujours présent |
| 9 | Supprimer `generate-icon.js` (garder `.mjs`) | Les deux scripts existent encore |

---

## 📁 Fichiers ajoutés dans cette session

| Fichier | Description |
|---------|-------------|
| `eslint.config.js` | Configuration ESLint flat config pour Vue.js 3 |
| `.prettierrc` | Configuration Prettier (singleQuote, no semi) |
| `.prettierignore` | Fichiers exclus du formatting |
| `vitest.config.ts` | Configuration vitest dédiée (globals, happy-dom) |
| `tests/setup.js` | Mock de `window.electronAPI` pour les tests |
| `tests/format.test.js` | Tests de `formatSize` (7 cas) |
| `tests/components/TabBar.test.js` | Tests du composant TabBar (7 cas) |
| `tests/components/RecycleBinBar.test.js` | Tests du composant RecycleBinBar (8 cas) |
| `tests/components/ActionPanel.test.js` | Tests du composant ActionPanel (16 cas) |

---

*Rapport mis à jour le 7 juin 2026 — basé sur l'analyse de l'intégralité du code source du projet.*
