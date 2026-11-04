// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { Aggregation } from 'webwaspjs';
import {
  disposeVisualizer,
  downloadAggregationData,
  exportAggregationData,
  getAggregationDownloadFileName,
  initializeAggregationScene,
  loadDataset,
} from './buildRuntime';

describe('on-demand dataset loading', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('fetches and validates the opened aggregation and preserves colors from its metadata', async () => {
    const fromData = vi.spyOn(Aggregation, 'fromData').mockReturnValue({
      toData: vi.fn(), getBaseParts: () => [{ name: 'A' }],
    } as any);
    const fetchMock = vi.fn(async (url: string) => ({
      ok: true,
      json: async () => url.endsWith('meta.json')
        ? { palette: ['#123456'], by_part: { A: '#abcdef' } }
        : { name: 'Opened dataset', parts: [], rules: [] },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await loadDataset({ path: '/systems/demo/', aggregation: 'aggregation.json', meta: '/systems/demo/meta.json' });

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/systems/demo/aggregation.json', '/systems/demo/meta.json',
    ]);
    expect(fromData).toHaveBeenCalledOnce();
    expect(fromData).toHaveBeenCalledWith(expect.objectContaining({ name: 'Opened dataset', object_type: 'Aggregation' }));
    expect(result.catalog).toEqual([{ name: 'A', color: '#abcdef', active: true }]);
  });

  it('rejects an incompatible aggregation when opened', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({}) })));
    vi.spyOn(Aggregation, 'fromData').mockImplementation(() => { throw new Error('Invalid aggregation payload'); });

    await expect(loadDataset({ path: '/systems/broken/', aggregation: 'aggregation.json' }))
      .rejects.toThrow('Invalid aggregation payload');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

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

  it('confirms real webwaspjs 0.3.10 aggregations expose toData for Wasp-compatible export', () => {
    const aggregation = Aggregation.fromData({
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
