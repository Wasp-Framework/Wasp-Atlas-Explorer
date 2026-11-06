/** Opt-in browser command interface. Assembly behavior stays in the Atlas runtime. */
import { loadAvailableSets } from '../config/availableSets';
import { useBuildStore } from '../state/buildStore';

type BuildCommands = (command: string, args: any) => any;
type BuildHandle = {
  execute: BuildCommands;
  status: () => { ready: boolean; busy: boolean; requestId: string | null };
};
let build: BuildHandle | null = null;
// These identify documents/loads, not credentials; LAN development may lack secure-context crypto.
const identifier = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const session = identifier();
let revision = 0;

export const atlasMcpEnabled = () => new URLSearchParams(window.location.search).get('mcp') === '1';
export const atlasRevision = () => `${session}:${revision}`;
export function markAtlasChanged() {
  revision += 1;
}

export function registerAtlasBuild(handle: BuildHandle) {
  build = handle;
  return () => {
    if (build === handle) build = null;
  };
}

export function installAtlasBridge(navigate: (path: string) => void) {
  if (!atlasMcpEnabled()) return () => {};
  const bridge = {
    version: 1,
    status() {
      const state = useBuildStore.getState();
      const runtime = build?.status();
      return {
        revision: atlasRevision(),
        slug: state.slug,
        loading: state.isLoading,
        error: state.isLoading ? null : state.loadError,
        ready: !!runtime?.ready && !state.isLoading && !state.loadError,
        requestId: runtime?.requestId ?? null,
      };
    },
    async execute(command: string, args: any = {}) {
      if (['open_dataset', 'place_part', 'remove_part'].includes(command) && typeof args.expectedRevision !== 'string') {
        throw new Error('Provide the current expectedRevision before editing.');
      }
      if (args.expectedRevision !== undefined && args.expectedRevision !== atlasRevision()) {
        throw new Error('stale_revision: Inspect the assembly before editing again.');
      }
      if (command === 'list_datasets') {
        const result = await loadAvailableSets();
        if (result.notice) throw new Error(result.notice);
        return { revision: atlasRevision(), value: result.sets };
      }
      if (command === 'open_dataset') {
        if (build?.status().busy) throw new Error('Wait for the current assembly edit to finish.');
        const result = await loadAvailableSets();
        if (!result.sets.some((set) => set.slug === args.slug))
          throw new Error('Unknown dataset slug.');
        // Recheck after the catalog request; the user may have edited in the meantime.
        if (args.expectedRevision !== atlasRevision())
          throw new Error('stale_revision: Inspect before opening a dataset.');
        const requestId = identifier();
        navigate(
          `/build/${encodeURIComponent(args.slug)}?mcp=1&atlasLoad=${requestId}${args.startEmpty ? '&atlasEmpty=1' : ''}`,
        );
        return { revision: atlasRevision(), value: { slug: args.slug, requestId } };
      }
      if (!bridge.status().ready) throw new Error('Open a dataset and wait for loading to finish.');
      const value = build!.execute(command, args);
      return { revision: atlasRevision(), value };
    },
  };
  window.waspAtlas = bridge;
  return () => {
    if (window.waspAtlas === bridge) delete window.waspAtlas;
  };
}

declare global {
  interface Window {
    waspAtlas?: {
      version: number;
      status: () => any;
      execute: (command: string, args?: any) => Promise<any>;
    };
  }
}
