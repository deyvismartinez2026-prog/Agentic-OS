// Builds the single-file page: node build.mjs [out.html] [--inline-react <node_modules dir>]
// Needs esbuild; set ESBUILD_PATH if it isn't resolvable from here.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const out = args[0] && !args[0].startsWith('--') ? path.resolve(args[0]) : path.join(here, 'smokies-family-trip.html');
const inlineIdx = args.indexOf('--inline-react');
const inlineDir = inlineIdx >= 0 ? args[inlineIdx + 1] : null;

const esbuildSpec = process.env.ESBUILD_PATH ? pathToFileURL(process.env.ESBUILD_PATH).href : 'esbuild';
const { transform } = await import(esbuildSpec);

const jsx = fs.readFileSync(path.join(here, 'SmokiesTrip.jsx'), 'utf8');
const css = fs.readFileSync(path.join(here, 'styles.css'), 'utf8');
const { code } = await transform(jsx, {
  loader: 'jsx',
  jsxFactory: 'React.createElement',
  jsxFragment: 'React.Fragment',
  target: 'es2019',
  minify: true,
  legalComments: 'none',
});
const cssMin = (await transform(css, { loader: 'css', minify: true })).code;

const react = inlineDir
  ? ['react/umd/react.production.min.js', 'react-dom/umd/react-dom.production.min.js']
      .map((f) => `<script>${fs.readFileSync(path.join(inlineDir, f), 'utf8')}</script>`).join('\n')
  : [
      '<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script>',
      '<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>',
    ].join('\n');
const fonts = inlineDir ? '' : [
  '<link rel="preconnect" href="https://fonts.googleapis.com">',
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Overpass+Mono:wght@500;600&family=Overpass:wght@400;500;600;700;800&family=Young+Serif&display=swap">',
].join('\n');

// The Artifact publish step adds the viewport meta; local test builds need their own.
const viewport = inlineDir ? '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n' : '';
const html = `${viewport}<title>Smokies Family Trip</title>
<meta name="claude:viewport-fit-sides" content="cover">
${fonts}
<style>${cssMin}</style>
<div id="root"><p class="boot">Loading the trip plan…</p></div>
${react}
<script>${code.replace(/<\/script/gi, '<\\/script')}</script>
`;
fs.writeFileSync(out, html);
console.log(`wrote ${out} (${(html.length / 1024).toFixed(1)} KB)`);
