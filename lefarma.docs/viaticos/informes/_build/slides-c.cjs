const { slide, divider, table, bullets, kpis, note } = require('./ui.cjs');

const S = [];

S.push(divider({
  num: '04',
  title: 'Proveedores evaluados',
  desc: 'Cinco decisiones de suministro: vuelos, hospedaje, autobuses, rutas/casetas y tipo de cambio. Para cada una: qué hay hoy, qué se puede contratar y cuánto cuesta.'
}));

S.push(slide({
  section: '04 · Proveedores',
  title: 'Vuelos: el 49.8% del gasto sin proveedor',
  tag: '04 · Vuelos',
  body: `
    <p class="lead">Hoy el precio del vuelo es una fórmula ($690 + $1.45/km, con factores por aerolínea), no una tarifa. Es la brecha de mayor impacto económico del módulo.</p>
    ${table(['Opción', 'Cobertura', 'Costo de referencia', 'Esfuerzo', 'Veredicto'], [
      ['Fórmula actual', 'Ninguna tarifa real', '$0', '—', 'Estimar y etiquetar'],
      ['Amadeus Self-Service', '400+ aerolíneas', 'Prueba: 2,000 búsquedas/mes gratis; producción: pay-as-you-go con cuota gratuita', 'Bajo', '<b>Recomendado para cotizar</b>'],
      ['Duffel', '500+ aerolíneas', '$3 USD por orden + 1% de managed content', 'Medio', 'Recomendado si se compra'],
      ['Directo / NDC por aerolínea', 'Por convenio', 'Contrato y volumen', 'Alto', 'Solo con volumen']
    ], 'tight')}
    ${note('warn', 'Validar low-cost mexicanas', 'Amadeus advierte que su entorno de pruebas no incluye algunas aerolíneas de bajo costo ni American Airlines, Delta y British Airways. Antes de firmar, hay que probar <b>VivaAerobus</b> y <b>Volaris</b> en producción. Duffel no garantiza por sí mismo la presencia de esas rutas: se valida con una búsqueda real.')}
    ${note('ok', 'Por qué Amadeus primero', 'Menor barrera de entrada: cuenta self-service, cuota gratuita mensual y ambiente de pruebas con datos limitados. Permite cotizar sin construir una agencia de viajes. Duffel entra cuando el alcance incluya reservar y gestionar órdenes.')}`,
  src: 'F18–F21; F1 (fórmula actual). Precios de lista consultados el 21-oct-2026.'
}));

S.push(slide({
  section: '04 · Proveedores',
  title: 'Hospedaje: nombre y rating sí; tarifa no',
  tag: '04 · Hospedaje',
  body: `
    <p class="lead">Google Places da hoteles reales, cercanía y calificación, pero no tarifa ni disponibilidad. El precio sigue saliendo del tabulador. Para cotizar de verdad hace falta un API de inventario.</p>
    ${table(['Opción', 'Qué aporta', 'Acceso', 'Costo', 'Veredicto'], [
      ['Google Places (hoy)', 'Nombre, dirección, rating, cercanía', 'API key; opcional', 'Text Search Enterprise: USD $35 / 1,000', 'Descubrimiento, no precio'],
      ['Booking.com Demand API', 'Inventario y disponibilidad de Booking', 'Solo Managed Affiliate Partner', 'Comisión / convenio', 'Mejor cobertura; contrato'],
      ['Duffel Stays', '1.6 M propiedades; reserva', 'Cuenta Duffel', 'Profit share por estancia', 'Una sola integración con vuelos'],
      ['OSM / Nominatim', 'Nombres y ubicación', 'Público', '$0', 'Respaldo']
    ], 'tight')}
    ${note('warn', 'Contradicción operativa', 'El servicio de capturas <b>prohíbe booking.com y expedia.com</b>, pero el motor genera enlaces de búsqueda a Booking. El enlace es válido; la captura no. Si Booking se vuelve fuente, la evidencia debe ser la respuesta del API, no un pantallazo.')}
    ${note('amber', 'Costo real de Google', 'El campo que pide el código incluye <b>rating</b> y <b>userRatingCount</b>, que son campos Enterprise. Por eso la llamada se cobra como Text Search Enterprise ($35/1,000), no como Pro ($32/1,000). Con caché de 6 h y 5 resultados, el volumen es bajo, pero la llave debe tener presupuesto y alertas.')}`,
  src: 'F22–F24, F1 (GooglePlacesService, campos y caché), F2 (enlaces Booking).'
}));

