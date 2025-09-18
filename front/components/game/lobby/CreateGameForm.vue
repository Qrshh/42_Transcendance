<template>
  <div class="create-game-form">
    <!-- Header -->
    <div class="form-header">
      <h2 class="form-title">✨ Créer une partie</h2>
      <p class="form-subtitle">Configure ta partie et invite tes amis !</p>
      <button class="btn btn-tertiary" type="button" @click="openCustomization">⚙️ Personnaliser globalement</button>
    </div>

    <!-- Formulaire -->
    <form @submit.prevent="createGame" class="game-form">
      <!-- Nom de la partie -->
      <div class="form-group">
        <label class="form-label">
          <span class="label-icon">🎮</span>
          <span class="label-text">Nom de la partie</span>
        </label>
        <input 
          type="text" 
          v-model="form.name" 
          required
          maxlength="30"
          placeholder="Ma partie épique"
          class="form-input"
        />
      </div>

      <!-- Mot de passe (optionnel) -->
      <div class="form-group">
        <label class="form-checkbox">
          <input type="checkbox" v-model="form.hasPassword" />
          <span class="checkbox-mark"></span>
          <span class="checkbox-text">🔒 Partie privée (mot de passe)</span>
        </label>
        
        <Transition name="slide-down">
          <input 
            v-if="form.hasPassword"
            type="password" 
            v-model="form.password"
            placeholder="Mot de passe secret"
            class="form-input password-input"
          />
        </Transition>
      </div>

      <!-- Configuration de la partie -->
      <div class="form-row">
        <div class="form-group half">
          <label class="form-label">
            <span class="label-icon">👥</span>
            <span class="label-text">Joueurs</span>
          </label>
          <select v-model.number="form.maxPlayers" class="form-select">
            <option value="2">2 joueurs</option>
            <option value="4">4 joueurs</option>
          </select>
        </div>

        <div class="form-group half">
          <label class="form-label">
            <span class="label-icon">🎯</span>
            <span class="label-text">Points</span>
          </label>
          <select v-model.number="form.maxPoints" class="form-select">
            <option value="5">5 points</option>
            <option value="10">10 points</option>
            <option value="15">15 points</option>
            <option value="21">21 points</option>
          </select>
        </div>
      </div>
       <!-- Modes de jeu -->
      <div class="form-group">
        <label class="form-label">
          <span class="label-icon">⚡</span>
          <span class="label-text">Modes de jeu</span>
        </label>
        <div class="toggles">
          <!-- Toggle balle accélérante -->
          <label class="toggle">
            <input type="checkbox" v-model="form.accelBall" />
            <span class="slider"></span>
            <span class="toggle-text">🚀 Balle accélérante</span>
          </label>
          <!-- Toggle paddle dash -->
          <label class="toggle">
            <input type="checkbox" v-model="form.paddleDash" />
            <span class="slider"></span>
            <span class="toggle-text">⚡ Paddle dash</span>
          </label>
        </div>
      </div>

      <div class="custom-summary">
        <span class="summary-chip">{{ arenaLabel }}</span>
        <span class="summary-chip">{{ ballSpeedLabel }}</span>
        <span class="summary-chip">{{ ballSizeLabel }}</span>
        <span class="summary-chip">PU: {{ powerUpLabel }}</span>
      </div>

      <!-- Message d'erreur -->
      <Transition name="fade">
        <div v-if="errorMessage" class="error-message">
          <span class="error-icon">⚠️</span>
          <span class="error-text">{{ errorMessage }}</span>
        </div>
      </Transition>

      <!-- Boutons d'action -->
      <div class="form-actions">
        <button 
          type="submit" 
          :disabled="!form.name.trim() || isCreating"
          class="btn btn-primary"
        >
          <span v-if="isCreating" class="btn-spinner">⏳</span>
          <span v-else class="btn-icon">🚀</span>
          <span class="btn-text">
            {{ isCreating ? 'Création...' : 'Créer la partie' }}
          </span>
        </button>
        
        <button 
          type="button" 
          @click="$emit('back')"
          class="btn btn-secondary"
        >
          <span class="btn-icon">←</span>
          <span class="btn-text">Retour</span>
        </button>
      </div>
    </form>

    <!-- Prévisualisation -->
    <div class="game-preview">
      <div class="preview-header">
        <span class="preview-icon">👀</span>
        <span class="preview-title">Aperçu de la partie</span>
      </div>
      <div class="preview-content">
        <div class="preview-item">
          <span class="preview-label">Nom:</span>
          <span class="preview-value">{{ form.name || 'Sans nom' }}</span>
        </div>
        <div class="preview-item">
          <span class="preview-label">Type:</span>
          <span class="preview-value">{{ form.hasPassword ? '🔒 Privée' : '🌐 Publique' }}</span>
        </div>
        <div class="preview-item">
          <span class="preview-label">Config:</span>
          <span class="preview-value">{{ form.maxPlayers }} joueurs • {{ form.maxPoints }} pts</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted, onUnmounted, computed, watch } from 'vue';
