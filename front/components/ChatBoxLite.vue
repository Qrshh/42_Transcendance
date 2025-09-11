<template>
  <div
    v-if="peerName"
    class="mc"
    :style="{ right: `${16 + offsetIndex * 340}px`, bottom: '16px' }"
  >
    <!-- HEADER -->
    <div class="mc__head" @click="toggleMinimize">
      <div class="mc__peer">
        <div class="mc__avatar" :style="{ background: getUserColor(peerName) }">
          <img
            v-if="peerAvatar"
            :src="peerAvatar"
            alt=""
            class="mc__avatar-img"
            @error="peerAvatar = null"
          />
          <span v-else>{{ getDefaultAvatar(peerName) }}</span>
        </div>
        <div class="mc__meta">
          <div class="mc__name">{{ peerName }}</div>
          <div class="mc__status" :class="{ online: isUserOnline, offline: !isUserOnline }">
            <span class="dot"></span>
            <span class="txt">{{ isUserOnline ? 'En ligne' : 'Hors ligne' }}</span>
            <span v-if="peerTyping" class="typing"> · saisie…</span>
          </div>
        </div>
      </div>

      <div class="mc__actions" @click.stop>
        <button
          class="mc__btn mc__btn--challenge"
          :disabled="!isUserOnline"
          title="Défier en partie"
          @click="emit('challengeUser', peerName)"
        >🎯</button>

        <button
          class="mc__btn"
          title="Voir le profil"
          @click="emit('viewProfile', peerName)"
        >👤</button>

        <button
          class="mc__btn"
          :title="isPeerBlocked ? 'Débloquer l\'utilisateur' : 'Bloquer l\'utilisateur'"
          @click="toggleBlockPeer"
        >{{ isPeerBlocked ? '🔓' : '🚫' }}</button>

        <button class="mc__btn" title="Réduire/Étendre" @click="toggleMinimize">
          {{ minimized ? '▢' : '━' }}
        </button>
        <button class="mc__btn" title="Fermer" @click="emit('close')">✕</button>
      </div>
    </div>

    <!-- CORPS -->
    <div v-show="!minimized" class="mc__body">
      <div ref="listRef" class="mc__list">
        <div
          v-for="m in messages"
          :key="m.id"
          class="mc__row"
          :class="{ 'is-me': m.from === meName }"
          :title="formatTime(m.at)"
        >
          <div class="mc__bubble" :class="{ pending: m.pending }">
            <div class="mc__headrow">
              <span class="from">{{ m.from === meName ? 'Vous' : m.from }}</span>
              <span class="time">{{ formatTime(m.at) }}</span>
            </div>
            <div class="mc__content">{{ m.content }}</div>
            <div v-if="m.from === meName" class="mc__status">
              <span class="read" :class="{ ok: !m.pending }">{{ m.pending ? '✓' : '✓✓' }}</span>
            </div>
          </div>
        </div>

        <!-- typing -->
        <transition name="typing">
          <div v-if="peerTyping" class="mc__typing">
            <div class="ava" :style="{ background: getUserColor(peerName) }">
              <img
                v-if="peerAvatar"
                :src="peerAvatar"
                alt=""
                class="mini-avatar"
                @error="peerAvatar = null"
              />
              <span v-else>{{ getDefaultAvatar(peerName) }}</span>
            </div>
            <div class="dots"><span></span><span></span><span></span></div>
            <span class="txt">{{ peerName }} écrit…</span>
          </div>
        </transition>
      </div>

      <!-- INPUT -->
      <div class="mc__input">
        <div v-if="showEmojiPicker" class="mc__emoji" @mousedown.prevent>
          <div class="grid">
            <button v-for="e in emojis" :key="e" class="e" @click="addEmoji(e)">{{ e }}</button>
          </div>
        </div>

        <div class="row">
          <button class="toggle" title="Emojis" @click="showEmojiPicker = !showEmojiPicker">😊</button>
          <input
            ref="inputRef"
            v-model="draft"
            class="field"
            type="text"
            placeholder="Tape ton message…"
            maxlength="500"
            @input="onTyping"
            @keyup.enter="send"
            @keydown.escape="showEmojiPicker = false"
          />
          <div class="sendbox">
            <span class="count" :class="{ warn: draft.length > 400 }">{{ draft.length }}/500</span>
            <button class="send" :disabled="!canSend || isSending" @click="send">
              <transition name="send" mode="out-in">
                <span v-if="!isSending" key="go" class="ic">➤</span>
                <span v-else key="wait" class="spin">⏳</span>
              </transition>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- TOAST -->
    <transition name="toast">
      <div v-if="toast.show" class="toast" :class="toast.type">{{ toast.icon }} {{ toast.msg }}</div>
    </transition>
  </div>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, nextTick, watch } from 'vue'
