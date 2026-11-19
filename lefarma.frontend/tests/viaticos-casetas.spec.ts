import { expect, test, type Locator, type Page } from '@playwright/test';

const bandejaItem = {
  id_solicitud: 5,
  folio: 'VIA-E2E-0005',
  id_usuario_solicitante: 9,
  nombre_solicitante: 'Persona E2E',
  periodo: '2026-11',
  gerencia: 'Operaciones',
  destino: 'Zapopan',
  origen: 'Guadalajara',
  estado: 'enviada',
  autobus: null,
  avion: null,
  gasolina: 900,
  casetas: 120,
  vehiculo_propio: null,
  hospedaje: null,
  comida: null,
  taxi: null,
  total: 900,
  fecha_creacion: '2026-11-05T10:00:00',
  fecha_modificacion: '2026-11-05T10:00:00',
  recalculada: true,
};

const detalle = {
  id_solicitud: 5,
  id_usuario_solicitante: 9,
  periodo: '2026-11',
  gerencia: 'Operaciones',
  estado: 'enviada',
  activo: true,
  fecha_creacion: '2026-11-05T10:00:00',
  fecha_modificacion: '2026-11-05T10:00:00',
  datos: {
    version: 'solicitud-v2',
    persona: { modo: 'mia', nombre: 'Persona E2E', motivo: 'Visual verification' },
    transporte: { modo: 'propio', compartir: false, acompanantes: [] },
    origen: {
      punto: {
        nombre: 'Guadalajara',
        latitud: 20.67,
        longitud: -103.34,
        municipio: 'Guadalajara',
        estado: 'Jalisco',
      },
      fechaSalida: '2026-11-10',
      horaSalida: '08:00',
    },
    destinos: [
      {
        punto: {
          nombre: 'Zapopan',
          latitud: 20.72,
          longitud: -103.39,
          municipio: 'Zapopan',
          estado: 'Jalisco',
        },
        debeEstarFecha: '2026-11-10',
        debeEstarHora: '14:00',
        saleFecha: '2026-11-10',
        saleHora: '18:00',
      },
    ],
    retorno: { destino: 'origen' },
    calculo: {
      generado_en: '2026-11-05T10:00:00Z',
      margen: 0.1,
      modo_transporte: 'propio',
      km_total: 120,
      horas_total: '2h 12m',
      tramos: [
        {
          de: 'Guadalajara, Jalisco',
          a: 'Zapopan, Jalisco',
          km: 120,
          duracion: '2h 00m',
          duracion_con_margen: '2h 12m',
          salida_fecha: '2026-11-10',
          salida_hora: '08:00',
          llegada_fecha: '2026-11-10',
          llegada_hora: '10:12',
          alcanza: true,
          casetas: [],
          costo: 900,
          moneda: 'MXN',
          url_compra: null,
          linea: 'Auto propio',
        },
      ],
    },
  },
  opciones: [],
  eventos: [],
};

function motorResponse(disponible: boolean, regreso = false) {
  return {
    resultados: [
      {
        nombre: 'Persona E2E',
        gasolina: 'magna',
        propuesta: { razones: [], lugares: [] },
        tramos: [
          {
            from: 'Guadalajara',
            to: 'Zapopan',
            km: 120,
            opciones: [
              {
                id: 'auto-e2e',
                modo: 'auto',
                linea: 'Auto propio',
                servicio: '120 km carretera',
                persona: 'Persona E2E',
                tramo: 1,
                de: 'Guadalajara',
                a: 'Zapopan',
                salida: '2026-11-10T08:00',
                llegada: '2026-11-10T10:00',
                salidaTxt: '10/11 08:00',
                llegadaTxt: '10/11 10:00',
                duracion: '2h 00m',
                puertaAPuertaH: 2,
                minutosAntes: 0,
                minutosDespues: 0,
                minutosTaxi: 0,
                minutosTaxiOrigen: null,
                minutosTaxiDestino: null,
                terminalOrigen: null,
                terminalDestino: null,
                precioTxt: '$900 MXN total',
                porPersona: false,
                precioDesde: 900,
                precioHasta: 900,
                costoGrupo: 900,
                costoPorPersona: 900,
                aTiempo: true,
                llegaTarde: false,
                minutosTarde: 0,
                noTomable: false,
                badge: '',
                nota: '',
                fuente: 'OSRM + CNE (browser fixture)',
                estimado: false,
                combustible: 780,
                casetasEstimadas: 120,
                comprar: { url: '', sitio: '', accion: '', objetivo: '', fecha: '2026-11-10' },
              },
            ],
          },
        ],
        rutaArmada: {
          tramos: [],
          totales: { km: 120, litros: 10, casetas: 120, subtotalMagna: 900, subtotalPremium: 1000 },
        },
        hotelesPropuestos: [],
        incumplimientos: [],
        casetas: disponible
          ? [
              {
                tramo: 1,
                deMunicipio: 'Guadalajara',
                aMunicipio: 'Zapopan',
                nombre: 'Ojo de Agua',
                carretera: 'México - Pachuca',
                km: 63.4,
                tarifa: 72,
                direccion: 'México - Pachuca',
                fuente: 'SCT · Rutas Punto a Punto',
              },
            ]
          : [],
        casetasDisponibilidad: [
          {
            tramo: 1,
            deMunicipio: regreso ? 'Zapopan' : 'Guadalajara',
            aMunicipio: regreso ? 'Guadalajara' : 'Zapopan',
            estado: disponible ? 'disponible' : 'proveedor_no_disponible',
            kmTotal: disponible ? 97.35 : null,
            tiempoTotal: disponible ? '01:15' : null,
            peajeTotal: disponible ? 72 : null,
            fuente: disponible ? 'SCT · Rutas Punto a Punto' : '',
          },
        ],
      },
    ],
    propuestas: [],
    categorias: {},
    recomendaciones: [],
    compartidos: [],
  };
}

