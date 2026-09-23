import { DEFAULT_NEON_RAINBOW_PALETTE } from './defaultColors';
import { Box3, MeshStandardMaterial, Sphere, Vector3 } from 'three';

export type AggregationColors = {
  randomPerInstance?: boolean;
  colors?: string[];
  palette?: string[];
  byPart?: Record<string, string>;
};

const aggregationColorConfigs = new WeakMap<object, AggregationColors>();
const instanceColors = new WeakMap<object, string>();
const isolatedGeometry = new WeakSet<object>();

function getRandomInstanceColor(part: object) {
  if (!instanceColors.has(part)) {
    instanceColors.set(part, DEFAULT_NEON_RAINBOW_PALETTE[Math.floor(Math.random() * DEFAULT_NEON_RAINBOW_PALETTE.length)]);
  }
  return instanceColors.get(part)!;
}

export function getPartPreviewColor(aggregation: any, partName: string, previewPart: object) {
  const config = aggregationColorConfigs.get(aggregation);
  if (config?.randomPerInstance) return getRandomInstanceColor(previewPart);
  const material = aggregation?.parts?.[partName]?.geo?.material;
  const sourceColor = (Array.isArray(material) ? material[0] : material)?.color;
  return config?.byPart?.[partName] || (sourceColor ? `#${sourceColor.getHexString()}` : undefined);
}

function refreshAggregationColors(aggregation: any, visualizer?: any) {
  applyAggregationColors(aggregation, aggregationColorConfigs.get(aggregation), visualizer);
}

function applyColorToMaterial(material: any, color: string) {
  if (!material) return;
  if (Array.isArray(material)) {
    material.forEach((entry) => applyColorToMaterial(entry, color));
    return;
  }
  if (material.color?.set) {
    material.color.set(color);
  }
}

function applyColorToPartGeometry(part: any, color: string) {
  if (!part?.geo || !color) return;

  if (!part.geo.material) {
    part.geo.material = new MeshStandardMaterial({ color, roughness: 0.5 });
    return;
  }

  applyColorToMaterial(part.geo.material, color);
}

export function applyAggregationColors(aggregation: any, colorsConfig: AggregationColors | null | undefined, visualizer?: any) {
  if (!aggregation || !colorsConfig) return;
  aggregationColorConfigs.set(aggregation, colorsConfig);
  const palette = colorsConfig.colors || colorsConfig.palette || [];
  const byPart = colorsConfig.byPart || {};
  const sourceParts = Object.values(aggregation?.parts || {});
  const partPaletteIndexes = new Map<string, number>();
  sourceParts.forEach((part: any, index) => {
    if (part?.name && !partPaletteIndexes.has(part.name)) {
      partPaletteIndexes.set(part.name, index);
    }
  });
  const instances = new Set(aggregation.aggregated_parts || []);
  const parts = [
    ...sourceParts,
    ...(Array.isArray(aggregation?.aggregated_parts) ? aggregation.aggregated_parts : []),
  ];
  const seenParts = new Set<any>();

  parts.forEach((part: any, idx: number) => {
    if (!part || seenParts.has(part)) return;
    seenParts.add(part);
    const paletteIndex = partPaletteIndexes.get(part.name) ?? idx;
    let color = byPart[part.name] || palette[paletteIndex % palette.length];
    if (colorsConfig.randomPerInstance && instances.has(part)) {
      color = getRandomInstanceColor(part);
      // Imported or transformed meshes may share materials with the source.
      if (part.geo?.material && !isolatedGeometry.has(part.geo)) {
        part.geo.material = Array.isArray(part.geo.material)
          ? part.geo.material.map((material: any) => material.clone())
          : part.geo.material.clone();
        isolatedGeometry.add(part.geo);
      }
    }
    applyColorToPartGeometry(part, color);
    const renderedMesh = visualizer?.scene?.getObjectByName(`${part.name}_${part.id}`);
    if (renderedMesh && part.geo?.material) renderedMesh.material = part.geo.material;
  });
}

