/**
 * buildRuntime.ts – React-controlled runtime for the build screen.
 *
 * Unlike the old demoRuntime, this module exposes pure functions that operate
 * on explicit Aggregation / Visualizer refs.  All DOM manipulation is gone;
 * the React layer owns rendering.
 */

import { Aggregation, Visualizer } from 'webwaspjs';
import {
  createAggregationFromData,
  getAggregationCatalogParts,
  getValidPlacementsAtParent,
  setActivePartTypes,
} from 'webwaspjs';
import type { PartCatalogEntry } from '../state/buildState';
import {
  applyAggregationColors,
  frameVisualizerToScene,
  placeFirstPartManually,
  placePartManually,
  removePartById,
  setAggregationPartCount,
  updateVisualizerCameraConstraints,
} from './waspAdapters';
import {
  addGhostMeshes,
  clearGhostMeshes,
  disposeViewerInteraction,
  getGhostCount,
  getGhostPlacementData,
  getGhostPlacements,
  highlightGhost,
  raycastGhosts,
  raycastParts,
  unhighlightGhosts,
} from './viewerInteraction';
import { createDefaultPartColorConfig } from './defaultColors';

/* ── helpers ── */

async function loadJson(path: string) {
  const resp = await fetch(path);
  if (!resp.ok) throw new Error(`Failed to load ${path}: ${resp.status}`);
  return resp.json();
}

async function resolveColors(set: { colors?: string[]; byPart?: Record<string, string>; path: string }) {
  const hasConfig = (set.colors?.length ?? 0) > 0 || Object.keys(set.byPart ?? {}).length > 0;
  if (hasConfig) return { colors: set.colors || [], byPart: set.byPart || {} };
  try {
    const r = await fetch(`${set.path}colors.json`);
    if (!r.ok) return null;
    return r.json();
  } catch {
    return null;
  }
}

export function normalizeHex(value: string): string {
  if (!value) return '#ffffff';
  const v = value.trim();
  if (v.startsWith('#')) {
    return v.length === 7 ? v : v.length === 4 ? `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}` : '#ffffff';
  }
  if (/^[0-9a-fA-F]{6}$/.test(v)) return `#${v}`;
  if (/^[0-9a-fA-F]{3}$/.test(v)) return `#${v[0]}${v[0]}${v[1]}${v[1]}${v[2]}${v[2]}`;
  return '#ffffff';
}

/* ── dataset loading ── */

export type LoadResult = {
  aggregation: any;
  colorsConfig: any;
  catalog: PartCatalogEntry[];
};

function getAggregationRuntimeDiagnostics(aggregation: any) {
  const prototype = aggregation ? Object.getPrototypeOf(aggregation) : null;
  return {
    constructorName: aggregation?.constructor?.name || 'unknown',
    hasOwnToData: Object.prototype.hasOwnProperty.call(aggregation || {}, 'toData'),
    instanceToDataType: typeof aggregation?.toData,
    prototypeToDataType: typeof prototype?.toData,
    matchesImportedPrototype: prototype === Aggregation.prototype,
    importedPrototypeToDataType: typeof Aggregation?.prototype?.toData,
    keys: Object.keys(aggregation || {}),
  };
}

function assertAggregationExportCompatibility(aggregation: any, context: string) {
  if (!aggregation) {
    throw new Error(`No aggregation instance in ${context}.`);
  }

  const diagnostics = getAggregationRuntimeDiagnostics(aggregation);
  if (diagnostics.instanceToDataType !== 'function') {
    console.error(`[buildRuntime] aggregation export incompatibility in ${context}`, diagnostics);
    throw new Error(
      `Aggregation instance is missing toData() in ${context}. ` +
      `constructor=${diagnostics.constructorName}, ` +
      `instanceToData=${diagnostics.instanceToDataType}, ` +
      `prototypeToData=${diagnostics.prototypeToDataType}, ` +
      `matchesImportedPrototype=${String(diagnostics.matchesImportedPrototype)}, ` +
      `importedPrototypeToData=${diagnostics.importedPrototypeToDataType}.`,
    );
  }

  if (import.meta.env.DEV) {
    console.info(`[buildRuntime] aggregation diagnostics in ${context}`, diagnostics);
  }
}

export async function loadDataset(
  set: { path: string; aggregation: string; colors?: string[]; byPart?: Record<string, string> },
): Promise<LoadResult> {
  const data = await loadJson(`${set.path}${set.aggregation}`);
  const resolvedColorsConfig = await resolveColors(set);
  const agg = createAggregationFromData(data);
  assertAggregationExportCompatibility(agg, `loadDataset(${set.path}${set.aggregation})`);
  const parts = getAggregationCatalogParts(agg);
  const fallbackColorsConfig = createDefaultPartColorConfig(parts.map((part: any) => part.name));
  const colorsConfig = resolvedColorsConfig || fallbackColorsConfig;
  if (colorsConfig) applyAggregationColors(agg, colorsConfig);

  const palette = colorsConfig?.colors || [];
  const byPart = colorsConfig?.byPart || {};

  const catalog: PartCatalogEntry[] = parts.map((p: any, i: number) => ({
    name: p.name,
    color: normalizeHex(byPart[p.name] || (palette.length ? palette[i % palette.length] : '#ffffff')),
    active: true,
  }));

  return { aggregation: agg, colorsConfig, catalog };
}

