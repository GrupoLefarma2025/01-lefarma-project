import { readFileSync } from 'node:fs';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ImportarCotizacion } from './ImportarCotizacion';
import { esquemaCotizacionViajes } from '../schemas/cotizacionViajes.esquema';
import type { CotizacionOpcion, Cotizacion } from '../types/cotizacion.types';
import type { OpcionCotizacion, Solicitud } from '../types/solicitud.types';
import type { Esquema } from './validadorCotizacion';

const api = vi.hoisted(() => ({
  crear: vi.fn(),
  misSolicitudes: vi.fn(),
  detalle: vi.fn(),
  guardarOpciones: vi.fn(),
}));
vi.mock('../services/solicitudes.api', () => ({ solicitudesApi: api }));

const rutaFixture = '../test/fixtures/cotizacion-ejemplo.json';
const rutaSchema = '../../../../../lefarma.docs/viaticos/schemas/cotizacion-viajes.schema.json';

/** Fixture re-leido en cada caso: ningun estado se comparte entre tests. */
const fixture = (): Cotizacion =>
  JSON.parse(readFileSync(new URL(rutaFixture, import.meta.url), 'utf8')) as Cotizacion;

const opcion = (indice: number): CotizacionOpcion => fixture().opciones[indice];

/** capturas[] es opcional en el contrato; el importador lo normaliza a array. */
const capturasDe = (indice: number): string[] => opcion(indice).capturas ?? [];

/** Las claves de fila son `${indice}-${modo}-${transportista}`. */
const CLAVE_VOLARIS = '0-avion-Volaris';
const CLAVE_VIVA = '1-avion-Viva Aerobus';

