<template>
  <div class="friend-list">
   

    <div v-if="friends.length === 0" class="no-friends">
      {{t.noFrdMsg}}
    </div>

    <div class="friend-grid">
      <div
        v-for="f in friends"
        :key="f.friend"
        class="friend-card"
        @click="$emit('startChat', f.friend)"
      >
        <!-- Avatar (clic = profil) -->
        <button
          class="avatar-wrap"
          :style="{ background: getUserColor(f.friend) }"
          title="Voir le profil"
          @click.stop="goProfile(f.friend)"
        >
          <img
            v-if="f.avatar"
            class="avatar-img"
            :alt="`Avatar ${f.friend}`"
            :src="f.avatar"
            @error="f.avatar = null"
            referrerpolicy="no-referrer"
          />
          <div v-else class="avatar-fallback">{{ initials(f.friend) }}</div>

          <span class="presence" :class="{ online: isOnline(f.friend), offline: !isOnline(f.friend) }"></span>
        </button>

        <!-- Infos -->
        <div class="friend-info">
          <div class="friend-top">
            <span class="friend-name">{{ f.friend }}</span>
            <span class="friend-status" :class="isOnline(f.friend) ? 'online' : 'offline'">
              <span class="dot"></span>
              {{ isOnline(f.friend) ? 'En ligne' : 'Hors ligne' }}
            </span>
          </div>

          <div class="friend-actions-inline" @click.stop>
            <button class="action-btn" title="Message" @click="$emit('startChat', f.friend)">💬</button>
            <button class="action-btn" title="Profil"  @click.prevent.stop="goProfile(f.friend)">👤</button>
            <button class="action-btn more" title="Plus" @click="toggleActionsMenu(f.friend)">⋮</button>
          </div>
        </div>

        <!-- Menu contextuel -->
        <div
          v-if="activeActionMenu === f.friend"
          class="actions-menu"
          @click.stop
        >
          <button class="action-item danger" @click="blockUser(f.friend)">🚫 {{ t.block }}</button>
          <button class="action-item danger" @click="removeFriend(f.friend)">❌ {{ t.remove }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from '../../composables/useI18n'
const { t, onLangChange } = useI18n()

type FriendRow = { friend: string; avatar?: string | null }

const emit = defineEmits<{
  (e: 'startChat', friendName: string): void
  (e: 'viewProfile', friendName: string): void
}>()

const props = defineProps<{
  connectedUsers?: string[]
}>()

const router = useRouter()

/** ===== Config API ===== **/
const API_BASE = (import.meta as any).env?.VITE_API_BASE || 'http://localhost:3000'

/** ===== State ===== **/
const friends = ref<FriendRow[]>([])
const onlineUsers = ref<Set<string>>(new Set())
const activeActionMenu = ref<string | null>(null)

/** ===== Load friends (avec avatars) ===== **/
async function loadFriends() {
  try {
    const me = localStorage.getItem('username')
    if (!me) return

    // 1) On tente l’endpoint enrichi si dispo
    let res = await fetch(`${API_BASE}/friends/${encodeURIComponent(me)}/full`)
    if (res.ok) {
      // Attendu: [{ username, avatar?, status? }, ...]
      const rows: Array<{ username: string; avatar?: string | null }> = await res.json()
      friends.value = rows.map(r => ({ friend: r.username, avatar: r.avatar ?? null }))
      return
    }

    // 2) Fallback: simple liste, puis enrichissement via /user/:friend
    res = await fetch(`${API_BASE}/friends/${encodeURIComponent(me)}`)
    if (!res.ok) throw new Error('friends fetch failed')

    const rows: Array<{ friend: string }> = await res.json()
    const enriched = await Promise.all(rows.map(async r => {
      try {
        const ru = await fetch(`${API_BASE}/user/${encodeURIComponent(r.friend)}`)
        if (!ru.ok) return { friend: r.friend, avatar: null }
        const u = await ru.json()
        return { friend: r.friend, avatar: u?.avatar ?? null }
      } catch {
        return { friend: r.friend, avatar: null }
      }
    }))
    friends.value = enriched
  } catch (e) {
    console.error('Erreur friends:', e)
    friends.value = []
  }
}

/** ===== Presence ===== **/
const isOnline = (username: string) => onlineUsers.value.has((username || '').trim())

/** ===== Menu ===== **/
function toggleActionsMenu(friendName: string) {
  activeActionMenu.value = activeActionMenu.value === friendName ? null : friendName
}
function closeMenus(e: MouseEvent) {
  if (!(e.target as Element)?.closest('.friend-card')) {
    activeActionMenu.value = null
  }
}

/** ===== Navigation profil (même logique que ProfileView) ===== **/
function goProfile(username: string) {
  router.push('/profile/' + encodeURIComponent(username)) // navigation route
  emit('viewProfile', username)                            // compat si affichage inline
}

/** ===== Block / Remove ===== **/
async function blockUser(friendName: string) {
  if (!confirm(`Bloquer ${friendName} ?`)) return
  try {
    const me = localStorage.getItem('username')
    await fetch(`${API_BASE}/chat/block`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocker: me, blocked: friendName })
    })
    alert(`${friendName} a été bloqué`)
  } catch (e) {
    console.error('block error', e); alert('Erreur lors du blocage')
  } finally {
    activeActionMenu.value = null
  }
}
async function removeFriend(friendName: string) {
  if (!confirm(`Retirer ${friendName} de vos amis ?`)) return
  try {
    const me = localStorage.getItem('username')
    await fetch(`${API_BASE}/friends/remove`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: me, to: friendName })
    })
    await loadFriends()
    alert(`${friendName} retiré`)
  } catch (e) {
    console.error('remove error', e); alert('Erreur lors de la suppression')
  } finally {
    activeActionMenu.value = null
  }
}

