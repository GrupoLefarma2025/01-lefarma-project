// Utilidades de composición del informe (formato 16:9 del manual institucional).
// Genera HTML con el lenguaje visual del manual: fondo azul, líneas diagonales,
// panel blanco, títulos Century Gothic y pie con fuente.

const LINES = `
<svg class="lines" viewBox="0 0 1280 720" preserveAspectRatio="none" aria-hidden="true">
  <g stroke="#ffffff" stroke-linecap="round">
    <line x1="742" y1="720" x2="1280" y2="250" stroke-width="2.2" opacity=".38"/>
    <line x1="790" y1="720" x2="1280" y2="300" stroke-width="1.1" opacity=".55"/>
    <line x1="836" y1="720" x2="1280" y2="346" stroke-width="2.6" opacity=".30"/>
    <line x1="882" y1="720" x2="1280" y2="392" stroke-width="1.0" opacity=".62"/>
    <line x1="928" y1="720" x2="1280" y2="438" stroke-width="1.8" opacity=".42"/>
    <line x1="974" y1="720" x2="1280" y2="484" stroke-width="1.0" opacity=".55"/>
    <line x1="1020" y1="720" x2="1280" y2="530" stroke-width="2.4" opacity=".28"/>
    <line x1="1066" y1="720" x2="1280" y2="576" stroke-width="1.1" opacity=".45"/>
    <line x1="1112" y1="720" x2="1280" y2="622" stroke-width="1.6" opacity=".35"/>
    <line x1="1158" y1="720" x2="1280" y2="668" stroke-width="1.0" opacity=".50"/>
    <line x1="1080" y1="210" x2="1280" y2="10" stroke-width="1.2" opacity=".35"/>
    <line x1="1120" y1="250" x2="1280" y2="90" stroke-width="2.0" opacity=".25"/>
    <line x1="1170" y1="300" x2="1280" y2="190" stroke-width="1.0" opacity=".45"/>
  </g>
</svg>`;

