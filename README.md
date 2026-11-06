# Wasp-Atlas-Explorer

`Wasp-Atlas-Explorer` is a React application for browsing and interacting with modular building systems powered by `webwaspjs`.

## Install

```bash
npm install
```

## Quick start

```bash
npm run dev
```

The app reads dataset catalog data from the public Wasp Atlas collection repository and renders interactive assemblies in the browser.

## Local MCP integration

The app provides an opt-in browser command interface for a local MCP companion.
Open it with `?mcp=1` to expose `window.waspAtlas` (interface version 1).
The companion can list/open catalog datasets, inspect the live assembly, preview
explicit placements, place parts, remove leaf parts, export Light JSON and capture
the existing viewer with a preset or custom camera. The browser app retains
ownership of the assembly and uses the same editing helpers as its manual UI.

MCP sessions keep empty datasets empty instead of generating 50 random parts on
opening. Existing placed parts are retained unless the companion requests
`startEmpty: true` when opening a dataset. Edits require the current opaque
revision token; interactive assembly changes invalidate previous tokens. Reloads
start a new session. The bridge adds no network listener or backend requirement,
so static GitHub Pages hosting still works. The companion must control a browser
running this updated app; earlier deployed versions do not expose the interface.

Implementation: [browser bridge](src/lib/atlasBridge.ts) and
[assembly commands](src/lib/atlasCommands.ts). Ordinary visits without `?mcp=1`
do not expose the bridge and retain the usual initial growth behavior.

## Development

Requirements:

- Node.js 18+
- npm 9+

Commands:

- `npm run dev`
- `npm run build`
- `npm run preview`
- `npm run typecheck`
- `npm test`

## Related repositories

- [webwaspjs](https://github.com/winroger/waspjs)
- [Wasp Atlas collection](https://github.com/Wasp-Framework/Wasp-Atlas-Collection)

## Credits

- Roger Winkler — [rogerwinkler.de](https://www.rogerwinkler.de)
- Andrea Rossi — [thecomputationalhive.com](https://thecomputationalhive.com/)

Based on the original [WASP](https://github.com/ar0551/Wasp) Grasshopper plug-in by Andrea Rossi.

## License

MIT. See [LICENSE.txt](LICENSE.txt).