S.push(slide({
  section: '04 · Proveedores',
  title: 'Autobuses: el aggregador es el camino',
  tag: '04 · Autobuses',
  body: `
    <p class="lead">Los operadores mexicanos no exponen APIs públicas de tarifa. En la práctica se llega por agregadores; hoy el código usa dos sin contrato y cae a semillas.</p>
    ${table(['Opción', 'Qué aporta', 'Acceso', 'Riesgo', 'Veredicto'], [
      ['ClickBus adapter (hoy)', 'Horarios, precio y asientos', 'Endpoint tipo adapter, sin llave', 'Alto: sin contrato ni documentación pública', 'Negociar o retirar'],
      ['Distribusion (hoy)', 'Conexiones de su red', 'retailerPartnerNumber de ejemplo', 'Alto: número demo, sin credencial', 'Contratar y validar MX'],
      ['ClickBus / Busbud / Distribusion', 'Inventario y reserva', 'Convenio B2B', 'Medio: cobertura por corredor', 'Elegir uno y firmar'],
      ['Semillas ETN / ADO / Primera Plus', 'Respaldo cuando falla el conector', 'Código', 'Medio: tarifa base, no publicada', 'Mantener etiquetado']
    ], 'tight')}
    ${note('warn', 'La etiqueta “en vivo”', 'Si el conector falla, el motor devuelve la semilla pero conserva la etiqueta de respaldo. La interfaz debe hacer evidente que el precio <b>no</b> es de venta. Hoy la fuente se muestra, pero el usuario promedio no distingue “seed bus” de “ClickBus”.')}
    ${note('ok', 'Alcance razonable', 'Autobús es 6% del gasto, pero concentra viajes cortos y frecuentes. Un solo convenio con cobertura nacional (ClickBus o Distribusion) es suficiente; no hace falta integrar cada línea.')}`,
  src: 'F1 (BuscarBusesClickBusAsync, BuscarBusesDistribusionAsync, ViajesBusSeed), F26.'
}));

S.push(slide({
  section: '04 · Proveedores',
  title: 'Rutas y casetas: del demo comunitario al contrato',
  tag: '04 · Rutas',
  body: `
    <p class="lead">La ruta se calcula con el demo público de OSRM y las casetas se raspan del formulario de la SCT. Ambos funcionan, pero ninguno es una base contractual para producción.</p>
    ${table(['Opción', 'Qué aporta', 'Costo', 'Esfuerzo', 'Veredicto'], [
      ['OSRM demo (hoy)', 'Km, tiempo y trazado', '$0', '—', 'Reemplazar'],
      ['OSRM self-host', 'Mismo motor, bajo control', 'Infraestructura + operación', 'Alto', 'Si el volumen lo justifica'],
      ['Google Routes API', 'Tráfico y <b>tollInfo</b> en México', 'Por llamada; peaje se cobra a tarifa alta', 'Bajo', '<b>Recomendado para casetas</b>'],
      ['TollGuru', 'Plazas, vehículo y ruta', 'USD $80/mes hasta 5,000 transacciones', 'Medio', 'Alternativa competitiva'],
      ['SCT SIBUAC', 'Plazas y tarifas oficiales', '$0', 'Parser HTML', 'Cruce de auditoría']
    ], 'tight')}
    ${note('warn', 'OSRM demo no es para una empresa', 'La política del demo dice: “restricted to reasonable, non-commercial use-cases. Do not exceed 1 request per second.” Lefarma es una aplicación corporativa; el demo no es la base correcta.')}
    ${note('ok', 'Casetas: dos caminos válidos', 'Google Routes devuelve <b>tollInfo</b> para México y evita el scraping; TollGuru cobra por volumen pero entrega plazas y tipos de vehículo. Cualquiera de los dos es más defendible que parsear el formulario de la SCT.')}`,
  src: 'F16 (OSRM demo), F17 (SCT), F24 (Google Routes), F25 (TollGuru). Precios de lista al 21-oct-2026.'
}));