import type { Socket } from 'socket.io-client';
import { useGameSettings } from '../../../stores/gameSettings';

export default defineComponent({
  name: 'CreateGameForm',
  props: {
    socket: {
      type: Object as () => Socket,
      required: true,
    },
  },
  emits: ['back', 'gameCreated'],
  
  setup(props, { emit }) {
    const { settings } = useGameSettings()

    const form = ref({
      name: '',
      hasPassword: false,
      password: '',
      maxPlayers: 2,
      maxPoints: 10,
      accelBall: settings.accelBall,
      paddleDash: settings.paddleDash
    });

    const errorMessage = ref<string | null>(null);
    const isCreating = ref(false);

    const createGame = async () => {
      try {
        errorMessage.value = null;
        isCreating.value = true;
        
        if (!form.value.name.trim()) {
          errorMessage.value = 'Le nom de la partie est requis.';
          isCreating.value = false;
          return;
        }

        if (form.value.hasPassword && !form.value.password.trim()) {
          errorMessage.value = 'Le mot de passe est requis pour une partie privée.';
          isCreating.value = false;
          return;
        }

        const gameData = {
          name: form.value.name.trim(),
          password: form.value.hasPassword ? form.value.password : undefined,
          maxPlayers: form.value.maxPlayers,
          maxPoints: form.value.maxPoints,
          accelBall: form.value.accelBall,
          paddleDash: form.value.paddleDash,
          customization: {
            arena: settings.arena,
            ballSpeed: settings.ballSpeed,
            ballSize: settings.ballSize,
            accelBall: settings.accelBall,
            paddleDash: settings.paddleDash,
            powerUps: settings.powerUps,
          }
        };

        props.socket.emit('createGame', gameData);
        
        // Timeout de sécurité
        setTimeout(() => {
          if (isCreating.value) {
            isCreating.value = false;
            errorMessage.value = 'Timeout - Veuillez réessayer';
          }
        }, 10000);

      } catch (e) {
        console.error('Erreur lors de la création:', e);
        errorMessage.value = 'Une erreur est survenue lors de la création.';
        isCreating.value = false;
      }
    };

    onMounted(() => {
      console.log("🔧 CreateGameForm: Configuration des événements");

      props.socket.on('gameCreatedConfirmation', (game: { id: string; name: string }) => {
        console.log("✅ Partie créée avec succès:", game);
        isCreating.value = false;
        emit('gameCreated', game);
      });
    
      props.socket.on('gameCreateError', (data: { message: string }) => {
        console.log("❌ Erreur de création:", data);
        errorMessage.value = data.message;
        isCreating.value = false;
      });
    });

    onUnmounted(() => {
      props.socket.off('gameCreatedConfirmation');
      props.socket.off('gameCreateError');
    });

    const openCustomization = () => {
      window.dispatchEvent(new Event('open-game-settings'))
    }

    const arenaLabel = computed(() => {
      switch (settings.arena) {
        case 'neon': return 'Neon futuriste'
        case 'cosmic': return 'Cosmos'
        default: return 'Classique 1972'
      }
    })

    const ballSpeedLabel = computed(() => {
      switch (settings.ballSpeed) {
        case 'fast': return 'Rapide'
        case 'extreme': return 'Extrême'
        default: return 'Normale'
      }
    })

    const ballSizeLabel = computed(() => settings.ballSize === 'large' ? 'Large' : 'Standard')

    const powerUpLabel = computed(() => {
      switch (settings.powerUps) {
        case 'rare': return 'Occasionnel'
        case 'frequent': return 'Fréquent'
        default: return 'Désactivé'
      }
    })

    watch(() => settings.accelBall, (val) => { form.value.accelBall = val })
    watch(() => settings.paddleDash, (val) => { form.value.paddleDash = val })

    return {
      form,
      errorMessage,
      isCreating,
      createGame,
      openCustomization,
      arenaLabel,
      ballSpeedLabel,
      ballSizeLabel,
      powerUpLabel,
    };
  },
});
</script>

<style scoped>
.create-game-form {
  max-width: 500px;
  margin: 0 auto;
  background: var(--color-background-soft);
  border: 2px solid var(--color-border);
  border-radius: 7px;
  padding: 2rem;
  box-shadow: var(--shadow-lg);
}

/* Header */
.form-header {
  text-align: center;
  margin-bottom: 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
}

