const DEFAULT_ATLAS_RAW_BASE =
  'https://raw.githubusercontent.com/Wasp-Framework/Wasp-Atlas-Collection/main/';
const ATLAS_RAW_BASE = (import.meta.env.VITE_ATLAS_RAW_BASE || DEFAULT_ATLAS_RAW_BASE).replace(/\/?$/, '/');
const ATLAS_SYSTEMS_BASE = `${ATLAS_RAW_BASE}systems/`;
const ATLAS_CATALOG_URL = `${ATLAS_RAW_BASE}catalog/catalog.json`;

export const CUSTOM_UPLOAD_SLUG = '__custom_upload__';

export type DemoSetConfig = {
  compatibilityError?: string;
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

type DatasetLoadedListener = (set: DemoSetConfig) => void;

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
  colors?: string[];
  palette?: string[];
  byPart?: Record<string, string>;
  by_part?: Record<string, string>;
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

function normalizeAtlasDescription(value?: AtlasSystem['description']): string {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  return (value.short || value.long || '').trim();
}

function normalizeAtlasLicense(value?: AtlasSystem['license']): string {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  return (value.value || '').trim();
}

function normalizeAtlasAuthor(system: AtlasSystem): string {
  const authors = (Array.isArray(system.authors) ? system.authors : [])
    .map((entry) => (entry?.name || '').trim())
    .filter(Boolean);

  if (authors.length) return authors.join(', ');
  return (system.author || '').trim();
}

function toAtlasSet(system: AtlasSystem): DemoSetConfig | null {
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
  const tags = Array.isArray(system.tags) ? system.tags : [];
  const license = normalizeAtlasLicense(system.license);
  const units = (system.units || '').trim();
  const version = (system.version || system.software || '').trim();
  const created = (system.created || system.created_at || '').trim();
  const catalogThumb = (system.files?.thumbnail || system.thumbnail || '').trim();
  const thumbnail = catalogThumb ? `${ATLAS_SYSTEMS_BASE}${catalogThumb}` : '';
  const colors = Array.isArray(system.colors) ? system.colors : Array.isArray(system.palette) ? system.palette : [];
  const byPart = system.byPart || system.by_part || {};

  return {
    slug,
    name: rawName || slug,
    description: normalizeAtlasDescription(system.description),
    author: normalizeAtlasAuthor(system),
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

let catalogLoadPromise: Promise<CatalogLoadResult> | null = null;

async function fetchRemoteSets(): Promise<DemoSetConfig[]> {
  const response = await fetch(ATLAS_CATALOG_URL, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Failed to load atlas catalog: ${response.status}`);
  }
  const data = (await response.json()) as AtlasCatalog;
  const systems = Array.isArray(data.systems) ? data.systems : [];
  return systems.map(toAtlasSet)
    .filter((item): item is DemoSetConfig => Boolean(item))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function loadAvailableSets(onDatasetLoaded?: DatasetLoadedListener): Promise<CatalogLoadResult> {
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

  const result = await catalogLoadPromise;
  if (onDatasetLoaded) {
    for (const set of result.sets) onDatasetLoaded(set);
  }
  return result;
}