S.push(slide({
  section: '04 · Proveedores',
  title: 'Tipo de cambio y servicios vecinos',
  tag: '04 · FX',
  body: `
    <p class="lead">Hoy todo el cálculo está en MXN. En cuanto entre un proveedor que cotice en USD —vuelos, hospedaje o casetas— hace falta una tasa oficial y fechada.</p>
    ${table(['Servicio', 'Uso', 'Acceso', 'Costo', 'Estado'], [
      ['Banxico SIE', 'Tipo de cambio FIX USD/MXN', 'Token de 64 caracteres', 'Gratuito; 80 consultas/min y 40,000/día', 'Recomendado'],
      ['INEGI WSCatGeo', 'Municipios y claves', 'Sin token', 'Gratuito', 'En uso'],
      ['SAT · CFDI', 'Comprobación post-gasto', 'Certificados / proveedor', 'Variable', 'No implementado'],
      ['Clara u otra tarjeta corporativa', 'Transacciones y conciliación', 'Cliente y mTLS', 'Comercial', 'Fuera de alcance']
    ], 'tight')}
    ${note('warn', 'Regla de oro para el FX', 'Guardar la tasa y la fecha <b>en la cotización</b>. Nunca recalcular una cotización histórica con la tasa de hoy: cambia el importe firmado y rompe la auditoría.')}
    ${note('amber', 'Alcance', 'La conciliación CFDI/transacciones es un proyecto distinto (post-gasto). Este informe se limita a la cotización previa al viaje; mezclar ambos alcances fue lo que descartó a Clara en el ADR-00003.')}`,
  src: 'F27 (Banxico), F13 (INEGI), F4 (ADR-00003, alternativas descartadas).'
}));

S.push(divider({
  num: '05',
  title: 'Riesgos y cumplimiento',
  desc: 'El riesgo no es que el módulo falle: es que falle en silencio, con un precio que parece publicado y no lo es, o con un servicio que se puede bloquear sin aviso.'
}));

S.push(slide({
  section: '05 · Riesgos',
  title: 'Matriz de riesgos',
  tag: '05 · Matriz',
  body: `
    ${table(['Riesgo', 'Prob.', 'Impacto', 'Mitigación'], [
      ['OSRM demo bloqueado o cambiado', 'Alta', 'Medio', 'Contratar routing o self-host; caché por par origen-destino'],
      ['Nominatim bloquea por autocompletado', 'Media', 'Alto', 'Búsqueda explícita (Enter/botón) o geocoder comercial'],
      ['La SCT cambia su formulario', 'Alta', 'Medio', 'Pruebas de parser + Google Routes/TollGuru como respaldo'],
      ['ClickBus/Distribusion dejan de responder', 'Alta', 'Medio', 'Convenio, caché corta y etiqueta de estimado'],
      ['Fuga de la llave de Google', 'Media', 'Alto', 'Key Vault, restricciones por API/IP y alertas de gasto'],
      ['Seeds envejecidos', 'Alta', 'Medio', 'Fecha de vigencia por clave y revisión mensual'],
      ['Captura de páginas sin derecho', 'Media', 'Alto', 'Lista blanca, permiso expreso y retención'],
      ['Abuso de geocodificación anónima', 'Media', 'Medio', 'Autenticar, limitar por usuario y por IP']
    ], 'tight')}
    ${note('warn', 'Riesgo silencioso', 'Los respaldos funcionan: si un servicio cae, el motor devuelve una semilla. El problema es que el usuario puede firmar un estimado creyendo que es una tarifa. La mitigación no es técnica: es <b>etiquetar la confianza</b> en la interfaz y en el PDF.')}`,
  src: 'F1, F2, F14–F17, F23, F26. Evaluación propia a partir del código y las políticas citadas.'
}));

S.push(slide({
  section: '05 · Cumplimiento',
  title: 'OpenStreetMap: tres políticas, tres brechas',
  tag: '05 · OSM',
  body: `
    ${table(['Servicio', 'Lo que exige la política', 'Lo que hace hoy el módulo', 'Acción'], [
      ['Nominatim', 'Máximo 1 req/s; prohibido el autocompletado; poder cambiar de proveedor', 'Proxy con 1 req/s y caché 6 h, pero la UI busca a los 400 ms de teclear; endpoint anónimo', 'Búsqueda con Enter/botón o geocoder comercial'],
      ['OSRM demo', 'Uso razonable, <b>no comercial</b>; máximo 1 req/s; sin garantía', 'App corporativa; llamadas por cálculo; sin contrato', 'Contratar routing o self-host'],
      ['Teselas OSM', 'URL exacta <b>tile.openstreetmap.org</b>; User-Agent/Referer; caché ≥ 7 días; sin descarga masiva', 'Usa <b>{s}.tile.openstreetmap.org</b>, un patrón que la política desaconseja; atribución presente', 'Corregir URL o contratar proveedor de teselas']
    ], 'tight')}
    ${note('warn', 'La cita que importa', 'Nominatim: <i>“Auto-complete search … you must not implement such a service on the client side using the API.”</i> OSRM: <i>“restricted to reasonable, non-commercial use-cases.”</i> No son recomendaciones: son condiciones de uso.')}
    ${note('ok', 'Lo que ya está bien', 'El backend identifica la app con User-Agent, respeta 1 req/s en geocodificación, cachea 6 h, acota a México y deduplica. La base técnica existe; falta alinear la UX y el consumo corporativo.')}
    ${table(['Brecha', 'Acción concreta', 'Dueño', 'Plazo'], [
      ['Autocompletado en Nominatim', 'Buscar con Enter o botón; si se quiere type-ahead, contratar geocoder', 'Tecnología', '30 días'],
      ['OSRM demo no comercial', 'Contratar routing o autoalojar OSRM con SLA interno', 'Tecnología + Compras', '60 días'],
      ['URL de teselas en desuso', 'Usar tile.openstreetmap.org o contratar proveedor de teselas', 'Tecnología', '15 días']
    ], 'tight')}`,
  src: 'F14 (Nominatim), F15 (teselas), F16 (OSRM demo), F1 (implementación), F2 (debounce de 400 ms).'
}));

