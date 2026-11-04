import { beforeEach, describe, expect, it, vi } from 'vitest';

const ATLAS_RAW_BASE =
  'https://raw.githubusercontent.com/Wasp-Framework/Wasp-Atlas-Collection/main/';

describe('availableSets', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('displays sorted datasets using only generated catalog metadata and file references', async () => {
    const fromData = vi.fn(() => { throw new Error('Must not validate while browsing'); });
    vi.doMock('webwaspjs', () => ({ Aggregation: { fromData } }));
    const fetchMock = vi.fn(async (url: string) => {
      if (url !== `${ATLAS_RAW_BASE}catalog/catalog.json`) {
        throw new Error(`Unexpected dataset request: ${url}`);
      }
      return {
        ok: true,
        json: async () => ({
          systems: [
            {
              slug: 'z-set', title: 'Zeta Set', description: { short: 'Z desc' },
              authors: [{ name: 'Author Z' }], tags: ['tag-z'],
              units: 'cm', software: '2.0.0', created_at: '2026-03-03',
              license: { value: 'GPL-3.0' },
              metrics: { parts_total: 7, rules_total: 21 },
              palette: ['#000000'], by_part: { Z: '#000000' },
              files: {
                aggregation: 'z-set/aggregation.json', meta: 'z-set/meta.json',
                thumbnail: 'z-set/thumb.png',
              },
            },
            {
              slug: 'a-set', title: 'Alpha Set', description: { long: ' A desc ' },
              authors: [{ name: 'Author A' }, { name: 'Coauthor' }], tags: ['tag-a'],
              units: 'mm', version: '1.0.0', created: '2026-03-02', license: 'MIT',
              metrics: { parts_total: 3, rules_total: 9 },
              aggregation_url: 'a-set/aggregation.json', meta_url: 'a-set/meta.json',
            },
            {
              slug: 'broken-set', title: 'Broken Set',
              files: { aggregation: 'broken-set/aggregation.json' },
            },
            { slug: 'no-aggregation', title: 'Missing file reference' },
          ],
        }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    const { loadAvailableSets } = await import('./availableSets');
    const loaded: string[] = [];
    const result = await loadAvailableSets((set) => loaded.push(set.slug));

    expect(result.fromBackup).toBe(false);
    expect(result.notice).toBeNull();
    expect(result.sets.map((set) => set.name)).toEqual(['Alpha Set', 'Broken Set', 'Zeta Set']);
    expect(loaded).toEqual(['a-set', 'broken-set', 'z-set']);
    expect(result.sets[0]).toMatchObject({
      description: 'A desc', author: 'Author A, Coauthor', units: 'mm', version: '1.0.0',
      created: '2026-03-02', license: 'MIT', partsCount: 3, rulesCount: 9,
      path: `${ATLAS_RAW_BASE}systems/a-set/`, aggregation: 'aggregation.json',
      meta: `${ATLAS_RAW_BASE}systems/a-set/meta.json`, colors: [], byPart: {},
    });
    expect(result.sets[2]).toMatchObject({
      description: 'Z desc', author: 'Author Z', tags: ['tag-z'], units: 'cm', version: '2.0.0',
      created: '2026-03-03', license: 'GPL-3.0', partsCount: 7, rulesCount: 21,
      thumbnail: `${ATLAS_RAW_BASE}systems/z-set/thumb.png`,
      colors: ['#000000'], byPart: { Z: '#000000' },
    });
    expect(result.sets.every((set) => !set.compatibilityError)).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(`${ATLAS_RAW_BASE}catalog/catalog.json`, { cache: 'no-store' });
    expect(fromData).not.toHaveBeenCalled();
  });

  it('shares one catalog request across concurrent callers and reuses the result', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ systems: [{ slug: 'demo', files: { aggregation: 'demo/aggregation.json' } }] }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    const { loadAvailableSets } = await import('./availableSets');
    const firstListener = vi.fn();
    const secondListener = vi.fn();
    const [first, second] = await Promise.all([
      loadAvailableSets(firstListener), loadAvailableSets(secondListener),
    ]);
    const cachedListener = vi.fn();
    expect(await loadAvailableSets(cachedListener)).toBe(first);
    expect(second).toBe(first);
    for (const listener of [firstListener, secondListener, cachedListener]) {
      expect(listener).toHaveBeenCalledOnce();
      expect(listener).toHaveBeenCalledWith(first.sets[0]);
    }
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('reports catalog fetch failures without requesting datasets', async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 503 }));
    vi.stubGlobal('fetch', fetchMock);
    const { loadAvailableSets } = await import('./availableSets');
    expect(await loadAvailableSets()).toEqual({
      sets: [], fromBackup: false, notice: 'Could not load datasets from Wasp-Atlas catalog.json.',
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
