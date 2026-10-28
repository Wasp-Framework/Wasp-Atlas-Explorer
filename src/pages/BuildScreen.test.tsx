// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { BuildScreen } from './BuildScreen';
import { useBuildStore } from '../state/buildStore';
import { loadAvailableSets } from '../config/availableSets';
import * as runtime from '../lib/buildRuntime';

vi.mock('../lib/buildRuntime');
vi.mock('../config/availableSets', async (importOriginal) => ({
  ...await importOriginal<any>(),
  loadAvailableSets: vi.fn(),
}));

const catalog = ['A', 'B', 'C', 'D'].map((name) => ({ name, color: '#123456', active: true }));
let viewer: HTMLElement;
let parentId: number | string;
let getValidPlacementsAtParent: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  vi.resetAllMocks();
  useBuildStore.getState().resetBuildState();
  parentId = 1;
  vi.mocked(loadAvailableSets).mockResolvedValue({
    sets: [{ slug: 'demo', name: 'Demo' } as any], fromBackup: false, notice: null,
  });
  getValidPlacementsAtParent = vi.fn((name, id) => {
    if (id === 1 && (name === 'B' || name === 'D')) {
      return [{ parentPartId: id, partName: name, connectionId: 0, connectionBId: 0 }];
    }
    return [];
  });
  vi.mocked(runtime.loadDataset).mockResolvedValue({
    aggregation: { parts: {}, aggregated_parts: [{ id: 1 }, { id: 2 }],
      getValidPlacementsAtParent, setActivePartTypes: vi.fn() },
    colorsConfig: {}, catalog, warnings: [],
  } as any);
  vi.mocked(runtime.createVisualizerInContainer).mockReturnValue({});
  vi.mocked(runtime.initializeAggregationScene).mockResolvedValue(2);
  vi.mocked(runtime.raycastParts).mockImplementation(() => ({ partId: parentId } as any));
  const result = render(
    <MemoryRouter initialEntries={['/build/demo']}>
      <Routes><Route path="/build/:slug" element={<BuildScreen onOpenAbout={() => {}} />} /></Routes>
    </MemoryRouter>,
  );
  await waitFor(() => expect(useBuildStore.getState().catalog).toHaveLength(4));
  fireEvent.click(screen.getByRole('button', { name: 'Manual' }));
  viewer = result.container.querySelector('.build-viewer') as HTMLElement;
});

afterEach(() => { cleanup(); });

function partButtons(name: string) {
  return [
    within(screen.getByLabelText('Part selection')).getByRole('button', { name }),
    within(document.querySelector('.part-catalog') as HTMLElement).getByRole('button', { name }),
  ] as HTMLButtonElement[];
}

it('disables incompatible parts in both lists and cycles only valid parts with wraparound', () => {
  fireEvent.click(viewer);
  expect(useBuildStore.getState().selectedPartName).toBe('B');
  for (const name of ['A', 'C']) {
    for (const button of partButtons(name)) {
      expect(button.disabled).toBe(true);
      fireEvent.click(button);
      expect(useBuildStore.getState().selectedPartName).toBe('B');
    }
  }
  for (const button of partButtons('D')) expect(button.disabled).toBe(false);
  fireEvent.keyDown(window, { key: 'ArrowDown' });
  expect(useBuildStore.getState().selectedPartName).toBe('D');
  fireEvent.keyDown(window, { key: 'ArrowDown' });
  expect(useBuildStore.getState().selectedPartName).toBe('B');
  fireEvent.keyDown(window, { key: 'ArrowUp' });
  expect(useBuildStore.getState().selectedPartName).toBe('D');
  expect(getValidPlacementsAtParent).toHaveBeenCalledTimes(4);
});

it('preserves the parent when selecting candidates from either list and reuses cached placements', () => {
  fireEvent.click(viewer);
  fireEvent.click(partButtons('D')[0]);
  fireEvent.click(partButtons('B')[1]);
  expect(useBuildStore.getState().selectedPartName).toBe('B');
  expect(partButtons('A').every((button) => button.disabled)).toBe(true);
  expect(runtime.addGhostMeshes).toHaveBeenLastCalledWith(
    expect.anything(), [expect.objectContaining({ parentPartId: 1, partName: 'B' })], expect.anything(),
  );
  expect(getValidPlacementsAtParent).toHaveBeenCalledTimes(4);
});