import type { Socket } from 'socket.io-client'
import { useSocket as useAppSocket } from '../views/plugins/socket'

/** ===== Props / Emits ===== **/
const props = defineProps<{
  me?: string
  receiver: string
  socket?: Socket
  isOnline?: boolean
  offsetIndex?: number
}>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'challengeUser', username: string): void
  (e: 'viewProfile', username: string): void
}>()

/** ===== Config ===== **/
import { API_BASE as API } from '../config'

/** ===== Derived ===== **/
const meName   = computed(() => (props.me ?? localStorage.getItem('username') ?? '').trim())
const peerName = computed(() => (props.receiver ?? '').trim())
const isUserOnline = computed(() => !!props.isOnline)
const offsetIndex  = computed(() => props.offsetIndex ?? 0)

/** ===== State ===== **/
type ChatMsg = { id: string; from: string; to: string; content: string; at: string; pending?: boolean }
const listRef = ref<HTMLDivElement | null>(null)
const inputRef = ref<HTMLInputElement | null>(null)
const minimized = ref(false)

const messages = ref<ChatMsg[]>([])
const draft = ref('')
const isSending = ref(false)
const peerTyping = ref(false)
const showEmojiPicker = ref(false)
const emojis = ['😊','😂','❤️','👍','👎','😢','😮','😡','🎉','🔥','💯','👏','🙏','💪','🎯','⚡']

const toast = ref<{show:boolean; msg:string; type:'success'|'error'|'info'; icon:string}>({
  show: false, msg: '', type: 'info', icon: 'ℹ️'
})

/** ===== Avatars ===== **/
const peerAvatar = ref<string | null>(null)
const meAvatar   = ref<string | null>(null)
const isPeerBlocked = ref(false)

function toAbs(u?: string | null) { if (!u) return null; return u.startsWith('http') ? u : `${API}${u}` }
async function fetchAvatar(username: string) {
  try { const r = await fetch(`${API}/user/${encodeURIComponent(username)}`); if (!r.ok) return null; const j = await r.json(); return toAbs(j?.avatar ?? null) }
  catch { return null }
}

/** ===== Socket ===== **/
const sock = ref<Socket|null>(null)

