import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CUSTOM_UPLOAD_SLUG, loadAvailableSets, type DemoSetConfig } from '../config/availableSets';
import { aggregationService } from '../lib/aggregationService';
import { createDefaultPartColorConfig } from '../lib/defaultColors';
import { formatDisplayDate } from '../lib/formatDate';
import { sanitizeUploadedAggregationData } from '../lib/uploadSanitizer';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { useBuildStore } from '../state/buildStore';
import type { PartCatalogEntry } from '../state/buildState';

function DatasetCard({
  set,
  onSelect,
  onShowInfo,
}: {
  set: DemoSetConfig;
  onSelect: (slug: string) => void;
  onShowInfo: (set: DemoSetConfig) => void;
}) {
  return (
    <div className="landing-card">
      <button
        className="landing-card__preview"
        onClick={() => onSelect(set.slug)}
        type="button"
      >
        {set.thumbnail ? (
          <img
            className="landing-card__thumbnail"
            src={set.thumbnail}
            alt={`${set.name} preview`}
            loading="lazy"
          />
        ) : (
          <div className="landing-card__thumbnail-fallback" aria-hidden="true">
            <span>{set.name}</span>
          </div>
        )}
      </button>

      <div className="landing-card__footer">
        <span className="landing-card__title">{set.name}</span>
        <button
          className="landing-card__info-btn"
          onClick={(e) => {
            e.stopPropagation();
            onShowInfo(set);
          }}
          title="Dataset info"
          aria-label={`Info about ${set.name}`}
        >
          <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor" aria-hidden="true">
            <path d="M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm.75 12.5h-1.5v-5h1.5v5Zm0-6.5h-1.5V6.5h1.5V8Z"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

function DatasetInfoModal({
  set,
  onClose,
}: {
  set: DemoSetConfig | null;
  onClose: () => void;
}) {
  if (!set) return null;
  return (
    <div className="modal is-open" aria-modal="true" role="dialog">
      <div className="modal__backdrop" onClick={onClose} />
      <div className="modal__content">
        <button className="modal__close" aria-label="Close info" onClick={onClose}>
          ×
        </button>
        <h2 className="modal__title">{set.name}</h2>
        <dl className="modal__meta">
          {set.description && (
            <div>
              <dt>Description</dt>
              <dd>{set.description}</dd>
            </div>
          )}
          {set.author && (
            <div>
              <dt>Author</dt>
              <dd>{set.author}</dd>
            </div>
          )}
          {set.tags && set.tags.length > 0 ? (
            <div>
              <dt>Tags</dt>
              <dd>
                <div className="modal__tags">
                  {set.tags.map((tag) => (
                    <span key={tag} className="modal__tag">{tag}</span>
                  ))}
                </div>
              </dd>
            </div>
          ) : null}
          {set.license ? (
            <div>
              <dt>License</dt>
              <dd>{set.license}</dd>
            </div>
          ) : null}
          {set.units ? (
            <div>
              <dt>Units</dt>
              <dd>{set.units}</dd>
            </div>
          ) : null}
          {set.version ? (
            <div>
              <dt>Version</dt>
              <dd>{set.version}</dd>
            </div>
          ) : null}
          {set.created ? (
            <div>
              <dt>Created</dt>
              <dd>{formatDisplayDate(set.created)}</dd>
            </div>
          ) : null}
          {typeof set.partsCount === 'number' ? (
            <div>
              <dt>Parts</dt>
              <dd>{set.partsCount}</dd>
            </div>
          ) : null}
          {typeof set.rulesCount === 'number' ? (
            <div>
              <dt>Rules</dt>
              <dd>{set.rulesCount}</dd>
            </div>
          ) : null}
        </dl>
      </div>
    </div>
  );
}

function UploadStartModal({
  isOpen,
  uploadError,
  onClose,
  onFileChange,
}: {
  isOpen: boolean;
  uploadError: string | null;
  onClose: () => void;
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="modal is-open" aria-modal="true" role="dialog">
      <div className="modal__backdrop" onClick={onClose} />
      <div className="modal__content modal__content--upload-start">
        <button className="modal__close" aria-label="Close upload instructions" onClick={onClose}>
          ×
        </button>
        <h2 className="modal__title">Test your own aggregation</h2>
        <p className="upload-start__copy">
          Upload a Wasp serialized aggregation JSON from Grasshopper via "Wasp_Serialize Object to File" in the "7 | IO" category, or re-upload a Wasp-compatible JSON downloaded from Wasp-Atlas.
        </p>
        <label className="landing__cta-secondary upload-start__button">
          Upload
          <input
            className="upload-start__file-input"
            type="file"
            accept="application/json,.json"
            onChange={onFileChange}
          />
        </label>
        {uploadError ? (
          <p className="upload-start__error" role="alert" aria-live="polite">
            {uploadError}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function UploadDatasetModal({
  fileName,
  parts,
  warnings,
  onClose,
  onColorChange,
  onConfirm,
}: {
  fileName: string;
  parts: PartCatalogEntry[];
  warnings: string[];
  onClose: () => void;
  onColorChange: (name: string, color: string) => void;
  onConfirm: () => void;
}) {
  return (
    <div className="modal is-open" aria-modal="true" role="dialog">
      <div className="modal__backdrop" onClick={onClose} />
      <div className="modal__content modal__content--upload-config">
        <button className="modal__close" aria-label="Close upload dialog" onClick={onClose}>
          ×
        </button>
        <h2 className="modal__title">Try your own</h2>
        <p className="upload-modal__subtitle">{fileName}</p>
        <p className="upload-modal__help">Set colors for detected parts before opening the build screen.</p>
        {warnings.length > 0 ? (
          <div className="dataset-source-notice upload-modal__warning" role="status" aria-live="polite">
            <strong>Loaded with unsupported features ignored.</strong>
            <ul className="upload-modal__warning-list">
              {warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <ul className="upload-modal__parts">
          {parts.map((entry) => (
            <li key={entry.name} className="upload-modal__part">
              <span className="upload-modal__part-name">{entry.name}</span>
              <label className="upload-modal__color" title={`Set color for ${entry.name}`}>
                <span className="upload-modal__swatch" style={{ backgroundColor: entry.color }} />
                <input
                  className="upload-modal__color-input"
                  type="color"
                  value={entry.color}
                  onChange={(e) => onColorChange(entry.name, e.target.value)}
                />
              </label>
            </li>
          ))}
        </ul>
        <div className="upload-modal__actions">
          <button className="landing__cta-secondary" type="button" onClick={onClose}>Cancel</button>
          <button className="landing__cta-primary" type="button" onClick={onConfirm}>Open build screen</button>
        </div>
      </div>
    </div>
  );
}

export function DatasetsPage({ onOpenAbout }: { onOpenAbout: () => void }) {
  const navigate = useNavigate();
  const setUploadedDataset = useBuildStore((store) => store.setUploadedDataset);
  const setBuildMode = useBuildStore((store) => store.setBuildMode);
  const [sets, setSets] = useState<DemoSetConfig[]>([]);
  const [catalogNotice, setCatalogNotice] = useState<string | null>(null);
  const [infoSet, setInfoSet] = useState<DemoSetConfig | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadStartOpen, setUploadStartOpen] = useState(false);
  const [uploadFileName, setUploadFileName] = useState<string>('');
  const [uploadedAggregationData, setUploadedAggregationData] = useState<any>(null);
  const [uploadParts, setUploadParts] = useState<PartCatalogEntry[] | null>(null);
  const [uploadWarnings, setUploadWarnings] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      const result = await loadAvailableSets();
      if (!active) return;
      setSets(result.sets);
      setCatalogNotice(result.notice);
    })();

    return () => {
      active = false;
    };
  }, []);

  const handleSelect = useCallback(
    (slug: string) => {
      if (slug === CUSTOM_UPLOAD_SLUG) {
        setUploadError(null);
        setUploadWarnings([]);
        setUploadStartOpen(true);
        return;
      }
      navigate(`/build/${slug}`);
    },
    [navigate],
  );

  const handleUploadColorChange = useCallback((name: string, color: string) => {
    setUploadParts((current) => {
      if (!current) return current;
      return current.map((entry) => (entry.name === name ? { ...entry, color } : entry));
    });
  }, []);

  const handleUploadInput = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setUploadError(null);
    setUploadWarnings([]);

    try {
      const rawText = await file.text();
      const parsedData = JSON.parse(rawText);
      const { aggregationData, warnings } = sanitizeUploadedAggregationData(parsedData);
      const aggregation = aggregationService.createAggregationFromData(aggregationData);
      const parts = aggregationService.getAggregationCatalogParts(aggregation);

      if (!parts.length) {
        throw new Error('No parts were detected in aggregation.json.');
      }

      setUploadFileName(file.name);
      setUploadedAggregationData(aggregationData);
      setUploadWarnings(warnings);
      setUploadStartOpen(false);
      const fallbackColors = createDefaultPartColorConfig(parts.map((part) => part.name));
      setUploadParts(
        parts.map((part) => ({
          name: part.name,
          color: fallbackColors.byPart[part.name],
          active: true,
        })),
      );
    } catch (err: any) {
      setUploadParts(null);
      setUploadedAggregationData(null);
      setUploadWarnings([]);
      setUploadError(err?.message || 'Could not load aggregation.json. Please check file format.');
    }
  }, []);

  const closeUploadModal = useCallback(() => {
    setUploadParts(null);
    setUploadedAggregationData(null);
    setUploadWarnings([]);
  }, []);

  const handleUploadConfirm = useCallback(() => {
    if (!uploadParts || !uploadedAggregationData) return;

    const byPart = uploadParts.reduce<Record<string, string>>((acc, entry) => {
      acc[entry.name] = entry.color;
      return acc;
    }, {});

    const baseName = uploadFileName.replace(/\.json$/i, '').trim();
    setUploadedDataset({
      setName: baseName || 'Custom upload',
      aggregationData: uploadedAggregationData,
      byPart,
      warnings: uploadWarnings,
    });
    setBuildMode('random');

    closeUploadModal();
    navigate(`/build/${CUSTOM_UPLOAD_SLUG}`);
  }, [uploadParts, uploadedAggregationData, uploadFileName, setUploadedDataset, setBuildMode, closeUploadModal, navigate, uploadWarnings]);

  return (
    <div className="datasets-page">
      <Navbar onOpenAbout={onOpenAbout} />

      <main className="datasets-page__main">
        <section className="landing__datasets" aria-label="Available datasets">
          <div className="landing__datasets-header">
            <div className="datasets-page__intro">
              <h1 className="datasets-page__title">Datasets</h1>
            </div>
          </div>
          {catalogNotice ? (
            <p className="dataset-source-notice" role="status" aria-live="polite">
              {catalogNotice}
            </p>
          ) : null}
          <div className="landing__grid datasets-page__grid">
            {sets.map((set) => (
              <DatasetCard
                key={set.slug}
                set={set}
                onSelect={handleSelect}
                onShowInfo={setInfoSet}
              />
            ))}
            <div className="landing-card landing-card--upload">
              <button className="landing-card__preview landing-card__preview--upload" onClick={() => handleSelect(CUSTOM_UPLOAD_SLUG)} type="button">
                <svg className="landing-card__upload-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 20.5a1 1 0 0 1-1-1v-7.09l-2.8 2.8a1 1 0 1 1-1.4-1.42l4.5-4.5a1 1 0 0 1 1.4 0l4.5 4.5a1 1 0 1 1-1.4 1.42l-2.8-2.8v7.09a1 1 0 0 1-1 1ZM5 8.5a1 1 0 0 1-1-1V6A2.5 2.5 0 0 1 6.5 3.5h11A2.5 2.5 0 0 1 20 6v1.5a1 1 0 1 1-2 0V6a.5.5 0 0 0-.5-.5h-11A.5.5 0 0 0 6 6v1.5a1 1 0 0 1-1 1Z" />
                </svg>
              </button>
              <div className="landing-card__footer">
                <span className="landing-card__title">Test your own aggregation</span>
              </div>
            </div>
          </div>
        </section>
      </main>

      <DatasetInfoModal set={infoSet} onClose={() => setInfoSet(null)} />
      <UploadStartModal
        isOpen={uploadStartOpen}
        uploadError={uploadError}
        onClose={() => setUploadStartOpen(false)}
        onFileChange={handleUploadInput}
      />
      {uploadParts ? (
        <UploadDatasetModal
          fileName={uploadFileName}
          parts={uploadParts}
          warnings={uploadWarnings}
          onClose={closeUploadModal}
          onColorChange={handleUploadColorChange}
          onConfirm={handleUploadConfirm}
        />
      ) : null}

      <Footer />
    </div>
  );
}
