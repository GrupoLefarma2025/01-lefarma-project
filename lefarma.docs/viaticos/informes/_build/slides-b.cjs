const { slide, divider, table, bullets, kpis, note } = require('./ui.cjs');

const S = [];

S.push(divider({
  num: '02',
  title: 'Fuentes de datos',
  desc: 'El módulo mezcla fuentes oficiales, servicios comunitarios, semillas internas e históricos de Excel. La calidad del estimado depende de distinguirlas.'
}));

S.push(slide({
  section: '02 · Fuentes',
  title: 'Mapa de fuentes: qué alimenta cada capa',
  tag: '02 · Mapa',
  body: `
    <p class="lead">Nueve capas de información. Solo tres descansan en una fuente oficial y solo dos de esas tres son legibles por máquina de forma estable.</p>
    ${table(['Capa', 'Fuente', 'Qué aporta', 'Runtime', 'Estado'], [
      ['Geografía base', 'INEGI WSCatGeo + Natural Earth', '2,478 municipios y polígono de México', 'No', '<span class="chip tag-green">Oficial / estático</span>'],
      ['Direcciones y mapa', 'Nominatim + Photon + teselas OSM', 'Búsqueda, geocodificación inversa y mapa', 'Sí', '<span class="chip tag-amber">Comunidad / política OSM</span>'],
      ['Rutas', 'OSRM (demo público)', 'Km, tiempo y trazado de carretera', 'Sí', '<span class="chip tag-red">Demo no comercial</span>'],
      ['Casetas', 'SCT · Rutas Punto a Punto', 'Plazas, km y tarifa de automóvil', 'Sí', '<span class="chip tag-amber">Oficial sin API</span>'],
      ['Combustible', 'CNE · precios de gasolinas', 'Precio promedio nacional', 'Sí', '<span class="chip tag-green">Oficial XML</span>'],
      ['Hospedaje', 'Google Places / OSM / link Booking', 'Nombres, rating, cercanía y enlace', 'Sí / opcional', '<span class="chip tag-amber">Comercial / OSM</span>'],
      ['Precios de referencia', 'Seeds SHCP, SEMOVI, aerolíneas y buses', 'Tabuladores y tarifas base', 'No', '<span class="chip tag-amber">Interno, envejece</span>'],
      ['Evidencia', 'Playwright + PNG', 'Captura visual de la oferta', 'Sí', '<span class="chip tag-red">Legal / ToS</span>'],
      ['Histórico', 'Excel de octubre 2026', 'Calibración y pruebas de regresión', 'No', '<span class="chip">Interno, sin fuente</span>']
    ], 'tight')}
    ${note('warn', 'Lectura de control', 'La única capa con contrato comercial posible es <b>Google Places</b>, y está apagada por defecto. Las demás se consumen “como están”: sin SLA, sin compromiso de disponibilidad y, en dos casos, sin contrato de uso comercial.')}`,
  src: 'F1 (servicios), F3 (scripts de municipios y configuración), F13–F17, F23, F28.'
}));

S.push(slide({
  section: '02 · Fuentes',
  title: 'Catálogos internos: la parte determinista',
  tag: '02 · Catálogos',
  body: `
    <div class="cols">
      <div class="quote">
        <b>viaticos.municipios_cat</b>
        2,478 municipios y demarcaciones de las 32 entidades, cargados desde <i>INEGI WSCatGeo</i> el 7-oct-2026. La clave INEGI distingue homónimos (Oaxaca tiene dos “San Juan Mixtepec”). Un job semanal carga OSM en staging; el catálogo no depende de OSM en runtime.
      </div>
      <div class="quote">
        <b>viaticos.config_parametros</b>
        43 claves clave/valor: 3 de Google Places, 4 de costos generales, 9 de hospedaje por ciudad y 27 de taxi (base/km por ciudad, tarifas SEMOVI CDMX y perímetros de Xalapa). Se editan en BD y el motor las cachea 5 minutos.
      </div>
    </div>
    ${table(['Semilla en código', 'Contenido', 'Riesgo'], [
      ['Ciudades y terminales', '9 ciudades, 8 aeropuertos y 9 centrales de autobús', 'Cobertura limitada a las rutas sembradas'],
      ['Líneas y aerolíneas', 'ETN, ADO, Primera Plus; VivaAerobus, Volaris, Aeroméxico', 'Tarifas base y factores, no tarifas publicadas'],
      ['Casetas', '7 corredores con total y $1.40/km como respaldo', 'El peaje real cambia por plaza y vehículo'],
      ['Tabuladores', 'Hospedaje SHCP, comida $600/día, taxi SEMOVI', 'Sin fecha de vigencia ni revisión programada']
    ], 'tight')}
    ${note('amber', 'No existe el catálogo del ADR-00003', 'La tabla <b>viatico_tarifas</b>, su seed y su CRUD nunca se implementaron. El ADR-00013 lo confirma: la arquitectura documentada como “catálogo único” no es la que opera. Lo que opera es un motor de costos con seeds y fuentes externas.')}`,
  src: 'F3 (0002, 0004, 0011, 0100), F4–F6, F1 (CalculoCostosRuta, semillas).'
}));