const CSS = `
@page { size: 1280px 720px; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { background: #0b74b7; }
.slide {
  width: 1280px; height: 720px; position: relative; overflow: hidden;
  page-break-after: always; break-after: page;
  background:
    radial-gradient(900px 520px at 8% 4%, rgba(255,255,255,.28), rgba(255,255,255,0) 60%),
    linear-gradient(148deg, #32d2f2 0%, #1cc0e8 18%, #12a7dd 44%, #0b83c4 70%, #0a5ea3 100%);
  font-family: 'Segoe UI', Arial, sans-serif;
  color: #1e293b;
}
.slide:last-child { page-break-after: auto; break-after: auto; }
.lines { position: absolute; inset: 0; width: 1280px; height: 720px; pointer-events: none; }
.chrome {
  position: absolute; left: 44px; top: 27px;
  font-family: 'Century Gothic', 'Segoe UI', sans-serif; font-weight: 700;
  font-size: 26px; letter-spacing: .2px; color: #0b3a66;
}
.tag {
  position: absolute; right: 46px; top: 35px; font-size: 10px; letter-spacing: 2.1px;
  text-transform: uppercase; color: #0b3a66; opacity: .82; font-weight: 700;
}
.pgnum {
  position: absolute; left: 46px; bottom: 14px; font-family: 'Century Gothic', sans-serif;
  font-weight: 700; font-size: 15px; color: #093862;
}
.foot {
  position: absolute; left: 50%; transform: translateX(-50%); bottom: 16px;
  font-size: 9.5px; letter-spacing: .7px; color: #093862; opacity: .78;
}
.panel {
  position: absolute; left: 40px; top: 88px; width: 1200px; height: 590px;
  background: #ffffff; border-radius: 10px;
  box-shadow: 0 18px 44px rgba(3,35,75,.26);
  padding: 28px 40px 22px; display: flex; flex-direction: column; overflow: hidden;
}
.kicker {
  font-size: 10px; letter-spacing: 2.3px; text-transform: uppercase;
  color: #0b74b7; font-weight: 700; margin-bottom: 3px;
}
h1 {
  font-family: 'Century Gothic', 'Segoe UI', sans-serif; font-size: 29px; line-height: 1.14;
  color: #0b2f5e; margin: 0 0 8px; font-weight: 700; letter-spacing: -.3px;
}
h1 .thin { font-weight: 400; color: #0b74b7; }
.lead { font-size: 14px; line-height: 1.46; color: #475569; margin: 0 0 11px; }
.body { font-size: 12.6px; line-height: 1.5; color: #334155; }
.body.tight { font-size: 11.8px; line-height: 1.44; }
p { margin: 0 0 7px; }
ul { margin: 0; padding: 0; list-style: none; }
li { position: relative; padding-left: 14px; margin-bottom: 5px; }
li:before {
  content: ''; position: absolute; left: 0; top: 6px; width: 5px; height: 5px;
  background: #0b74b7; border-radius: 1px;
}
li.no:before { display: none; }
b, strong { color: #0b2f5e; }
.cols { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
.cols.wide { grid-template-columns: 1.25fr .9fr; }
.cols3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 9px; margin: 3px 0 9px; }
.kpi { background: #f2f8fe; border: 1px solid #d8e7f5; border-radius: 8px; padding: 9px 11px; }
.kpi b {
  display: block; font-family: 'Century Gothic', sans-serif; font-size: 25px;
  color: #0b4a86; line-height: 1.08; font-weight: 700;
}
.kpi span { font-size: 8.9px; color: #64748b; text-transform: uppercase; letter-spacing: .8px; }
table { width: 100%; border-collapse: collapse; font-size: 10.6px; line-height: 1.33; }
th {
  background: #0b3a66; color: #fff; text-align: left; padding: 5.5px 8px;
  font-size: 9.1px; letter-spacing: .45px; text-transform: uppercase; font-weight: 600;
}
td { padding: 5.2px 8px; border-bottom: 1px solid #dbe7f3; vertical-align: top; }
tr:nth-child(even) td { background: #f4f9fe; }
td.num { white-space: nowrap; font-variant-numeric: tabular-nums; }
td.c, th.c { text-align: center; }
table.tight { font-size: 9.4px; line-height: 1.3; }
table.tight th { font-size: 8.4px; padding: 4.4px 6px; }
table.tight td { padding: 4.2px 6px; }
.note {
  border-left: 5px solid #0b74b7; background: #eef6fd; padding: 8px 12px;
  border-radius: 0 6px 6px 0; margin: 7px 0;
}
.note .nt {
  font-size: 8.8px; letter-spacing: 1.4px; text-transform: uppercase;
  font-weight: 700; color: #0b5a9b; margin-bottom: 2px;
}
.note p { font-size: 11.3px; line-height: 1.42; margin: 0; color: #25415f; }
.note.warn { border-color: #d92d20; background: #fef3f2; }
.note.warn .nt { color: #b42318; }
.note.warn p { color: #5b2620; }
.note.ok { border-color: #12805c; background: #ecfdf5; }
.note.ok .nt { color: #0b6b4b; }
.note.ok p { color: #1d4d3d; }
.note.amber { border-color: #b54708; background: #fffaeb; }
.note.amber .nt { color: #93370d; }
.note.amber p { color: #5c3a12; }
.flow { display: flex; align-items: stretch; gap: 7px; margin: 6px 0 8px; }
.fbox {
  flex: 1; background: #f2f8fe; border: 1px solid #d8e7f5; border-radius: 7px;
  padding: 8px 10px; font-size: 9.9px; line-height: 1.32;
}
.fbox b { display: block; font-size: 10.3px; color: #0b4a86; margin-bottom: 2px; }
.farrow { align-self: center; color: #0b74b7; font-weight: 700; font-size: 14px; }
.steps { counter-reset: s; }
.step {
  position: relative; padding-left: 34px; margin-bottom: 8px;
}
.step:before {
  counter-increment: s; content: counter(s);
  position: absolute; left: 0; top: 0; width: 23px; height: 23px; border-radius: 50%;
  background: #0b74b7; color: #fff; font-family: 'Century Gothic', sans-serif;
  font-weight: 700; font-size: 11px; display: flex; align-items: center; justify-content: center;
}
.step b { display: block; font-size: 12px; color: #0b2f5e; }
.step span { font-size: 11.2px; color: #475569; line-height: 1.4; }
.chip {
  display: inline-block; background: #eef6fd; border: 1px solid #cfe3f5; color: #0b4a86;
  border-radius: 20px; padding: 2px 8px; font-size: 9.2px; margin: 0 4px 4px 0;
  font-weight: 600; white-space: nowrap;
}
.tag-red { background: #fef3f2; border-color: #f5c6c0; color: #b42318; }
.tag-green { background: #ecfdf5; border-color: #b7e4d0; color: #0b6b4b; }
.tag-amber { background: #fffaeb; border-color: #f3d9a4; color: #93370d; }
.src {
  margin-top: auto; border-top: 1px solid #e2e8f0; padding-top: 6px;
  font-size: 8.6px; line-height: 1.35; color: #64748b;
}
.take {
  margin-top: auto; border-top: 2px solid #0b74b7; padding-top: 7px;
  font-size: 13.4px; line-height: 1.4; color: #0b2f5e; font-weight: 600;
}
.take span {
  display: block; font-size: 8.4px; letter-spacing: 2px; color: #0b74b7;
  font-weight: 700; margin-bottom: 2px;
}
.take + .src { margin-top: 8px; }
.wm {
  position: absolute; right: 24px; bottom: 4px; z-index: 0;
  font-family: 'Century Gothic', sans-serif; font-weight: 700; font-size: 150px;
  line-height: 1; color: #f0f6fc; pointer-events: none;
}
.panel > *:not(.wm) { position: relative; z-index: 1; }
.src b { color: #475569; }
pre.json {
  margin: 0; background: #0b1f3a; color: #d7e8f8; border-radius: 7px;
  padding: 10px 12px; font-family: Consolas, 'Courier New', monospace;
  font-size: 8.6px; line-height: 1.4; overflow: hidden;
}
pre.json .k { color: #8fd3ff; }
.quote {
  background: #f8fbff; border: 1px solid #d8e7f5; border-radius: 8px;
  padding: 9px 11px; font-size: 10.7px; line-height: 1.42; color: #334155;
}
.quote b { display: block; font-size: 9.4px; color: #0b4a86; margin-bottom: 3px; }
.quote i { color: #0b2f5e; }
/* Variante "simple": menos texto, letra más grande, lectura para toda la empresa. */
.slide.simple h1 { font-size: 34px; line-height: 1.1; letter-spacing: -.5px; }
.slide.simple .kicker { font-size: 11px; }
.slide.simple .lead { font-size: 17px; line-height: 1.4; margin-bottom: 14px; }
.slide.simple .body { font-size: 15px; line-height: 1.5; }
.slide.simple .body.tight { font-size: 14px; }
.slide.simple table { font-size: 12px; line-height: 1.38; }
.slide.simple table.tight { font-size: 11.4px; line-height: 1.35; }
.slide.simple th { font-size: 9.8px; padding: 7px 9px; }
.slide.simple td { padding: 7px 9px; }
.slide.simple .note { padding: 11px 15px; margin: 9px 0; }
.slide.simple .note .nt { font-size: 9.8px; }
.slide.simple .note p { font-size: 13.4px; line-height: 1.45; }
.slide.simple .quote { font-size: 13.6px; line-height: 1.45; padding: 13px 15px; }
.slide.simple .quote b { font-size: 12.5px; margin-bottom: 5px; }
.slide.simple .take { font-size: 16px; line-height: 1.35; padding-top: 9px; }
.slide.simple .take span { font-size: 9.2px; }
.slide.simple .src { font-size: 9.5px; }
.slide.simple .fbox { font-size: 12px; line-height: 1.35; padding: 11px 12px; }
.slide.simple .fbox b { font-size: 12.8px; margin-bottom: 4px; }
.slide.simple .kpi b { font-size: 30px; }
.slide.simple .kpi span { font-size: 9.8px; }
.slide.simple .chip { font-size: 10.2px; padding: 3px 9px; }
.slide.simple li { margin-bottom: 7px; padding-left: 17px; }
.slide.simple li:before { top: 8px; width: 6px; height: 6px; }
.check { display: flex; gap: 12px; align-items: flex-start; padding: 9px 0; border-bottom: 1px solid #e2e8f0; }
.check:last-child { border-bottom: 0; }
.dot { width: 14px; height: 14px; border-radius: 50%; margin-top: 5px; flex: none; }
.dot.g { background: #12805c; }
.dot.a { background: #b54708; }
.dot.r { background: #d92d20; }
.check b { display: block; font-size: 15px; color: #0b2f5e; line-height: 1.3; }
.check span { font-size: 13px; color: #475569; line-height: 1.4; }
.idx { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 28px; }
.idxi { display: flex; gap: 12px; align-items: flex-start; padding: 7px 0; border-bottom: 1px solid #e2e8f0; }
.idxn { font-family: 'Century Gothic', sans-serif; font-size: 24px; color: #0b74b7; line-height: 1; min-width: 38px; font-weight: 700; }
.idxt b { display: block; font-size: 11px; color: #0b2f5e; }
.idxt span { font-size: 9.6px; color: #64748b; line-height: 1.38; }
/* Portada */
.cover .chrome, .cover .tag { display: none; }
.cover .logo {
  position: absolute; right: 54px; top: 40px; width: 220px; background: #fff;
  border-radius: 10px; padding: 9px 14px; box-shadow: 0 10px 28px rgba(3,35,75,.18);
}
.cover .logo img { width: 100%; display: block; }
.cover .k {
  position: absolute; left: 70px; top: 142px; font-size: 10.5px; letter-spacing: 3.2px;
  color: #093862; font-weight: 700; text-transform: uppercase;
}
.cover .t {
  position: absolute; left: 64px; top: 168px;
  font-family: 'Century Gothic', sans-serif; font-weight: 700; font-size: 94px;
  line-height: .93; color: #072c57;
}
.cover .s {
  position: absolute; left: 70px; top: 298px; width: 690px; font-size: 23px;
  line-height: 1.28; color: #ffffff; font-weight: 600;
}
.cover .s small {
  display: block; font-size: 14px; font-weight: 400; color: #e8f7ff;
  margin-top: 9px; line-height: 1.4; opacity: 1;
}
.cover .author {
  position: absolute; left: 70px; bottom: 46px; background: #fff; border-radius: 10px;
  padding: 13px 20px 14px; box-shadow: 0 12px 30px rgba(3,35,75,.2); min-width: 430px;
}
.cover .author .ak { font-size: 8.8px; letter-spacing: 2.2px; color: #0b74b7; font-weight: 700; }
.cover .author .an {
  font-family: 'Century Gothic', sans-serif; font-size: 25px; color: #0b2f5e;
  font-weight: 700; line-height: 1.22;
}
.cover .author .ad { font-size: 10.5px; color: #64748b; margin-top: 1px; }
.cover .stats {
  position: absolute; right: 54px; bottom: 46px; display: grid;
  grid-template-columns: 1fr; gap: 9px; width: 420px;
}
.cover .stat { background: rgba(255,255,255,.94); border-radius: 8px; padding: 9px 12px; }
.cover .stat b {
  display: block; font-family: 'Century Gothic', sans-serif; font-size: 19px;
  color: #0b3a66; line-height: 1.1;
}
.cover .stat span { font-size: 8.4px; color: #475569; text-transform: uppercase; letter-spacing: .7px; }
/* Divisoria */
.divider .chrome, .divider .tag, .divider .foot { display: none; }
.divider .big {
  position: absolute; left: 52px; top: 106px; font-family: 'Century Gothic', sans-serif;
  font-size: 252px; font-weight: 700; line-height: 1; color: rgba(255,255,255,.16);
}
.divider .dk {
  position: absolute; left: 74px; top: 92px; font-size: 10.5px; letter-spacing: 3px;
  color: #eaf6ff; opacity: .9; font-weight: 700; text-transform: uppercase;
}
.divider .dt {
  position: absolute; left: 70px; top: 330px; width: 1000px;
  font-family: 'Century Gothic', sans-serif; font-size: 54px; font-weight: 700;
  color: #fff; line-height: 1.05;
}
.divider .dd {
  position: absolute; left: 74px; top: 408px; width: 800px; font-size: 17px;
  line-height: 1.45; color: #eaf6ff;
}
`;

