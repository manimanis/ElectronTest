# 📋 Rapport d'améliorations — Folder Cleaner

Analyse complète du projet avec les améliorations fonctionnelles et visuelles possibles.

---

## 🏗️ Architecture & Structure du code

### 1. Code dupliqué entre main.js et les vues
- **Problème** : La fonction `formatSize()` est dupliquée dans `CleanerView.vue` (ligne 170) et `electron/main.js` (ligne 459).
- **Solution** : Créer un module partagé `src/utils/format.js` ou l'utiliser depuis le preload.
- **Impact** : Maintenance simplifiée, cohérence des formats.

### 2. Composants monolithiques
- **Problème** : `CleanerView.vue` fait 1494 lignes avec script + template + styles mélangés.
- **Solution** : Extraire des sous-composants :
  - `TabBar.vue` — Barre d'onglets
  - `ItemList.vue` — Liste des éléments avec tri
  - `ActionPanel.vue` — Panneau d'actions (droite)
  - `ShortcutSection.vue` — Section raccourcis dupliqués
  - `RecycleBinBar.vue` — Barre corbeille
- **Impact** : Lisibilité, réutilisabilité, testabilité.

### 3. Constants et configuration centralisée
- **Problème** : Les couleurs, timeouts, et limites sont en dur partout (ex: `4000ms` pour `showResult`, `250px` max-height).
- **Solution** : Créer `src/constants.js` pour les valeurs de configuration partagées.
- **Impact** : Personnalisation facilitée, moins de bugs.

---

## 🎨 Améliorations visuelles

### 4. Animations et transitions
- **Manque** : Aucune animation de transition entre les pages (route changes).
- **Solution** : Ajouter des `<Transition>` dans le router-view de `App.vue` :
  ```vue
  <router-view v-slot="{ Component }">
    <transition name="fade" mode="out-in">
      <keep-alive>
        <component :is="Component" />
      </keep-alive>
    </transition>
  </router-view>
  ```
- **Bonus** : Ajouter des animations d'entrée pour les cartes et listes (stagger animation).

### 5. Thème sombre amélioré
- **Manque** : Pas de support de thème clair / toggle thème.
- **Solution** : Implémenter un système de thème avec CSS variables (`--bg-primary`, `--bg-secondary`, etc.) et un toggle dans la nav.
- **Impact** : Accessibilité, confort visuel.

### 6. Indicateurs de chargement plus riches
- **Manque** : Le spinner est basique (cercle CSS).
- **Solution** : Ajouter une barre de progression pour les opérations longues (archivage, scan), ou un skeleton loader pendant le chargement initial.

### 7. Badges et compteurs plus visibles
- **Manque** : Les badges dans les onglets sont petits et peu visibles.
- **Solution** : Utiliser des couleurs vives pour les badges (ex: rouge si des éléments sélectionnés, vert sinon), avec un compteur animé.

### 8. Icônes SVG au lieu d'emojis
- **Manque** : L'application utilise des emojis partout (🧹, 📂, 🗑️…).
- **Solution** : Utiliser des icônes SVG (ex: Lucide, Heroicons) pour un rendu plus professionnel et consistant.
- **Impact** : Apparence plus polie, meilleure résolution sur écrans haute densité.

### 9. Responsive design amélioré
- **Manque** : Le layout grid passe en colonne unique sous 900px, mais le panneau d'actions pourrait mieux s'adapter.
- **Solution** :
  - Sur mobile : transformer le panneau d'actions en barre d'actions fixe en bas (comme une bottom sheet).
  - Ajouter des media queries pour les petits écrans (phone/tablette).
  - Les onglets devraient être scrollables horizontalement.

### 10. Tooltips et infobulles
- **Manque** : Pas de tooltips sur les boutons d'action (archiver, déplacer, corbeille).
- **Solution** : Ajouter des tooltips explicatifs au survol pour guider l'utilisateur.

---

## ⚡ Améliorations fonctionnelles

### 11. Recherche/filtrage dans les listes
- **Manque** : Impossible de filtrer les éléments affichés dans un dossier.
- **Solution** : Ajouter une barre de recherche au-dessus de la liste des éléments, avec filtrage en temps réel par nom et par extension.
- **Impact** : Productivité accrue pour les dossiers avec beaucoup d'éléments.

