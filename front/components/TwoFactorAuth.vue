<template>
  <div class="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
    <h2 class="text-2xl font-bold mb-6 text-center">Authentification à 2 facteurs</h2>
    
    <!-- État actuel -->
    <div class="mb-6 p-4 rounded-lg" :class="is2FAEnabled ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'">
      <div class="flex items-center justify-between">
        <span class="font-medium">2FA</span>
        <span class="text-sm px-3 py-1 rounded-full" 
              :class="is2FAEnabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'">
          {{ is2FAEnabled ? 'Activée' : 'Désactivée' }}
        </span>
      </div>
    </div>

    <!-- Activation de la 2FA -->
    <div v-if="!is2FAEnabled && !setupData" class="text-center">
      <p class="text-gray-600 mb-4">
        Sécurisez votre compte avec l'authentification à deux facteurs
      </p>
      <button @click="initiate2FASetup" 
              :disabled="loading"
              class="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50">
        {{ loading ? 'Chargement...' : 'Activer la 2FA' }}
      </button>
    </div>

    <!-- Configuration 2FA (QR Code) -->
    <div v-if="setupData && !is2FAEnabled" class="space-y-4">
      <div class="text-center">
        <h3 class="text-lg font-semibold mb-4">Configurer votre authenticator</h3>
        <p class="text-sm text-gray-600 mb-4">
          Scannez ce QR code avec Google Authenticator, Authy ou une autre app compatible
        </p>
        
        <!-- QR Code -->
        <div class="flex justify-center mb-4">
          <img :src="setupData.qrCode" alt="QR Code 2FA" class="border rounded-lg" />
        </div>
        
        <!-- Clé manuelle -->
        <details class="mb-4">
          <summary class="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
            Saisie manuelle
          </summary>
          <div class="mt-2 p-3 bg-gray-100 rounded text-xs font-mono break-all">
            {{ setupData.manualEntryKey }}
          </div>
        </details>
      </div>

      <!-- Vérification du code -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">
          Code de vérification
        </label>
        <input v-model="verificationCode" 
               type="text" 
               placeholder="123456"
               maxlength="6"
               class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
               @input="formatCode"
               @keyup.enter="activate2FA">
        <p class="text-xs text-gray-500 mt-1">Entrez le code à 6 chiffres de votre app</p>
      </div>

      <div class="flex gap-3">
        <button @click="activate2FA" 
                :disabled="loading || verificationCode.length !== 6"
                class="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50">
          {{ loading ? 'Vérification...' : 'Activer' }}
        </button>
        <button @click="cancelSetup" 
                class="flex-1 bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700">
          Annuler
        </button>
      </div>
    </div>

    <!-- Codes de récupération -->
    <div v-if="backupCodes.length > 0" class="mt-6">
      <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h3 class="font-semibold text-yellow-800 mb-2">⚠️ Codes de récupération</h3>
        <p class="text-sm text-yellow-700 mb-3">
          Sauvegardez ces codes dans un endroit sûr. Ils vous permettront de vous connecter si vous perdez votre téléphone.
        </p>
        <div class="grid grid-cols-2 gap-2 mb-3">
          <div v-for="code in backupCodes" :key="code" 
               class="bg-white p-2 rounded text-center font-mono text-sm border">
            {{ code }}
          </div>
        </div>
        <button @click="downloadBackupCodes" 
                class="w-full bg-yellow-600 text-white py-2 px-4 rounded-lg hover:bg-yellow-700">
          Télécharger les codes
        </button>
      </div>
    </div>

    <!-- Gestion 2FA activée -->
    <div v-if="is2FAEnabled" class="space-y-4">
      <!-- Actions -->
      <div class="grid grid-cols-1 gap-3">
        <button @click="showRegenerateModal = true" 
                class="bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700">
          Régénérer les codes de récupération
        </button>
        <button @click="showDisableModal = true" 
                class="bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700">
          Désactiver la 2FA
        </button>
      </div>
    </div>

    <!-- Modal de désactivation -->
    <div v-if="showDisableModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white p-6 rounded-lg max-w-sm w-full mx-4">
        <h3 class="text-lg font-semibold mb-4">Désactiver la 2FA</h3>
        
        <div class="space-y-3">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Mot de passe</label>
            <input v-model="disablePassword" 
                   type="password" 
                   class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Code 2FA ou code de récupération</label>
            <input v-model="disableCode" 
                  type="text" 
                  placeholder="123456 ou AB12CD34"
                  maxlength="8"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  @input="formatDisableCodeFlexible">
            <p class="text-xs text-gray-500 mt-1">6 chiffres de l'app OU 8 caractères de récupération</p>
          </div>
        </div>

        <div class="flex gap-3 mt-6">
          <button @click="disable2FAAction" 
                  :disabled="loading || !disablePassword || (disableCode.length !== 6 && disableCode.length !== 8)"
                  class="flex-1 bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 disabled:opacity-50">
            {{ loading ? 'Désactivation...' : 'Désactiver' }}
          </button>
          <button @click="showDisableModal = false; disablePassword = ''; disableCode = ''" 
                  class="flex-1 bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700">
            Annuler
          </button>
        </div>
      </div>
    </div>

    <!-- Modal de régénération -->
    <div v-if="showRegenerateModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white p-6 rounded-lg max-w-sm w-full mx-4">
        <h3 class="text-lg font-semibold mb-4">Régénérer les codes de récupération</h3>
        
        <div class="space-y-3">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Code 2FA</label>
            <input v-model="regenerateCode" 
                   type="text" 
                   placeholder="123456"
                   maxlength="6"
                   class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                   @input="formatRegenerateCode">
          </div>
        </div>

        <div class="flex gap-3 mt-6">
          <button @click="regenerateCodes" 
                  :disabled="loading || regenerateCode.length !== 6"
                  class="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {{ loading ? 'Génération...' : 'Régénérer' }}
          </button>
          <button @click="showRegenerateModal = false; regenerateCode = ''" 
                  class="flex-1 bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700">
            Annuler
          </button>
        </div>
      </div>
    </div>

    <!-- Messages d'erreur/succès -->
    <div v-if="message" class="mt-4 p-3 rounded-lg" 
         :class="messageType === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'">
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
  disableCode.value = disableCode.value
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase()
    .slice(0, 8)
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
    showMessage(error.message, 'error')
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
    showMessage(error.message, 'error')
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
    console.log('🔧 Tentative désactivation 2FA...')
    await disable2FA(disableCode.value, disablePassword.value)
    showDisableModal.value = false
    disablePassword.value = ''
    disableCode.value = ''
    showMessage('2FA désactivée avec succès')
    console.log('✅ 2FA désactivée')
  } catch (error: any) {
    console.error('❌ Erreur désactivation:', error)
    showMessage(error.message, 'error')
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
    showMessage(error.message, 'error')
  } finally {
    loading.value = false
  }
}

function downloadBackupCodes() {
  const content = `Codes de récupération Transcendance\n\nUtilisateur: ${user.value?.username}\nGénérés le: ${new Date().toLocaleDateString()}\n\n${backupCodes.value.join('\n')}\n\nSauvegardez ces codes dans un endroit sûr !`
  
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