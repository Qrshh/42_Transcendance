<template>
  <div class="panel twofa-card">
    <!-- Header + statut -->
    <div class="twofa-header">
      <h2 class="twofa-title">Authentification à 2 facteurs</h2>
      <span class="twofa-badge" :class="is2FAEnabled ? 'on' : 'off'">
        {{ is2FAEnabled ? 'Activée' : 'Désactivée' }}
      </span>
    </div>

    <!-- Intro / Activer -->
    <div v-if="!is2FAEnabled && !setupData" class="twofa-intro">
      <p class="twofa-help">
        Sécurisez votre compte avec l'authentification à deux facteurs
      </p>
      <div class="twofa-actions">
        <button
          @click="initiate2FASetup"
          :disabled="loading"
          class="btn btn-primary block"
        >
          {{ loading ? 'Chargement...' : 'Activer la 2FA' }}
        </button>
      </div>
    </div>

    <!-- Configuration (QR + code) -->
    <div v-if="setupData && !is2FAEnabled" class="twofa-setup space-y-4">
      <div class="text-center">
        <h3 class="text-lg font-semibold mb-2">Configurer votre authenticator</h3>
        <p class="twofa-help">Scannez ce QR code avec Google Authenticator, Authy, etc.</p>

        <!-- QR -->
        <div class="twofa-qr">
          <img :src="setupData.qrCode" alt="QR Code 2FA" class="border rounded-lg" />
        </div>

        <!-- Clé manuelle -->
        <details class="mb-2">
          <summary class="link">Saisie manuelle</summary>
          <div class="twofa-secret mt-2 break-all">
            {{ setupData.manualEntryKey }}
          </div>
        </details>
      </div>

      <!-- Code -->
      <div>
        <label class="block text-sm font-medium mb-2">Code de vérification</label>
        <input
          v-model="verificationCode"
          type="text"
          placeholder="123456"
          maxlength="6"
          class="twofa-code w-full px-3 py-2 rounded-lg focus:outline-none"
          @input="formatCode"
          @keyup.enter="activate2FA"
        />
        <p class="text-xs opacity-70 mt-1">Entrez le code à 6 chiffres de votre app</p>
      </div>

      <div class="twofa-actions">
        <button
          @click="activate2FA"
          :disabled="loading || verificationCode.length !== 6"
          class="btn btn-primary"
        >
          {{ loading ? 'Vérification...' : 'Activer' }}
        </button>
        <button
          @click="cancelSetup"
          class="btn btn-secondary"
        >
          Annuler
        </button>
      </div>
    </div>

    <!-- Codes de récupération -->
    <div v-if="backupCodes.length > 0" class="twofa-backups mt-6">
      <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h3 class="font-semibold text-yellow-800 mb-2">⚠️ Codes de récupération</h3>
        <p class="text-sm text-yellow-700 mb-3">
          Sauvegardez ces codes dans un endroit sûr. Ils vous permettront de vous connecter si vous perdez votre téléphone.
        </p>
        <div class="grid grid-cols-2 gap-2 mb-3">
          <div
            v-for="code in backupCodes"
            :key="code"
            class="bg-white p-2 rounded text-center font-mono text-sm border"
          >
            {{ code }}
          </div>
        </div>
        <button
          @click="downloadBackupCodes"
          class="btn btn-secondary block"
        >
          Télécharger les codes
        </button>
      </div>
    </div>

    <!-- Gestion quand 2FA activée -->
    <div v-if="is2FAEnabled" class="twofa-manage space-y-4 mt-4">
      <div class="twofa-actions">
        <button
          @click="showRegenerateModal = true"
          class="btn btn-secondary"
        >
          Régénérer les codes de récupération
        </button>
        <button
          @click="showDisableModal = true"
          class="btn btn-danger"
        >
          Désactiver la 2FA
        </button>
      </div>
    </div>

    <!-- Modal désactivation -->
    <div
      v-if="showDisableModal"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    >
      <div class="bg-white p-6 rounded-lg max-w-sm w-full mx-4">
        <h3 class="text-lg font-semibold mb-4">Désactiver la 2FA</h3>

        <div class="space-y-3">
          <div>
            <label class="block text-sm font-medium mb-1">Mot de passe</label>
            <input
              v-model="disablePassword"
              type="password"
              class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label class="block text-sm font-medium mb-1">Code 2FA ou code de récupération</label>
            <input
              v-model="disableCode"
              type="text"
              placeholder="123456 ou AB12CD34"
              maxlength="8"
              class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              @input="formatDisableCodeFlexible"
            />
            <p class="text-xs opacity-70 mt-1">6 chiffres de l'app OU 8 caractères de récupération</p>
          </div>
        </div>

        <div class="twofa-actions mt-6">
          <button
            @click="disable2FAAction"
            :disabled="loading || !disablePassword || (disableCode.length !== 6 && disableCode.length !== 8)"
            class="btn btn-danger"
          >
            {{ loading ? 'Désactivation...' : 'Désactiver' }}
          </button>
          <button
            @click="() => { showDisableModal = false; disablePassword = ''; disableCode = '' }"
            class="btn btn-secondary"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>

    <!-- Modal régénération -->
    <div
      v-if="showRegenerateModal"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    >
      <div class="bg-white p-6 rounded-lg max-w-sm w-full mx-4">
        <h3 class="text-lg font-semibold mb-4">Régénérer les codes de récupération</h3>

        <div class="space-y-3">
          <div>
            <label class="block text-sm font-medium mb-1">Code 2FA</label>
            <input
              v-model="regenerateCode"
              type="text"
              placeholder="123456"
              maxlength="6"
              class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              @input="formatRegenerateCode"
            />
          </div>
        </div>

        <div class="twofa-actions mt-6">
          <button
            @click="regenerateCodes"
            :disabled="loading || regenerateCode.length !== 6"
            class="btn btn-primary"
          >
            {{ loading ? 'Génération...' : 'Régénérer' }}
          </button>
          <button
            @click="() => { showRegenerateModal = false; regenerateCode = '' }"
            class="btn btn-secondary"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>

    <!-- Messages -->
    <div
      v-if="message"
      class="twofa-alert mt-4 p-3 rounded-lg"
      :class="messageType === 'error' ? 'error' : 'success'"
    >
      {{ message }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { user, setup2FA, enable2FA, disable2FA, regenerateBackupCodes } from '@/stores/auth'

// État local
const loading = ref(false)
const setupData = ref<any>(null)
const verificationCode = ref('')
const backupCodes = ref<string[]>([])
const message = ref('')
const messageType = ref<'success' | 'error'>('success')

// Modals
const showDisableModal = ref(false)
const showRegenerateModal = ref(false)
const disablePassword = ref('')
const disableCode = ref('')
const regenerateCode = ref('')

// Computed
const is2FAEnabled = computed(() => user.value?.twoFactorEnabled || false)

// Méthodes
function formatCode() {
  verificationCode.value = verificationCode.value.replace(/\D/g, '').slice(0, 6)
}
function formatDisableCodeFlexible() {
  disableCode.value = disableCode.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 8)
}
function formatRegenerateCode() {
  regenerateCode.value = regenerateCode.value.replace(/\D/g, '').slice(0, 6)
}
function showMessage(text: string, type: 'success' | 'error' = 'success') {
  message.value = text
  messageType.value = type
  setTimeout(() => { message.value = '' }, 5000)
}