const TAKES = {
  'Qué contiene este informe': 'El informe separa lo que el módulo ya resuelve de lo que depende de un contrato.',
  'El módulo ya cotiza; la brecha es la fuente del precio': 'El siguiente salto no es de software: es de suministro de precios.',
  'Alcance, método y límites': 'Todo hallazgo se puede rastrear a un archivo o a una política oficial.',
  'El proceso hoy: de la matriz mensual al concentrado': 'El proceso ya está definido; lo que falta es que el sistema sea la fuente de verdad.',
  'Cuánto se gasta y en qué': 'Dos rubros explican 69% del gasto y ambos dependen de un precio que hoy no se compra.',
  'Qué está implementado': 'La arquitectura es sólida para cotizar; no fue diseñada para reservar.',
  'Estados, permisos y trazabilidad': 'El módulo audita lo que pasa dentro; el gasto real sigue fuera.',
  'Mapa de fuentes: qué alimenta cada capa': 'La calidad del estimado es tan buena como la fuente más débil de la cadena.',
  'Catálogos internos: la parte determinista': 'Los catálogos dan estabilidad; las semillas, comodidad; ninguna de las dos da un precio de mercado.',
  'Geografía: de dónde salen los puntos y las distancias': 'Un punto mal geocodificado contamina kilómetros, casetas y taxi.',
  'Precios de referencia: el esqueleto del estimado': 'Los tabuladores son un techo, no una oferta.',
  'Evidencia histórica: qué enseñan los Excel': 'El histórico sirve para no repetir errores, no para cotizar.',
  'API interna: 17 endpoints, cuatro permisos': 'La API cubre el ciclo completo; la ausencia de un endpoint de reserva es deliberada.',
  'Motor de costos: cómo decide y qué declara': 'El motor declara lo que sabe y lo que estima; eso ya es más que un cotizador opaco.',
  'Servicios externos: quién responde y con qué respaldo': 'La dependencia no es el problema; la dependencia sin contrato sí.',
  'Contrato con el agente de investigación': 'El contrato del agente es una buena política de evidencia, no una integración.',
  'Capturas: la evidencia visual de la oferta': 'La evidencia visual es útil si hay derecho a capturarla y política para conservarla.',
  'Vuelos: el 49.8% del gasto sin proveedor': 'Vuelos es la integración con mayor retorno por peso invertido.',
  'Hospedaje: nombre y rating sí; tarifa no': 'Hospedaje necesita tarifa, no más nombres de hoteles.',
  'Autobuses: el aggregador es el camino': 'Un solo agregador nacional basta; dos sin contrato no.',
  'Rutas y casetas: del demo comunitario al contrato': 'Casetas y rutas se pueden resolver con un contrato; hoy se resuelven con un demo y un formulario.',
  'Tipo de cambio y servicios vecinos': 'Sin tasa fechada, un precio en dólares no es auditable.',
  'Matriz de riesgos': 'El riesgo central es firmar un estimado como si fuera una tarifa.',
  'OpenStreetMap: tres políticas, tres brechas': 'La política de OSM no prohíbe usar; prohíbe usar de cierta manera.',
  'Riesgos de datos y de negocio': 'Sin medir la varianza, el módulo no puede demostrar que acierta.',
  'Seguridad y privacidad': 'La llave y la captura son los dos activos que más cuidado exigen.',
  'Hoja de ruta 0–30 / 30–90 / 90–180 días': 'Primero cumplir, luego comprar, después operar.',
  'Cinco decisiones que se piden al negocio': 'Las cinco decisiones son de negocio; ninguna se resuelve con código.',
  'Inventario de endpoints': 'Inventario mínimo para auditar la superficie de ataque.',
  'Configuración y secretos': 'La configuración es flexible; su auditoría es inexistente.',
  'Fuentes consultadas': 'Cada afirmación del informe tiene una fuente verificable.',
  'Glosario': 'Vocabulario compartido para discutir sin ambigüedad.'
};

