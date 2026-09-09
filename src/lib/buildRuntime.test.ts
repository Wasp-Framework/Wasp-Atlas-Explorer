// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { createAggregationFromData } from 'webwaspjs';
import {
  disposeVisualizer,
  downloadAggregationData,
  exportAggregationData,
  getAggregationDownloadFileName,
  initializeAggregationScene,
} from './buildRuntime';

describe('buildRuntime export helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exports aggregation data through webwaspjs toData(false)', () => {
    const toData = vi.fn(() => ({ object_type: 'Aggregation', name: 'demo', parts: [], rules: [] }));

    expect(exportAggregationData({ toData })).toEqual({ object_type: 'Aggregation', name: 'demo', parts: [], rules: [] });
    expect(toData).toHaveBeenCalledTimes(1);
    expect(toData).toHaveBeenCalledWith(false);
  });

  it('sanitizes the download filename', () => {
    expect(getAggregationDownloadFileName('My Set: Draft.json')).toBe('My-Set-Draft.json');
    expect(getAggregationDownloadFileName('')).toBe('aggregation.json');
  });

  it('confirms real webwaspjs 0.3.5 aggregations expose toData for Wasp-compatible export', () => {
    const aggregation = createAggregationFromData({
      object_type: 'Aggregation',
      name: 'Direct toData check',
      parts: [],
      rules: [],
      rnd_seed: 7,
      global_constraints: [],
      catalog: null,
      mode: 0,
      coll_check: true,
      field: null,
      graph: {},
      include_aggr_geo: true,
      aggregated_parts: {},
      aggregated_parts_sequence: [],
    });

    expect(typeof aggregation.toData).toBe('function');
    expect(exportAggregationData(aggregation)).toEqual({
      object_type: 'Aggregation',
      name: 'Direct toData check',
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
    });
  });

  it('downloads the exported aggregation as json', () => {
    const createObjectURL = vi.fn(() => 'blob:download');
    const revokeObjectURL = vi.fn();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revokeObjectURL,
    });

    const appendSpy = vi.spyOn(document.body, 'appendChild');

    const result = downloadAggregationData(
      {
        toData: () => ({ object_type: 'Aggregation', name: 'Test Export', aggregated_parts: { '1': { id: 1 } } }),
      },
      'Test Export',
    );

    expect(result.fileName).toBe('Test-Export.json');
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(appendSpy).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:download');
  });

  it('renders restored aggregated parts into the visualizer without mutating count', async () => {
    const addEntity = vi.fn();
    const aggregation = {
      aggregated_parts: [{ id: 0, name: 'A' }, { id: 1, name: 'B' }],
    };

    const count = await initializeAggregationScene(aggregation, { addEntity });

    expect(count).toBe(2);
    expect(addEntity).toHaveBeenCalledTimes(2);
    expect(addEntity).toHaveBeenNthCalledWith(1, aggregation.aggregated_parts[0]);
    expect(addEntity).toHaveBeenNthCalledWith(2, aggregation.aggregated_parts[1]);
  });
});


describe('visualizer context teardown', () => {
  it.each([true, false])('releases the owned context after disposal (native dispose: %s)', (native) => {
    const domElement = document.createElement('canvas');
    document.body.appendChild(domElement);
    const renderer = { domElement, dispose: vi.fn(), forceContextLoss: vi.fn() };
    const viz = { renderer, ...(native ? { dispose: vi.fn() } : {}) };
    disposeVisualizer(viz);
    expect(native ? viz.dispose : renderer.dispose).toHaveBeenCalledOnce();
    expect(renderer.forceContextLoss).toHaveBeenCalledOnce();
    expect(domElement.isConnected).toBe(false);
  });
});
