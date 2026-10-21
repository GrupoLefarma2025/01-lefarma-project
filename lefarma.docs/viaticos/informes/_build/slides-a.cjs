const { slide, divider, table, bullets, kpis, note } = require('./ui.cjs');

const S = [];

S.push(slide({
  section: 'Índice',
  title: 'Qué contiene este informe',
  tag: '00 · Índice',
  body: `
    <p class="lead">Seis secciones y cuatro anexos. Cada hoja declara la fuente exacta al pie; los importes corresponden a octubre de 2026 y se contrastaron con el concentrado real.</p>
    <div class="idx">
      <div class="idxi"><div class="idxn">01</div><div class="idxt"><b>Contexto y proceso</b><span>Cómo viaja el dinero: matriz mensual, solicitud, autorizaciones, concentrado y firmas.</span></div></div>
      <div class="idxi"><div class="idxn">02</div><div class="idxt"><b>Fuentes de datos</b><span>INEGI, OpenStreetMap, SCT, CNE, tabuladores, seeds e históricos de gasto.</span></div></div>
      <div class="idxi"><div class="idxn">03</div><div class="idxt"><b>APIs del módulo</b><span>17 endpoints, motor de costos, servicios externos, contrato del agente y capturas.</span></div></div>
      <div class="idxi"><div class="idxn">04</div><div class="idxt"><b>Proveedores evaluados</b><span>Vuelos, hospedaje, autobuses, rutas/casetas y tipo de cambio: opciones y costo.</span></div></div>
      <div class="idxi"><div class="idxn">05</div><div class="idxt"><b>Riesgos y cumplimiento</b><span>Políticas de OSM, datos que envejecen, seguridad de llaves y privacidad.</span></div></div>
      <div class="idxi"><div class="idxn">06</div><div class="idxt"><b>Recomendaciones</b><span>Hoja de ruta 0–30 / 30–90 / 90–180 días y cinco decisiones de negocio.</span></div></div>
      <div class="idxi"><div class="idxn">A</div><div class="idxt"><b>Anexos</b><span>Inventario de endpoints, configuración y secretos, fuentes consultadas y glosario.</span></div></div>
      <div class="idxi"><div class="idxn">i</div><div class="idxt"><b>Cómo leer las cifras</b><span>“Estimado” = cálculo propio; “publicado” = tarifa de una fuente. Nunca se mezclan.</span></div></div>
    </div>`,
  src: 'Elaboración propia. Estructura alineada al formato del manual institucional (16:9, portada, panel y pie de página).'
}));

S.push(slide({
  section: 'Resumen ejecutivo',
  title: 'El módulo ya cotiza; la brecha es la fuente del precio',
  tag: '00 · Resumen',
  body: `
    <div class="body">
      ${bullets([
        '<b>Cobertura funcional completa.</b> 17 endpoints, 7 tablas y un flujo que va del borrador al concentrado FOR-008, con folio, estados, ajustes y evidencia.',
        '<b>Dependencia externa alta.</b> El motor consulta 10 servicios; 9 se usan sin contrato ni SLA. Solo INEGI, SCT y CNE son fuentes oficiales, y la SCT no ofrece API: se lee su formulario.',
        '<b>El gasto se concentra en dos rubros.</b> Vuelos (49.8% del total) y hospedaje (19.1%). En vuelos no hay proveedor: el precio sale de una fórmula etiquetada como estimado.',
        '<b>Hay deuda de cumplimiento.</b> Nominatim prohíbe el autocompletado y la interfaz busca mientras se escribe; el demo de OSRM es no comercial y la app es corporativa.',
        '<b>La salida es contractual, no técnica.</b> Contratar un API de vuelos (Amadeus o Duffel), uno de hospedaje (Booking o Duffel Stays) y uno de rutas/casetas (Google Routes o TollGuru); el estimado interno queda como control.'
      ])}
    </div>
    ${note('warn', 'Hallazgo crítico', 'El importe que hoy se firma es un <b>estimado de planeación</b>, no una tarifa comprada. La diferencia entre firmar y comprar no está medida: no existe hoy una comparación sistemática entre el estimado y el boleto pagado.')}
    <div class="cols" style="margin-top:6px">
      <div class="quote" style="border-color:#f5c6c0;background:#fff8f7"><b>Hoy</b>Precio de fórmula, sin disponibilidad ni tarifa confirmada; la evidencia se captura a mano y el gasto real se concilia fuera del módulo.</div>
      <div class="quote" style="border-color:#b7e4d0;background:#f5fdf9"><b>Con la recomendación</b>Tarifa de proveedor con vigencia, evidencia automática y una varianza medible entre lo cotizado, lo autorizado y lo pagado.</div>
    </div>`,
  src: 'F1–F11, F18–F28. Ver anexo de fuentes.'
}));

