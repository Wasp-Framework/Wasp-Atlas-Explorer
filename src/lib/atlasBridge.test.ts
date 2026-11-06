// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { installAtlasBridge, markAtlasChanged, registerAtlasBuild } from './atlasBridge';
import { loadAvailableSets } from '../config/availableSets';
import { useBuildStore } from '../state/buildStore';

vi.mock('../config/availableSets', async (original) => ({
  ...(await original<any>()),
  loadAvailableSets: vi.fn(),
}));
let cleanup: Array<() => void>;
beforeEach(() => {
  cleanup = [];
  useBuildStore.getState().resetBuildState();
  vi.mocked(loadAvailableSets).mockResolvedValue({
    sets: [{ slug: 'demo' } as any],
    notice: null,
    fromBackup: false,
  });
});
afterEach(() => {
  cleanup.reverse().forEach((dispose) => dispose());
  window.history.replaceState({}, '', '/');
  vi.restoreAllMocks();
});

it('exposes no commands on ordinary visits and cleans up opt-in sessions', () => {
  cleanup.push(installAtlasBridge(vi.fn()));
  expect(window.waspAtlas).toBeUndefined();
  window.history.replaceState({}, '', '/?mcp=1');
  const dispose = installAtlasBridge(vi.fn());
  expect(window.waspAtlas?.version).toBe(1);
  dispose();
  expect(window.waspAtlas).toBeUndefined();
});

it('does not report a scene ready until its runtime load finishes', async () => {
  window.history.replaceState({}, '', '/?mcp=1');
  cleanup.push(installAtlasBridge(vi.fn()));
  let ready = false;
  cleanup.push(
    registerAtlasBuild({
      execute: () => ({ partCount: 0 }),
      status: () => ({ ready, busy: false, requestId: 'request' }),
    }),
  );
  expect(window.waspAtlas!.status()).toMatchObject({ ready: false, requestId: 'request' });
  await expect(window.waspAtlas!.execute('inspect_assembly')).rejects.toThrow(/wait for loading/);
  ready = true;
  const result = await window.waspAtlas!.execute('inspect_assembly');
  expect(result.value.partCount).toBe(0);
  markAtlasChanged();
  await expect(
    window.waspAtlas!.execute('place_part', { expectedRevision: result.revision }),
  ).rejects.toThrow(/stale_revision/);
});

it('rechecks revisions after an asynchronous catalog load before replacing the assembly', async () => {
  window.history.replaceState({}, '', '/?mcp=1');
  const navigate = vi.fn();
  cleanup.push(installAtlasBridge(navigate));
  const revision = window.waspAtlas!.status().revision;
  const request = window.waspAtlas!.execute('open_dataset', {
    slug: 'demo',
    expectedRevision: revision,
  });
  markAtlasChanged();
  await expect(request).rejects.toThrow(/stale_revision/);
  expect(navigate).not.toHaveBeenCalled();
  await window.waspAtlas!.execute('open_dataset', {
    slug: 'demo',
    startEmpty: true,
    expectedRevision: window.waspAtlas!.status().revision,
  });
  expect(navigate).toHaveBeenCalledWith(
    expect.stringMatching(/^\/build\/demo\?mcp=1&atlasLoad=.+&atlasEmpty=1$/),
  );
});
