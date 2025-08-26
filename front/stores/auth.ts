// stores/auth.ts - Version fonctionnelle avec 2FA
import { ref } from 'vue'
import axios from 'axios'

// État de l'authentification
export const isLoggedIn = ref(!!localStorage.getItem('username'))

// Variables pour compatibilité
export const user = ref<{
  id?: number
  username?: string
  email?: string
  avatar?: string
  twoFactorEnabled?: boolean
} | null>(null)

export const tokens = ref<{
  accessToken?: string
  refreshToken?: string
} | null>(null)

// Configuration axios
axios.defaults.baseURL = 'http://localhost:3000'

// Fonction de connexion classique
export function login(username: string, email: string, avatar: string, twoFactorEnabled?: boolean) {
  localStorage.setItem('username', username)
  localStorage.setItem('email', email)
  localStorage.setItem('avatar', avatar)
  isLoggedIn.value = true

  user.value = { 
    username, 
    email, 
    avatar, 
    twoFactorEnabled: twoFactorEnabled || false 
  }
  
  console.log('✅ Connexion avec 2FA:', twoFactorEnabled)
}

export function logout(){
  localStorage.removeItem('username')
  localStorage.removeItem('email')
  localStorage.removeItem('avatar')
  isLoggedIn.value = false
  user.value = null
  tokens.value = null
}


// Inscription

export async function register(username: string, email: string, password: string) {
  try {
    await axios.post('/register', { username, email, password })
    return { success: true }
  } catch (error: any) {
    throw new Error(error.response?.data?.error || 'Erreur lors de l\'inscription')
  }
}


// Configuration 2FA

export async function setup2FA() {
  try {
    const username = localStorage.getItem('username');
    if (!username) throw new Error('Vous devez être connecté');
    
    const response = await axios.post('/auth/2fa/setup', 
      { username }, 
      { headers: { 'x-username': username } }
    );
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.error || 'Erreur lors de la configuration 2FA');
  }
}


// Activer 2FA

export async function enable2FA(code: string) {
  try {
    const username = localStorage.getItem('username');
    if (!username) throw new Error('Vous devez être connecté');
    
    const response = await axios.post('/auth/2fa/enable', 
      { code, username }, 
      { headers: { 'x-username': username } }
    );
    
    // Mettre à jour l'état utilisateur
    if (user.value) {
      user.value.twoFactorEnabled = true
      localStorage.setItem('user', JSON.stringify(user.value))
    }
    
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.error || 'Erreur lors de l\'activation 2FA');
  }
}

// Désactiver 2FA

export async function disable2FA(code: string, password: string) {
  try {
    const username = localStorage.getItem('username');
    if (!username) throw new Error('Vous devez être connecté');
    
    const response = await axios.post('/auth/2fa/disable', 
      { code, password, username }, 
      { headers: { 'x-username': username } }
    );
    
    // Mettre à jour l'état utilisateur
    if (user.value) {
      user.value.twoFactorEnabled = false
      localStorage.setItem('user', JSON.stringify(user.value))
    }
    
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.error || 'Erreur lors de la désactivation 2FA');
  }
}


// Régénérer les codes de récupération
export async function regenerateBackupCodes(code: string) {
  try {
    const username = localStorage.getItem('username');
    if (!username) throw new Error('Vous devez être connecté');
    
    const response = await axios.post('/auth/2fa/regenerate-backup', 
      { code, username }, 
      { headers: { 'x-username': username } }
    );
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.error || 'Erreur lors de la régénération des codes');
  }
}

// Initialiser user depuis localStorage au démarrage
const savedUsername = localStorage.getItem('username')
const savedEmail = localStorage.getItem('email')
const savedAvatar = localStorage.getItem('avatar')

if (savedUsername) {
  user.value = {
    username: savedUsername,
    email: savedEmail || '',
    avatar: savedAvatar || ''
  }
}