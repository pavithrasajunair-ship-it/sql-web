// Builds ONE self-contained index.html (CSS + JS inlined) from src/, then a deploy-ready dist/ folder.
// Run: node build.js
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const src = f => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8');

let html = src('index.html');
html = html.replace(/<link rel="stylesheet" href="styles\.css">/, () => `<style>\n${src('styles.css')}</style>`);
html = html.replace(/<script src="([\w.]+)"><\/script>/g, (_, f) => {
  const code = src(f);
  if (code.includes('</script')) throw new Error(f + ' contains </script');
  return `<script>\n${code}</script>`;
});
fs.writeFileSync(path.join(__dirname, 'index.html'), html);

// dist/: upload THIS folder to any static host (Netlify, GitHub Pages, Cloudflare Pages, Vercel)
const dist = path.join(__dirname, 'dist');
fs.rmSync(dist, {recursive: true, force: true}); fs.mkdirSync(dist);
const version = crypto.createHash('sha1').update(html).digest('hex').slice(0, 10);
fs.writeFileSync(path.join(dist, 'index.html'), html);
fs.writeFileSync(path.join(dist, 'sw.js'), src('sw.js').replace('__VERSION__', version));
const ASSETS = ['404.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'favicon.ico', 'favicon-32.png', 'apple-touch-icon.png',
  'og.png', 'Class12-SQL-cheatsheet.pdf', 'launch.mp4', 'launch-poster.jpg', 'launch-vertical.mp4', 'launch-vertical-poster.jpg', 'shot-learn.webp', 'shot-practice.webp', 'shot-lab.webp'];
const swOut = src('sw.js').replace('__VERSION__', version);
for (const f of ASSETS) fs.copyFileSync(path.join(__dirname, 'src', f), path.join(dist, f));
// also next to the root index.html, so deploying the repo root (e.g. GitHub Pages) gets icons, manifest and offline support
for (const f of ASSETS) fs.copyFileSync(path.join(__dirname, 'src', f), path.join(__dirname, f));
fs.writeFileSync(path.join(__dirname, 'sw.js'), swOut);
fs.writeFileSync(path.join(dist, '_headers'), '/sw.js\n  Cache-Control: no-cache\n/index.html\n  Cache-Control: no-cache\n');
console.log('Built index.html (' + Math.round(html.length / 1024) + ' KB), dist/ ready, cache version ' + version);
