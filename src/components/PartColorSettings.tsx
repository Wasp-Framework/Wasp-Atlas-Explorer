import React from 'react';
import type { PartCatalogEntry } from '../state/buildState';

type Props = {
  catalog: PartCatalogEntry[];
  onColorChange: (name: string, hex: string) => void;
};

export function PartColorSettings({ catalog, onColorChange }: Props) {
  return (
    <div className="part-color-settings">
      <h3 className="part-color-settings__title">Part Colors</h3>
      <ul className="part-color-settings__list">
        {catalog.map((entry) => (
          <li key={entry.name} className="part-color-settings__item">
            <span className="part-color-settings__name">{entry.name}</span>
            <label className="part-color-settings__picker" title={`Change color for ${entry.name}`}>
              <span className="part-color-settings__swatch" style={{ backgroundColor: entry.color }} />
              <input
                type="color"
                className="part-color-settings__input"
                value={entry.color}
                onChange={(e) => onColorChange(entry.name, e.target.value)}
              />
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
