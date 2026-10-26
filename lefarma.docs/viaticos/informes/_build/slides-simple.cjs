const { LINES, slide, divider, table, bullets, kpis, note } = require('./ui.cjs');

// Portada propia de la versión simple (mismo lenguaje visual del manual).
const portada = logo => `
<section class="slide cover">
  ${LINES}
  <div class="logo"><img src="${logo}" alt="Grupo Lefarma"></div>
  <div class="k">Informe de investigación · Octubre 2026</div>
  <div class="t">VIÁTICOS</div>
  <div class="s">Control de calidad y APIs para costos reales</div>
  <div class="author">
    <div class="ak">ELABORÓ</div>
    <div class="an">Brandom Rafael Ledesma Muñoz</div>
    <div class="ad">21 de octubre de 2026 · Grupo Lefarma · Calidad</div>
  </div>
  <div class="stats">
    <div class="stat"><b>13</b><span>APIs evaluadas</span></div>
    <div class="stat"><b>3</b><span>fuentes que usamos</span></div>
    <div class="stat"><b>10</b><span>alternativas descartadas</span></div>
  </div>
  <div class="pgnum">@@P@@</div>
</section>`;

const S = [];

S.push(divider({
  num: '01',
  title: 'Las APIs para investigar costos',
  desc: 'Qué son, cuáles se consultarían, qué devuelven y cuánto cuestan.'
}));

S.push(slide({
  cls: 'simple',
  section: 'APIs',
  title: 'Qué es una API',
  tag: '01 · Concepto',
  body: `
    <p class="lead">Es una interfaz: un acuerdo entre dos sistemas para intercambiar información.</p>
    <div class="body">
      <p>No es una base de datos ni una lista de precios. Es la ventanilla con reglas: un sistema pide algo concreto y el otro responde en un formato acordado. Por ejemplo: “dame los vuelos de esta ruta y fecha” y el proveedor devuelve horarios, disponibilidad y condiciones.</p>
    </div>
    <div class="cols3" style="margin-top:8px">
      <div class="quote"><b>Un contrato</b>Define qué se puede pedir y cómo se responde.</div>
      <div class="quote"><b>Un intermediario</b>No guarda los datos: los pide a otro sistema.</div>
      <div class="quote"><b>Un formato común</b>Las respuestas llegan ordenadas y se pueden comparar.</div>
    </div>`,
  take: 'Una API es la interfaz, no la fuente de los datos.',
  src: 'Concepto general, aplicado al proceso de viáticos.'
}));

S.push(slide({
  cls: 'simple',
  section: 'APIs',
  title: 'Mapa de APIs por tipo de costo',
  tag: '01 · Mapa',
  body: `
    ${table(['Tipo de costo', 'Fuente que se consulta', 'Qué se le pregunta', 'Qué devuelve', 'Costo'], [
      ['Vuelos', 'Algoritmo propio + tarifas de referencia', 'Ruta, fecha y aerolínea', 'Precio estimado por aerolínea', '$0'],
      ['Hospedaje', 'Tabulador + OpenStreetMap', 'Destino y noches', 'Tarifa de referencia y hoteles cercanos', '$0'],
      ['Autobús', 'Algoritmo propio + portales públicos', 'Ruta y fecha', 'Línea, horario y precio estimado', '$0'],
      ['Ruta y casetas', 'OSRM + SCT', 'Ruta en auto', 'Km, tiempo y casetas oficiales', '$0'],
      ['Direcciones', 'OpenStreetMap', 'Hospital o terminal', 'Coordenadas', '$0']
    ], 'tight')}`,
  take: 'Cinco fuentes cubren la mayor parte de la investigación.',
  src: 'Páginas oficiales de cada proveedor.'
}));

S.push(slide({
  cls: 'simple',
  section: 'APIs',
  title: 'Vuelos, hoteles y taxis: qué investigamos',
  tag: '01 · Categorías',
  body: `
    <div class="cols3">
      <div class="quote"><b>Vuelos</b>
        Hoy: algoritmo propio con tarifas de referencia.<br>
        Opciones: Duffel (prueba gratis), Travelpayouts (precios cacheados) y Amadeus Enterprise (solo contrato).<br>
        Decisión: Duffel para el piloto.
      </div>
      <div class="quote"><b>Hoteles</b>
        Hoy: tabulador + Google Places (nombres y rating).<br>
        Opciones: Google Places (5,000 gratis/mes), Duffel Stays (prueba) y Booking Demand (socio).<br>
        Decisión: Google Places + Duffel Stays.
      </div>
      <div class="quote"><b>Taxis</b>
        Hoy: tarifas SEMOVI/Xalapa + OSRM.<br>
        Opciones: Google Routes (10,000 gratis/mes), TaxiFareFinder (API beta) y Uber/DiDi (solo enlaces).<br>
        Decisión: Google Routes + tarifas locales.
      </div>
    </div>
    ${note('ok', 'Lo que falta', 'Contratar la fuente de vuelos y hospedaje; taxis se resuelve con distancia + tarifa local.')}`,
  take: 'Cada categoría ya tiene una ruta de investigación; vuelos y hoteles necesitan proveedor.',
  src: 'Duffel, Booking, Google Maps, TaxiFareFinder y tarifas locales.'
}));

