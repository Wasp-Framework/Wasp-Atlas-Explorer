import {
  createAggregationFromData,
  getAggregationCatalogParts,
} from 'webwaspjs';
import {
  applyAggregationColors,
  setAggregationPartCount,
  frameVisualizerToScene,
  updateVisualizerCameraConstraints,
} from './waspAdapters';

export const aggregationService = {
  createAggregationFromData,
  getAggregationCatalogParts,
  applyAggregationColors,
  setAggregationPartCount,
  frameVisualizerToScene,
  updateVisualizerCameraConstraints,
};

export function centerCameraOnMesh(viz: any, mesh: any, distanceScale = 3) {
  const geom = mesh.geometry;
  if (!geom.boundingSphere) {
    geom.computeBoundingSphere();
  }
  const sphere = geom.boundingSphere;
  const radius = sphere.radius || 1;
  const center = sphere.center.clone().applyMatrix4(mesh.matrixWorld);
  const distance = radius * distanceScale;

  viz.camera.position.set(center.x + distance, center.y + distance, center.z + distance);
  if (viz.cameraControls) {
    viz.cameraControls.minDistance = Math.max(radius * 0.08, 0.25);
    viz.cameraControls.maxDistance = Math.max(radius * 24, viz.cameraControls.minDistance * 3);
    viz.cameraControls.setLookAt(
      center.x + distance,
      center.y + distance,
      center.z + distance,
      center.x,
      center.y,
      center.z,
      false
    );
  } else {
    viz.camera.lookAt(center);
  }

  viz.camera.near = Math.max(radius * 0.0025, 0.01);
  viz.camera.far = Math.max(radius * 160, 250);
  viz.camera.updateProjectionMatrix?.();
}
