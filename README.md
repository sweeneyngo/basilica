# basilica

A **crate-digging word wheel** that finds the `ba` in every word and echoes it.
Spin a dark, three-dimensional wheel of ~400 words that all contain "ba"; whatever lands in the center lens stutters — `balloon` becomes `baballoon` — with the original match in marigold and the echoed `ba` in smoke.

basilica keeps no state and talks to no server. It's a single static Vue site: a small string transform, a curated word list baked into the bundle, and a virtualized scroll picker that renders only the rows near the center.

The whole thing builds to a folder of static files and deploys to GitHub Pages.

## How it works

- **The `ba` echo.** `babafy` finds the *first* case-insensitive "ba" in a word and inserts a second one right after it — `balloon → ba·ba·lloon → baballoon`. It returns the word split into parts (`before / matched / inserted / after`) so the UI can color the original match and the echo differently instead of just concatenating a string.
- **The crate.** The word list is every entry from the [dwyl english-words](https://github.com/dwyl/english-words) dictionary that is purely alphabetic, 3–14 letters, and contains "ba" — then filtered down to the common ones by [Norvig frequency](https://norvig.com/ngrams/) (ranked in the top 30k) and sorted A→Z. That leaves ~400 words, from `aba` to `zimbabwe`, baked into `ba-words.json`.
- **The digging wheel.** Rows are a uniform height curved into a 3D cylinder, so a word's position is pure arithmetic and only a small window around the center is ever in the DOM. Scroll velocity drives a vertical motion blur, a pill "lens" frames the centered pick and drifts toward the cursor, and the nearest word snaps onto the lens in JS once scrolling settles. Wheel, touch, and keyboard input all funnel through a single velocity-capped ease, so no input can rocket past the crate.

---

## Installation

Clone the repo and install dependencies:

```bash
git clone https://github.com/sweeneyngo/basilica.git
cd basilica
pnpm install
```

## Usage

Run the Vite dev server, then open the app:

```bash
pnpm dev
```

Open http://localhost:5173 and dig through the crate. Everything drives the same wheel:

```
scroll / drag     spin the crate
↑ ↓               step one word
PgUp / PgDn       jump five words
Home / End        jump to the ends of the alphabet
dig randomly      teleport to a random word
```

There is nothing to configure — no environment variables, no backend, no persisted state. The word list lives in code and the transform runs entirely in the browser.

## Building

### Prerequisites

- [Node 22](https://nodejs.org/) or later.
- [pnpm 9](https://pnpm.io/) or later.

```bash
git clone https://github.com/sweeneyngo/basilica.git
cd basilica
pnpm install
pnpm build     # static site → dist/
pnpm preview   # serve the built dist/ locally to check it
```

Assets are emitted with relative URLs (`base: './'` in `vite.config.js`), so the build works under a GitHub Pages project subpath (e.g. `user.github.io/basilica/`) without hardcoding the repo name.

## Deployment

The static site deploys to GitHub Pages from GitHub Actions on every push to `main` (`.github/workflows/deploy-build.yml`):

```bash
pnpm install --frozen-lockfile
pnpm build                 # → dist/, uploaded as the Pages artifact
```

The workflow installs with pnpm on Node 22, builds `dist/`, and publishes it with `actions/deploy-pages`. Enable Pages for the repo with "GitHub Actions" as the source, and pushes to `main` do the rest.
