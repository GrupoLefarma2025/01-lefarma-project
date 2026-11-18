import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { ConcentradoViaticosPDF } from './ConcentradoViaticosPDF';
import type { MacroViatico } from '@/types/macroViatico.types';

function fila(overrides: Partial<MacroViatico> = {}): MacroViatico {
  return {
    folio: 'VIA-0001',
    nombre: 'DANIEL PADILLA',
    gerencia: 'EDUCACION MEDICA',
    fecha: '2026-06-01',
    renglon: 1,
    solicitante: 'JUAN PABLO PEÑA PORTILLO',
    fechInicio: '2026-06-03',
    fechaFin: '2026-06-04',
    origen: 'CDMX',
    destino: 'TEPIC PUERTO VALLARTA',
    costoAutobus: 650,
    costoAvion: 11541,
    costoGasolina: null,
    costoCasetas: null,
    costoHospedaje: 1392,
    costoComida: 900,
    costoTaxi: 2640,
    diasHospedaje: 2,
    numeroComidas: 3,
    ...overrides,
  };
}

const FILAS: MacroViatico[] = [
  fila(),
  fila({
    folio: 'VIA-0002',
    renglon: 2,
    solicitante: 'SANTIAGO GARCIA GUTIERREZ',
    fechInicio: '2026-06-05',
    fechaFin: null,
    origen: 'CDMX',
    destino: 'SALAMANCA',
    costoAutobus: 2000,
    costoAvion: null,
    costoHospedaje: null,
    costoComida: 450,
    costoTaxi: 1300,
  }),
];

function renderConcentrado() {
  return render(
    <ConcentradoViaticosPDF
      filas={FILAS}
      nombre="DANIEL PADILLA"
      gerencia="EDUCACION MEDICA"
      fecha="1 de junio del 2026"
    />,
  );
}

describe('ConcentradoViaticosPDF', () => {
  it('muestra el encabezado con nombre, gerencia y fecha', () => {
    renderConcentrado();

    expect(
      screen.getByRole('heading', { name: 'Concentrado de Viáticos' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Nombre:')).toBeInTheDocument();
    expect(screen.getByText('DANIEL PADILLA')).toBeInTheDocument();
    expect(screen.getByText('Gerencia:')).toBeInTheDocument();
    expect(screen.getByText('EDUCACION MEDICA')).toBeInTheDocument();
    expect(screen.getByText('Fecha:')).toBeInTheDocument();
    expect(
      within(screen.getByLabelText('Encabezado del concentrado')).getByText(
        '1 de junio del 2026',
      ),
    ).toBeInTheDocument();
  });

  it('renderiza una fila por viático con la fecha y el total', () => {
    renderConcentrado();
    const tabla = screen.getByLabelText('Tabla del concentrado de viáticos');
    const cuerpo = tabla.querySelector('tbody') as HTMLElement;
    const filas = within(cuerpo).getAllByRole('row');

    expect(filas).toHaveLength(2);

    const primera = within(filas[0]).getAllByRole('cell');
    expect(primera[0]).toHaveTextContent('1');
    expect(primera[1]).toHaveTextContent('JUAN PABLO PEÑA PORTILLO');
    expect(primera[2]).toHaveTextContent('3 de junio del 2026');
    expect(primera[12]).toHaveTextContent('$17,123.00');

    const segunda = within(filas[1]).getAllByRole('cell');
    expect(segunda[0]).toHaveTextContent('2');
    expect(segunda[2]).toHaveTextContent('5 de junio del 2026');
    expect(segunda[12]).toHaveTextContent('$3,750.00');
  });

  it('usa el renglón como número de fila', () => {
    render(
      <ConcentradoViaticosPDF
        filas={[fila({ renglon: 7 })]}
        nombre="DANIEL PADILLA"
        gerencia="EDUCACION MEDICA"
        fecha="1 de junio del 2026"
      />,
    );

    const tabla = screen.getByLabelText('Tabla del concentrado de viáticos');
    const cuerpo = tabla.querySelector('tbody') as HTMLElement;
    expect(within(cuerpo).getAllByRole('cell')[0]).toHaveTextContent('7');
  });

  it('suma la fila de totales por concepto', () => {
    renderConcentrado();
    const tabla = screen.getByLabelText('Tabla del concentrado de viáticos');
    const totales = tabla.querySelector('tfoot') as HTMLElement;

    expect(within(totales).getByText('Total')).toBeInTheDocument();
    expect(within(totales).getByText('$2,650.00')).toBeInTheDocument();
    expect(within(totales).getByText('$11,541.00')).toBeInTheDocument();
    expect(within(totales).getByText('$1,392.00')).toBeInTheDocument();
    expect(within(totales).getByText('$1,350.00')).toBeInTheDocument();
    expect(within(totales).getByText('$3,940.00')).toBeInTheDocument();
    expect(within(totales).getByText('$20,873.00')).toBeInTheDocument();
  });

  it('incluye las firmas registradas de Erick, Diego y Luis cuando se reciben las imágenes', () => {
    const firma = 'data:image/png;base64,iVBORw0KGgo=';
    render(
      <ConcentradoViaticosPDF
        filas={FILAS}
        nombre="DANIEL PADILLA"
        gerencia="EDUCACION MEDICA"
        fecha="1 de junio del 2026"
        firmas={{ diego: firma, luis: firma, erick: firma }}
      />,
    );

    expect(
      screen.getByAltText('Firma de Erick Israel Aguilera Diaz'),
    ).toHaveAttribute('src', firma);
    expect(
      screen.getByAltText('Firma de Diego Ángel Villaseñor Garduño'),
    ).toHaveAttribute('src', firma);
    expect(
      screen.getByAltText('Firma de Luis Pozo Urquizo'),
    ).toHaveAttribute('src', firma);
  });

  it('incluye el bloque de firmas y el pie institucional', () => {
    renderConcentrado();

    expect(screen.getAllByText('REVISÓ')).toHaveLength(3);
    expect(screen.getByText('AUTORIZÓ')).toBeInTheDocument();
    expect(screen.getByText('Erick Israel Aguilera Diaz')).toBeInTheDocument();
    expect(screen.getByText('Luis Pozo Urquizo')).toBeInTheDocument();
    expect(screen.getByText('Diego Angel Villaseñor Garduño')).toBeInTheDocument();
    expect(screen.getByText('Lic. Héctor Vélez Rivera')).toBeInTheDocument();
    expect(screen.getByText('#firmad')).toBeInTheDocument();
    expect(screen.getByText('ASK-ADM-FOR-008')).toBeInTheDocument();
    expect(screen.getByText('Versió:01')).toBeInTheDocument();
    expect(
      screen.getByText('Prohibida su reproducción no autorizada'),
    ).toBeInTheDocument();
    expect(screen.getByText('Página 1 de 1')).toBeInTheDocument();
  });
});