S.push(slide({
  section: 'Método',
  title: 'Alcance, método y límites',
  tag: '00 · Método',
  body: `
    ${kpis([['17', 'endpoints revisados'], ['10', 'servicios externos'], ['28', 'fuentes citadas'], ['20', 'viajes conciliados']])}
    <div class="cols">
      <div class="body">
        <b>Qué se revisó</b>
        ${bullets([
          'Código backend de Viáticos: controladores, motor de costos, geocodificación, casetas, capturas y Places.',
          'Código frontend: wizard, mapa Leaflet, tablas de cotización, importador y contrato JSON.',
          'Scripts SQL de Viáticos: tablas, folio, configuración, municipios y permisos.',
          'ADRs 00003, 00007 y 00013; reglas de negocio; formatos FOR-001/FOR-008; cinco libros históricos.',
          'Documentación oficial y precios de lista de los proveedores evaluados.'
        ])}
      </div>
      <div class="body">
        <b>Cómo se verificó</b>
        ${bullets([
          'Lectura estática y trazo del flujo de datos: qué endpoint llama a qué servicio y con qué respaldo.',
          'Conciliación con el concentrado de octubre 2026: 20 viajes, 5 viajeros, $276,357 MXN.',
          'Contraste de cada servicio externo contra su política o página oficial, consultada el 21-oct-2026.',
          'Separación explícita entre dato publicado, dato estimado y dato histórico.'
        ])}
      </div>
    </div>
    ${note('amber', 'Límites del informe', 'No se tuvo acceso a contratos, facturación ni logs de tráfico de los proveedores. Los precios de lista pueden cambiar. El concentrado histórico cubre un mes y cinco viajeros de CDMX: no es una muestra representativa de todas las rutas.')}`,
  src: 'F1–F12. Fechas de consulta: 20–21 de octubre de 2026.'
}));

S.push(divider({
  num: '01',
  title: 'Contexto y proceso',
  desc: 'Viáticos no es un formulario aislado: es la Fase 3 del ciclo mensual de talleres médicos. Entender ese ciclo explica por qué el módulo necesita precios, evidencia y firmas.'
}));

S.push(slide({
  section: '01 · Contexto',
  title: 'El proceso hoy: de la matriz mensual al concentrado',
  tag: '01 · Proceso',
  body: `
    <p class="lead">La matriz autorizada dispara tres subflujos: material, box lunch y viáticos. Viáticos se solicita por correo, se autoriza en cadena y se cierra con un concentrado firmado.</p>
    <div class="cols wide">
      <div class="steps">
        <div class="step"><b>Matriz mensual FOR-005</b><span>El AEM costea los talleres; GV firma, CA revisa y DC autoriza. La matriz autorizada habilita el viaje.</span></div>
        <div class="step"><b>Solicitud de viáticos</b><span>Conforme a ASK-GGE-IDT-001; el formato ASK-ADM-FOR-001 captura transporte, alimentos, hospedaje, gasolina, casetas, taxis y avión.</span></div>
        <div class="step"><b>Autorización en cadena</b><span>Gerente de Ventas, Coordinador Administrativo, Gerente General y Dirección Corporativa revisan y firman.</span></div>
        <div class="step"><b>Ejecución del viaje</b><span>El viajero compra y conserva comprobantes; el calendario FOR-006 y el recibido FOR-007 acompañan la operación.</span></div>
        <div class="step"><b>Concentrado FOR-008</b><span>Se consolidan los viajes del periodo; firman Coordinador Administrativo, Gerente General, GAF y Dirección Corporativa.</span></div>
      </div>
      <div class="body">
        <b>Quién hace qué</b>
        ${table(['Rol', 'Responsabilidad'], [
          ['AEM / EV / EP', 'Solicita y ejecuta el viaje'],
          ['GV', 'Firma la matriz y revisa viáticos'],
          ['CA', 'Revisa costos y concentra'],
          ['GG / DC', 'Autorizan el gasto'],
          ['Tesorería', 'Paga y comprueba']
        ], 'tight')}
        <div style="margin-top:8px">
          <span class="chip">FOR-005</span><span class="chip">FOR-006</span><span class="chip">FOR-007</span><span class="chip">FOR-008</span><span class="chip">ASK-GGE-IDT-001</span>
        </div>
        ${note('amber', 'Documento faltante', 'El instructivo <b>ASK-GGE-IDT-001</b> “Solicitud y aprobación de viáticos” no está digitalizado en el set. Su contenido se reconstruye por referencias; es la principal laguna documental del proceso.')}
      </div>
    </div>`,
  src: 'F7 (reglas de negocio, fases y roles), F4 (ADR-00003, §Contexto), F8 (FORM-008).'
}));

