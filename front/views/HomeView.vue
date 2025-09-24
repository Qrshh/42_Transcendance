<template>
  <main class="home">
    <section class="hero panel">
      <div class="hero-content">
        <h1 class="hero-title">{{ t.heroTitle }}</h1>
        <p class="hero-text">{{ t.heroText }}</p>
        <div class="hero-actions">
          <button class="btn btn-primary" @click="goPrimary">{{ t.primaryButton }}</button>
          <button class="btn btn-secondary" @click="goSocial">{{ t.secondaryButton }}</button>
        </div>
        <dl class="hero-stats">
          <div v-for="stat in statCards" :key="stat.label" class="stat">
            <dt>{{ stat.value }}</dt>
            <dd>{{ t[stat.label] }}</dd>
          </div>
        </dl>
        <p v-if="overviewError" class="stats-error">{{ overviewError }}</p>
      </div>
      <div class="hero-visual">
        <Computer3D class="arena-model" />
      </div>
    </section>

    <section class="feature-grid">
      <article v-for="feature in features" :key="feature.title" class="feature-card panel">
        <div class="feature-icon">{{ feature.icon }}</div>
        <h3>{{ t[feature.title] }}</h3>
        <p>{{ t[feature.text] }}</p>
      </article>
    </section>

    <section class="live panel">
      <header class="live-head">
        <div>
          <h2>{{ t.liveHeader }}</h2>
          <p>{{ t.liveSubHeader }}</p>
        </div>
        <button class="btn btn-secondary" @click="goSpectate">{{ t.liveButton }}</button>
      </header>

      <div class="live-cards" v-if="liveMatchesDisplay.length">
        <article v-for="match in liveMatchesDisplay" :key="match.id" class="live-card">
          <div class="vs">
            <span class="player">{{ match.players.p1 || '???' }}</span>
            <span class="score">{{ match.score.player1 ?? 0 }} - {{ match.score.player2 ?? 0 }}</span>
            <span class="player">{{ match.players.p2 || '???' }}</span>
          </div>
          <div class="meta">
            <span>{{ formatModeLabel(match) }}</span>
            <span v-if="match.spectators">{{ match.spectators }} {{ t.spectators }}</span>
            <span v-if="match.createdAt">{{ formatRelativeTime(match.createdAt) }}</span>
          </div>
          <button class="btn btn-primary" @click="goWatch(match.id)">{{ t.watchButton }}</button>
        </article>
      </div>

      <div v-else class="live-empty">
        <p v-if="liveError">{{ liveError }}</p>
        <p v-else>{{ t.liveEmpty }}</p>
      </div>

      <div v-if="liveLobbiesDisplay.length" class="lobby-list">
        <h3>{{ t.roomPublic }}</h3>
        <div class="lobby-grid">
          <article v-for="lobby in liveLobbiesDisplay" :key="lobby.id" class="lobby-card">
            <div class="lobby-head">
              <h4>{{ lobby.name || t.roomUnnamed }}</h4>
              <span class="lobby-pill" :class="{ protected: lobby.hasPassword }">
                {{ lobby.hasPassword ? t.roomPrivate : t.roomPublic }}
              </span>
            </div>
            <p class="lobby-meta">
              {{ lobby.currentPlayers }}/{{ lobby.maxPlayers }} joueurs · {{ lobby.status === 'starting' ? t.statusStarting : t.statusWaiting }}
            </p>
            <div class="lobby-flags">
              <span v-if="lobby.accelBall">{{ t.flagAccelBall }}</span>
              <span v-if="lobby.paddleDash">{{ t.flagPaddleDash }}</span>
            </div>
          </article>
        </div>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import Computer3D from '../components/3d/Computer3D.vue'
import { isLoggedIn } from '../stores/auth'
import { API_BASE } from '../config'
import { useI18n } from '../composables/useI18n'

const {t} = useI18n()
const router = useRouter()