/** ===== Lifecycle ===== **/
onMounted(() => {
  loadFriends()
  document.addEventListener('click', closeMenus)
})
onUnmounted(() => {
  document.removeEventListener('click', closeMenus)
})

watch(
  () => props.connectedUsers,
  (arr) => { onlineUsers.value = new Set(arr || []) },
  { immediate: true }
)

/** ===== UI helpers ===== **/
function getUserColor(username?: string) {
  const u = (username || 'a').charCodeAt(0)
  const cs = [
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  ]
  return cs[u % cs.length]
}
function initials(username?: string) {
  const u = (username || '').trim()
  return u ? u[0]!.toUpperCase() : 'U'
}
</script>

<style scoped>
.title { margin: 0 0 .8rem 0; font-weight: 800; color: #fff; }

.no-friends {
  text-align: center; padding: 2rem 1rem; color: rgba(255,255,255,.7);
  background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.12); border-radius: 14px;
}

/* ===== Grid ===== */
.friend-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: .9rem;
}

/* ===== Card ===== */
.friend-card {
  position: relative;
  display: grid;
  grid-template-columns: 64px 1fr;
  gap: .9rem;
  align-items: center;
  background: rgba(255,255,255,.08);
  border: 1px solid rgba(255,255,255,.12);
  border-radius: 14px;
  padding: .9rem;
  transition: .18s ease;
  cursor: pointer;
}
.friend-card:hover { background: rgba(255,255,255,.12); transform: translateY(-2px) }

/* ===== Avatar ===== */
.avatar-wrap {
  position: relative;
  width: 3.2rem; height: 3.2rem; border-radius: 50%;
  display: grid; place-items: center; overflow: hidden; color: #fff; flex-shrink: 0;
  box-shadow: 0 6px 18px rgba(0,0,0,.25);
  border: 2px solid rgba(255,255,255,.18);
  cursor: pointer;
}
.avatar-img {
  width: 100%; height: 100%; object-fit: cover; display: block;
}
.avatar-fallback {
  font-weight: 800; font-size: 1.1rem; letter-spacing: .5px; user-select: none;
}
.presence {
  position: absolute; right: -2px; bottom: -2px; width: 14px; height: 14px;
  border-radius: 50%; border: 2px solid #0b1020; background: #ef4444;
}
.presence.online { background: #10b981 }

/* ===== Infos ===== */
.friend-info { min-width: 0 }
.friend-top { display:flex; align-items:center; justify-content:space-between; gap:.6rem; margin-bottom: .25rem }
.friend-name {
  font-weight: 800; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.friend-status {
  display: inline-flex; align-items:center; gap: .35rem; font-size: .82rem;
  color: rgba(255,255,255,.75);
}
.friend-status.online { color: #10b981 }
.friend-status.offline { color: #ef4444 }
.friend-status .dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor }

/* ===== Actions inline ===== */
.friend-actions-inline { display: flex; gap: .35rem }
.action-btn {
  background: rgba(255,255,255,.1); border: 1px solid rgba(255,255,255,.2);
  color: #fff; width: 34px; height: 34px; border-radius: 10px; cursor: pointer;
  transition: .16s ease;
}
.action-btn:hover { background: rgba(255,255,255,.18) }
.action-btn.more { font-weight: 700 }

/* ===== Menu contextuel ===== */
.actions-menu {
  position: absolute; right: .6rem; top: calc(100% - .6rem);
  min-width: 200px; padding: .4rem; z-index: 30;
  border-radius: 12px; backdrop-filter: blur(8px);
  background: rgba(23, 26, 43, .96);
  border: 1px solid rgba(255,255,255,.12);
  box-shadow: 0 18px 40px rgba(0,0,0,.4);
}
.action-item {
  width: 100%; text-align: left; border: 0; background: transparent; color: #fff;
  padding: .6rem .75rem; border-radius: 10px; cursor: pointer; font-weight: 600;
}
.action-item:hover { background: rgba(255,255,255,.08) }
.action-item.danger:hover { background: rgba(239, 68, 68, .18) }
.sep { height: 1px; margin: .35rem 0; background: rgba(255,255,255,.12) }

/* ===== Responsive ===== */
@media (max-width: 860px) {
  .friend-grid { grid-template-columns: 1fr }
}
</style>