.form-title {
  font-size: 2rem;
  font-weight: 800;
  background: var(--gradient-primary);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-bottom: 0.5rem;
}

.form-subtitle {
  color: var(--color-text);
  opacity: 0.8;
  margin: 0;
}

/* Formulaire */
.game-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.form-group.half {
  flex: 1;
}

.form-row {
  display: flex;
  gap: 1rem;
}

/* Labels */
.form-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--color-text);
  font-size: 0.9rem;
}

.label-icon {
  font-size: 1rem;
}

/* Inputs */
.form-input {
  background: var(--color-background);
  border: 2px solid var(--color-border);
  border-radius: 7px;
  padding: 0.75rem 1rem;
  color: var(--color-text);
  font-size: 1rem;
  transition: all 0.3s ease;
  outline: none;
}

.form-input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(var(--color-primary-rgb), 0.1);
}

.form-input::placeholder {
  color: var(--color-text);
  opacity: 0.5;
}

.password-input {
  margin-top: 0.5rem;
}

/* Select */
.form-select {
  background: var(--color-background);
  border: 2px solid var(--color-border);
  border-radius: 7px;
  padding: 0.75rem 1rem;
  color: var(--color-text);
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.3s ease;
}

.form-select:focus {
  border-color: var(--color-primary);
  outline: none;
}

/* Checkbox */
.form-checkbox {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
  user-select: none;
}

.form-checkbox input[type="checkbox"] {
  display: none;
}

.checkbox-mark {
  width: 20px;
  height: 20px;
  border: 2px solid var(--color-border);
  border-radius: 7px;
  background: var(--color-background);
  position: relative;
  transition: all 0.3s ease;
}

.form-checkbox input:checked + .checkbox-mark {
  background: var(--gradient-primary);
  border-color: var(--color-primary);
}

.form-checkbox input:checked + .checkbox-mark::after {
  content: '✓';
  position: absolute;
  color: white;
  font-size: 0.8rem;
  font-weight: bold;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.checkbox-text {
  font-weight: 500;
  color: var(--color-text);
}

/* Message d'erreur */
.error-message {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: rgba(244, 67, 54, 0.1);
  border: 1px solid #f44336;
  border-radius: 7px;
  color: #f44336;
  font-size: 0.9rem;
}

.error-icon {
  font-size: 1rem;
}

/* Boutons */
.form-actions {
  display: flex;
  gap: 1rem;
  margin-top: 1rem;
}

.btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.875rem 1.5rem;
  border: none;
  border-radius: 7px;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.3s ease;
  flex: 1;
}

.btn-primary {
  background: var(--gradient-primary);
  color: black;
  box-shadow: var(--shadow-md);
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.btn-secondary {
  background: var(--color-background);
  color: var(--color-text);
  border: 2px solid var(--color-border);
}

.btn-secondary:hover {
  background: var(--color-background-soft);
  border-color: var(--color-primary);
}

.btn-tertiary {
  border: 1px solid var(--color-border);
  border-radius: 999px;
  padding: 0.45rem 1rem;
  background: transparent;
  color: var(--color-text);
  font-weight: 600;
  cursor: pointer;
  transition: transform .15s ease, box-shadow .2s ease;
}

.btn-tertiary:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 18px rgba(79,172,254,.25);
}

.custom-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: center;
  color: var(--color-text);
}

.summary-chip {
  background: rgba(79,172,254,0.12);
  border: 1px solid rgba(79,172,254,0.35);
  border-radius: 999px;
  padding: 0.3rem 0.75rem;
  font-size: 0.85rem;
  font-weight: 600;
}

.btn-icon {
  font-size: 1rem;
}

.btn-spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Prévisualisation */
.game-preview {
  margin-top: 2rem;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 7px;
  padding: 1rem;
}

.preview-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--color-text);
  margin-bottom: 1rem;
  font-size: 0.9rem;
}

.preview-icon {
  font-size: 1rem;
}

.preview-content {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.preview-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.85rem;
}

.preview-label {
  color: var(--color-text);
  opacity: 0.7;
  font-weight: 500;
}

.preview-value {
  color: var(--color-text);
}

/* Transitions */
.slide-down-enter-active, .slide-down-leave-active {
  transition: all 0.3s ease;
  max-height: 60px;
  overflow: hidden;
}

.slide-down-enter-from, .slide-down-leave-to {
  max-height: 0;
  opacity: 0;
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

/* Responsive */
@media (max-width: 768px) {
  .create-game-form {
    margin: 1rem;
    padding: 1.5rem;
  }
  
  .form-row {
    flex-direction: column;
  }
  
  .form-actions {
    flex-direction: column;
  }
}
</style>
