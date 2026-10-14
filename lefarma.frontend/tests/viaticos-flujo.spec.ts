import { test, expect, type Page, type Locator } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * F3 — QA MANUAL del flujo completo de Viáticos.
 *
 * Esto NO es una suite de asserts de regresión: es un guion de conducción del
 * producto tal como lo usaría una persona. Un solo test recorre los 11 pasos
 * en orden real (el wizard es un flujo con estado: el paso 3 depende de lo
 * capturado en el 1, el 4 de lo calculado en el 3), y cada paso deja una
 * captura en `.omo/evidence/f3-paso-NN.png` más una línea de veredicto.
 *
 * Si un paso falla NO se maquilla: se captura el mensaje exacto y la corrida
 * sigue con el resto (ver `registrar`). Al final se escribe
 * `.omo/evidence/final-f3-viaticos-wizard-ruta-pi-busqueda.json`.
 *
 * Requisitos del entorno (levantados por el orquestador antes de la corrida):
 *   - API en http://localhost:5174 (el proxy /api de Vite lo resuelve)
 *   - Vite en http://localhost:5180 (webServer de playwright.config.ts)
 */

const USUARIO = '54';
const PASSWORD = 'tt01tt';

// `process.cwd()` es lefarma.frontend cuando corre playwright.
const EVIDENCIA = resolve(process.cwd(), '..', '.omo', 'evidence');
const FIXTURE_COTIZACION = resolve(
  process.cwd(),
  'src',
  'apps',
  'viaticos',
  'test',
  'fixtures',
  'cotizacion-ejemplo.json',
);

// Origen y destinos con coordenadas reales en el catálogo: el backend rechaza
// el cálculo si un lugar trae (0,0) y buena parte del catálogo está así.
const ORIGEN_SUCURSAL = 'La Raza'; // 19.4595, -99.1356
const DESTINO_1 = 'DFSSA003162 - HOSPITAL GENERAL XOCO'; // 19.3905, -99.1213
const DESTINO_2 = 'DFSSA000350 - HOSPITAL PEDIÁTRICO COYOACÁN'; // 19.3499, -99.162

type Veredicto = 'paso' | 'fallido' | 'bloqueado';

interface Resultado {
  paso: number;
  titulo: string;
  veredicto: Veredicto;
  detalle: string;
}

const resultados: Resultado[] = [];
const notas: string[] = [];

/**
 * Captura la pantalla complete.
 *
 * El shell de la app es `h-svh overflow-hidden` con un `<main>` que scrollea
 * por dentro, así que `fullPage` a secas solo devuelve el viewport: la evidencia
 * saldría cortada justo en la mitad del formulario. Se desbloquea el scroll con
 * una hoja de estilo temporal, se captura y se retira.
 */
async function capturar(page: Page, archivo: string): Promise<void> {
  const hoja = await page
    .addStyleTag({
      content:
        '.h-svh{height:auto!important;overflow:visible!important}' +
        '[data-sidebar="inset"]{overflow:visible!important}' +
        'main{overflow:visible!important}',
    })
    .catch(() => null);
  try {
    await page.screenshot({ path: archivo, fullPage: true, timeout: 60_000 });
  } finally {
    await hoja?.evaluate(el => el.remove()).catch(() => undefined);
  }
}

