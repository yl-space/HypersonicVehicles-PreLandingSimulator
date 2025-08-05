import { useState, useEffect, useRef } from 'react'
import * as Three from 'three'
import starField from '../assets/textures/starfield.png'
// Import Mars textures
import marsColorTexture from '../assets/textures/Mars/Mars.jpg'
import marsNormalTexture from '../assets/textures/Mars/mars_normal.jpg'
// Import Earth textures
import earthColorTexture from '../assets/textures/Earth/earthmap_color.jpg'
import earthBumpTexture from '../assets/textures/Earth/earthmap_bump.jpg'
import earthSpecularTexture from '../assets/textures/Earth/earthmap_specular.jpg'
import earthCloudTexture from '../assets/textures/Earth/earthmap_cloud.jpg'
import earthCloudTransparency from '../assets/textures/Earth/earthcloudmap_transperancy.jpg'
import earthNightLights from '../assets/textures/Earth/earthamp_lights.jpg'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { TrajectoryManager } from './simulation/TrajectoryManager.js'
import { EntryVehicle } from './components/spacecraft/EntryVehicle.js'
import './App.css'

function App() {
  const [currentPlanet, setCurrentPlanet] = useState('mars')
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  
  const sceneRef = useRef(null)
  const cameraRef = useRef(null)
  const controlsRef = useRef(null)
  const planetsRef = useRef({})
  const scenesRef = useRef({})
  const rendererRef = useRef(null)
  const starfieldRef = useRef(null)
  const trajectoryManagerRef = useRef(null)
  const entryVehicleRef = useRef(null)
  const animationIdRef = useRef(null)
  const clockRef = useRef(new Three.Clock())
  const raycasterRef = useRef(new Three.Raycaster())
  const mouseRef = useRef(new Three.Vector2())

  const TOTAL_TIME = 260.65 // seconds
  const PLAYBACK_SPEED = 1.0

  useEffect(() => {
    // Main camera setup
    const camera = new Three.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000)
    camera.position.z = 10
    cameraRef.current = camera

    // renderer setup
    const renderer = new Three.WebGLRenderer({ canvas: document.getElementById('display-canvas'), antialias: true })
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = Three.PCFSoftShadowMap
    rendererRef.current = renderer

    // Orbit controls setup
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controlsRef.current = controls

    // Create starfield (shared between scenes)
    createStarfield()

    // Create separate scenes for each planet
    createPlanetScenes()

    // Initialize trajectory and vehicle
    initializeTrajectory()

    // Set initial scene
    sceneRef.current = scenesRef.current.mars

    // Setup event listeners
    setupEventListeners()

    // Animation loop
    function animate() {
      animationIdRef.current = requestAnimationFrame(animate)
      
      const deltaTime = clockRef.current.getDelta()
      
      // Update simulation
      if (isPlaying && trajectoryManagerRef.current && entryVehicleRef.current) {
        updateSimulation(deltaTime)
      }
      
      // Rotate current planet
      if (planetsRef.current[currentPlanet]) {
        planetsRef.current[currentPlanet].rotation.y += 0.002
      }
      
      // Rotate Earth clouds at different speed
      if (currentPlanet === 'earth' && planetsRef.current.earthClouds) {
        planetsRef.current.earthClouds.rotation.y += 0.0015
        planetsRef.current.earthClouds.rotation.x += 0.0002
      }

      controls.update()
      renderer.render(sceneRef.current, camera)
    }
    animate()

    // Handle window resize
    function handleResize() {
      renderer.setSize(window.innerWidth, window.innerHeight)
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
    }
    window.addEventListener('resize', handleResize)

    // Add event listeners for planet buttons
    const addButtonListeners = () => {
      const marsBtn = document.getElementById('mars-btn')
      const earthBtn = document.getElementById('earth-btn')
      const jupiterBtn = document.getElementById('jupiter-btn')
      
      if (marsBtn) marsBtn.addEventListener('click', () => switchPlanet('mars'))
      if (earthBtn) earthBtn.addEventListener('click', () => switchPlanet('earth'))
      if (jupiterBtn) jupiterBtn.addEventListener('click', () => switchPlanet('jupiter'))
    }
    
    setTimeout(addButtonListeners, 100)

    return () => {
      window.removeEventListener('resize', handleResize)
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current)
      }
    }
  }, [])

  const createStarfield = () => {
    const starFieldGeometry = new Three.SphereGeometry(30, 64, 64)
    const starFieldTexture = new Three.TextureLoader().load(starField)
    starFieldTexture.colorSpace = Three.SRGBColorSpace
    starFieldTexture.wrapS = Three.RepeatWrapping
    starFieldTexture.wrapT = Three.RepeatWrapping
    starFieldTexture.magFilter = Three.LinearFilter
    starFieldTexture.minFilter = Three.LinearMipmapLinearFilter
    starFieldTexture.anisotropy = 16
    starFieldTexture.repeat.set(8, 4)

    const starMaterial = new Three.MeshBasicMaterial({ 
      map: starFieldTexture,
      side: Three.DoubleSide
    })

    starfieldRef.current = new Three.Mesh(starFieldGeometry, starMaterial)
  }

  const createPlanetScenes = () => {
    const textureLoader = new Three.TextureLoader()

    // Mars Scene
    const marsScene = new Three.Scene()
    marsScene.add(starfieldRef.current.clone())

    const marsColorTex = textureLoader.load(marsColorTexture)
    marsColorTex.colorSpace = Three.SRGBColorSpace
    marsColorTex.wrapS = Three.RepeatWrapping
    marsColorTex.wrapT = Three.RepeatWrapping

    const marsNormalTex = textureLoader.load(marsNormalTexture)
    marsNormalTex.wrapS = Three.RepeatWrapping
    marsNormalTex.wrapT = Three.RepeatWrapping

    const marsGeometry = new Three.SphereGeometry(1, 64, 64)
    const marsMaterial = new Three.MeshPhysicalMaterial({
      map: marsColorTex,
      normalMap: marsNormalTex,
      normalScale: new Three.Vector2(1.0, 1.0),
      roughness: 1.0,
      metalness: 0.0,
      color: new Three.Color(0xffffff),
      emissiveIntensity: 0.02,
    })
    const mars = new Three.Mesh(marsGeometry, marsMaterial)
    mars.position.set(0, 0, 0)
    marsScene.add(mars)
    planetsRef.current.mars = mars

    // Earth Scene
    const earthScene = new Three.Scene()
    earthScene.add(starfieldRef.current.clone())

    const earthColorTex = textureLoader.load(earthColorTexture)
    earthColorTex.colorSpace = Three.SRGBColorSpace
    earthColorTex.wrapS = Three.RepeatWrapping
    earthColorTex.wrapT = Three.RepeatWrapping
    earthColorTex.magFilter = Three.LinearFilter
    earthColorTex.minFilter = Three.LinearMipmapLinearFilter
    earthColorTex.anisotropy = 16

    const earthBumpTex = textureLoader.load(earthBumpTexture)
    earthBumpTex.wrapS = Three.RepeatWrapping
    earthBumpTex.wrapT = Three.RepeatWrapping
    earthBumpTex.magFilter = Three.LinearFilter
    earthBumpTex.minFilter = Three.LinearMipmapLinearFilter
    earthBumpTex.anisotropy = 16

    const earthSpecularTex = textureLoader.load(earthSpecularTexture)
    earthSpecularTex.wrapS = Three.RepeatWrapping
    earthSpecularTex.wrapT = Three.RepeatWrapping
    earthSpecularTex.magFilter = Three.LinearFilter
    earthSpecularTex.minFilter = Three.LinearMipmapLinearFilter
    earthSpecularTex.anisotropy = 16

    const earthNightTex = textureLoader.load(earthNightLights)
    earthNightTex.colorSpace = Three.SRGBColorSpace
    earthNightTex.wrapS = Three.RepeatWrapping
    earthNightTex.wrapT = Three.RepeatWrapping
    earthNightTex.magFilter = Three.LinearFilter
    earthNightTex.minFilter = Three.LinearMipmapLinearFilter
    earthNightTex.anisotropy = 16

    const earthCloudTex = textureLoader.load(earthCloudTexture)
    earthCloudTex.colorSpace = Three.SRGBColorSpace
    earthCloudTex.wrapS = Three.RepeatWrapping
    earthCloudTex.wrapT = Three.RepeatWrapping
    earthCloudTex.magFilter = Three.LinearFilter
    earthCloudTex.minFilter = Three.LinearMipmapLinearFilter
    earthCloudTex.anisotropy = 16

    const earthCloudAlpha = textureLoader.load(earthCloudTransparency)
    earthCloudAlpha.wrapS = Three.RepeatWrapping
    earthCloudAlpha.wrapT = Three.RepeatWrapping
    earthCloudAlpha.magFilter = Three.LinearFilter
    earthCloudAlpha.minFilter = Three.LinearMipmapLinearFilter
    earthCloudAlpha.anisotropy = 16

    const earthGeometry = new Three.SphereGeometry(1, 64, 64)
    
    const earthMaterial = new Three.MeshPhysicalMaterial({
      map: earthColorTex,
      normalMap: earthBumpTex,
      normalScale: new Three.Vector2(0.3, 0.3),
      roughnessMap: earthSpecularTex,
      roughness: 0.9,
      metalness: 0.02,
      emissiveMap: earthNightTex,
      emissiveIntensity: 1.5,
      color: new Three.Color(0xffffff),
      clearcoat: 0.1,
      clearcoatRoughness: 0.1,
    })
    
    const earth = new Three.Mesh(earthGeometry, earthMaterial)
    earth.position.set(0, 0, 0)
    earthScene.add(earth)
    planetsRef.current.earth = earth

    const cloudGeometry = new Three.SphereGeometry(1.005, 64, 64)
    const cloudMaterial = new Three.MeshPhysicalMaterial({
      map: earthCloudTex,
      alphaMap: earthCloudAlpha,
      transparent: true,
      opacity: 0.6,
      roughness: 1.0,
      metalness: 0.0,
      depthWrite: false,
      side: Three.DoubleSide,
    })
    
    const clouds = new Three.Mesh(cloudGeometry, cloudMaterial)
    clouds.position.set(0, 0, 0)
    earthScene.add(clouds)
    planetsRef.current.earthClouds = clouds

    // Jupiter Scene
    const jupiterScene = new Three.Scene()
    jupiterScene.add(starfieldRef.current.clone())

    const jupiterGeometry = new Three.SphereGeometry(2, 64, 64)
    const jupiterMaterial = new Three.MeshPhysicalMaterial({
      color: new Three.Color(0xffa500),
      roughness: 0.8,
      metalness: 0.0,
    })
    const jupiter = new Three.Mesh(jupiterGeometry, jupiterMaterial)
    jupiter.position.set(0, 0, 0)
    jupiterScene.add(jupiter)
    planetsRef.current.jupiter = jupiter

    // Add lighting to each scene
    setupLighting(marsScene)
    setupLighting(earthScene)
    setupLighting(jupiterScene)

    // Store scenes
    scenesRef.current = {
      mars: marsScene,
      earth: earthScene,
      jupiter: jupiterScene
    }
  }

  const setupLighting = (scene) => {
    const sunLight = new Three.DirectionalLight(0xffffff, 3.0)
    sunLight.position.set(100, 50, 75)
    sunLight.target.position.set(0, 0, 0)
    sunLight.castShadow = true
    sunLight.shadow.mapSize.width = 2048
    sunLight.shadow.mapSize.height = 2048
    sunLight.shadow.camera.near = 0.1
    sunLight.shadow.camera.far = 200
    sunLight.shadow.camera.left = -10
    sunLight.shadow.camera.right = 10
    sunLight.shadow.camera.top = 10
    sunLight.shadow.camera.bottom = -10
    scene.add(sunLight)

    const spaceAmbientLight = new Three.AmbientLight(0x404040, 0.8)
    scene.add(spaceAmbientLight)

    const fillLight = new Three.DirectionalLight(0x4a4a6a, 0.3)
    fillLight.position.set(-50, -25, -50)
    scene.add(fillLight)
  }

  const initializeTrajectory = async () => {
    // Create trajectory manager
    trajectoryManagerRef.current = new TrajectoryManager()
    
    // Load trajectory data
    try {
      await trajectoryManagerRef.current.loadTrajectoryData('/mars-edl-simulation/client/assets/data/MSL_position_J2000.csv')
    } catch (error) {
      console.error('Error loading trajectory:', error)
      trajectoryManagerRef.current.generateSampleTrajectory()
    }
    
    // Add trajectory to all scenes
    const trajectoryObject = trajectoryManagerRef.current.getObject3D()
    if (trajectoryObject) {
      scenesRef.current.mars?.add(trajectoryObject.clone())
      scenesRef.current.earth?.add(trajectoryObject.clone())
      scenesRef.current.jupiter?.add(trajectoryObject.clone())
    }
    
    // Create entry vehicle
    entryVehicleRef.current = new EntryVehicle()
    const vehicleObject = entryVehicleRef.current.getObject3D()
    
    // Scale vehicle for visibility
    vehicleObject.scale.set(0.01, 0.01, 0.01)
    
    // Add vehicle to all scenes
    scenesRef.current.mars?.add(vehicleObject.clone())
    scenesRef.current.earth?.add(vehicleObject.clone())
    scenesRef.current.jupiter?.add(vehicleObject.clone())
  }

  const setupEventListeners = () => {
    // Mouse move for raycaster
    const handleMouseMove = (event) => {
      mouseRef.current.x = (event.clientX / window.innerWidth) * 2 - 1
      mouseRef.current.y = -(event.clientY / window.innerHeight) * 2 + 1
      
      rendererRef.current.domElement.style.cursor = isPlaying ? 'pointer' : 'default'
    }
    
    // Mouse click for deflection
    const handleMouseClick = (event) => {
      if (!isPlaying || !trajectoryManagerRef.current) return
      
      // Apply deflection at current time
      const deflected = trajectoryManagerRef.current.applyDeflection(
        mouseRef.current,
        currentTime,
        cameraRef.current
      )
      
      if (deflected) {
        showClickFeedback(event.clientX, event.clientY)
      }
    }
    
    // Keyboard controls
    const handleKeyPress = (event) => {
      if (event.code === 'Space') {
        event.preventDefault()
        setIsPlaying(prev => !prev)
      } else if (event.code === 'KeyR') {
        resetSimulation()
      }
    }
    
    rendererRef.current.domElement.addEventListener('mousemove', handleMouseMove)
    rendererRef.current.domElement.addEventListener('click', handleMouseClick)
    document.addEventListener('keydown', handleKeyPress)
    
    return () => {
      rendererRef.current.domElement.removeEventListener('mousemove', handleMouseMove)
      rendererRef.current.domElement.removeEventListener('click', handleMouseClick)
      document.removeEventListener('keydown', handleKeyPress)
    }
  }

  const updateSimulation = (deltaTime) => {
    const newTime = Math.min(currentTime + deltaTime * PLAYBACK_SPEED, TOTAL_TIME)
    setCurrentTime(newTime)
    
    if (newTime >= TOTAL_TIME) {
      setIsPlaying(false)
    }
    
    // Get interpolated data
    const vehicleData = trajectoryManagerRef.current.getInterpolatedData(newTime)
    
    if (vehicleData && entryVehicleRef.current) {
      // Update vehicle position
      const vehicleObject = entryVehicleRef.current.getObject3D()
      vehicleObject.position.copy(vehicleData.position)
      vehicleObject.position.multiplyScalar(0.001) // Scale to match planet scale
      
      // Orient vehicle along velocity
      const velocityVector = trajectoryManagerRef.current.getVelocityVector(newTime)
      const lookAtPoint = vehicleData.position.clone().add(velocityVector)
      vehicleObject.lookAt(lookAtPoint)
      
      // Update trajectory display
      trajectoryManagerRef.current.updateTrajectoryDisplay(newTime)
      
      // Update vehicle effects
      entryVehicleRef.current.update(newTime, vehicleData)
    }
  }

  const showClickFeedback = (x, y) => {
    const ripple = document.createElement('div')
    ripple.style.cssText = `
      position: fixed;
      left: ${x}px;
      top: ${y}px;
      width: 40px;
      height: 40px;
      border: 2px solid #ffff00;
      border-radius: 50%;
      transform: translate(-50%, -50%);
      pointer-events: none;
      animation: deflectionRipple 0.6s ease-out;
      z-index: 1000;
    `
    
    document.body.appendChild(ripple)
    setTimeout(() => document.body.removeChild(ripple), 600)
  }

  const resetSimulation = () => {
    setCurrentTime(0)
    setIsPlaying(false)
    
    if (trajectoryManagerRef.current) {
      trajectoryManagerRef.current.reset()
      trajectoryManagerRef.current.updateTrajectoryDisplay(0)
    }
  }

  const switchPlanet = (planetName) => {
    if (isTransitioning || currentPlanet === planetName) return
    
    setIsTransitioning(true)
    setCurrentPlanet(planetName)

    document.querySelectorAll('.planet-btn').forEach(btn => btn.classList.remove('active'))
    document.getElementById(`${planetName}-btn`).classList.add('active')

    sceneRef.current = scenesRef.current[planetName]
    
    let cameraDistance = 10
    if (planetName === 'jupiter') cameraDistance = 15
    
    const startPosition = cameraRef.current.position.clone()
    const startTarget = controlsRef.current.target.clone()
    
    const targetPosition = new Three.Vector3(0, 0, cameraDistance)
    const targetTarget = new Three.Vector3(0, 0, 0)
    
    const duration = 2000
    const startTime = Date.now()

    const animateTransition = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      
      const easeProgress = 1 - Math.pow(1 - progress, 3)
      
      cameraRef.current.position.lerpVectors(startPosition, targetPosition, easeProgress)
      controlsRef.current.target.lerpVectors(startTarget, targetTarget, easeProgress)
      
      if (progress < 1) {
        requestAnimationFrame(animateTransition)
      } else {
        setIsTransitioning(false)
      }
    }
    
    animateTransition()
  }

  // Add CSS for deflection animation
  useEffect(() => {
    const style = document.createElement('style')
    style.textContent = `
      @keyframes deflectionRipple {
        0% {
          transform: translate(-50%, -50%) scale(1);
          opacity: 1;
        }
        100% {
          transform: translate(-50%, -50%) scale(3);
          opacity: 0;
        }
      }
    `
    document.head.appendChild(style)
    
    return () => document.head.removeChild(style)
  }, [])

  return null
}

export default App