async function expectStableDialogBounds(dialog: Locator) {
  await expect.poll(async () => dialog.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const expectedWidth = Math.min(window.innerWidth * 0.96, 1400);
    return {
      settledWidth: Math.abs(rect.width - expectedWidth) <= 1,
      insideViewport: rect.left >= 0 && rect.right <= window.innerWidth,
      documentHasNoHorizontalOverflow:
        document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      dialogHasNoHorizontalOverflow: element.scrollWidth <= element.clientWidth + 1,
    };
  })).toEqual({
    settledWidth: true,
    insideViewport: true,
    documentHasNoHorizontalOverflow: true,
    dialogHasNoHorizontalOverflow: true,
  });
}

async function expectNoVerticalOverflow(dialog: Locator) {
  await expect.poll(async () => dialog.evaluate(
    (element) => element.scrollHeight <= element.clientHeight + 1,
  )).toBe(true);
}

async function expectDesktopColumns(dialog: Locator) {
  const layout = dialog.getByTestId('calculos-viaje-layout');
  const schedule = dialog.getByTestId('calculos-viaje-schedule-column');
  const costs = dialog.getByTestId('calculos-viaje-cost-column');
  await expect(layout).toBeVisible();
  await expect.poll(async () => {
    const [left, right] = await Promise.all([schedule.boundingBox(), costs.boundingBox()]);
    return left !== null
      && right !== null
      && left.x < right.x
      && Math.abs(left.y - right.y) <= 1;
  }).toBe(true);
}

async function expectMobileColumns(dialog: Locator) {
  const layout = dialog.getByTestId('calculos-viaje-layout');
  const schedule = dialog.getByTestId('calculos-viaje-schedule-column');
  const costs = dialog.getByTestId('calculos-viaje-cost-column');
  await expect(layout).toBeVisible();
  await expect.poll(async () => {
    const [left, right] = await Promise.all([schedule.boundingBox(), costs.boundingBox()]);
    return left !== null
      && right !== null
      && Math.abs(left.x - right.x) <= 1
      && right.y >= left.y + left.height;
  }).toBe(true);
}

async function captureModal(page: Page, name: string) {
  await page.screenshot({
    path: `test-results/${name}.png`,
    fullPage: true,
    animations: 'disabled',
  });
}

async function captureResponsiveModal(
  page: Page,
  dialog: Locator,
  name: string,
  typicalDesktopFixture = false,
) {
  await page.setViewportSize({ width: 1366, height: 768 });
  await expectStableDialogBounds(dialog);
  await expectDesktopColumns(dialog);
  if (typicalDesktopFixture) await expectNoVerticalOverflow(dialog);
  await captureModal(page, `${name}-1366x768`);

  await page.setViewportSize({ width: 360, height: 900 });
  await expectStableDialogBounds(dialog);
  await expectMobileColumns(dialog);
  await captureModal(page, `${name}-360`);

  const detail = dialog.getByRole('region', { name: 'Detalle de casetas SCT' });
  await detail.scrollIntoViewIfNeeded();
  await expect(detail).toBeVisible();
  const searchAgain = dialog.getByRole('button', { name: /Volver a buscar|Reintentar/ });
  await searchAgain.scrollIntoViewIfNeeded();
  await expect(searchAgain).toBeVisible();
  await expect(dialog).toHaveCSS('overflow-y', 'auto');
}

async function openCalculosModal(page: Page) {
  await page.goto('/viaticos/concentrado', { waitUntil: 'domcontentloaded' });
  const row = page.getByTestId('concentrado-5');
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: /Ver detalle/i }).click();
  await expect(page.getByTestId('revision-solicitud')).toBeVisible();
  await page.getByRole('button', { name: 'Recalcular ruta' }).click();
  const dialog = page.getByRole('dialog', { name: /Cálculos del viaje/ });
  await expect(dialog).toBeVisible();
  return dialog;
}

test.use({ viewport: { width: 1366, height: 768 } });

