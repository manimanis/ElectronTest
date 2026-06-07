<script setup>
/**
 * ConfirmDialog.vue - Modal de confirmation avec le thème de l'application
 * Remplace les confirm() natifs par une modale stylisée
 *
 * Système de challenge optionnel (défini via la prop `challenge`) :
 *   - { type: 'word', expected: 'SUPPRIMER' }     → taper le mot
 *   - { type: 'number', expected: 12345 }          → taper le nombre affiché
 *   - { type: 'choice', question: '...', options: ['A', 'B'], expected: 'A' } → choix multiple
 * Si pas de challenge, simple confirmation.
 */
import { computed, ref, watch } from 'vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  title: { type: String, default: 'Confirmation' },
  message: { type: String, default: '' },
  confirmText: { type: String, default: 'Confirmer' },
  cancelText: { type: String, default: 'Annuler' },
  danger: { type: Boolean, default: false },
  /**
   * Challenge optionnel pour valider la confirmation.
   * Si défini, le bouton Confirmer reste désactivé tant que la réponse n'est pas correcte.
   * @type {null | { type: 'word'|'number'|'choice', expected: string|number, question?: string, options?: string[] }}
   */
  challenge: { type: Object, default: null }
})

const emit = defineEmits(['confirm', 'cancel'])

const userInput = ref('')
const userChoice = ref(null)

const isChallengePassed = computed(() => {
  if (!props.challenge) return true
  if (props.challenge.type === 'word') {
    return userInput.value.trim() === String(props.challenge.expected)
  }
  if (props.challenge.type === 'number') {
    return userInput.value.trim() !== '' && Number(userInput.value) === Number(props.challenge.expected)
  }
  if (props.challenge.type === 'choice') {
    return userChoice.value === props.challenge.expected
  }
  return false
})

watch(() => props.visible, (val) => {
  if (val) {
    // Reset challenge state on open
    userInput.value = ''
    userChoice.value = null
    document.addEventListener('keydown', handleKeydown)
  } else {
    document.removeEventListener('keydown', handleKeydown)
  }
})

function handleKeydown(e) {
  if (e.key === 'Escape') {
    emit('cancel')
  } else if (e.key === 'Enter' && isChallengePassed.value) {
    emit('confirm')
  }
}

function onConfirm() {
  if (isChallengePassed.value) {
    emit('confirm')
  }
}

