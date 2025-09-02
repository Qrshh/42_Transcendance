<template>
  <div class="three-wrap">
    <canvas ref="canvasRef" class="three-canvas"></canvas>

    <!-- Petits overlays optionnels -->
    <div v-if="loading" class="overlay">Chargement…</div>
    <div v-if="error" class="overlay error">Erreur: {{ error }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import * as THREE from 'three'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'

/**
 * Props : tu peux garder tes bindings kebab-case côté parent :
 * <Computer3D :model-path="'/models/commodore.stl'" :rotation-x="-1.1" :rotation-y="-1.545" :rotation-z="-1.175" :position-y="0" :scale="3.5" />
 */
const props = defineProps<{
  modelPath: string
  rotationX?: number
  rotationY?: number
  rotationZ?: number
  positionX?: number
  positionY?: number
  positionZ?: number
  scale?: number
  colorHex?: string | number // couleur optionnelle du matériau
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

// Three.js globals
let renderer: THREE.WebGLRenderer | null = null
let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
let modelMesh: THREE.Mesh | null = null

function initRenderer() {
  if (!canvasRef.value) return
  renderer = new THREE.WebGLRenderer({
    canvas: canvasRef.value,
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true
  })

  // Taille initiale depuis le conteneur (avec fallback)
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const w = canvasRef.value.clientWidth || 700
  const h = canvasRef.value.clientHeight || 420
  renderer.setPixelRatio(dpr)
  renderer.setSize(w, h, false)
}

function initScene() {
  scene = new THREE.Scene()
  scene.background = null

  // Caméra : placée "en face" de l’écran
  const w = renderer!.domElement.width / (window.devicePixelRatio || 1)
  const h = renderer!.domElement.height / (window.devicePixelRatio || 1)
  camera = new THREE.PerspectiveCamera(45, w / h, 0.01, 1000)
  camera.position.set(
    props.positionX ?? 0,
    props.positionY ?? 1.2,
    props.positionZ ?? 3
  )

  // Lumières sobres
  const amb = new THREE.AmbientLight(0xffffff, 0.9)
  scene.add(amb)
  const dir = new THREE.DirectionalLight(0xffffff, 0.8)
  dir.position.set(2, 4, 3)
  scene.add(dir)
}

function loadSTL() {
  return new Promise<void>((resolve, reject) => {
    const loader = new STLLoader()
    loader.load(
      props.modelPath,
      (geometry) => {
        geometry.computeVertexNormals()
        geometry.center() // centre le modèle à l’origine

        const material = new THREE.MeshStandardMaterial({
          color: new THREE.Color(props.colorHex ?? 0xbfc5d0),
          metalness: 0.15,
          roughness: 0.6
        })

        modelMesh = new THREE.Mesh(geometry, material)
        // Orientation “face caméra” (tes valeurs sont en radians, on les reprend)
        modelMesh.rotation.set(
          props.rotationX ?? 0,
          props.rotationY ?? 0,
          props.rotationZ ?? 0
        )
        modelMesh.position.set(
          props.positionX ?? 0,
          props.positionY ?? 0,
          props.positionZ ?? 0
        )

        const scl = props.scale ?? 1
        modelMesh.scale.setScalar(scl)

        scene!.add(modelMesh)

        // Ajuste la caméra pour cadrer le modèle
        fitCameraToObject(camera!, modelMesh, renderer!, 1.35)

        // Rendu unique
        renderOnce()

        resolve()
      },
      undefined,
      (err) => reject(err)
    )
  })
}

/** Cadre la caméra pour que l'objet tienne bien dans la vue */
function fitCameraToObject(
  camera: THREE.PerspectiveCamera,
  object: THREE.Object3D,
  renderer: THREE.WebGLRenderer,
  zoomOutFactor = 1.25
) {
  const box = new THREE.Box3().setFromObject(object)
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())

  const maxDim = Math.max(size.x, size.y, size.z)
  const fov = THREE.MathUtils.degToRad(camera.fov)
  let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2))

  cameraZ *= zoomOutFactor

  // place la caméra devant l’objet, légèrement au-dessus si tu veux
  camera.position.set(center.x, center.y + 0.05 * maxDim, center.z + cameraZ)
  camera.near = Math.max(0.01, cameraZ / 100)
  camera.far = cameraZ * 100
  camera.updateProjectionMatrix()
  camera.lookAt(center)

  // recentre également les lumières directionnelles si besoin
  renderOnce()
}

function onResize() {
  if (!renderer || !camera || !canvasRef.value) return
  const w = canvasRef.value.clientWidth || 700
  const h = canvasRef.value.clientHeight || 420
  renderer.setSize(w, h, false)
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  renderOnce()
}

function renderOnce() {
  if (renderer && scene && camera) {
    renderer.render(scene, camera)
  }
}

onMounted(async () => {
  try {
    initRenderer()
    initScene()
    await loadSTL()
    loading.value = false
  } catch (e: any) {
    console.error('[Computer3D] load error', e)
    error.value = 'Impossible de charger le modèle (vérifie /public' + props.modelPath + ')'
    loading.value = false
  }

  window.addEventListener('resize', onResize)
})

// si on change de modèle dynamiquement (optionnel)
watch(() => props.modelPath, async (p, old) => {
  if (!p || p === old) return
  loading.value = true
  error.value = null
  if (modelMesh && scene) { scene.remove(modelMesh); modelMesh.geometry.dispose() }
  await loadSTL().catch(e => { error.value = 'Erreur de chargement'; console.error(e) })
  loading.value = false
})

onUnmounted(() => {
  window.removeEventListener('resize', onResize)
  if (renderer) {
    renderer.dispose()
    // @ts-ignore
    renderer.forceContextLoss?.()
  }
  if (modelMesh) {
    modelMesh.geometry.dispose()
    ;(modelMesh.material as THREE.Material)?.dispose?.()
  }
  renderer = null
  scene = null
  camera = null
  modelMesh = null
})
</script>

<style scoped>
.three-wrap{
  width: 100%;
  max-width: 900px;
  height: 420px;             /* 👈 hauteur fixe pour garantir une surface de rendu */
  margin: 0 auto;
  position: relative;
}
.three-canvas{
  width: 100%;
  height: 100%;
  display: block;
}

/* Overlays */
.overlay{
  position:absolute; inset:0;
  display:flex; align-items:center; justify-content:center;
  color: var(--color-text);
  background: transparent;
  pointer-events: none;
  font-weight: 600;
}
.overlay.error{ color:#e53935; }
</style>