S.push(slide({
  section: '02 · Fuentes',
  title: 'Geografía: de dónde salen los puntos y las distancias',
  tag: '02 · Geografía',
  body: `
    <div class="cols">
      <div class="quote"><b>INEGI · WSCatGeo</b>Servicio oficial, sin token. Entrega claves y nombres; la carga inicial no trae centroides, así que las coordenadas se completan al geocodificar. Es la fuente de identidad municipal.</div>
      <div class="quote"><b>Natural Earth 1:10m</b>Polígono de México simplificado (~500 m), embebido en el frontend. Sirve de candado: si el punto cae fuera del país, no se acepta. No depende de red.</div>
      <div class="quote"><b>Nominatim + Photon</b>Nominatim busca y hace geocodificación inversa; Photon entra solo si Nominatim no devuelve nada. Ambos viven detrás de un proxy con 1 req/s, caché de 6 h y candado de país.</div>
      <div class="quote"><b>Overpass + teselas OSM</b>Overpass lista hoteles cuando Google Places no está configurado; las teselas pintan el mapa Leaflet. Ambos son servicios comunitarios, sin SLA.</div>
    </div>
    ${note('warn', 'Por qué importa un punto mal puesto', 'La geocodificación define los kilómetros; los kilómetros definen gasolina, casetas y taxi. Un error de 30 km en un tramo puede mover el estimado más que un ajuste de tarifa. El backend deduplica por coordenada y etiqueta, y rechaza resultados de otro país.')}`,
  src: 'F1 (GeocodificarService), F2 (PuntoMapaPicker, MapaPunto, ubicacionMexico), F13–F15.'
}));

S.push(slide({
  section: '02 · Fuentes',
  title: 'Precios de referencia: el esqueleto del estimado',
  tag: '02 · Precios',
  body: `
    <p class="lead">El motor no inventa un precio: aplica un tabulador, una tarifa oficial o una fórmula, y lo declara. Estos son los valores que hoy sostienen el cálculo.</p>
    ${table(['Rubro', 'Fuente', 'Valor vigente en el código', 'Uso'], [
      ['Hospedaje CDMX', 'Tabulador SHCP (seed)', '$3,533 / noche', 'Techo de referencia'],
      ['Hospedaje GDL / MTY', 'Tabulador SHCP (seed)', '$2,006 / $2,353 por noche', 'Techo de referencia'],
      ['Comida', 'Configuración', '$600 / día', 'Costo por viajero'],
      ['Gasolina', 'CNE (promedio nacional)', 'Magna / premium del día', 'Costo por km'],
      ['Taxi CDMX', 'SEMOVI (oficial)', 'Libre $8.74 + $4.28/km', 'Traslado urbano'],
      ['Taxi Xalapa', 'Seed Veracruz', '$38.50 perímetro; $50 + $10/km fuera', 'Traslado urbano'],
      ['Casetas', 'SCT / seed', 'Plaza real o $1.40/km', 'Peaje por tramo'],
      ['Vuelo', 'Fórmula propia', '$690 + $1.45 × km, factor por aerolínea', 'Estimado fase 1'],
      ['Autobús', 'Fórmula + seed', '$250 + $1.05 × km, factor por línea', 'Estimado / respaldo']
    ], 'tight')}
    ${note('warn', 'No son precios de mercado', 'Son <b>valores de referencia</b>. El propio ADR-00003 lo advertía: “valores de referencia, no precios reales”. La interfaz los marca como estimado, pero el usuario puede confundir un techo de tabulador con una tarifa disponible.')}`,
  src: 'F1 (CalculoCostosRuta: seeds, factores y configuración), F3 (0011), F4 (ADR-00003, §Consecuencias).'
}));

