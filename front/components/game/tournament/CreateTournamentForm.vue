<template>
  <div class="create-game-form">
    <!-- Header -->
    <div class="form-header">
      <h2 class="form-title">✨ {{ t.createTournament }}</h2>
      <p class="form-subtitle">{{ t.configureAndInvite }}</p>
      <button type="button" class="btn-custom" @click="openCustomization">⚙️ {{ t.globalOptions }}</button>
    </div>

    <!-- Formulaire -->
    <form @submit.prevent="createTournament" class="game-form">
      <!-- Nom du tournoi -->
      <div class="form-group">
        <label class="form-label">
          <span class="label-icon">🎮</span>
          <span class="label-text">{{ t.tournamentName }}</span>
        </label>
        <input 
          type="text" 
          v-model="form.name" 
          required
          maxlength="30"
          :placeholder="t.epicGameName"
          class="form-input"
        />
      </div>

      <!-- Alias du créateur -->  
      <div class="form-group">
        <label class="form-label">
          <span class="label-icon">📝</span>
          <span class="label-text">{{ t.yourAlias }}</span>
        </label>
        <input 
          type="text" 
          v-model="form.alias" 
          required
          maxlength="20"
          :placeholder="t.tournamentNickname"
          class="form-input"
        />
      </div>

      <!-- Mot de passe (optionnel) -->
      <div class="form-group">
        <label class="form-checkbox">
          <input type="checkbox" v-model="form.hasPassword" />
          <span class="checkbox-mark"></span>
          <span class="checkbox-text">🔒 {{ t.privateTournament }}</span>
        </label>
        
        <Transition name="slide-down">
          <input 
            v-if="form.hasPassword"
            type="password" 
            v-model="form.password"
            placeholder="{{ t.secretPassword }}"
            class="form-input password-input"
          />
        </Transition>
      </div>

      <!-- Configuration de la partie -->
      <div class="form-row">
        <div class="form-group half">
          <label class="form-label">
            <span class="label-icon">👥</span>
            <span class="label-text">{{ t.players }}</span>
          </label>
          <select v-model.number="form.maxPlayers" class="form-select">
            <option value="2">2 {{ t.players }}</option>
            <option value="4">4 {{ t.players }}</option>
            <option value="8">8 {{ t.players }}</option>
            <option value="16">16 {{ t.players }}</option>
          </select>
        </div>

        <div class="form-group half">
          <label class="form-label">
            <span class="label-icon">🎯</span>
            <span class="label-text">{{ t.points }}</span>
          </label>
          <select v-model.number="form.maxPoints" class="form-select">
            <option value="5">5 {{ t.points }}</option>
            <option value="10">10 {{ t.points }}</option>
            <option value="15">15 {{ t.points }}</option>
            <option value="21">21 {{ t.points }}</option>
          </select>
        </div>
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
            {{ isCreating ? t.creating : t.createTournament }}
          </span>
        </button>
        
        <button 
          type="button" 
          @click="$emit('back')"
          class="btn btn-secondary"
        >
          <span class="btn-icon">←</span>
          <span class="btn-text">{{ t.back }}</span>
        </button>
      </div>
    </form>

    <!-- Prévisualisation -->
    <div class="game-preview">
      <div class="preview-header">
        <span class="preview-icon">👀</span>
        <span class="preview-title">{{ t.gamePreview }}</span>
      </div>
      <div class="preview-content">
        <div class="preview-item">
          <span class="preview-label">{{ t.name }}:</span>
          <span class="preview-value">{{ form.name || t.noName }}</span>
        </div>
        <div class="preview-item">
          <span class="preview-label">{{ t.type }}:</span>
          <span class="preview-value">{{ form.hasPassword ? t.private : t.public }}</span>
        </div>
        <div class="preview-item">
          <span class="preview-label">{{ t.config }}:</span>
          <span class="preview-value">{{ form.maxPlayers }} {{ t.players }} • {{ form.maxPoints }} {{ t.points }}</span>
        </div>
      </div>
    </div>

    <div class="custom-summary">
      <span class="summary-chip">{{ arenaLabel }}</span>
      <span class="summary-chip">{{ ballSpeedLabel }}</span>
      <span class="summary-chip">{{ ballSizeLabel }}</span>
      <span class="summary-chip">{{ powerUpLabel }}</span>
      <span class="summary-chip">{{ accelLabel }}</span>
      <span class="summary-chip">{{ dashLabel }}</span>
    </div>
  </div>
</template>


<script lang="ts">
import { defineComponent, ref, onMounted, onUnmounted, computed, watch } from 'vue';
import type { Socket } from 'socket.io-client';
import { useGameSettings } from '../../../stores/gameSettings';
import { useI18n } from '../../../composables/useI18n';



