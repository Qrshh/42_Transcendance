<template>
  <div :class="asBackground ? 'three-bg' : 'three-wrap'">
    <canvas ref="canvasRef" class="three-canvas"></canvas>
    <div v-if="!asBackground && loading" class="overlay">Chargement…</div>
    <div v-if="!asBackground && error" class="overlay error">Erreur: {{ error }}</div>
  </div>
  
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import * as THREE from 'three'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'

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
  asBackground?: boolean      // occupe tout l’écran, derrière l’UI
  cover?: boolean             // cadre en "cover" (remplit l’écran, possible recadrage)
  autoRotate?: boolean        // compat: déclenche l'animation (secouement)
  rotateSpeed?: number        // compat: remplacé par shakeSpeed (cycles/sec)
  shake?: boolean             // secouement doux (activé si asBackground)
  shakeSpeed?: number         // cycles/seconde (Hz) — def 0.2 (plus lent)
  shakeAmpX?: number          // amplitude de translation X (unités monde)
  shakeAmpY?: number          // amplitude de translation Y (unités monde)
  shakeAmpRotZ?: number       // amplitude de rotation Z (radians)
  maxRenderHeight?: number    // limite la hauteur de rendu interne (def: 1080)
  coverBoost?: number         // rapproche la caméra en mode cover (def: 0.9 ~ +11%)
  frameOffsetX?: number       // décale la composition vers la droite (fraction largeur)
  frameOffsetY?: number       // décale la composition vers le haut (fraction hauteur)
  maxFPS?: number             // limite FPS de l'animation (def: 30)
  adaptivePixelRatio?: boolean // ajuste le pixelRatio si trop lent (def: true)
  minPixelRatio?: number      // plancher pixelRatio (def: 0.66)
  screenCoverage?: number     // 0..1, proportion de l'écran que l'objet doit occuper
  minDistanceFactor?: number  // facteur de distance mini vs rayon (def: cover?0.9:1.6)
  backgroundColor?: string | number // couleur de fond de la scène (def: #0f0f23)
  fisheye?: boolean           // applique une distorsion fish‑eye en NDC
  fisheyeStrength?: number    // intensité (k1) du fish‑eye (def: 0.18)
  fisheyeCenterX?: number     // centre X NDC (def: 0)
  fisheyeCenterY?: number     // centre Y NDC (def: 0)
  lightOrbitRadiusFactor?: number // facteur du rayon d'orbite des lumières (def: 2.4)
  lightIntensity?: number     // intensité des points lumineux (def: 0.45)
  tintOverlay?: boolean       // ajoute une couche bleue en opacité au-dessus du canvas
  tintColor?: string          // couleur de la couche (def: #0b3d91)
  tintOpacity?: number        // opacité 0..1 (def: 0.18)
  tintBlend?: string          // mix-blend-mode (def: 'normal')
  recolorAll?: boolean        // applique le bleu foncé à tous les matériaux
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

let renderer: THREE.WebGLRenderer | null = null
let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
let modelMesh: THREE.Object3D | null = null
let pmrem: THREE.PMREMGenerator | null = null
let envRT: THREE.WebGLRenderTarget | null = null
let animId: number | null = null
let lastTs = 0
let tAccum = 0
let basePos: THREE.Vector3 | null = null
let baseRot: THREE.Euler | null = null
let ampX = 0
let ampY = 0
let ampRotZ = 0
let omega = 2 * Math.PI * 0.35
let lastRenderMs = 0
let frameBudgetMs = 1000 / 30
let basePR = 1
let currPR = 1
let minPR = 0.66
let displayW = 700
let displayH = 420
let visHandler: ((this: Document, ev: Event) => any) | null = null
let fisheyeTargets: Array<{ mat: any, uniforms: any }> = []
let composer: EffectComposer | null = null
let renderPass: RenderPass | null = null
let fishPass: ShaderPass | null = null
let orbitLightA: THREE.PointLight | null = null
let orbitLightB: THREE.PointLight | null = null
let orbitCenter: THREE.Vector3 | null = null
let orbitRadius = 1