const pega = (json: unknown) => {
  fireEvent.change(screen.getByLabelText('JSON de la cotización'), {
    target: { value: JSON.stringify(json) },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Cargar cotización' }));
};

const ENVIADA: Solicitud = {
  id_solicitud: 7,
  id_usuario_solicitante: 1,
  periodo: '',
  gerencia: '',
  estado: 'enviada',
  activo: true,
  fecha_creacion: '2026-10-07T00:00:00Z',
  fecha_modificacion: '2026-10-07T00:00:00Z',
  datos: null,
  opciones: [],
  eventos: [],
};

/** Ultimo juego de opciones enviado al backend. */
const opcionesEnviadas = (): OpcionCotizacion[] => api.guardarOpciones.mock.calls.at(-1)![1];

beforeEach(() => {
  vi.clearAllMocks();
  api.guardarOpciones.mockResolvedValue({
    data: { success: true, message: 'ok', data: ENVIADA },
  });
  api.crear.mockResolvedValue({
    data: { success: true, message: 'ok', data: { ...ENVIADA, id_solicitud: 42, estado: 'borrador' } },
  });
});

describe('ImportarCotizacion', () => {
  it('carga una fila por opcion conservando url_compra y todas las capturas', () => {
    render(<ImportarCotizacion solicitudId={7} />);
    pega(fixture());

    expect(screen.getAllByTestId(/^fila-/)).toHaveLength(3);
    expect(screen.queryByTestId('errores-cotizacion')).not.toBeInTheDocument();

    // url_compra intacta en cada fila.
    expect(screen.getByTestId(`url-compra-${CLAVE_VOLARIS}`)).toHaveAttribute(
      'href',
      opcion(0).url_compra,
    );
    expect(screen.getByTestId(`url-compra-${CLAVE_VIVA}`)).toHaveAttribute(
      'href',
      opcion(1).url_compra,
    );

    // capturas[] intactas: la URL pública y el data URI base64.
    const capturas = within(screen.getByTestId(`capturas-${CLAVE_VOLARIS}`)).getAllByRole('img');
    expect(capturas.map(img => img.getAttribute('src'))).toEqual(capturasDe(0));
    expect(
      within(screen.getByTestId(`capturas-${CLAVE_VIVA}`))
        .getAllByRole('img')
        .map(img => img.getAttribute('src')),
    ).toEqual(capturasDe(1));
  });

  it('muestra cobertura_declarada y transportistas_no_encontrados', () => {
    render(<ImportarCotizacion solicitudId={7} />);
    pega(fixture());

    expect(screen.getByTestId('cobertura-declarada')).toHaveTextContent(
      'Consulta realizada el 2026-10-07',
    );
    const faltantes = within(screen.getByTestId('transportistas-no-encontrados')).getAllByTestId(
      'transportista-no-encontrado',
    );
    expect(faltantes.map(item => item.textContent)).toEqual(
      fixture().transportistas_no_encontrados,
    );
    expect(faltantes[0]).toHaveTextContent('Aeromexico');
  });

  it('un JSON sin url_compra muestra el error y no muta las filas ya cargadas', async () => {
    render(<ImportarCotizacion solicitudId={7} />);
    pega(fixture());

    const invalida = fixture();
    delete (invalida.opciones[0] as Partial<CotizacionOpcion>).url_compra;
    pega(invalida);

    expect(screen.getByTestId('errores-cotizacion')).toHaveTextContent(
      '$.opciones[0].url_compra: campo requerido ausente',
    );
    // Nada se toco: siguen las 3 filas originales con su link de compra.
    expect(screen.getAllByTestId(/^fila-/)).toHaveLength(3);
    expect(screen.getByTestId(`url-compra-${CLAVE_VOLARIS}`)).toHaveAttribute(
      'href',
      opcion(0).url_compra,
    );
    // Y el envio sigue disponible con la seleccion previa intacta.
    fireEvent.click(screen.getByLabelText(`Elegir ${opcion(0).transportista} ${opcion(0).salida}`));
    fireEvent.click(screen.getByRole('button', { name: 'Enviar solicitud' }));
    await waitFor(() => expect(api.guardarOpciones).toHaveBeenCalledWith(7, expect.anything()));
    expect(opcionesEnviadas()[0].url_compra).toBe(opcion(0).url_compra);
  });

  it('un JSON mal formado muestra un error legible sin cargar filas', () => {
    render(<ImportarCotizacion solicitudId={7} />);
    fireEvent.change(screen.getByLabelText('JSON de la cotización'), {
      target: { value: '{ esto no es json' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cargar cotización' }));

    expect(screen.getByTestId('errores-cotizacion')).toHaveTextContent(
      'El JSON pegado no se pudo interpretar',
    );
    expect(screen.queryAllByTestId(/^fila-/)).toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Enviar solicitud' })).not.toBeInTheDocument();
  });

  it('Enviar solicitud marca las elegidas, conserva el resto y deja el estado en enviada', async () => {
    render(<ImportarCotizacion solicitudId={7} />);
    pega(fixture());

    fireEvent.click(screen.getByLabelText(`Elegir ${opcion(1).transportista} ${opcion(1).salida}`));
    fireEvent.click(screen.getByRole('button', { name: 'Enviar solicitud' }));

    await waitFor(() => expect(api.guardarOpciones).toHaveBeenCalled());
    // Se envian las 3 opciones (el backend reemplaza el juego completo).
    const enviadas = opcionesEnviadas();
    expect(enviadas).toHaveLength(3);
    expect(enviadas.map(o => o.fue_elegida)).toEqual([false, true, false]);
    expect(enviadas.map(o => o.linea)).toEqual(['Volaris', 'Viva Aerobus', 'Hotel Morales']);
    expect(enviadas.map(o => o.tipo)).toEqual(['vuelo', 'vuelo', 'hotel']);
    // Requisitos duros: url_compra y capturas[] viajan intactos.
    expect(enviadas[0].url_compra).toBe(opcion(0).url_compra);
    expect(enviadas[0].capturas).toEqual(capturasDe(0));
    expect(enviadas[0].ruta_captura).toBe(capturasDe(0)[0]);

    expect(await screen.findByTestId('solicitud-enviada')).toHaveTextContent(
      'Cotización guardada en la solicitud 7 con estado enviada',
    );
    expect(screen.getByText(/Estado: enviada/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar solicitud' })).toBeDisabled();
  });

  it('el estado que muestra es el que devuelve el servidor, no uno inventado en local', async () => {
    // El navegador no decide el estado: si el servidor dice otra cosa, eso se
    // muestra. Antes se caia a un `?? 'enviada'` fijo en local.
    api.guardarOpciones.mockResolvedValue({
      data: { success: true, message: 'ok', data: { ...ENVIADA, estado: 'borrador' } },
    });
    render(<ImportarCotizacion solicitudId={7} />);
    pega(fixture());

    fireEvent.click(screen.getByLabelText(`Elegir ${opcion(0).transportista} ${opcion(0).salida}`));
    fireEvent.click(screen.getByRole('button', { name: 'Enviar solicitud' }));

    expect(await screen.findByTestId('solicitud-enviada')).toHaveTextContent(
      'Cotización guardada en la solicitud 7 con estado borrador',
    );
    expect(screen.getByText(/Estado: borrador/)).toBeInTheDocument();
    expect(screen.queryByText(/Estado: enviada/)).toBeNull();
  });

  it('sin solicitud previa crea el borrador y luego envia las opciones', async () => {
    render(<ImportarCotizacion />);
    pega(fixture());
    fireEvent.click(screen.getByLabelText(`Elegir ${opcion(2).transportista} ${opcion(2).salida}`));
    fireEvent.click(screen.getByRole('button', { name: 'Enviar solicitud' }));

    await waitFor(() => expect(api.guardarOpciones).toHaveBeenCalled());
    expect(api.crear).toHaveBeenCalledWith({
      datos: expect.objectContaining({ origen: fixture().consulta.origen }),
    });
    expect(api.guardarOpciones).toHaveBeenCalledWith(42, expect.anything());
  });

  it('el alta persiste el desglose por concepto con los nombres exactos del backend', async () => {
    render(<ImportarCotizacion conceptosMotor={{ gasolina: 250, casetas: 50, hospedaje: null, comida: 600, taxi: 120 }} />);
    pega(fixture());
    // Elige el vuelo Volaris (2450.5) y el hospedaje (3180); el autobus no existe en el fixture.
    fireEvent.click(screen.getByLabelText(`Elegir ${opcion(0).transportista} ${opcion(0).salida}`));
    fireEvent.click(screen.getByLabelText(`Elegir ${opcion(2).transportista} ${opcion(2).salida}`));
    fireEvent.click(screen.getByRole('button', { name: 'Enviar solicitud' }));

    await waitFor(() => expect(api.crear).toHaveBeenCalled());
    expect(api.crear.mock.calls.at(-1)![0].datos).toEqual({
      origen: fixture().consulta.origen,
      destino: fixture().consulta.destino,
      fecha_salida: fixture().consulta.fecha_salida,
      fecha_regreso: fixture().consulta.fecha_regreso,
      personas: fixture().consulta.personas,
      cotizacion_version: fixture().version,
      autobus: null,
      avion: 2450.5,
      gasolina: 250,
      casetas: 50,
      comida: 600,
      taxi: 120,
      hospedaje: 3180,
      total: 2450.5 + 3180 + 250 + 50 + 600 + 120,
    });
  });

  it('un concepto desconocido viaja null, nunca 0, y el total suma solo lo conocido', async () => {
    render(<ImportarCotizacion />);
    pega(fixture());
    fireEvent.click(screen.getByLabelText(`Elegir ${opcion(1).transportista} ${opcion(1).salida}`));
    fireEvent.click(screen.getByRole('button', { name: 'Enviar solicitud' }));

    await waitFor(() => expect(api.crear).toHaveBeenCalled());
    const datos = api.crear.mock.calls.at(-1)![0].datos;
    expect(datos.autobus).toBeNull();
    expect(datos.hospedaje).toBeNull();
    expect(datos.gasolina).toBeNull();
    expect(datos.casetas).toBeNull();
    expect(datos.comida).toBeNull();
    expect(datos.taxi).toBeNull();
    expect(datos.avion).toBe(1899);
    expect(datos.total).toBe(1899);
  });

  it('una opcion elegida con precio estimado deja su concepto y el total en null', async () => {
    const estimada = fixture();
    estimada.opciones[0].precio = null;
    estimada.opciones[0].fuente = 'estimado';
    render(<ImportarCotizacion />);
    pega(estimada);
    fireEvent.click(
      screen.getByLabelText(`Elegir ${estimada.opciones[0].transportista} ${estimada.opciones[0].salida}`),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Enviar solicitud' }));

    await waitFor(() => expect(api.crear).toHaveBeenCalled());
    const datos = api.crear.mock.calls.at(-1)![0].datos;
    expect(datos.avion).toBeNull();
    expect(datos.total).toBeNull();
  });

  it('usa la solicitud del wizard y no crea una segunda', async () => {
    render(<ImportarCotizacion solicitudId={7} />);
    pega(fixture());
    fireEvent.click(screen.getByLabelText(`Elegir ${opcion(0).transportista} ${opcion(0).salida}`));
    fireEvent.click(screen.getByRole('button', { name: 'Enviar solicitud' }));

    await waitFor(() => expect(api.guardarOpciones).toHaveBeenCalledWith(7, expect.anything()));
    expect(api.crear).not.toHaveBeenCalled();
  });

  it('no deja enviar sin seleccionar al menos una opcion', () => {
    render(<ImportarCotizacion solicitudId={7} />);
    pega(fixture());
    expect(screen.getByRole('button', { name: 'Enviar solicitud' })).toBeDisabled();

    fireEvent.click(screen.getByLabelText(`Elegir ${opcion(0).transportista} ${opcion(0).salida}`));
    expect(screen.getByRole('button', { name: 'Enviar solicitud' })).toBeEnabled();
  });

  it('el precio estimado se marca como tal y no como 0', () => {
    const estimada = fixture();
    estimada.opciones[0].precio = null;
    estimada.opciones[0].fuente = 'estimado';
    render(<ImportarCotizacion solicitudId={7} />);
    pega(estimada);

    const fila = within(screen.getByTestId(`fila-${CLAVE_VOLARIS}`));
    expect(fila.getByTestId(`estimado-${CLAVE_VOLARIS}`)).toBeInTheDocument();
    expect(fila.getByText(/Estimado \(estimado\)/)).toBeInTheDocument();
  });

  it('el error del backend se muestra sin perder la tabla cargada', async () => {
    api.guardarOpciones.mockRejectedValue({ message: 'Solicitud no encontrada.', statusCode: 404 });
    render(<ImportarCotizacion solicitudId={7} />);
    pega(fixture());
    fireEvent.click(screen.getByLabelText(`Elegir ${opcion(0).transportista} ${opcion(0).salida}`));
    fireEvent.click(screen.getByRole('button', { name: 'Enviar solicitud' }));

    expect(await screen.findByTestId('error-envio')).toHaveTextContent('Solicitud no encontrada.');
    expect(screen.getAllByTestId(/^fila-/)).toHaveLength(3);
  });

  it('el esquema que usa el importador es identico al contrato oficial de lefarma.docs', () => {
    // Solo pueden faltar las anotaciones ($schema, $id, title, description,
    // format) que el validador no evalua.
    const sinAnotaciones = (valor: unknown): unknown => {
      if (Array.isArray(valor)) return valor.map(sinAnotaciones);
      if (typeof valor === 'object' && valor !== null) {
        return Object.fromEntries(
          Object.entries(valor as Record<string, unknown>)
            .filter(([clave]) => !['$schema', '$id', 'title', 'description', 'format'].includes(clave))
            .map(([clave, contenido]) => [clave, sinAnotaciones(contenido)]),
        );
      }
      return valor;
    };

    const oficial = JSON.parse(readFileSync(new URL(rutaSchema, import.meta.url), 'utf8'));
    expect(esquemaCotizacionViajes).toEqual(sinAnotaciones(oficial) as Esquema);
  });
});