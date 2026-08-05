import { beforeEach, describe, expect, it, vi } from 'vitest';

const PINNED_ATLAS_RAW_BASE =
  'https://raw.githubusercontent.com/Wasp-Framework/Wasp-Atlas/caa7c7585d03d92902051d8b20f53a2a40af68b7/';

describe('availableSets', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('loads, validates, and normalizes sets from atlas catalog + meta', async () => {
    const createAggregationFromData = vi.fn((data: any) => {
      if (data?.invalid) {
        throw new Error('Invalid aggregation payload');
      }
      return {};
    });
    vi.doMock('webwaspjs', () => ({ createAggregationFromData }));

    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('/catalog/catalog.json')) {
        return {
          ok: true,
          json: async () => ({
            systems: [
              {
                slug: 'z-set',
                name: 'Zeta Set',
                description: 'Z desc',
                author: 'Author Z',
                tags: ['tag-z'],
                aggregation_url: 'systems/z-set/aggregation.json',
                meta_url: 'systems/z-set/meta.json',
              },
              {
                slug: 'a-set',
                name: 'Alpha Set',
                description: 'A desc',
                author: 'Author A',
                tags: ['tag-a'],
                aggregation_url: 'systems/a-set/aggregation.json',
                meta_url: 'systems/a-set/meta.json',
              },
              {
                slug: 'broken-set',
                name: 'Broken Set',
                description: 'Broken desc',
                author: 'Broken Author',
                tags: ['tag-broken'],
                aggregation_url: 'systems/broken-set/aggregation.json',
                meta_url: 'systems/broken-set/meta.json',
              },
            ],
          }),
        };
      }

      if (url.endsWith('/systems/a-set/meta.json')) {
        return {
          ok: true,
          json: async () => ({
            units: 'mm',
            version: '1.0.0',
            created: '2026-03-02',
            colors: ['#ffffff'],
            byPart: { A: '#ffffff' },
          }),
        };
      }

      if (url.endsWith('/systems/z-set/meta.json')) {
        return {
          ok: true,
          json: async () => ({
            units: 'cm',
            version: '2.0.0',
            created: '2026-03-03',
            palette: ['#000000'],
            by_part: { Z: '#000000' },
          }),
        };
      }

      if (url.endsWith('/systems/broken-set/meta.json')) {
        return {
          ok: true,
          json: async () => ({
            units: 'm',
          }),
        };
      }

      if (url.endsWith('/systems/a-set/aggregation.json')) {
        return {
          ok: true,
          json: async () => ({ name: 'Alpha aggregation' }),
        };
      }

      if (url.endsWith('/systems/z-set/aggregation.json')) {
        return {
          ok: true,
          json: async () => ({ name: 'Zeta aggregation' }),
        };
      }

      if (url.endsWith('/systems/broken-set/aggregation.json')) {
        return {
          ok: true,
          json: async () => ({ invalid: true }),
        };
      }

      return { ok: false, json: async () => ({}) };
    });

    vi.stubGlobal('fetch', fetchMock);

    const mod = await import('./availableSets');
    const result = await mod.loadAvailableSets();

    expect(result.fromBackup).toBe(false);
    expect(result.notice).toBeNull();
    expect(result.sets.length).toBe(2);

    const names = result.sets.map((set) => set.name);
    expect(names).toEqual(['Alpha Set', 'Zeta Set']);

    for (const set of result.sets) {
      expect(set.slug).toBeTruthy();
      expect(set.name).toBeTruthy();
      expect(set.path).toContain(`${PINNED_ATLAS_RAW_BASE}systems/`);
      expect(set.aggregation).toBe('aggregation.json');
      expect(Array.isArray(set.colors)).toBe(true);
      expect(typeof set.byPart).toBe('object');
      expect(Array.isArray(set.tags)).toBe(true);
    }

    expect(createAggregationFromData).toHaveBeenCalledTimes(3);
    expect(infoSpy).toHaveBeenCalledTimes(2);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toContain('Dataset failed: broken-set');
  });
});