S.push(slide({
  section: '05 · Datos',
  title: 'Riesgos de datos y de negocio',
  tag: '05 · Datos',
  body: `
    <div class="cols">
      <div class="quote"><b>Estimado vs. comprado</b>El módulo no reserva ni compra. El importe firmado puede diferir del boleto pagado. No hay medición de esa varianza, y sin ella no se puede calibrar el tabulador.</div>
      <div class="quote"><b>Cobertura declarada, pero solo en el prompt</b>El contrato del agente exige declarar transportistas no encontrados. En runtime, el motor no muestra una línea de cobertura por cotización: muestra fuente por opción.</div>
      <div class="quote"><b>Datos que envejecen</b>Las semillas no tienen fecha de vigencia. El hospedaje es el rubro más sensible: un tabulador de 2025 aplicado a 2026 distorsiona el 19% del gasto.</div>
      <div class="quote"><b>Muestra histórica sesgada</b>20 viajes, 5 viajeros, origen CDMX, un mes. Sirve para regresión, no para concluir tarifas de todas las rutas ni de otras gerencias.</div>
    </div>
    ${note('amber', 'Qué medir a partir de ahora', 'Tres indicadores: <b>% de opciones con fuente viva</b>, <b>varianza estimado vs. comprado</b> y <b>% de cotizaciones con captura</b>. Sin esos tres, el módulo no puede demostrar que está mejorando.')}`,
  src: 'F1, F5, F6, F8. Evaluación propia.'
}));

S.push(slide({
  section: '05 · Seguridad',
  title: 'Seguridad y privacidad',
  tag: '05 · Seguridad',
  body: `
    ${table(['Activo', 'Riesgo', 'Control actual', 'Recomendación'], [
      ['Geocodificación', 'Proxy abierto a Internet', 'Anónimo; 1 req/s; caché', 'Exigir JWT y limitar por usuario'],
      ['Resolvedor de ligas', 'SSRF / open redirect', 'Lista blanca de hosts y saltos', 'Mantener y auditar'],
      ['Llave de Google', 'Exposición y gasto', 'Texto plano en config_parametros', 'Key Vault + restricciones + alertas'],
      ['Capturas PNG', 'Contenido de terceros y PII', 'Anti-SSRF y dominios prohibidos', 'Retención 90 días y redacción'],
      ['Datos del viajero', 'Nombre, SAM, ruta y fechas', 'JWT y permisos', 'Minimizar y enmascarar en logs'],
      ['Configuración', 'Cambios sin rastro', 'Solo fecha_creacion', 'Columnas de auditoría y historial']
    ], 'tight')}
    ${note('warn', 'El eslabón más débil', 'La llave de Google vive en una tabla que cualquier DBA puede leer y que no tiene auditoría de cambios. Si se habilita Places en producción, la llave debe salir de la base y rotar con procedimiento.')}
    ${note('ok', 'Lo que ya está resuelto', 'La captura bloquea esquemas peligrosos, IPs internas, metadatos de nube y dominios prohibidos. Es un control maduro para un módulo en piloto.')}`,
  src: 'F1 (CapturasService, ConfiguracionViaticos, GeocodificarController), F3 (config_parametros).'
}));

S.push(divider({
  num: '06',
  title: 'Recomendaciones',
  desc: 'Tres horizontes y cinco decisiones. La prioridad no es agregar funciones: es cambiar la naturaleza del precio que se firma.'
}));

