import * as React from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { Box, RotateCcw, RotateCw, ScanLine } from 'lucide-react';
import type { BodySystemKey } from './body-data';

type Props = {
  active: BodySystemKey;
  onSelect: (key: BodySystemKey) => void;
};

const LABELS: Record<BodySystemKey, string> = {
  glucose: 'Glucose',
  eyes: 'Eyes',
  heart: 'Heart and vessels',
  kidneys: 'Kidneys',
  feet: 'Feet',
};

const COLORS: Record<BodySystemKey, number> = {
  glucose: 0xc79a5b,
  eyes: 0x6e9fc2,
  heart: 0xb85f64,
  kidneys: 0xa87155,
  feet: 0x7eaa98,
};

function systemForName(name: string): BodySystemKey | null {
  if (/pancrea/i.test(name)) return 'glucose';
  if (/eyeball|optic_nerve|cornea|iris|lens|retina|sclera|choroid|vitreous|eyelid/i.test(name)) return 'eyes';
  if (/kidney|renal_cortex|renal_medulla|renal_pyramid|ureter/i.test(name)) return 'kidneys';
  if (/heart|ventricle|atrium|myocard|papillary_muscle_of_heart|aorta|pulmonary_trunk|vena_cava|coronary/i.test(name)) return 'heart';
  return null;
}

function disposeMaterial(material: THREE.Material | THREE.Material[]): void {
  if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
  else material.dispose();
}

