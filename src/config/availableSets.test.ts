import { beforeEach, describe, expect, it, vi } from 'vitest';

const PINNED_ATLAS_RAW_BASE =
  'https://raw.githubusercontent.com/Wasp-Framework/Wasp-Atlas-Collection/main/';

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
                title: 'Zeta Set',
                description: { short: 'Z desc' },
                authors: [{ name: 'Author Z' }],
                tags: ['tag-z'],
                metrics: { parts_total: 7, rules_total: 21 },
                files: {
                  aggregation: 'z-set/aggregation.json',
                  meta: 'z-set/meta.json',
                  thumbnail: 'z-set/thumb.png',
                },
              },
              {
                slug: 'a-set',
                title: 'Alpha Set',
                description: { short: 'A desc' },
                authors: [{ name: 'Author A' }],
                tags: ['tag-a'],
                metrics: { parts_total: 3, rules_total: 9 },
                files: {
                  aggregation: 'a-set/aggregation.json',
                  meta: 'a-set/meta.json',
                },
              },
              {
                slug: 'broken-set',
                title: 'Broken Set',
                description: { short: 'Broken desc' },
                authors: [{ name: 'Broken Author' }],
                tags: ['tag-broken'],
                files: {
                  aggregation: 'broken-set/aggregation.json',
                  meta: 'broken-set/meta.json',
                },
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
            software: '1.0.0',
            created_at: '2026-03-02',
            colors: ['#ffffff'],
            byPart: { A: '#ffffff' },
            license: { value: 'MIT' },
          }),
        };
      }

      if (url.endsWith('/systems/z-set/meta.json')) {
        return {
          ok: true,
          json: async () => ({
            units: 'cm',
            software: '2.0.0',
            created_at: '2026-03-03',
            palette: ['#000000'],
            by_part: { Z: '#000000' },
            license: { value: 'GPL-3.0' },
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

    expect(result.sets[0]).toMatchObject({
      name: 'Alpha Set',
      description: 'A desc',
      author: 'Author A',
      version: '1.0.0',
      created: '2026-03-02',
      license: 'MIT',
      partsCount: 3,
      rulesCount: 9,
    });
    expect(result.sets[1]).toMatchObject({
      name: 'Zeta Set',
      description: 'Z desc',
      author: 'Author Z',
      version: '2.0.0',
      created: '2026-03-03',
      license: 'GPL-3.0',
      thumbnail: `${PINNED_ATLAS_RAW_BASE}systems/z-set/thumb.png`,
      partsCount: 7,
      rulesCount: 21,
    });

    expect(createAggregationFromData).toHaveBeenCalledTimes(3);
    expect(infoSpy).toHaveBeenCalledTimes(2);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toContain('Dataset failed: broken-set');
  });
});