function slide({ section, title, body, src, tag, cls = '', take: takeOverride }) {
  const take = takeOverride !== undefined ? takeOverride : (TAKES[title] || '');
  const wm = tag && /^\d\d/.test(tag) && !tag.startsWith('00') ? tag.slice(0, 2) : '';
  return `
<section class="slide ${cls}">
  ${LINES}
  <div class="chrome">Viáticos · Informe de investigación</div>
  ${tag ? `<div class="tag">${tag}</div>` : ''}
  <div class="panel">
    ${wm ? `<div class="wm">${wm}</div>` : ''}
    ${section ? `<div class="kicker">${section}</div>` : ''}
    <h1>${title}</h1>
    ${body}
    ${take ? `<div class="take"><span>EN UNA FRASE</span>${take}</div>` : ''}
    ${src ? `<div class="src"><b>Fuente:</b> ${src}</div>` : ''}
  </div>
  <div class="pgnum">@@P@@</div>
  <div class="foot">Grupo Lefarma · Viáticos · Octubre 2026</div>
</section>`;
}

function divider({ num, title, desc }) {
  return `
<section class="slide divider">
  ${LINES}
  <div class="big">${num}</div>
  <div class="dk">Sección ${num} / 02</div>
  <div class="dt">${title}</div>
  <div class="dd">${desc}</div>
  <div class="pgnum">@@P@@</div>
</section>`;
}