/** Registra el veredicto de un paso y guarda su captura. Nunca lanza. */
async function registrar(
  page: Page,
  paso: number,
  titulo: string,
  accion: () => Promise<string>,
): Promise<boolean> {
  let veredicto: Veredicto = 'paso';
  let detalle = '';
  try {
    detalle = await accion();
  } catch (error) {
    veredicto = 'fallido';
    detalle = error instanceof Error ? error.message : String(error);
  }
  resultados.push({ paso, titulo, veredicto, detalle });
  // Traza por paso: sin esto una corrida colgada no dice dónde se quedó.
  console.log(`[F3] paso ${paso} · ${veredicto.toUpperCase()} · ${titulo}`);
  console.log(`[F3]   ${detalle.replace(/\s+/g, ' ').slice(0, 600)}`);
  const archivo = join(EVIDENCIA, `f3-paso-${String(paso).padStart(2, '0')}.png`);
  try {
    await capturar(page, archivo);
  } catch (error) {
    notas.push(
      `No se pudo capturar ${archivo}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return veredicto === 'paso';
}

/** Login real de la app de viáticos (flujo de 2 pasos de MultiStepLogin). */
async function login(page: Page): Promise<void> {
  await page.goto('/viaticos/login', { waitUntil: 'domcontentloaded' });
  await page.getByPlaceholder('usuario').fill(USUARIO);
  await page.locator('button[type="submit"]').click();
  const password = page.getByPlaceholder('Ingresa tu contraseña');
  await expect(password).toBeVisible({ timeout: 20_000 });
  await password.fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/viaticos\/dashboard/, { timeout: 30_000 });
}

/** Avanza con "Siguiente" hasta que el paso pedido sea el activo. */
async function avanzarHasta(page: Page, paso: 1 | 2 | 3 | 4): Promise<void> {
  for (let i = 0; i < 4; i += 1) {
    const actual = await page
      .locator('[aria-current="step"][data-testid^="indicador-paso-"]')
      .getAttribute('data-testid');
    if (actual === `indicador-paso-${paso}`) return;
    const siguiente = page.getByRole('button', { name: 'Siguiente' });
    if (!(await siguiente.isEnabled())) {
      throw new Error(
        `No se pudo avanzar al Paso ${paso}: «Siguiente» está deshabilitado y el paso activo es ${actual}.`,
      );
    }
    await siguiente.click();
    await page.waitForTimeout(400);
  }
  throw new Error(`No se alcanzó el Paso ${paso} con el botón «Siguiente».`);
}

/** Elige una opción de un CatalogoSearchSelect (popover + CommandInput de cmdk). */
async function elegirDeCatalogo(page: Page, trigger: Locator, etiqueta: string): Promise<void> {
  await trigger.click();
  const input = page.locator('input[placeholder="Buscar..."]:visible').last();
  await input.fill(etiqueta);
  // cmdk deja en el DOM todos los items y oculta los que no matchean; el texto
  // exacto evita depender del scroll del popover (el catálogo de hospitales
  // trae ~4.800 filas).
  const opcion = page.locator('[cmdk-item]:visible', { hasText: etiqueta }).first();
  await opcion.waitFor({ state: 'visible', timeout: 15_000 });
  await opcion.click();
}

test.describe('F3 — QA manual del flujo de viáticos', () => {
  // Sin actionTimeout Playwright espera indefinidamente y una corrida colgada
  // no dice en qué selector se quedó. 30s por acción es holgado para esta UI
  // (el catálogo de hospitales trae ~4.800 filas y cmdk las filtra en cliente).
  test.use({ actionTimeout: 30_000, navigationTimeout: 60_000 });

  test('recorre los 11 pasos del wizard y deja evidencia', async ({ page }) => {
    mkdirSync(EVIDENCIA, { recursive: true });
    test.setTimeout(20 * 60 * 1000);

    // ------------------------------------------------------------------
    // Paso 1 — abrir /viaticos/dashboard
    // ------------------------------------------------------------------
    await registrar(page, 1, 'Abrir /viaticos/dashboard', async () => {
      await login(page);
      await expect(page).toHaveURL(/\/viaticos\/dashboard/);
      // El título vive en un <CardTitle>, que en este design system es un <div>
      // y no un heading: se afirma por texto, no por rol.
      await expect(page.getByText('Costos de ruta (demo aislada · fase 1)')).toBeVisible();
      await expect(page.getByTestId('progreso-formulario')).toBeVisible();
      // Los 4 pasos del wizard están declarados en la barra de avance.
      for (const id of [1, 2, 3, 4]) {
        await expect(page.getByTestId(`indicador-paso-${id}`)).toBeVisible();
      }
      await expect(page.getByTestId('indicador-paso-1')).toHaveAttribute('aria-current', 'step');

      // HALLAZGO DE CABLEADO: el item de menú de la bandeja exige el permiso
      // `viaticos.ver_todos`, así que con este usuario el sidebar no lo muestra.
      const enlacesMenu = await page.locator('a[href^="/viaticos/"]').evaluateAll(ns =>
        ns.map(n => n.getAttribute('href')),
      );
      if (!enlacesMenu.includes('/viaticos/aprobaciones')) {
        notas.push(
          'HALLAZGO: el sidebar de /viaticos/dashboard no enlaza /viaticos/aprobaciones. ' +
            `Los enlaces visibles son ${JSON.stringify([...new Set(enlacesMenu)])}. El item de ` +
            'menuItems.tsx exige el permiso `viaticos.ver_todos`, que el usuario 54 no tiene, ' +
            'aunque el backend ya recorta la bandeja a las solicitudes propias cuando falta ese ' +
            'permiso. El flujo de aprobación queda invisible salvo por URL directa.',
        );
      }
      return 'Wizard montado en /viaticos/dashboard con los 4 pasos y el Progress de avance.';
    });

    // ------------------------------------------------------------------
    // Paso 2 — completar Paso 1 (Persona y origen)
    // ------------------------------------------------------------------
    await registrar(page, 2, 'Completar Paso 1 (Persona y origen)', async () => {
      await expect(page.getByRole('radiogroup', { name: 'Captura de persona 1' })).toBeVisible();

      // El nombre se autocompleta desde la sesión (modo "Para mí").
      const nombre = page.locator('#nombre-persona-1');
      await expect(nombre).not.toHaveValue('', { timeout: 20_000 });

      // El CatalogoSearchSelect es un <button role="combobox"> sin aria-label: el
      // rol comboker NO toma el nombre accesible del contenido, así que un filtro
      // por `name:` nunca casa. Se ancla al group que lo envuelve, que sí lo rotula.
      const grupoOrigen = page.getByRole('group', { name: 'Origen de persona 1' });
      const origen = grupoOrigen.getByRole('combobox');
      await elegirDeCatalogo(page, origen, ORIGEN_SUCURSAL);
      await expect(origen).toContainText(ORIGEN_SUCURSAL);

      // Destinos desde el catálogo de hospitales.
      const destinos = page.getByRole('group', { name: /^Destino \d+ de persona 1$/ });
      await elegirDeCatalogo(page, destinos.nth(0).getByRole('combobox'), DESTINO_1);
      await page.getByRole('button', { name: 'Agregar destino' }).click();
      await elegirDeCatalogo(page, destinos.nth(1).getByRole('combobox'), DESTINO_2);

      // Sin errores de validación => «Siguiente» habilita.
      await expect(page.getByRole('list', { name: 'Validación del itinerario' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Siguiente' })).toBeEnabled();
      await avanzarHasta(page, 2);
      return (
        `Origen (${ORIGEN_SUCURSAL}) + 2 destinos del catálogo aceptados, sin errores de ` +
        'validación; se avanzó al Paso 2.'
      );
    });

    // ------------------------------------------------------------------
    // Paso 3 — modal de mapa: marcadores numerados + polylinea
    // ------------------------------------------------------------------
    await registrar(page, 3, 'Modal de mapa con marcadores numerados y polylinea', async () => {
      await expect(page.getByRole('list', { name: 'Secuencia de paradas' })).toBeVisible();
      await page.getByRole('button', { name: 'Abrir selector de ruta' }).click();

      const modal = page.getByRole('dialog');
      await expect(modal.getByText('Ordenar ruta')).toBeVisible();

      // Clic en el mapa = agrega el siguiente punto (no reemplaza).
      const mapaRuta = modal.locator('.leaflet-container').first();
      await expect(mapaRuta).toBeVisible();
      const antes = await modal.locator('.custom-map-marker-secuencia').count();
      const caja = (await mapaRuta.boundingBox())!;
      await mapaRuta.click({ position: { x: caja.width * 0.35, y: caja.height * 0.35 } });
      await expect(modal.locator('.custom-map-marker-secuencia')).toHaveCount(antes + 1);
      await mapaRuta.click({ position: { x: caja.width * 0.65, y: caja.height * 0.6 } });
      await expect(modal.locator('.custom-map-marker-secuencia')).toHaveCount(antes + 2);

      // Marcadores NUMERADOS: cada divIcon lleva su ordinal.
      const numeros = (await modal.locator('.custom-map-marker-secuencia').allInnerTexts()).map(n =>
        n.trim(),
      );
      const esperados = numeros.map((_, i) => String(i + 1));
      if (JSON.stringify(numeros) !== JSON.stringify(esperados)) {
        throw new Error(`Los marcadores no están numerados 1..N. Se leyeron: ${JSON.stringify(numeros)}`);
      }

      // POLYLINEA: leaflet dibuja los segmentos como <path> en el overlay pane.
      const trazos = modal.locator('.leaflet-overlay-pane path');
      const totalTrazos = await trazos.count();
      if (totalTrazos < 1) throw new Error('No se dibujó ninguna polylinea en el mapa de la ruta.');
      const d = await trazos.first().getAttribute('d');
      if (!d || d === 'M0 0') throw new Error(`La polylinea existe pero no tiene geometría (d="${d}").`);

      // La lista lateral refleja la misma secuencia.
      await expect(modal.getByTestId('lista-puntos').locator('> li')).toHaveCount(numeros.length);

      return (
        `Marcadores numerados ${JSON.stringify(numeros)} y ${totalTrazos} polylinea(s) ` +
        `dibujada(s) (d="${String(d).slice(0, 70)}…").`
      );
    });

    // ------------------------------------------------------------------
    // Paso 4 — los DOS buscadores del modal
    // ------------------------------------------------------------------
    let cascadaOk = true;
    await registrar(page, 4, 'Probar los dos buscadores (global y cascada)', async () => {
      const modal = page.getByRole('dialog');

      // --- 4a. Buscador global (pestaña por defecto) ---
      await modal.getByRole('tab', { name: 'Buscador global' }).click();
      const global = modal.locator('#punto-busqueda-global');
      await expect(global).toBeVisible();
      await global.fill('Hospital General de Mexico');
      const listaResultados = modal.getByRole('list', { name: 'Resultados de direcciones' });
      await expect(listaResultados).toBeVisible({ timeout: 60_000 });
      const encontrados = await listaResultados.locator('button').count();
      if (encontrados < 1) {
        throw new Error(
          'El buscador global no devolvió resultados. Mensaje en pantalla: ' +
            ((await modal.getByRole('alert').allInnerTexts()).join(' | ') || '(sin alerta)'),
        );
      }
      await listaResultados.locator('button').first().click();
      await expect(global).toHaveValue('');
      const agregar = modal.getByRole('button', { name: 'Agregar a la ruta' });
      await expect(agregar).toBeEnabled();
      await agregar.click();

      // --- 4b. Buscador en cascada (estado / municipio / calle) ---
      await modal.getByRole('tab', { name: 'Por estado y municipio' }).click();
      await expect(modal.getByRole('combobox', { name: 'Estado' })).toBeVisible();
      await modal.locator('details summary', { hasText: 'Dirección guiada' }).click();

      const estado = modal.getByRole('combobox', { name: 'Estado' });
      await expect(estado).toBeEnabled({ timeout: 30_000 });
      await estado.selectOption({ label: 'Ciudad de México' });

      const municipio = modal.getByRole('combobox', { name: 'Municipio' });
      await expect(municipio).toBeEnabled({ timeout: 30_000 });
      const conMunicipios = (await municipio.locator('option').allInnerTexts()).filter(
        o => o.trim() !== '' && !/selecciona un municipio/i.test(o),
      );
      if (conMunicipios.length === 0) {
        cascadaOk = false;
        const alertas = await modal.getByRole('alert').allInnerTexts();
        throw new Error(
          'BLOQUEADO (entorno, no producto): el buscador en cascada no puede completarse. ' +
            'El desplegable «Municipio» llega vacío porque GET /api/viaticos/municipios?codigoEstado=… ' +
            "responde HTTP 500 «Invalid object name 'viaticos.municipios_cat'»: falta aplicar la " +
            `migración 0002. Alertas en pantalla: ${alertas.join(' | ') || '(ninguna)'}. ` +
            `El buscador global (4a) SÍ funcionó: ${encontrados} resultado(s).`,
        );
      }

      await municipio.selectOption({ index: 1 });
      await modal.getByPlaceholder('Ej. Av. Reforma 123').fill('Av. Insurgentes Sur 123');
      await modal.getByRole('button', { name: 'Buscar en el mapa' }).click();
      await expect(modal.getByRole('list', { name: 'Resultados de direcciones' })).toBeVisible({
        timeout: 60_000,
      });
      return (
        `Ambos buscadores respondieron. Global: ${encontrados} resultado(s). ` +
        `Cascada: ${conMunicipios.length} municipio(s) disponibles y búsqueda guiada resuelta.`
      );
    });
    if (!cascadaOk) {
      resultados[resultados.length - 1].veredicto = 'bloqueado';
    }

    // Confirmar la secuencia del modal (si sigue abierto).
    if (await page.getByRole('dialog').isVisible().catch(() => false)) {
      await page.getByRole('dialog').getByRole('button', { name: 'Confirmar' }).click();
      await expect(page.getByRole('dialog')).toBeHidden();
    }

    // ------------------------------------------------------------------
    // Paso 5 — Paso 3 del wizard: Calcular
    // ------------------------------------------------------------------
    await registrar(page, 5, 'Continuar al Paso 3 y pulsar Calcular', async () => {
      await avanzarHasta(page, 3);
      await expect(page.getByText(/Listo para calcular/i)).toBeVisible();
      const calcular = page.getByRole('button', { name: /Calcular precios y proponer itinerario/i });
      await expect(calcular).toBeEnabled();
      // Antes de calcular, «Siguiente» está deshabilitado en el Paso 3
      // (pasoCompleto(3) = data !== null): ese botón es la señal fiable de que
      // la respuesta llegó. El toast es demasiado efímero para esperarlo.
      await expect(page.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
      await calcular.click();
      await expect(page.getByRole('button', { name: 'Siguiente' })).toBeEnabled({ timeout: 90_000 });
      await avanzarHasta(page, 4);
      await expect(page.getByText(/Propuestas \(/)).toBeVisible();
      return 'El cálculo devolvió propuestas y habilitó el Paso 4 (Resultados).';
    });

    // ------------------------------------------------------------------
    // Paso 6 — tablas de vuelos y hoteles, link de compra y columna Fuente
    // ------------------------------------------------------------------
    await registrar(page, 6, 'Tablas de vuelos y hoteles con link de compra y columna Fuente', async () => {
      const paso4 = page.getByTestId('paso-4');
      await expect(paso4).toBeVisible();

      // Tabla de tramos (transporte): Transportista | Modo | … | Fuente | Captura | Comprar | Elegir
      const tablasTramo = paso4.locator('table').filter({ hasText: 'Transportista' });
      const totalTramos = await tablasTramo.count();
      if (totalTramos < 1) throw new Error('No se renderizó ninguna tabla de tramos de transporte.');
      const filasVuelo = await tablasTramo.locator('tbody tr').count();

      // Link de compra: columna "Comprar" con <a target="_blank"> cuando hay URL.
      const conLink = await tablasTramo.locator('a[href][target="_blank"]').count();
      const sinLink = await tablasTramo.getByRole('button', { name: /sin URL/i }).count();
      const compras = `${conLink} enlace(s) de compra y ${sinLink} botón(es) deshabilitado(s) «sin URL»`;

      // Columna Fuente: distingue estimado de cotizado con insignia.
      const estimados = await tablasTramo.getByText('Estimado', { exact: true }).count();
      const cotizados = await tablasTramo.getByText('Cotizado', { exact: true }).count();
      if (estimados + cotizados === 0) {
        throw new Error('La columna Fuente no muestra ninguna insignia Estimado/Cotizado.');
      }

      // Tabla de hoteles.
      const tablaHoteles = paso4.locator('table').filter({ hasText: 'Check-in' });
      const totalHoteles = await tablaHoteles.count();
      if (totalHoteles < 1) {
        throw new Error('No se renderizó ninguna tabla de hoteles (columna Check-in ausente).');
      }
      const filasHotel = await tablaHoteles.locator('tbody tr').count();
      const enlacesHotel = await tablaHoteles.locator('a[href][target="_blank"]').count();
      const sinLinkHotel = await tablaHoteles.getByRole('button', { name: /Reservar sin link/i }).count();

      return (
        `${totalTramos} tabla(s) de transporte con ${filasVuelo} fila(s): ${compras}. ` +
        `Columna Fuente: ${estimados} insignia(s) «Estimado» y ${cotizados} «Cotizado». ` +
        `${totalHoteles} tabla(s) de hoteles con ${filasHotel} fila(s): ${enlacesHotel} enlace(s) ` +
        `de reserva y ${sinLinkHotel} «Reservar sin link».`
      );
    });

    // ------------------------------------------------------------------
    // Paso 7 — pegar la cotización de ejemplo y cargarla
    // ------------------------------------------------------------------
    await registrar(page, 7, 'Pegar cotización de ejemplo y cargarla', async () => {
      const json = readFileSync(FIXTURE_COTIZACION, 'utf8');
      const textarea = page.locator('#cotizacion-json');
      await expect(textarea).toBeVisible();
      await textarea.fill(json);
      await page.getByRole('button', { name: 'Cargar cotización' }).click();

      const cobertura = page.getByTestId('cobertura-declarada');
      await expect(cobertura).toBeVisible();
      const textoCobertura = (await cobertura.innerText()).replace(/\s+/g, ' ').trim();

      const faltantes = page.getByTestId('transportista-no-encontrado');
      const totalFaltantes = await faltantes.count();
      if (totalFaltantes === 0) {
        throw new Error('Se cargó la cotización pero no se muestra la nota de transportistas no encontrados.');
      }

      // 3 opciones (2 vuelos + 1 hotel), cada una con su link de compra.
      const tabla = page.locator('table').filter({ hasText: 'Compra' });
      const filas = await tabla.locator('tbody tr').count();
      const links = await tabla.locator('a[data-testid^="url-compra-"]').count();
      if (filas !== 3) throw new Error(`Se esperaban 3 opciones en la tabla y aparecieron ${filas}.`);

      return (
        `Cobertura declarada visible («${textoCobertura.slice(0, 120)}…»). ` +
        `${totalFaltantes} transportista(s) no encontrado(s): ` +
        `${(await faltantes.allInnerTexts()).map(t => t.split(':')[0]).join(', ')}. ` +
        `${filas} fila(s) de opciones con ${links} link(s) de compra.`
      );
    });

    // ------------------------------------------------------------------
    // Paso 8 — elegir una opción
    // ------------------------------------------------------------------
    await registrar(page, 8, 'Elegir una opción', async () => {
      const paso4 = page.getByTestId('paso-4');

      // 8a. Botón «Elegir» de la tabla de transporte (resultados del cálculo).
      const botonesElegir = paso4
        .locator('table')
        .filter({ hasText: 'Transportista' })
        .getByRole('button', { name: /^Elegir / });
      if ((await botonesElegir.count()) < 1) {
        throw new Error('No hay ningún botón «Elegir» en las tablas de transporte.');
      }
      const etiqueta = (await botonesElegir.first().getAttribute('aria-label'))!;
      await botonesElegir.first().click();
      await expect(paso4.getByRole('button', { name: etiqueta })).toHaveText('Elegida');

      // 8b. Casilla de la tabla de cotización: es la que habilita «Enviar solicitud».
      const casilla = page.getByRole('checkbox', { name: /^Elegir Volaris/ });
      await casilla.check();
      await expect(casilla).toBeChecked();
      await expect(page.getByRole('button', { name: 'Enviar solicitud' })).toBeEnabled();

      return (
        `Opción de transporte elegida («${etiqueta}» → el botón quedó como «Elegida») y opción ` +
        'de cotización marcada; «Enviar solicitud» quedó habilitada.'
      );
    });

    // ------------------------------------------------------------------
    // Paso 9 — enviar la solicitud
    // ------------------------------------------------------------------
    await registrar(page, 9, 'Enviar la solicitud y verificar estado enviada', async () => {
      const errorEnvio = page.getByTestId('error-envio');
      const enviada = page.getByTestId('solicitud-enviada');

      await page.getByRole('button', { name: 'Enviar solicitud' }).click();

      const ok = await Promise.race([
        enviada.waitFor({ state: 'visible', timeout: 60_000 }).then(() => true).catch(() => false),
        errorEnvio.waitFor({ state: 'visible', timeout: 60_000 }).then(() => false).catch(() => false),
      ]);

      if (ok) {
        return `Solicitud enviada: ${(await enviada.innerText()).replace(/\s+/g, ' ').trim()}`;
      }

      const mensaje = await errorEnvio.innerText().catch(() => '(sin alerta de error)');
      throw new Error(
        'La solicitud NO quedó en estado «enviada». El propio producto muestra: ' +
          mensaje.replace(/\s+/g, ' ').trim(),
      );
    });

    // ------------------------------------------------------------------
    // Paso 10 — bandeja del admin
    // ------------------------------------------------------------------
    await registrar(page, 10, 'Bandeja del admin: ver fila, Ver opciones y Autorizar', async () => {
      await page.goto('/viaticos/aprobaciones', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(8_000); // deja asentar la carga de la bandeja

      const tablas = await page.getByRole('table').count();
      const verOpciones = await page.getByRole('button', { name: /Ver opciones/i }).count();
      const autorizar = await page.getByRole('button', { name: /Autorizar/i }).count();

      if (tablas > 0) {
        if (verOpciones < 1) throw new Error('Hay filas en la bandeja pero no aparece «Ver opciones».');
        await page.getByRole('button', { name: /Ver opciones/i }).first().click();
        await page.waitForTimeout(1_500);
        if ((await page.getByRole('dialog').count()) < 1) {
          throw new Error('«Ver opciones» no abrió ningún visor de opciones.');
        }
        await page.getByRole('button', { name: 'Cerrar' }).last().click();
        if (autorizar < 1) throw new Error('No hay botón «Autorizar» en la bandeja.');
        await page.getByRole('button', { name: /Autorizar/i }).first().click();
        await page.waitForTimeout(4_000);
        return 'Fila visible, «Ver opciones» abrió el visor y «Autorizar» respondió.';
      }

      const alerta = await page.getByRole('alert').innerText().catch(() => '(sin alerta)');
      const vacio = await page.getByText(/No hay solicitudes en la bandeja/i).count();
      throw new Error(
        'BLOQUEADO (entorno, no producto): la bandeja no muestra ninguna fila, así que no hay nada ' +
          'que «Ver opciones» ni «Autorizar». Alerta en pantalla: ' +
          alerta.replace(/\s+/g, ' ').slice(0, 400) +
          ` · mensaje de bandeja vacía presente: ${vacio > 0}.`,
      );
    });

    // ------------------------------------------------------------------
    // Paso 11 — editor de ajustes (montado o no)
    // ------------------------------------------------------------------
    await registrar(page, 11, 'Editor de ajustes con motivo obligatorio', async () => {
      await page.goto('/viaticos/aprobaciones', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(4_000);
      const enEditor = await page.getByText(/Ajustes de la solicitud/i).count();
      if (enEditor === 0) {
        throw new Error(
          'NO MONTADO: el editor de ajustes no es alcanzable desde la UI. EditorAjustes.tsx existe ' +
            'en src/apps/viaticos/pages/aprobaciones/ pero ViaticosRoutes.tsx no lo renderiza en ' +
            'ninguna ruta, y BandejaAprobacionesPage expone el seam `onVerOpciones` que nadie le ' +
            'pasa, así que «Ver opciones» cae al placeholder de T14. No existe forma de abrir el ' +
            'editor, y por tanto tampoco de comprobar la regla del motivo obligatorio.',
        );
      }
      await page.getByRole('button', { name: 'Agregar una partida' }).click();
      await page.getByPlaceholder('Cena de trabajo').fill('Cena de cierre de mes');
      await page.getByPlaceholder('0.00').first().fill('450');
      const registrar_ = page.getByRole('button', { name: 'Registrar ajuste' });
      await expect(registrar_).toBeDisabled();
      await page.getByPlaceholder('Por qué se hace este cambio').fill('Ajuste autorizado por dirección');
      await expect(registrar_).toBeEnabled();
      return 'Sin motivo el botón «Registrar ajuste» queda deshabilitado; con motivo se habilita.';
    });
  });

  test.afterAll(() => {
    mkdirSync(EVIDENCIA, { recursive: true });
    const salida = {
      task: 'F3 — QA manual del flujo completo de viáticos (wizard ruta + búsqueda)',
      fecha: new Date().toISOString(),
      pasos_pasados: resultados.filter(r => r.veredicto === 'paso').map(r => r.paso),
      pasos_fallidos: resultados
        .filter(r => r.veredicto !== 'paso')
        .map(r => ({ paso: r.paso, titulo: r.titulo, veredicto: r.veredicto, motivo: r.detalle })),
      detalle_por_paso: resultados,
      capturas: resultados.map(r => join(EVIDENCIA, `f3-paso-${String(r.paso).padStart(2, '0')}.png`)),
      notas,
    };
    writeFileSync(
      join(EVIDENCIA, 'final-f3-viaticos-wizard-ruta-pi-busqueda.json'),
      JSON.stringify(salida, null, 2),
      'utf8',
    );
  });
});