S.push(slide({
  section: '02 · Fuentes',
  title: 'Evidencia histórica: qué enseñan los Excel',
  tag: '02 · Histórico',
  body: `
    <div class="cols">
      <div class="body">
        <b>Qué contienen</b>
        ${bullets([
          'Cinco libros por viajero (César, Juan Pablo, Santiago, Ángel y Roberto) más el concentrado y el archivo de vuelos.',
          '20 viajes de octubre 2026, origen CDMX, duración de 1 a 5 días.',
          'Rutas multi-ciudad: Cancún–Playa del Carmen, Los Mochis–Guasave–Culiacán–Mazatlán, Veracruz–Cardel–Córdoba–Xalapa.',
          'Importes reales por rubro, pero sin proveedor, clase tarifaria ni fecha de compra.'
        ])}
      </div>
      <div class="body">
        <b>Qué falta para convertirlos en datos</b>
        ${bullets([
          'Columna de <b>fuente</b> (aerolínea, agencia, OTA) y de <b>captura</b> de la oferta.',
          'Desglose de impuestos, equipaje y cargos por servicio.',
          'Fecha de cotización y fecha de compra: el precio cambia entre ambas.',
          'Normalización de nombres de ciudad: aparecen “AGUACALIENTES” y “GUERRERO” con errores.',
          'Llave de correlación con el folio del módulo.'
        ])}
      </div>
    </div>
    ${note('ok', 'Uso actual', 'El concentrado se congeló como fixture de regresión (<b>octubre2026.ts</b>). Eso protege los importes históricos, pero no los convierte en una fuente de precios: siguen siendo 20 observaciones de un mes.')}
    ${table(['Viajero', 'Viajes', 'Total MXN', '% del mes'], [
      ['César Martín García Alonso', '6', '74,154', '26.8%'],
      ['Juan Pablo Peña Portillo', '4', '85,473', '30.9%'],
      ['Santiago García Gutiérrez', '5', '82,268', '29.8%'],
      ['Ángel Remedios Cadena Barrera', '2', '8,646', '3.1%'],
      ['Roberto Cruz Guerrero', '3', '25,816', '9.3%'],
      ['<b>Total</b>', '<b>20</b>', '<b>276,357</b>', '<b>100%</b>']
    ], 'tight')}`,
  src: 'F8. Totales por viajero calculados a partir de los 20 renglones del concentrado.'
}));

S.push(divider({
  num: '03',
  title: 'APIs del módulo',
  desc: 'Una API interna de 17 endpoints y un motor que consulta diez servicios externos. La trazabilidad está bien resuelta; la contratación, no.'
}));

S.push(slide({
  section: '03 · APIs',
  title: 'API interna: 17 endpoints, cuatro permisos',
  tag: '03 · Endpoints',
  body: `
    ${table(['Método', 'Ruta', 'Propósito', 'Permiso'], [
      ['POST', '/api/viaticos/solicitudes', 'Crear borrador con folio', 'viaticos.solicitar'],
      ['GET', '/api/viaticos/solicitudes/mis', 'Mis solicitudes', 'Autenticado'],
      ['GET', '/api/viaticos/solicitudes/{id}', 'Detalle de la solicitud', 'Dueño o ver_todos'],
      ['PUT', '/api/viaticos/solicitudes/{id}/opciones', 'Guardar opciones elegidas', 'Dueño o ver_todos'],
      ['PUT', '/api/viaticos/solicitudes/{id}', 'Actualizar borrador', 'Dueño o ver_todos'],
      ['DELETE', '/api/viaticos/solicitudes/{id}', 'Eliminar borrador', 'Dueño'],
      ['POST', '/api/viaticos/solicitudes/{id}/enviar', 'Enviar a autorización', 'Dueño'],
      ['GET', '/api/viaticos/solicitudes', 'Bandeja de autorización', 'viaticos.autorizar'],
      ['POST', '/api/viaticos/solicitudes/{id}/autorizar', 'Autorizar', 'viaticos.autorizar'],
      ['POST', '/api/viaticos/solicitudes/{id}/rechazar', 'Rechazar con motivo', 'viaticos.autorizar'],
      ['POST', '/api/viaticos/solicitudes/{id}/ajustes', 'Ajustar importe o campo', 'viaticos.ajustar'],
      ['POST', '/api/viaticos/costos-ruta/calcular', 'Calcular propuesta de ruta', 'Autenticado'],
      ['POST', '/api/viaticos/capturas', 'Capturar URL de oferta', 'Autenticado'],
      ['GET', '/api/viaticos/capturas/{archivo}', 'Servir PNG de evidencia', 'Autenticado'],
      ['GET', '/api/viaticos/geocodificar', 'Geocodificar dirección o punto', '<b>Anónimo</b>'],
      ['GET', '/api/viaticos/resolver-liga', 'Resolver liga corta de mapas', '<b>Anónimo</b>'],
      ['GET', '/api/viaticos/municipios', 'Catálogo de municipios', 'Autenticado']
    ], 'tight')}`,
  src: 'F1: SolicitudesController, AprobacionesController, CostosRutaController, CapturasController, GeocodificarController, MunicipiosController.'
}));

