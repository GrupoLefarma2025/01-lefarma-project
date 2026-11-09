import { describe, expect, it } from 'vitest';
import { render, within } from '@testing-library/react';
import {
  ConcentradoDocumentoPreview,
  type FormatoConcentrado,
} from './ConcentradoDocumentoPreview';
import type { SolicitudConcentrado } from '../costos/ConcentradoViaticosPrint';
import type { SolicitudVuelo } from '../costos/ConcentradoVuelosPrint';

/**
 * Vista previa del FOR-008: el contenedor decide las filas (no hay fetch) y el
 * documento solo debe imprimir autorizadas salvo que se pida lo contrario.
 */
const seleccion: SolicitudConcentrado[] = [
  {
    id_solicitud: 1,
    nombre_solicitante: 'ANA AUTORIZADA',
    gerencia: 'IMSS',
    estado: 'autorizada',
    fecha: '05/10/2026 AL 09/10/2026',
    origen: 'CDMX',
    destino: 'PUEBLA',
    autobus: 100,
    avion: null,
    gasolina: null,
    casetas: null,
    hospedaje: null,
    comida: null,
    taxi: null,
    total: 100,
  },
  {
    id_solicitud: 2,
    nombre_solicitante: 'LUIS AJUSTES',
    gerencia: 'IMSS Bienestar',
    estado: 'autorizada_con_ajustes',
    fecha: '12/10/2026 AL 15/10/2026',
    origen: 'CDMX',
    destino: 'MONTERREY',
    autobus: null,
    avion: 200,
    gasolina: null,
    casetas: null,
    hospedaje: null,
    comida: null,
    taxi: null,
    total: 200,
  },
  {
    id_solicitud: 3,
    nombre_solicitante: 'EVA ENVIADA',
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

const vuelos: SolicitudVuelo[] = [
  {
    id_solicitud: 1,
    nombre: 'ANA AUTORIZADA',
    puesto: 'Coordinadora',
    fecha_solicitud: '2026-09-23',
    fecha_nacimiento: '1990-05-17',
    motivo: 'Taller de marca',
    trayectos: [
      { fecha: '2026-10-05', hora: '18:30', origen: 'CDMX', destino: 'CANCÚN' },
      { fecha: '2026-10-09', hora: '13:00', origen: 'CANCÚN', destino: 'CDMX' },
    ],
  },
];

function renderPreview(
  props: {
    soloAutorizadas?: boolean;
    solicitudes?: SolicitudConcentrado[];
    formato?: FormatoConcentrado;
    vuelos?: SolicitudVuelo[];
  } = {},
) {
  return render(
    <ConcentradoDocumentoPreview
      abierto
      solicitudes={props.solicitudes ?? seleccion}
      vuelos={props.vuelos ?? vuelos}
      formato={props.formato}
      titulo="Octubre 2026"
      onCerrar={() => {}}
      soloAutorizadas={props.soloAutorizadas}
    />,
  );
}

function documento(): HTMLElement {
  const doc = document.querySelector('#concentrado-viaticos-print');
  expect(doc).not.toBeNull();
  return doc as HTMLElement;
}

function tablaDatos(container: HTMLElement): HTMLElement {
  return container.querySelector(
    '[aria-label="Concentrado de viáticos autorizados"]',
  ) as HTMLElement;
}

describe('ConcentradoDocumentoPreview FOR-008', () => {
  it('por defecto solo imprime las filas autorizadas de la selección', () => {
    renderPreview();
    const doc = documento();
    const filas = within(tablaDatos(doc).querySelector('tbody')! as HTMLElement)
      .getAllByRole('row');
    expect(filas).toHaveLength(2);
    expect(doc).toHaveTextContent('ANA AUTORIZADA');
    expect(doc).toHaveTextContent('LUIS AJUSTES');
    expect(doc).not.toHaveTextContent('EVA ENVIADA');

    const totales = within(tablaDatos(doc).querySelector('tfoot tr')! as HTMLElement)
      .getAllByRole('cell');
    expect(totales[8]).toHaveTextContent('$300.00'); // 100 + 200, sin la enviada
  });

  it('con soloAutorizadas=false imprime exactamente las filas dadas (vista previa de selección)', () => {
    renderPreview({ soloAutorizadas: false });
    const doc = documento();
    const filas = within(tablaDatos(doc).querySelector('tbody')! as HTMLElement)
      .getAllByRole('row');
    expect(filas).toHaveLength(3);
    expect(doc).toHaveTextContent('EVA ENVIADA');
    expect(within(filas[2]).getAllByRole('cell')[1]).toHaveTextContent('EVA ENVIADA');

    const totales = within(tablaDatos(doc).querySelector('tfoot tr')! as HTMLElement)
      .getAllByRole('cell');
    expect(totales[8]).toHaveTextContent('$1,200.00'); // 100 + 200 + 900
  });

  it('si la selección no tiene autorizadas no arma el formato ni permite imprimir', () => {
    renderPreview({ solicitudes: [seleccion[2]] });
    const doc = documento();
    expect(doc).toHaveTextContent('No hay solicitudes con los filtros actuales');
    expect(doc.querySelector('[aria-label="Concentrado de viáticos autorizados"]')).toBeNull();
    expect(within(doc).queryByText('Concentrado de Viáticos')).toBeNull();
    expect(
      within(document.body).getByRole('button', { name: /imprimir/i }),
    ).toBeDisabled();
  });

  it('en formato vuelos arma la solicitud de avión y no el FOR-008', () => {
    renderPreview({ formato: 'vuelos' });

    const doc = document.querySelector('#concentrado-vuelos-print') as HTMLElement;
    expect(doc).not.toBeNull();
    expect(doc).toHaveTextContent('Solicitud de avión');
    expect(doc).toHaveTextContent('ANA AUTORIZADA');
    expect(doc).toHaveTextContent('Coordinadora');
    expect(doc).toHaveTextContent('17/05/1990');
    expect(doc).toHaveTextContent('CANCÚN');
    expect(doc).toHaveTextContent('Taller de marca');
    // El portal del FOR-008 ni siquiera se monta en este formato.
    expect(document.querySelector('#concentrado-viaticos-print')).toBeNull();
    expect(
      within(document.body).getByRole('button', { name: /imprimir/i }),
    ).not.toBeDisabled();
  });
});