S.push(slide({
  cls: 'simple',
  section: 'APIs',
  title: 'Autobuses, rutas y casetas',
  tag: '01 · Complemento',
  body: `
    <div class="cols">
      <div class="quote"><b>Autobuses</b>
        Algoritmo propio con líneas conocidas y portales públicos de consulta.<br>
        ClickBus o Distribusion solo si se necesita precio y asientos en vivo.
      </div>
      <div class="quote"><b>Rutas y casetas</b>
        OSRM para la ruta y el catálogo de la SCT para las plazas de cobro.<br>
        Google Routes o TollGuru solo si se necesita cobertura total y garantía.
      </div>
    </div>
    ${note('ok', 'Regla práctica', 'Primero se usan las fuentes actuales; las alternativas se evalúan solo si hacen falta.')}`,
  take: 'Autobuses y casetas se resuelven con las fuentes actuales.',
  src: 'OSRM y SCT; documentación de ClickBus, Distribusion, Google Routes y TollGuru.'
}));

S.push(slide({
  cls: 'simple',
  section: 'APIs',
  title: 'De dónde salen los datos',
  tag: '01 · Datos',
  body: `
    ${table(['Dato', 'De dónde sale', 'Cómo se usa'], [
      ['Kilómetros', 'OSRM: ruta entre los puntos', 'Distancia del tramo'],
      ['Gasolina', 'CNE: precio promedio nacional', 'Litros = km ÷ 12; costo = litros × precio'],
      ['Casetas', 'SCT: plazas y tarifas oficiales', 'Suma de plazas; si no hay, $1.40/km'],
      ['Hospedaje', 'Tabulador por ciudad', 'Noches × tarifa'],
      ['Taxi', 'Tarifa local (SEMOVI/Xalapa)', 'Base + km × tarifa'],
      ['Vuelo y autobús', 'Fórmula propia', 'Base + km × factor']
    ], 'tight')}
    ${note('ok', 'Lectura', 'SCT y CNE son datos oficiales; kilómetros, vuelos y autobuses son estimaciones.')}`,
  take: 'Cada dato tiene una fuente y una forma de usarse.',
  src: 'OSRM, CNE, SCT y tabuladores internos.'
}));

S.push(slide({
  cls: 'simple',
  section: 'APIs',
  title: 'Cómo se calcula un viaje',
  tag: '01 · Cálculo',
  body: `
    ${table(['Concepto', 'Fórmula'], [
      ['Gasolina', '(km ÷ 12) × precio del litro'],
      ['Casetas', 'Suma de las plazas de la ruta'],
      ['Hospedaje', 'Noches × tarifa de la ciudad'],
      ['Taxis', 'Base + (km × tarifa)'],
      ['Total', 'Suma de todos los conceptos']
    ], 'tight')}
    ${note('amber', 'Si falta un dato', 'Se usa un valor de respaldo y se marca como estimado; nunca se presenta como precio de proveedor.')}`,
  take: 'La fórmula es simple; la calidad depende de la fuente de cada dato.',
  src: 'Motor de costos del módulo de viáticos.'
}));

S.push(slide({
  cls: 'simple',
  section: 'APIs',
  title: 'Cómo se vería en la práctica',
  tag: '01 · Flujo',
  body: `
    <div class="flow">
      <div class="fbox"><b>1 · El empleado pide</b>Origen, destino, fechas y personas.</div>
      <div class="farrow">→</div>
      <div class="fbox"><b>2 · El sistema consulta</b>Vuelos, hotel, autobús y ruta.</div>
      <div class="farrow">→</div>
      <div class="fbox"><b>3 · Llegan los datos</b>Con fuente, vigencia y condiciones.</div>
      <div class="farrow">→</div>
      <div class="fbox"><b>4 · Calidad decide</b>Compara, autoriza y guarda evidencia.</div>
    </div>
    ${table(['Paso', 'Qué deja'], [
      ['1 · El empleado pide', 'Solicitud completa'],
      ['2 · El sistema consulta', 'Consulta trazable'],
      ['3 · Llegan los datos', 'Dato con fuente y fecha'],
      ['4 · Calidad decide', 'Evidencia guardada']
    ], 'tight')}`,
  take: 'La API no decide: solo le da a calidad un dato verificable.',
  src: 'Propuesta de flujo sobre el proceso actual.'
}));

