import { createAggregationFromData } from 'webwaspjs';

const DEFAULT_ATLAS_RAW_BASE =
  'https://raw.githubusercontent.com/Wasp-Framework/Wasp-Atlas-Collection/main/';
const ATLAS_RAW_BASE = (import.meta.env.VITE_ATLAS_RAW_BASE || DEFAULT_ATLAS_RAW_BASE).replace(/\/?$/, '/');
const ATLAS_SYSTEMS_BASE = `${ATLAS_RAW_BASE}systems/`;
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
  partsCount?: number;
  rulesCount?: number;
};

type CatalogLoadResult = {
  sets: DemoSetConfig[];
  fromBackup: boolean;
  notice: string | null;
};

type AtlasSystem = {
  slug?: string;
  name?: string;
  title?: string;
  description?: string | { short?: string; long?: string };
  author?: string;
  authors?: Array<{ name?: string }>;
  tags?: string[];
  license?: string | { value?: string };
  thumbnail?: string;
  aggregation_url?: string;
  meta_url?: string;
  created?: string;
  created_at?: string;
  units?: string;
  version?: string;
  software?: string;
  metrics?: {
    parts_total?: number;
    rules_total?: number;
  };
  files?: {
    aggregation?: string;
    meta?: string;
    thumbnail?: string;
  };
};

type AtlasCatalog = {
  systems?: AtlasSystem[];
};

type AtlasMeta = {
  title?: string;
  description?: string | { short?: string; long?: string };
  authors?: Array<{ name?: string }>;
  tags?: string[];
  license?: string | { value?: string };
  units?: string;
  version?: string;
  software?: string;
  created?: string;
  created_at?: string;
  thumbnail?: string;
  colors?: string[];
  palette?: string[];
  byPart?: Record<string, string>;
  by_part?: Record<string, string>;
};

function normalizeAtlasDescription(value?: AtlasSystem['description'] | AtlasMeta['description']): string {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  return (value.short || value.long || '').trim();
}

function normalizeAtlasLicense(value?: AtlasSystem['license'] | AtlasMeta['license']): string {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  return (value.value || '').trim();
}

function normalizeAtlasAuthor(system: AtlasSystem, meta: AtlasMeta | null): string {
  const metaAuthors = Array.isArray(meta?.authors) ? meta.authors : [];
  const systemAuthors = Array.isArray(system.authors) ? system.authors : [];
  const authors = (metaAuthors.length ? metaAuthors : systemAuthors)
    .map((entry) => (entry?.name || '').trim())
    .filter(Boolean);

  if (authors.length) return authors.join(', ');
  return (system.author || '').trim();
}

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
  const relAggregation = (system.files?.aggregation || system.aggregation_url || '').trim();
  if (!relAggregation) return null;

  const slash = relAggregation.lastIndexOf('/');
  const aggregation = slash >= 0 ? relAggregation.slice(slash + 1) : relAggregation;
  const basePath = slash >= 0 ? relAggregation.slice(0, slash + 1) : '';
  const rawName = (system.title || system.name || '').trim();
  const slug = (system.slug || '').trim() || rawName.toLowerCase().replace(/\s+/g, '-');
  if (!slug || !aggregation) return null;

  const relMeta = (system.files?.meta || system.meta_url || '').trim();
  const metaUrl = relMeta ? `${ATLAS_SYSTEMS_BASE}${relMeta}` : undefined;
  const meta = await loadAtlasMeta(metaUrl);

  const tags = Array.isArray(meta?.tags) && meta.tags.length ? meta.tags : Array.isArray(system.tags) ? system.tags : [];
  const license = normalizeAtlasLicense(meta?.license || system.license);
  const units = (meta?.units || system.units || '').trim();
  const version = (meta?.version || meta?.software || system.version || system.software || '').trim();
  const created = (meta?.created || meta?.created_at || system.created || system.created_at || '').trim();
  const catalogThumb = (system.files?.thumbnail || system.thumbnail || '').trim();
  const metaThumb = (meta?.thumbnail || '').trim();
  const thumbnail = catalogThumb
    ? `${ATLAS_SYSTEMS_BASE}${catalogThumb}`
    : metaThumb
      ? `${ATLAS_SYSTEMS_BASE}${basePath}${metaThumb}`
      : '';
  const colors = Array.isArray(meta?.colors) ? meta.colors : Array.isArray(meta?.palette) ? meta.palette : [];
  const byPart = meta?.byPart || meta?.by_part || {};

  return {
    slug,
    name: rawName || (meta?.title || '').trim() || slug,
    description: normalizeAtlasDescription(meta?.description) || normalizeAtlasDescription(system.description),
    author: normalizeAtlasAuthor(system, meta),
    path: `${ATLAS_SYSTEMS_BASE}${basePath}`,
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
    partsCount: typeof system.metrics?.parts_total === 'number' ? system.metrics.parts_total : undefined,
    rulesCount: typeof system.metrics?.rules_total === 'number' ? system.metrics.rules_total : undefined,
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