it('retains a compatible candidate and safely handles one or no available parts', () => {
  fireEvent.click(partButtons('D')[0]);
  fireEvent.click(viewer);
  expect(useBuildStore.getState().selectedPartName).toBe('D');
  getValidPlacementsAtParent.mockImplementation((name, id) =>
    name === 'D' ? [{ parentPartId: id, partName: name, connectionId: 0 }] : []);
  fireEvent.click(viewer);
  fireEvent.keyDown(window, { key: 'ArrowDown' });
  expect(useBuildStore.getState().selectedPartName).toBe('D');
  parentId = 2;
  getValidPlacementsAtParent.mockReturnValue([]);
  fireEvent.click(viewer);
  expect(useBuildStore.getState().selectedPartName).toBeNull();
  expect(screen.getByText('No valid placements on this part')).toBeTruthy();
  for (const entry of catalog) expect(partButtons(entry.name).every((button) => button.disabled)).toBe(true);
  fireEvent.keyDown(window, { key: 'ArrowDown' });
  fireEvent.keyDown(window, { key: 'ArrowUp' });
  expect(useBuildStore.getState().selectedPartName).toBeNull();
});

it('restores all parts after Escape, deletion, and mode changes', () => {
  fireEvent.click(viewer);
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(partButtons('A').every((button) => !button.disabled)).toBe(true);
  fireEvent.keyDown(window, { key: 'ArrowUp' });
  expect(useBuildStore.getState().selectedPartName).toBe('D');
  fireEvent.click(viewer);
  fireEvent.contextMenu(viewer);
  expect(partButtons('A').every((button) => !button.disabled)).toBe(true);
  fireEvent.click(viewer);
  fireEvent.click(screen.getByRole('button', { name: 'Random' }));
  expect(partButtons('A').every((button) => !button.disabled)).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Manual' }));
  expect(partButtons('A').every((button) => !button.disabled)).toBe(true);
});

it('clears availability after placing a ghost and recomputes it for the next parent selection', () => {
  fireEvent.click(viewer);
  vi.mocked(runtime.raycastGhosts).mockReturnValue({ index: 0 } as any);
  vi.mocked(runtime.getGhostPlacementData).mockReturnValue({
    parentPartId: 1, connectionId: 0, partName: 'B', connectionBId: 0,
  } as any);
  fireEvent.click(viewer);
  fireEvent.click(viewer);
  expect(runtime.placePartManually).toHaveBeenCalledWith(
    expect.anything(), 1, 0, 'B', 0, expect.anything(), undefined,
  );
  expect(partButtons('A').every((button) => !button.disabled)).toBe(true);
  vi.mocked(runtime.raycastGhosts).mockReturnValue(null);
  getValidPlacementsAtParent.mockReturnValue([]);
  fireEvent.click(viewer);
  expect(getValidPlacementsAtParent).toHaveBeenCalledTimes(8);
  expect(useBuildStore.getState().selectedPartName).toBeNull();
});

it('clears availability when loading a different dataset', async () => {
  fireEvent.click(viewer);
  act(() => {
    useBuildStore.getState().setUploadedDataset({
      setName: 'Other dataset', aggregationData: {}, byPart: {},
    });
  });
  await waitFor(() => expect(runtime.loadDataset).toHaveBeenCalledTimes(2));
  expect(partButtons('A').every((button) => !button.disabled)).toBe(true);
});

it('queries and caches availability using the exact string parent ID', () => {
  parentId = '42-beam_with_underscores';
  getValidPlacementsAtParent.mockImplementation((name, id) =>
    name === 'D' && id === parentId
      ? [{ parentPartId: id, partName: name, connectionId: 0, connectionBId: 0 }]
      : []);
  fireEvent.click(viewer);
  expect(useBuildStore.getState().selectedPartName).toBe('D');
  expect(getValidPlacementsAtParent).toHaveBeenCalledTimes(4);
  for (const entry of catalog) {
    expect(getValidPlacementsAtParent).toHaveBeenCalledWith(entry.name, parentId);
  }
  expect(partButtons('A').every(button => button.disabled)).toBe(true);
  fireEvent.keyDown(window, { key: 'ArrowDown' });
  expect(useBuildStore.getState().selectedPartName).toBe('D');
  expect(getValidPlacementsAtParent).toHaveBeenCalledTimes(4);
  expect(runtime.addGhostMeshes).toHaveBeenLastCalledWith(
    expect.anything(), [expect.objectContaining({ parentPartId: parentId, partName: 'D' })], expect.anything(),
  );
});