S.push(slide({
  cls: 'simple',
  section: 'APIs',
  title: 'Límites gratis y más opciones',
  tag: '01 · Opciones',
  body: `
    ${table(['Fuente', 'Límite gratis', 'Qué agrega', '¿La usamos?'], [
      ['Google Maps', '10,000 llamadas/mes por SKU Essentials; 5,000 Pro', 'Direcciones, lugares, rutas y casetas', 'Sí, para piloto'],
      ['OpenRouteService', '2,000 rutas/día; 3,000 geocodificaciones/día', 'Rutas alternativas e isocronas', 'Solo pruebas'],
      ['Mapbox', '50,000 mapas; 100,000 geocoding/directions al mes', 'Mapas y rutas', 'Alternativa'],
      ['Geoapify', '3,000 créditos/día', 'Geocoding, rutas y POIs', 'Alternativa comercial'],
      ['OpenCage', '2,500 geocodificaciones/día', 'Direcciones', 'Solo pruebas'],
      ['TollGuru', '14 días; 150 transacciones/día', 'Casetas', 'Piloto'],
      ['Travelpayouts', 'Data API con cuenta de afiliado', 'Precios cacheados de vuelos', 'Limitado']
    ], 'tight')}`,
  take: 'Los límites gratis alcanzan para un piloto; producción exige revisar términos.',
  src: 'Páginas de precios y planes de cada proveedor.'
}));

S.push(slide({
  cls: 'simple',
  section: 'APIs',
  title: 'Datos de Google Maps que podemos sumar',
  tag: '01 · Google',
  body: `
    <div class="cols">
      <div class="quote"><b>Places</b>Hoteles, restaurantes, direcciones y calificaciones.</div>
      <div class="quote"><b>Geocoding</b>Convierte direcciones en coordenadas y viceversa.</div>
      <div class="quote"><b>Routes</b>Distancia, tiempo, ruta y casetas.</div>
      <div class="quote"><b>Time Zone</b>Hora local para armar itinerarios.</div>
    </div>
    ${note('ok', 'Límite gratis', 'Google da 10,000 llamadas al mes por SKU Essentials y 5,000 por SKU Pro. Con cuenta de facturación y límites claros, alcanza para un piloto.')}`,
  take: 'Google Maps suma contexto; no sustituye la cotización.',
  src: 'Google Maps Platform: precios y límites por SKU.'
}));

S.push(divider({
  num: '02',
  title: 'Decisiones',
  desc: 'Cinco definiciones para que la investigación de costos avance.'
}));

S.push(slide({
  cls: 'simple',
  section: 'Decisiones',
  title: 'Cinco decisiones que se piden',
  tag: '02 · Decisiones',
  body: `
    ${table(['#', 'Decisión', 'Qué define'], [
      ['1', '¿El módulo solo cotiza o también compra?', 'Duffel (cotizar y reservar) o una TMC; Amadeus Enterprise solo con contrato.'],
      ['2', '¿Qué fuente es la oficial: la estimación interna o la del proveedor?', 'Define qué dato se firma y cuál se audita.'],
      ['3', '¿Nos quedamos con las fuentes actuales o evaluamos un proveedor externo?', 'Hoy se usan fuentes gratuitas; se evalúa un proveedor solo si aporta cobertura.'],
      ['4', '¿Quién es dueño del catálogo de fuentes y tarifas?', 'Quién lo revisa cada mes y responde por él.'],
      ['5', '¿Qué evidencia conservamos y por cuánto tiempo?', 'Qué se puede defender ante una auditoría.']
    ], 'tight')}
    ${note('warn', 'Si no se decide', 'Las APIs por sí solas no cambian el control: sin dueño y sin política, la tarifa sigue siendo un supuesto.')}`,
  take: 'Sin estas cinco decisiones, la tecnología no resuelve el control.',
  src: 'Síntesis del informe.'
}));

S.push(slide({
  cls: 'simple',
  section: 'Anexo',
  title: 'APIs: las que usamos y las que no',
  tag: 'A · APIs',
  body: `
    ${table(['API o fuente', '¿La usamos?', 'Para qué', 'Costo', 'Por qué'], [
      ['OpenStreetMap', '<span class="chip tag-green">Sí</span>', 'Direcciones, mapas y hoteles cercanos', '$0', 'Cobertura nacional y sin contrato.'],
      ['OSRM', '<span class="chip tag-green">Sí</span>', 'Ruta, kilómetros y tiempo', '$0', 'Código abierto y suficiente para estimar.'],
      ['SCT / CNE / INEGI', '<span class="chip tag-green">Sí</span>', 'Casetas, gasolina y municipios', '$0', 'Fuentes oficiales.'],
      ['Amadeus Enterprise', '<span class="chip">No</span>', 'Vuelos', 'Por solicitud', 'Self-Service cerró en julio 2026; solo Enterprise con contrato.'],
      ['Duffel', '<span class="chip">No</span>', 'Vuelos y hospedaje', '$3/orden + 1%', 'Requiere contrato y volumen.'],
      ['Booking Demand', '<span class="chip">No</span>', 'Hospedaje', 'Comisión', 'Solo para socios afiliados.'],
      ['ClickBus / Distribusion', '<span class="chip">No</span>', 'Autobuses', 'Convenio', 'Requieren acuerdo comercial.'],
      ['Google Routes / TollGuru', '<span class="chip">No</span>', 'Rutas y casetas', 'De pago', 'La SCT ya da las casetas oficiales.']
    ], 'tight')}`,
  take: 'Tres fuentes que usamos; cinco alternativas principales que no.',
  src: 'Páginas oficiales de cada proveedor.'
}));

module.exports = { portada, slides: S };
