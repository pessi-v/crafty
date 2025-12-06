import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

/**
 * Initialize the Three.js animation
 * @param {Object} config - Configuration object
 * @param {string} config.baseUrl - Base URL for loading GLB models
 * @param {Object} config.clickableObjects - Object mapping model names to URLs and names
 */
export function initAnimation(config) {
  const container = document.getElementById('animation-container');

  // Scene setup
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0a0a1a, 10, 50);

  // Camera setup
  const camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(8, 5, 12);
  camera.lookAt(0, 0, 0);

  // Renderer setup
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadow;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const mainLight = new THREE.DirectionalLight(0xfff5e6, 1.2);
  mainLight.position.set(10, 8, 10);
  mainLight.castShadow = true;
  mainLight.shadow.mapSize.width = 2048;
  mainLight.shadow.mapSize.height = 2048;
  mainLight.shadow.camera.near = 0.5;
  mainLight.shadow.camera.far = 50;
  mainLight.shadow.camera.left = -15;
  mainLight.shadow.camera.right = 15;
  mainLight.shadow.camera.top = 15;
  mainLight.shadow.camera.bottom = -15;
  scene.add(mainLight);

  const fillLight = new THREE.DirectionalLight(0x8899ff, 0.5);
  fillLight.position.set(-5, 3, -5);
  scene.add(fillLight);

  const rimLight = new THREE.PointLight(0xffaa88, 0.8, 30);
  rimLight.position.set(0, 5, -10);
  scene.add(rimLight);

  // Add some stars in the background
  const starGeometry = new THREE.BufferGeometry();
  const starPositions = [];
  for (let i = 0; i < 1000; i++) {
    const x = (Math.random() - 0.5) * 100;
    const y = (Math.random() - 0.5) * 100;
    const z = (Math.random() - 0.5) * 100;
    starPositions.push(x, y, z);
  }
  starGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(starPositions, 3)
  );
  const starMaterial = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.1,
    transparent: true,
    opacity: 0.8,
  });
  const stars = new THREE.Points(starGeometry, starMaterial);
  scene.add(stars);

  // Model containers
  let turnipPlanet = null;

  // Orbital parameters for each satellite
  const orbitalData = {
    chili: {
      radius: 3.5,
      speed: 0.6,
      tilt: 0.1,
      yOffset: 0.2,
      model: null,
    },
    egg: {
      radius: 4.5,
      speed: 0.5,
      tilt: -0.15,
      yOffset: -0.3,
      model: null,
    },
    garlic: {
      radius: 5.5,
      speed: 0.35,
      tilt: 0.05,
      yOffset: 0.1,
      model: null,
    },
  };

  // URL configuration for clickable objects (passed from Twig)
  const clickableObjects = config.clickableObjects;

  // Raycaster for click detection
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let hoveredObject = null;

  // GLTF Loader
  const loader = new GLTFLoader();
  let modelsLoaded = 0;
  const totalModels = 4;

  function onModelLoaded() {
    modelsLoaded++;
    if (modelsLoaded === totalModels) {
      const loadingElement = document.getElementById("loading");
      if (loadingElement) {
        loadingElement.style.display = "none";
      }
    }
  }

  // Base URL for assets
  const baseUrl = config.baseUrl;

  // Load Turnip (Planet)
  loader.load(
    `${baseUrl}Turnip.glb`,
    (gltf) => {
      turnipPlanet = gltf.scene;
      turnipPlanet.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      // Scale the turnip appropriately
      turnipPlanet.scale.set(2, 2, 2);

      // Tilt the axis (like Earth)
      turnipPlanet.rotation.z = 0.4; // ~23 degrees tilt

      scene.add(turnipPlanet);
      onModelLoaded();
    },
    undefined,
    (error) => {
      console.error("Error loading Turnip:", error);
    }
  );

  // Load Chili (Satellite 1)
  loader.load(
    `${baseUrl}Chili.glb`,
    (gltf) => {
      const model = gltf.scene;
      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      model.scale.set(0.1, 0.1, 0.1);
      orbitalData.chili.model = model;
      scene.add(model);
      onModelLoaded();
    },
    undefined,
    (error) => {
      console.error("Error loading Chili:", error);
    }
  );

  // Load Egg (Satellite 2)
  loader.load(
    `${baseUrl}Egg.glb`,
    (gltf) => {
      const model = gltf.scene;
      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      model.scale.set(0.005, 0.005, 0.005);
      orbitalData.egg.model = model;
      scene.add(model);
      onModelLoaded();
    },
    undefined,
    (error) => {
      console.error("Error loading Egg:", error);
    }
  );

  // Load Garlic (Satellite 3)
  loader.load(
    `${baseUrl}Garlic.glb`,
    (gltf) => {
      const model = gltf.scene;
      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      model.scale.set(0.1, 0.1, 0.1);
      orbitalData.garlic.model = model;
      scene.add(model);
      onModelLoaded();
    },
    undefined,
    (error) => {
      console.error("Error loading Garlic:", error);
    }
  );

  // Animation variables
  let time = 0;

  // Animation loop
  function animate() {
    requestAnimationFrame(animate);

    time += 0.01;

    // Rotate the turnip planet with a subtle wobble
    if (turnipPlanet) {
      turnipPlanet.rotation.y += 0.0003;
      // Add subtle wobble
      turnipPlanet.rotation.x = Math.sin(time * 0.5) * 0.05;
    }

    // Animate satellites
    Object.keys(orbitalData).forEach((key) => {
      const satellite = orbitalData[key];
      if (satellite.model) {
        const angle = time * satellite.speed;

        // Calculate orbital position
        const x = Math.cos(angle) * satellite.radius;
        const z = Math.sin(angle) * satellite.radius;
        const y = satellite.yOffset + Math.sin(angle * 2) * 0.2; // Slight vertical wave

        // Apply tilt to orbit
        satellite.model.position.x =
          x * Math.cos(satellite.tilt) - y * Math.sin(satellite.tilt);
        satellite.model.position.y =
          y * Math.cos(satellite.tilt) + x * Math.sin(satellite.tilt);
        satellite.model.position.z = z;

        // Rotate satellite on its own axis
        satellite.model.rotation.y += 0.02;
        satellite.model.rotation.x += 0.01;

        // Depth sorting for occlusion
        // Calculate if satellite is behind planet
        const distanceFromCamera = satellite.model.position.distanceTo(
          camera.position
        );
        const planetDistanceFromCamera = turnipPlanet
          ? turnipPlanet.position.distanceTo(camera.position)
          : 0;

        // Simple occlusion: if satellite is further and behind planet in Z
        if (
          turnipPlanet &&
          satellite.model.position.z < -1 &&
          Math.abs(satellite.model.position.x) < 2
        ) {
          satellite.model.visible = false;
        } else {
          satellite.model.visible = true;
        }
      }
    });

    // Gentle camera orbit
    const cameraRadius = 15;
    const cameraSpeed = 0.01;
    camera.position.x = Math.cos(time * cameraSpeed) * cameraRadius * 0.3;
    camera.position.z =
      Math.sin(time * cameraSpeed) * cameraRadius * 0.6 + 12;
    camera.position.y = 5 + Math.sin(time * cameraSpeed * 0.5) * 1;
    camera.lookAt(0, 0, 0);

    // Gentle star rotation
    stars.rotation.y += 0.0001;

    renderer.render(scene, camera);
  }

  // Function to get all clickable meshes
  function getClickableMeshes() {
    const meshes = [];

    // Add turnip planet meshes
    if (turnipPlanet) {
      turnipPlanet.traverse((child) => {
        if (child.isMesh) {
          child.userData.clickableType = "turnip";
          meshes.push(child);
        }
      });
    }

    // Add satellite meshes
    Object.keys(orbitalData).forEach((key) => {
      const satellite = orbitalData[key];
      if (satellite.model) {
        satellite.model.traverse((child) => {
          if (child.isMesh) {
            child.userData.clickableType = key;
            meshes.push(child);
          }
        });
      }
    });

    return meshes;
  }

  // Mouse move handler for hover effects
  function onMouseMove(event) {
    // Calculate mouse position in normalized device coordinates
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Update raycaster
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(
      getClickableMeshes(),
      false
    );

    if (intersects.length > 0) {
      const intersectedObject = intersects[0].object;
      if (hoveredObject !== intersectedObject) {
        hoveredObject = intersectedObject;
        renderer.domElement.classList.add("pointer");
      }
    } else {
      if (hoveredObject) {
        hoveredObject = null;
        renderer.domElement.classList.remove("pointer");
      }
    }
  }

  // Click handler
  function onClick(event) {
    // Calculate mouse position
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Update raycaster
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(
      getClickableMeshes(),
      false
    );

    if (intersects.length > 0) {
      const clickedObject = intersects[0].object;
      const objectType = clickedObject.userData.clickableType;

      if (objectType && clickableObjects[objectType]) {
        const config = clickableObjects[objectType];
        console.log(`Clicked on ${config.name}`);
        console.log('Config:', config);
        console.log('window.openModal available?', typeof window.openModal);

        // Open modal with entry data
        if (window.openModal) {
          window.openModal(config);
        } else {
          console.error('window.openModal is not defined!');
        }
      }
    }
  }

  // Add event listeners
  window.addEventListener("mousemove", onMouseMove, false);
  window.addEventListener("click", onClick, false);

  // Handle window resize
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Start animation
  animate();
}
