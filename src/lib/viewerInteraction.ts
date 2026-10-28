import { getPartPreviewColor } from './waspAdapters';
import { Group, Raycaster, Vector2 } from 'three';
import type { PartId } from '../state/buildState';

type GhostPlacement = {
  transformedPart: { geo: any };
  connectionId: number;
  parentPartId: PartId;
  partName: string;
  connectionBId: number;
};

type ViewerInteractionState = {
  raycaster: Raycaster;
  pointer: Vector2;
  ghostMeshes: any[];
  ghostData: GhostPlacement[];
  ghostGroup: Group;
};

const STATE_KEY = '__atlasViewerInteractionState';

function ensureInteractionState(visualizer: any): ViewerInteractionState | null {
  if (!visualizer?.scene) return null;

  if (!visualizer[STATE_KEY]) {
    const ghostGroup = new Group();
    ghostGroup.name = '__atlas_ghost_group__';
    visualizer.scene.add(ghostGroup);
    visualizer[STATE_KEY] = {
      raycaster: new Raycaster(),
      pointer: new Vector2(),
      ghostMeshes: [],
      ghostData: [],
      ghostGroup,
    };
  }

  return visualizer[STATE_KEY];
}

function getPointerState(visualizer: any, event: { clientX: number; clientY: number }) {
  const state = ensureInteractionState(visualizer);
  if (!state || !visualizer?.renderer || !visualizer?.camera) return null;

  const rect = visualizer.renderer.domElement.getBoundingClientRect();
  state.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  state.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  state.raycaster.setFromCamera(state.pointer, visualizer.camera);

  return state;
}

export function addGhostMeshes(visualizer: any, placements: GhostPlacement[], aggregation?: any) {
  const state = ensureInteractionState(visualizer);
  if (!state) return;

  clearGhostMeshes(visualizer);
  for (const placement of placements) {
    const mesh = placement.transformedPart.geo.clone();
    mesh.geometry = mesh.geometry.clone();
    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map((material: any) => material.clone())
      : mesh.material.clone();
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      material.transparent = true;
      material.opacity = 0.3;
      material.depthWrite = false;
    }
    mesh.name = `__ghost_${state.ghostMeshes.length}`;
    state.ghostGroup.add(mesh);
    state.ghostMeshes.push(mesh);
    state.ghostData.push(placement);
  }
  if (aggregation) updateGhostColors(visualizer, aggregation);
}

export function updateGhostColors(visualizer: any, aggregation: any) {
  const state = visualizer?.[STATE_KEY] as ViewerInteractionState | undefined;
  if (!state) return;
  state.ghostMeshes.forEach((mesh, index) => {
    const placement = state.ghostData[index];
    const color = getPartPreviewColor(aggregation, placement.partName, placement.transformedPart);
    if (!color) return;
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      material.color?.set(color);
    }
  });
}

export function clearGhostMeshes(visualizer: any) {
  const state = ensureInteractionState(visualizer);
  if (!state) return;

  for (const mesh of state.ghostMeshes) {
    state.ghostGroup.remove(mesh);
    mesh.geometry?.dispose?.();
    if (Array.isArray(mesh.material)) mesh.material.forEach((m: any) => m?.dispose?.());
    else mesh.material?.dispose?.();
  }

  state.ghostMeshes = [];
  state.ghostData = [];
}

export function getGhostCount(visualizer: any) {
  const state = ensureInteractionState(visualizer);
  return state?.ghostMeshes.length ?? 0;
}

export function getGhostPlacementData(visualizer: any, index: number) {
  const state = ensureInteractionState(visualizer);
  if (!state || index < 0 || index >= state.ghostData.length) return null;
  return state.ghostData[index] ?? null;
}

export function getGhostPlacements(visualizer: any) {
  const state = ensureInteractionState(visualizer);
  return state?.ghostData ?? [];
}

export function raycastParts(visualizer: any, event: { clientX: number; clientY: number }) {
  const state = getPointerState(visualizer, event);
  if (!state) return null;

  const meshes: any[] = [];
  visualizer.scene.traverse((obj: any) => {
    if (obj.isMesh && obj.parent !== state.ghostGroup) {
      meshes.push(obj);
    }
  });

  const intersects = state.raycaster.intersectObjects(meshes, false);
  if (intersects.length === 0) return null;

  const hit = intersects[0];
  const partId = hit.object.userData.partId;
  return { object: hit.object, point: hit.point,
    partId: typeof partId === 'number' || typeof partId === 'string' ? partId : null };
}

export function raycastGhosts(visualizer: any, event: { clientX: number; clientY: number }) {
  const state = getPointerState(visualizer, event);
  if (!state || state.ghostMeshes.length === 0) return null;

  const intersects = state.raycaster.intersectObjects(state.ghostMeshes, false);
  if (intersects.length === 0) return null;

  const hit = intersects[0];
  const index = state.ghostMeshes.indexOf(hit.object);

  return { index, data: state.ghostData[index] ?? null, point: hit.point };
}

export function highlightGhost(visualizer: any, index: number) {
  const state = ensureInteractionState(visualizer);
  if (!state) return;

  unhighlightGhosts(visualizer);
  if (index < 0 || index >= state.ghostMeshes.length) return;

  const materials = state.ghostMeshes[index].material;
  for (const material of Array.isArray(materials) ? materials : [materials]) {
    material.transparent = false;
    material.opacity = 1;
    material.depthWrite = true;
    if (material.emissive) {
      material.emissive.setHex(0x444444);
    }
  }
}

export function unhighlightGhosts(visualizer: any) {
  const state = ensureInteractionState(visualizer);
  if (!state) return;

  for (const mesh of state.ghostMeshes) {
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      material.transparent = true;
      material.opacity = 0.3;
      material.depthWrite = false;
      if (material.emissive) {
        material.emissive.setHex(0x000000);
      }
    }
  }
}

export function disposeViewerInteraction(visualizer: any) {
  const state = visualizer?.[STATE_KEY] as ViewerInteractionState | undefined;
  if (!state) return;

  clearGhostMeshes(visualizer);
  visualizer.scene?.remove?.(state.ghostGroup);
  delete visualizer[STATE_KEY];
}
