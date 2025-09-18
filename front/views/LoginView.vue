<template>
  <div class="about login-screen flex flex-col items-center">
    <!-- Titre -->
    <h1 class="login-title">
      {{ requiresTwoFactor ? 'Authentification à 2 facteurs' : (isLogin ? t.login : t.register) }}
    </h1>

    <!-- Form login / register -->
    <div
      v-if="!requiresTwoFactor"
      class="login-card w-full max-w-sm"
    >
      <div class="login-fields">
        <input
          v-if="!isLogin"
          v-model.trim="username"
          type="text"
          :placeholder="t.usernamePlaceholder"
          class="inp"
          autocomplete="username"
        />
        <input
          v-model.trim="email"
          type="email"
          :placeholder="t.emailPlaceholder"
          class="inp"
          autocomplete="email"
        />
        <input
          v-model="password"
          type="password"
          :placeholder="t.passwordPlaceholder"
          class="inp"
          autocomplete="current-password"
        />
      </div>

      <button
        @click="isLogin ? handleLogin() : handleRegister()"
        :disabled="loading"
        class="btn btn-primary block w-full"
      >
        {{ loading ? 'Chargement...' : (isLogin ? t.loginBtn : t.registerBtn) }}
      </button>

      <!-- ⚡️ Google Login -->
      <div ref="googleBtn" class="mt-3 flex justify-center"></div>

      <button
        @click="toggleMode"
        class="btn-link"
        type="button"
      >
        {{ isLogin ? t.switchToRegister : t.switchToLogin }}
      </button>
    </div>

    <!-- Étape 2FA -->
    <div
      v-else
      class="login-card w-full max-w-sm"
    >
      <div class="twofa-head">
        <div class="twofa-lock">🔒</div>
        <p class="twofa-sub">Entrez le code de votre app ou un code de récupération</p>
      </div>

      <input
        v-model="twoFactorCode"
        type="text"
        placeholder="123456 ou AB12CD34"
        maxlength="8"
        class="inp inp-otp text-center font-mono"
        @input="formatTwoFactorCodeFlexible"
        @keyup.enter="handleTwoFactorLogin"
      />

      <button
        @click="handleTwoFactorLogin"
        :disabled="loading || (twoFactorCode.length !== 6 && twoFactorCode.length !== 8)"
        class="btn btn-primary block w-full"
      >
        {{ loading ? 'Vérification...' : 'Vérifier' }}
      </button>

      <button @click="goBack" type="button" class="btn-link">← Retour à la connexion</button>
    </div>

    <!-- Messages -->
    <transition name="fade">
      <p v-if="message" class="alert success">{{ message }}</p>
    </transition>
    <transition name="fade">
      <p v-if="error" class="alert error">{{ error }}</p>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from '../composables/useI18n'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { API_BASE } from '../config'
import { login as setSession } from '../stores/auth'

const { t } = useI18n()
const router = useRouter()
const api = axios.create({ baseURL: API_BASE })

const isLogin = ref(true)
const username = ref('')
const email = ref('')
const password = ref('')
const twoFactorCode = ref('')
const error = ref<string | null>(null)
const message = ref<string | null>(null)
const loading = ref(false)
const requiresTwoFactor = ref(false)

// ⚡️ Ref pour bouton Google
const googleBtn = ref<HTMLDivElement | null>(null)
const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string

// ⚡️ Charger le SDK Google et initialiser le bouton
onMounted(() => {
  if (!document.getElementById('google-oauth')) {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.id = 'google-oauth'
    document.head.appendChild(script)

    script.onload = () => initGoogle()
  } else {
    initGoogle()
  }
})

function initGoogle() {
  if (!window.google || !googleBtn.value) return

  console.log('=== DEBUG COMPLET ===');
  console.log('Google object:', window.google);
  console.log('Client ID utilisé:', clientId);
  console.log('URL actuelle:', window.location.href);
  console.log('Origin:', window.location.origin);

  // Test avec le client ID public de Google
  const TEST_CLIENT_ID = "764086051850-6qr4p6gpi6hn506pt8ejuq83di341hur.apps.googleusercontent.com";
  console.log('Test avec client ID public...');

  // AJOUTEZ CECI - L'initialisation manquait !
  window.google.accounts.id.initialize({
    client_id: clientId, // Votre vrai client ID
    callback: handleGoogleResponse,
  });

  // Test avec le client ID public (commentez votre vrai client ID au-dessus et décommentez ci-dessous pour tester)
  /*
  window.google.accounts.id.initialize({
    client_id: TEST_CLIENT_ID,
    callback: (response) => {
      console.log('✅ Le client ID de test fonctionne !');
      alert('Le SDK Google fonctionne. Problème = votre configuration.');
    },
  });
  */

  window.google.accounts.id.renderButton(googleBtn.value, {
    theme: 'outline',
    size: 'large',
    width: 250,
  })
}