const features = [
  { icon: '⚡', title: 'featureMatchmaking', text: 'featureMatchmakingText' },
  { icon: '🎯', title: 'featureTournaments', text: 'featureTournamentsText' },
  { icon: '🤝', title: 'featureSocialHub', text: 'featureSocialHubText' }
]

const overview = ref<{ playersOnline: number; matchesToday: number; tournamentsLive: number; lobbiesOpen: number } | null>(null)
const overviewError = ref<string | null>(null)
const liveMatches = ref<Array<any>>([])
const liveLobbies = ref<Array<any>>([])
const liveError = ref<string | null>(null)

const numberFormatter = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })
const formatStat = (value: number | null | undefined) => value == null ? '—' : numberFormatter.format(value)

const statCards = computed(() => [
  { value: formatStat(overview.value?.playersOnline), label: 'statPlayers' },
  { value: formatStat(overview.value?.matchesToday), label: 'statMatches' },
  { value: formatStat(overview.value?.tournamentsLive), label: 'statTournaments' },
  { value: formatStat(overview.value?.lobbiesOpen), label: 'statLobbies' }
])

const liveMatchesDisplay = computed(() => liveMatches.value.slice(0, 6))
const liveLobbiesDisplay = computed(() => liveLobbies.value.slice(0, 4))

const fetchOverview = async () => {
  overviewError.value = null
  try {
    const res = await fetch(`${API_BASE}/stats/overview`)
    if (!res.ok) throw new Error(`Status ${res.status}`)
    overview.value = await res.json()
  } catch (err: any) {
    overviewError.value = err?.message || t.overviewError
  }
}

const fetchLiveMatches = async () => {
  liveError.value = null
  try {
    const res = await fetch(`${API_BASE}/stats/live/matches`)
    if (!res.ok) throw new Error(`Status ${res.status}`)
    const data = await res.json()
    liveMatches.value = Array.isArray(data?.matches) ? data.matches : []
    liveLobbies.value = Array.isArray(data?.lobbies) ? data.lobbies : []
  } catch (err: any) {
    liveError.value = err?.message || t.liveError
    liveMatches.value = []
    liveLobbies.value = []
  }
}

const formatModeLabel = (match: any) => {
  if (match?.mode && match.mode !== 'duel') return match.mode
  switch (match?.source) {
    case 'tournament': return t.modeTournament
    case 'challenge': return t.modeChallenge
    case 'lobby': return t.modeLobby
    default: return t.modeQuickMatch
  }
}

