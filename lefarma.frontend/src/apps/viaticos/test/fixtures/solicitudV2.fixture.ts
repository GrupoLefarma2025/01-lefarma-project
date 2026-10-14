import type { DestinoV2, OrigenV2, PasoPersonaV2 } from '../../types/wizardV2.types';

/**
 * Fixtures SANITIZADOS y deterministas para revisión visual del asistente.
 *
 * - Nombres ficticios; ningún dato real de empleados ni cuadernos privados.
 * - Solo MXN; coordenadas fijas dentro de México.
 * - Solo existen cuando `VIATICOS_FIXTURES_ACTIVOS` es verdadero (desarrollo
 *   explícito con `VITE_VIATICOS_FIXTURES=1`). El formulario productivo nunca
 *   los ve y nunca envían nada por sí solos.
 */
export const VIATICOS_FIXTURES_ACTIVOS =
  import.meta.env.DEV === true && import.meta.env.VITE_VIATICOS_FIXTURES === '1';

export const DATOS_PRUEBA_SOLICITUD = {
  moneda: 'MXN' as const,
  puntos: [
    { nombre: 'Domicilio de ejemplo', latitud: 19.4326, longitud: -99.1332 },
    { nombre: 'Destino de ejemplo norte', latitud: 20.6597, longitud: -103.3496 },
  ],
  persona: { modo: 'mia' as const, motivo: 'Visita de ejemplo para revisión visual' },
  origen: { fechaSalida: '2026-11-10', horaSalida: '06:00' },
  destino: {
    debeEstarFecha: '2026-11-10',
    debeEstarHora: '12:00',
    saleFecha: '2026-11-10',
    saleHora: '18:00',
  },
};

export function rellenarConFixture(): {
  persona: PasoPersonaV2;
  origen: OrigenV2;
  destinos: DestinoV2[];
} {
  const [origenPunto, destinoPunto] = DATOS_PRUEBA_SOLICITUD.puntos;
  return {
    persona: {
      modo: DATOS_PRUEBA_SOLICITUD.persona.modo,
      empleadoId: null,
      nombre: '',
      motivo: DATOS_PRUEBA_SOLICITUD.persona.motivo,
    },
    origen: {
      tipo: 'mapa',
      sucursalId: null,
      punto: { ...origenPunto },
      fechaSalida: DATOS_PRUEBA_SOLICITUD.origen.fechaSalida,
      horaSalida: DATOS_PRUEBA_SOLICITUD.origen.horaSalida,
    },
    destinos: [
      {
        id: 'dest-fixture-1',
        punto: { ...destinoPunto },
        debeEstarFecha: DATOS_PRUEBA_SOLICITUD.destino.debeEstarFecha,
        debeEstarHora: DATOS_PRUEBA_SOLICITUD.destino.debeEstarHora,
        saleFecha: DATOS_PRUEBA_SOLICITUD.destino.saleFecha,
        saleHora: DATOS_PRUEBA_SOLICITUD.destino.saleHora,
        hospedaje: { necesario: false, zona: 'actual', fechaEntrada: '', fechaSalida: '', hotel: null },
        cotizacion: null,
      },
    ],
  };
}