/** ===== Utils ===== **/
function getUserColor(username?: string) {
  const u = (username || '').trim()
  const cs = [
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  ]
  if (!u) return cs[2]
  return cs[u.charCodeAt(0) % cs.length]
}
function getDefaultAvatar(username?: string) {
  const set = ['🎮','🚀','⭐','🎯','🏆','💎','🔥','⚡','🌟','🎨']
  const u = (username || '').trim()
  return u ? set[u.charCodeAt(0) % set.length] : '🙂'
}
function formatTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 24*60*60*1000) return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  if (diff < 7*24*60*60*1000) return d.toLocaleDateString('fr-FR', { weekday: 'short', hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}
function showToast(msg: string, type: 'success'|'error'|'info' = 'info') {
  toast.value.msg = msg
  toast.value.type = type
  toast.value.icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'
  toast.value.show = true
  setTimeout(() => (toast.value.show = false), 2500)
}
function addEmoji(e: string) {
  draft.value += e
  // garder le picker ouvert pour enchaîner les emojis, mais redonner le focus au champ
  nextTick(() => inputRef.value?.focus())
}
function scrollBottom() {
  nextTick(() => { const el = listRef.value; if (el) el.scrollTop = el.scrollHeight })
}
function toggleMinimize() {
  minimized.value = !minimized.value
  if (!minimized.value) nextTick(() => inputRef.value?.focus())
}

/** ===== Typing ===== **/
let typingTimer: number | undefined
function onTyping() {
  if (!sock.value || !meName.value || !peerName.value) return
  sock.value.emit('typing', { sender: meName.value, receiver: peerName.value })
  clearTimeout(typingTimer)
  typingTimer = window.setTimeout(() => {
    sock.value?.emit('stopTyping', { sender: meName.value, receiver: peerName.value })
  }, 1200)
}

/** ===== Send ===== **/
const canSend = computed(() => !!draft.value.trim() && !!meName.value && !!peerName.value)
function send() {
  if (!canSend.value || !sock.value || isSending.value) return
  isSending.value = true
  const text = draft.value.trim()
  const tmp: ChatMsg = {
    id: 'tmp-' + Date.now() + '-' + Math.random().toString(36).slice(2,6),
    from: meName.value, to: peerName.value, content: text,
    at: new Date().toISOString(), pending: true
  }
  messages.value.push(tmp)
  draft.value = ''; showEmojiPicker.value = false; scrollBottom()
  sock.value.emit('sendMessage', { sender: meName.value, receiver: peerName.value, content: text })
  setTimeout(() => { isSending.value = false }, 4000) // filet
}

/** ===== History ===== **/
async function loadMessages() {
  if (!meName.value || !peerName.value) return
  try {
    const r = await fetch(`${API}/chat/message/${encodeURIComponent(meName.value)}/${encodeURIComponent(peerName.value)}`)
    const arr = r.ok ? await r.json() : []
    messages.value = (arr || []).map((m: any, i: number) => ({
      id: m.id || `srv-${i}-${m.timestamp || Date.now()}`,
      from: m.sender, to: m.receiver, content: m.content,
      at: m.timestamp || new Date().toISOString(), pending: false
    }))
    await nextTick(); scrollBottom()
  } catch { showToast(`Erreur chargement messages`, 'error') }
}

/** ===== Socket listeners ===== **/
function onNewMessage(p: any) {
  const ok =
    (p?.sender === peerName.value && p?.receiver === meName.value) ||
    (p?.sender === meName.value && p?.receiver === peerName.value)
  if (!ok) return

  if (p?.sender === meName.value) {
    for (let i = messages.value.length - 1; i >= 0; i--) {
      const m = messages.value[i]
      if (m.pending && m.from === meName.value && m.to === peerName.value && m.content === p.content) {
        messages.value[i] = { ...m, pending: false, at: p.timestamp || m.at }
        break
      }
    }
  } else {
    messages.value.push({
      id: 'srv-' + (p.id || Date.now()),
      from: p.sender, to: p.receiver, content: p.content,
      at: p.timestamp || new Date().toISOString(), pending: false
    })
  }
  isSending.value = false
  peerTyping.value = false
  scrollBottom()
}
function onMessageError(err: any) { isSending.value = false; showToast(err?.error || 'Envoi impossible', 'error') }
function onUserTyping(p: any) {
  if (p?.sender === peerName.value) {
    peerTyping.value = true; setTimeout(() => (peerTyping.value = false), 1400)
  }
}

/** ===== Challenge propagation ===== **/
function announceChallengeStart(rid: string) {
  try { localStorage.setItem('pendingRoomId', rid) } catch {}
  window.dispatchEvent(new CustomEvent('challengeStart', { detail: { roomId: rid }}))
}
let handledStart = false
function handleChallengeStart({ roomId }: any = {}) {
  if (!roomId) return
  if (handledStart) return
  handledStart = true
  announceChallengeStart(roomId)
  setTimeout(() => { handledStart = false }, 2000)
}

/** ===== Block peer ===== **/
async function refreshBlockedState() {
  const me = (meName.value || '').trim()
  const peer = (peerName.value || '').trim()
  if (!me || !peer) { isPeerBlocked.value = false; return }
  try {
    const r = await fetch(`${API}/chat/blocked/${encodeURIComponent(me)}`)
    const rows = r.ok ? await r.json() : []
    isPeerBlocked.value = Array.isArray(rows) && rows.some((x: any) => (x?.blocked || '').trim() === peer)
  } catch { isPeerBlocked.value = false }
}

async function toggleBlockPeer() {
  const me = (meName.value || '').trim()
  const peer = (peerName.value || '').trim()
  if (!me || !peer) return
  if (isPeerBlocked.value) {
    if (!confirm(`Débloquer ${peer} ?`)) return
    try {
      await fetch(`${API}/chat/unblock`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ blocker: me, blocked: peer }) })
      isPeerBlocked.value = false
      showToast(`${peer} débloqué`, 'success')
    } catch { showToast('Erreur lors du déblocage', 'error') }
  } else {
    if (!confirm(`Bloquer ${peer} ?`)) return
    try {
      await fetch(`${API}/chat/block`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ blocker: me, blocked: peer }) })
      isPeerBlocked.value = true
      showToast(`${peer} bloqué`, 'success')
      emit('close')
    } catch { showToast('Erreur lors du blocage', 'error') }
  }
}

