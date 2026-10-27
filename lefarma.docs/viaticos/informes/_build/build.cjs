const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');
const { CSS, cover } = require('./ui.cjs');
const A = require('./slides-a.cjs');
const B = require('./slides-b.cjs');
const C = require('./slides-c.cjs');

const ROOT = path.resolve(__dirname, '..');
const LOGO = path.resolve(__dirname, '../../../../lefarma.frontend/src/assets/logo.png');
const OUT_PDF = path.resolve(ROOT, '2026-10-21_informe-investigacion-fuentes-apis.pdf');
const OUT_HTML = path.resolve(__dirname, 'informe.html');
const PREVIEW = path.resolve(__dirname, 'preview');

const logo = `data:image/png;base64,${fs.readFileSync(LOGO).toString('base64')}`;
const slides = [cover({ logo }), ...A, ...B, ...C];

let n = 0;
const body = slides.join('\n').replace(/@@P@@/g, () => String(++n).padStart(2, '0'));

const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="author" content="Brandom Ledesma">
<meta name="description" content="Informe de investigación sobre las fuentes de datos y APIs del módulo de viáticos de Grupo Lefarma.">
<meta name="keywords" content="viáticos, fuentes de datos, APIs, Lefarma, Amadeus, Duffel, OpenStreetMap">
<title>Viáticos · Informe de investigación · Fuentes y APIs</title>
<style>${CSS}</style>
</head>
<body>
${body}
</body>
</html>`;

fs.writeFileSync(OUT_HTML, html, 'utf8');
fs.mkdirSync(PREVIEW, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  await page.goto('file:///' + OUT_HTML.replace(/\\/g, '/'), { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);

  const problems = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('.slide').forEach((slide, i) => {
      const panel = slide.querySelector('.panel');
      if (!panel) return;
      const pr = panel.getBoundingClientRect();
      const cs = getComputedStyle(panel);
      const padBottom = parseFloat(cs.paddingBottom);
      let maxBottom = pr.top;
      let maxRight = pr.left;
      for (const child of panel.children) {
        const r = child.getBoundingClientRect();
        if (r.height === 0) continue;
        maxBottom = Math.max(maxBottom, r.bottom);
        maxRight = Math.max(maxRight, r.right);
      }
      const overflowX = panel.scrollWidth - panel.clientWidth;
      const clipY = maxBottom - pr.bottom;
      if (clipY > 1 || overflowX > 1) {
        out.push({
          page: i + 1,
          clipY: Math.round(clipY * 10) / 10,
          overflowX,
          maxRight: Math.round(maxRight - pr.right),
          title: slide.querySelector('h1')?.textContent?.slice(0, 60) || '(sin título)'
        });
      }
    });
    return out;
  });

  if (problems.length) {
    console.error('DESBORDE DETECTADO:');
    for (const p of problems) console.error(JSON.stringify(p));
  } else {
    console.log('Layout: 0 desbordes en', slides.length, 'hojas.');
  }

  // Vistas previas para revisión visual (una PNG por hoja).
  const count = await page.locator('.slide').count();
  for (let i = 0; i < count; i++) {
    await page.locator('.slide').nth(i).screenshot({
      path: path.join(PREVIEW, `slide-${String(i + 1).padStart(2, '0')}.png`),
      animations: 'disabled'
    });
  }

  await page.pdf({
    path: OUT_PDF,
    width: '1280px',
    height: '720px',
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' }
  });

  await browser.close();
  const kb = Math.round(fs.statSync(OUT_PDF).size / 1024);
  console.log('PDF:', OUT_PDF);
  console.log('Páginas:', count, '| Tamaño:', kb, 'KB');
  if (problems.length) process.exitCode = 2;
})().catch(err => {
  console.error(err);
  process.exit(1);
});
