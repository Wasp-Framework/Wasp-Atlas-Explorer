import React from 'react';
import {
  AmbientLight,
  Color,
  DirectionalLight,
  Mesh,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three';
import { centerCameraOnMesh } from '../lib/aggregationService';

type Props = {
  source: any;
  color: string;
  label: string;
};

function clonePreviewMesh(source: any, color: string) {
  if (!source?.geometry) return null;

  const mesh = new Mesh(source.geometry.clone());
  if (Array.isArray(source.material)) {
    mesh.material = source.material.map((material: any) => {
      const nextMaterial = material.clone();
      if (nextMaterial.color) {
        nextMaterial.color = new Color(color);
      }
      return nextMaterial;
    });
  } else if (source.material) {
    mesh.material = source.material.clone();
    if (mesh.material.color) {
      mesh.material.color = new Color(color);
    }
  }

  mesh.rotation.copy(source.rotation);
  mesh.scale.copy(source.scale);
  mesh.position.copy(source.position);
  return mesh;
}

export function PartPreviewCanvas({ source, color, label }: Props) {
  const hostRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const host = hostRef.current;
    if (!host || !source) return undefined;

    const scene = new Scene();
    const camera = new PerspectiveCamera(32, 1, 0.01, 1000);
    const renderer = new WebGLRenderer({ antialias: true, alpha: true });
    const previewMesh = clonePreviewMesh(source, color);

    if (!previewMesh) return undefined;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setClearAlpha(0);
    renderer.domElement.style.pointerEvents = 'none';
    host.appendChild(renderer.domElement);

    const ambientLight = new AmbientLight(0xffffff, 1.2);
    const keyLight = new DirectionalLight(0xffffff, 1.5);
    keyLight.position.set(2.5, 3, 4);
    const rimLight = new DirectionalLight(0xffffff, 0.8);
    rimLight.position.set(-3, 2, -2);

    previewMesh.name = `${label}_preview`;
    scene.add(previewMesh, ambientLight, keyLight, rimLight);

    camera.up.set(0, 0, 1);
    centerCameraOnMesh({ camera, cameraControls: null }, previewMesh, 2.5);

    const render = () => {
      const width = host.clientWidth || 120;
      const height = host.clientHeight || 120;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    };

    render();

    const resizeObserver = new ResizeObserver(() => {
      render();
    });
    resizeObserver.observe(host);

    return () => {
      resizeObserver.disconnect();
      renderer.dispose();
      previewMesh.geometry?.dispose?.();
      if (Array.isArray(previewMesh.material)) {
        previewMesh.material.forEach((material: any) => material?.dispose?.());
      } else {
        previewMesh.material?.dispose?.();
      }
      host.removeChild(renderer.domElement);
    };
  }, [color, source]);

  return <div ref={hostRef} className="part-preview-canvas" aria-label={`${label} preview`} />;
}
