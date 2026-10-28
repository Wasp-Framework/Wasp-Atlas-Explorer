import { Box3, BoxGeometry, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { Aggregation, AdvancedPart, Attribute, Collider, Connection, Part, PartCatalog, Plane, Rule, SmartAttribute } from 'webwaspjs';
import { exportAggregationData, growToTarget, loadUploadedDataset } from './buildRuntime';
import { readBuildStatus, removePartById } from './waspAdapters';
import { sanitizeUploadedAggregationData } from './uploadSanitizer';

function fresh(catalog: any = null, advanced = false) {
  const mesh = new Mesh(new BoxGeometry(.8, .8, .8), new MeshStandardMaterial());
  const connections = [1, -1].map(side => new Connection(
    new Plane(new Vector3(side * .5, 0, 0), new Vector3(0, 1, 0), new Vector3(side, 0, 0)), 'x', 'A', 0));
  const collider = new Collider([mesh.clone()]);
  const part = advanced ? new AdvancedPart('A', mesh, connections, collider, [], null, [])
    : new Part('A', mesh, connections, collider, [], 100);
  const a = new Aggregation('upgrade', [part], [new Rule('A', 0, 'A', 1)], 42, 0, catalog);
  // State and inventory checks are separate from the real geometry checks below.
  a.coll_check = false;
  return a;
}
const viewer = () => ({ addEntity: vi.fn(), removeEntity: vi.fn() });

it('retains finite stock through upload/growth/export/reload and leaf refund', async () => {
  const source = fresh(new PartCatalog(['A'], [2]));
  const { aggregation: a } = await loadUploadedDataset({ aggregationData: source.toData(false) });
  await growToTarget(a, 5, viewer());
  expect(readBuildStatus(a, 5)).toMatchObject({actualCount:2, remainingStock:{A:0}});
  expect(readBuildStatus(a, 5).message).toContain('No stock');
  expect(a.getValidPlacementsForPart('A')).toHaveLength(0);
  const restored = (await loadUploadedDataset({aggregationData:exportAggregationData(a)})).aggregation;
  expect(restored.catalog.dict.A).toBe(0);
  expect(removePartById(restored, restored.aggregated_parts[0].id)).toBe(false);
  const leaf = restored.aggregated_parts[1];
  expect(removePartById(restored, leaf.id, viewer())).toBe(true);
  expect(restored.catalog.dict.A).toBe(1);
  await growToTarget(restored, 2, viewer());
  expect(restored.aggregated_parts).toHaveLength(2);
  expect(restored.catalog.dict.A).toBe(0);
});

it('does not label no-rule limits as stock exhaustion', async () => {
  const a = fresh(new PartCatalog(['A'], [10]));
  a.placeFirstPart('A');
  a.setActivePartTypes([]);
  await growToTarget(a, 2, viewer());
  expect(readBuildStatus(a, 2).actualCount).toBe(1);
  expect(readBuildStatus(a, 2).message).not.toContain('No stock');
  expect(readBuildStatus(a, 2).remainingStock).toEqual({ A: 9 });
});

it('keeps unlimited catalog weights distinct from finite stock', () => {
  const a = fresh(new PartCatalog(['A'], [0], false, false));
  expect(readBuildStatus(a, 2).remainingStock).toBeUndefined();
  expect(readBuildStatus(a, 2).message).not.toContain('No stock');
});

it.each([true, false])('preserves posed geometry, exact IDs and attributes through Full=%s upload and continued placement', async full => {
  const a = fresh();
  a.coll_check = true;
  a.parts.A.attributes = [new Attribute('label', ['demo'], false).toData(),
    new SmartAttribute('state', ['free'], false, [], []).toData(),
    new Attribute('anchor', [{type:'Point',valid:true,value:[0,0,0]}], true).toData()];
  expect(a.placeFirstPart('A').success).toBe(true);
  expect(a.placePartAtConnection(0, 0, 'A', 1).success).toBe(true);
  const raw = a.toData(full);
  const first = raw.aggregated_parts['0'];
  const second = raw.aggregated_parts['1'];
  first.id = '42-beam_with_underscores'; first.children = ['next_part'];
  second.id = 'next_part'; second.parent = first.id;
  raw.aggregated_parts = { [first.id]: first, [second.id]: second };
  raw.aggregated_parts_sequence = [first.id, second.id];
  raw.graph = {};
  const original = JSON.stringify(raw);
  const { aggregation: restored } = await loadUploadedDataset({ aggregationData: raw });
  expect(restored.aggregated_parts.map((p: any) => p.id)).toEqual([first.id, second.id]);
  const beforeBounds = new Box3().setFromObject(a.aggregated_parts[1].geo);
  const afterBounds = new Box3().setFromObject(restored.aggregated_parts[1].geo);
  expect(afterBounds.min.distanceTo(beforeBounds.min)).toBeLessThan(1e-6);
  expect(afterBounds.max.distanceTo(beforeBounds.max)).toBeLessThan(1e-6);
  expect(restored.aggregated_parts[1].attributes).toEqual(a.aggregated_parts[1].attributes);
  expect(restored.aggregated_parts[1].attributes[2].values[0].value).toEqual([1, 0, 0]);
  expect(restored.graph.countEdges()).toBe(1);
  expect(restored.placePartAtConnection(second.id, 0, 'A', 1).success).toBe(true);
  expect(JSON.stringify(raw)).toBe(original);
});

it('retains the supported AdvancedPart definition and rejects unsupported constraints', async () => {
  const raw = fresh(null, true).toData();
  const { aggregation } = await loadUploadedDataset({ aggregationData: raw });
  expect(aggregation.parts.A).toBeInstanceOf(AdvancedPart);
  raw.global_constraints = [{ class_type: 'Plane_Constraint' }];
  await expect(loadUploadedDataset({ aggregationData: raw })).rejects.toThrow(/Global constraints/);
  expect(sanitizeUploadedAggregationData(raw).aggregationData.global_constraints).toEqual(raw.global_constraints);
});
