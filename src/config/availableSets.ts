import { createAggregationFromData } from 'webwaspjs';

const DEFAULT_ATLAS_RAW_BASE =
  'https://raw.githubusercontent.com/Wasp-Framework/Wasp-Atlas/caa7c7585d03d92902051d8b20f53a2a40af68b7/';
const ATLAS_RAW_BASE = (import.meta.env.VITE_ATLAS_RAW_BASE || DEFAULT_ATLAS_RAW_BASE).replace(/\/?$/, '/');
const ATLAS_CATALOG_URL = `${ATLAS_RAW_BASE}catalog/catalog.json`;

export const CUSTOM_UPLOAD_SLUG = '__custom_upload__';

export type DemoSetConfig = {
  slug: string;
  name: string;
  description: string;
  author: string;
  path: string;
  aggregation: string;
  colors: string[];
  byPart: Record<string, string>;
  meta?: string;
  tags?: string[];
  license?: string;
  units?: string;
  version?: string;
  created?: string;
  thumbnail?: string;
};

type CatalogLoadResult = {
  sets: DemoSetConfig[];
  fromBackup: boolean;
  notice: string | null;
};

type AtlasSystem = {
  slug?: string;
  name?: string;
  description?: string;
  author?: string;
  tags?: string[];
  license?: string;
  thumbnail?: string;
  aggregation_url?: string;
  meta_url?: string;
};

type AtlasCatalog = {
  systems?: AtlasSystem[];
};

type AtlasMeta = {
  tags?: string[];
  license?: string;
  units?: string;
  version?: string;
  created?: string;
  thumbnail?: string;
  colors?: string[];
  palette?: string[];
  byPart?: Record<string, string>;
  by_part?: Record<string, string>;
};

async function loadAtlasMeta(metaUrl?: string): Promise<AtlasMeta | null> {
  if (!metaUrl) return null;
  try {
    const response = await fetch(metaUrl, { cache: 'no-store' });
    if (!response.ok) return null;
    return (await response.json()) as AtlasMeta;
  } catch {
    return null;
  }
}

async function toAtlasSet(system: AtlasSystem): Promise<DemoSetConfig | null> {
  const relAggregation = (system.aggregation_url || '').trim();
  if (!relAggregation) return null;

  const slash = relAggregation.lastIndexOf('/');
  const aggregation = slash >= 0 ? relAggregation.slice(slash + 1) : relAggregation;
  const basePath = slash >= 0 ? relAggregation.slice(0, slash + 1) : '';
  const slug = (system.slug || '').trim() || (system.name || '').trim().toLowerCase().replace(/\s+/g, '-');
  if (!slug || !aggregation) return null;

  const relMeta = (system.meta_url || '').trim();
  const metaUrl = relMeta ? `${ATLAS_RAW_BASE}${relMeta}` : undefined;
  const meta = await loadAtlasMeta(metaUrl);

  const tags = Array.isArray(meta?.tags) && meta.tags.length
    ? meta.tags
    : Array.isArray(system.tags)
      ? system.tags
      : [];
  const license = (meta?.license || system.license || '').trim();
  const units = (meta?.units || '').trim();
  const version = (meta?.version || '').trim();
  const created = (meta?.created || '').trim();
  const catalogThumb = (system.thumbnail || '').trim();
  const metaThumb = (meta?.thumbnail || '').trim();
  const thumbnail = catalogThumb
    ? `${ATLAS_RAW_BASE}${catalogThumb}`
    : metaThumb
      ? `${ATLAS_RAW_BASE}${basePath}${metaThumb}`
      : '';
  const colors = Array.isArray(meta?.colors) ? meta.colors : Array.isArray(meta?.palette) ? meta.palette : [];
  const byPart = meta?.byPart || meta?.by_part || {};

  return {
    slug,
    name: (system.name || '').trim() || slug,
    description: (system.description || '').trim(),
    author: (system.author || '').trim(),
    path: `${ATLAS_RAW_BASE}${basePath}`,
    aggregation,
    colors,
    byPart,
    meta: metaUrl,
    tags,
    license,
    units,
    version,
    created,
    thumbnail,
  };
}

function logDatasetLoadResult(set: DemoSetConfig, success: boolean, reason?: string) {
  const prefix = `[Wasp Atlas] Dataset ${success ? 'loaded' : 'failed'}: ${set.slug}`;
  if (success) {
    console.info(prefix, { name: set.name, path: `${set.path}${set.aggregation}` });
  } else {
    console.warn(prefix, { name: set.name, path: `${set.path}${set.aggregation}`, reason });
  }
}

async function validateAtlasSet(set: DemoSetConfig): Promise<boolean> {
  try {
    const response = await fetch(`${set.path}${set.aggregation}`, { cache: 'no-store' });
    if (!response.ok) {
      logDatasetLoadResult(set, false, `HTTP ${response.status}`);
      return false;
    }

    const data = await response.json();
    createAggregationFromData(data);
    logDatasetLoadResult(set, true);
    return true;
  } catch (error: any) {
    logDatasetLoadResult(set, false, error?.message || 'Unknown validation error');
    return false;
  }
}

let catalogLoadPromise: Promise<CatalogLoadResult> | null = null;

async function fetchRemoteSets(): Promise<DemoSetConfig[]> {
  const response = await fetch(ATLAS_CATALOG_URL, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Failed to load atlas catalog: ${response.status}`);
  }
  const data = (await response.json()) as AtlasCatalog;
  const systems = Array.isArray(data.systems) ? data.systems : [];
  const mapped = (await Promise.all(systems.map((system) => toAtlasSet(system)))).filter(
    (item): item is DemoSetConfig => Boolean(item),
  );
  const validated = await Promise.all(
    mapped.map(async (set) => ((await validateAtlasSet(set)) ? set : null)),
  );
  return validated
    .filter((item): item is DemoSetConfig => Boolean(item))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function loadAvailableSets(): Promise<CatalogLoadResult> {
  if (!catalogLoadPromise) {
    catalogLoadPromise = (async () => {
      try {
        const remoteSets = await fetchRemoteSets();
        return { sets: remoteSets, fromBackup: false, notice: null };
      } catch {
        return {
          sets: [],
          fromBackup: false,
          notice: 'Could not load datasets from Wasp-Atlas catalog.json.',
        };
      }
    })();
  }
  return catalogLoadPromise;
}