export async function setAggregationPartCount(aggregation: any, targetCount: number, visualizer: any) {
  if (!aggregation || !visualizer) return;
  await aggregation.modifyParts(targetCount, visualizer);
  refreshAggregationColors(aggregation, visualizer);
  updateVisualizerCameraConstraints(visualizer);
}

function getSceneBoundsExcludingGhosts(visualizer: any) {
  const box = new Box3();
  if (!visualizer?.scene) return box;

  visualizer.scene.updateMatrixWorld?.(true);

  visualizer.scene.children.forEach((child: any) => {
    if (!child || child.name === '__atlas_ghost_group__') return;
    box.expandByObject(child);
  });

  return box;
}

export function updateVisualizerCameraConstraints(visualizer: any) {
  if (!visualizer?.scene || !visualizer?.camera) return;

  const box = getSceneBoundsExcludingGhosts(visualizer);
  if (!isFinite(box.max.x) || box.isEmpty()) return;

  const sphere = box.getBoundingSphere(new Sphere());
  const radius = Math.max(sphere.radius || 0, 0.5);
  const minDistance = Math.max(radius * 0.08, 0.25);
  const maxDistance = Math.max(radius * 24, minDistance * 3);
  const near = Math.max(radius * 0.0025, 0.01);
  const far = Math.max(radius * 160, 250);

  visualizer.camera.near = near;
  visualizer.camera.far = far;
  visualizer.camera.updateProjectionMatrix?.();

  if (visualizer.cameraControls) {
    visualizer.cameraControls.minDistance = minDistance;
    visualizer.cameraControls.maxDistance = maxDistance;
  }
}

export function frameVisualizerToScene(visualizer: any, distanceScale = 0.8) {
  if (!visualizer?.scene || !visualizer?.camera) return;

  const box = getSceneBoundsExcludingGhosts(visualizer);
  if (!isFinite(box.max.x) || box.isEmpty()) return;

  const size = box.getSize(new Vector3());
  const center = box.getCenter(new Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const distance = maxDim * distanceScale;

  visualizer.camera.position.set(center.x + distance, center.y + distance, center.z + distance);

  if (visualizer.cameraControls) {
    visualizer.cameraControls.setLookAt(
      center.x + distance,
      center.y + distance,
      center.z + distance,
      center.x,
      center.y,
      center.z,
      false
    );
  } else {
    visualizer.camera.lookAt(center);
  }

  updateVisualizerCameraConstraints(visualizer);
}

export function placeFirstPartManually(aggregation: any, partName: string, visualizer?: any) {
  if (!aggregation) return { success: false, error: 'No aggregation' };
  const result = aggregation.placeFirstPart(partName);
  if (result.success && visualizer) {
    refreshAggregationColors(aggregation, visualizer);
    visualizer.addEntity(result.part);
    updateVisualizerCameraConstraints(visualizer);
  }
  return result;
}

export function placePartManually(
  aggregation: any,
  parentPartId: number,
  connectionId: number,
  partName: string,
  connectionBId: number,
  visualizer?: any,
  previewPart?: object,
) {
  if (!aggregation) return { success: false, error: 'No aggregation' };
  const result = aggregation.placePartAtConnection(parentPartId, connectionId, partName, connectionBId);
  if (result.success && previewPart && aggregationColorConfigs.get(aggregation)?.randomPerInstance) {
    instanceColors.set(result.part, getRandomInstanceColor(previewPart));
  }
  if (result.success && visualizer) {
    refreshAggregationColors(aggregation, visualizer);
    visualizer.addEntity(result.part);
    updateVisualizerCameraConstraints(visualizer);
  }
  return result;
}

export function removePartById(aggregation: any, partId: number, visualizer?: any) {
  if (!aggregation) return false;
  const part = aggregation.aggregated_parts.find((p: any) => p.id === partId);
  if (!part) return false;
  if (part.children && part.children.length > 0) return false;
  if (visualizer) {
    visualizer.removeEntity(part);
    updateVisualizerCameraConstraints(visualizer);
  }
  return aggregation.removePartFromAggregation(partId);
}