async function handleGoogleResponse(response: any) {
  try {
    // Envoi du token Google au backend
    const { data } = await api.post('/auth/google', { token: response.credential })
    persistTokens(data.tokens)
    persistProfile(data.user)
    window.dispatchEvent(new Event('auth-changed'))
    router.push('/')
  } catch (err: any) {
    error.value = err?.response?.data?.message || 'Erreur OAuth Google'
  }
}

// Toggle form
const toggleMode = () => {
  isLogin.value = !isLogin.value
  error.value = null
  message.value = null
  requiresTwoFactor.value = false
  twoFactorCode.value = ''
}

// Format 2FA
const formatTwoFactorCodeFlexible = () => {
  twoFactorCode.value = twoFactorCode.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 8)
}

// Helpers
function persistTokens(tokens: { accessToken: string; refreshToken: string }) {
  localStorage.setItem('accessToken', tokens.accessToken)
  localStorage.setItem('refreshToken', tokens.refreshToken)
  api.defaults.headers.common['Authorization'] = `Bearer ${tokens.accessToken}`
}
function persistProfile(user: any) {
  localStorage.setItem('username', user.username)
  localStorage.setItem('email', user.email)
  localStorage.setItem('avatar', user.avatar || '/avatars/default.png')
  localStorage.setItem('twoFactorEnabled', String(!!user.twoFactorEnabled))
  setSession(user.username, user.email, user.avatar, user.twoFactorEnabled)
}

// Actions login/register classiques
const handleLogin = async () => {
  error.value = null
  if(!validateInputs())
  {
    loading.value = false
    return
  }
  loading.value = true
  try {
    const { data } = await api.post('/auth/login', { email: email.value, password: password.value })
    if (data?.requiresTwoFactor) { requiresTwoFactor.value = true; return }
    persistTokens(data.tokens); persistProfile(data.user); window.dispatchEvent(new Event('auth-changed')); router.push('/')
  } catch (err: any) {
    error.value = err?.response?.data?.message || err?.response?.data?.error || 'Erreur de connexion'
  } finally { loading.value = false }
}
const handleTwoFactorLogin = async () => {
  error.value = null
  loading.value = true
  try {
    const { data } = await api.post('/auth/login', {
      email: email.value, password: password.value, twoFactorCode: twoFactorCode.value
    })
    persistTokens(data.tokens); persistProfile(data.user); window.dispatchEvent(new Event('auth-changed')); router.push('/')
  } catch (err: any) {
    error.value = err?.response?.data?.message || err?.response?.data?.error || 'Code invalide'
    twoFactorCode.value = ''
  } finally { loading.value = false }
}
const handleRegister = async () => {
  error.value = null
  if(!validateInputs())
  {
    loading.value = false
    return
  }
  loading.value = true
  try {
    await api.post('/register', { username: username.value, email: email.value, password: password.value })
    message.value = 'Compte créé avec succès. Connecte-toi maintenant.'; toggleMode()
  } catch (err: any) {
    error.value = err?.response?.data?.error || 'Erreur lors de la création du compte'
  } finally { loading.value = false }
}
const goBack = () => { requiresTwoFactor.value = false; twoFactorCode.value = ''; error.value = null }

