<script setup>
/**
 * AboutView.vue - Application information page
 */
</script>

<template>
  <div class="about-view">
    <div class="about-card">
      <h1 class="about-title">📂 Folder Cleaner</h1>
      <p class="about-version">Version 1.0.0</p>
      <p class="about-description">Une application de bureau construite avec Vue.js 3 et Electron qui permet de
        nettoyer, organiser et archiver le contenu de vos dossiers système (Bureau, Documents, Téléchargements…).</p>

      <div class="tech-section">
        <h2>🔧 Technologies Utilisées</h2>
        <ul class="tech-list">
          <li><strong>Frontend :</strong> Vue.js 3.5 (Composition API)</li>
          <li><strong>Build :</strong> Vite 6</li>
          <li><strong>Application bureau :</strong> Electron 41</li>
          <li><strong>Packaging :</strong> electron-builder 26</li>
          <li><strong>Router :</strong> Vue Router 4</li>
          <li><strong>Compression :</strong> 7zip-bin</li>
          <li><strong>Image :</strong> Sharp</li>
        </ul>
      </div>

      <div class="features-section">
        <h2>✨ Fonctionnalités</h2>
        <ul class="features-list">
          <li>🧹 Nettoyage des dossiers système (Bureau, Documents, Téléchargements…)</li>
          <li>🗑️ Suppression vers la corbeille, suppression définitive ou déplacement</li>
          <li>📑 Affichage en onglets — un onglet par dossier configuré</li>
          <li>🔀 Tri multi-colonnes (nom, taille, type) avec Shift+clic pour combiner les critères</li>
          <li>🔗 Détection et suppression des raccourcis en double</li>
          <li>📦 Archivage 7z des éléments sélectionnés</li>
          <li>🧹 Gestion de la corbeille Windows (statut, vidage)</li>
          <li>⚙️ Configuration personnalisable des dossiers avec patterns regex</li>
          <li>🚫 Les raccourcis (.lnk) sont exclus automatiquement du nettoyage</li>
          <li>🔒 IPC sécurisé avec contextIsolation</li>
          <li>🔔 Système de notifications toast</li>
        </ul>
      </div>

      <div class="author-section">
        <h2>👤 Auteur</h2>
        <p class="author-name">Mohamed Anis MANI</p>
        <p class="author-links">
          <a href="https://github.com/manimanis/ElectronTest" target="_blank" rel="noopener" class="github-link">
            💻 GitHub
          </a>
        </p>
      </div>

      <div class="license-section">
        <p class="license-text">
          Ce projet est distribué sous la licence <strong>MIT License</strong>.
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.about-view {
  max-width: 700px;
  margin: 0 auto;
  padding: 20px 0;
}

.about-card {
  background: #1a1a2e;
  border: 1px solid #2a2a3e;
  border-radius: 12px;
  padding: 32px;
}

.about-title {
  font-size: 1.8rem;
  color: #ffffff;
  text-align: center;
  margin-bottom: 4px;
}

.about-version {
  text-align: center;
  color: #6c63ff;
  font-size: 0.9rem;
  font-family: 'Consolas', monospace;
  margin-bottom: 20px;
}

.about-description {
  color: #aaa;
  font-size: 0.95rem;
  line-height: 1.6;
  text-align: center;
  margin-bottom: 28px;
  padding: 0 10px;
}

.tech-section,
.features-section,
.author-section {
  margin-bottom: 24px;
}

.tech-section h2,
.features-section h2,
.author-section h2 {
  font-size: 1.1rem;
  color: #e0e0e0;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #2a2a3e;
}

.tech-list,
.features-list {
  list-style: none;
  padding: 0;
}

.tech-list li,
.features-list li {
  padding: 6px 0;
  color: #bbb;
  font-size: 0.9rem;
  line-height: 1.5;
}

.tech-list li strong {
  color: #ddd;
}

.author-name {
  color: #e0e0e0;
  font-size: 0.95rem;
  font-weight: 600;
  margin-bottom: 8px;
}

.author-links {
  display: flex;
  gap: 16px;
}

.github-link {
  color: #6c63ff;
  text-decoration: none;
  font-size: 0.9rem;
  transition: color 0.2s;
}

.github-link:hover {
  color: #8b83ff;
  text-decoration: underline;
}

.license-section {
  text-align: center;
  padding-top: 20px;
  border-top: 1px solid #2a2a3e;
}

.license-text {
  color: #888;
  font-size: 0.85rem;
}
</style>