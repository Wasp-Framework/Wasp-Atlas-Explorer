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

## Open in HiveLens

The build viewer's **Open in HiveLens** button opens a sharing dialog. Choose
**Create link** to upload a snapshot, then scan its QR code on a phone or copy
the link to a headset. It uses the same `aggregation.toData(false)` export as
Download. Anyone with the link can download the snapshot for 24 hours; imported
copies can remain on receiving devices. Creating a share requires no account.

The default destination is `https://hivelens.thecomputationalhive.com`.
Override it with `VITE_HIVELENS_URL` in `.env.local` or the build environment.
For example, when developing against HiveLens on port 5175:

```text
VITE_HIVELENS_URL=https://localhost:5175
```

HiveLens must configure its private Vercel Blob store, sharing secrets and
Firewall rules, and allow the Atlas origin in its server-side
`SHARE_ALLOWED_ORIGINS` setting. See the HiveLens repository's `docs/sharing.md`.
The default remains disabled until backend configuration is complete. Plain
`vite` does not run Vercel Functions; use a configured HiveLens deployment or
the integration tests described in that guide. No storage secrets belong here.

Dataset units accompany the export. When metadata is missing or unsupported,
HiveLens asks the user to choose millimeters, centimeters, or meters before
staging the assembly. Local assemblies are persisted in HiveLens's browser
storage. The snapshot limit is 20 MB; Download remains available if sharing
fails. This replaces the old same-browser messaging transfer.

## Related repositories

- [webwaspjs](https://github.com/winroger/waspjs)
- [Wasp Atlas collection](https://github.com/Wasp-Framework/Wasp-Atlas-Collection)

## Credits

- Roger Winkler — [rogerwinkler.de](https://www.rogerwinkler.de)
- Andrea Rossi — [thecomputationalhive.com](https://thecomputationalhive.com/)

Based on the original [WASP](https://github.com/ar0551/Wasp) Grasshopper plug-in by Andrea Rossi.

## License

MIT. See [LICENSE.txt](LICENSE.txt).
