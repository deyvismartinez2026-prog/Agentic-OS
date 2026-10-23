# Smokies Family Trip planner

A single-page React planner for a family cabin trip to the Smoky Mountains (Jan 1–5, 2027;
10 people including three toddlers).

- `SmokiesTrip.jsx`: the app (React 18 UMD globals, no bundler needed)
- `styles.css`: styles, with light and dark themes
- `build.mjs`: turns the two files above into one self-contained page
- `smokies-family-trip.html`: the built page that is published as a claude.ai artifact

Build:

```
npm i esbuild@0.23 --no-save   # or point ESBUILD_PATH at an existing esbuild
node build.mjs                 # writes smokies-family-trip.html
```

The published page saves the plan to the artifact's shared store (`trip/plan`) when the
viewer provides one, and to the browser's local storage otherwise.
