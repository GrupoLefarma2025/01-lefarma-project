import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { CalculosViajeModal } from './CalculosViajeModal';
import type { CostosRutaOferta, CostosRutaResponse } from '../types/costosRuta.types';
import type { PropuestaRuta, Solicitud } from '../types/solicitud.types';

const mocks = vi.hoisted(() => ({
  calcular: vi.fn(),
  autorizar: vi.fn(),
  enviar: vi.fn(),
  guardarOpciones: vi.fn(),
}));

vi.mock('../services/costosRuta.api', () => ({
  costosRutaApi: { calcular: mocks.calcular },
}));
vi.mock('../services/aprobaciones.api', () => ({
  aprobacionesApi: { autorizar: mocks.autorizar },
}));
vi.mock('../services/solicitudes.api', () => ({
  solicitudesApi: { enviar: mocks.enviar, guardarOpciones: mocks.guardarOpciones },
}));
vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  TileLayer: () => null,
  Polyline: () => null,
  CircleMarker: () => null,
  Tooltip: () => null,
}));

const solicitud: Solicitud = {
  id_solicitud: 42,
  id_usuario_solicitante: 7,
  periodo: '2026-11',
  gerencia: 'Operaciones',
  estado: 'enviada',
  activo: true,
  fecha_creacion: '2026-11-05T12:00:00',
  fecha_modificacion: '2026-11-05T12:00:00',
  datos: {
    version: 'solicitud-v2',
    persona: { modo: 'mia', nombre: 'Persona Viajera' },
    transporte: { modo: 'solicitado', compartir: false, acompanantes: [] },
    origen: {
      punto: { nombre: 'Guadalajara', latitud: 20.67, longitud: -103.34, municipio: 'Guadalajara', estado: 'Jalisco' },
      fechaSalida: '2026-11-10',
      horaSalida: '08:00',
    },
    destinos: [
      {
        punto: { nombre: 'Zapopan', latitud: 20.72, longitud: -103.39, municipio: 'Zapopan', estado: 'Jalisco' },
        debeEstarFecha: '2026-11-10',
        debeEstarHora: '14:00',
        saleFecha: '2026-11-10',
        saleHora: '18:00',
      },
    ],
    retorno: { destino: 'origen' },
  },
  opciones: [],
  eventos: [],
};

const compra = (url: string) => ({
  url,
  sitio: 'ClickBus',
  accion: 'Comprar',
  objetivo: 'boleto',
  fecha: '2026-11-10',
});

const oferta = (id: string, linea: string, costoGrupo: number): CostosRutaOferta => ({
  id,
  modo: 'bus',
  linea,
  servicio: 'Primera',
  persona: 'Persona Viajera',
  tramo: 1,
  de: 'Guadalajara',
  a: 'Zapopan',
  salidaTxt: '10/11 09:00',
  llegadaTxt: '10/11 13:30',
  duracion: '4h 30m',
  puertaAPuertaH: 4.5,
  precioTxt: `$${costoGrupo}`,
  porPersona: false,
  costoGrupo,
  costoPorPersona: costoGrupo,
  aTiempo: true,
  llegaTarde: false,
  minutosTarde: 0,
  noTomable: false,
  badge: '',
  nota: '',
  fuente: 'ClickBus',
  estimado: false,
  comprar: compra(`https://comprar.test/${id}`),
});

const respuestaMotor = (): CostosRutaResponse => ({
  resultados: [
    {
      nombre: 'Persona Viajera',
      gasolina: 'magna',
      propuesta: { razones: [], lugares: [] },
      tramos: [
        {
          from: 'Guadalajara',
          to: 'Zapopan',
          km: 120,
          opciones: [oferta('a', 'Futura', 520), oferta('b', 'ETN', 980)],
        },
      ],
      rutaArmada: {
        tramos: [],
        totales: { km: 120, litros: 10, casetas: 0, subtotalMagna: 900, subtotalPremium: 1000 },
      },
      hotelesPropuestos: [],
      incumplimientos: [],
      casetas: [],
    },
  ],
  propuestas: [],
  categorias: {},
  recomendaciones: [],
  compartidos: [],
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.calcular.mockResolvedValue({ data: { success: true, data: respuestaMotor() } });
});

describe('CalculosViajeModal en modo autorizar', () => {
  it('entrega la propuesta al padre y no llama a la API de autorización', async () => {
    const usuario = userEvent.setup();
    const onPropuesta = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <CalculosViajeModal
        solicitud={solicitud}
        open
        onOpenChange={onOpenChange}
        onEnviado={vi.fn()}
        modo="autorizar"
        onPropuesta={onPropuesta}
      />,
    );

    const siguiente = await screen.findByRole('button', { name: /siguiente/i });
    await waitFor(() => expect(siguiente).toBeEnabled());
    // Primera oferta de cada tramo: la propuesta debe usar esa selección.
    await usuario.click(screen.getAllByRole('button', { name: /^Elegir / })[0]);
    await usuario.click(siguiente);

    const terminar = await screen.findByRole('button', { name: /terminar/i });
    await waitFor(() => expect(terminar).toBeEnabled());
    await usuario.click(screen.getAllByRole('button', { name: /^Elegir / })[0]);
    await usuario.click(terminar);

    await usuario.click(await screen.findByRole('button', { name: 'Usar esta ruta' }));

    expect(onPropuesta).toHaveBeenCalledTimes(1);
    const propuesta = onPropuesta.mock.calls[0][0] as PropuestaRuta;

    expect(propuesta.calculo.modo_transporte).toBe('solicitado');
    expect(propuesta.calculo.tramos).toHaveLength(2);
    expect(propuesta.calculo.tramos[0]).toMatchObject({
      costo: 520,
      moneda: 'MXN',
      url_compra: 'https://comprar.test/a',
      linea: 'Futura',
    });

    // Se guardan las dos alternativas de cada tramo, no solo la elegida.
    expect(propuesta.opciones).toHaveLength(4);
    expect(propuesta.opciones.filter((opcion) => opcion.fue_elegida)).toHaveLength(2);
    expect(propuesta.opciones.every((opcion) => opcion.datos?.tramo !== undefined)).toBe(true);

    expect(propuesta.resumen).toMatchObject({
      autobus: 1040,
      avion: null,
      casetas: null,
      comida: null,
      total: 1040,
    });
    expect(propuesta.calculo.ruta?.nodos.some((nodo) => nodo.costo === 520)).toBe(true);

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(mocks.autorizar).not.toHaveBeenCalled();
    expect(mocks.enviar).not.toHaveBeenCalled();
    expect(mocks.guardarOpciones).not.toHaveBeenCalled();
  });
});