export async function loadUploadedDataset(
  payload: { aggregationData: any; byPart?: Record<string, string> },
): Promise<LoadResult> {
  const agg = createAggregationFromData(payload.aggregationData);
  assertAggregationExportCompatibility(agg, 'loadUploadedDataset');
  const parts = getAggregationCatalogParts(agg);
  const fallbackColorsConfig = createDefaultPartColorConfig(parts.map((part: any) => part.name));
  const inputByPart = payload.byPart || {};
  const byPart = parts.reduce<Record<string, string>>((acc, part: any) => {
    acc[part.name] = inputByPart[part.name] || fallbackColorsConfig.byPart[part.name];
    return acc;
  }, {});
  const colorValues = Object.values(byPart) as string[];
  const colorsConfig = {
    colors: Array.from(new Set(colorValues)).map((value) => normalizeHex(value)),
    byPart,
  };

  applyAggregationColors(agg, colorsConfig);

  const catalog: PartCatalogEntry[] = parts.map((p: any) => ({
    name: p.name,
    color: normalizeHex(byPart[p.name] || '#ffffff'),
    active: true,
  }));

  return { aggregation: agg, colorsConfig, catalog };
}

/* ── visualizer lifecycle ── */

export function createVisualizerInContainer(container: HTMLElement): any {
  // Visualizer expects a CSS selector or element – pass the element directly
  return new Visualizer(container as any, container as any);
}

export function disposeVisualizer(viz: any) {
  if (!viz) return;
  try {
    disposeViewerInteraction(viz);
    if (typeof viz.dispose === 'function') {
      viz.dispose();
      const dom = viz.renderer?.domElement;
      if (dom?.parentNode) dom.parentNode.removeChild(dom);
      return;
    }
    viz.cameraControls?.dispose?.();
    viz.scene?.traverse?.((obj: any) => {
      obj.geometry?.dispose?.();
      if (Array.isArray(obj.material)) obj.material.forEach((m: any) => m?.dispose?.());
      else obj.material?.dispose?.();
    });
    viz.renderer?.dispose?.();
    const dom = viz.renderer?.domElement;
    if (dom?.parentNode) dom.parentNode.removeChild(dom);
  } catch {}
}

/* ── aggregation helpers (thin wrappers kept for call-site clarity) ── */

export function growToTarget(agg: any, targetCount: number, viz: any) {
  return setAggregationPartCount(agg, targetCount, viz);
}

export async function initializeAggregationScene(
  agg: any,
  viz: any,
  defaultTargetCount = 50,
) {
  if (!agg || !viz) return 0;

  const existingParts = Array.isArray(agg.aggregated_parts) ? agg.aggregated_parts : [];
  if (existingParts.length > 0) {
    existingParts.forEach((part: any) => {
      viz.addEntity(part);
    });
    updateSceneCameraConstraints(viz);
    return existingParts.length;
  }

  await growToTarget(agg, defaultTargetCount, viz);
  return agg.aggregated_parts.length;
}

export function frameScene(viz: any, padding = 0.8) {
  frameVisualizerToScene(viz, padding);
}

export function updateSceneCameraConstraints(viz: any) {
  updateVisualizerCameraConstraints(viz);
}

export function applyColors(agg: any, colorsConfig: any) {
  if (colorsConfig) applyAggregationColors(agg, colorsConfig);
}

function sanitizeDownloadName(value: string | null | undefined) {
  const baseValue = (value || 'aggregation').trim().replace(/\.json$/i, '');
  const safeValue = baseValue
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return safeValue || 'aggregation';
}

export function exportAggregationData(aggregation: any) {
  assertAggregationExportCompatibility(aggregation, 'exportAggregationData');
  return aggregation.toData(false);
}

export function getAggregationDownloadFileName(name: string | null | undefined) {
  return `${sanitizeDownloadName(name)}.json`;
}

export function downloadAggregationData(aggregation: any, name: string | null | undefined) {
  const data = exportAggregationData(aggregation);
  const fileName = getAggregationDownloadFileName(name);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  return { data, fileName };
}

export {
  addGhostMeshes,
  clearGhostMeshes,
  getGhostCount,
  getGhostPlacementData,
  getGhostPlacements,
  getValidPlacementsAtParent,
  highlightGhost,
  placeFirstPartManually,
  placePartManually,
  raycastGhosts,
  raycastParts,
  removePartById,
  setActivePartTypes,
  unhighlightGhosts,
};