test('shows official reference, included estimate, preserved timing, and incomplete round-trip state', async ({ page }) => {
  test.setTimeout(180_000);
  let calculationCalls = 0;
  type VisualScenario = 'roundtrip' | 'zero-plaza' | 'destino_no_soportado' | 'respuesta_invalida';
  let visualScenario: VisualScenario = 'roundtrip';
  await page.addInitScript(() => {
    localStorage.setItem('accessToken', 'e2e-fake-token');
    localStorage.setItem('user', JSON.stringify({
      id: 1,
      username: 'e2e',
      nombre: 'Persona E2E',
      correo: 'e2e@example.test',
      dominio: 'DC',
      roles: [],
      permisos: [
        {
          idPermiso: 1,
          codigoPermiso: 'viaticos.autorizar',
          nombrePermiso: 'Autorizar viáticos',
          categoria: 'Viaticos',
          recurso: 'viaticos',
          accion: 'autorizar',
        },
        {
          idPermiso: 2,
          codigoPermiso: 'viaticos.ver_todos',
          nombrePermiso: 'Ver todos los viáticos',
          categoria: 'Viaticos',
          recurso: 'viaticos',
          accion: 'ver_todos',
        },
      ],
    }));
  });

  await page.route(/^https?:\/\/localhost:(?:5174|7034)\/api\//, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const fulfill = (data: unknown) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, message: '', data }),
    });

    if (path === '/api/profile') {
      await fulfill({ permissions: ['viaticos.autorizar', 'viaticos.ver_todos'], detalle: {} });
      return;
    }
    if (path === '/api/viaticos/solicitudes' && request.method() === 'GET') {
      await fulfill([bandejaItem]);
      return;
    }
    if (path === '/api/viaticos/solicitudes/5' && request.method() === 'GET') {
      await fulfill(detalle);
      return;
    }
    if (path === '/api/viaticos/costos-ruta/calcular' && request.method() === 'POST') {
      calculationCalls += 1;
      if (visualScenario === 'roundtrip') {
        await fulfill(motorResponse(calculationCalls === 1, calculationCalls === 2));
      } else if (visualScenario === 'zero-plaza') {
        const response = motorResponse(true);
        response.resultados[0].casetas = [];
        response.resultados[0].casetasDisponibilidad[0].peajeTotal = 0;
        await fulfill(response);
      } else {
        const response = motorResponse(false);
        response.resultados[0].casetasDisponibilidad[0].estado = visualScenario;
        await fulfill(response);
      }
      return;
    }
    await fulfill([]);
  });

  const dialog = await openCalculosModal(page);
  const detailRegion = dialog.getByRole('region', { name: 'Detalle de casetas SCT' });
  await expect(detailRegion).toBeVisible();
  await expect(detailRegion).toContainText('Ojo de Agua');
  await expect(detailRegion).toContainText('Referencia: 97.350 km · 01:15');
  await expect(detailRegion).toContainText('No se suma al precio seleccionado.');
  await expect(detailRegion).toContainText('combustible $780 + casetas estimadas $120 = $900');
  await expect(dialog.getByRole('region', { name: 'Resumen calculado del viaje' }))
    .toContainText('Duración ajustada: 2h 12m · Incluye 10% de margen.');
  await captureResponsiveModal(page, dialog, 'viaticos-calculos-disponible', true);

  await page.setViewportSize({ width: 1366, height: 768 });
  await expectStableDialogBounds(dialog);
  await dialog.getByRole('button', { name: 'Siguiente' }).click();
  await expect(detailRegion).toContainText('No fue posible consultar la SCT. Intenta nuevamente.');
  await expect(detailRegion).toContainText('No hay un total oficial de ida y vuelta');
  await expect(page.getByText(/Total oficial SCT de ida y vuelta:/)).toHaveCount(0);
  await expect(dialog.getByRole('region', { name: 'Resumen calculado del viaje' }))
    .toContainText('Llegada estimada al origen');
  await captureResponsiveModal(page, dialog, 'viaticos-calculos-incompleto');
  expect(calculationCalls).toBe(2);

  const scenarios = [
    {
      id: 'zero-plaza',
      message: 'La SCT no reporta plazas de cobro para este tramo.',
      screenshot: 'viaticos-calculos-cero-plazas',
    },
    {
      id: 'destino_no_soportado',
      message: 'La SCT no tiene este origen o destino en su catálogo; no hay desglose oficial disponible.',
      screenshot: 'viaticos-calculos-destino-no-soportado',
    },
    {
      id: 'respuesta_invalida',
      message: 'No fue posible interpretar el desglose oficial de casetas.',
      screenshot: 'viaticos-calculos-respuesta-invalida',
    },
  ] as const;

  for (const item of scenarios) {
    calculationCalls = 0;
    visualScenario = item.id;
    const scenarioDialog = await openCalculosModal(page);
    const scenarioDetail = scenarioDialog.getByRole('region', { name: 'Detalle de casetas SCT' });
    await expect(scenarioDetail).toBeVisible();
    await expect(scenarioDetail).toContainText(item.message);
    await expect(scenarioDetail.getByRole('table')).toHaveCount(0);
    if (item.id === 'zero-plaza') {
      await expect(scenarioDetail).toContainText('Fuente oficial: SCT · Rutas Punto a Punto');
    } else {
      await expect(scenarioDetail).not.toContainText('$0');
    }
    await captureResponsiveModal(page, scenarioDialog, item.screenshot);
    expect(calculationCalls).toBe(1);
  }
});
