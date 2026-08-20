import React from 'react';

type Props = {
  selectedPartName: string | null;
  partCount: number;
  onOpenPartSettings: () => void;
};

export function ManualControls({ selectedPartName, partCount, onOpenPartSettings }: Props) {
  return (
    <div className="manual-controls">
      <div className="controls-toolbar">
        <div className="manual-controls__status">
          <p className="manual-controls__info">
            {selectedPartName
              ? <>Placing: <strong>{selectedPartName}</strong></>
              : 'Select a part in the bar above'}
          </p>
          <p className="manual-controls__count">
            Parts placed: <strong>{partCount}</strong>
          </p>
        </div>
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
    </div>
  );
}