function validateInputs(){
  //verification de l'email

function validateInputs(){
  //verification de l'email

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if(!emailRegex.test(email.value)){
    error.value = "Adresse email invalide"
    return false
  }
  //verification du mot de passe (minimum 8 cara)
  if(password.value.length < 8){
    error.value = "Le mot de passe doit contenir au moins 8 caracteres"
    return false
  }

  //verification de l'username (que register du coup)
  if(!isLogin.value)
  {
    if(username.value.length < 3)
    {
      error.value = "Le pseudo doit contenir au moins 3 caracteres"
      return false
    }
  }
  return true
}
</script>


<style scoped>
/* ===== Variables & base ===== */
.login-screen{
  --bg1: #0f1222;
  --bg2: #1a1440;
  --acc1: #7c4dff;
  --acc2: #4ac9ff;
  --text: #e8eaf0;
  --muted: #a8b0c2;
  --border: rgba(255,255,255,.12);
  --glass: rgba(255,255,255,.06);
  min-height: 100vh;
  padding: 5vh 1rem 4vh;
  position: relative;
  overflow: hidden;

}

.login-screen::before,
.login-screen::after{
  content: "";
  position: absolute;
  inset: -20%;

  transform: rotate(12deg);
  mask-image: radial-gradient(60% 60% at 50% 50%, #000 50%, transparent 80%);
  opacity: .5;
  pointer-events: none;
}

/* ===== Title ===== */
.login-title{
  color: var(--text);
  font-size: clamp(1.6rem, 2vw + 1rem, 2.2rem);
  font-weight: 800;
  letter-spacing: .3px;
  text-align: center;
  margin-bottom: 1.2rem;
  background: linear-gradient(90deg, #fff, #b8c6ff, #9fe7ff);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

/* ===== Card ===== */
.login-card{
  width: 100%;
  background: linear-gradient(180deg, rgba(255,255,255,.08), rgba(255,255,255,.05));
  backdrop-filter: blur(10px);
  border: 1px solid var(--border);
  border-radius: 7px;
  box-shadow: 0 20px 60px rgba(0,0,0,.35);
  padding: 1.2rem;
  display: flex;
  flex-direction: column;
  gap: .9rem;
  animation: cardIn .25s ease;
}
@keyframes cardIn {
  from { transform: translateY(8px); opacity: 0 }
  to   { transform: translateY(0);   opacity: 1 }
}

/* ===== Inputs ===== */
.login-fields{ display: flex; flex-direction: column; gap: .6rem; }
.inp{
  width: 100%;
  border: 2px solid var(--border);
  background: rgba(10, 12, 28, .35);
  color: var(--text);
  border-radius: 7px;
  padding: .75rem .9rem;
  font-size: 1rem;
  transition: .18s ease;
  outline: none;
}
.inp::placeholder{ color: #c9cfe7aa; }
.inp:hover{ border-color: #ffffff2a; background: rgba(10,12,28,.45); }
.inp:focus{
  border-color: #9fb5ff;
  box-shadow: 0 0 0 3px rgba(112, 126, 255, .25);
  background: rgba(10,12,28,.55);
}
.inp-otp{
  letter-spacing: .12em;
  font-weight: 800;
  text-transform: uppercase;
}

/* ===== Buttons ===== */
.btn{
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: .5rem;
  border: 0;
  border-radius: 7px;
  font-weight: 800;
  cursor: pointer;
  padding: .8rem 1rem;
  transition: transform .15s ease, box-shadow .2s ease, opacity .2s ease;
}
.btn:disabled{ opacity: .6; cursor: not-allowed; }
.btn-primary{
  background: linear-gradient(180deg, var(--acc1), #5a3bff);
  color: #000;
  box-shadow: 0 12px 26px rgba(95, 69, 255, .35);
}
.btn-primary:hover{ transform: translateY(-1px); box-shadow: 0 20px 34px rgba(95, 69, 255, .4); }
.btn-link{
  appearance: none;
  background: transparent;
  color: #9fc8ff;
  font-weight: 700;
  text-decoration: none;
  margin-top: .3rem;
  align-self: center;
}
.btn-link:hover{ text-decoration: underline; color: #cfe6ff; }

/* ===== 2FA head ===== */
.twofa-head{ text-align: center; margin-bottom: .2rem; }
.twofa-lock{
  width: 48px; height: 48px; margin: 0 auto .5rem;
  display: grid; place-items: center;
  border-radius: 50%;
  background: radial-gradient(circle at 30% 30%, #a6b9ff, #6dcfff);
  color: #0c1530; font-size: 1.5rem; font-weight: 900;
}
.twofa-sub{ color: var(--muted); font-size: .95rem; }

/* ===== Alerts ===== */
.alert{
  margin-top: 1rem;
  padding: .8rem 1rem;
  border-radius: 7px;
  border: 1px solid var(--border);
  font-weight: 700;
  max-width: 640px;
  text-align: center;
}
.alert.success{ color: #0f5132; background: #ecfdf5; border-color: #a7f3d0; }
.alert.error{ color: #842029; background: #fef2f2; border-color: #fecaca; }

/* ===== Transitions ===== */
.fade-enter-active, .fade-leave-active{ transition: opacity .18s ease }
.fade-enter-from, .fade-leave-to{ opacity: 0 }

/* ===== Responsive spacing ===== */
@media (min-width: 768px){
  .login-screen{ padding-top: 9vh; }
}
</style>