/** ===== Lifecycle ===== **/
onMounted(async () => {
  // Utilise le socket fourni par le parent sinon le socket global (plugin)
  sock.value = props.socket || useAppSocket()
  if (!sock.value) return
  if (meName.value) sock.value.emit('identify', meName.value)

  // avatars
  if (meName.value)   meAvatar.value   = await fetchAvatar(meName.value)
  if (peerName.value) peerAvatar.value = await fetchAvatar(peerName.value)

  sock.value.on('newMessage', onNewMessage)
  sock.value.on('messageError', onMessageError)
  sock.value.on('userTyping', onUserTyping)
  sock.value.on('userStoppedTyping', onUserTyping)

  //  Déclencheur challenge pour tous
  sock.value.on('challengeStart', handleChallengeStart)

  await loadMessages()
  await refreshBlockedState()
  nextTick(scrollBottom)
  nextTick(() => inputRef.value?.focus())
})

onBeforeUnmount(() => {
  sock.value?.off('newMessage', onNewMessage)
  // sock.value?.off('messageSent', onNewMessage)
  sock.value?.off('messageError', onMessageError)
  sock.value?.off('userTyping', onUserTyping)
  sock.value?.off('userStoppedTyping', onUserTyping)
  sock.value?.off('challengeStart', handleChallengeStart)
  if (!props.socket) sock.value?.disconnect()
})

watch(() => props.receiver, async () => {
  peerTyping.value = false
  draft.value = ''
  peerAvatar.value = peerName.value ? await fetchAvatar(peerName.value) : null
  await loadMessages()
  await refreshBlockedState()
})
</script>

