import {
  AmbientLight, Color, DirectionalLight, Mesh, MeshBasicMaterial,
  PerspectiveCamera, Scene, WebGLRenderer,
} from 'three';
import { centerCameraOnMesh } from './aggregationService';

// Only this module owns the renderer. Thumbnail canvases hold 2D snapshots,
// so catalog size never determines the number of WebGL contexts.
let renderer: WebGLRenderer | null = null;
let consumers = 0;

export function retainThumbnailRenderer() {
  consumers += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    consumers -= 1;
    if (consumers === 0 && renderer) {
      renderer.dispose();
      renderer.forceContextLoss();
      renderer = null;
    }
  };
}

export function renderThumbnail(
  canvas: HTMLCanvasElement, source: any, color: string, width: number, height: number,
) {
  if (!source?.geometry || consumers === 0) return;
  const context = canvas.getContext('2d');
  if (!context) return;

  const geometry = source.geometry.clone();
  const materials: any[] = [];
  try {
    const cloneMaterial = (material: any) => {
      const clone = material ? material.clone() : new MeshBasicMaterial();
      materials.push(clone);
      if (clone.color) clone.color = new Color(color);
      return clone;
    };
    const material = Array.isArray(source.material)
      ? source.material.map(cloneMaterial)
      : cloneMaterial(source.material);
    const mesh = new Mesh(geometry, material);
    mesh.rotation.copy(source.rotation);
    mesh.scale.copy(source.scale);
    mesh.position.copy(source.position);
    mesh.updateMatrixWorld(true);

    const scene = new Scene();
    const camera = new PerspectiveCamera(32, width / height, 0.01, 1000);
    const keyLight = new DirectionalLight(0xffffff, 1.5);
    keyLight.position.set(2.5, 3, 4);
    const rimLight = new DirectionalLight(0xffffff, 0.8);
    rimLight.position.set(-3, 2, -2);
    scene.add(mesh, new AmbientLight(0xffffff, 1.2), keyLight, rimLight);
    camera.up.set(0, 0, 1);
    centerCameraOnMesh({ camera, cameraControls: null }, mesh, 2.5);

    renderer ??= new WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setClearAlpha(0);
    renderer.setSize(width, height, false);
    renderer.render(scene, camera);
    // Copy synchronously before another thumbnail renders or WebGL clears its buffer.
    canvas.width = renderer.domElement.width;
    canvas.height = renderer.domElement.height;
    context.drawImage(renderer.domElement, 0, 0);
  } finally {
    geometry.dispose();
    // Clones may share textures with the source; those remain source-owned.
    materials.forEach((material) => material.dispose());
    renderer?.renderLists.dispose();
  }
}
