<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import * as THREE from 'three'

const canvasRef = ref<HTMLCanvasElement>()
const props = defineProps<{
  modelPath?: string
  rotationX?: number // Rotation autour de l'axe X (pencher avant/arrière)
  rotationY?: number // Rotation autour de l'axe Y (tourner gauche/droite)
  rotationZ?: number // Rotation autour de l'axe Z (incliner côtés)
  positionX?: number // Position X
  positionY?: number // Position Y
  positionZ?: number // Position Z
  scale?: number     // Échelle du modèle
}>()

let scene: THREE.Scene
let camera: THREE.PerspectiveCamera
let renderer: THREE.WebGLRenderer
let computer: THREE.Group
let animationId: number

// Classe STLLoader intégrée directement
class STLLoader {
  load(url: string, onLoad: (geometry: THREE.BufferGeometry) => void, onProgress?: (event: any) => void, onError?: (event: any) => void) {
    const loader = new THREE.FileLoader()
    loader.setResponseType('arraybuffer')
    loader.load(url, (data) => {
      try {
        const geometry = this.parse(data as ArrayBuffer)
        onLoad(geometry)
      } catch (error) {
        if (onError) onError(error)
      }
    }, onProgress, onError)
  }

  parse(data: ArrayBuffer): THREE.BufferGeometry {
    const view = new DataView(data)
    const isLittleEndian = true

    // Lire l'en-tête STL
    let offset = 80
    const triangleCount = view.getUint32(offset, isLittleEndian)
    offset += 4

    const geometry = new THREE.BufferGeometry()
    const vertices: number[] = []
    const normals: number[] = []

    for (let i = 0; i < triangleCount; i++) {
      // Normal du triangle
      const normalX = view.getFloat32(offset, isLittleEndian)
      const normalY = view.getFloat32(offset + 4, isLittleEndian)
      const normalZ = view.getFloat32(offset + 8, isLittleEndian)
      offset += 12

      // 3 vertices du triangle
      for (let j = 0; j < 3; j++) {
        vertices.push(
          view.getFloat32(offset, isLittleEndian),
          view.getFloat32(offset + 4, isLittleEndian),
          view.getFloat32(offset + 8, isLittleEndian)
        )
        normals.push(normalX, normalY, normalZ)
        offset += 12
      }
      offset += 2
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))

    return geometry
  }
}

const initThreeJS = () => {
  if (!canvasRef.value) return

  // Scène
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x0a0a0a)

  // Caméra
  camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)
  camera.position.set(5, 3, 5)
  camera.lookAt(0, 0, 0)

  // Renderer
  renderer = new THREE.WebGLRenderer({ 
    canvas: canvasRef.value, 
    antialias: true,
    alpha: true 
  })
  renderer.setSize(400, 400)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap

  // Éclairage optimisé pour modèle STL
  const ambientLight = new THREE.AmbientLight(0x191970, 0.6)
  scene.add(ambientLight)

  const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0)
  directionalLight.position.set(10, 10, 5)
  directionalLight.castShadow = true
  directionalLight.shadow.mapSize.width = 2048
  directionalLight.shadow.mapSize.height = 2048
  scene.add(directionalLight)

  // Lumière d'accentuation
  const rimLight = new THREE.DirectionalLight(0x191970, 0.3)
  rimLight.position.set(-5, 5, -5)
  scene.add(rimLight)

  // Point light pour effet tech
  const pointLight = new THREE.PointLight(0x191970, 0.5, 100)
  pointLight.position.set(-3, 3, 3)
  scene.add(pointLight)

  // Charger le modèle STL
  loadComputerModel()

  // Animation
  animate()
}

const loadComputerModel = async () => {
  try {
    computer = new THREE.Group()
    const modelPath = props.modelPath || '/models/commodore.stl'
    
    console.log('Chargement du modèle STL:', modelPath)
    
    const loader = new STLLoader()
    
    loader.load(
      modelPath,
      (geometry) => {
        console.log('✅ Modèle STL chargé avec succès')
        
        // Centrer et redimensionner le modèle
        geometry.center()
        geometry.computeBoundingBox()
        const box = geometry.boundingBox!
        const size = box.getSize(new THREE.Vector3())
        const maxDim = Math.max(size.x, size.y, size.z)
        const scaleValue = props.scale || 2
        const scale = scaleValue / maxDim // Ajuster la taille
        geometry.scale(scale, scale, scale)
        
        // Calculer les normales pour un bon éclairage
        geometry.computeVertexNormals()
        
        // Matériau pour le PC
        const material = new THREE.MeshPhongMaterial({
          color: 0x2A497F,
          shininess: 70,
          specular: 0x444444
        })
        
        // Créer le mesh
        const computerMesh = new THREE.Mesh(geometry, material)
        computerMesh.castShadow = true
        computerMesh.receiveShadow = true
        
        computer.add(computerMesh)
        
        // Position et rotation personnalisables
        computer.position.set(
          props.positionX || 0,
          props.positionY || 0,
          props.positionZ || 0
        )
        
        computer.rotation.set(
          props.rotationX || 0,           // Rotation X (pencher)
          props.rotationY || Math.PI / 3, // Rotation Y (60° par défaut)
          props.rotationZ || 0            // Rotation Z (incliner)
        )
        //addVisualEffects()
        scene.add(computer)
      },
      (progress) => {
        console.log('Progression:', progress)
      },
      (error) => {
        console.error('❌ Erreur lors du chargement du modèle STL:', error)
      }
    )
    
  } catch (error)
  {
    console.error('❌ Erreur générale:', error)
  }
}

const animate = () => {
  animationId = requestAnimationFrame(animate)
  
  if (!computer)
    return
  const time = Date.now() * 0.001

  // Rotation douce du PC
  computer.rotation.y += 0.005

  // Animation des particules
  scene.children.forEach((child, index) => {
    if (child.userData && child.userData.velocity)
    {
      child.position.add(child.userData.velocity)
      // Mouvement oscillant vertical
      child.position.y = child.userData.originalY + Math.sin(time * 2 + index) * 0.3
      // Reset horizontal si trop loin
      if (Math.abs(child.position.x) > 4 || Math.abs(child.position.z) > 4)
      {
        child.position.x = (Math.random() - 0.5) * 2
        child.position.z = (Math.random() - 0.5) * 2
      }
    }
  })

  renderer.render(scene, camera)
}

const handleResize = () => {
  if (!canvasRef.value)
    return
  const size = Math.min(window.innerWidth * 0.4, 400)
  renderer.setSize(size, size)
  camera.aspect = 1
  camera.updateProjectionMatrix()
}

onMounted(() => {
  initThreeJS()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  if (animationId)
    cancelAnimationFrame(animationId)
  window.removeEventListener('resize', handleResize)
  if (renderer)
    renderer.dispose()
  if (scene)
    scene.clear()
})
</script>

<template>
  <div class="computer-3d-container">
    <canvas ref="canvasRef" class="computer-canvas"></canvas>
  </div>
</template>

<style scoped>
.computer-3d-container {
  position: relative;
  width: 400px;
  height: 400px;
  perspective: 1000px;
}

.computer-canvas {
  width: 100% !important;
  height: 100% !important;
  border-radius: 10px;
  box-shadow: 0 10px 30px rgb(0, 0, 0);
}

@media (max-width: 768px) {
  .computer-3d-container {
    width: 300px;
    height: 300px;
  }
}
</style>