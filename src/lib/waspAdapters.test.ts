import { BoxGeometry, Mesh, MeshBasicMaterial, PerspectiveCamera, Scene } from 'three';
import { setAggregationPartCount, applyAggregationColors, frameVisualizerToScene, updateVisualizerCameraConstraints } from './waspAdapters';

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
  it('keeps random instance colors stable through growth and restores the chosen uniform color', async () => {
    const sharedMaterial = new MeshBasicMaterial();
    const source = { name: 'A', geo: new Mesh(new BoxGeometry(), sharedMaterial) };
    const makePart = () => ({ name: 'A', geo: new Mesh(new BoxGeometry(), sharedMaterial) });
    const first = { ...makePart(), id: 1 };
    const second = makePart();
    const aggregation = {
      parts: { A: source },
      aggregated_parts: [first, second],
      modifyParts: vi.fn(async () => { aggregation.aggregated_parts.push(makePart()); }),
    };
    const renderedMesh = first.geo.clone();
    renderedMesh.name = 'A_1';
    const scene = new Scene();
    scene.add(renderedMesh);
    const random = vi.spyOn(Math, 'random').mockReturnValueOnce(0).mockReturnValueOnce(0.5).mockReturnValue(0.75);
    try {
      applyAggregationColors(aggregation, { randomPerInstance: true, byPart: { A: '#123456' } }, { scene });
      const firstColor = first.geo.material.color.getHexString();
      expect(firstColor).not.toBe(second.geo.material.color.getHexString());
      expect(first.geo.material).not.toBe(sharedMaterial);
      expect(renderedMesh.material).toBe(first.geo.material);
      expect(source.geo.material.color.getHexString()).toBe('123456');

      await setAggregationPartCount(aggregation, 3, {});
      expect(first.geo.material.color.getHexString()).toBe(firstColor);
      expect(aggregation.aggregated_parts[2].geo.material.color.getHexString()).not.toBe('123456');

      applyAggregationColors(aggregation, { randomPerInstance: false, byPart: { A: '#abcdef' } });
      expect(aggregation.aggregated_parts.every((part) => part.geo.material.color.getHexString() === 'abcdef')).toBe(true);
      await setAggregationPartCount(aggregation, 4, {});
      expect(aggregation.aggregated_parts[3].geo.material.color.getHexString()).toBe('abcdef');
    } finally {
      random.mockRestore();
    }
  });

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