export default defineComponent({
  name: 'CreateTournamentForm',
  props: {
    socket: {
      type: Object as () => Socket,
      required: true,
    },
  },
  emits: ['back', 'tournamentCreated'],
  
  setup(props, { emit }) {
    const {t} = useI18n()
    const { settings } = useGameSettings()

    const form = ref({
      name: '',
      alias: '',
      hasPassword: false,
      password: '',
      maxPlayers: 2,
      maxPoints: 10,
      accelBall: settings.accelBall,
      paddleDash: settings.paddleDash,
    });

    const errorMessage = ref<string | null>(null);
    const isCreating = ref(false);

    const openCustomization = () => {
      window.dispatchEvent(new Event('open-game-settings'))
    }

    const createTournament = async () => {
      try {
        errorMessage.value = null;
        isCreating.value = true;
        
        if (!form.value.name.trim()) {
          errorMessage.value = 'Le nom du tournoi est requis.';
          isCreating.value = false;
          return;
        }

        if (form.value.hasPassword && !form.value.password.trim()) {
          errorMessage.value = 'Le mot de passe est requis pour une partie privée.';
          isCreating.value = false;
          return;
        }

        const tournamentData = {
          name: form.value.name.trim(),
          alias: form.value.alias.trim(),
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
          },
        };

        console.log("🎮 Création de partie:", tournamentData);
        props.socket.emit('createTournament', tournamentData);
        
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
    console.log("🔧 CreateTournamentForm: Configuration des événements");

    props.socket.on('tournamentCreated', (tournament: { id: string; name: string }) => {
        console.log("✅ Tournoi créé avec succès:", tournament);
        isCreating.value = false;
        emit('tournamentCreated', tournament);
    });

    props.socket.on('tournamentError', (data: { message: string }) => {
        console.log("❌ Erreur de création:", data);
        errorMessage.value = data.message;
        isCreating.value = false;
    });
    });

    onUnmounted(() => {
    props.socket.off('tournamentCreated');
    props.socket.off('tournamentError');
    });

    const accelLabel = computed(() => form.value.accelBall ? '⚡ Accélération activée' : '⚡ Accélération désactivée')
    const dashLabel = computed(() => form.value.paddleDash ? '🚀 Dash activé' : '🚀 Dash désactivé')

    watch(() => settings.accelBall, (val) => { form.value.accelBall = val })
    watch(() => settings.paddleDash, (val) => { form.value.paddleDash = val })

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

    const ballSizeLabel = computed(() => settings.ballSize === 'large' ? 'Balle large' : 'Balle standard')

    const powerUpLabel = computed(() => {
      switch (settings.powerUps) {
        case 'rare': return 'PU occasionnels'
        case 'frequent': return 'PU fréquents'
        default: return 'PU désactivés'
      }
    })

    return {
      form,
      errorMessage,
      isCreating,
      createTournament,
      openCustomization,
      arenaLabel,
      ballSpeedLabel,
      ballSizeLabel,
      powerUpLabel,
      accelLabel,
      dashLabel,
      t,
    };
  },
});
</script>

<style scoped>
.create-game-form {
  max-width: 560px;
  margin: 0 auto;
  display: grid;
  gap: 1.75rem;
  padding: 2.1rem 2.4rem;
  background: linear-gradient(165deg, var(--color-background-soft) 0%, var(--color-background) 100%);
  border: 1px solid var(--color-border);
  border-radius: 22px;
  box-shadow: var(--panel-shadow);
  backdrop-filter: blur(16px);
}

/* Header */
.form-header {
  text-align: center;
  display: grid;
  gap: 0.4rem;
}

.form-title {
  font-size: 2rem;
  font-weight: 800;
  background: var(--gradient-primary);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin: 0;
}


.form-subtitle {
  color: var(--color-text);
  opacity: 0.8;
  margin: 0;
}

.btn-custom {
  justify-self: center;
  border: 1px dashed var(--color-border);
  background: transparent;
  color: var(--color-text);
  padding: 0.35rem 0.85rem;
  border-radius: 999px;
  font-weight: 600;
  cursor: pointer;
  transition: transform .15s ease, box-shadow .2s ease;
}

.btn-custom:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 18px rgba(0,0,0,.18);
}

/* Formulaire */
.game-form {
  display: grid;
  gap: 1.4rem;
}

.form-group {
  display: grid;
  gap: 0.65rem;
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
  gap: 0.55rem;
  color: var(--color-text);
  font-size: 0.95rem;
  font-weight: 600;
}


.label-icon {
  font-size: 1rem;
}

/* Inputs */
.form-input,
.form-select {
  background: var(--color-background);
  border: 1px solid var(--panel-border, var(--color-border));
  border-radius: 12px;
  padding: 0.85rem 1rem;
  color: var(--color-text);
  font-size: 1rem;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
}
.form-input:focus,
.form-select:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(79, 172, 254, 0.18);
  outline: none;
  transform: translateY(-1px);
}
.form-input::placeholder {
  color: var(--color-text);
  opacity: 0.45;
}

.password-input {
  margin-top: 0.4rem;
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
  color: #0b132b;
  background: var(--gradient-brand);
  border-color: transparent;
  box-shadow: var(--glow-primary);
}
.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}
.btn:hover {
  transform: translateY(-2px);
  border-color: var(--color-border-hover);
  box-shadow: var(--shadow-md);
}

.btn-primary:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
  filter: grayscale(0.2);
}
.btn-secondary {
  background: transparent;
  color: var(--color-text);
  border-style: dashed;
}

.btn-secondary:hover {
  background: rgba(148, 163, 184, 0.12);
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
  margin-top: 0.5rem;
  padding: 1.25rem 1.45rem;
  border-radius: 18px;
  border: 1px solid var(--panel-border, var(--color-border));
  background: var(--panel-bg, rgba(255, 255, 255, 0.75));
  box-shadow: var(--panel-shadow);
  display: grid;
  gap: 1rem;
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
}

.preview-value {
  color: var(--color-text);
}

.custom-summary {
  margin-top: 1rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  justify-content: center;
  background: rgba(15, 23, 42, 0.08);
  border: 1px solid rgba(148, 163, 184, 0.25);
  border-radius: 999px;
  padding: 0.55rem 0.9rem;
}

.summary-chip {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 999px;
  padding: 0.32rem 0.75rem;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--color-text);
  letter-spacing: 0.02em;
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
