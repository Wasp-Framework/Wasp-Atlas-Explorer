import React from 'react';

type Props = {
  targetCount: number;
  onTargetChange: (count: number) => void;
  onOpenPartSettings: () => void;
};

export function RandomControls({ targetCount, onTargetChange, onOpenPartSettings }: Props) {
  return (
    <div className="random-controls">
      <div className="controls-toolbar">
        <label className="random-controls__label">
          Parts: <strong>{targetCount}</strong>
        </label>
        <button
          className="controls-toolbar__settings"
          type="button"
          onClick={onOpenPartSettings}
          aria-label="Open part settings"
          title="Open part settings"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3.25" />
            <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a2 2 0 0 1-4 0v-.2a1 1 0 0 0-.7-.9 1 1 0 0 0-1.1.2l-.1.1a2 2 0 0 1-2.8-2.8l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a2 2 0 0 1 0-4h.2a1 1 0 0 0 .9-.7 1 1 0 0 0-.2-1.1l-.1-.1a2 2 0 0 1 2.8-2.8l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V4a2 2 0 0 1 4 0v.2a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a2 2 0 0 1 2.8 2.8l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6h.2a2 2 0 0 1 0 4h-.2a1 1 0 0 0-.9.7Z" />
          </svg>
        </button>
      </div>
      <input
        type="range"
        className="random-controls__slider"
        min={1}
        max={500}
        step={1}
        value={targetCount}
        onChange={(e) => onTargetChange(Number(e.target.value))}
      />
    </div>
  );
}
