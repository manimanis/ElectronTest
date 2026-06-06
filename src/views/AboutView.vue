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
        sélectionner un dossier local et d’analyser son contenu dans une vue arborescente structurée.</p>

      <div class="tech-section">
        <h2>🔧 Technologies Utilisées</h2>
        <ul class="tech-list">
          <li><strong>Frontend :</strong> Vue.js 3.5 (Composition API)</li>
          <li><strong>Build :</strong> Vite 6</li>
          <li><strong>Application bureau :</strong> Electron 41</li>
          <li><strong>Packaging :</strong> electron-builder 26</li>
          <li><strong>Router :</strong> Vue Router 4</li>
        </ul>
      </div>

      <div class="features-section">
        <h2>✨ Fonctionnalités</h2>
        <ul class="features-list">
          <li>📁 Sélection native de dossiers</li>
          <li>🔍 Analyse récursive des dossiers</li>
          <li>🌳 Vue arborescente avec expansion/contraction</li>
          <li>📊 Statistiques récapitulatives (fichiers, dossiers, taille)</li>
          <li>🔎 Recherche par nom de fichier et filtre par extension</li>
          <li>🎨 50+ icônes de types de fichiers</li>
          <li>⚡ Analyse asynchrone avec annulation pour dossiers volumineux</li>
          <li>🔒 IPC sécurisé avec contextIsolation</li>
        </ul>
      </div>

      <div class="license-section">
        <p class="license-text">
          This project is licensed under the <strong>MIT License</strong>.
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
.features-section {
  margin-bottom: 24px;
}

.tech-section h2,
.features-section h2 {
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