function initRenderer() {
  if (!canvasRef.value) return
  const dprRaw = Math.min(window.devicePixelRatio || 1, 2)
  const aa = !(props.asBackground) && dprRaw <= 1.5
  renderer = new THREE.WebGLRenderer({
    canvas: canvasRef.value,
    antialias: aa,
    alpha: true,
    preserveDrawingBuffer: false,
    stencil: false,
    powerPreference: 'high-performance'
  })

  // Colorimétrie et tonemapping modernes pour PBR
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.0
  renderer.shadowMap.enabled = false

  // Taille initiale depuis le conteneur (avec fallback)
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  displayW = props.asBackground ? window.innerWidth : (canvasRef.value.clientWidth || 700)
  displayH = props.asBackground ? window.innerHeight : (canvasRef.value.clientHeight || 420)
  const capH = props.maxRenderHeight ?? 1080
  const effectivePR = props.asBackground ? Math.min(dpr, capH / Math.max(1, displayH)) : dpr
  basePR = effectivePR
  currPR = effectivePR
  minPR = Math.min(props.minPixelRatio ?? 0.66, basePR)
  renderer.setPixelRatio(currPR)
  renderer.setSize(displayW, displayH, false)
}

function initScene() {
  scene = new THREE.Scene()
  try {
    const bg = props.backgroundColor ?? '#0f0f23'
    scene.background = new THREE.Color(bg as any)
  } catch {
    scene.background = new THREE.Color('#0f0f23')
  }

  // IBL légère pour les matériaux PBR (GLB)
  pmrem = new THREE.PMREMGenerator(renderer!)
  envRT = pmrem.fromScene(new RoomEnvironment(), 0.04)
  scene.environment = envRT.texture

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
  // Optionnel: second key light doux pour des reflets plus accrocheurs
  const dir2 = new THREE.DirectionalLight(0xffffff, 0.4)
  dir2.position.set(-3, 2, -2)
  scene.add(dir2)
}

function setupOrbitLights(obj: THREE.Object3D){
  if (!scene) return
  const sphere = new THREE.Box3().setFromObject(obj).getBoundingSphere(new THREE.Sphere())
  orbitCenter = sphere.center.clone()
  const orbitFactor = (typeof props.lightOrbitRadiusFactor === 'number') ? props.lightOrbitRadiusFactor! : 2.4
  orbitRadius = Math.max(1e-3, sphere.radius * orbitFactor)

  // Nettoyage précédent
  if (orbitLightA) { scene.remove(orbitLightA); orbitLightA = null }
  if (orbitLightB) { scene.remove(orbitLightB); orbitLightB = null }

  // Deux points lumineux opposés, intensité ajustable
  const intensity = (typeof props.lightIntensity === 'number') ? props.lightIntensity! : 1.4
  orbitLightA = new THREE.PointLight(0x9448bc, intensity, 0, 2)
  orbitLightB = new THREE.PointLight(0xfb3640, intensity, 0, 2)
  orbitLightA.castShadow = false
  orbitLightB.castShadow = false

  const y0 = orbitCenter.y + 0.8 * orbitRadius
  orbitLightA.position.set(orbitCenter.x + orbitRadius, y0, orbitCenter.z)
  orbitLightB.position.set(orbitCenter.x - orbitRadius, y0, orbitCenter.z)
  scene.add(orbitLightA)
  scene.add(orbitLightB)
}

const FisheyeShader: any = {
  uniforms: {
    tDiffuse: { value: null },
    strength: { value: 0.18 },
    aspect: { value: 1.0 },
    center: { value: new THREE.Vector2(0.0, 0.0) },
  },
  vertexShader: `
    varying vec2 vUv;
    void main(){
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float strength;
    uniform float aspect;
    uniform vec2 center;
    varying vec2 vUv;
    void main(){
      // map 0..1 uv to -1..1
      vec2 uv = vUv * 2.0 - 1.0;
      uv.x *= aspect;
      vec2 p = uv - center;
      float r2 = dot(p,p);
      float k = strength;
      float factor = 1.0 + k * r2 + 0.5 * k * k * r2 * r2;
      p *= factor;
      uv = center + p;
      uv.x /= aspect;
      vec2 sampleUv = (uv + 1.0) * 0.5;
      sampleUv = clamp(sampleUv, 0.0, 1.0);
      gl_FragColor = texture2D(tDiffuse, sampleUv);
    }
  `
}

