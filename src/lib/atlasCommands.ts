/** Commands over the live Atlas assembly; uses the same editing helpers as the UI. */
import { Box3, Vector3 } from 'three';
import { transformToData } from 'webwaspjs';
import {
  exportAggregationData,
  frameScene,
  placeFirstPartManually,
  placePartManually,
  removePartById,
} from './buildRuntime';
import { readBuildStatus } from './waspAdapters';

function page(items: any[], args: any, project = (item: any) => item) {
  const offset = args.offset ?? 0;
  const limit = args.limit ?? 20;
  return {
    items: items.slice(offset, offset + limit).map(project),
    total: items.length,
    nextOffset: offset + limit < items.length ? offset + limit : null,
  };
}

function partRecord(part: any) {
  return {
    id: part.id,
    name: part.name,
    parent: part.parent,
    children: [...part.children],
    center: part.center.toArray(),
    transform: transformToData(part.transformation),
    activeConnections: [...part.active_connections],
    connections: part.connections.map((connection: any) => connection.toData()),
  };
}

/** Camera coordinates use dataset units. Presets use Z up, with Y up for top/bottom. */
function setCamera(aggregation: any, viz: any, args: any) {
  const camera = viz.camera;
  const controls = viz.cameraControls;
  if (args.view && args.camera) throw new Error('Choose a preset or a custom camera.');
  if (args.view) {
    const directions: Record<string, number[]> = {
      isometric: [1, -1, 1],
      front: [0, -1, 0],
      back: [0, 1, 0],
      left: [-1, 0, 0],
      right: [1, 0, 0],
      top: [0, 0, 1],
      bottom: [0, 0, -1],
    };
    if (!directions[args.view]) throw new Error('Unknown camera preset.');
    const bounds = new Box3();
    for (const part of aggregation.aggregated_parts) bounds.expandByObject(part.geo);
    if (bounds.isEmpty()) throw new Error('Place a part before fitting the camera.');
    const target = bounds.getCenter(new Vector3());
    const radius = bounds.getSize(new Vector3()).length() / 2 || 1;
    const halfFov = Math.min(Math.PI / 8, Math.atan(Math.tan(Math.PI / 8) * camera.aspect));
    const position = new Vector3(...(directions[args.view] as [number, number, number]))
      .normalize()
      .multiplyScalar((radius / Math.sin(halfFov)) * 1.1)
      .add(target);
    args = {
      camera: {
        position: position.toArray(),
        target: target.toArray(),
        up: ['top', 'bottom'].includes(args.view) ? [0, 1, 0] : [0, 0, 1],
        fov: 45,
      },
    };
  }
  if (args.camera) {
    const { position, target, up = [0, 0, 1], fov = 45 } = args.camera;
    if (
      ![position, target, up].every(
        (v) => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite),
      ) ||
      !(fov > 0 && fov < 180)
    ) {
      throw new Error('Invalid camera coordinates or field of view.');
    }
    const direction = new Vector3(...target).sub(new Vector3(...position));
    const upVector = new Vector3(...up);
    if (
      !direction.lengthSq() ||
      !upVector.lengthSq() ||
      direction.clone().normalize().cross(upVector.clone().normalize()).lengthSq() < 1e-12
    ) {
      throw new Error(
        'Camera position/target must differ and up must not be parallel to the viewing direction.',
      );
    }
    camera.up.copy(upVector.normalize());
    controls?.updateCameraUp?.();
    camera.fov = fov;
    camera.updateProjectionMatrix();
    if (controls) {
      // Explicit agent cameras may be closer/further than the mouse navigation limits.
      const distance = direction.length();
      controls.minDistance = Math.min(controls.minDistance, distance);
      controls.maxDistance = Math.max(controls.maxDistance, distance);
      controls.setLookAt(...position, ...target, false);
    } else {
      camera.position.set(...position);
      camera.lookAt(...target);
    }
  }
  controls?.update(0);
  viz.renderer.render(viz.scene, camera);
  const target = controls?.getTarget(new Vector3()) ?? new Vector3();
  return {
    position: camera.position.toArray(),
    target: target.toArray(),
    up: camera.up.toArray(),
    fov: camera.fov,
  };
}

export function runAtlasCommand(
  command: string,
  args: any,
  context: {
    aggregation: any;
    visualizer: any;
    onEdit: () => void;
  },
) {
  const { aggregation: agg, visualizer: viz, onEdit } = context;
  if (!agg || !viz) throw new Error('The assembly viewer is not ready.');
  switch (command) {
    case 'inspect_assembly': {
      if (!args.view || args.view === 'summary')
        return {
          name: agg.name,
          partCount: agg.aggregated_parts.length,
          basePartCount: agg.getBaseParts().length,
          ruleCount: agg.rules.length,
          ...readBuildStatus(agg),
        };
      if (args.view === 'rules') return page(agg.rules, args, (rule: any) => rule.toData());
      const parts = args.view === 'base_parts' ? agg.getBaseParts() : agg.aggregated_parts;
      return page(
        parts.filter(
          (part: any) =>
            (args.partName === undefined || part.name === args.partName) &&
            (args.partId === undefined || part.id === args.partId),
        ),
        args,
        partRecord,
      );
    }
    case 'preview_placements':
      return page(
        agg.getValidPlacementsAtConnection(args.partName, args.parentPartId, args.connectionId),
        args,
        (p: any) => ({
          partName: p.partName,
          parentPartId: p.parentPartId,
          connectionId: p.connectionId,
          connectionBId: p.connectionBId,
          transform: transformToData(p.transform),
          connections: p.transformedPart.connections.map((c: any) => c.toData()),
        }),
      );
    case 'place_part': {
      const attachment = [args.parentPartId, args.connectionId, args.connectionBId];
      const seed = attachment.every((value) => value === undefined);
      if (!seed && attachment.some((value) => value === undefined))
        throw new Error('Supply all three attachment IDs.');
      if (seed && agg.aggregated_parts.length)
        throw new Error('A seed requires an empty assembly.');
      const result = seed
        ? placeFirstPartManually(agg, args.partName, viz)
        : placePartManually(
            agg,
            args.parentPartId,
            args.connectionId,
            args.partName,
            args.connectionBId,
            viz,
          );
      if (!result.success) throw new Error(result.error || 'Placement rejected by WaspJS.');
      onEdit();
      if (seed) frameScene(viz);
      return partRecord(result.part);
    }
    case 'remove_part':
      if (!removePartById(agg, args.partId, viz))
        throw new Error('Removal rejected: select an existing leaf part.');
      onEdit();
      return { removedPartId: args.partId, partCount: agg.aggregated_parts.length };
    case 'export_assembly':
      return exportAggregationData(agg);
    case 'snapshot_viewer': {
      const camera = setCamera(agg, viz, args);
      const canvas = viz.renderer.domElement;
      // Render and copy in one browser task so image and metadata describe the same state.
      return {
        camera,
        partCount: agg.aggregated_parts.length,
        width: canvas.width,
        height: canvas.height,
        png: canvas.toDataURL('image/png').split(',')[1],
      };
    }
    default:
      throw new Error(`Unknown Atlas command: ${command}`);
  }
}
