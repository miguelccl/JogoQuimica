import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

export function initRocketBackground(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return null;

    // Clear previous if any
    container.innerHTML = '';

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 25;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    // Limit pixel ratio for performance
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    container.appendChild(renderer.domElement);

    const mouse = new THREE.Vector2(0, 0);
    const clock = new THREE.Clock();
    const isDarkMode = true; // QuimicaQuiz is always dark mode

    const renderScene = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        1.5,
        0.4,
        0.85
    );

    bloomPass.threshold = 0;
    bloomPass.strength = 1.0; // slightly reduced from 1.2 for performance
    bloomPass.radius = 0;

    const composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);

    // Stars
    const starGeometry = new THREE.BufferGeometry();
    const starVertices = [];
    const numStars = window.innerWidth < 768 ? 600 : 1500; // less stars on mobile

    for (let i = 0; i < numStars; i++) {
        const x = (Math.random() - 0.5) * 100;
        const y = (Math.random() - 0.5) * 100;
        const z = (Math.random() - 0.5) * 100;
        starVertices.push(x, y, z);
    }
    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
    const starMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.1 });
    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);

    // Rocket
    const rocket = new THREE.Group();
    const pixelSize = 0.2;
    const pixelGeo = new THREE.BoxGeometry(pixelSize, pixelSize, pixelSize);

    // Colors adjusted to QuimicaQuiz theme
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x6366f1, flatShading: true }); // Primary
    const wingMat = new THREE.MeshStandardMaterial({ color: 0x8b5cf6, flatShading: true }); // Secondary
    const cockpitMat = new THREE.MeshStandardMaterial({ 
        color: 0x06b6d4, // Accent
        emissive: 0x06b6d4, 
        emissiveIntensity: 0.5 
    });

    for (let y = -4; y < 5; y++) {
        for (let x = -2; x < 3; x++) {
            if (Math.abs(x) === 2 && y > 1) continue;
            const pixel = new THREE.Mesh(pixelGeo, bodyMat);
            pixel.position.set(x * pixelSize, y * pixelSize, 0);
            rocket.add(pixel);
        }
    }

    for (let y = -3; y < -1; y++) {
        for (let x = -4; x < -2; x++) {
            const pixelL = new THREE.Mesh(pixelGeo, wingMat);
            pixelL.position.set(x * pixelSize, y * pixelSize, 0);
            rocket.add(pixelL);

            const pixelR = new THREE.Mesh(pixelGeo, wingMat);
            pixelR.position.set(-x * pixelSize, y * pixelSize, 0);
            rocket.add(pixelR);
        }
    }

    const cockpit = new THREE.Mesh(pixelGeo, cockpitMat);
    cockpit.position.set(0, 3 * pixelSize, pixelSize);
    rocket.add(cockpit);
    scene.add(rocket);

    // Trail
    const trailPool = [];
    let trailIndex = 0;
    const trailSize = window.innerWidth < 768 ? 100 : 200; // Less particles on mobile
    const trailGeo = new THREE.BoxGeometry(pixelSize * 1.5, pixelSize * 1.5, pixelSize * 1.5);

    for (let i = 0; i < trailSize; i++) {
        const trailMat = new THREE.MeshBasicMaterial({
            color: Math.random() > 0.5 ? 0x06b6d4 : 0x8b5cf6 // Accent / Secondary
        });
        const particle = new THREE.Mesh(trailGeo, trailMat);
        particle.visible = false;
        scene.add(particle);
        trailPool.push(particle);
    }

    // Atoms (Replacing Coins)
    const atomGroup = new THREE.Group();
    const atomMat = new THREE.MeshStandardMaterial({ color: 0xffd700, flatShading: true }); // Gold
    const numAtoms = window.innerWidth < 768 ? 10 : 20;

    for (let i = 0; i < numAtoms; i++) {
        const atom = new THREE.Group();
        for (let p = 0; p < 15; p++) {
            const pixel = new THREE.Mesh(pixelGeo, atomMat);
            const angle = (p / 15) * Math.PI * 2;
            pixel.position.set(Math.cos(angle) * 0.4, Math.sin(angle) * 0.4, 0);
            atom.add(pixel);
        }
        atom.position.set(
            (Math.random() - 0.5) * 40,
            (Math.random() - 0.5) * 30,
            (Math.random() - 0.5) * 20
        );
        atomGroup.add(atom);
    }
    scene.add(atomGroup);

    // Mouse Move
    const handleMouseMove = (event) => {
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener('mousemove', handleMouseMove);

    // Animation Loop
    let animationFrameId;
    let isActive = true;

    const animate = () => {
        if (!isActive) return;
        animationFrameId = requestAnimationFrame(animate);

        const delta = clock.getDelta();
        const elapsedTime = clock.getElapsedTime();

        const targetPosition = new THREE.Vector3(mouse.x * 15, mouse.y * 10, 0);
        rocket.position.lerp(targetPosition, 0.05);
        rocket.rotation.y = (targetPosition.x - rocket.position.x) * 0.1;
        rocket.rotation.x = -(targetPosition.y - rocket.position.y) * 0.1;

        if (Math.random() > 0.3) {
            const particle = trailPool[trailIndex];
            particle.position.copy(rocket.position);
            particle.position.y -= 0.7;
            particle.scale.setScalar(1);
            particle.visible = true;
            particle.life = 1;
            trailIndex = (trailIndex + 1) % trailSize;
        }

        trailPool.forEach(particle => {
            if (particle.visible && typeof particle.life === 'number') {
                particle.life -= delta * 1.5;
                particle.scale.setScalar(Math.max(particle.life, 0));
                if (particle.life <= 0) particle.visible = false;
            }
        });

        atomGroup.children.forEach((atom, i) => {
            atom.rotation.z = elapsedTime * (i % 2 === 0 ? 1 : -1);
            atom.rotation.x = elapsedTime * 0.5; // add some 3D spin to make it look like atoms
        });

        composer.render();
    };
    animate();

    // Resize
    const handleResize = () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        composer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    // Return cleanup function
    return () => {
        isActive = false;
        cancelAnimationFrame(animationFrameId);
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('mousemove', handleMouseMove);

        // Dispose geometries and materials
        starGeometry.dispose();
        starMaterial.dispose();
        pixelGeo.dispose();
        bodyMat.dispose();
        wingMat.dispose();
        cockpitMat.dispose();
        trailGeo.dispose();
        atomMat.dispose();

        trailPool.forEach(particle => {
            if (particle.material) particle.material.dispose();
            if (particle.geometry) particle.geometry.dispose();
        });

        composer.dispose();
        renderer.dispose();

        if (container.contains(renderer.domElement)) {
            container.removeChild(renderer.domElement);
        }
    };
}