S.push(slide({
  section: '06 · Ruta',
  title: 'Hoja de ruta 0–30 / 30–90 / 90–180 días',
  tag: '06 · Roadmap',
  body: `
    <div class="cols3">
      <div class="quote"><b>0–30 días · Cumplimiento y confianza</b>
        ${bullets([
          'Cambiar el buscador a Enter/botón o contratar geocoder.',
          'Corregir la URL de teselas o contratar proveedor.',
          'Etiquetar confianza: viva / seed / estimado.',
          'Fecha de vigencia por semilla y revisión mensual.',
          'Mover la llave de Google a secreto y autenticar geocoding.'
        ])}
      </div>
      <div class="quote"><b>30–90 días · Precio comprable</b>
        ${bullets([
          'Integrar Amadeus (cotización) o Duffel (cotización + reserva).',
          'Integrar casetas con Google Routes o TollGuru.',
          'Contratar ClickBus/Distribusion o retirar el rótulo “en vivo”.',
          'Agregar tipo de cambio Banxico y guardar tasa/fecha.',
          'Definir política de capturas y retención.'
        ])}
      </div>
      <div class="quote"><b>90–180 días · Operación</b>
        ${bullets([
          'API de hospedaje (Booking Demand o Duffel Stays).',
          'Reserva y conciliación con CFDI.',
          'Observatorio de precios por corredor y temporada.',
          'SLA, alertas y tablero de disponibilidad.',
          'Evaluar TMC u OBT corporativo.'
        ])}
      </div>
    </div>
    <div class="flow" style="margin-top:8px">
      <div class="fbox"><b>KPI 1</b>% opciones con fuente viva</div>
      <div class="fbox"><b>KPI 2</b>Varianza estimado vs. comprado</div>
      <div class="fbox"><b>KPI 3</b>% cotizaciones con captura</div>
      <div class="fbox"><b>KPI 4</b>Latencia p95 y costo por cotización</div>
    </div>
    ${table(['Horizonte', 'Resultado esperado', 'Cómo se verifica'], [
      ['0–30 días', 'Cumplimiento OSM y confianza visible en la cotización', 'Auditoría de políticas + encuesta a usuarios'],
      ['30–90 días', 'Precio de vuelo y caseta con fuente contractual', '% de opciones con fuente viva; varianza'],
      ['90–180 días', 'Operación con reserva, conciliación y SLA', 'Cierre mensual contra CFDI; disponibilidad']
    ], 'tight')}`,
  src: 'Elaboración propia a partir de F1–F28.'
}));

S.push(slide({
  section: '06 · Decisiones',
  title: 'Cinco decisiones que se piden al negocio',
  tag: '06 · Decisiones',
  body: `
    ${table(['#', 'Decisión', 'Por qué importa', 'Quién decide'], [
      ['1', '¿El módulo cotiza o también compra?', 'Determina Amadeus (cotizar) vs. Duffel/TMC (reservar y gestionar).', 'Dirección + Finanzas'],
      ['2', '¿Cuál es el importe oficial: el estimado interno o la cotización del proveedor?', 'Hoy se firma un estimado; si el proveedor manda, cambia el flujo de autorización.', 'Dirección Corporativa'],
      ['3', '¿Se contrata routing/geocoding/teselas o se autoaloja?', 'Cierra la deuda de cumplimiento OSM y la dependencia de demos.', 'Tecnología + Compras'],
      ['4', '¿Quién es dueño del catálogo de precios y de su revisión mensual?', 'Sin dueño, las semillas envejecen y el estimado pierde credibilidad.', 'Administración'],
      ['5', '¿Cuál es la política de evidencia y retención de capturas?', 'Define qué se puede capturar, por cuánto tiempo y con qué redacción.', 'Legal + Seguridad']
    ], 'tight')}
    ${note('warn', 'Si no se decide', 'El módulo seguirá funcionando, pero como un <b>cotizador de referencia</b>: útil para planear, insuficiente para comprar y difícil de defender ante auditoría cuando el boleto pagado difiera del estimado.')}
    ${table(['Decisión', 'Insumo mínimo para decidir', 'Fecha propuesta'], [
      ['1 · Alcance', 'Volumen anual de viajes y si se compra hoy por agencia', 'Mes 1'],
      ['2 · Importe oficial', 'Política de viáticos vigente y criterio de auditoría', 'Mes 1'],
      ['3 · Infraestructura', 'Cotización de routing, teselas y geocoder', 'Mes 2'],
      ['4 · Dueño del catálogo', 'Nombre, área y proceso de revisión mensual', 'Mes 1'],
      ['5 · Evidencia', 'Dictamen de Legal sobre capturas y retención', 'Mes 2']
    ], 'tight')}`,
  src: 'Elaboración propia. Base: hallazgos de las secciones 01–05.'
}));