S.push(slide({
  section: '03 · APIs',
  title: 'Motor de costos: cómo decide y qué declara',
  tag: '03 · Motor',
  body: `
    <p class="lead">El cálculo es stateless: recibe personas, lugares, fechas y modo; normaliza, rutea, genera opciones, arma seis propuestas y devuelve totales con su origen.</p>
    ${table(['Etapa', 'Qué hace', 'Fuente o regla'], [
      ['1 · Normalizar', 'Personas, lugares, fechas, modo, auto propio y horario laboral', 'Entrada del wizard'],
      ['2 · Rutar', 'Km, tiempo y trazado entre puntos', 'OSRM; si falla, seed de distancia'],
      ['3 · Opcionar', 'Auto, renta, bus, avión, taxi y transporte público', 'Seeds + ClickBus + Distribusion + SCT + CNE'],
      ['4 · Proponer', 'Barata, rápida, equilibrada y tipo 1/2/3 (carro, bus, avión)', 'Motor de costos'],
      ['5 · Hospedar', 'Hoteles cercanos con rating y distancia', 'Google Places; si no, Nominatim/Overpass'],
      ['6 · Declarar', 'Precio, moneda, URL, nota, fuente y bandera de estimado', 'Contrato de salida']
    ], 'tight')}
    <div class="cols">
      <div>${note('ok', 'Fortaleza', 'Cada opción declara <b>fuente</b> y <b>estimado</b>; si un proveedor cae, el motor baja a seed y lo dice. La interfaz muestra la fuente en la tabla.')}</div>
      <div>${note('warn', 'Límite', 'El motor <b>no reserva ni compra</b>. La “URL de compra” es un enlace profundo, no una tarifa confirmada. Tampoco compara el estimado contra el boleto pagado.')}</div>
    </div>`,
  src: 'F1 (CalculoCostosRuta, 82 KB, ~1,500 líneas), F2 (TablaOpciones, CeldaFuente).'
}));

S.push(slide({
  section: '03 · APIs',
  title: 'Servicios externos: quién responde y con qué respaldo',
  tag: '03 · Externos',
  body: `
    ${table(['Servicio', 'Uso', 'Auth', 'Caché / timeout', 'Respaldo'], [
      ['OSRM', 'Ruta carretera', 'Ninguna', '8 s; sin caché', 'Seed de distancia'],
      ['Nominatim', 'Búsqueda y reversa', 'User-Agent', '1 req/s; 12 s; 6 h', 'Photon'],
      ['Photon', 'Búsqueda tolerante', 'User-Agent', '1 req/s; 12 s; 6 h', 'Ninguno'],
      ['Overpass', 'Hoteles', 'Ninguna', '8 s; 3 espejos', 'Nominatim'],
      ['SCT SIBUAC', 'Casetas', 'Sesión (cookie)', '24 h; sin timeout explícito', 'Seed $1.40/km'],
      ['CNE', 'Gasolina', 'Ninguna', '15 s; 1 h', 'Seed 23.5 / 25.5'],
      ['Google Places', 'Hoteles', 'API key', '6 h; sin timeout', 'OSM'],
      ['ClickBus', 'Autobuses', 'Ninguna', '10 s', 'Seed bus'],
      ['Distribusion', 'Autobuses', 'retailerPartnerNumber', '10 s', 'Seed bus'],
      ['Teselas OSM', 'Mapa', 'Ninguna', 'Según headers', 'Sin respaldo']
    ], 'tight')}
    ${note('warn', 'Nueve de diez, sin contrato', 'Solo Google Places tiene una relación comercial posible; hoy está apagado por defecto. OSRM, Nominatim, Photon, Overpass y las teselas son servicios comunitarios o demos. SCT, CNE, ClickBus y Distribusion se consumen sin acuerdo con Lefarma.')}`,
  src: 'F1 (todos los servicios), F14–F17, F23, F26, F28.'
}));

