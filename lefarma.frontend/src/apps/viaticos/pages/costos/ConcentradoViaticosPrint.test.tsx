import { describe, expect, it } from 'vitest';
import { render, within } from '@testing-library/react';
import {
  VIAJES_OCTUBRE_2026,
  TOTALES_OCTUBRE_2026,
  type ViajeOctubre2026,
} from '../../test/fixtures/octubre2026';
import {
  ConcentradoViaticosPrint,
  type SolicitudConcentrado,
} from './ConcentradoViaticosPrint';

function fila(viaje: ViajeOctubre2026): SolicitudConcentrado {
  return {
    id_solicitud: viaje.no,
    nombre_solicitante: viaje.solicitante,
    estado: 'autorizada',
    fecha: viaje.fecha,
    origen: viaje.origen,
    destino: viaje.destino,
    autobus: viaje.autobus,
    avion: viaje.avion,
    gasolina: null,
    casetas: null,
    hospedaje: viaje.hospedaje,
    comida: viaje.comida,
    taxi: viaje.taxi,
    total: viaje.total,
  };
}

const Solicitudes = VIAJES_OCTUBRE_2026.map(fila);

function renderConcentrado(solicitudes: SolicitudConcentrado[] = Solicitudes) {
  return render(
    <ConcentradoViaticosPrint
      solicitudes={solicitudes}
      nombreResponsable="EDUCACION MEDICA"
      fecha="2026-09-01"
    />,
  );
}

function tablaDatos(container: HTMLElement): HTMLElement {
  return container.querySelector(
    '[aria-label="Concentrado de viáticos autorizados"]',
  ) as HTMLElement;
}

const dinero = (n: number) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