function initComposer(){
  if (!renderer || !scene || !camera) return
  composer = new EffectComposer(renderer)
  renderPass = new RenderPass(scene, camera)
  composer.addPass(renderPass)
  fishPass = new ShaderPass(FisheyeShader)
  updateFisheyeUniforms()
  composer.addPass(fishPass)
}

function updateFisheyeUniforms(){
  if (!fishPass) return
  fishPass.uniforms.strength.value = (typeof props.fisheyeStrength === 'number') ? props.fisheyeStrength! : 0.18
  fishPass.uniforms.aspect.value = displayW / Math.max(1, displayH)
  const cx = props.fisheyeCenterX ?? 0.0
  const cy = props.fisheyeCenterY ?? 0.0
  fishPass.uniforms.center.value.set(cx, cy)
}

function loadGLTF() {
  return new Promise<void>((resolve, reject) => {
    const loader = new GLTFLoader()
    loader.load(
      props.modelPath,
      (gltf) => {
        const root = gltf.scene

        // Option: conserve les matériaux/UVs/Textures du GLTF
        modelMesh = root

        // Applique orientation/position/échelle depuis les props
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

        // Cadre la caméra (cover si demandé)
        const coverMode = props.cover ?? props.asBackground ?? false
        fitCameraToObject(camera!, modelMesh, renderer!, coverMode ? 1.0 : 1.25, coverMode)
        renderOnce()

        // Prépare l'animation de secouement et lance si demandé
        setupShakeParams(modelMesh)
        // Deux lumières en orbite opposée
        setupOrbitLights(modelMesh)
        // Fisheye écran (post-process) si demandé
        if (props.fisheye ?? true) { initComposer(); updateFisheyeUniforms() }
        if ((props.asBackground || props.autoRotate || props.shake) && !animId) startAnimation()
        resolve()
      },
      undefined,
      (err) => reject(err)
    )
  })
}

async function loadModel() {
  const ext = (props.modelPath || '').split('.').pop()?.toLowerCase()
  return loadGLTF()
}

/** Cadre la caméra pour que l'objet tienne bien dans la vue */
function fitCameraToObject(
  camera: THREE.PerspectiveCamera,
  object: THREE.Object3D,
  renderer: THREE.WebGLRenderer,
  zoomOutFactor = 1.25,
  cover = false
) {
  const box = new THREE.Box3().setFromObject(object)
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())
  const maxDim = Math.max(size.x, size.y, size.z)
  const sphere = box.getBoundingSphere(new THREE.Sphere())
  const radius = sphere.radius || (maxDim * 0.5)

  // Décalage de cadrage (fraction de la taille du modèle)
  const fx = props.frameOffsetX ?? 0
  const fy = props.frameOffsetY ?? 0
  if (fx || fy) {
    const sx = size.x || maxDim
    const sy = size.y || maxDim
    // décaler la cible à gauche (fx>0) pour pousser le modèle à droite à l'écran
    center.x -= fx * sx
    // décaler la cible en bas (fy>0) pour pousser le modèle vers le haut à l'écran
    center.y -= fy * sy
  }

  const fov = THREE.MathUtils.degToRad(camera.fov)
  const halfV = fov / 2
  const halfH = Math.atan(Math.tan(halfV) * camera.aspect)

  // Distances nécessaires pour contenir largeur/hauteur
  const distForHeight = (size.y / 2) / Math.tan(halfV)
  const distForWidth  = (size.x / 2) / Math.tan(halfH)

  // contain = max(width, height), cover = min(width, height)
  let baseDist = cover ? Math.min(distForWidth, distForHeight) : Math.max(distForWidth, distForHeight)

  // marge ou rapprochement (coverBoost rapproche pour "agrandir")
  const coverBoost = props.coverBoost ?? 1.0
  let cameraZ = Math.abs(baseDist) * (cover ? coverBoost : zoomOutFactor)

  // Ne jamais trop s'approcher (évite d'entrer dans la géométrie)
  const minSafe = radius * (props.minDistanceFactor ?? (cover ? 0.9 : 1.6))
  if (cameraZ < minSafe) cameraZ = minSafe

  // applique une couverture d'écran souhaitée (plus la valeur est petite, plus l'objet est petit)
  if (typeof props.screenCoverage === 'number' && props.screenCoverage > 0) {
    const cov = Math.max(0.1, Math.min(3.0, props.screenCoverage))
    // Si cov < 1 => on recule (objet plus petit), si >1 => on rapproche
    cameraZ *= 1 / cov
  } else if (cover) {
    // défaut: léger recul pour éviter le "trop grand"
    cameraZ *= 1.1
  }

  // place la caméra devant l’objet; en mode cover, évite l’offset Y pour ne pas rogner
  const yOffset = cover ? 0 : 0.05 * maxDim
  camera.position.set(center.x, center.y + yOffset, center.z + cameraZ)
  camera.near = Math.max(0.01, cameraZ - radius * 1.3)
  camera.far = Math.max(camera.near + 10, cameraZ + radius * 5)
  camera.updateProjectionMatrix()
  camera.lookAt(center)

  // recentre également les lumières directionnelles si besoin
  renderOnce()
}

