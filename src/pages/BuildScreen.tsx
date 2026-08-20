import React, { useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { CUSTOM_UPLOAD_SLUG, loadAvailableSets, type DemoSetConfig } from '../config/availableSets';
import { useBuildStore } from '../state/buildStore';
import {
  addGhostMeshes,
  clearGhostMeshes,
  loadDataset,
  loadUploadedDataset,
  createVisualizerInContainer,
  disposeVisualizer,
  downloadAggregationData,
  growToTarget,
  initializeAggregationScene,
  frameScene,
  applyColors,
  updateSceneCameraConstraints,
  getGhostCount,
  getGhostPlacementData,
  getGhostPlacements,
  normalizeHex,
  getValidPlacementsAtParent,
  highlightGhost,
  placeFirstPartManually,
  placePartManually,
  raycastGhosts,
  raycastParts,
  removePartById,
  setActivePartTypes,
  unhighlightGhosts,
} from '../lib/buildRuntime';
import { Navbar } from '../components/Navbar';
import { InfoModal } from '../components/InfoModal';
import { DatasetsCatalog } from '../components/DatasetsCatalog';
import { PartColorSettings } from '../components/PartColorSettings';
import { PartPreviewBar } from '../components/PartPreviewBar';
import { RandomControls } from '../components/RandomControls';
import { ManualControls } from '../components/ManualControls';

export function BuildScreen({ onOpenAbout }: { onOpenAbout: () => void }) {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isEmbedMode = searchParams.get('embed') === '1';
  const [isUsageOpen, setIsUsageOpen] = React.useState(false);
  const [isPartSettingsOpen, setIsPartSettingsOpen] = React.useState(false);
  const {
    buildMode,
    selectedPartName,
    hoveredGhostIndex,
    catalog,
    aggregationTargetCount,
    setName,
    isLoading,
    loadError,
    isInfoOpen,
    uploadedDatasetWarnings,
    setLoaded,
    setLoading,
    setLoadError,
    setBuildMode,
    setAggregationTarget,
    togglePartActive,
    selectPart,
    setHoveredGhost,
    setPartColor,
    setInfoOpen,
    uploadedDataset,
  } = useBuildStore(
    useShallow((store) => ({
      buildMode: store.buildMode,
      selectedPartName: store.selectedPartName,
      hoveredGhostIndex: store.hoveredGhostIndex,
      catalog: store.catalog,
      aggregationTargetCount: store.aggregationTargetCount,
      setName: store.setName,
      isLoading: store.isLoading,
      loadError: store.loadError,
      isInfoOpen: store.isInfoOpen,
      uploadedDatasetWarnings: store.uploadedDatasetWarnings,
      setLoaded: store.setLoaded,
      setLoading: store.setLoading,
      setLoadError: store.setLoadError,
      setBuildMode: store.setBuildMode,
      setAggregationTarget: store.setAggregationTarget,
      togglePartActive: store.togglePartActive,
      selectPart: store.selectPart,
      setHoveredGhost: store.setHoveredGhost,
      setPartColor: store.setPartColor,
      setInfoOpen: store.setInfoOpen,
      uploadedDataset: store.uploadedDataset,
    })),
  );
  const [sets, setSets] = React.useState<DemoSetConfig[]>([]);
  const [areSetsLoaded, setAreSetsLoaded] = React.useState(false);
  const [catalogNotice, setCatalogNotice] = React.useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = React.useState<{ embed: boolean; download: boolean }>({
    embed: false,
    download: false,
  });
  const currentSet = sets.find((item) => item.slug === slug) ?? null;
  const loadingLabel = currentSet?.name || (slug === CUSTOM_UPLOAD_SLUG ? uploadedDataset?.setName : null) || slug || 'dataset';

  /* refs for mutable Three.js objects */
  const canvasRef = useRef<HTMLDivElement>(null);
  const vizRef = useRef<any>(null);
  const aggRef = useRef<any>(null);
  const colorsRef = useRef<any>(null);
  /** All valid placements at the currently-selected parent part, grouped by connectionId */
  const placementsByConnRef = useRef<Map<number, any[]>>(new Map());
  /** Index into the variant list for the currently-selected parent part's connection */
  const activeVariantIndexRef = useRef<Map<number, number>>(new Map());
  const selectedParentRef = useRef<number | null>(null);
  /** The ghost index currently previewed for placement */
  const hoveredGhostRef = useRef<number | null>(null);
  const lastPointerTypeRef = useRef<string>('mouse');

  useEffect(() => {
    let active = true;
    (async () => {
      const result = await loadAvailableSets();
      if (!active) return;
      setSets(result.sets);
      setCatalogNotice(result.notice);
      setAreSetsLoaded(true);
    })();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!actionFeedback.embed && !actionFeedback.download) return;
    const timeouts: number[] = [];

    if (actionFeedback.embed) {
      timeouts.push(window.setTimeout(() => {
        setActionFeedback((current) => ({ ...current, embed: false }));
      }, 2000));
    }

    if (actionFeedback.download) {
      timeouts.push(window.setTimeout(() => {
        setActionFeedback((current) => ({ ...current, download: false }));
      }, 2000));
    }

    return () => {
      for (const timeoutId of timeouts) window.clearTimeout(timeoutId);
    };
  }, [actionFeedback]);

  /* ── Load dataset on mount / slug change ── */
  useEffect(() => {
    if (!areSetsLoaded) return;

    const isCustomUpload = slug === CUSTOM_UPLOAD_SLUG;
    const set = sets.find((s) => s.slug === slug);
    if (!isCustomUpload && !set) {
      navigate('/datasets', { replace: true });
      return;
    }

    if (isCustomUpload && !uploadedDataset) {
      setLoadError('No uploaded dataset found. Please upload aggregation.json from the datasets page.');
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const result = isCustomUpload
          ? await loadUploadedDataset(uploadedDataset as any)
          : await loadDataset(set as DemoSetConfig);
        const { aggregation, colorsConfig, catalog } = result;
        if (cancelled) return;

        aggRef.current = aggregation;
        colorsRef.current = colorsConfig;

        /* initialise the visualizer */
        if (vizRef.current) disposeVisualizer(vizRef.current);
        if (canvasRef.current) {
          vizRef.current = createVisualizerInContainer(canvasRef.current);
        }

        const initialPartCount = await initializeAggregationScene(aggregation, vizRef.current, 50);
        setAggregationTarget(initialPartCount);
        frameScene(vizRef.current);

        setLoaded({
          slug: isCustomUpload ? CUSTOM_UPLOAD_SLUG : (set as DemoSetConfig).slug,
          setName: isCustomUpload ? (uploadedDataset as any).setName : (set as DemoSetConfig).name,
          catalog,
        });
      } catch (err: any) {
        if (!cancelled) setLoadError(err.message);
      }
    })();

    return () => {
      cancelled = true;
      disposeVisualizer(vizRef.current);
      vizRef.current = null;
      aggRef.current = null;
    };
  }, [slug, navigate, sets, areSetsLoaded, setLoading, setLoaded, setLoadError, uploadedDataset]);

  /* ── Mode switch ── */
  const handleModeChange = useCallback(
    (mode: 'random' | 'manual') => {
      setBuildMode(mode);
      const viz = vizRef.current;
      if (viz) {
        clearGhostMeshes(viz);
      }
      placementsByConnRef.current = new Map();
      activeVariantIndexRef.current = new Map();
      selectedParentRef.current = null;
      hoveredGhostRef.current = null;
    },
    [setBuildMode],
  );

  const previewGhost = useCallback((index: number | null) => {
    const viz = vizRef.current;
    hoveredGhostRef.current = index;
    setHoveredGhost(index);

    if (!viz) return;

    if (index == null) {
      unhighlightGhosts(viz);
      return;
    }

    highlightGhost(viz, index);
  }, [setHoveredGhost]);

  /** Show ghosts at all open connections of the selected parent part. */
  const showGhostsForParent = useCallback((partName: string | null) => {
    const viz = vizRef.current;
    const agg = aggRef.current;
    const parentId = selectedParentRef.current;

    if (!viz || !agg || parentId == null || !partName) {
      if (viz) clearGhostMeshes(viz);
      placementsByConnRef.current = new Map();
      activeVariantIndexRef.current = new Map();
      previewGhost(null);
      return;
    }

    const allPlacements: any[] = getValidPlacementsAtParent(agg, partName, parentId);

    // Group by connectionId
    const byConn = new Map<number, any[]>();
    for (const p of allPlacements) {
      const list = byConn.get(p.connectionId) ?? [];
      list.push(p);
      byConn.set(p.connectionId, list);
    }
    placementsByConnRef.current = byConn;

    // Pick one placement per connection (using current variant index or 0)
    const ghostPlacements: any[] = [];
    const newVariantIndex = new Map<number, number>();
    for (const [connId, variants] of byConn) {
      const prevIdx = activeVariantIndexRef.current.get(connId) ?? 0;
      const idx = prevIdx < variants.length ? prevIdx : 0;
      newVariantIndex.set(connId, idx);
      ghostPlacements.push(variants[idx]);
    }
    activeVariantIndexRef.current = newVariantIndex;

    clearGhostMeshes(viz);
    if (ghostPlacements.length > 0) {
      addGhostMeshes(viz, ghostPlacements);
    }
    previewGhost(null);
  }, [previewGhost]);

  /** Helper: clear all visual overlays and refs */
  const clearOverlays = useCallback(() => {
    const viz = vizRef.current;
    if (viz) {
      clearGhostMeshes(viz);
    }
    placementsByConnRef.current = new Map();
    activeVariantIndexRef.current = new Map();
    selectedParentRef.current = null;
    hoveredGhostRef.current = null;
    setHoveredGhost(null);
  }, [setHoveredGhost]);

  /* ── Random mode: slider ── */
  const handleTargetChange = useCallback(
    (targetCount: number) => {
      setAggregationTarget(targetCount);
      const agg = aggRef.current;
      const viz = vizRef.current;
      if (agg && viz) {
        growToTarget(agg, targetCount, viz);
        updateSceneCameraConstraints(viz);
      }
    },
    [setAggregationTarget],
  );

  const handleDownload = useCallback(() => {
    const agg = aggRef.current;
    if (!agg) return;

    try {
      downloadAggregationData(agg, setName || currentSet?.name || slug || 'aggregation');
      setActionFeedback((current) => ({ ...current, download: true }));
    } catch (err) {
      console.error('Failed to download aggregation data.', err);
    }
  }, [currentSet?.name, setName, slug]);

  const handleCopyEmbed = useCallback(async () => {
    if (typeof window === 'undefined') return;

    try {
      const embedUrl = new URL(window.location.href);
      embedUrl.searchParams.set('embed', '1');

      const iframeTitle = (setName || currentSet?.name || slug || 'Wasp Atlas Configurator').replace(/"/g, '&quot;');
      const iframeCode =
        `<iframe src="${embedUrl.toString()}" title="${iframeTitle}" loading="lazy" ` +
        'width="100%" height="720" style="border:0;"></iframe>';

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(iframeCode);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = iframeCode;
        textArea.setAttribute('readonly', '');
        textArea.style.position = 'absolute';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.select();
        const copied = document.execCommand('copy');
        document.body.removeChild(textArea);
        if (!copied) {
          throw new Error('Clipboard copy failed');
        }
      }

      setActionFeedback((current) => ({ ...current, embed: true }));
    } catch (error) {
      console.error('Failed to copy embed iframe.', error);
    }
  }, [currentSet?.name, setName, slug]);

  /* ── Part catalog: toggle active ── */
  const handleToggleActive = useCallback(
    (partName: string) => {
      togglePartActive(partName);
      // We'll sync activePartTypes after state update via effect
    },
    [togglePartActive],
  );

  /* Sync active part list to aggregation whenever catalog changes */
  useEffect(() => {
    const agg = aggRef.current;
    if (!agg) return;
    const activeNames = catalog.filter((p) => p.active).map((p) => p.name);
    if (activeNames.length === catalog.length) {
      setActivePartTypes(agg, null); // all active
    } else {
      setActivePartTypes(agg, activeNames);
    }
  }, [catalog]);

  /* ── Part catalog: color change ── */
  const handleColorChange = useCallback(
    (partName: string, hex: string) => {
      const normalized = normalizeHex(hex);
      setPartColor({ name: partName, color: normalized });

      const agg = aggRef.current;
      const viz = vizRef.current;
      if (!agg || !viz) return;

      // Update colorsConfig and re-apply
      const cfg = colorsRef.current || { colors: [], byPart: {} };
      cfg.byPart = cfg.byPart || {};
      cfg.byPart[partName] = normalized;
      colorsRef.current = cfg;
      applyColors(agg, cfg);
      // Re-render current part count to refresh materials
      growToTarget(agg, aggregationTargetCount, viz);
      updateSceneCameraConstraints(viz);
    },
    [setPartColor, aggregationTargetCount],
  );

  /* ── Manual mode: select part for placement ── */
  const handleSelectPart = useCallback(
    (partName: string | null) => {
      selectPart(partName);
      clearOverlays();
    },
    [clearOverlays, selectPart],
  );

  /* ── Manual mode: pointer events on canvas ── */
  const handleCanvasPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (buildMode !== 'manual' || !selectedPartName) return;
      const viz = vizRef.current;
      if (!viz || e.pointerType === 'touch' || getGhostCount(viz) === 0) return;

      const ghostHit = raycastGhosts(viz, e.nativeEvent);
      if (ghostHit) {
        if (ghostHit.index !== hoveredGhostRef.current) {
          previewGhost(ghostHit.index);
        }
      } else if (hoveredGhostRef.current != null) {
        previewGhost(null);
      }
    },
    [buildMode, previewGhost, selectedPartName],
  );

  const handleCanvasPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    lastPointerTypeRef.current = e.pointerType || 'mouse';
  }, []);

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (buildMode !== 'manual') return;
      const agg = aggRef.current;
      const viz = vizRef.current;
      if (!agg || !viz) return;

      if (agg.aggregated_parts.length === 0) {
        if (selectedPartName) {
          placeFirstPartManually(agg, selectedPartName, viz);
          setAggregationTarget(agg.aggregated_parts.length);
          frameScene(viz);
        }
        return;
      }

      const ghostHit = raycastGhosts(viz, e.nativeEvent);
      if (ghostHit) {
        const placeImmediately = lastPointerTypeRef.current === 'touch';
        if (!placeImmediately && ghostHit.index !== hoveredGhostRef.current) {
          previewGhost(ghostHit.index);
          return;
        }

        const ghostData = getGhostPlacementData(viz, ghostHit.index);
        if (!ghostData) return;

        placePartManually(
          agg,
          ghostData.parentPartId,
          ghostData.connectionId,
          ghostData.partName,
          ghostData.connectionBId,
          viz,
        );
        clearOverlays();
        setAggregationTarget(agg.aggregated_parts.length);
        updateSceneCameraConstraints(viz);
        return;
      }

      const partHit = raycastParts(viz, e.nativeEvent);
      if (partHit?.partId != null) {
        selectedParentRef.current = partHit.partId;
        hoveredGhostRef.current = null;
        showGhostsForParent(selectedPartName);
        return;
      }

      previewGhost(null);
    },
    [buildMode, selectedPartName, catalog, clearOverlays, previewGhost, setAggregationTarget, showGhostsForParent],
  );

  const handleCanvasContextMenu = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (buildMode !== 'manual') return;
      const agg = aggRef.current;
      const viz = vizRef.current;
      if (!agg || !viz) return;

      const hit = raycastParts(viz, e.nativeEvent);
      if (hit && hit.partId != null) {
        removePartById(agg, hit.partId, viz);
        clearOverlays();
        setAggregationTarget(agg.aggregated_parts.length);
        updateSceneCameraConstraints(viz);
      }
    },
    [buildMode, clearOverlays, setAggregationTarget],
  );

  /* ── Keyboard: Escape deselects, arrows cycle variants/parts ── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        selectPart(null);
        clearOverlays();
        setInfoOpen(false);
        return;
      }

      if (buildMode !== 'manual' || catalog.length === 0) {
        return;
      }

      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        // Cycle variant at the currently hovered ghost's connection
        const viz = vizRef.current;
        const ghostPlacements = getGhostPlacements(viz);
        if (hoveredGhostRef.current != null && ghostPlacements.length > 0) {
          const ghostData = ghostPlacements[hoveredGhostRef.current];
          if (ghostData) {
            const connId = ghostData.connectionId;
            const parentPartId = ghostData.parentPartId;
            const variants = placementsByConnRef.current.get(connId);
            if (variants && variants.length > 1) {
              e.preventDefault();
              const curIdx = activeVariantIndexRef.current.get(connId) ?? 0;
              const delta = e.key === 'ArrowRight' ? 1 : -1;
              const nextIdx = (curIdx + delta + variants.length) % variants.length;
              activeVariantIndexRef.current.set(connId, nextIdx);
              showGhostsForParent(selectedPartName);

              // Keep the same connection hovered after cycling, so click-to-place stays active.
              const refreshedGhosts = getGhostPlacements(viz);
              if (refreshedGhosts?.length) {
                const nextHoveredIndex = refreshedGhosts.findIndex(
                  (entry) => entry.connectionId === connId && entry.parentPartId === parentPartId,
                );
                if (nextHoveredIndex >= 0) {
                  previewGhost(nextHoveredIndex);
                }
              }
            }
          }
        }
        return;
      }

      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const step = e.key === 'ArrowDown' ? 1 : -1;
        const currentIndex = catalog.findIndex((entry) => entry.name === selectedPartName);
        const fallbackIndex = step > 0 ? 0 : catalog.length - 1;
        const nextIndex = currentIndex === -1
          ? fallbackIndex
          : (currentIndex + step + catalog.length) % catalog.length;
        const nextPartName = catalog[nextIndex]?.name ?? null;

        selectPart(nextPartName);
        if (selectedParentRef.current != null) {
          hoveredGhostRef.current = null;
          placementsByConnRef.current = new Map();
          activeVariantIndexRef.current = new Map();
          if (vizRef.current) clearGhostMeshes(vizRef.current);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    buildMode,
    selectedPartName,
    catalog,
    clearOverlays,
    previewGhost,
    showGhostsForParent,
    selectPart,
    setInfoOpen,
  ]);

  /* Re-show ghosts when selected part changes while a parent is selected */
  useEffect(() => {
    if (buildMode === 'manual' && selectedParentRef.current != null && selectedPartName) {
      showGhostsForParent(selectedPartName);
    }
  }, [selectedPartName, buildMode, showGhostsForParent]);

  /* ── Render ── */
  return (
    <div className="build-screen">
      {!isEmbedMode ? <Navbar onOpenAbout={onOpenAbout} /> : null}

      <div className="build-layout">
        {/* ── Main viewer ── */}
        <div
          className="build-viewer"
          ref={canvasRef}
          onPointerDown={handleCanvasPointerDown}
          onPointerMove={handleCanvasPointerMove}
          onClick={handleCanvasClick}
          onContextMenu={handleCanvasContextMenu}
        >
          {!isEmbedMode ? (
            <div className="build-viewer__dataset-name">
              Dataset: {setName || currentSet?.name || slug}
            </div>
          ) : null}

          {!isEmbedMode ? (
            <button
              className="build-viewer__back"
              onClick={() => navigate('/datasets')}
              title="Back to datasets"
              aria-label="Back to datasets"
            >
              ←
            </button>
          ) : null}

          {!isEmbedMode ? (
            <div className="build-viewer__top-actions">
              <button
                className="build-viewer__help"
                type="button"
                onClick={() => setIsUsageOpen(true)}
                aria-label="Show usage help"
                title="Usage help"
              >
                ?
              </button>
              <button
                className="build-viewer__info"
                type="button"
                onClick={() => setInfoOpen(true)}
                aria-label="Show dataset info"
                title="Dataset info"
              >
                i
              </button>
            </div>
          ) : null}

          {!isEmbedMode ? (
            <div className="build-viewer__actions">
              <div className="build-viewer__action-wrap">
                <button
                  className="build-viewer__embed"
                  type="button"
                  onClick={handleCopyEmbed}
                  aria-label="Copy embeddable iframe"
                  title={actionFeedback.embed ? 'Iframe copied' : 'Copy embeddable iframe'}
                >
                  {actionFeedback.embed ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M5 12.5 9.2 16.7 19 7.3" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
                      <path d="m9 10-3 2 3 2" />
                      <path d="m15 10 3 2-3 2" />
                    </svg>
                  )}
                </button>
                <span className="build-viewer__tooltip" role="tooltip">
                  {actionFeedback.embed ? 'Iframe copied' : 'Copy embeddable iframe'}
                </span>
              </div>

              <div className="build-viewer__action-wrap">
                <button
                  className="build-viewer__download"
                  type="button"
                  onClick={handleDownload}
                  aria-label="Download Wasp-compatible aggregation JSON"
                  title={actionFeedback.download ? 'Aggregation downloaded' : 'Download Wasp-compatible aggregation JSON'}
                  disabled={!aggRef.current || isLoading}
                >
                  {actionFeedback.download ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M5 12.5 9.2 16.7 19 7.3" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 4v10" />
                      <path d="m8 10 4 4 4-4" />
                      <path d="M5 18h14" />
                    </svg>
                  )}
                </button>
                <span className="build-viewer__tooltip" role="tooltip">
                  {actionFeedback.download ? 'Downloaded' : 'Download Wasp-compatible aggregation JSON'}
                </span>
              </div>
            </div>
          ) : null}

        </div>

        {/* ── Right sidebar ── */}
        <aside className="build-sidebar">
          <div className="build-sidebar__mode-picker">
            <div className="build-sidebar__mode-tabs">
              <button
                className={`mode-btn ${buildMode === 'random' ? 'mode-btn--active' : ''}`}
                onClick={() => handleModeChange('random')}
              >
                Random
              </button>
              <button
                className={`mode-btn ${buildMode === 'manual' ? 'mode-btn--active' : ''}`}
                onClick={() => handleModeChange('manual')}
              >
                Manual
              </button>
            </div>
            <button
              className="build-sidebar__mode-settings"
              type="button"
              onClick={() => setIsPartSettingsOpen(true)}
              aria-label="Open part color settings"
              title="Part color settings"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 6h7" />
                <path d="M13 6h7" />
                <path d="M4 12h3" />
                <path d="M9 12h11" />
                <path d="M4 18h11" />
                <path d="M17 18h3" />
                <circle cx="12" cy="6" r="1.75" />
                <circle cx="8" cy="12" r="1.75" />
                <circle cx="16" cy="18" r="1.75" />
              </svg>
            </button>
          </div>

          <div className="build-sidebar__settings">
            <PartPreviewBar
              catalog={catalog}
              selectedPartName={selectedPartName}
              buildMode={buildMode}
              partSources={aggRef.current?.parts}
              onToggleActive={handleToggleActive}
              onSelectPart={handleSelectPart}
            />

            {buildMode === 'random' ? (
              <RandomControls
                targetCount={aggregationTargetCount}
                onTargetChange={handleTargetChange}
                onOpenPartSettings={() => setIsPartSettingsOpen(true)}
              />
            ) : (
              <ManualControls
                selectedPartName={selectedPartName}
                partCount={aggRef.current?.aggregated_parts?.length ?? 0}
                onOpenPartSettings={() => setIsPartSettingsOpen(true)}
              />
            )}

            <DatasetsCatalog
              catalog={catalog}
              selectedPartName={selectedPartName}
              buildMode={buildMode}
              onToggleActive={handleToggleActive}
              onColorChange={handleColorChange}
              onSelectPart={handleSelectPart}
            />
          </div>

          <div className="build-sidebar__usage">
            <h3 className="build-sidebar__section-title">Usage</h3>
            {buildMode === 'manual' ? (
              <>
                <p>Select a part in settings first</p>
                <p><kbd>Click</kbd> a placed part to show placements</p>
                <p><kbd>Hover</kbd> or <kbd>tap</kbd> a ghost to preview</p>
                <p><kbd>Click</kbd> or <kbd>tap</kbd> the previewed ghost to place</p>
                <p><kbd>Right-click</kbd> part to remove</p>
                <p><kbd>Left</kbd>/<kbd>Right</kbd> switch placement variants</p>
                <p><kbd>Up</kbd>/<kbd>Down</kbd> switch parts</p>
                <p><kbd>Esc</kbd> to deselect</p>
              </>
            ) : (
              <>
                <p>Use the slider to grow or shrink the aggregation.</p>
                <p>Toggle parts off to exclude them from random growth.</p>
                <p>Use the color swatch to update part materials.</p>
              </>
            )}
          </div>

          {isEmbedMode ? (
            <div className="build-sidebar__embed-credit">
              <a href="https://wasp-atlas.net" target="_blank" rel="noreferrer noopener">
                Powered by Wasp Atlas
              </a>
            </div>
          ) : null}
        </aside>
      </div>

      {/* Loading overlay */}
      {(isLoading || !areSetsLoaded) && (
        <div className="build-loading">
          <p>Loading {loadingLabel}…</p>
        </div>
      )}

      {catalogNotice ? (
        <div className="dataset-source-notice dataset-source-notice--build" role="status" aria-live="polite">
          {catalogNotice}
        </div>
      ) : null}
      {uploadedDatasetWarnings.length > 0 ? (
        <div
          className="dataset-source-notice dataset-source-notice--build dataset-source-notice--build-secondary"
          role="status"
          aria-live="polite"
        >
          <strong>Unsupported upload features were ignored.</strong>{' '}
          {uploadedDatasetWarnings.join(' ')}
        </div>
      ) : null}

      {/* Error */}
      {loadError && (
        <div className="build-error">
          <p>Error: {loadError}</p>
          <button onClick={() => navigate('/datasets')}>Back to datasets</button>
        </div>
      )}

      <InfoModal
        isOpen={isInfoOpen}
        onClose={() => setInfoOpen(false)}
        title={currentSet?.name || setName || 'Dataset Info'}
        setName={currentSet?.name || setName}
        description={currentSet?.description}
        author={currentSet?.author}
        tags={currentSet?.tags}
        license={currentSet?.license}
        units={currentSet?.units}
        version={currentSet?.version}
        created={currentSet?.created}
      />

      <div className={`modal${isUsageOpen ? ' is-open' : ''}`} aria-modal="true" role="dialog" aria-labelledby="usageModalTitle">
        <div className="modal__backdrop" onClick={() => setIsUsageOpen(false)}></div>
        <div className="modal__content modal__content--usage">
          <button className="modal__close" aria-label="Close usage help" onClick={() => setIsUsageOpen(false)}>
            ×
          </button>
          <h2 id="usageModalTitle" className="modal__title">Usage</h2>
          <div className="build-usage-modal__body">
            {buildMode === 'manual' ? (
              <>
                <p>Select a part in settings first.</p>
                <p><kbd>Click</kbd> a placed part to show placements.</p>
                <p><kbd>Hover</kbd> or <kbd>tap</kbd> a ghost to preview it.</p>
                <p><kbd>Click</kbd> or <kbd>tap</kbd> the previewed ghost to place it.</p>
                <p><kbd>Right-click</kbd> a part to remove it.</p>
                <p><kbd>Left</kbd>/<kbd>Right</kbd> switches placement variants.</p>
                <p><kbd>Up</kbd>/<kbd>Down</kbd> switches parts.</p>
                <p><kbd>Esc</kbd> deselects the current part.</p>
              </>
            ) : (
              <>
                <p>Use the slider to grow or shrink the aggregation.</p>
                <p>Toggle parts off to exclude them from random growth.</p>
                <p>Use the color swatch to update part materials.</p>
              </>
            )}
          </div>
        </div>
      </div>

      <div className={`modal${isPartSettingsOpen ? ' is-open' : ''}`} aria-modal="true" role="dialog" aria-labelledby="partSettingsModalTitle">
        <div className="modal__backdrop" onClick={() => setIsPartSettingsOpen(false)}></div>
        <div className="modal__content modal__content--part-settings">
          <button className="modal__close" aria-label="Close part settings" onClick={() => setIsPartSettingsOpen(false)}>
            ×
          </button>
          <h2 id="partSettingsModalTitle" className="modal__title">Part Color Settings</h2>
          <PartColorSettings
            catalog={catalog}
            onColorChange={handleColorChange}
          />
        </div>
      </div>
    </div>
  );
}