async function initiate2FASetup() {
  loading.value = true
  try {
    setupData.value = await setup2FA()
    showMessage('Scannez le QR code avec votre app d\'authentification')
  } catch (error: any) {
    showMessage(error?.message || 'Erreur lors de l’initialisation', 'error')
  } finally {
    loading.value = false
  }
}
async function activate2FA() {
  loading.value = true
  try {
    const result = await enable2FA(verificationCode.value)
    backupCodes.value = result.backupCodes
    setupData.value = null
    verificationCode.value = ''
    showMessage('2FA activée avec succès ! Sauvegardez vos codes de récupération.')
  } catch (error: any) {
    showMessage(error?.message || 'Code invalide', 'error')
  } finally {
    loading.value = false
  }
}
function cancelSetup() {
  setupData.value = null
  verificationCode.value = ''
  message.value = ''
}
async function disable2FAAction() {
  loading.value = true
  try {
    await disable2FA(disableCode.value, disablePassword.value)
    showDisableModal.value = false
    disablePassword.value = ''
    disableCode.value = ''
    showMessage('2FA désactivée avec succès')
  } catch (error: any) {
    showMessage(error?.message || 'Erreur de désactivation', 'error')
  } finally {
    loading.value = false
  }
}
async function regenerateCodes() {
  loading.value = true
  try {
    const result = await regenerateBackupCodes(regenerateCode.value)
    backupCodes.value = result.backupCodes
    showRegenerateModal.value = false
    regenerateCode.value = ''
    showMessage('Nouveaux codes de récupération générés')
  } catch (error: any) {
    showMessage(error?.message || 'Erreur lors de la régénération', 'error')
  } finally {
    loading.value = false
  }
}
function downloadBackupCodes() {
  const content =
`Codes de récupération Transcendance

Utilisateur: ${user.value?.username}
Générés le: ${new Date().toLocaleDateString()}

${backupCodes.value.join('\n')}

Sauvegardez ces codes dans un endroit sûr !`
  const blob = new Blob([content], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `transcendance-backup-codes-${user.value?.username}.txt`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  backupCodes.value = []
}
</script>

<style scoped>
/* mini fallback si tu n’utilises pas le :deep(...) côté ProfileView */
.twofa-header{
  display:flex; align-items:center; justify-content:space-between;
  gap:.75rem; margin-bottom:1rem;
}
.twofa-title{ font-size:1.25rem; font-weight:800; margin:0; }
.twofa-badge{
  padding:.25rem .6rem; font-size:.8rem; border-radius:999px; border:1px solid var(--color-border);
  background: var(--color-background-soft); font-weight:700;
}
.twofa-badge.on{ color: var(--color-success); background: var(--color-success-soft); border-color: var(--color-success); }
.twofa-badge.off{ color: var(--color-danger); background: var(--color-danger-soft); border-color: var(--color-danger); }

.twofa-help{ font-size:.95rem; opacity:.85; }
.twofa-qr{ display:flex; justify-content:center; align-items:center; padding:1rem;
  background: var(--color-background-soft); border:1px dashed var(--color-border); border-radius:7px; margin: .5rem 0 1rem;
}
.twofa-secret{
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-weight:700; letter-spacing:.08em; background: var(--color-background); border:1px solid var(--color-border); border-radius:7px; padding:.5rem .65rem;
}

.twofa-code{ border: 2px solid var(--color-border);
  background: var(--color-background);
  color: var(--color-text);
  margin: 10px;
  border-radius: 7px;
  padding: 7px; }
.twofa-code:focus{ border-color: var(--color-primary); box-shadow: 0 0 0 3px rgba(var(--color-background-rgb), .15); }

.twofa-actions{
  grid-template-columns: repeat(2, minmax(0,1fr)); gap:.6rem; margin-top:1rem; display: flex;
}
@media (max-width: 640px){ .twofa-actions{ grid-template-columns: 1fr; } }

.btn{ display:flex; align-items:center; justify-content:center; gap:.5rem; padding:.75rem 1rem;
  border-radius:7px; font-weight:800; cursor:pointer; transition:.18s ease; border:0;
}
.btn-secondary{ background: var(--color-background); border:2px solid var(--color-border); color: var(--color-text); }
.btn-secondary:hover{transform: translateY(-1px);
  box-shadow: 0 8px 18px rgba(0,0,0,.18);}
.btn-danger{ background: linear-gradient(180deg, var(--color-danger), var(--color-danger-contrast)); color:#fff; }
.btn:hover{ transform: translateY(-1px); box-shadow: 0 8px 18px rgba(0,0,0,.08); }
.btn[disabled]{ opacity:.6; cursor:not-allowed; }
.btn.block{ width:100%; }

/* messages */
.twofa-alert.success{ background: var(--color-success-soft); color: var(--color-success-contrast); border:1px solid var(--color-success); }
.twofa-alert.error{ background: var(--color-danger-soft); color: var(--color-danger-contrast); border:1px solid var(--color-danger); }
</style>