// Random helpers for challenges
function randomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function shuffleArray(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * Helper factory : crée un challenge aléatoire selon le type demandé.
 * Utilisable depuis CleanerView pour générer des challenges variés.
 */
function generateChallenge(type) {
  if (type === 'number') {
    const expected = randomNumber(1000, 99999)
    return {
      type: 'number',
      expected,
      question: `Tapez le nombre suivant pour confirmer : ${expected}`
    }
  }
  if (type === 'word') {
    const words = ['SUPPRIMER', 'CONFIRMER', 'OUI', 'ACCEPTER', 'DETRUIRE', 
    'EFFACER', 'DANGER', 'IRREVERSIBLE', 'SUPPRESSION', 'ELIMINER', 'ENLEVER', 
    'RETIRER', 'RADIER', 'ANNULER', 'DETRUIRE', 'NETTOYER',
    'GOMMER', 'ABOLIR', 'EXTIRPER', 'OTER', 'BIFFER',
    'RAYER', 'DISSOUDRE', 'ANÉANTIR', 'PURGER',
    'ÉCARTER', 'RETRANCHER']
    const expected = words[randomNumber(0, words.length - 1)]
    return {
      type: 'word',
      expected,
      question: `Tapez "${expected}" pour confirmer`
    }
  }
  if (type === 'choice') {
    const correct = ['Oui', 'Non', 'Peut-être'][randomNumber(0, 2)]
    const wrongs = ['Oui', 'Non', 'Peut-être'].filter(w => w !== correct)
    const options = shuffleArray([correct, ...wrongs])
    return {
      type: 'choice',
      expected: correct,
      question: `Êtes-vous absolument certain de vouloir continuer ?`,
      options
    }
  }
  return null
}

defineExpose({ generateChallenge })
</script>

<template>
  <Teleport to="body">
    <Transition name="dialog">
      <div v-if="visible" class="dialog-overlay" @click.self="emit('cancel')">
        <div class="dialog-box" :class="{ 'dialog-danger': danger }">
          <div class="dialog-header">
            <span class="dialog-icon">{{ danger ? '⚠️' : 'ℹ️' }}</span>
            <h3 class="dialog-title">{{ title }}</h3>
          </div>
          <div class="dialog-body">
            <pre v-if="message" class="dialog-message">{{ message }}</pre>

            <!-- Challenge: word or number input -->
            <div v-if="challenge && (challenge.type === 'word' || challenge.type === 'number')" class="challenge">
              <label class="challenge-label">{{ challenge.question }}</label>
              <input
                v-model="userInput"
                :type="challenge.type === 'number' ? 'number' : 'text'"
                class="challenge-input"
                :placeholder="challenge.type === 'number' ? 'Nombre...' : 'Tapez ici...'"
                autofocus
              />
              <p v-if="userInput && !isChallengePassed" class="challenge-hint">
                ⚠️ Réponse incorrecte
              </p>
            </div>

            <!-- Challenge: multiple choice -->
            <div v-else-if="challenge && challenge.type === 'choice'" class="challenge">
              <p class="challenge-label">{{ challenge.question }}</p>
              <div class="choice-buttons">
                <button
                  v-for="opt in challenge.options"
                  :key="opt"
                  class="choice-btn"
                  :class="{ 'choice-btn-selected': userChoice === opt }"
                  @click="userChoice = opt"
                >
                  {{ opt }}
                </button>
              </div>
            </div>
          </div>
          <div class="dialog-footer">
            <button class="dialog-btn cancel-btn" @click="emit('cancel')">
              {{ cancelText }}
            </button>
            <button
              class="dialog-btn confirm-btn"
              :class="{ 'danger-btn': danger }"
              :disabled="!isChallengePassed"
              @click="onConfirm"
            >
              {{ confirmText }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  backdrop-filter: blur(2px);
}

.dialog-box {
  background: var(--bg-secondary, #1a1a2e);
  border: 1px solid var(--border-color, #2a2a3e);
  border-radius: 12px;
  padding: 24px;
  max-width: 500px;
  width: 90%;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
}

.dialog-box.dialog-danger {
  border-color: #e74c3c;
}

.dialog-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}

.dialog-icon {
  font-size: 1.5rem;
}

.dialog-title {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-primary, #fff);
  margin: 0;
}

.dialog-body {
  margin-bottom: 20px;
}

.dialog-message {
  color: var(--text-secondary, #ccc);
  font-size: 0.9rem;
  line-height: 1.5;
  white-space: pre-wrap;
  font-family: inherit;
  margin: 0 0 12px 0;
}

/* Challenge styles */
.challenge {
  margin-top: 12px;
  padding: 12px;
  background: rgba(108, 99, 255, 0.08);
  border: 1px solid rgba(108, 99, 255, 0.25);
  border-radius: 6px;
}

.challenge-label {
  display: block;
  font-size: 0.85rem;
  color: var(--text-secondary, #ccc);
  margin-bottom: 8px;
  white-space: pre-wrap;
  font-family: inherit;
}

.challenge-input {
  width: 100%;
  padding: 8px 12px;
  background: var(--bg-primary, #0f0f1a);
  border: 1px solid var(--border-color, #2a2a3e);
  border-radius: 4px;
  color: var(--text-primary, #fff);
  font-size: 0.9rem;
  outline: none;
  font-family: monospace;
  box-sizing: border-box;
}

.challenge-input:focus {
  border-color: var(--accent, #6c63ff);
}

.challenge-hint {
  color: #ff6b6b;
  font-size: 0.78rem;
  margin: 6px 0 0 0;
  font-family: inherit;
  white-space: pre-wrap;
}

.choice-buttons {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.choice-btn {
  flex: 1;
  min-width: 90px;
  padding: 8px 14px;
  background: var(--bg-primary, #0f0f1a);
  border: 1px solid var(--border-color, #2a2a3e);
  border-radius: 4px;
  color: var(--text-secondary, #ccc);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.choice-btn:hover {
  border-color: var(--accent, #6c63ff);
}

.choice-btn-selected {
  background: var(--accent, #6c63ff);
  border-color: var(--accent, #6c63ff);
  color: #fff;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.dialog-btn {
  padding: 8px 20px;
  border: none;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.dialog-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.cancel-btn {
  background: var(--bg-tertiary, #151528);
  color: var(--text-muted, #888);
}

.cancel-btn:hover {
  background: var(--bg-hover, #252540);
  color: var(--text-secondary, #ccc);
}

.confirm-btn {
  background: var(--accent, #6c63ff);
  color: #fff;
}

.confirm-btn:hover:not(:disabled) {
  opacity: 0.9;
}

.danger-btn {
  background: #e74c3c;
  color: #fff;
}

.danger-btn:hover:not(:disabled) {
  background: #c0392b;
}

/* Transitions */
.dialog-enter-active {
  animation: dialog-in 0.25s ease-out;
}

.dialog-leave-active {
  animation: dialog-out 0.2s ease-in;
}

@keyframes dialog-in {
  from {
    opacity: 0;
    transform: scale(0.9) translateY(-20px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

@keyframes dialog-out {
  from {
    opacity: 1;
    transform: scale(1);
  }
  to {
    opacity: 0;
    transform: scale(0.95);
  }
}
</style>