S.push(slide({
  section: 'Anexo A',
  title: 'Inventario de endpoints',
  tag: 'A · Endpoints',
  body: `
    <div class="cols">
      <div>
        ${table(['Método', 'Ruta'], [
          ['POST', '/solicitudes'], ['GET', '/solicitudes/mis'], ['GET', '/solicitudes/{id}'],
          ['PUT', '/solicitudes/{id}/opciones'], ['PUT', '/solicitudes/{id}'], ['DELETE', '/solicitudes/{id}'],
          ['POST', '/solicitudes/{id}/enviar'], ['GET', '/solicitudes'], ['POST', '/solicitudes/{id}/autorizar']
        ], 'tight')}
      </div>
      <div>
        ${table(['Método', 'Ruta'], [
          ['POST', '/solicitudes/{id}/rechazar'], ['POST', '/solicitudes/{id}/ajustes'],
          ['POST', '/costos-ruta/calcular'], ['POST', '/capturas'], ['GET', '/capturas/{archivo}'],
          ['GET', '/geocodificar'], ['GET', '/resolver-liga'], ['GET', '/municipios']
        ], 'tight')}
      </div>
    </div>
    ${note('amber', 'Prefijo y autenticación', 'Todas las rutas viven bajo <b>/api/viaticos</b>. La API usa JWT; las dos rutas de mapa son anónimas por decisión de diseño. El detalle de permisos está en la hoja “API interna”.')}`,
  src: 'F1 (controladores de Viáticos).'
}));

S.push(slide({
  section: 'Anexo B',
  title: 'Configuración y secretos',
  tag: 'B · Config',
  body: `
    <div class="cols">
      <div>
        <b>43 claves en viaticos.config_parametros</b>
        ${table(['Grupo', 'Claves', 'Ejemplo'], [
          ['Google Places', '3', 'habilitado, llave, radio_km'],
          ['Costos generales', '4', 'comida_dia, rendimiento_km_l'],
          ['Hospedaje', '9', 'costo por ciudad (CDMX, GDL, MTY…)'],
          ['Taxi', '27', 'base/km, SEMOVI CDMX, Xalapa']
        ], 'tight')}
      </div>
      <div>
        <b>Secretos y credenciales</b>
        ${table(['Secreto', 'Dónde vive', 'Riesgo'], [
          ['Llave Google', 'config_parametros (texto)', 'Alto'],
          ['Cadena SQL', 'appsettings / entorno', 'Medio'],
          ['JWT', 'appsettings / entorno', 'Medio'],
          ['SMTP', 'appsettings / entorno', 'Medio']
        ], 'tight')}
      </div>
    </div>
    ${note('warn', 'Sin auditoría de configuración', 'La tabla solo tiene <b>fecha_creacion</b>. No hay usuario, fecha de modificación ni historial. Un cambio de tarifa no deja rastro de quién lo hizo. Es la brecha de control más fácil de cerrar.')}
    ${note('ok', 'Ventaja del diseño', 'Los costos no viven en el código ni en appsettings: se editan en base y el motor los toma con caché de 5 minutos. Eso permite ajustar sin recompilar; falta ponerle auditoría.')}`,
  src: 'F3 (0011, 0100), F1 (ConfiguracionViaticosService).'
}));

