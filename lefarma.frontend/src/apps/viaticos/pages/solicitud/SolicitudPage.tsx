import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SelectorModo } from '../../components/SelectorModo';
import { WizardStepper } from '../../components/WizardStepper';
import { Badge } from '@/components/ui/badge';
import { usePageTitle } from '@/hooks/usePageTitle';
import { toast } from 'sonner';
import { toApiError } from '@/utils/errors';
import { API } from '@/shared/api/apiClient';
import { useAuthStore } from '@/shared/auth/authStore';
import type { ApiResponse } from '@/types/api.types';
import type { Sucursal } from '@/types/catalogo.types';
import { CatalogoSearchSelect } from '@/apps/educacion-medica/components/CatalogoSearchSelect';
import type { UsuarioCatalogo } from '@/apps/educacion-medica/types/educacionMedica.types';
import { educacionMedicaApi } from '@/apps/educacion-medica/services/educacionMedica.api';
import { costosRutaApi } from '../../services/costosRuta.api';
import { solicitudesApi } from '../../services/solicitudes.api';
import type { CostosRutaOferta } from '../../types/costosRuta.types';
import type { CrearSolicitudPayload, OpcionCotizacion } from '../../types/solicitud.types';
import type {
  AcompananteV2,
  DestinoV2,
  OrigenV2,
  PasoPersonaV2,
  PasoTransporteV2,
  RetornoV2,
} from '../../types/wizardV2.types';
import {
  adaptarTramoACostosRuta,
  esOfertaVuelo,
  MONEDA_PERMITIDA,
  rangoDelViaje,
  sugerirOrigenInicial,
} from '../../services/solicitudWizard.adapter';
import { PuntoMapaPicker } from '../../components/PuntoMapaPicker';
import { TablaOpciones } from '../../components/TablaOpciones';
import { TablaHoteles } from '../../components/TablaHoteles';
import { DatePicker } from '@/components/ui/date-picker';
import { TimePicker } from '../../components/TimePicker';
import { VIATICOS_FIXTURES_ACTIVOS, rellenarConFixture } from '../../test/fixtures/solicitudV2.fixture';

const PASOS = [
  { id: 1, titulo: 'Persona' },
  { id: 2, titulo: 'Transporte y viaje compartido' },
  { id: 3, titulo: 'Origen' },
  { id: 4, titulo: 'Destinos' },
  { id: 5, titulo: 'Regreso' },
  { id: 6, titulo: 'Viáticos y revisión' },
] as const;

type PasoId = (typeof PASOS)[number]['id'];

/** Jornada registrada: el asistente la reutiliza, no la vuelve a pedir. */
const JORNADA_REGISTRADA = '08:00–18:30';

function mxn(n: number): string {
  return `$${n.toLocaleString('es-MX', { maximumFractionDigits: 0 })} MXN`;
}

let secuenciaDestino = 1;
function nuevoDestino(): DestinoV2 {
  return {
    id: `dest-${secuenciaDestino++}`,
    punto: null,
    debeEstarFecha: '',
    debeEstarHora: '',
    saleFecha: '',
    saleHora: '',
    hospedaje: { necesario: false, zona: 'actual', fechaEntrada: '', fechaSalida: '', hotel: null },
    cotizacion: null,
  };
}

/** Indicador visible SOLO en modo de desarrollo con fixtures explícitos. */
function IndicadorDatosPrueba() {
  return (
    <p data-testid="indicador-datos-prueba" className="rounded border border-dashed px-2 py-1 text-xs text-muted-foreground">
      Datos de prueba (solo desarrollo, no son precios reales)
    </p>
  );
}

function nombrePuntoPrevio(origen: OrigenV2, destinos: DestinoV2[], indice: number, sucursales: Sucursal[]): string {
  if (indice === 0) {
    if (origen.punto) return origen.punto.nombre;
    return sucursales.find((s) => s.idSucursal === origen.sucursalId)?.nombre ?? 'Origen';
  }
  return destinos[indice - 1].punto?.nombre ?? `Destino ${indice}`;
}

