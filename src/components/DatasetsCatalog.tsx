import React from 'react';
import type { PartCatalogEntry, BuildMode } from '../state/buildState';

type Props = {
  remainingStock?: Record<string, number>;
  catalog: PartCatalogEntry[];
  availablePartNames?: Set<string> | null;
  selectedPartName: string | null;
  buildMode: BuildMode;
  onToggleActive: (name: string) => void;
  onColorChange: (name: string, hex: string) => void;
  onSelectPart: (name: string | null) => void;
};

export function DatasetsCatalog({
  remainingStock,
  catalog,
  availablePartNames,
  selectedPartName,
  buildMode,
  onToggleActive,
  onColorChange,
  onSelectPart,
}: Props) {
  return (
    <div className="part-catalog">
      <h3 className="part-catalog__title">Parts</h3>
      <ul className="part-catalog__list">
        {catalog.map((entry) => {
          const isSelected = entry.name === selectedPartName;
          const isInactiveInRandomMode = buildMode === 'random' && !entry.active;
          const isUnavailable = buildMode === 'manual' && availablePartNames != null && !availablePartNames.has(entry.name);
          return (
            <li
              key={entry.name}
              className={`part-catalog__item ${isSelected ? 'part-catalog__item--selected' : ''} ${isInactiveInRandomMode || isUnavailable ? 'part-catalog__item--inactive' : ''}`}
            >
              {buildMode === 'random' && (
                <button
                  className={`part-catalog__toggle ${entry.active ? 'part-catalog__toggle--on' : ''}`}
                  onClick={() => onToggleActive(entry.name)}
                  title={entry.active ? 'Deactivate' : 'Activate'}
                >
                  {entry.active ? '✓' : '✗'}
                </button>
              )}

              <button
                className="part-catalog__name"
                disabled={isUnavailable}
                onClick={() => {
                  if (buildMode === 'manual') {
                    onSelectPart(isSelected ? null : entry.name);
                  }
                }}
                title={buildMode === 'manual' ? (isUnavailable ? 'No valid placements on this part' : 'Select for placement') : entry.name}
              >
                {entry.name}
                {remainingStock?.[entry.name] != null ? ` (${remainingStock[entry.name]} left)` : ''}
              </button>

              <label className="part-catalog__color" title={`Change color for ${entry.name}`}>
                <span
                  className="part-catalog__swatch"
                  style={{ backgroundColor: entry.color }}
                />
                <input
                  type="color"
                  className="part-catalog__color-input"
                  value={entry.color}
                  onChange={(e) => onColorChange(entry.name, e.target.value)}
                />
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