function onResize() {
  if (!renderer || !camera || !canvasRef.value) return
  displayW = props.asBackground ? window.innerWidth : (canvasRef.value.clientWidth || 700)
  displayH = props.asBackground ? window.innerHeight : (canvasRef.value.clientHeight || 420)
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const capH = props.maxRenderHeight ?? 1080
  basePR = props.asBackground ? Math.min(dpr, capH / Math.max(1, displayH)) : dpr
  currPR = Math.min(currPR, basePR)
  renderer.setPixelRatio(currPR)
  renderer.setSize(displayW, displayH, false)
  camera.aspect = displayW / displayH
  camera.updateProjectionMatrix()
  if (modelMesh) {
    const coverMode = props.cover ?? props.asBackground ?? false
    fitCameraToObject(camera, modelMesh, renderer, coverMode ? 1.0 : 1.25, coverMode)
  } else {
    renderOnce()
  }
  updateFisheyeAspect()
  if (composer) composer.setSize(displayW, displayH)
  updateFisheyeUniforms()
}

function renderOnce() {
  if (renderer && scene && camera) {
    if (composer && (props.fisheye ?? true)) composer.render()
     renderer.render(scene, camera)
  }
}


function updateFisheyeAspect() {
  const aspect = displayW / Math.max(1, displayH)
  fisheyeTargets.forEach(t => {
    if (t.uniforms && t.uniforms.uAspect) t.uniforms.uAspect.value = aspect
    if (t.uniforms && t.uniforms.uFisheyeStrength && typeof props.fisheyeStrength === 'number') {
      t.uniforms.uFisheyeStrength.value = props.fisheyeStrength
    }
  })
}

onMounted(async () => {
  try {
    initRenderer()
    initScene()
    await loadModel()
    loading.value = false
  } catch (e: any) {
    console.error('[Computer3D] load error', e)
    error.value = 'Impossible de charger le modèle (vérifie /public' + props.modelPath + ')'
    loading.value = false
  }

  window.addEventListener('resize', onResize)
  visHandler = () => {
    if (document.hidden) stopAnimation()
    else if ((props.asBackground || props.autoRotate || props.shake) && !animId) startAnimation()
  }
  document.addEventListener('visibilitychange', visHandler)
})

// si on change de modèle dynamiquement (optionnel)
watch(() => props.modelPath, async (p, old) => {
  if (!p || p === old) return
  loading.value = true
  error.value = null
  if (modelMesh && scene) { scene.remove(modelMesh); disposeObject3D(modelMesh) }
  fisheyeTargets = []
  await loadModel().catch(e => { error.value = 'Erreur de chargement'; console.error(e) })
  loading.value = false
})

onUnmounted(() => {
  window.removeEventListener('resize', onResize)
  if (visHandler) document.removeEventListener('visibilitychange', visHandler)
  stopAnimation()
  if (renderer) {
    renderer.dispose()
    // @ts-ignore
    renderer.forceContextLoss?.()
  }
  if (envRT) { envRT.dispose(); envRT = null }
  if (pmrem) { pmrem.dispose(); pmrem = null }
  if (modelMesh) disposeObject3D(modelMesh)
  if (orbitLightA && scene) scene.remove(orbitLightA)
  if (orbitLightB && scene) scene.remove(orbitLightB)
  orbitLightA = null
  orbitLightB = null
  renderer = null
  scene = null
  camera = null
  modelMesh = null
})

