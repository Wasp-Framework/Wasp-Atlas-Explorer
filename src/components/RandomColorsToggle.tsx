import React from 'react';

export function RandomColorsToggle({ checked, onChange }: {
  checked: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <label className="random-colors-toggle">
      <span>Random colors on all parts</span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}
