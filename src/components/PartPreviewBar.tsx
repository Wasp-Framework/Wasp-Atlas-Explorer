import React from 'react';
import type { BuildMode, PartCatalogEntry } from '../state/buildState';
import { PartPreviewCanvas } from './PartPreviewCanvas';

type Props = {
  catalog: PartCatalogEntry[];
  availablePartNames?: Set<string> | null;
  selectedPartName: string | null;
  buildMode: BuildMode;
  partSources?: Record<string, any>;
  onToggleActive: (name: string) => void;
  onSelectPart: (name: string | null) => void;
};

export function PartPreviewBar({
  catalog,
  availablePartNames,
  selectedPartName,
  buildMode,
  partSources,
  onToggleActive,
  onSelectPart,
}: Props) {
  return (
    <div className="part-preview-bar" aria-label="Part selection">
      {catalog.map((entry) => {
        const isSelected = entry.name === selectedPartName;
        const isActive = entry.active;
        const source = partSources?.[entry.name]?.geo ?? null;
        const isUnavailable = buildMode === 'manual' && availablePartNames != null && !availablePartNames.has(entry.name);
        const isDimmed =
          buildMode === 'random'
            ? !isActive
            : availablePartNames != null ? isUnavailable : Boolean(selectedPartName) && !isSelected;

        return (
          <div
            key={entry.name}
            className={[
              'part-preview-bar__item',
              isSelected ? 'part-preview-bar__item--selected' : '',
              isDimmed ? 'part-preview-bar__item--inactive' : '',
            ].filter(Boolean).join(' ')}
          >
            <button
              className="part-preview-bar__button"
              type="button"
              disabled={isUnavailable}
              onClick={() => {
                if (buildMode === 'random') {
                  onToggleActive(entry.name);
                  return;
                }
                onSelectPart(isSelected ? null : entry.name);
              }}
              title={buildMode === 'random' ? (isActive ? 'Deactivate part' : 'Activate part') : isUnavailable ? 'No valid placements on this part' : 'Select for placement'}
              aria-pressed={buildMode === 'random' ? isActive : isSelected}
            >
              <span className="part-preview-bar__swatch">
                {source ? (
                  <PartPreviewCanvas source={source} color={entry.color} label={entry.name} />
                ) : null}
              </span>
              <span className="part-preview-bar__name">{entry.name}</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