const formatRelativeTime = (iso: string | number | null) => {
  if (!iso) return ''
  const date = typeof iso === 'number' ? new Date(iso) : new Date(iso)
  const diff = Date.now() - date.getTime()
  const minutes = Math.round(diff / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `Il y a ${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `Il y a ${hours} h`
  const days = Math.round(hours / 24)
  return `Il y a ${days} j`
}

let refreshTimer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  fetchOverview()
  fetchLiveMatches()
  refreshTimer = setInterval(() => {
    fetchOverview()
    fetchLiveMatches()
  }, 15000)
})
onBeforeUnmount(() => { if (refreshTimer) clearInterval(refreshTimer) })

const primaryLabel = computed(() => isLoggedIn.value ? t.primaryButton : t.primaryButton)
const goPrimary = () => router.push(isLoggedIn.value ? '/game' : '/login')
const goSocial = () => router.push('/social')
const goSpectate = () => router.push('/game')
const goWatch = (roomId: string) => {
  try {
    localStorage.setItem('pendingRoomId', roomId)
    localStorage.setItem('pendingRoomSpectator', '1')
  } catch {}
  router.push('/game')
}
</script>



<style scoped>
.home {
  display: grid;
  gap: 2.5rem;
  padding: 3.5rem 2rem 4rem;
}

.hero {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
  gap: 2rem;
  align-items: center;
  padding: 2.5rem;
}

.hero-content {
  display: grid;
  gap: 1.25rem;
}

.hero-title {
  font-size: clamp(2rem, 4vw, 3rem);
  font-weight: 800;
  line-height: 1.1;
  color: var(--color-heading);
}

.hero-text {
  font-size: 1.05rem;
  line-height: 1.6;
  color: var(--color-text);
  opacity: .92;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: .85rem;
}

.hero-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
  margin: 0;
}

.stat {
  min-width: 140px;
}

.stat dt {
  font-size: 1.75rem;
  font-weight: 800;
  color: var(--color-heading);
}

.stat dd {
  margin: 0;
  color: var(--color-text);
  opacity: .65;
  font-size: .95rem;
}

.stats-error {
  margin: 0;
  font-size: .85rem;
  color: #f97316;
  opacity: .85;
}

.hero-visual {
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
}

.arena-model {
  width: min(420px, 100%);
  max-height: 420px;
  filter: drop-shadow(0 30px 50px rgba(15, 23, 42, .35));
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1.5rem;
}

.feature-card {
  display: grid;
  gap: .75rem;
  padding: 1.6rem;
  transition: transform .25s ease, box-shadow .25s ease;
}

.feature-card:hover {
  transform: translateY(-6px);
  box-shadow: var(--shadow-lg);
}

.feature-icon {
  font-size: 1.8rem;
}

.feature-card h3 {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--color-heading);
}

.feature-card p {
  margin: 0;
  color: var(--color-text);
  opacity: .8;
}

.live {
  display: grid;
  gap: 1.5rem;
  padding: 2.25rem;
}

.live-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
}

.live-head h2 {
  margin: 0;
  font-size: 1.6rem;
  font-weight: 700;
  color: var(--color-heading);
}

.live-head p {
  margin: .35rem 0 0;
  color: var(--color-text);
  opacity: .75;
}

.live-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
}

.live-card {
  display: grid;
  gap: .75rem;
  padding: 1.4rem;
  border: 1px solid var(--color-border);
  border-radius: 7px;
  background: #2221218f;
  box-shadow: var(--shadow-md);
}

.vs {
  display: grid;
  gap: .4rem;
  text-align: center;
}

.player {
  font-weight: 700;
  color: var(--color-heading);
}

.score {
  font-size: 1.4rem;
  font-weight: 800;
  color: white;
}

.meta {
  display: flex;
  justify-content: space-between;
  font-size: .85rem;
  color: var(--color-text);
  opacity: .7;
}

.live-empty {
  padding: 1.2rem;
  border-radius: 12px;
  background: #2221218f;
  color: var(--color-text);
  text-align: center;
}

.lobby-list {
  display: grid;
  gap: 1rem;
}

.lobby-list h3 {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--color-heading);
}

.lobby-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
}

.lobby-card {
  border: 1px solid var(--color-border);
  border-radius: 14px;
  padding: 1.1rem 1.3rem;
  background: rgba(var(--color-background-rgb, 25,25,35), .85);
  box-shadow: var(--shadow-sm);
  display: grid;
  gap: .6rem;
}

.lobby-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: .75rem;
}

.lobby-head h4 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--color-heading);
}

.lobby-pill {
  font-size: .75rem;
  font-weight: 600;
  padding: .2rem .55rem;
  border-radius: 999px;
  background: rgba(59, 130, 246, .15);
  color: var(--color-primary);
  text-transform: uppercase;
}

.lobby-pill.protected {
  background: rgba(239, 68, 68, .15);
  color: #ef4444;
}

.lobby-meta {
  margin: 0;
  color: var(--color-text);
  opacity: .75;
  font-size: .9rem;
}

.lobby-flags {
  display: flex;
  gap: .6rem;
  flex-wrap: wrap;
  font-size: .8rem;
  color: var(--color-text);
  opacity: .75;
}

@media (max-width: 1024px) {
  .hero {
    grid-template-columns: 1fr;
    text-align: center;
  }

  .hero-actions {
    justify-content: center;
  }

  .hero-stats {
    justify-content: center;
  }
}

@media (max-width: 768px) {
  .home {
    padding: 2.5rem 1.25rem 3rem;
  }

  .hero {
    padding: 2rem;
  }

  .live {
    padding: 1.75rem;
  }
}
</style>
