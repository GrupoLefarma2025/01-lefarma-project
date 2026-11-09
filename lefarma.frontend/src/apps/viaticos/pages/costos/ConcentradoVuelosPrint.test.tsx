import { describe, expect, it } from 'vitest';
import { render, within } from '@testing-library/react';
import {
  ConcentradoVuelosPrint,
  type SolicitudVuelo,
} from './ConcentradoVuelosPrint';

/**
 * Formato «Solicitud de avión» (concentrado de vuelos). Las filas llegan ya
 * resueltas por la bandeja; aquí solo se comprueba el documento: un bloque por
 * persona, itinerario ida/vuelta, «—» en lo que no se conoce y las firmas.
 */
function solicitud(cambios: Partial<SolicitudVuelo> = {}): SolicitudVuelo {
  return {
    id_solicitud: 21,
    nombre: 'BRANDON RAFAEL LEDEZMA MUÑOZ',
    puesto: 'Coordinador de Educación Médica',
    fecha_solicitud: '2026-09-23',
    fecha_nacimiento: '1990-05-17',
    motivo: 'Impartición de talleres médicos',
    trayectos: [
      { fecha: '2026-10-30', hora: '08:00', origen: 'Atizapán de Zaragoza', destino: 'La Aldea' },
      { fecha: '2026-10-30', hora: '18:30', origen: 'La Aldea', destino: 'Atizapán de Zaragoza' },
    ],
    ...cambios,
  };
}

function bloques(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll('.concentrado-vuelo-bloque'));
}

function celdasItinerario(bloque: HTMLElement): HTMLElement[] {
  const tbody = bloque.querySelector(
    '[aria-label="Itinerario de ida y vuelta"] tbody',
  ) as HTMLElement;
  return within(tbody).getAllByRole('cell');
}

describe('ConcentradoVuelosPrint «Solicitud de avión»', () => {
  it('imprime un bloque por persona con sus datos y el itinerario ida/vuelta', () => {
    const { container } = render(
      <ConcentradoVuelosPrint
        solicitudes={[solicitud(), solicitud({ id_solicitud: 22, nombre: 'ANA SEGUNDA' })]}
        gerencia="EDUCACIÓN MÉDICA"
        fecha="2026-09-01"
      />,
    );

    expect(bloques(container)).toHaveLength(2);
    const primerBloque = bloques(container)[0];
    expect(primerBloque).toHaveTextContent('Solicitud de avión');
    expect(primerBloque).toHaveTextContent('BRANDON RAFAEL LEDEZMA MUÑOZ');
    expect(primerBloque).toHaveTextContent('Coordinador de Educación Médica');
    expect(primerBloque).toHaveTextContent('23/09/2026');
    expect(primerBloque).toHaveTextContent('17/05/1990');

    const celdas = celdasItinerario(primerBloque);
    expect(celdas).toHaveLength(10);
    // Ida: fecha, hora, origen, destino y motivo del viaje.
    expect(celdas[0]).toHaveTextContent('30/10/2026');
    expect(celdas[1]).toHaveTextContent('08:00');
    expect(celdas[2]).toHaveTextContent('Atizapán de Zaragoza');
    expect(celdas[3]).toHaveTextContent('La Aldea');
    expect(celdas[4]).toHaveTextContent('Impartición de talleres médicos');
    // Vuelta: el motivo es uno solo; la vuelta no inventa uno propio.
    expect(celdas[5]).toHaveTextContent('30/10/2026');
    expect(celdas[6]).toHaveTextContent('18:30');
    expect(celdas[7]).toHaveTextContent('La Aldea');
    expect(celdas[8]).toHaveTextContent('Atizapán de Zaragoza');
    expect(celdas[9]).toHaveTextContent('—');
  });

  it('imprime «—» cuando falta el dato, nunca un valor inventado', () => {
    const { container } = render(
      <ConcentradoVuelosPrint
        solicitudes={[
          solicitud({
            puesto: null,
            fecha_nacimiento: null,
            motivo: null,
            trayectos: [],
          }),
        ]}
        fecha="2026-09-01"
      />,
    );

    const celdas = celdasItinerario(bloques(container)[0]);
    expect(celdas.every((celda) => celda.textContent === '—')).toBe(true);
    expect(bloques(container)[0]).toHaveTextContent('Puesto:—');
    expect(bloques(container)[0]).toHaveTextContent('Fecha de nacimiento:—');
  });

  it('cierra con el bloque de firmas y el pie del formato', () => {
    const { container } = render(
      <ConcentradoVuelosPrint solicitudes={[solicitud()]} fecha="2026-09-01" />,
    );

    expect(container.querySelector('.concentrado-firmas')).not.toBeNull();
    expect(container).toHaveTextContent('REVISÓ');
    expect(container).toHaveTextContent('AUTORIZÓ');
    expect(container).toHaveTextContent('Erick Israel Aguilera Diaz');
    expect(container).toHaveTextContent('Versió:01');
    expect(container).toHaveTextContent('Prohibida su reproducción no autorizada');
  });

  it('sin filas no inventa bloques', () => {
    const { container } = render(<ConcentradoVuelosPrint solicitudes={[]} />);
    expect(bloques(container)).toHaveLength(0);
    expect(container).toHaveTextContent('Sin solicitudes seleccionadas');
  });
});
