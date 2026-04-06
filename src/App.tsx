/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

const uniqueItems = Array.from({ length: 10 }).map((_, i) => ({
  image: `https://picsum.photos/seed/${i + 100}/800/600`, // Landscape images
  title: `Artwork ${i + 1}`
}));
const items = Array.from({ length: 80 }).map((_, i) => uniqueItems[i % 10]); // Increased to 80 for dense ring

export default function App() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [preview, setPreview] = useState(items[0]);
  const currentPreviewRef = useRef(items[0]);
  const previewImgRef = useRef<HTMLImageElement>(null);
  const previewTextRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    // Initialize Lenis for smooth scrolling
    const lenis = new Lenis({
      lerp: 0.05,
      smoothWheel: true,
    });
    
    lenis.on('scroll', ScrollTrigger.update);

    const raf = (time: number) => {
      lenis.raf(time * 1000);
    };
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    // Three.js Setup
    if (!canvasRef.current) return;
    const container = canvasRef.current;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);
    scene.fog = new THREE.Fog(0xffffff, 15, 35);

    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 4, 22);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // OrbitControls for user rotation
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 2);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight.position.set(5, 10, 10);
    scene.add(dirLight);

    // Groups
    const parentGroup = new THREE.Group();
    scene.add(parentGroup);
    parentGroup.rotation.x = -0.15; // Initial tilt

    const scrollGroup = new THREE.Group();
    parentGroup.add(scrollGroup);

    const autoRotateGroup = new THREE.Group();
    scrollGroup.add(autoRotateGroup);

    // Geometry & Material
    const radius = 8.5;
    const total = items.length;
    const cardWidth = 2.0; // Landscape
    const cardHeight = 1.4;
    const geometry = new THREE.PlaneGeometry(cardWidth, cardHeight, 16, 16);

    const textureLoader = new THREE.TextureLoader();
    const textures = uniqueItems.map(item => {
      const tex = textureLoader.load(item.image);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.generateMipmaps = true;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      return tex;
    });

    const meshes: THREE.Mesh[] = [];

    items.forEach((item, i) => {
      const angle = (i / total) * Math.PI * 2;
      
      const material = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: textures[i % uniqueItems.length],
        side: THREE.DoubleSide,
        roughness: 0.3,
        metalness: 0.2,
      });

      const mesh = new THREE.Mesh(geometry, material);
      
      mesh.position.x = radius * Math.cos(angle);
      mesh.position.z = radius * Math.sin(angle);
      mesh.position.y = 0;

      // Make cards face along the tangent of the circle (rolodex style)
      mesh.lookAt(0, 0, 0);
      mesh.rotateY(Math.PI / 2);
      
      mesh.userData = { index: i, item, angle };

      autoRotateGroup.add(mesh);
      meshes.push(mesh);
    });

    // ScrollTrigger for rotation
    const st = gsap.to(scrollGroup.rotation, {
      y: Math.PI * 2,
      ease: "none",
      scrollTrigger: {
        trigger: document.body,
        start: "top top",
        end: "bottom bottom",
        scrub: 1,
      }
    });

    // Raycaster & Mouse
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2(-100, -100); // Start off-screen
    const targetMouse = new THREE.Vector2(0, 0);
    let hoveredMesh: THREE.Mesh | null = null;

    const onMouseMove = (event: MouseEvent) => {
      targetMouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      targetMouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener('mousemove', onMouseMove);

    // Animation Loop
    let animationFrameId: number;

    const render = () => {
      controls.update(); // Update OrbitControls

      // Smooth mouse interpolation
      mouse.x += (targetMouse.x - mouse.x) * 0.1;
      mouse.y += (targetMouse.y - mouse.y) * 0.1;

      // Auto rotation
      autoRotateGroup.rotation.y -= 0.0005;

      // Raycasting
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(meshes);

      if (intersects.length > 0) {
        const object = intersects[0].object as THREE.Mesh;
        if (hoveredMesh !== object) {
          // Mouse leave previous
          if (hoveredMesh) {
            gsap.to(hoveredMesh.scale, { x: 1, y: 1, z: 1, duration: 0.4, ease: "power3.out" });
            gsap.to(hoveredMesh.position, {
              x: radius * Math.cos(hoveredMesh.userData.angle),
              z: radius * Math.sin(hoveredMesh.userData.angle),
              duration: 0.4,
              ease: "power3.out"
            });
          }
          
          hoveredMesh = object;
          
          // Mouse enter new
          const hoverRadius = radius + 1.0; // Pop out more
          gsap.to(hoveredMesh.scale, { x: 1.2, y: 1.2, z: 1.2, duration: 0.4, ease: "power3.out" });
          gsap.to(hoveredMesh.position, {
            x: hoverRadius * Math.cos(hoveredMesh.userData.angle),
            z: hoverRadius * Math.sin(hoveredMesh.userData.angle),
            duration: 0.4,
            ease: "power3.out"
          });

          // Update Preview
          const item = hoveredMesh.userData.item;
          if (currentPreviewRef.current.title !== item.title) {
            currentPreviewRef.current = item;
            if (previewImgRef.current && previewTextRef.current) {
              gsap.to([previewImgRef.current, previewTextRef.current], {
                opacity: 0,
                duration: 0.2,
                onComplete: () => {
                  setPreview(item);
                  gsap.to([previewImgRef.current, previewTextRef.current], { opacity: 1, duration: 0.2 });
                }
              });
            }
          }
        }
      } else {
        if (hoveredMesh) {
          // Mouse leave
          gsap.to(hoveredMesh.scale, { x: 1, y: 1, z: 1, duration: 0.4, ease: "power3.out" });
          gsap.to(hoveredMesh.position, {
            x: radius * Math.cos(hoveredMesh.userData.angle),
            z: radius * Math.sin(hoveredMesh.userData.angle),
            duration: 0.4,
            ease: "power3.out"
          });
          hoveredMesh = null;
        }
      }

      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(render);
    };
    render();

    // Resize handler
    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('mousemove', onMouseMove);
      cancelAnimationFrame(animationFrameId);
      gsap.ticker.remove(raf);
      lenis.destroy();
      st.kill();
      controls.dispose();
      container.removeChild(renderer.domElement);
      geometry.dispose();
      meshes.forEach(m => {
        if (m.material instanceof THREE.Material) m.material.dispose();
      });
      textures.forEach(t => t.dispose());
      renderer.dispose();
    };
  }, []);

  return (
    <div className="relative w-full bg-white text-black font-sans selection:bg-black selection:text-white">
      {/* 3D Canvas Container */}
      <div ref={canvasRef} className="fixed inset-0 z-0 pointer-events-auto"></div>

      {/* Fixed UI Overlay */}
      <div className="fixed inset-0 pointer-events-none z-10 p-6 md:p-10 flex flex-col justify-between">
        {/* Top */}
        <div className="flex justify-between items-start">
          {/* Top Left Preview */}
          <div className="pointer-events-auto flex flex-col gap-3">
             <div className="w-28 h-20 overflow-hidden bg-gray-100 shadow-sm">
               <img 
                 ref={previewImgRef}
                 src={preview.image} 
                 alt={preview.title}
                 className="w-full h-full object-cover" 
                 referrerPolicy="no-referrer"
               />
             </div>
             <p ref={previewTextRef} className="text-xs font-medium tracking-tight text-gray-800">{preview.title}</p>
          </div>
          {/* Top Right Controls */}
          <div className="flex gap-3 pointer-events-auto">
             <button className="px-4 py-2 bg-gray-100/80 backdrop-blur-md rounded-full text-[10px] font-semibold uppercase tracking-widest flex items-center gap-2 hover:bg-gray-200 transition-colors text-gray-800">
               <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span> Scroll
             </button>
             <button className="px-4 py-2 bg-gray-100/80 backdrop-blur-md rounded-full text-[10px] font-semibold uppercase tracking-widest flex items-center gap-2 hover:bg-gray-200 transition-colors text-gray-800">
               <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span> Animate
             </button>
          </div>
        </div>
        {/* Bottom */}
        <div className="flex justify-between items-end">
          {/* Bottom Right */}
          <p className="text-[10px] font-semibold uppercase tracking-widest flex items-center gap-1.5 mb-2 text-gray-800">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 0H20V8H12L4 0Z" fill="currentColor"/>
              <path d="M20 8H4V16H12L20 8Z" fill="currentColor"/>
              <path d="M12 16H4V24L12 16Z" fill="currentColor"/>
            </svg>
            Made with AI
          </p>
        </div>
      </div>

      {/* Scrollable area to trigger ScrollTrigger */}
      <div className="h-[400vh] w-full pointer-events-none"></div>
    </div>
  );
}