export function SolicitudPage() {
  usePageTitle('Solicitud de viáticos', 'Viáticos');
  const nombreSesion = useAuthStore((s) => s.user?.nombre);
  const idSesion = useAuthStore((s) => s.user?.id);

  const [paso, setPaso] = useState<PasoId>(1);
  const [persona, setPersona] = useState<PasoPersonaV2>({ modo: 'mia', empleadoId: null, nombre: '', motivo: '' });
  const [transporte, setTransporte] = useState<PasoTransporteV2>({ modo: 'solicitado', compartir: false, acompanantes: [] });
  const [origen, setOrigen] = useState<OrigenV2>({ tipo: 'sucursal', sucursalId: null, punto: null, fechaSalida: '', horaSalida: '' });
  const [destinos, setDestinos] = useState<DestinoV2[]>(() => [nuevoDestino()]);
  const [indiceActual, setIndiceActual] = useState(0);
  const [retorno, setRetorno] = useState<RetornoV2>({ necesario: false, saleFecha: '', saleHora: '', llegadaRequeridaFecha: '', llegadaRequeridaHora: '' });
  const [comidas, setComidas] = useState('');
  const [extras, setExtras] = useState<{ id: string; concepto: string; monto: string }[]>([]);
  const [calculando, setCalculando] = useState(false);
  const [errorTramo, setErrorTramo] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [solicitudId, setSolicitudId] = useState<number | null>(null);

  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [cargandoSuc, setCargandoSuc] = useState(true);
  const [errorSuc, setErrorSuc] = useState('');
  const [empleados, setEmpleados] = useState<UsuarioCatalogo[]>([]);
  const [cargandoEmp, setCargandoEmp] = useState(false);
  const [errorEmp, setErrorEmp] = useState('');
  const origenSugerido = useRef(false);

  // Catálogo de sucursales.
  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        const res = await API.get<ApiResponse<Sucursal[]>>('/catalogos/Sucursales');
        if (cancelado) return;
        if (!res.data.success) {
          setErrorSuc(res.data.message || 'No se pudieron cargar las sucursales.');
          return;
        }
        setSucursales((res.data.data || []).filter((s) => s.activo));
      } catch (falla: unknown) {
        if (!cancelado) setErrorSuc(toApiError(falla).message || 'No se pudieron cargar las sucursales.');
      } finally {
        if (!cancelado) setCargandoSuc(false);
      }
    })();
    return () => { cancelado = true; };
  }, []);

  // "Para mí" toma el nombre de la sesión; no se vuelve a pedir.
  useEffect(() => {
    if (persona.modo === 'mia' && nombreSesion && !persona.nombre) {
      setPersona((p) => ({ ...p, nombre: nombreSesion }));
    }
  }, [nombreSesion, persona.modo, persona.nombre]);

  // Preselección de Antonio Maura solo con coordenadas válidas reales.
  useEffect(() => {
    if (origenSugerido.current || cargandoSuc || sucursales.length === 0) return;
    origenSugerido.current = true;
    const sugerida = sugerirOrigenInicial(sucursales);
    if (sugerida !== null) setOrigen((o) => ({ ...o, sucursalId: sugerida }));
  }, [cargandoSuc, sucursales]);

  // Empleados solo cuando hacen falta (para alguien más o compartir viaje).
  const necesitaEmpleados = persona.modo === 'otra' || transporte.compartir;
  const empleadosEnVuelo = useRef(false);
  useEffect(() => {
    if (!necesitaEmpleados || empleados.length > 0 || empleadosEnVuelo.current) return;
    empleadosEnVuelo.current = true;
    let cancelado = false;
    setCargandoEmp(true);
    void (async () => {
      try {
        const res = await educacionMedicaApi.usuarios.getAll();
        if (cancelado) return;
        if (!res.data.success) {
          setErrorEmp(res.data.message || 'No se pudieron cargar los empleados.');
          return;
        }
        setEmpleados(res.data.data || []);
      } catch (falla: unknown) {
        if (!cancelado) setErrorEmp(toApiError(falla).message || 'No se pudieron cargar los empleados.');
      } finally {
        if (!cancelado) setCargandoEmp(false);
      }
    })();
    return () => { cancelado = true; };
  }, [necesitaEmpleados, empleados.length]);

  const empleadoItems = useMemo(
    () => empleados.map((e) => ({ id: e.idUsuario, label: e.nombreCompleto, description: e.correo })),
    [empleados],
  );
  const sucursalItems = useMemo(
    () => sucursales.map((s) => ({ id: s.idSucursal, label: s.nombre, description: s.ciudad })),
    [sucursales],
  );

  function elegirEmpleado(id: number | null) {
    const empleado = empleados.find((e) => e.idUsuario === id) ?? null;
    setPersona((p) => ({ ...p, empleadoId: id, nombre: empleado?.nombreCompleto ?? '' }));
  }

  function agregarAcompanante(id: number | null) {
    if (id === null) return;
    if (id === persona.empleadoId || (persona.modo === 'mia' && id === idSesion)) {
      toast.error('La persona viajera no puede agregarse como acompañante.');
      return;
    }
    const empleado = empleados.find((e) => e.idUsuario === id);
    if (!empleado) return;
    setTransporte((t) =>
      t.acompanantes.some((a) => a.directorioId === id)
        ? t
        : { ...t, acompanantes: [...t.acompanantes, { directorioId: id, nombreCompleto: empleado.nombreCompleto, correo: empleado.correo ?? null }] },
    );
  }

  /** Cambiar algo aguas arriba invalida las cotizaciones de ese tramo en adelante. */
  function marcarRecalculo(desdeIndice: number) {
    setDestinos((actual) =>
      actual.map((d, i) => (i >= desdeIndice ? { ...d, cotizacion: d.cotizacion ? { ...d.cotizacion, necesitaRecalculo: true } : null } : d)),
    );
  }

  function actualizarDestino(indice: number, cambio: Partial<DestinoV2>, invalida = true) {
    setDestinos((actual) => actual.map((d, i) => (i === indice ? { ...d, ...cambio } : d)));
    if (invalida) marcarRecalculo(indice);
  }

  const destinoActual = destinos[indiceActual];
  const tramoListo = useMemo(() => {
    if (!destinoActual?.punto) return false;
    const { request } = adaptarTramoACostosRuta({
      nombreViajero: persona.nombre || 'viajero',
      modoTransporte: transporte.modo,
      origen,
      destino: destinoActual,
      sucursales,
    });
    return request !== null;
  }, [destinoActual, persona.nombre, transporte.modo, origen, sucursales]);

  async function calcularTramo(indice: number) {
    const destino = destinos[indice];
    if (!destino) return;
    const { request, errors } = adaptarTramoACostosRuta({
      nombreViajero: persona.nombre,
      modoTransporte: transporte.modo,
      origen,
      destino,
      sucursales,
    });
    if (!request) {
      setErrorTramo(errors.join(' '));
      return;
    }
    setCalculando(true);
    setErrorTramo(null);
    try {
      const res = await costosRutaApi.calcular(request);
      if (!res.data.success || !res.data.data) {
        setErrorTramo(res.data.message ?? 'No se pudo calcular el tramo.');
        return;
      }
      const respuesta = res.data.data;
      const tramo = respuesta.resultados[0];
      setDestinos((actual) =>
        actual.map((d, i) =>
          i === indice
            ? {
                ...d,
                cotizacion: {
                  ofertas: tramo?.tramos[0]?.opciones ?? [],
                  rutaArmada: tramo
                    ? {
                        tramos: tramo.rutaArmada.tramos.map((t) => ({ de: t.de, a: t.a, km: t.km, litros: t.litros, casetas: t.casetas.costo, subtotalMagna: t.subtotalMagna })),
                        totales: { km: tramo.rutaArmada.totales.km, litros: tramo.rutaArmada.totales.litros, casetas: tramo.rutaArmada.totales.casetas, subtotalMagna: tramo.rutaArmada.totales.subtotalMagna },
                      }
                    : null,
                  hoteles: tramo?.hotelesPropuestos ?? [],
                  cotizadoEn: new Date().toISOString(),
                  necesitaRecalculo: false,
                  elegidaId: null,
                  equipajeDocumentado: false,
                },
              }
            : d,
        ),
      );
      toast.success('Tramo calculado. Elige una opción para continuar.');
    } catch (falla: unknown) {
      setErrorTramo(toApiError(falla).message || 'No se pudo calcular el tramo.');
    } finally {
      setCalculando(false);
    }
  }

  function elegirOferta(indice: number, oferta: CostosRutaOferta) {
    setDestinos((actual) =>
      actual.map((d, i) =>
        i === indice && d.cotizacion
          ? { ...d, cotizacion: { ...d.cotizacion, elegidaId: d.cotizacion.elegidaId === oferta.id ? null : oferta.id, equipajeDocumentado: false } }
          : d,
      ),
    );
  }

  /** Un tramo queda cerrado cuando está cotizado, vigente y con elección (salvo carro propio o tramo sin ofertas). */
  function tramoCerrado(d: DestinoV2): boolean {
    const c = d.cotizacion;
    if (!c || c.necesitaRecalculo) return false;
    if (transporte.modo === 'propio') return true;
    if (c.ofertas.length === 0) return true;
    return c.elegidaId !== null;
  }

  const puedeTerminar = destinos.length > 0 && destinos.every(tramoCerrado);

  function agregarDestino() {
    if (!puedeTerminar) return;
    setDestinos((actual) => [...actual, nuevoDestino()]);
    setIndiceActual(destinos.length);
    setErrorTramo(null);
  }

  function quitarDestino(indice: number) {
    if (destinos.length === 1) return;
    setDestinos((actual) => {
      const resto = actual.filter((_, i) => i !== indice);
      return resto.map((d, i) => (i >= indice && d.cotizacion ? { ...d, cotizacion: { ...d.cotizacion, necesitaRecalculo: true } } : d));
    });
    setIndiceActual((i) => Math.max(0, Math.min(i, destinos.length - 2)));
  }

  function moverDestino(indice: number, offset: -1 | 1) {
    const j = indice + offset;
    if (j < 0 || j >= destinos.length) return;
    setDestinos((actual) => {
      const copia = [...actual];
      [copia[indice], copia[j]] = [copia[j], copia[indice]];
      return copia.map((d, i) => (i >= Math.min(indice, j) && d.cotizacion ? { ...d, cotizacion: { ...d.cotizacion, necesitaRecalculo: true } } : d));
    });
    setIndiceActual(j);
  }

  // ---- validaciones por paso ----
  function pasoValido(id: PasoId): boolean {
    if (id === 1) {
      if (persona.modo === 'otra' && persona.empleadoId === null) return false;
      return persona.nombre.trim() !== '' && persona.motivo.trim() !== '';
    }
    if (id === 2) return true;
    if (id === 3) {
      const { request } = adaptarTramoACostosRuta({
        nombreViajero: persona.nombre || 'viajero',
        modoTransporte: transporte.modo,
        origen,
        destino: { ...nuevoDestino(), punto: { nombre: 'x', latitud: 19.5, longitud: -99.5 }, debeEstarFecha: '2026-11-10', debeEstarHora: '12:00', saleFecha: '2026-11-10', saleHora: '18:00' },
        sucursales,
      });
      return request !== null;
    }
    if (id === 4) return puedeTerminar;
    if (id === 5) {
      if (!retorno.necesario) return true;
      return retorno.saleFecha !== '' && retorno.saleHora !== '' && retorno.llegadaRequeridaFecha !== '' && retorno.llegadaRequeridaHora !== '';
    }
    return true;
  }

  const rango = rangoDelViaje(origen, destinos, retorno);

  // ---- revisión ----
  const elegidas = destinos.flatMap((d, i) =>
    d.cotizacion?.ofertas.filter((o) => o.id === d.cotizacion!.elegidaId).map((o) => ({ destino: i, oferta: o })) ?? [],
  );
  const totalTransporte = elegidas.reduce((s, e) => s + e.oferta.costoGrupo, 0);
  const montoComidas = comidas.trim() === '' ? null : Number(comidas.replace(/[$\s,]/g, ''));
  const totalExtras = extras.reduce((s, x) => s + (Number(String(x.monto).replace(/[$\s,]/g, '')) || 0), 0);
  // Las ofertas del motor llegan sin moneda separada: el prototipo las trata
  // como MXN y nunca mezcla monedas (ver MONEDA_PERMITIDA).
  const totalEstimado = elegidas.length > 0 ? totalTransporte : null;

  function construirOpciones(): { opciones: OpcionCotizacion[]; advertencias: string[] } {
    const opciones: OpcionCotizacion[] = [];
    const advertencias: string[] = [];
    for (const { oferta } of elegidas) {
      if (!oferta.comprar?.url) {
        advertencias.push(`«${oferta.linea}» no trae enlace de compra y no puede enviarse como cotización; queda guardada en los datos del viaje.`);
        continue;
      }
      opciones.push({
        tipo: oferta.modo,
        linea: oferta.linea,
        precio: oferta.costoGrupo,
        moneda: MONEDA_PERMITIDA,
        url_compra: oferta.comprar.url,
        fuente: oferta.fuente,
        fue_elegida: true,
        ruta_captura: oferta.capturas?.[0] ?? oferta.rutaCaptura ?? null,
        capturas: oferta.capturas ?? (oferta.rutaCaptura ? [oferta.rutaCaptura] : []),
      });
    }
    for (const d of destinos) {
      const hotel = d.hospedaje.hotel;
      if (!hotel) continue;
      if (!hotel.link) {
        advertencias.push(`El hotel «${hotel.lugar}» no trae enlace de reservación; queda guardado en los datos del viaje.`);
        continue;
      }
      opciones.push({
        tipo: 'hotel',
        linea: `${hotel.lugar} (${hotel.checkIn} al ${hotel.checkOut})`,
        precio: null,
        moneda: MONEDA_PERMITIDA,
        url_compra: hotel.link,
        fuente: hotel.fuente.includes('estimad') ? hotel.fuente : `${hotel.fuente} (estimado)`,
        fue_elegida: true,
        ruta_captura: hotel.capturas?.[0] ?? hotel.rutaCaptura ?? null,
        capturas: hotel.capturas ?? (hotel.rutaCaptura ? [hotel.rutaCaptura] : []),
      });
    }
    return { opciones, advertencias };
  }

  async function enviarSolicitud() {
    if (enviando || solicitudId !== null) return;
    const { opciones, advertencias } = construirOpciones();
    if (elegidas.length > 0 && opciones.length === 0) {
      toast.error('Ninguna opción elegida puede enviarse como cotización (sin enlace de compra).');
      return;
    }
    advertencias.forEach((a) => toast.warning(a));
    const datos = {
      version: 'solicitud-v2',
      persona,
      transporte,
      origen,
      destinos: destinos.map((d) => ({
        punto: d.punto,
        debeEstarFecha: d.debeEstarFecha,
        debeEstarHora: d.debeEstarHora,
        saleFecha: d.saleFecha,
        saleHora: d.saleHora,
        hospedaje: { ...d.hospedaje },
        elegidaId: d.cotizacion?.elegidaId ?? null,
        cotizadoEn: d.cotizacion?.cotizadoEn ?? null,
        equipajeDocumentado: d.cotizacion?.equipajeDocumentado ?? false,
      })),
      retorno,
      gastos: { comidas: montoComidas, extras: extras.map((e) => ({ concepto: e.concepto, monto: Number(String(e.monto).replace(/[$\s,]/g, '')) || null })) },
      rango,
    };
    const payload: CrearSolicitudPayload = { datos };
    setEnviando(true);
    try {
      const creada = await solicitudesApi.crear(payload);
      if (!creada.data.success || !creada.data.data) {
        toast.error(creada.data.message ?? 'No se pudo crear la solicitud.');
        return;
      }
      const id = creada.data.data.id_solicitud;
      // Guardar la cotización ES el envío (contrato legacy: borrador → enviada).
      const guardada = await solicitudesApi.guardarOpciones(id, opciones);
      if (!guardada.data.success) {
        toast.error(guardada.data.message ?? 'Se creó el borrador, pero no se pudo enviar la cotización.');
        return;
      }
      setSolicitudId(id);
      toast.success(`Solicitud ${id} enviada.`);
    } catch (falla: unknown) {
      toast.error(toApiError(falla).message || 'No se pudo enviar la solicitud.');
    } finally {
      setEnviando(false);
    }
  }

  function aplicarFixture() {
    const f = rellenarConFixture();
    setPersona(f.persona);
    setOrigen(f.origen);
    setDestinos(f.destinos);
    setIndiceActual(0);
    toast.success('Formulario rellenado con datos de prueba (solo desarrollo).');
  }

  const acompanantesDisponibles: AcompananteV2[] = transporte.acompanantes;

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      {VIATICOS_FIXTURES_ACTIVOS ? <IndicadorDatosPrueba /> : null}
      <Card>
        <CardHeader>
          <CardTitle>Solicitud de viáticos</CardTitle>
          <CardDescription>
            Crea tu solicitud paso a paso: persona, transporte, origen, destinos con comparación por tramo,
            regreso y revisión. Calcula cada tramo antes de continuar; el envío ocurre solo al final.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {VIATICOS_FIXTURES_ACTIVOS ? (
            <div>
              <Button type="button" variant="outline" onClick={aplicarFixture}>
                Rellenar con datos de prueba
              </Button>
            </div>
          ) : null}

          <nav aria-label="Avance de la solicitud" className="space-y-3">
            <WizardStepper pasos={PASOS.map(({ id, titulo }) => ({ id, titulo }))} actual={paso} />
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" disabled={paso === 1} onClick={() => setPaso((p) => (p - 1) as PasoId)}>
                Atrás
              </Button>
              <Button type="button" disabled={paso === PASOS.length || !pasoValido(paso)} onClick={() => setPaso((p) => (p + 1) as PasoId)}>
                Siguiente
              </Button>
            </div>
          </nav>

          {paso === 1 ? (
            <section data-testid="paso-1" className="space-y-4">
              <h2 className="font-semibold">Persona viajera</h2>
              <SelectorModo
                ariaLabel="Persona viajera"
                value={persona.modo}
                onChange={(id) => {
                  if (id === 'mia') setPersona((p) => ({ ...p, modo: 'mia', empleadoId: null, nombre: nombreSesion ?? p.nombre }));
                  else setPersona((p) => ({ ...p, modo: 'otra', empleadoId: null, nombre: '' }));
                }}
                options={[
                  { id: 'mia', titulo: 'Para mí' },
                  { id: 'otra', titulo: 'Para alguien más' },
                ]}
              />
              {persona.modo === 'otra' ? (
                <div className="space-y-1">
                  <Label>Empleado que viaja</Label>
                  <CatalogoSearchSelect items={empleadoItems} value={persona.empleadoId} disabled={cargandoEmp || !!errorEmp} placeholder="Buscar y seleccionar empleado" onChange={elegirEmpleado} />
                  {cargandoEmp ? <p role="status" className="text-xs">Cargando empleados…</p> : null}
                  {errorEmp ? <p role="alert" className="text-xs text-destructive">{errorEmp}</p> : null}
                </div>
              ) : null}
              <div className="space-y-1">
                <p className="text-sm">Persona viajera: <strong>{persona.nombre || '—'}</strong></p>
                <p className="text-xs text-muted-foreground">Se reutiliza la identidad conocida; no se vuelve a pedir el nombre. Jornada registrada: {JORNADA_REGISTRADA} (no se vuelve a pedir).</p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="motivo-viaje">Motivo del viaje</Label>
                <Input id="motivo-viaje" value={persona.motivo} onChange={(e) => setPersona((p) => ({ ...p, motivo: e.target.value }))} placeholder="Ej. Visita de seguimiento a la zona" />
              </div>
            </section>
          ) : null}

          {paso === 2 ? (
            <section data-testid="paso-2" className="space-y-4">
              <h2 className="font-semibold">Transporte y viaje compartido</h2>
              <SelectorModo
                ariaLabel="Modo de transporte"
                value={transporte.modo}
                onChange={(id) => setTransporte((t) => ({ ...t, modo: id as 'propio' | 'solicitado' }))}
                options={[
                  { id: 'propio', titulo: 'Carro propio', descripcion: 'Siempre usa gasolina Magna, sin elección premium. Verás distancia y costo de combustible por tramo; las casetas se conservan.' },
                  { id: 'solicitado', titulo: 'Solicitar transporte', descripcion: 'Compararás avión, autobús y carro por cada tramo antes de continuar.' },
                ]}
              />
              <div className="flex items-center gap-2">
                <Checkbox id="compartir-viaje" checked={transporte.compartir} onCheckedChange={(v) => setTransporte((t) => ({ ...t, compartir: v === true }))} />
                <Label htmlFor="compartir-viaje">Compartir viaje</Label>
              </div>
              {transporte.compartir ? (
                <div className="space-y-2">
                  <Label>Agregar acompañante (empleado o compañero)</Label>
                  <CatalogoSearchSelect items={empleadoItems.filter((i) => !acompanantesDisponibles.some((a) => a.directorioId === i.id))} value={null} disabled={cargandoEmp || !!errorEmp} placeholder="Buscar y agregar acompañante" onChange={agregarAcompanante} />
                  {acompanantesDisponibles.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Sin acompañantes todavía. Crear para otra persona no es lo mismo que compartir el viaje.</p>
                  ) : (
                    <ul className="space-y-1 text-sm">
                      {acompanantesDisponibles.map((a) => (
                        <li key={a.directorioId} className="flex items-center justify-between gap-2">
                          <span>{a.nombreCompleto}</span>
                          <Button type="button" variant="outline" size="sm" onClick={() => setTransporte((t) => ({ ...t, acompanantes: t.acompanantes.filter((x) => x.directorioId !== a.directorioId) }))}>
                            Quitar
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}
            </section>
          ) : null}

          {paso === 3 ? (
            <section data-testid="paso-3" className="space-y-4">
              <h2 className="font-semibold">Origen del viaje</h2>
              {cargandoSuc ? <p role="status">Cargando sucursales…</p> : null}
              {errorSuc ? <p role="alert">No se pudieron cargar las sucursales: {errorSuc}</p> : null}
              <SelectorModo
                ariaLabel="Tipo de origen"
                value={origen.tipo}
                onChange={(id) => {
                  if (id === 'sucursal') { setOrigen((o) => ({ ...o, tipo: 'sucursal', punto: null })); marcarRecalculo(0); }
                  else setOrigen((o) => ({ ...o, tipo: 'mapa' }));
                }}
                options={[
                  { id: 'sucursal', titulo: 'Sucursal' },
                  { id: 'mapa', titulo: 'Buscar dirección en el mapa' },
                ]}
              />
              {origen.tipo === 'sucursal' ? (
                <div className="space-y-1">
                  <Label>Origen</Label>
                  <CatalogoSearchSelect items={sucursalItems} value={origen.sucursalId} disabled={cargandoSuc || !!errorSuc} placeholder="Selecciona la sucursal de salida" onChange={(id) => { setOrigen((o) => ({ ...o, sucursalId: id })); marcarRecalculo(0); }} />
                </div>
              ) : (
                <PuntoMapaPicker value={origen.punto} onChange={(punto) => { setOrigen((o) => ({ ...o, punto })); marcarRecalculo(0); }} />
              )}
              <p className="text-xs text-muted-foreground">Puedes salir desde una sucursal o desde cualquier dirección del mapa, incluido tu domicilio.</p>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label>Fecha de salida del origen</Label>
                  <DatePicker value={origen.fechaSalida || null} onChange={(f) => { setOrigen((o) => ({ ...o, fechaSalida: f ?? '' })); marcarRecalculo(0); }} placeholder="Elige la fecha de salida" />
                </div>
                <div className="space-y-1">
                  <Label>Hora de salida del origen</Label>
                  <TimePicker id="origen-hora" value={origen.horaSalida} onChange={(h) => { setOrigen((o) => ({ ...o, horaSalida: h })); marcarRecalculo(0); }} />
                </div>
              </div>
            </section>
          ) : null}

          {paso === 4 ? (
            <section data-testid="paso-4" className="space-y-4">
              <h2 className="font-semibold">Destinos ({destinos.length})</h2>
              <div className="flex flex-wrap gap-2" role="tablist" aria-label="Destinos del viaje">
                {destinos.map((d, i) => (
                  <Button key={d.id} type="button" size="sm" variant={i === indiceActual ? 'default' : 'outline'} onClick={() => setIndiceActual(i)}>
                    {i + 1}. {d.punto?.nombre ?? 'Sin destino'}
                    {d.cotizacion?.necesitaRecalculo ? ' · recalcula' : ''}
                  </Button>
                ))}
              </div>
              {destinoActual ? (
                <DestinoEditor
                  destino={destinoActual}
                  indice={indiceActual}
                  total={destinos.length}
                  modoTransporte={transporte.modo}
                  nombrePrevio={nombrePuntoPrevio(origen, destinos, indiceActual, sucursales)}
                  calculando={calculando}
                  errorTramo={errorTramo}
                  tramoListo={tramoListo}
                  onCambiar={(cambio, invalida) => actualizarDestino(indiceActual, cambio, invalida ?? true)}
                  onCalcular={() => calcularTramo(indiceActual)}
                  onElegir={(oferta) => elegirOferta(indiceActual, oferta)}
                  onEquipaje={(v) => setDestinos((actual) => actual.map((d, i) => (i === indiceActual && d.cotizacion ? { ...d, cotizacion: { ...d.cotizacion, equipajeDocumentado: v } } : d)))}
                  onQuitar={() => quitarDestino(indiceActual)}
                  onMover={(off) => moverDestino(indiceActual, off)}
                />
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" disabled={!puedeTerminar} onClick={agregarDestino}>
                  Agregar otro destino
                </Button>
                <Button type="button" disabled={!puedeTerminar} onClick={() => setPaso(5)}>
                  Terminar
                </Button>
              </div>
              {!puedeTerminar ? (
                <p className="text-xs text-muted-foreground">Elige una opción en cada tramo calculado (o calcula el tramo) antes de agregar otro destino o terminar.</p>
              ) : (
                <p className="text-xs text-muted-foreground">Terminar cierra la captura de destinos y abre el regreso; no envía la solicitud.</p>
              )}
            </section>
          ) : null}

          {paso === 5 ? (
            <section data-testid="paso-5" className="space-y-4">
              <h2 className="font-semibold">Regreso</h2>
              <SelectorModo
                ariaLabel="¿Necesitas regreso?"
                value={retorno.necesario ? 'con' : 'sin'}
                onChange={(id) => setRetorno((r) => ({ ...r, necesario: id === 'con' }))}
                options={[
                  { id: 'sin', titulo: 'Sin regreso' },
                  { id: 'con', titulo: 'Necesito regreso' },
                ]}
              />
              {retorno.necesario ? (
                <>
                  <p className="text-xs text-muted-foreground">Contrato provisional: salida y llegada requerida por separado (una sola «fecha de regreso» sigue sin definirse).</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <Label>Fecha de salida del regreso</Label>
                      <DatePicker value={retorno.saleFecha || null} onChange={(f) => setRetorno((r) => ({ ...r, saleFecha: f ?? '' }))} placeholder="Elige la fecha de salida" />
                    </div>
                    <div className="space-y-1">
                      <Label>Hora de salida del regreso</Label>
                      <TimePicker id="retorno-sale" value={retorno.saleHora} onChange={(h) => setRetorno((r) => ({ ...r, saleHora: h }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>Fecha en que debes estar de vuelta</Label>
                      <DatePicker value={retorno.llegadaRequeridaFecha || null} onChange={(f) => setRetorno((r) => ({ ...r, llegadaRequeridaFecha: f ?? '' }))} placeholder="Elige la fecha requerida" />
                    </div>
                    <div className="space-y-1">
                      <Label>Hora en que debes estar de vuelta</Label>
                      <TimePicker id="retorno-llega" value={retorno.llegadaRequeridaHora} onChange={(h) => setRetorno((r) => ({ ...r, llegadaRequeridaHora: h }))} />
                    </div>
                  </div>
                </>
              ) : null}
              <p className="text-sm text-muted-foreground">Rango del viaje (derivado): {rango.inicio ?? '—'} al {rango.fin ?? '—'}.</p>
            </section>
          ) : null}

          {paso === 6 ? (
            <section data-testid="paso-6" className="space-y-4">
              <h2 className="font-semibold">Viáticos y revisión</h2>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="monto-comidas">Comidas (MXN, monto abierto)</Label>
                  <Input id="monto-comidas" inputMode="decimal" value={comidas} onChange={(e) => setComidas(e.target.value)} placeholder="Ej. 1200" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Otros viáticos (MXN, montos abiertos, sin catálogo fijo)</Label>
                {extras.length === 0 ? <p className="text-xs text-muted-foreground">Sin otros viáticos.</p> : null}
                {extras.map((x) => (
                  <div key={x.id} className="flex flex-wrap items-center gap-2">
                    <Input aria-label="Concepto" value={x.concepto} onChange={(e) => setExtras((a) => a.map((y) => (y.id === x.id ? { ...y, concepto: e.target.value } : y)))} placeholder="Concepto" className="max-w-56" />
                    <Input aria-label="Monto en MXN" inputMode="decimal" value={x.monto} onChange={(e) => setExtras((a) => a.map((y) => (y.id === x.id ? { ...y, monto: e.target.value } : y)))} placeholder="Monto" className="max-w-40" />
                    <Button type="button" variant="outline" size="sm" onClick={() => setExtras((a) => a.filter((y) => y.id !== x.id))}>
                      Quitar
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => setExtras((a) => [...a, { id: `x-${Date.now()}`, concepto: '', monto: '' }])}>
                  Agregar otro viático
                </Button>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Revisión del itinerario</CardTitle>
                  <CardDescription>
                    {persona.nombre} · {transporte.modo === 'propio' ? 'Carro propio (Magna)' : 'Transporte solicitado'}
                    {transporte.compartir && acompanantesDisponibles.length > 0 ? ` · Compartido con ${acompanantesDisponibles.map((a) => a.nombreCompleto).join(', ')}` : ''}
                    {' · '}Rango: {rango.inicio ?? '—'} al {rango.fin ?? '—'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {transporte.modo === 'propio' ? (
                    <p className="text-muted-foreground">Usas tu carro durante todo el recorrido; cada tramo parte del punto anterior (el vehículo no se teletransporta).</p>
                  ) : null}
                  <ol className="list-decimal space-y-1 pl-5">
                    {destinos.map((d, i) => (
                      <li key={d.id}>
                        {nombrePuntoPrevio(origen, destinos, i, sucursales)} → {d.punto?.nombre ?? '—'} · estar ahí: {d.debeEstarFecha} {d.debeEstarHora} · sale: {d.saleFecha} {d.saleHora}
                        {d.cotizacion?.elegidaId ? (
                          <> · elegida: {d.cotizacion.ofertas.find((o) => o.id === d.cotizacion!.elegidaId)?.linea ?? d.cotizacion.elegidaId}</>
                        ) : transporte.modo === 'propio' ? (
                          <> · carro propio: {d.cotizacion?.rutaArmada ? mxn(d.cotizacion.rutaArmada.totales.subtotalMagna) : 'sin cálculo'}</>
                        ) : (
                          <> · sin cotización registrada</>
                        )}
                        {d.hospedaje.necesario ? <> · hotel: {d.hospedaje.hotel?.lugar ?? 'sin elegir'} ({d.hospedaje.fechaEntrada} al {d.hospedaje.fechaSalida})</> : null}
                      </li>
                    ))}
                  </ol>
                  {retorno.necesario ? (
                    <p>Regreso: sale {retorno.saleFecha} {retorno.saleHora} · estar de vuelta: {retorno.llegadaRequeridaFecha} {retorno.llegadaRequeridaHora}.</p>
                  ) : (
                    <p>Sin regreso.</p>
                  )}
                  <p>
                    Desglose: transporte {totalEstimado !== null ? mxn(totalTransporte) : 'no sumable'}
                    {' · '}comidas {montoComidas !== null && Number.isFinite(montoComidas) ? mxn(montoComidas) : '—'}
                    {' · '}otros {extras.length > 0 ? mxn(totalExtras) : '—'} (MXN; nunca se mezclan monedas).
                  </p>
                  <p className="font-semibold">
                    Total:{' '}
                    {totalEstimado !== null && montoComidas !== null && Number.isFinite(montoComidas)
                      ? mxn(totalTransporte + montoComidas + totalExtras)
                      : 'no sumable todavía (falta elegir o hay datos sin precio)'}
                  </p>
                  <p className="text-xs text-muted-foreground">Fechas en hora local del navegador. Zonas horarias de viaje pendientes de definir.</p>
                  {solicitudId === null ? (
                    <Button type="button" disabled={enviando || !puedeTerminar} onClick={enviarSolicitud}>
                      {enviando ? 'Enviando…' : 'Enviar solicitud'}
                    </Button>
                  ) : (
                    <p role="status" className="font-semibold">Solicitud {solicitudId} enviada. Calcular un tramo nunca envía; solo este botón envía.</p>
                  )}
                </CardContent>
              </Card>
            </section>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function DestinoEditor(props: {
  destino: DestinoV2;
  indice: number;
  total: number;
  modoTransporte: 'propio' | 'solicitado';
  nombrePrevio: string;
  calculando: boolean;
  errorTramo: string | null;
  tramoListo: boolean;
  onCambiar: (cambio: Partial<DestinoV2>, invalida?: boolean) => void;
  onCalcular: () => void;
  onElegir: (oferta: CostosRutaOferta) => void;
  onEquipaje: (v: boolean) => void;
  onQuitar: () => void;
  onMover: (off: -1 | 1) => void;
}) {
  const { destino, indice, total, modoTransporte, nombrePrevio } = props;
  const cot = destino.cotizacion;
  const elegida = cot?.ofertas.find((o) => o.id === cot.elegidaId) ?? null;

  return (
    <div role="group" aria-label={`Destino ${indice + 1}`} className="space-y-3 rounded-md border p-4">
      <p className="font-medium">Destino {indice + 1}: cualquier lugar, no solo hospitales</p>
      <div className="space-y-1">
        <Label>Destino (busca y elige un resultado con coordenadas)</Label>
        <PuntoMapaPicker value={destino.punto} onChange={(punto) => props.onCambiar({ punto })} />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <Label>Fecha en que debes estar ahí</Label>
          <DatePicker value={destino.debeEstarFecha || null} onChange={(f) => props.onCambiar({ debeEstarFecha: f ?? '' })} placeholder="Elige la fecha requerida" />
        </div>
        <div className="space-y-1">
          <Label>Hora en que debes estar ahí (límite, no llegada programada)</Label>
          <TimePicker id={`dest-${destino.id}-debe`} value={destino.debeEstarHora} onChange={(h) => props.onCambiar({ debeEstarHora: h })} />
        </div>
        <div className="space-y-1">
          <Label>Fecha de salida de ese destino</Label>
          <DatePicker value={destino.saleFecha || null} onChange={(f) => props.onCambiar({ saleFecha: f ?? '' })} placeholder="Elige la fecha de salida" />
        </div>
        <div className="space-y-1">
          <Label>Hora de salida de ese destino</Label>
          <TimePicker id={`dest-${destino.id}-sale`} value={destino.saleHora} onChange={(h) => props.onCambiar({ saleHora: h })} />
        </div>
      </div>

      <div className="space-y-2 rounded-md bg-muted/30 p-3">
        <div className="flex items-center gap-2">
          <Checkbox
            id={`hotel-${destino.id}`}
            checked={destino.hospedaje.necesario}
            onCheckedChange={(v) => props.onCambiar({ hospedaje: { ...destino.hospedaje, necesario: v === true } })}
          />
          <Label htmlFor={`hotel-${destino.id}`}>Necesito hospedaje</Label>
        </div>
        {destino.hospedaje.necesario ? (
          <>
            <div className="space-y-1">
              <Label htmlFor={`zona-${destino.id}`}>Hospedaje cerca de</Label>
              <select
                id={`zona-${destino.id}`}
                className="h-9 w-full rounded-md border bg-background px-3"
                value={destino.hospedaje.zona}
                onChange={(e) => props.onCambiar({ hospedaje: { ...destino.hospedaje, zona: e.target.value as 'anterior' | 'actual' } })}
              >
                <option value="anterior">{nombrePrevio}</option>
                <option value="actual">{destino.punto?.nombre ?? `Destino ${indice + 1}`}</option>
              </select>
              <p className="text-xs text-muted-foreground">La zona orienta la búsqueda; si el hospedaje va antes o después de la visita lo decide la cronología.</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label>Entrada al hotel</Label>
                <DatePicker value={destino.hospedaje.fechaEntrada || null} onChange={(f) => props.onCambiar({ hospedaje: { ...destino.hospedaje, fechaEntrada: f ?? '' } })} placeholder="Elige la entrada" />
              </div>
              <div className="space-y-1">
                <Label>Salida del hotel</Label>
                <DatePicker value={destino.hospedaje.fechaSalida || null} onChange={(f) => props.onCambiar({ hospedaje: { ...destino.hospedaje, fechaSalida: f ?? '' } })} placeholder="Elige la salida" />
              </div>
            </div>
            {cot && cot.hoteles.length > 0 ? (
              <>
                <TablaHoteles hoteles={cot.hoteles} />
                <div className="space-y-1">
                  <Label htmlFor={`hotel-elegido-${destino.id}`}>Hotel elegido (punto de la ruta)</Label>
                  <select
                    id={`hotel-elegido-${destino.id}`}
                    className="h-9 w-full rounded-md border bg-background px-3"
                    value={destino.hospedaje.hotel ? `${destino.hospedaje.hotel.lugar} en ${destino.hospedaje.hotel.ciudad}` : ''}
                    onChange={(e) => {
                      const hotel = cot.hoteles.find((h) => `${h.lugar} en ${h.ciudad}` === e.target.value) ?? null;
                      props.onCambiar({ hospedaje: { ...destino.hospedaje, hotel } }, false);
                    }}
                  >
                    <option value="">Sin elegir</option>
                    {cot.hoteles.map((h) => (
                      <option key={`${h.lugar}-${h.ciudad}`} value={`${h.lugar} en ${h.ciudad}`}>
                        {h.lugar} en {h.ciudad} · {h.noches} noche(s)
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">Tarifa de tabulador (estimación, no cotización con disponibilidad en vivo).</p>
                </div>
              </>
            ) : null}
          </>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={!props.tramoListo || props.calculando} onClick={props.onCalcular}>
          {props.calculando ? 'Calculando…' : 'Calcular este tramo'}
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={indice === 0} onClick={() => props.onMover(-1)}>
          Subir destino
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={indice === total - 1} onClick={() => props.onMover(1)}>
          Bajar destino
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={total === 1} onClick={props.onQuitar}>
          Eliminar destino
        </Button>
      </div>
      {props.errorTramo ? <p role="alert" className="text-sm text-destructive">{props.errorTramo}</p> : null}

      {cot ? (
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">
            Cotizado el {new Date(cot.cotizadoEn).toLocaleString('es-MX')}.
            {cot.necesitaRecalculo ? <Badge variant="destructive" className="ml-2">Necesita recálculo: algo cambió aguas arriba</Badge> : null}
          </div>
          {modoTransporte === 'propio' && cot.rutaArmada ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Carro propio (Magna) · {cot.rutaArmada.totales.km} km</CardTitle>
                <CardDescription>
                  {cot.rutaArmada.totales.litros} L · Combustible {mxn(cot.rutaArmada.totales.subtotalMagna - cot.rutaArmada.totales.casetas)} + casetas {mxn(cot.rutaArmada.totales.casetas)} = {mxn(cot.rutaArmada.totales.subtotalMagna)}
                </CardDescription>
              </CardHeader>
            </Card>
          ) : null}
          {modoTransporte === 'solicitado' ? (
            cot.ofertas.length === 0 ? (
              <p role="status" className="text-sm">Sin opciones de transporte para este tramo. Puedes continuar; el tramo queda marcado sin cotización.</p>
            ) : (
              <>
                <TablaOpciones
                  titulo={`Opciones del tramo ${indice + 1}`}
                  ofertas={cot.ofertas.slice(0, 8)}
                  opcionElegidaId={cot.elegidaId}
                  onElegir={props.onElegir}
                />
                {elegida && esOfertaVuelo(elegida) ? (
                  <div className="flex items-center gap-2">
                    <Checkbox id={`equipaje-${destino.id}`} checked={cot.equipajeDocumentado} onCheckedChange={(v) => props.onEquipaje(v === true)} />
                    <Label htmlFor={`equipaje-${destino.id}`}>Viajo con equipaje documentado (no cambia el precio cotizado)</Label>
                  </div>
                ) : null}
              </>
            )
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default SolicitudPage;