describe('ConcentradoViaticosPrint FOR-008 sobre datos persistidos', () => {
  it('renderiza una fila por solicitud autorizada y la fila de totales', () => {
    const { container } = renderConcentrado();
    const cuerpo = tablaDatos(container).querySelector('tbody')!;
    const filas = within(cuerpo as HTMLElement).getAllByRole('row');
    expect(filas).toHaveLength(20);
    expect(tablaDatos(container).querySelector('tfoot tr')).toBeTruthy();
  });

  it('conserva el orden en que llegan las solicitudes', () => {
    const { container } = renderConcentrado();
    const primera = within(tablaDatos(container).querySelector('tbody tr')! as HTMLElement)
      .getAllByRole('cell');
    expect(primera[0]).toHaveTextContent('1');
    expect(primera[1]).toHaveTextContent('CESAR MARTIN GARCIA ALONSO');
    const ultima = within(
      tablaDatos(container).querySelector('tbody tr:last-child')! as HTMLElement,
    ).getAllByRole('cell');
    expect(ultima[0]).toHaveTextContent('20');
    expect(ultima[1]).toHaveTextContent('CESAR MARTIN GARCIA ALONSO');
  });

  it('imprime los totales del Excel real: 20 viajes por $276,357.00', () => {
    const { container } = renderConcentrado();
    const totales = within(
      tablaDatos(container).querySelector('tfoot tr')! as HTMLElement,
    ).getAllByRole('cell');
    expect(totales[0]).toHaveTextContent('Total');
    expect(totales[1]).toHaveTextContent(dinero(TOTALES_OCTUBRE_2026.autobus));
    expect(totales[2]).toHaveTextContent(dinero(TOTALES_OCTUBRE_2026.avion));
    expect(totales[5]).toHaveTextContent(dinero(TOTALES_OCTUBRE_2026.hospedaje));
    expect(totales[6]).toHaveTextContent(dinero(TOTALES_OCTUBRE_2026.comida));
    expect(totales[7]).toHaveTextContent(dinero(TOTALES_OCTUBRE_2026.taxi));
    expect(totales[8]).toHaveTextContent(dinero(TOTALES_OCTUBRE_2026.total));

    expect(totales.map(c => c.textContent)).toEqual([
      'Total',
      '$16,481.00',
      '$137,630.00',
      '—', 
      '—', 
      '$52,896.00',
      '$25,100.00',
      '$44,250.00',
      '$276,357.00',
    ]);
  });

  it('cada fila imprime el importe del viaje y una celda vacia no se vuelve cero', () => {
    const { container } = renderConcentrado();
    const filas = within(tablaDatos(container).querySelector('tbody')! as HTMLElement).getAllByRole('row');
    const viaje1 = within(filas[0]).getAllByRole('cell');
    expect(viaje1).toHaveLength(13);
    expect(viaje1[5]).toHaveTextContent('$600.00'); 
    expect(viaje1[6]).toHaveTextContent('—'); 
    expect(viaje1[9]).toHaveTextContent('—'); 
    expect(viaje1[11]).toHaveTextContent('$1,060.00'); 
    expect(viaje1[12]).toHaveTextContent('$2,110.00'); 
    expect(container).not.toHaveTextContent('$0.00');
  });

  it('encabezado, cuerpo y pie declaran exactamente las mismas columnas hoja', () => {
    const { container } = renderConcentrado();
    const tabla = tablaDatos(container);

    const primeraFilaEncabezado = tabla.querySelectorAll('thead tr')[0];
    const columnasEncabezado = Array.from(primeraFilaEncabezado.querySelectorAll('th')).reduce(
      (total, th) => total + (Number(th.getAttribute('colspan')) || 1),
      0,
    );

    const primeraFilaCuerpo = within(tabla.querySelector('tbody')! as HTMLElement).getAllByRole('row')[0];
    const columnasCuerpo = within(primeraFilaCuerpo).getAllByRole('cell').length;

    const celdasPie = within(tabla.querySelector('tfoot tr')! as HTMLElement).getAllByRole('cell');
    const columnasPie = celdasPie.reduce(
      (total, td) => total + (Number(td.getAttribute('colspan')) || 1),
      0,
    );

    expect(columnasEncabezado).toBe(13);
    expect(columnasCuerpo).toBe(columnasEncabezado);
    expect(columnasPie).toBe(columnasEncabezado);
  });

  it('imprime el desglose que manda el servidor; null queda "—" y nunca "$0.00"', () => {
    const { container } = renderConcentrado([
      {
        id_solicitud: 99,
        nombre_solicitante: 'SERVICIO REAL',
        estado: 'autorizada',
        fecha: '05/10/2026 AL 09/10/2026',
        origen: 'CDMX',
        destino: 'CANCÚN',
        autobus: 100,
        avion: null,
        gasolina: 300,
        casetas: 400,
        hospedaje: 500,
        comida: 600,
        taxi: 700,
        total: 2600,
      },
    ]);
    const fila = within(
      tablaDatos(container).querySelector('tbody tr')! as HTMLElement,
    ).getAllByRole('cell');
    expect(fila.map(c => c.textContent)).toEqual([
      '1',
      'SERVICIO REAL',
      '05/10/2026 AL 09/10/2026',
      'CDMX',
      'CANCÚN',
      '$100.00',
      '—', 
      '$300.00',
      '$400.00',
      '$500.00',
      '$600.00',
      '$700.00',
      '$2,600.00',
    ]);
    expect(container).not.toHaveTextContent('$0.00');
  });

  it('solo imprime solicitudes autorizadas, en cualquier orden de estados', () => {
    const { container } = renderConcentrado([
      { ...Solicitudes[0], estado: 'enviada' },
      { ...Solicitudes[1], estado: 'autorizada_con_ajustes' },
      { ...Solicitudes[2], estado: 'autorizada' },
    ]);
    const filas = within(tablaDatos(container).querySelector('tbody')! as HTMLElement).getAllByRole('row');
    expect(filas).toHaveLength(2);
    expect(container).toHaveTextContent('JUAN PABLO PEÑA PORTILLO');
    expect(container).toHaveTextContent('SANTIAGO GARCIA GUTIERREZ');
  });

  it('imprime el formato FOR-008: encabezado de dos filas, firmas y pie', () => {
    const { container } = renderConcentrado();
    expect(container).toHaveTextContent('Nombre: EDUCACION MEDICA');
    expect(container).toHaveTextContent('Gerencia: EDUCACION MEDICA');
    expect(container).toHaveTextContent('Fecha: 2026-09-01');

    const encabezado = tablaDatos(container).querySelectorAll('thead tr');
    expect(encabezado).toHaveLength(2);
    const titulos = Array.from(encabezado[0].querySelectorAll('th')).map(th => th.textContent);
    expect(titulos).toEqual([
      'No.',
      'Solicitante',
      'Fecha',
      'Origen',
      'Destino',
      'Transporte',
      'Automóvil propio',
      'Hospedaje',
      'Comida',
      'Taxi',
      'Total',
    ]);
    expect(Array.from(encabezado[1].querySelectorAll('th')).map(th => th.textContent)).toEqual([
      'Costo boleto Autobús',
      'Costo boleto Avión',
      'Gasolina',
      'Casetas',
    ]);

    const firmas = within(container.querySelector('[aria-label="Firmas pendientes"]')! as HTMLElement)
      .getAllByRole('row')
      .slice(1)
      .map(row => within(row).getAllByRole('cell')[0].textContent);
    expect(firmas).toEqual(['REVISÓ', 'REVISÓ', 'REVISÓ', 'AUTORIZÓ']);
    expect(container).toHaveTextContent('ASK-ADM-FOR-008');
    expect(container).toHaveTextContent('Prohibida su reproducción no autorizada');
  });

  it('declara sus propias reglas de impresion A4 y no depende del wizard', () => {
    const { container } = renderConcentrado();
    const css = container.querySelector('style')!.textContent!;
    expect(css).toContain('@page concentrado-viaticos { size: A4 landscape; margin: 10mm; }');
    expect(css).toContain('thead { display: table-header-group; }');
    expect(css).toContain('break-inside: avoid');
    expect(container.querySelector('button')).toBeNull();
    expect(container.querySelector('nav')).toBeNull();
  });

  it('vuelve a imprimir lo mismo tras un "recarga": el render depende solo de las props', () => {
    const primera = renderConcentrado();
    const segunda = renderConcentrado();
    expect(segunda.container.querySelector('article')!.textContent).toBe(
      primera.container.querySelector('article')!.textContent,
    );
    expect(segunda.container).toHaveTextContent('$276,357.00');
    const invertido = renderConcentrado([...Solicitudes].reverse());
    const filas = within(tablaDatos(invertido.container).querySelector('tbody')! as HTMLElement)
      .getAllByRole('row');
    expect(within(filas[0]).getAllByRole('cell')[0]).toHaveTextContent('1');
    expect(Solicitudes.map(s => s.id_solicitud)).toEqual(
      VIAJES_OCTUBRE_2026.map(v => v.no),
    );
  });

  const seleccionMixta: SolicitudConcentrado[] = [
    {
      id_solicitud: 101,
      nombre_solicitante: 'AUTORIZADA UNO',
      gerencia: 'IMSS',
      estado: 'autorizada',
      fecha: '05/10/2026 AL 09/10/2026',
      origen: 'CDMX',
      destino: 'PUEBLA',
      autobus: 100,
      avion: null,
      gasolina: null,
      casetas: null,
      hospedaje: 50,
      comida: 25,
      taxi: 10,
      total: 185,
    },
    {
      id_solicitud: 102,
      nombre_solicitante: 'AUTORIZADA DOS',
      gerencia: 'IMSS Bienestar',
      estado: 'autorizada_con_ajustes',
      fecha: '12/10/2026 AL 15/10/2026',
      origen: 'CDMX',
      destino: 'MONTERREY',
      autobus: null,
      avion: 200,
      gasolina: 30,
      casetas: 40,
      hospedaje: null,
      comida: 50,
      taxi: 20,
      total: 340,
    },
    {
      id_solicitud: 103,
      nombre_solicitante: 'ENVIADA TRES',
      gerencia: 'IMSS',
      estado: 'enviada',
      fecha: '20/10/2026 AL 22/10/2026',
      origen: 'CDMX',
      destino: 'QUERÉTARO',
      autobus: null,
      avion: null,
      gasolina: null,
      casetas: null,
      hospedaje: null,
      comida: null,
      taxi: 900,
      total: 900,
    },
  ];

  it('con soloAutorizadas=true imprime solo las autorizadas de la selección y sus totales', () => {
    const { container } = renderConcentrado(seleccionMixta);
    const filas = within(tablaDatos(container).querySelector('tbody')! as HTMLElement)
      .getAllByRole('row');
    expect(filas).toHaveLength(2);
    expect(container).toHaveTextContent('AUTORIZADA UNO');
    expect(container).toHaveTextContent('AUTORIZADA DOS');
    expect(container).not.toHaveTextContent('ENVIADA TRES');

    const totales = within(
      tablaDatos(container).querySelector('tfoot tr')! as HTMLElement,
    ).getAllByRole('cell');
    expect(totales[1]).toHaveTextContent('$100.00'); 
    expect(totales[2]).toHaveTextContent('$200.00'); 
    expect(totales[7]).toHaveTextContent('$30.00'); 
    expect(totales[8]).toHaveTextContent('$525.00'); 
    expect(totales[8]).not.toHaveTextContent('1,425');
  });

  it('con soloAutorizadas=false imprime exactamente las filas recibidas, sin inventar importes', () => {
    const { container } = render(
      <ConcentradoViaticosPrint
        solicitudes={seleccionMixta}
        nombreResponsable="EDUCACION MEDICA"
        fecha="2026-09-01"
        soloAutorizadas={false}
      />,
    );
    const cuerpo = tablaDatos(container).querySelector('tbody')! as HTMLElement;
    const filas = within(cuerpo).getAllByRole('row');
    expect(filas).toHaveLength(3);
    expect(within(filas[2]).getAllByRole('cell')[1]).toHaveTextContent('ENVIADA TRES');
    expect(within(filas[2]).getAllByRole('cell')[6]).toHaveTextContent('—');
    expect(container).not.toHaveTextContent('$0.00');

    const totales = within(
      tablaDatos(container).querySelector('tfoot tr')! as HTMLElement,
    ).getAllByRole('cell');
    expect(totales[7]).toHaveTextContent('$930.00'); 
    expect(totales[8]).toHaveTextContent('$1,425.00'); 
  });

  it('la agrupación y los subtotales solo cuentan las filas impresas', () => {
    const { container } = render(
      <ConcentradoViaticosPrint
        solicitudes={seleccionMixta}
        nombreResponsable="EDUCACION MEDICA"
        fecha="2026-09-01"
        grupoPor="gerencia"
      />,
    );
    const cuerpo = tablaDatos(container).querySelector('tbody')! as HTMLElement;
    expect(cuerpo).toHaveTextContent(/Gerencia: IMSS · 1 solicitud/i);
    expect(cuerpo).toHaveTextContent(/Gerencia: IMSS Bienestar · 1 solicitud/i);
    const subtotales = cuerpo.querySelectorAll('.concentrado-subtotal-grupo');
    expect(subtotales).toHaveLength(2);
    expect(subtotales[0]).toHaveTextContent('$185.00');
    expect(subtotales[1]).toHaveTextContent('$340.00');

    const totales = within(
      tablaDatos(container).querySelector('tfoot tr')! as HTMLElement,
    ).getAllByRole('cell');
    expect(totales[8]).toHaveTextContent('$525.00');
  });

  it('agrupa por gerencia con banda y subtotal por bloque', () => {
    const { container } = render(
      <ConcentradoViaticosPrint
        solicitudes={[
          { ...Solicitudes[0], id_solicitud: 1, gerencia: 'IMSS', nombre_solicitante: 'Uno' },
          { ...Solicitudes[1], id_solicitud: 2, gerencia: 'IMSS', nombre_solicitante: 'Dos' },
          { ...Solicitudes[2], id_solicitud: 3, gerencia: 'IMSS Bienestar', nombre_solicitante: 'Tres' },
        ]}
        nombreResponsable="EDUCACION MEDICA"
        fecha="2026-09-01"
        grupoPor="gerencia"
      />,
    );
    const cuerpo = tablaDatos(container).querySelector('tbody')! as HTMLElement;
    expect(cuerpo).toHaveTextContent(/Gerencia: IMSS · 2 solicitudes/i);
    expect(cuerpo).toHaveTextContent(/Gerencia: IMSS Bienestar · 1 solicitud/i);

    const subtotales = cuerpo.querySelectorAll('.concentrado-subtotal-grupo');
    expect(subtotales).toHaveLength(2);
    const totalImss = (Solicitudes[0].total ?? 0) + (Solicitudes[1].total ?? 0);
    expect(subtotales[0]).toHaveTextContent(dinero(totalImss));
    expect(subtotales[1]).toHaveTextContent(dinero(Solicitudes[2].total ?? 0));

    const numeros = within(cuerpo)
      .getAllByRole('row')
      .filter((fila) => fila.classList.contains('concentrado-grupo') === false)
      .filter((fila) => fila.classList.contains('concentrado-subtotal-grupo') === false)
      .map((fila) => within(fila).getAllByRole('cell')[0].textContent);
    expect(numeros).toEqual(['1', '2', '3']);
  });
});