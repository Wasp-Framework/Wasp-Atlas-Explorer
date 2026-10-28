import { BoxGeometry, Mesh, MeshStandardMaterial, PerspectiveCamera, Scene } from 'three';
import { applyColors } from './buildRuntime';
import { applyAggregationColors, placePartManually } from './waspAdapters';
import { addGhostMeshes, clearGhostMeshes, highlightGhost, unhighlightGhosts, raycastParts } from './viewerInteraction';

it.each(['42-beam_with_underscores', 42, '42'])('picks the exact authored ID %s without parsing mesh names', id => {
  const mesh = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
  mesh.name = 'irrelevant_99';
  mesh.userData.partId = id;
  const scene = new Scene(); scene.add(mesh); scene.updateMatrixWorld(true);
  const camera = new PerspectiveCamera(50, 1, .1, 100); camera.position.z = 5; camera.updateMatrixWorld();
  const viz = { scene, camera, renderer: {domElement: {getBoundingClientRect: () => ({left:0,top:0,width:100,height:100})}} };
  expect(raycastParts(viz, {clientX:50,clientY:50})?.partId).toBe(id);
  delete mesh.userData.partId;
  expect(raycastParts(viz, {clientX:50,clientY:50})?.partId).toBeNull();
});

it('previews random colors, preserves the placed color, and updates existing previews when colors change', () => {
  const source = { name: 'A', geo: new Mesh(new BoxGeometry(), new MeshStandardMaterial()) };
  const previewPart = { geo: source.geo.clone() };
  const placedPart = { name: 'A', id: 1, geo: source.geo.clone() };
  const aggregation = {
    parts: { A: source },
    aggregated_parts: [] as any[],
    placePartAtConnection: () => {
      aggregation.aggregated_parts.push(placedPart);
      return { success: true, part: placedPart };
    },
  };
  const viz = { scene: new Scene(), addEntity: vi.fn() };
  const placement = { transformedPart: previewPart, partName: 'A', parentPartId: 0, connectionId: 0, connectionBId: 0 };
  applyAggregationColors(aggregation, { randomPerInstance: true, byPart: { A: '#123456' } });
  addGhostMeshes(viz, [placement], aggregation);
  const ghost = viz.scene.getObjectByName('__ghost_0') as Mesh<BoxGeometry, MeshStandardMaterial>;
  const previewColor = ghost.material.color.getHexString();
  expect(previewColor).not.toBe('123456');
  expect(source.geo.material.color.getHexString()).toBe('123456');
  highlightGhost(viz, 0);
  expect(ghost.material.opacity).toBe(1);
  expect(ghost.material.color.getHexString()).toBe(previewColor);

  placePartManually(aggregation, 0, 0, 'A', 0, viz, previewPart);
  expect(placedPart.geo.material.color.getHexString()).toBe(previewColor);

  applyColors(aggregation, { randomPerInstance: false, byPart: { A: '#abcdef' } }, viz);
  expect(ghost.material.color.getHexString()).toBe('abcdef');
  expect(ghost.material.opacity).toBe(1);
  applyColors(aggregation, { randomPerInstance: true, byPart: { A: '#abcdef' } }, viz);
  expect(ghost.material.color.getHexString()).toBe(previewColor);
  unhighlightGhosts(viz);
  expect(ghost.material.opacity).toBe(0.3);
  expect(ghost.geometry).not.toBe(source.geo.geometry);
  clearGhostMeshes(viz);
});

it('supports previews of parts with multiple materials', () => {
  const mesh = new Mesh(new BoxGeometry(), [new MeshStandardMaterial(), new MeshStandardMaterial()]);
  const viz = { scene: new Scene() };
  const aggregation = { parts: { A: { name: 'A', geo: mesh } }, aggregated_parts: [] };
  applyAggregationColors(aggregation, { byPart: { A: '#123456' } });
  addGhostMeshes(viz, [{ transformedPart: { geo: mesh }, partName: 'A', parentPartId: 0, connectionId: 0, connectionBId: 0 }], aggregation);
  const ghost = viz.scene.getObjectByName('__ghost_0') as Mesh<BoxGeometry, MeshStandardMaterial[]>;
  highlightGhost(viz, 0);
  expect(ghost.material.every((material) => material.opacity === 1 && material.color.getHexString() === '123456')).toBe(true);
  unhighlightGhosts(viz);
  expect(ghost.material.every((material) => material.opacity === 0.3)).toBe(true);
  expect(mesh.material.every((material) => material.opacity === 1)).toBe(true);
  clearGhostMeshes(viz);
});