function cover({ logo }) {
  return `
<section class="slide cover">
  ${LINES}
  <div class="logo"><img src="${logo}" alt="Grupo Lefarma"></div>
  <div class="k">Informe de investigación · Octubre 2026</div>
  <div class="t">VIÁTICOS</div>
  <div class="s">Fuentes de datos y APIs para cotizar, autorizar y comprobar viajes
    <small>Qué se usa hoy, qué se puede contratar y qué falta para que el importe firmado sea también el importe comprado.</small>
  </div>
  <div class="author">
    <div class="ak">ELABORÓ</div>
    <div class="an">Brandom Ledesma</div>
    <div class="ad">21 de octubre de 2026 · Grupo Lefarma · Tecnología</div>
  </div>
  <div class="stats">
    <div class="stat"><b>20</b><span>viajes analizados</span></div>
    <div class="stat"><b>$276,357</b><span>MXN en octubre 2026</span></div>
    <div class="stat"><b>17</b><span>endpoints internos</span></div>
    <div class="stat"><b>10</b><span>servicios externos</span></div>
  </div>
  <div class="pgnum">@@P@@</div>
</section>`;
}

const table = (headers, rows, cls = '') => `
<table class="${cls}">
  <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
  <tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
</table>`;

const bullets = items => `<ul>${items.map(i => `<li>${i}</li>`).join('')}</ul>`;
const kpis = items => `<div class="kpis">${items.map(([v, l]) => `<div class="kpi"><b>${v}</b><span>${l}</span></div>`).join('')}</div>`;
const note = (kind, title, text) => `<div class="note ${kind}"><div class="nt">${title}</div><p>${text}</p></div>`;

module.exports = { CSS, LINES, slide, divider, cover, table, bullets, kpis, note };
