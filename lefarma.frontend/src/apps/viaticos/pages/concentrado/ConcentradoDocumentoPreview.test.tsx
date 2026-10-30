import { describe, expect, it } from 'vitest';
import { render, within } from '@testing-library/react';
import { ConcentradoDocumentoPreview } from './ConcentradoDocumentoPreview';
import type { SolicitudConcentrado } from '../costos/ConcentradoViaticosPrint';

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

function renderPreview(props: { soloAutorizadas?: boolean; solicitudes?: SolicitudConcentrado[] } = {}) {
  return render(
    <ConcentradoDocumentoPreview
      abierto
      solicitudes={props.solicitudes ?? seleccion}
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
});