S.push(slide({
  section: 'Anexo C',
  title: 'Fuentes consultadas',
  tag: 'C · Fuentes',
  body: `
    <div class="cols" style="font-size:9.4px;line-height:1.45;color:#475569">
      <div>
        <p><b>F1</b> Backend Viáticos: <i>Features/Viaticos/*.cs</i> (controladores, CalculoCostosRuta, GeocodificarService, CasetasRutaService, GooglePlacesService, CapturasService). 21-oct-2026.</p>
        <p><b>F2</b> Frontend Viáticos: <i>src/apps/viaticos/**</i> (PuntoMapaPicker, MapaPunto, servicios, páginas, fixtures). 21-oct-2026.</p>
        <p><b>F3</b> Scripts SQL: <i>lefarma.database/viaticos/0002–0014, 0100</i>. 21-oct-2026.</p>
        <p><b>F4</b> ADR-00003 “Estimador de viáticos por catálogo configurable”.</p>
        <p><b>F5</b> ADR-00007 “Búsqueda y cotización de viáticos”.</p>
        <p><b>F6</b> ADR-00013 “Planeación personal y handoff a viáticos”.</p>
        <p><b>F7</b> <i>reglas-negocio.md</i> (fases, roles y viáticos).</p>
        <p><b>F8</b> Concentrado <i>VIATICOS EDUCACION MEDICA OCTUBRE 2026</i> (FOR-008).</p>
        <p><b>F9</b> <i>VUELOS EDUCACION MEDICA OCTUBRE 2026</i> y libros por viajero.</p>
        <p><b>F10</b> Prompt <i>busqueda-viaticos.md</i> v1.0.0.</p>
        <p><b>F11</b> Schema <i>cotizacion-viajes.schema.json</i>.</p>
        <p><b>F12</b> Manual institucional <i>manual_modulo_rh.pdf</i> (referencia de formato).</p>
        <p><b>F13</b> INEGI, Catálogo Único de Claves Geoestadísticas: inegi.org.mx/servicios/catalogounico.html</p>
        <p><b>F14</b> Nominatim Usage Policy: operations.osmfoundation.org/policies/nominatim/</p>
      </div>
      <div>
        <p><b>F15</b> OSM Tile Usage Policy: operations.osmfoundation.org/policies/tiles/</p>
        <p><b>F16</b> OSRM Demo server: github.com/Project-OSRM/osrm-backend/wiki/Demo-server</p>
        <p><b>F17</b> SICT, Rutas Punto a Punto: app.sct.gob.mx/sibuac_internet/ControllerUI?action=cmdEscogeRuta</p>
        <p><b>F18</b> Amadeus Self-Service Pricing: developers.amadeus.com/pricing</p>
        <p><b>F19</b> Amadeus Flight Offers Search: developers.amadeus.com/self-service/category/flights/api-doc/flight-offers-search</p>
        <p><b>F20</b> Duffel Pricing: duffel.com/pricing</p>
        <p><b>F21</b> Duffel API: duffel.com/docs</p>
        <p><b>F22</b> Booking.com Demand API: developers.booking.com/demand/docs</p>
        <p><b>F23</b> Google Places API billing: developers.google.com/maps/documentation/places/web-service/usage-and-billing</p>
        <p><b>F24</b> Google Routes API, tolls: developers.google.com/maps/documentation/routes/calculate_toll_fees</p>
        <p><b>F25</b> TollGuru Toll API pricing: tollguru.com/toll-api-pricing-plans</p>
        <p><b>F26</b> Distribusion API: docs.distribusion.com</p>
        <p><b>F27</b> Banxico SIE API: banxico.org.mx/SieAPIRest/service/v1</p>
        <p><b>F28</b> CNE, precios de gasolinas: publicacionexterna.azurewebsites.net/publicaciones/prices</p>
      </div>
    </div>
    ${note('amber', 'Criterio de citación', 'Los archivos internos se citan por ruta y fecha de consulta; las URLs, por dominio y fecha. Los importes distinguen <b>publicado</b> de <b>estimado</b>. Las fuentes F1–F12 no se reproducen aquí: viven en el repositorio y se verificaron en sitio.')}`,
  src: 'Todas las fuentes se consultaron entre el 20 y el 21 de octubre de 2026. Los precios de proveedores son de lista y pueden cambiar.'
}));

