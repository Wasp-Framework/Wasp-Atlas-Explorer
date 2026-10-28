import { Aggregation } from 'webwaspjs';
import { sanitizeUploadedAggregationData } from './uploadSanitizer';

describe('sanitizeUploadedAggregationData', () => {
  it('retains unsupported semantics for core rejection instead of deleting them', () => {
    const rawData = {
      parts: [{ class_type: 'MeshConstraint', name: 'Unsupported' }],
      global_constraints: [{ type: 'MeshConstraint' }],
      catalog: { foo: 'bar' },
    };
    const before = JSON.stringify(rawData);
    const { aggregationData, warnings } = sanitizeUploadedAggregationData(rawData);
    expect(aggregationData.parts).toEqual(rawData.parts);
    expect(aggregationData.global_constraints).toEqual(rawData.global_constraints);
    expect(aggregationData.catalog).toEqual(rawData.catalog);
    expect(warnings).toEqual([]);
    expect(JSON.stringify(rawData)).toBe(before);
    expect(() => Aggregation.fromData(aggregationData)).toThrow();
  });

  it('removes Field data only from the opened copy with a conversion notice', () => {
    const raw = { mode: 2, parts: [], rules: [], field: [{ name: 'authored field' }] };
    const { aggregationData, warnings } = sanitizeUploadedAggregationData(raw);
    expect(aggregationData.mode).toBe(0);
    expect(aggregationData.field).toBeNull();
    expect(raw.field).toEqual([{ name: 'authored field' }]);
    expect(warnings.join(' ')).toContain('Field data was removed');
    expect(Aggregation.fromData(aggregationData).mode).toBe(0);
  });

  it('opens an independent Mode-0 copy while preserving other authored data', () => {
    const raw = { mode: 2, parts: [], rules: [], extra: { producer: 'GH' } };
    const { aggregationData, warnings } = sanitizeUploadedAggregationData(raw);
    expect(aggregationData.mode).toBe(0);
    expect(raw.mode).toBe(2);
    expect(aggregationData.extra).toEqual(raw.extra);
    expect(warnings.join(' ')).toContain('Mode 0 instead of Mode 2');
    expect(Aggregation.fromData(aggregationData).mode).toBe(0);
  });

  it('normalizes Wasp serialized uploads without stripping supported aggregation state', () => {
    const rawData = {
      name: 'Uploaded export',
      parts: {
        a: { class_type: 'Part', name: 'Beam' },
      },
      aggregated_parts: {
        '0': { id: 0, name: 'Beam' },
      },
      aggregated_parts_sequence: [0],
    };

    const result = sanitizeUploadedAggregationData(rawData);

    expect(result.aggregationData).toEqual({
      object_type: 'Aggregation',
      name: 'Uploaded export',
      parts: [{ class_type: 'Part', name: 'Beam' }],
      rules: [],
      global_constraints: [],
      catalog: null,
      mode: 0,
      coll_check: true,
      field: null,
      graph: {},
      aggregated_parts: {
        '0': { id: 0, name: 'Beam' },
      },
      aggregated_parts_sequence: [0],
    });
    expect(result.warnings).toEqual([]);
  });

  it('accepts webwaspjs 0.3.10 serialized aggregation payloads', () => {
    const rawData = {
      object_type: 'Aggregation',
      name: 'Direct upload check',
      parts: [],
      rules: [],
      rnd_seed: 7,
      global_constraints: [],
      catalog: null,
      mode: 0,
      coll_check: true,
      field: null,
      graph: {},
      include_aggr_geo: false,
      aggregated_parts: {},
      aggregated_parts_sequence: [],
    };

    const { aggregationData, warnings } = sanitizeUploadedAggregationData(rawData);
    const aggregation = Aggregation.fromData(aggregationData);

    expect(aggregation.name).toBe('Direct upload check');
    expect(typeof aggregation.toData).toBe('function');
    expect(warnings).toEqual([]);
  });

  it('rejects the legacy compact aggregation export format with a clear error', () => {
    const rawData = {
      aggregation_name: 'Legacy compact export',
      parts: {
        a: { class_type: 'Part', name: 'Beam' },
      },
    };

    expect(() => sanitizeUploadedAggregationData(rawData)).toThrow(
      'This file uses the compact aggregation export format and cannot be uploaded here. Use a Wasp serialized aggregation file or re-download the dataset from the build screen.',
    );
  });
});