S.push(slide({
  section: '01 · Contexto',
  title: 'Cuánto se gasta y en qué',
  tag: '01 · Volumen',
  body: `
    <p class="lead">Octubre 2026: 20 viajes de cinco personas, todos con origen en CDMX. El promedio por viaje es de $13,818 MXN; 14 viajes incluyen vuelo.</p>
    ${kpis([['$276,357', 'gasto total del mes'], ['$13,818', 'promedio por viaje'], ['49.8%', 'participación de vuelos'], ['69%', 'vuelo + hospedaje']])}
    ${table(['Rubro', 'Importe (MXN)', 'Participación', 'Lectura'], [
      ['Costo boleto avión', '137,630', '49.8%', '14 viajes; promedio $9,831 por viaje con vuelo'],
      ['Hospedaje', '52,896', '19.1%', 'Rubro tipo tabulador; sensible a la ciudad'],
      ['Taxi', '44,250', '16.0%', 'Traslados urbanos y a terminales'],
      ['Comida', '25,100', '9.1%', 'Costo diario por viajero'],
      ['Costo boleto autobús', '16,481', '6.0%', 'Seis viajes sin vuelo'],
      ['Gasolina / casetas', '0', '0.0%', 'No hubo viajes en auto propio en el periodo']
    ], 'tight')}
    ${note('warn', 'Dónde duele un error de precio', 'Vuelo y hospedaje concentran <b>69% del gasto</b>. Un error de 10% en vuelos mueve el presupuesto mensual más que todos los taxis juntos. Por eso la prioridad de integración son vuelos y hospedaje, no el transporte urbano.')}`,
  src: 'F8: concentrado “VIATICOS EDUCACION MEDICA OCTUBRE 2026” (ASK-ADM-FOR-008), renglón Total y 20 renglones de viaje.'
}));

S.push(slide({
  section: '01 · Contexto',
  title: 'Qué está implementado',
  tag: '01 · Módulo',
  body: `
    <p class="lead">El módulo es una SPA React sobre una API .NET con SQL Server. Cotiza por persona, arma seis propuestas, guarda la opción elegida y la lleva al concentrado.</p>
    <div class="flow">
      <div class="fbox"><b>1 · Wizard</b>Personas, ruta, fechas, modo y puntos en mapa</div>
      <div class="farrow">→</div>
      <div class="fbox"><b>2 · Motor</b>Ruta, opciones por modo, hoteles y totales</div>
      <div class="farrow">→</div>
      <div class="fbox"><b>3 · Evidencia</b>Fuente, precio, URL de compra y captura</div>
      <div class="farrow">→</div>
      <div class="fbox"><b>4 · Salida</b>Borrador, folio, autorización y FOR-008</div>
    </div>
    <div class="cols">
      <div class="body">
        <b>Piezas técnicas</b>
        ${bullets([
          'Frontend React 19 + Vite; mapa Leaflet con teselas OSM; tablas TanStack.',
          'API .NET 10 con JWT y permisos; 17 endpoints bajo <b>/api/viaticos</b>.',
          'SQL Server, esquema <b>viaticos</b>: solicitudes, opciones, ajustes, eventos, municipios y configuración.',
          'Capturas con Playwright headless y almacenamiento en <b>wwwroot/media</b>.'
        ])}
      </div>
      <div class="body">
        <b>Reglas de oro</b>
        ${bullets([
          'Ninguna opción se muestra sin <b>fuente</b>; si es cálculo propio, lleva <b>estimado: true</b>.',
          'El folio nace antes del INSERT: <b>VIA-{sam}-{0000}</b> con secuencia de SQL Server.',
          'Los ajustes del administrador guardan valor anterior, valor nuevo y motivo.',
          'La solicitud guarda un <b>datos_json</b> completo y columnas planas para el concentrado.'
        ])}
      </div>
    </div>
    <div style="margin-top:6px"><b>Modelo de datos</b></div>
    ${table(['Tabla', 'Qué guarda', 'Clave de auditoría'], [
      ['solicitudes', 'Maestro: folio, periodo, gerencia, estado y datos_json', 'fecha_creacion / modificación'],
      ['solicitud_opciones', 'Oferta, precio, moneda, URL, fuente y captura', 'fue_elegida, capturada_en'],
      ['solicitud_ajustes', 'Campo, valor anterior, valor nuevo y motivo', 'id_usuario_admin'],
      ['solicitud_eventos', 'Bitácora append-only del workflow', 'id_usuario, payload_json'],
      ['municipios_cat / config', 'Catálogos y parámetros del motor', 'Sin auditoría de cambios']
    ], 'tight')}`,
  src: 'F1 (controladores y servicios), F2 (rutas y wizard), F3 (scripts 0005–0014 y 0100).'
}));