S.push(slide({
  section: '03 · APIs',
  title: 'Contrato con el agente de investigación',
  tag: '03 · Contrato',
  body: `
    <div class="cols wide">
      <div>
        <pre class="json">{
  <span class="k">"version"</span>: "1.0.0",
  <span class="k">"consulta"</span>: { "origen": "...", "destino": "...",
    "fecha_salida": "2026-11-10", "fecha_regreso": null,
    "personas": 1 },
  <span class="k">"cobertura_declarada"</span>: "qué se cubrió y qué no",
  <span class="k">"transportistas_no_encontrados"</span>: ["..."],
  <span class="k">"opciones"</span>: [{
    "transportista": "...", "modo": "avion|autobus|hotel",
    "salida": "ISO 8601 con zona", "llegada": "...",
    "precio": 0, "moneda": "MXN", "url_compra": "https://...",
    "capturas": ["https://..."], "fuente": "...",
    "consultado_en": "ISO 8601 con zona"
  }]
}</pre>
      </div>
      <div class="body">
        ${bullets([
          'JSON Schema draft 2020-12, con <b>additionalProperties:false</b> en todos los niveles.',
          '<b>transportistas_no_encontrados</b> es obligatorio, aunque vaya vacío: es el mecanismo de honestidad de cobertura.',
          '<b>precio:null</b> solo se admite si <b>fuente</b> es literalmente “estimado”.',
          'Fechas ISO 8601 con zona; URL de compra y capturas reales; consultado_en por opción.',
          'El importador valida sin dependencias y rechaza campos extra.'
        ])}
      </div>
    </div>
    ${note('amber', 'Lo que este contrato no es', 'Es un acuerdo para que un <b>agente externo</b> investigue y entregue un JSON. No es una API de precios: no hay endpoint, credencial, SLA ni refresco automático. Su valor es la disciplina de cobertura y evidencia.')}`,
  src: 'F10 (prompt v1.0.0), F11 (schema), F2 (validador e importador).'
}));

S.push(slide({
  section: '03 · APIs',
  title: 'Capturas: la evidencia visual de la oferta',
  tag: '03 · Evidencia',
  body: `
    <div class="flow">
      <div class="fbox"><b>1 · Solicitud</b>Hasta 10 URLs por llamada</div>
      <div class="farrow">→</div>
      <div class="fbox"><b>2 · Validación</b>http/https, sin IP interna, sin dominios prohibidos</div>
      <div class="farrow">→</div>
      <div class="fbox"><b>3 · Playwright</b>2 capturas en paralelo; 30 s por página</div>
      <div class="farrow">→</div>
      <div class="fbox"><b>4 · Almacén</b>PNG en media; ruta ligada a la opción</div>
    </div>
    ${table(['Control', 'Hoy', 'Lectura'], [
      ['Esquema', 'Solo http/https', 'Bloquea file:, data: y metadatos'],
      ['Destinos internos', 'Loopback, RFC1918, CGNAT, .local', 'Protección anti-SSRF'],
      ['Dominios prohibidos', 'booking.com y expedia.com', 'Decisión de plan: no scraping a OTAs'],
      ['Lista blanca', 'Vacía por defecto', 'Cada captura lleva aviso; poblar antes de producción'],
      ['Timeout', '55 s duro por proceso', 'Evita procesos colgados']
    ], 'tight')}
    ${note('warn', 'Riesgo legal y de privacidad', 'Capturar una página de terceros no equivale a tener derecho a hacerlo. La lista blanca vacía y la ausencia de retención son deuda: definan dominios permitidos, plazo de conservación y redacción de datos personales.')}`,
  src: 'F1 (CapturasService, CapturasController), F2 (captura-viaticos.mjs).'
}));

module.exports = S;