function disposeObject3D(obj: THREE.Object3D) {
  obj.traverse((child: any) => {
    if (child.isMesh) {
      child.geometry?.dispose?.()
      if (Array.isArray(child.material)) child.material.forEach((m: any) => m?.dispose?.())
      else child.material?.dispose?.()
    }
  })
}



function setupShakeParams(obj: THREE.Object3D) {
  basePos = obj.position.clone()
  baseRot = obj.rotation.clone()
  const box = new THREE.Box3().setFromObject(obj)
  const size = box.getSize(new THREE.Vector3())
  const width = size.x || Math.max(size.y, size.z) || 1
  const height = size.y || Math.max(size.x, size.z) || 1
  // Amplitudes par défaut
  ampX = typeof props.shakeAmpX === 'number' ? props.shakeAmpX! : width * 0.015
  ampY = typeof props.shakeAmpY === 'number' ? props.shakeAmpY! : height * 0.012
  ampRotZ = typeof props.shakeAmpRotZ === 'number' ? props.shakeAmpRotZ! : THREE.MathUtils.degToRad(3)
  const freq = typeof props.shakeSpeed === 'number' ? Math.max(0.05, props.shakeSpeed!) : 0.2
  omega = 2 * Math.PI * freq
  tAccum = 0
}

function startAnimation() {
  stopAnimation()
  lastTs = performance.now()
  lastRenderMs = lastTs
  frameBudgetMs = 1000 / Math.max(10, Math.min(60, (props.maxFPS ?? 30)))
  const loop = (ts: number) => {
    animId = requestAnimationFrame(loop)
    const sinceLast = ts - lastRenderMs
    if (sinceLast < frameBudgetMs) return

    // Animation step
    const dt = Math.min(0.05, (ts - lastTs) / 1000)
    lastTs = ts
    tAccum += dt
    if (modelMesh && basePos && baseRot) {
      const s = Math.sin(omega * tAccum)
      const c = Math.cos(omega * tAccum)
      modelMesh.position.x = basePos.x + ampX * s
      modelMesh.position.y = basePos.y + ampY * 0.8 * c
      modelMesh.rotation.z = baseRot.z + ampRotZ * s
    }

    // Orbiting lights update
    if (orbitCenter && orbitLightA && orbitLightB) {
      const w = Math.max(0.01, (props.shakeSpeed ?? 0.2)) * 0.8 // relation douce avec shakeSpeed
      const th = tAccum * w
      const r = orbitRadius
      const y0 = orbitCenter.y + 0.2 * r
      orbitLightA.position.set(
        orbitCenter.x + r * Math.cos(th),
        y0,
        orbitCenter.z + r * Math.sin(th)
      )
      orbitLightB.position.set(
        orbitCenter.x + r * Math.cos(th + Math.PI),
        y0,
        orbitCenter.z + r * Math.sin(th + Math.PI)
      )
    }

    // Adaptive pixel ratio
    if (props.adaptivePixelRatio ?? true) {
      const over = sinceLast > frameBudgetMs * 1.3
      const under = sinceLast < frameBudgetMs * 0.8
      let nextPR = currPR
      if (over) nextPR = Math.max(minPR, currPR * 0.92)
      else if (under && currPR < basePR) nextPR = Math.min(basePR, currPR * 1.03)
      if (Math.abs(nextPR - currPR) > 0.02) {
        currPR = nextPR
        renderer!.setPixelRatio(currPR)
        renderer!.setSize(displayW, displayH, false)
        camera!.updateProjectionMatrix()
      }
    }

    lastRenderMs = ts
    renderOnce()
  }
  animId = requestAnimationFrame(loop)
}

function stopAnimation() {
  if (animId) cancelAnimationFrame(animId)
  animId = null
}
</script>

<style scoped>
.three-wrap{ /* mode “composant” local */
  width: 100%;
  max-width: 900px;
  height: 420px;             /* 👈 surface de rendu locale */
  margin: 0 auto;
  position: relative;
}
.three-bg{  /* mode “background plein écran” (derrière l’UI) */
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  z-index: -1;               /* toujours derrière tous les contenus de l’app */
  pointer-events: none;       /* ne capture aucun clic */
}
.three-canvas{
  width: 100%;
  height: 100%;
  display: block;
  pointer-events: none;       /* s’assure de ne rien bloquer */
}

.tint-overlay{
  position: absolute;
  inset: 0;
  pointer-events: none;
  
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