S.push(slide({
  section: '01 · Contexto',
  title: 'Estados, permisos y trazabilidad',
  tag: '01 · Control',
  body: `
    <p class="lead">El flujo es corto y explícito: cinco estados, cuatro permisos y una bitácora append-only. El límite está en lo que ocurre fuera del sistema.</p>
    <div class="flow">
      <div class="fbox"><b>borrador</b>Editable; aún no compromete</div>
      <div class="farrow">→</div>
      <div class="fbox"><b>enviada</b>Entra a la bandeja de autorización</div>
      <div class="farrow">→</div>
      <div class="fbox"><b>autorizada</b>Se puede concentrar</div>
      <div class="farrow">/</div>
      <div class="fbox"><b>autorizada con ajustes</b>Se ajustó después de autorizar</div>
      <div class="farrow">/</div>
      <div class="fbox"><b>rechazada</b>Motivo obligatorio</div>
    </div>
    <div class="cols">
      <div class="body">
        <b>Lo que sí queda auditado</b>
        ${bullets([
          'Quién creó, envió, autorizó, rechazó o ajustó, con fecha y payload del evento.',
          'Qué opción se eligió, con precio, moneda, URL, fuente y captura fechada.',
          'Qué campo cambió un ajuste, con valor anterior, valor nuevo y motivo.',
          'El folio y el periodo del viaje, ligados al solicitante y al viajero.'
        ])}
      </div>
      <div class="body">
        <b>Lo que no queda auditado</b>
        ${bullets([
          'La fuente del precio histórico de los Excel: no hay columna de proveedor ni captura.',
          'La tarifa realmente comprada y su comparación contra el estimado.',
          'El CFDI y la conciliación post-gasto: fuera del alcance actual.',
          'Los cambios a <b>config_parametros</b>: la tabla no tiene columnas de auditoría.'
        ])}
      </div>
    </div>
    ${note('amber', 'Permisos hoy', 'Solo SuperAdministrador tiene <b>viaticos.solicitar</b>, <b>autorizar</b>, <b>ver_todos</b> y <b>ajustar</b>. La matriz de roles sigue pendiente (ADR-00013); sin ella, el módulo no puede operar fuera del piloto.')}
    ${table(['Permiso', 'Qué habilita', 'Rol que lo tiene hoy'], [
      ['viaticos.solicitar', 'Crear, editar y enviar la solicitud', 'SuperAdministrador'],
      ['viaticos.autorizar', 'Bandeja, autorizar, rechazar y concentrado', 'SuperAdministrador'],
      ['viaticos.ver_todos', 'Ver solicitudes de otras personas', 'SuperAdministrador'],
      ['viaticos.ajustar', 'Modificar un importe con motivo', 'SuperAdministrador']
    ], 'tight')}`,
  src: 'F1 (controladores de solicitudes y aprobaciones), F3 (tabla de eventos y ajustes), F6 (ADR-00013, §Permisos).'
}));

module.exports = S;
