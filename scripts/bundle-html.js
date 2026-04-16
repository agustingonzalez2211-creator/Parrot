#!/usr/bin/env node
// Build-time HTML include resolver
// Usage: node scripts/bundle-html.js <src/renderer/index.html> <dist/renderer/index.html>

const fs   = require('fs');
const path = require('path');

const [,, src, out] = process.argv;
if (!src || !out) { console.error('Usage: bundle-html.js <src> <out>'); process.exit(1); }

const srcDir = path.dirname(path.resolve(src));

function resolveIncludes(html, baseDir) {
  return html.replace(/<div data-include="([^"]+)"><\/div>/g, (_, includePath) => {
    const fullPath = path.join(baseDir, includePath);
    if (!fs.existsSync(fullPath)) {
      console.error(`[bundle-html] Missing include: ${fullPath}`);
      return `<!-- MISSING: ${includePath} -->`;
    }
    const content = fs.readFileSync(fullPath, 'utf8');
    return resolveIncludes(content, path.dirname(fullPath)); // nested includes
  });
}

const srcHtml = fs.readFileSync(path.resolve(src), 'utf8');
const outHtml = resolveIncludes(srcHtml, srcDir);

fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
fs.writeFileSync(path.resolve(out), outHtml, 'utf8');
console.log(`[bundle-html] ${src} → ${out} (${(outHtml.length / 1024).toFixed(1)}kb)`);
