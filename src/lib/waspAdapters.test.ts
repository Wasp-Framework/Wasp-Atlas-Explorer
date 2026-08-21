import { BoxGeometry, Mesh, MeshBasicMaterial, PerspectiveCamera, Scene } from 'three';
import { applyAggregationColors, frameVisualizerToScene, updateVisualizerCameraConstraints } from './waspAdapters';

describe('waspAdapters camera helpers', () => {
  it('derives camera constraints from visible scene bounds and ignores ghost overlays', () => {
    const scene = new Scene();
    const mesh = new Mesh(new BoxGeometry(10, 20, 30), new MeshBasicMaterial());
    mesh.position.set(5, 0, 0);
    scene.add(mesh);

    const ghostGroup = new Mesh(new BoxGeometry(1000, 1000, 1000), new MeshBasicMaterial());
    ghostGroup.name = '__atlas_ghost_group__';
    scene.add(ghostGroup);

    const camera = new PerspectiveCamera(50, 1, 0.1, 1000);
    const visualizer = {
      scene,
      camera,
      cameraControls: {
        minDistance: 0,
        maxDistance: 0,
        setLookAt: vi.fn(),
      },
    };

    frameVisualizerToScene(visualizer, 1);
    updateVisualizerCameraConstraints(visualizer);

    expect(visualizer.cameraControls.setLookAt).toHaveBeenCalled();
    expect(visualizer.cameraControls.minDistance).toBeGreaterThan(0.25);
    expect(visualizer.cameraControls.maxDistance).toBeGreaterThan(visualizer.cameraControls.minDistance);
    expect(visualizer.camera.near).toBeGreaterThanOrEqual(0.01);
    expect(visualizer.camera.far).toBeGreaterThan(250);
  });
});

describe('applyAggregationColors', () => {
  it('applies part colors to catalog parts and restored aggregated parts', () => {
    const sourceMesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
    const restoredMesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
    const aggregation = {
      parts: {
        A: { name: 'A', geo: sourceMesh },
      },
      aggregated_parts: [
        { name: 'A', geo: restoredMesh },
      ],
    };

    applyAggregationColors(aggregation, { byPart: { A: '#ff1178' } });

    expect((sourceMesh.material as MeshBasicMaterial).color.getHexString()).toBe('ff1178');
    expect((restoredMesh.material as MeshBasicMaterial).color.getHexString()).toBe('ff1178');
  });

  it('colors material arrays and creates a material when uploaded geometry has none', () => {
    const firstMaterial = new MeshBasicMaterial();
    const secondMaterial = new MeshBasicMaterial();
    const arrayMesh = new Mesh(new BoxGeometry(1, 1, 1), [firstMaterial, secondMaterial]);
    const missingMaterialMesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial()) as any;
    missingMaterialMesh.material = null;

    const aggregation = {
      parts: {
        A: { name: 'A', geo: arrayMesh },
        B: { name: 'B', geo: missingMaterialMesh },
      },
      aggregated_parts: [],
    };

    applyAggregationColors(aggregation, { byPart: { A: '#00f5d4', B: '#7b61ff' } });

    expect(firstMaterial.color.getHexString()).toBe('00f5d4');
    expect(secondMaterial.color.getHexString()).toBe('00f5d4');
    expect(missingMaterialMesh.material.color.getHexString()).toBe('7b61ff');
  });

  it('uses the source part palette index for matching aggregated parts', () => {
    const sourceA = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
    const sourceB = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
    const restoredB = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
    const aggregation = {
      parts: {
        A: { name: 'A', geo: sourceA },
        B: { name: 'B', geo: sourceB },
      },
      aggregated_parts: [
        { name: 'B', geo: restoredB },
      ],
    };

    applyAggregationColors(aggregation, { colors: ['#ff0000', '#00ff00'] });

    expect((sourceA.material as MeshBasicMaterial).color.getHexString()).toBe('ff0000');
    expect((sourceB.material as MeshBasicMaterial).color.getHexString()).toBe('00ff00');
    expect((restoredB.material as MeshBasicMaterial).color.getHexString()).toBe('00ff00');
  });
});