### 12. Sélection par plage (Shift+clic)
- **Manque** : La sélection multiple ne fonctionne qu'un par un ou "tout cocher".
- **Solution** : Implémenter la sélection par plage : Shift+clic sur un élément sélectionne tous les éléments entre le dernier sélectionné et celui-ci (comme dans l'Explorateur Windows).
- **Impact** : UX considérablement améliorée.

### 13. Raccourcis clavier
- **Manque** : Aucun raccourci clavier n'est implémenté.
- **Solution** :
  - `Ctrl+A` : Tout sélectionner
  - `Échap` : Désélectionner tout
  - `Suppr` : Supprimer la sélection
  - `Ctrl+Z` : Annuler la dernière action (si historique implémenté)
  - `F5` : Recharger les données
- **Impact** : Productivité pour les utilisateurs avancés.

### 14. Historique d'annulation (Undo)
- **Manque** : Les opérations de suppression/déplacement ne sont pas annulables (sauf corbeille).
- **Solution** : Maintenir un historique des 10 dernières opérations avec possibility d'annulation.
- **Impact** : Sécurité, confiance de l'utilisateur.

### 15. Progression des opérations en cours
- **Manque** : Quand on déplace/supprime de nombreux éléments, l'UI se bloque pendant l'opération.
- **Solution** :
  - Afficher une barre de progression pour les opérations par lots.
  - Traiter les éléments progressivement (par lots de 10-20).
  - Permettre l'annulation pendant le traitement.
- **Impact** : UX pour les gros volumes.

### 16. Sauvegarde automatique de la config
- **Manque** : La configuration n'est sauvegardée que manuellement (bouton "Sauvegarder").
- **Solution** : Auto-save après chaque modification (debounce de 500ms) avec indicateur visuel "Sauvegardé ✓".
- **Impact** : Moins de perte de configuration.

### 17. Prévisualisation avant action
- **Manque** : Avant de supprimer/déplacer, aucun aperçu des éléments concernés.
- **Solution** : Afficher un récapitulatif dans la boîte de confirmation : liste des éléments, taille totale, nombre de fichiers/dossiers.
- **Impact** : Sécurité, confiance.

### 18. Statistiques de nettoyage
- **Manque** : Pas de suivi de l'espace libéré au fil du temps.
- **Solution** : Ajouter un mini-dashboard avec :
  - Espace total libéré (session)
  - Nombre d'opérations effectuées
  - Historique récent des actions
- **Impact** : Motivation de l'utilisateur, visibilité sur l'impact.

### 19. Filtrage par date de modification
- **Manque** : Impossible de filtrer par date (ex: "supprimer tout ce qui a plus de 30 jours").
- **Solution** : Ajouter un filtre de date dans la liste des éléments, avec options prédéfinies (7j, 30j, 90j, 1 an).
- **Impact** : Nettoyage plus ciblé et efficace.

### 20. Ouvrir le dossier dans l'Explorateur
- **Manque** : Pas de bouton pour ouvrir un dossier dans l'Explorateur Windows directement depuis l'onglet.
- **Solution** : Ajouter un bouton "Ouvrir dans l'Explorateur" dans le panneau d'actions ou le header de l'onglet.
- **Impact** : Gain de temps, productivité.

### 21. Gestion des doublons par taille
- **Manque** : La détection de doublons se base uniquement sur les raccourcis.
- **Solution** : Étendre la détection pour trouver les fichiers/dossiers en double (même nom et/ou même taille) dans les dossiers configurés.
- **Impact** : Nettoyage plus profond.

### 22. Mode portable / multi-utilisateur
- **Problème** : `getStandardFolders()` retourne toujours les dossiers de l'utilisateur courant.
- **Solution** : Permettre de scanner les dossiers d'autres utilisateurs via les patterns (déjà supporté par le config), et afficher un indicateur de l'utilisateur concerné.

---

## 🔒 Sécurité & Robustesse

### 23. Validation des chemins
- **Manque** : Les chemins ne sont pas validés côté frontend avant envoi.
- **Solution** : Ajouter une validation en temps réel du chemin dans FolderConfigView (déjà partiellement fait via `validateFolderPath` mais pas en live).

### 24. Gestion des erreurs améliorée
- **Manque** : Certains messages d'erreur sont en anglais ("No items selected", "Failed to load folders").
- **Solution** : Uniformiser tous les messages en français et utiliser un système de traduction centralisé.
- **Impact** : Cohérence linguistique.

### 25. Protection contre les suppressions accidentelles
- **Manque** : La suppression définitive demande une confirmation mais pas de double confirmation.
- **Solution** : Pour la suppression définitive, demander à l'utilisateur de taper "SUPPRIMER" ou d'activer un switch de confirmation.
- **Impact** : Sécurité critique.

### 26. Logging et rapports d'erreur
- **Manque** : Pas de système de logging côté frontend.
- **Solution** : Implémenter un logger simple qui écrit dans un fichier de log (via IPC) pour le debugging.
- **Impact** : Diagnostique facilité.

---

## 📦 Performance

### 27. Virtualisation des listes
- **Problème** : `items-list` a un `max-height: 400px` avec overflow-y, mais rend TOUS les éléments du DOM.
- **Solution** : Utiliser `vue-virtual-scroller` ou une virtualisation manuelle pour les dossiers avec beaucoup d'éléments.
- **Impact** : Performance pour les dossiers avec 100+ éléments.

### 28. Cache des tailles de dossiers
- **Problème** : `getDirectorySize()` est appelé deux fois dans `scanFolderForCleaning()` (une fois pour `size`, une pour `formattedSize`).
- **Solution** : Calculer la taille une seule fois et la mettre en cache.
- **Impact** : Performance, surtout pour les gros dossiers.

### 29. Debounce sur la recherche (futur)
- **Problème** : Si un champ de recherche est ajouté (amélioration #11), il faut un debounce pour éviter trop de recalculs.
- **Solution** : Utiliser un debounce de 200-300ms sur l'input de recherche.

---

## 🖥️ Expérience utilisateur

### 30. Drag & Drop
- **Manque** : Pas de glisser-déposer pour déplacer des éléments.
- **Solution** : Permettre de glisser des éléments de la liste vers le bouton "Déplacer" ou vers un dossier de destination.
- **Impact** : Interaction intuitive.

### 31. Menu contextuel (clic droit)
- **Manque** : Pas de menu contextuel au clic droit sur les éléments.
- **Solution** : Afficher un menu contextuel avec les actions disponibles (Ouvrir, Déplacer, Supprimer, Propriétés).

### 32. Multi-sélection avec Ctrl+clic
- **Manque** : La sélection multiple se fait uniquement par checkbox.
- **Solution** : Permettre Ctrl+clic pour sélectionner/désélectionner individuellement, et Shift+clic pour une plage (amélioration #12).

### 33. Notification sonore (optionnelle)
- **Manque** : Pas de feedback sonore après une opération.
- **Solution** : Optionnel : jouer un son discret après une suppression/réussite (désactivé par défaut).

### 34. Persistance de l'onglet actif
- **Manque** : L'onglet actif n'est pas persisté entre les sessions.
- **Solution** : Sauvegarder l'index de l'onglet actif dans le localStorage ou la config.

### 35. Mode sombre / clair
- **Manque** : Unique thème sombre.
- **Solution** : Implémenter un toggle thème sombre/clair avec des CSS variables (amélioration #5).

---

## 📊 Résumé des priorités

| Priorité | Amélioration | Impact | Difficulté |
|----------|-------------|--------|------------|
| 🔴 Haute | #11 Recherche/filtrage | ⭐⭐⭐ | Moyenne |
| 🔴 Haute | #12 Sélection par plage | ⭐⭐⭐ | Moyenne |
| 🔴 Haute | #13 Raccourcis clavier | ⭐⭐⭐ | Faible |
| 🔴 Haute | #24 Messages d'erreur FR | ⭐⭐ | Faible |
| 🔴 Haute | #28 Cache tailles (bug perf) | ⭐⭐ | Faible |
| 🟠 Moyenne | #1 Séparation des concerns | ⭐⭐ | Moyenne |
| 🟠 Moyenne | #2 Composants modulaires | ⭐⭐ | Élevée |
| 🟠 Moyenne | #9 Responsive amélioré | ⭐⭐⭐ | Moyenne |
| 🟠 Moyenne | #15 Progression opérations | ⭐⭐ | Moyenne |
| 🟠 Moyenne | #17 Prévisualisation | ⭐⭐ | Moyenne |
| 🟠 Moyenne | #20 Ouvrir dans l'Explorateur | ⭐⭐ | Faible |
| 🟢 Basse | #5 Thème clair/sombre | ⭐⭐ | Moyenne |
| 🟢 Basse | #8 Icônes SVG | ⭐⭐ | Élevée |
| 🟢 Basse | #14 Historique annulation | ⭐⭐⭐ | Élevée |
| 🟢 Basse | #18 Statistiques nettoyage | ⭐ | Moyenne |
| 🟢 Basse | #19 Filtrage par date | ⭐⭐ | Moyenne |
| 🟢 Basse | #30 Drag & Drop | ⭐ | Élevée |
| 🟢 Basse | #31 Menu contextuel | ⭐⭐ | Moyenne |

---

*Rapport généré le 6 juin 2026 — basé sur l'analyse de l'intégralité du code source du projet.*