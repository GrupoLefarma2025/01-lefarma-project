import { describe, expect, it } from 'vitest';
import { render, within } from '@testing-library/react';
import type { CostosRutaRequest, CostosRutaResponse } from '../../types/costosRuta.types';
import { CostosSolicitudPrint, CostosViaticosPrint } from './CostosViaticosPrint';
import { selectedCosts, selectedProposal } from './costosViaticosData';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Vitest (css: false) turns `?raw` CSS imports into empty strings, so read the
// stylesheet from disk (vitest runs with the frontend root as cwd) to assert
// the named print pages it declares.
const printCss = readFileSync(
  join(process.cwd(), 'src/apps/viaticos/pages/costos/costosViaticosPrint.css'),
  'utf8',
);

function printResponse(mode = 'bus', fuel = 'magna'): CostosRutaResponse {
  return { categorias: {}, recomendaciones: [], compartidos: [],
    propuestas: [{ persona: 'Ana', clave: 'selected', titulo: 'Selected', cumpleTodos: false,
      salidaOrigen: '05/10 05:00', llegadaFinal: '05/10 09:00', margenMinimoMinutos: -60,
      costoTotalMxn: mode === 'auto' ? (fuel === 'premium' ? 350 : 300) : 100,
      tramos: [{ tramo: 1, de: 'Base', a: 'Hospital', modo: mode, linea: 'Fixture', salida: '05/10 05:00', llegada: '05/10 09:00', costo: mode === 'auto' ? (fuel === 'premium' ? 350 : 300) : 100 }],
      hotelesPropuestos: [], incumplimientos: ['Late'], fuentes: ['fixture'] }],
    resultados: [{ nombre: 'Ana', gasolina: fuel, propuesta: { razones: [], lugares: [] },
      tramos: [], hotelesPropuestos: [], incumplimientos: [], rutaArmada: {
        tramos: [{ de: 'Base', a: 'Hospital', km: 120, litros: 10,
          gasolina: { magna: { precioL: 25, costo: 250, fuente: 'fixture' }, premium: { precioL: 30, costo: 300, fuente: 'fixture' } },
          casetas: { costo: 50, fuente: 'fixture' }, subtotalMagna: 300, subtotalPremium: 350 }],
        totales: { km: 120, litros: 10, casetas: 50, subtotalMagna: 300, subtotalPremium: 350 },
      } }],
  };
}

describe('FOR-008 selected transport', () => {
  it('does not add the car reference quote to a selected bus proposal', () => {
    const { container } = render(<CostosViaticosPrint respuesta={printResponse()} solicitud={null} />);
    const row = container.querySelectorAll('table')[1].querySelector('tbody tr')!;
    const cells = within(row as HTMLElement).getAllByRole('cell');
    expect(cells).toHaveLength(13);
    expect(cells[5]).toHaveTextContent('$100.00');
    expect(cells[7]).toHaveTextContent('—');
    expect(cells[8]).toHaveTextContent('—');
    expect(cells[12]).toHaveTextContent('$100.00');
    expect(container).toHaveTextContent('NO VIABLE');
    expect(container).not.toHaveTextContent('Página 1 de 1');
  });

  it.each([['magna', '$250.00', '$300.00'], ['premium', '$300.00', '$350.00']])('uses only selected car %s fuel and tolls', (fuel, gasoline, total) => {
    const { container } = render(<CostosViaticosPrint respuesta={printResponse('auto', fuel)} solicitud={null} />);
    const cells = within(container.querySelectorAll('table')[1].querySelector('tbody tr')! as HTMLElement).getAllByRole('cell');
    expect(cells[7]).toHaveTextContent(gasoline);
    expect(cells[8]).toHaveTextContent('$50.00');
    expect(cells[12]).toHaveTextContent(total);
  });

  it('keeps unmatched/shared car costs not desglosado rather than inventing a breakdown', () => {
    const response = printResponse('auto');
    response.propuestas[0].tramos[0].costo = 150;
    response.propuestas[0].costoTotalMxn = 150;
    expect(selectedCosts(response, response.propuestas[0])).toEqual({ autobus: null, avion: null, gasolina: null, casetas: null, total: 150 });
  });

  it('selects a viable proposal by default and honors explicit selection', () => {
    const response = printResponse();
    response.propuestas.push({ ...response.propuestas[0], clave: 'viable', cumpleTodos: true });
    expect(selectedProposal(response, 'Ana')?.clave).toBe('viable');
    expect(selectedProposal(response, 'Ana', { Ana: 'selected' })?.clave).toBe('selected');
  });

  it('does not charge a whole route car reference alongside mixed bus and car legs', () => {
    const response = printResponse('auto');
    response.propuestas[0].tramos.push({ ...response.propuestas[0].tramos[0], tramo: 2, modo: 'bus', costo: 100 });
    response.propuestas[0].costoTotalMxn = 400;
    const costs = selectedCosts(response, response.propuestas[0]);
    expect(costs).toMatchObject({ autobus: 100, gasolina: 250, casetas: 50, total: 400 });
  });

  it('prints FOR-007 portrait headings, unknown prices and blank actual signatures', () => {
    const request: CostosRutaRequest = { opciones: { respetarHorarioLaboral: true, calcularHoteles: true, calcularViajesIntermedios: true, compartirViaje: false },
      personas: [{ nombre: 'Ana', carro_propio: false, gasolina: 'magna', draft: false,
        trabajo: { hora_entrada: '08:00', hora_salida: '18:30', primer_dia_laboral: 1, ultimo_dia_laboral: 5 },
        lugares: [{ orden: 1, tipo: 'salida', nombre: 'Base', latitud: 19, longitud: -99 },
          { orden: 2, tipo: 'taller', nombre: 'Hospital', latitud: 20, longitud: -100, fecha_inicio_actividad: '2026-10-05', hora_inicio_actividad: '08:00', hora_fin_actividad: '18:30' }] }] };
    const { container } = render(<CostosSolicitudPrint respuesta={printResponse()} solicitud={request} persona="Ana" />);
    expect(container).toHaveTextContent('Solicitud de Viáticos');
    expect(container).toHaveTextContent('ASK-ADM-FOR-007');
    expect(container).toHaveTextContent('Desglose uso de Taxis');
    expect(container).toHaveTextContent('Número de noches');
    expect(container).toHaveTextContent('NO VIABLE');
    expect(container).toHaveTextContent('Puesto: —');
    expect(container).not.toHaveTextContent('$0.00');
    const signatureRows = within(container.querySelector('[aria-label="Firmas pendientes"]')! as HTMLElement).getAllByRole('row').slice(1);
    expect(signatureRows).toHaveLength(3);
    for (const row of signatureRows) {
      const cells = within(row).getAllByRole('cell');
      expect(cells[3]).toBeEmptyDOMElement();
      expect(cells[4]).toBeEmptyDOMElement();
    }
    expect(container.querySelector('.costos-report-solicitud')).toBeInTheDocument();
    expect(printCss).toContain('@page costos-solicitud { size: A4 portrait');
    expect(printCss).toContain('@page costos-concentrado { size: A4 landscape');
  });
});