S.push(slide({
  section: 'Anexo D',
  title: 'Glosario',
  tag: 'D · Glosario',
  body: `
    <div class="cols" style="font-size:10.4px;line-height:1.44;color:#334155">
      <div>
        <p><b>AEM</b> Administrador de Educación Médica.</p>
        <p><b>EV / EP</b> Ejecutivo de Ventas / Especialista.</p>
        <p><b>GV / CA / GG / DC</b> Gerente de Ventas / Coordinador Administrativo / Gerente General / Dirección Corporativa.</p>
        <p><b>FOR-005 / 006 / 007 / 008</b> Matriz mensual / Calendario / Recibido / Concentrado de viáticos.</p>
        <p><b>ASK-GGE-IDT-001</b> Instructivo de solicitud y aprobación de viáticos (no digitalizado).</p>
        <p><b>ADR</b> Architecture Decision Record; registro de una decisión de arquitectura.</p>
        <p><b>API</b> Application Programming Interface; contrato para consumir un servicio.</p>
        <p><b>CFDI</b> Comprobante Fiscal Digital por Internet.</p>
        <p><b>JSON</b> JavaScript Object Notation; formato de intercambio de datos.</p>
        <p><b>JWT</b> JSON Web Token; credencial firmada que usa la API.</p>
        <p><b>MXN</b> Peso mexicano, moneda base del cálculo.</p>
        <p><b>NDC</b> New Distribution Capability (contenido aéreo directo).</p>
        <p><b>OTA</b> Online Travel Agency (Booking, Expedia).</p>
        <p><b>SLA</b> Acuerdo de nivel de servicio; garantía de disponibilidad.</p>
        <p><b>TMC</b> Travel Management Company (agencia corporativa).</p>
      </div>
      <div>
        <p><b>OSRM</b> Open Source Routing Machine; calcula ruta por carretera.</p>
        <p><b>Nominatim / Photon</b> Geocodificadores sobre datos de OpenStreetMap.</p>
        <p><b>Overpass</b> Consulta de objetos de OpenStreetMap por área.</p>
        <p><b>OSM</b> OpenStreetMap; datos libres, servicios públicos con política de uso.</p>
        <p><b>SCT / SICT</b> Secretaría de Infraestructura, Comunicaciones y Transportes.</p>
        <p><b>CNE</b> Comisión Nacional de Energía; publica precios de gasolinas.</p>
        <p><b>mTLS</b> Autenticación mutua por certificado.</p>
        <p><b>SSRF</b> Server-Side Request Forgery; el servidor es inducido a abrir URLs internas.</p>
        <p><b>SPA</b> Single Page Application; la interfaz de Viáticos.</p>
        <p><b>SQL</b> Structured Query Language; base de datos relacional.</p>
        <p><b>Seed</b> Valor de respaldo embebido en el código, no una tarifa publicada.</p>
        <p><b>Tabulador</b> Tarifa de referencia fijada por la organización o la autoridad.</p>
        <p><b>UI / UX</b> Interfaz de usuario / experiencia de usuario.</p>
        <p><b>Varianza</b> Diferencia entre el importe estimado y el realmente pagado.</p>
        <p><b>Viático</b> Recursos para transporte, hospedaje y alimentación fuera del lugar de adscripción.</p>
      </div>
    </div>`,
  src: 'Elaboración propia. Términos usados en el informe y en el módulo.'
}));

S.push(slide({
  section: 'Cierre',
  title: 'La cotización ya es trazable; el siguiente salto es que sea comprable',
  tag: 'Cierre',
  body: `
    <p class="lead">El módulo resolvió lo difícil de la operación: capturar, calcular, autorizar y concentrar con evidencia. Lo que sigue no es más pantalla: es sustituir la fórmula por una tarifa y medir la diferencia.</p>
    <div class="flow">
      <div class="fbox"><b>1 · Contratar</b>Vuelo, hospedaje y casetas con API y SLA.</div>
      <div class="farrow">→</div>
      <div class="fbox"><b>2 · Medir</b>Varianza entre estimado, cotizado y pagado.</div>
      <div class="farrow">→</div>
      <div class="fbox"><b>3 · Operar</b>Roles, presupuesto, retención y auditoría.</div>
    </div>
    ${note('ok', 'Decisión de arranque', 'Empezar por <b>vuelos</b> y <b>casetas</b>: son el mayor gasto y la mayor brecha de fuente. Hospedaje y autobuses pueden esperar un ciclo, pero no más: juntos son 25% del gasto.')}
    ${kpis([['49.8%', 'del gasto es vuelo'], ['9/10', 'servicios sin contrato'], ['69%', 'vuelo + hospedaje'], ['0', 'tarifas compradas por API']])}
    <div style="margin-top:auto;border-top:1px solid #e2e8f0;padding-top:9px;display:flex;justify-content:space-between;align-items:flex-end">
      <div>
        <div style="font-size:8.8px;letter-spacing:2px;color:#0b74b7;font-weight:700">ELABORÓ</div>
        <div style="font-family:'Century Gothic';font-size:20px;color:#0b2f5e;font-weight:700">Brandom Ledesma</div>
        <div style="font-size:10px;color:#64748b">Grupo Lefarma · Tecnología · 21 de octubre de 2026</div>
      </div>
      <div style="font-size:8.6px;color:#64748b;text-align:right">Informe de investigación · Viáticos<br>Fuentes y APIs</div>
    </div>`
}));

module.exports = S;