export function BodyModel3D({ active, onSelect }: Props): React.ReactElement {
  const host = React.useRef<HTMLDivElement>(null);
  const sceneRef = React.useRef<THREE.Scene | null>(null);
  const cameraRef = React.useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = React.useRef<OrbitControls | null>(null);
  const rendererRef = React.useRef<THREE.WebGLRenderer | null>(null);
  const organRef = React.useRef<Map<BodySystemKey, THREE.Mesh[]>>(new Map());
  const activeRef = React.useRef(active);
  const autoRotateRef = React.useRef(true);
  const onSelectRef = React.useRef(onSelect);
  const [loading, setLoading] = React.useState(0);
  const [failed, setFailed] = React.useState(false);
  const [autoRotate, setAutoRotate] = React.useState(true);
  const [hover, setHover] = React.useState<BodySystemKey | null>(null);
  const hoverRef = React.useRef<BodySystemKey | null>(null);

  React.useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motion.matches) setAutoRotate(false);
    const update = (event: MediaQueryListEvent): void => setAutoRotate(!event.matches);
    motion.addEventListener('change', update);
    return () => motion.removeEventListener('change', update);
  }, []);

  React.useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  const emphasis = React.useCallback((hovered: BodySystemKey | null) => {
    for (const [key, meshes] of organRef.current) {
      for (const mesh of meshes) {
        const material = mesh.material as THREE.MeshStandardMaterial;
        material.emissiveIntensity =
          key === hovered ? 0.68 : key === activeRef.current ? 0.42 : 0.06;
      }
    }
  }, []);

  React.useEffect(() => {
    autoRotateRef.current = autoRotate;
    if (controlsRef.current) controlsRef.current.autoRotate = autoRotate;
  }, [autoRotate]);

  React.useEffect(() => {
    activeRef.current = active;
    for (const [key, meshes] of organRef.current) {
      for (const mesh of meshes) {
        const material = mesh.material as THREE.MeshStandardMaterial;
        material.emissive.setHex(COLORS[key]);
        material.color.setHex(COLORS[key]);
      }
    }
    emphasis(hoverRef.current);
  }, [active, emphasis]);

  React.useEffect(() => {
    const element = host.current;
    if (!element) return undefined;
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    const camera = new THREE.PerspectiveCamera(33, 1, 0.01, 20);
    camera.position.set(0, 0.05, 3.05);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(element.clientWidth, element.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    element.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const hemi = new THREE.HemisphereLight(0xffffff, 0x163a32, 1.5);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xfff8f0, 2.4);
    key.position.set(2.4, 3.2, 3.2);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xbfe0d7, 1.0);
    fill.position.set(-2.6, 0.8, 1.8);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffffff, 1.1);
    rim.position.set(0, 1.5, -3);
    scene.add(rim);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.enablePan = true;
    controls.minDistance = 0.35;
    controls.maxDistance = 5.2;
    controls.target.set(0, 0.02, 0);
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.65;
    controls.touches.ONE = THREE.TOUCH.ROTATE;
    controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
    controlsRef.current = controls;

    const draco = new DRACOLoader();
    draco.setDecoderPath('/draco/');
    const loader = new GLTFLoader();
    loader.setDRACOLoader(draco);
    let disposed = false;
    let frame = 0;
    let started = performance.now();

    loader.load(
      '/models/anatomy.glb',
      (gltf) => {
        if (disposed) return;
        const model = gltf.scene;
        model.position.y = -0.035;
        const organs = new Map<BodySystemKey, THREE.Mesh[]>();
        const pickables: THREE.Object3D[] = [];
        model.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return;
          const name = object.name || '';
          const system = systemForName(name);
          if (name === 'VH_F_skin') {
            const skin = new THREE.MeshStandardMaterial({
              color: 0xe4c6b7,
              transparent: true,
              opacity: 0.2,
              roughness: 0.72,
              metalness: 0,
              depthWrite: false,
              side: THREE.DoubleSide,
            });
            object.material = skin;
            object.renderOrder = 2;
            object.userData.skin = true;
            return;
          }
          if (!system) return;
          const material = new THREE.MeshStandardMaterial({
            color: COLORS[system],
            emissive: COLORS[system],
            emissiveIntensity: system === activeRef.current ? 0.42 : 0.06,
            roughness: 0.56,
            metalness: 0.03,
          });
          object.material = material;
          object.userData.system = system;
          object.renderOrder = 1;
          object.castShadow = false;
          object.receiveShadow = false;
          const bucket = organs.get(system) ?? [];
          bucket.push(object);
          organs.set(system, bucket);
          pickables.push(object);
        });
        organRef.current = organs;
        scene.add(model);

        // A small physical marker over the feet. Feet are body surface, not a
        // separate organ mesh, so this keeps the area clickable in 3D.
        const foot = new THREE.Mesh(
          new THREE.TorusGeometry(0.055, 0.007, 8, 36),
          new THREE.MeshStandardMaterial({ color: COLORS.feet, emissive: COLORS.feet, emissiveIntensity: 0.14, roughness: 0.5 }),
        );
        foot.name = 'feet-marker';
        foot.position.set(0.145, -0.775, 0.105);
        foot.rotation.x = Math.PI / 2;
        foot.userData.system = 'feet';
        scene.add(foot);
        pickables.push(foot);
        organs.set('feet', [foot]);
        organRef.current = organs;

        const box = new THREE.Box3().setFromObject(model);
        const sphere = box.getBoundingSphere(new THREE.Sphere());
        controls.target.copy(sphere.center);
        controls.target.y -= 0.01;

        const raycaster = new THREE.Raycaster();
        const pointer = new THREE.Vector2();
        let down = { x: 0, y: 0 };
        const hits = (event: PointerEvent): THREE.Intersection[] => {
          const rect = renderer.domElement.getBoundingClientRect();
          pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
          pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
          raycaster.setFromCamera(pointer, camera);
          return raycaster.intersectObjects(pickables, false);
        };
        const onMove = (event: PointerEvent): void => {
          if (event.pointerType === 'touch') return;
          const first = hits(event)[0];
          const system = (first?.object.userData.system as BodySystemKey | undefined) ?? null;
          if (system !== hoverRef.current) {
            hoverRef.current = system;
            setHover(system);
            emphasis(system);
          }
          renderer.domElement.style.cursor = system ? 'pointer' : 'grab';
        };
        const onDown = (event: PointerEvent): void => {
          down = { x: event.clientX, y: event.clientY };
        };
        const onUp = (event: PointerEvent): void => {
          if (Math.hypot(event.clientX - down.x, event.clientY - down.y) > 5) return;
          const first = hits(event)[0];
          const system = first?.object.userData.system as BodySystemKey | undefined;
          if (system) onSelectRef.current(system);
        };
        const onLeave = (): void => {
          hoverRef.current = null;
          setHover(null);
          emphasis(null);
        };
        renderer.domElement.addEventListener('pointermove', onMove);
        renderer.domElement.addEventListener('pointerdown', onDown);
        renderer.domElement.addEventListener('pointerup', onUp);
        renderer.domElement.addEventListener('pointerleave', onLeave);
        (renderer.domElement as HTMLCanvasElement & { cleanup?: () => void }).cleanup = () => {
          renderer.domElement.removeEventListener('pointermove', onMove);
          renderer.domElement.removeEventListener('pointerdown', onDown);
          renderer.domElement.removeEventListener('pointerup', onUp);
          renderer.domElement.removeEventListener('pointerleave', onLeave);
        };
        started = performance.now();
        setLoading(100);
      },
      (event) => {
        if (event.total) setLoading(Math.min(99, Math.round((event.loaded / event.total) * 100)));
      },
      () => setFailed(true),
    );

    const resize = (): void => {
      const width = element.clientWidth;
      const height = element.clientHeight;
      if (!width || !height) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();

    const tick = (): void => {
      frame = requestAnimationFrame(tick);
      controls.autoRotate = autoRotateRef.current;
      controls.update();
      renderer.render(scene, camera);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      (renderer.domElement as HTMLCanvasElement & { cleanup?: () => void }).cleanup?.();
      controls.dispose();
      draco.dispose();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          disposeMaterial(object.material);
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
      controlsRef.current = null;
      rendererRef.current = null;
      cameraRef.current = null;
      sceneRef.current = null;
      organRef.current = new Map();
    };
  }, []);

  const reset = (): void => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    camera.position.set(0, 0.05, 3.05);
    controls.target.set(0, 0.02, 0);
    controls.update();
  };

  return (
    <div>
    <div className="relative overflow-hidden rounded-[18px] border border-line bg-[radial-gradient(circle_at_50%_28%,#ffffff_0%,#edf6f1_48%,#dcece5_100%)]">
      <div className="pointer-events-none absolute bottom-14 left-1/2 h-12 w-64 -translate-x-1/2 rounded-[50%] bg-[#20423b]/15 blur-2xl" aria-hidden />
      <div ref={host} className="body-model-host relative z-10 h-[520px] w-full sm:h-[650px]" aria-label="Interactive 3D anatomy model. Drag to rotate, scroll to zoom, click an organ." role="img" />
      {loading < 100 && !failed ? (
        <div className="absolute inset-0 grid place-items-center bg-[#f5faf7]/80 backdrop-blur-sm">
          <div className="flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-2 text-[12px] font-medium text-ink-soft shadow-sm">
            <ScanLine size={15} className="animate-pulse text-primary" aria-hidden />
            Loading 3D anatomy · {loading}%
          </div>
        </div>
      ) : null}
      {failed ? (
        <div className="absolute inset-0 grid place-items-center p-6 text-center">
          <div>
            <p className="text-[14px] font-semibold text-ink">The 3D body could not load</p>
            <p className="mt-1 text-[12px] leading-5 text-ink-soft">The recorded areas below are still available. Reload the page to try the model again.</p>
          </div>
        </div>
      ) : null}
      <div data-3d-overlay className="pointer-events-none absolute left-3 top-3 flex items-center gap-1.5 rounded-full border border-line bg-surface/90 px-2.5 py-1 text-[11px] font-semibold text-ink-soft shadow-sm backdrop-blur">
        <Box size={12} aria-hidden /> 3D reference anatomy
      </div>
      <div data-3d-overlay className="absolute right-2 top-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setAutoRotate((current) => !current)}
          className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-line bg-surface/90 px-2 text-[11px] font-medium text-ink-soft shadow-sm backdrop-blur hover:bg-surface"
          aria-pressed={autoRotate}
        >
          {autoRotate ? <RotateCw size={12} aria-hidden /> : <RotateCcw size={12} aria-hidden />}
          {autoRotate ? 'Stop' : 'Rotate'}
        </button>
        <button
          type="button"
          onClick={reset}
          className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-line bg-surface/90 px-2 text-[11px] font-medium text-ink-soft shadow-sm backdrop-blur hover:bg-surface"
        >
          <RotateCcw size={12} aria-hidden /> Reset
        </button>
      </div>
    </div>
    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] text-ink-soft">
      <span>Drag to rotate · scroll to zoom · click an organ</span>
      <span className="font-semibold text-ink">{hover ? LABELS[hover] : 'Whole body'}</span>
    </div>
    </div>
  );
}