<style scoped>
/* ===== Container (Messenger style bottom-right) ===== */
.mc { position: fixed; width: 320px; max-height: 460px; background: var(--color-background, #111); border: 1px solid var(--color-border, #2a2a2a); border-radius: 7px; box-shadow: 0 14px 34px rgba(0,0,0,.4); overflow: hidden; z-index: 9999; display: flex; flex-direction: column;}

/* ===== Header ===== */
.mc__head { display:flex; align-items:center; justify-content:space-between; gap:.6rem; padding:.6rem .6rem .6rem .4rem; background: var(--color-background-soft, #181818); border-bottom: 1px solid var(--color-border, #2a2a2a); user-select:none; cursor:pointer; }
.mc__peer { display:flex; align-items:center; gap:.6rem }
.mc__avatar { width:30px; height:30px; border-radius:50%; display:grid; place-items:center; color:#fff; font-weight:700; font-size:.95rem; overflow: hidden; /* pour rogner l'image circulaire */ }
.mc__avatar-img { width:100%; height:100%; object-fit:cover; border-radius:50%; display:block }
.mc__meta { display:flex; flex-direction:column; gap:.1rem }
.mc__name { color:#fff; font-weight:700; font-size:.95rem; max-width:160px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis }
.mc__status { display:flex; align-items:center; gap:.4rem; font-size:.78rem; color:#9aa }
.mc__status .dot { width:8px; height:8px; border-radius:50%; background: var(--color-offline) }
.mc__status.online .dot { background: var(--color-online); animation:pulse 2s infinite }
.mc__status .typing { color:#bbb }
.mc__actions { display:flex; gap:.25rem }
.mc__btn { background: transparent; border: 0; color: #bbb; width: 28px; height: 28px; border-radius: 7px; cursor: pointer; }
.mc__btn:hover { background: rgba(255,255,255,.07); color:#fff }
.mc__btn--challenge { background: linear-gradient(135deg,#ff6b6b,#ee5a24); color:#fff }
.mc__btn--challenge:hover { filter: brightness(1.05) }

/* ===== Body / list ===== */
.mc__body { display:flex; flex-direction:column; min-height: 280px }
.mc__list { padding:.75rem; display:flex; flex-direction:column; gap:.4rem; overflow-y:auto; scrollbar-gutter:stable; }
.mc__row { display:flex }
.mc__row.is-me { justify-content:flex-end }
.mc__bubble { max-width: 78%; padding:.55rem .7rem; border-radius:7px; line-height:1.3; background:#fff; color:#000; border:1px solid #2a2a2a; position:relative; box-shadow: 0 2px 12px rgba(0,0,0,.15); }
.mc__row.is-me .mc__bubble { background:#2a5bd7; border-color:#2a5bd7; color:#fff }
.mc__bubble.pending { opacity:.6 }
.mc__headrow{ display:flex; justify-content:space-between; gap:.6rem; margin-bottom:.25rem; font-size:.75rem; opacity:.85 }
.mc__content{ font-size:.95rem; word-break: break-word }
.mc__status{ text-align:right; margin-top:.2rem }
.mc__status .read{ font-size:.72rem; opacity:.75 }
.mc__status .read.ok{ opacity:1 }

/* typing */
.mc__typing{ display:flex; align-items:center; gap:.5rem; padding:.5rem .65rem; background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.08); border-radius:7px; max-width:60%; }
.mc__typing .ava{
  width:20px; height:20px; border-radius:50%;
  display:grid; place-items:center; color:#fff; font-size:.8rem; overflow:hidden;
}
.mini-avatar { width:100%; height:100%; object-fit:cover; border-radius:50%; display:block }
.mc__typing .dots{ display:flex; gap:.25rem }
.mc__typing .dots span{ width:6px; height:6px; background: rgba(255,255,255,.7); border-radius:50%; animation:typingDots 1.5s infinite }
.mc__typing .dots span:nth-child(2){ animation-delay:.2s }
.mc__typing .dots span:nth-child(3){ animation-delay:.4s }
.mc__typing .txt{ color:#cfd6ff; font-style:italic; font-size:.8rem }

/* ===== Input ===== */
.mc__input { position:relative; padding:.55rem; border-top:1px solid var(--color-border,#2a2a2a); background: var(--color-background-soft,#181818) }
.mc__emoji{ position:absolute; bottom:100%; left:.6rem; right:.6rem; background:linear-gradient(135deg,#363636,#19191a); border:1px solid rgba(255,255,255,.1); border-radius:7px; padding:.6rem; box-shadow:0 -10px 30px rgba(0,0,0,.3); z-index:5 }
.mc__emoji .grid{ display:grid; grid-template-columns: repeat(8,1fr); gap:.35rem; max-height:180px; overflow:auto }
.mc__emoji .e{ background: rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.1); border-radius:7px; padding:.4rem; font-size:1.2rem; cursor:pointer }
.mc__emoji .e:hover{ background: rgba(255,255,255,.16) }

.mc__input .row{ display:flex; align-items:flex-end; gap:.5rem }
.toggle{
  background: rgba(255,255,255,.1); border:1px solid rgba(255,255,255,.2);
  color:#fff; width:2.4rem; height:2.4rem; border-radius:7px; cursor:pointer
}
.toggle:hover{ background: rgba(255,255,255,.2) }
.field{
  flex:1; min-height:2.5rem; max-height:6rem; padding:.6rem .75rem;
  background: rgba(255,255,255,.08); border:2px solid rgba(255,255,255,.12); color:#fff;
}
.field:focus{ outline:none; border-color:#64b5f6; box-shadow:0 0 0 3px rgba(100,181,246,.2) }
.sendbox{ display:flex; flex-direction:column; align-items:center; gap:.2rem }
.count{ font-size:.7rem; color:rgba(255,255,255,.6) }
.count.warn{ color:#f59e0b }
.send{
  width:2.4rem; height:2.4rem; border-radius:7px; border:0; cursor:pointer; color:#fff;
  background: linear-gradient(135deg,#64b5f6,#42a5f5); box-shadow:0 2px 8px rgba(100,181,246,.3)
}
.send:disabled{ opacity:.5; cursor:not-allowed }
.ic{ transform: rotate(-90deg) }
.spin{ animation: spin 1s linear infinite }

/* ===== Toast ===== */
.toast{
  position:absolute; top:1.6rem; left:50%; transform:translateX(-50%);
  background: rgba(0,0,0,.9); color:#fff; padding:.6rem .8rem; border-radius:7px; font-size:.85rem; z-index:10
}
.toast.success{ background:rgba(16,185,129,.9) }
.toast.error{ background:rgba(239,68,68,.9) }
.toast.info{ background:rgba(100,181,246,.9) }

/* ===== Transitions ===== */
.typing-enter-active,.typing-leave-active{ transition: all .25s ease }
.typing-enter-from,.typing-leave-to{ opacity:0; transform: translateY(6px) scale(.98) }
.send-enter-active,.send-leave-active{ transition: all .18s ease }
.send-enter-from,.send-leave-to{ opacity:0; transform: scale(.85) }
.toast-enter-active,.toast-leave-active{ transition: all .25s ease }
.toast-enter-from,.toast-leave-to{ opacity:0; transform: translateX(-50%) translateY(-8px) }

/* ===== Scrollbars ===== */
.mc__list::-webkit-scrollbar{ width:6px }
.mc__list::-webkit-scrollbar-thumb{ background: rgba(255,255,255,.2); border-radius:3px }

/* ===== Misc ===== */
@keyframes spin{ to{ transform: rotate(360deg) } }
@keyframes typingDots{ 0%,60%,100{ opacity:.3; transform:scale(.8) } 30%{ opacity:1; transform:scale(1) } }
@keyframes pulse{ 0%,100{ opacity:1 } 50{ opacity:.5 } }
</style>
