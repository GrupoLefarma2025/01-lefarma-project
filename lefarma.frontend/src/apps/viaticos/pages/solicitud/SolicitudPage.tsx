import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { folderTabClassName } from '@/components/ui/folder-tab';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Info, Plus, UserRound } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { CheckboxAnimado } from '../../components/CheckboxAnimado';
import { WizardStepper } from '../../components/WizardStepper';
import '../../components/wizard-motion.css';
import { usePageTitle } from '@/hooks/usePageTitle';
import { toast } from 'sonner';
import { toApiError } from '@/utils/errors';
import { useAuthStore } from '@/shared/auth/authStore';
import { CatalogoSearchSelect } from '@/apps/educacion-medica/components/CatalogoSearchSelect';
import type { UsuarioCatalogo } from '@/apps/educacion-medica/types/educacionMedica.types';
import { educacionMedicaApi } from '@/apps/educacion-medica/services/educacionMedica.api';
import { solicitudesApi } from '../../services/solicitudes.api';
import { geocodificarReversa } from '../../services/geocodificar.api';
import { hidratarSolicitud } from '../../services/solicitudDraft';
import type { CrearSolicitudPayload } from '../../types/solicitud.types';
import type {
  AcompananteV2,
  DestinoV2,
  OrigenV2,
  PasoPersonaV2,
  PasoTransporteV2,
  RetornoV2,
} from '../../types/wizardV2.types';
import { adaptarTramoACostosRuta, rangoDelViaje } from '../../services/solicitudWizard.adapter';
import {
  CONFIG_VIATICOS_STORAGE_KEY,
  leerConfigViaticos,
  type ConfigViaticos,
} from '../../services/configViaticos';
import { PuntoMapaPicker } from '../../components/PuntoMapaPicker';
import { MapaPunto } from '../../components/MapaPunto';
import { ResumenViaje } from '../../components/ResumenViaje';
import { DateTimePicker } from '../../components/DateTimePicker';
import { VIATICOS_FIXTURES_ACTIVOS, rellenarConFixture } from '../../test/fixtures/solicitudV2.fixture';

const PASOS = [
  { id: 1, titulo: 'Persona' },
  { id: 2, titulo: 'Motivo' },
  { id: 3, titulo: 'Transporte' },
  { id: 4, titulo: 'Origen' },
  { id: 5, titulo: 'Destinos' },
  { id: 6, titulo: 'Regreso' },
  { id: 7, titulo: 'Resumen' },
] as const;

type PasoId = (typeof PASOS)[number]['id'];

const PULSO_AGREGAR_CSS = `
@keyframes agregar-pulso {
  0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.45); }
  50% { transform: scale(1.06); box-shadow: 0 0 0 8px rgba(37, 99, 235, 0); }
}
.agregar-pulso { animation: agregar-pulso 0.9s ease-in-out 2; }
@media (prefers-reduced-motion: reduce) { .agregar-pulso { animation: none; } }
`;

/** Momento actual en hora local con el formato de los pickers (yyyy-MM-ddTHH:mm). */
function ahoraLocal(): string {
  const d = new Date();
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}T${dos(d.getHours())}:${dos(d.getMinutes())}`;
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

/** Pestaña del destino: nombre propio; si no, municipio/estado o el nombre del punto. */
function etiquetaDestino(destino: DestinoV2): string {
  const personalizada = destino.etiqueta?.trim();
  if (personalizada) return personalizada;
  const punto = destino.punto;
  if (!punto) return 'Sin destino';
  const partes = [punto.municipio, punto.estado].filter(
    (valor): valor is string => typeof valor === 'string' && valor.trim() !== '',
  );
  return partes.length > 0 ? partes.join(', ') : punto.nombre;
}


function minutosDeHora(hora: string): number | null {
  const [h, m] = hora.split(':').map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
}

interface ComidaCalculo {
  completos: number;
  medios: number;
  monto: number;
}

/**
 * Comida por día del viaje: día completo salvo que el primer día empiece
 * después de mediodía, el último termine antes de las 14:00 o el viaje de un
 * solo día dure menos de 6 horas. Se cuentan todos los días del rango.
 */
function calcularComidas(
  rango: { inicio: string | null; fin: string | null },
  origen: OrigenV2,
  destinos: DestinoV2[],
  retorno: RetornoV2,
  config: ConfigViaticos,
): ComidaCalculo {
  const valorMedia = Number(config.comidaMedia) || 0;
  const valorCompleta = Number(config.comidaCompleta) || 0;
  const esFecha = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
  if (!rango.inicio || !rango.fin || !esFecha(rango.inicio) || !esFecha(rango.fin) || rango.inicio > rango.fin) {
    return { completos: 0, medios: 0, monto: 0 };
  }
  const horaInicio = origen.fechaSalida === rango.inicio
    ? origen.horaSalida
    : destinos.find((d) => d.debeEstarFecha === rango.inicio)?.debeEstarHora ?? '';
  const horaFin = retorno.llegadaRequeridaFecha === rango.fin
    ? retorno.llegadaRequeridaHora
    : [...destinos].reverse().find((d) => d.saleFecha === rango.fin)?.saleHora ?? '';
  const inicioMin = minutosDeHora(horaInicio);
  const finMin = minutosDeHora(horaFin);
  let completos = 0;
  let medios = 0;
  const dos = (n: number) => String(n).padStart(2, '0');
  const cursor = new Date(`${rango.inicio}T12:00:00`);
  const fin = new Date(`${rango.fin}T12:00:00`);
  while (cursor <= fin) {
    const dia = `${cursor.getFullYear()}-${dos(cursor.getMonth() + 1)}-${dos(cursor.getDate())}`;
    if (rango.inicio === rango.fin) {
      const medio = (inicioMin !== null && inicioMin >= 12 * 60)
        || (finMin !== null && finMin <= 14 * 60)
        || (inicioMin !== null && finMin !== null && finMin - inicioMin < 6 * 60);
      if (medio) medios += 1; else completos += 1;
    } else if (dia === rango.inicio) {
      if (inicioMin !== null && inicioMin >= 12 * 60) medios += 1; else completos += 1;
    } else if (dia === rango.fin) {
      if (finMin !== null && finMin <= 14 * 60) medios += 1; else completos += 1;
    } else {
      completos += 1;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return { completos, medios, monto: completos * valorCompleta + medios * valorMedia };
}

export function SolicitudPage() {
  usePageTitle('Solicitud de viáticos', 'Viáticos');
  const navigate = useNavigate();
  const { id: idParam } = useParams();
  const nombreSesion = useAuthStore((s) => s.user?.nombre);
  const idSesion = useAuthStore((s) => s.user?.id);

  const [paso, setPaso] = useState<PasoId>(1);
  // Paso más lejano alcanzado: al volver atrás, lo visitado se sigue viendo
  // hecho y se puede saltar adelante de nuevo sin revalidar todo.
  const [maxPaso, setMaxPaso] = useState<PasoId>(1);
  useEffect(() => {
    setMaxPaso((m) => (paso > m ? paso : m));
  }, [paso]);
  // Cada cambio de paso (Siguiente, Atrás o stepper) regresa al inicio del wizard.
  const inicioPasoRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const scroller = inicioPasoRef.current?.closest('main');
    if (scroller) {
      scroller.scrollTop = 0;
    } else {
      inicioPasoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [paso]);

  const [persona, setPersona] = useState<PasoPersonaV2>({ modo: 'mia', empleadoId: null, nombre: '', motivo: '' });
  const [transporte, setTransporte] = useState<PasoTransporteV2>({ modo: 'solicitado', compartir: false, acompanantes: [] });
  const [origen, setOrigen] = useState<OrigenV2>({ punto: null, fechaSalida: '', horaSalida: '' });
  const [destinos, setDestinos] = useState<DestinoV2[]>(() => [nuevoDestino()]);
  const [indiceActual, setIndiceActual] = useState(0);
  const [pulsarAgregar, setPulsarAgregar] = useState(false);
  const [configViaticos, setConfigViaticos] = useState<ConfigViaticos>(leerConfigViaticos);
  // La configuración de comidas/horario se edita en /viaticos/configuracion;
  // si cambia en otra pestaña, se refleja aquí y se invalidan los tramos.
  useEffect(() => {
    const alCambiarConfig = (evento: StorageEvent) => {
      if (evento.key !== CONFIG_VIATICOS_STORAGE_KEY) return;
      const siguiente = leerConfigViaticos();
      const horasCambiaron = siguiente.horaEntrada !== configViaticos.horaEntrada
        || siguiente.horaSalida !== configViaticos.horaSalida;
      setConfigViaticos(siguiente);
      if (horasCambiaron) {
        setDestinos((actual) =>
          actual.map((d) => (d.cotizacion ? { ...d, cotizacion: { ...d.cotizacion, necesitaRecalculo: true } } : d)),
        );
      }
    };
    window.addEventListener('storage', alCambiarConfig);
    return () => window.removeEventListener('storage', alCambiarConfig);
  }, [configViaticos.horaEntrada, configViaticos.horaSalida]);
  // Pestaña en edición (doble clic) y borrador del nombre propio.
  const [renombrando, setRenombrando] = useState<number | null>(null);
  const [textoRenombre, setTextoRenombre] = useState('');
  const cancelarRenombreRef = useRef(false);
  const [retorno, setRetorno] = useState<RetornoV2>({ necesario: true, llegadaRequeridaFecha: '', llegadaRequeridaHora: '', destino: 'origen', punto: null });
  const [enviando, setEnviando] = useState(false);
  const [solicitudEditando, setSolicitudEditando] = useState<{ id: number; folio: string | null } | null>(null);
  const [cargandoBorrador, setCargandoBorrador] = useState(false);

  // Edición de un borrador: /viaticos/solicitud/:id hidrata el wizard desde el
  // snapshot guardado. Solo se permite si sigue en borrador y es del usuario.
  useEffect(() => {
    const id = Number(idParam);
    if (!Number.isFinite(id) || id <= 0) return;

    let cancelado = false;
    setCargandoBorrador(true);
    void (async () => {
      try {
        const res = await solicitudesApi.detalle(id);
        if (cancelado) return;
        if (!res.data.success || !res.data.data) {
          toast.error(res.data.message ?? 'No se pudo cargar el borrador.');
          navigate('/viaticos/mis-viajes');
          return;
        }
        if (res.data.data.estado !== 'borrador') {
          toast.error('Solo se pueden editar solicitudes en borrador.');
          navigate('/viaticos/mis-viajes');
          return;
        }
        const datos = hidratarSolicitud(res.data.data.datos);
        if (!datos) {
          toast.error('El borrador no tiene un formato reconocible.');
          navigate('/viaticos/mis-viajes');
          return;
        }
        setPersona(datos.persona);
        setTransporte(datos.transporte);
        setOrigen(datos.origen);
        setDestinos(datos.destinos);
        setRetorno(datos.retorno);
        setIndiceActual(0);
        setSolicitudEditando({ id: res.data.data.id_solicitud, folio: res.data.data.folio ?? null });
      } catch (falla: unknown) {
        toast.error(toApiError(falla).message || 'No se pudo cargar el borrador.');
        navigate('/viaticos/mis-viajes');
      } finally {
        if (!cancelado) setCargandoBorrador(false);
      }
    })();
    return () => { cancelado = true; };
  }, [idParam, navigate]);

  // Alto real de la barra de pasos (sticky): la barra de búsqueda del mapa se
  // pega justo debajo en vez de encimársele.
  const navRef = useRef<HTMLElement | null>(null);
  const [altoNav, setAltoNav] = useState(56);
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const medir = () => setAltoNav(nav.offsetHeight || 56);
    medir();
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  }, []);

  const [empleados, setEmpleados] = useState<UsuarioCatalogo[]>([]);
  const [cargandoEmp, setCargandoEmp] = useState(false);
  const [errorEmp, setErrorEmp] = useState('');

  // "Para mí" toma el nombre de la sesión; no se vuelve a pedir.
  useEffect(() => {
    if (persona.modo === 'mia' && nombreSesion && !persona.nombre) {
      setPersona((p) => ({ ...p, nombre: nombreSesion }));
    }
  }, [nombreSesion, persona.modo, persona.nombre]);

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

  function actualizarDestino(id: string, cambio: Partial<DestinoV2>, invalida = true) {
    const indice = destinos.findIndex((d) => d.id === id);
    setDestinos((actual) => actual.map((d) => (d.id === id ? { ...d, ...cambio } : d)));
    if (invalida && indice >= 0) marcarRecalculo(indice);
  }

  const destinoActual = destinos[indiceActual];

  /** Un destino está listo con punto y llegada; la salida es opcional. */
  function destinoCompleto(d: DestinoV2): boolean {
    if (!d.punto || !d.debeEstarFecha || !d.debeEstarHora) return false;
    const llegada = `${d.debeEstarFecha}T${d.debeEstarHora}`;
    if (origen.fechaSalida && origen.horaSalida && llegada < `${origen.fechaSalida}T${origen.horaSalida}`) return false;
    return !(d.saleFecha && d.saleHora && `${d.saleFecha}T${d.saleHora}` < llegada);
  }

  const puedeAvanzar = destinos.length > 0 && destinos.every(destinoCompleto);

  // Pulso breve del tab Agregar cuando ya se puede agregar otro destino.
  useEffect(() => {
    if (paso !== 5 || !puedeAvanzar) return;
    setPulsarAgregar(true);
    const id = window.setTimeout(() => setPulsarAgregar(false), 2000);
    return () => window.clearTimeout(id);
  }, [paso, puedeAvanzar]);

  function agregarDestino() {
    if (!puedeAvanzar) return;
    setDestinos((actual) => [...actual, nuevoDestino()]);
    setIndiceActual(destinos.length);
  }

  /** Doble clic en una pestaña: edita su nombre propio sin invalidar la cotización. */
  function abrirRenombre(indice: number) {
    const destino = destinos[indice];
    if (!destino) return;
    cancelarRenombreRef.current = false;
    setRenombrando(indice);
    setTextoRenombre(etiquetaDestino(destino));
  }

  function cancelarRenombre() {
    cancelarRenombreRef.current = true;
    setRenombrando(null);
    setTextoRenombre('');
  }

  function confirmarRenombre(indice: number) {
    // El blur que dispara Escape no debe guardar: lo cancela el ref.
    if (cancelarRenombreRef.current) {
      cancelarRenombreRef.current = false;
      return;
    }
    const destino = destinos[indice];
    if (destino) actualizarDestino(destino.id, { etiqueta: textoRenombre.trim() }, false);
    setRenombrando(null);
    setTextoRenombre('');
  }

  // ---- validaciones por paso ----
  /**
   * Motivo visible sobre «Siguiente» cuando el paso 4 no puede avanzar. La
   * fecha de salida es opcional (el motor la calcula); el punto de salida no.
   */
  function motivoPaso4(): string | null {
    if (paso !== 4) return null;
    const punto = origen.punto;
    if (!punto || !punto.nombre.trim()) return 'Marca el punto de salida en el mapa.';
    if (!Number.isFinite(punto.latitud) || !Number.isFinite(punto.longitud) || (punto.latitud === 0 && punto.longitud === 0)) {
      return 'El punto de salida no tiene coordenadas válidas.';
    }
    if (Boolean(origen.fechaSalida) !== Boolean(origen.horaSalida)) {
      return 'Completa la hora de salida o deja la fecha vacía.';
    }
    if (origen.fechaSalida && origen.horaSalida && `${origen.fechaSalida}T${origen.horaSalida}` < ahoraLocal()) {
      return 'La fecha y hora de salida ya pasaron.';
    }
    return null;
  }

  function pasoValido(id: PasoId): boolean {
    if (id === 1) {
      if (persona.modo === 'otra' && persona.empleadoId === null) return false;
      return persona.nombre.trim() !== '';
    }
    if (id === 2) return persona.motivo.trim() !== '';
    if (id === 3) return true;
    if (id === 4) {
      // La salida del origen no puede quedar en el pasado (mismo límite que el picker).
      if (origen.fechaSalida && origen.horaSalida && `${origen.fechaSalida}T${origen.horaSalida}` < ahoraLocal()) return false;
      const { request } = adaptarTramoACostosRuta({
        nombreViajero: persona.nombre || 'viajero',
        modoTransporte: transporte.modo,
        origen,
        destino: { ...nuevoDestino(), punto: { nombre: 'x', latitud: 19.5, longitud: -99.5 }, debeEstarFecha: '2026-11-10', debeEstarHora: '12:00', saleFecha: '2026-11-10', saleHora: '18:00' },
      });
      return request !== null;
    }
    if (id === 5) return puedeAvanzar;
    if (id === 6) {
      return retorno.destino === 'origen' || retorno.punto !== null;
    }
    return true;
  }

  const rango = rangoDelViaje(origen, destinos, retorno);
  const { inicio: rangoInicio, fin: rangoFin } = rango;

  const comidasCalculadas = useMemo(
    () => calcularComidas({ inicio: rangoInicio, fin: rangoFin }, origen, destinos, retorno, configViaticos),
    [rangoInicio, rangoFin, origen, destinos, retorno, configViaticos],
  );
  const montoComidas = comidasCalculadas.monto;

  function construirDatos() {
    return {
      version: 'solicitud-v2',
      persona,
      transporte,
      origen,
      destinos: destinos.map((d) => ({
        etiqueta: d.etiqueta ?? null,
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
      gastos: { comidas: montoComidas, extras: [] },
      rango,
    };
  }

  async function guardarBorrador() {
    if (enviando) return;
    const payload: CrearSolicitudPayload = { datos: construirDatos() };
    setEnviando(true);
    try {
      if (solicitudEditando) {
        const actualizada = await solicitudesApi.actualizar(solicitudEditando.id, payload);
        if (!actualizada.data.success) {
          toast.error(actualizada.data.message ?? 'No se pudo actualizar el borrador.');
          return;
        }
        toast.success(`Borrador ${actualizada.data.data?.folio ?? solicitudEditando.folio ?? ''} actualizado.`);
      } else {
        const creada = await solicitudesApi.crear(payload);
        if (!creada.data.success || !creada.data.data) {
          toast.error(creada.data.message ?? 'No se pudo guardar el borrador.');
          return;
        }
        toast.success(`Solicitud ${creada.data.data.folio ?? creada.data.data.id_solicitud} guardada como borrador.`);
      }
      navigate('/viaticos/mis-viajes');
    } catch (falla: unknown) {
      toast.error(toApiError(falla).message || 'No se pudo guardar el borrador.');
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
  const motivoSiguiente = motivoPaso4();

  if (cargandoBorrador) {
    return (
      <div className="mx-auto max-w-6xl p-6">
        <p role="status" className="text-sm text-muted-foreground">Cargando borrador…</p>
      </div>
    );
  }

  return (
    <div ref={inicioPasoRef} className="mx-auto max-w-6xl space-y-4">
      {VIATICOS_FIXTURES_ACTIVOS ? <IndicadorDatosPrueba /> : null}
      <Card>
        <CardHeader>
          <CardTitle className="tracking-tight">
            {solicitudEditando
              ? `Editar solicitud${solicitudEditando.folio ? ` ${solicitudEditando.folio}` : ''}`
              : 'Solicitud de viáticos'}
          </CardTitle>
        </CardHeader>
        {/* Identidad de quien solicita: visible arriba del wizard en todos los pasos. */}
        <div className="border-b px-6 pb-4">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm shadow-[0_2px_10px_rgba(15,23,42,0.10)]">
            <UserRound className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            <span className="text-muted-foreground">Persona que solicita el viaje:</span>
            <strong className="font-semibold text-primary">{persona.nombre || '—'}</strong>
            <span className="text-muted-foreground">
              {' · '}
              {persona.modo === 'mia' ? 'Para mí' : 'Para alguien más'}
            </span>
          </p>
        </div>
        <CardContent className="space-y-4">
          {VIATICOS_FIXTURES_ACTIVOS ? (
            <div>
              <Button type="button" variant="outline" onClick={aplicarFixture}>
                Rellenar con datos de prueba
              </Button>
            </div>
          ) : null}

          <nav ref={navRef} aria-label="Avance de la solicitud" className="sticky top-0 z-20 -mx-6 border-b bg-background/95 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:py-2.5">
            <WizardStepper
              pasos={PASOS.map(({ id, titulo }) => ({ id, titulo }))}
              actual={paso}
              alcanzado={maxPaso}
              onSelect={(id) => setPaso(id as PasoId)}
            />
          </nav>

          {/* `key={paso}`: cada paso monta fresco y corre la entrada una vez. */}
          <div key={paso} className="wizard-paso">
          {paso === 1 ? (
            <section data-testid="paso-1" className="space-y-4">
              <h2 className="font-semibold">Persona que solicita el viaje</h2>
              <div className="grid gap-4 sm:grid-cols-2 max-w-2xl mx-auto" role="radiogroup" aria-label="Persona que solicita el viaje">
                <button
                  type="button"
                  role="radio"
                  aria-checked={persona.modo === 'mia'}
                  aria-label="Para mí"
                  onClick={() => setPersona((p) => ({ ...p, modo: 'mia', empleadoId: null, nombre: nombreSesion ?? p.nombre }))}
                  className={cn(
                    'flex flex-col items-center gap-2 rounded-2xl border-2 p-6 text-center transition-[transform,box-shadow,border-color,background-color] duration-150 ease-out active:scale-[0.97]',
                    persona.modo === 'mia'
                      ? 'border-primary bg-primary/10 shadow-md scale-[1.01]'
                      : 'border-border bg-background hover:border-primary/40 hover:bg-primary/5'
                  )}
                >
                  <span className="text-4xl" aria-hidden="true">🧍</span>
                  <span className="font-semibold text-base">Para mí</span>
                  <span className="text-xs text-muted-foreground">Yo soy quien viaja.</span>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={persona.modo === 'otra'}
                  aria-label="Para alguien más"
                  onClick={() => setPersona((p) => ({ ...p, modo: 'otra', empleadoId: null, nombre: '' }))}
                  className={cn(
                    'flex flex-col items-center gap-2 rounded-2xl border-2 p-6 text-center transition-[transform,box-shadow,border-color,background-color] duration-150 ease-out active:scale-[0.97]',
                    persona.modo === 'otra'
                      ? 'border-primary bg-primary/10 shadow-md scale-[1.01]'
                      : 'border-border bg-background hover:border-primary/40 hover:bg-primary/5'
                  )}
                >
                  <span className="text-4xl" aria-hidden="true">👥</span>
                  <span className="font-semibold text-base">Para alguien más</span>
                  <span className="text-xs text-muted-foreground">Capturo el viaje de otro empleado.</span>
                </button>
              </div>
              {persona.modo === 'otra' ? (
                <div className="space-y-1">
                  <Label>Empleado que viaja</Label>
                  <CatalogoSearchSelect items={empleadoItems} value={persona.empleadoId} disabled={cargandoEmp || !!errorEmp} placeholder="Buscar y seleccionar empleado" onChange={elegirEmpleado} />
                  {cargandoEmp ? <p role="status" className="text-xs">Cargando empleados…</p> : null}
                  {errorEmp ? <p role="alert" className="text-xs text-destructive">{errorEmp}</p> : null}
                </div>
              ) : null}
            </section>
          ) : null}

          {paso === 2 ? (
            <section data-testid="paso-2" className="space-y-4">
              <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-background to-background p-5 space-y-3 shadow-sm">
                <div className="flex items-start gap-3">
                  <span className="text-3xl" aria-hidden="true">✈️</span>
                  <div className="space-y-0.5">
                    <h2 className="font-semibold text-base">Motivo del viaje</h2>
                  </div>
                </div>
                <Label htmlFor="motivo-viaje" className="sr-only">Motivo del viaje</Label>
                <Textarea
                  id="motivo-viaje"
                  value={persona.motivo}
                  onChange={(e) => setPersona((p) => ({ ...p, motivo: e.target.value }))}
                  placeholder="Ej. Visita de seguimiento a la zona, capacitación a personal, supervisión de sucursal, comisión de trabajo…"
                  rows={4}
                  className="resize-none bg-background/90 border-primary/20 focus-visible:ring-primary/40"
                />
              </div>
            </section>
          ) : null}

          {paso === 3 ? (
            <section data-testid="paso-3" className="space-y-4">
              <h2 className="font-semibold">Transporte y viaje compartido</h2>
              <div className="grid gap-4 sm:grid-cols-2 max-w-2xl mx-auto" role="radiogroup" aria-label="Modo de transporte">
                <button
                  type="button"
                  role="radio"
                  aria-checked={transporte.modo === 'propio'}
                  aria-label="Carro propio"
                  onClick={() => setTransporte((t) => ({ ...t, modo: 'propio' }))}
                  className={cn(
                    'flex flex-col items-center gap-2 rounded-2xl border-2 p-6 text-center transition-[transform,box-shadow,border-color,background-color] duration-150 ease-out active:scale-[0.97]',
                    transporte.modo === 'propio'
                      ? 'border-primary bg-primary/10 shadow-md scale-[1.01]'
                      : 'border-border bg-background hover:border-primary/40 hover:bg-primary/5'
                  )}
                >
                  <span className="text-4xl" aria-hidden="true">🚗</span>
                  <span className="font-semibold text-base">Carro propio</span>
                  <span className="text-xs text-muted-foreground">Verás distancia y costo de combustible por tramo; las casetas se conservan.</span>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={transporte.modo === 'solicitado'}
                  aria-label="Solicitar transporte"
                  onClick={() => setTransporte((t) => ({ ...t, modo: 'solicitado' }))}
                  className={cn(
                    'flex flex-col items-center gap-2 rounded-2xl border-2 p-6 text-center transition-[transform,box-shadow,border-color,background-color] duration-150 ease-out active:scale-[0.97]',
                    transporte.modo === 'solicitado'
                      ? 'border-primary bg-primary/10 shadow-md scale-[1.01]'
                      : 'border-border bg-background hover:border-primary/40 hover:bg-primary/5'
                  )}
                >
                  <span className="text-4xl" aria-hidden="true">🚌</span>
                  <span className="font-semibold text-base">Solicitar transporte</span>
                  <span className="text-xs text-muted-foreground">Se calcula por cada tramo antes de continuar.</span>
                </button>
              </div>
              <CheckboxAnimado
                id="compartir-viaje"
                checked={transporte.compartir}
                onCheckedChange={(v) => setTransporte((t) => ({ ...t, compartir: v }))}
              >
                Compartir viaje
              </CheckboxAnimado>
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

          {paso === 4 ? (
            <section data-testid="paso-4" className="space-y-4">
              <h2 className="text-lg font-semibold tracking-tight">Origen del viaje</h2>
              <div className="space-y-1.5 rounded-lg border border-primary/30 bg-primary/5 p-3">
                <Label htmlFor="origen-fechahora" className="text-base font-semibold">
                  Fecha y hora de salida del origen (opcional)
                </Label>
                <DateTimePicker
                  id="origen-fechahora"
                  fecha={origen.fechaSalida}
                  hora={origen.horaSalida}
                  onFecha={(f) => { setOrigen((o) => ({ ...o, fechaSalida: f })); marcarRecalculo(0); }}
                  onHora={(h) => { setOrigen((o) => ({ ...o, horaSalida: h })); marcarRecalculo(0); }}
                  placeholder="Elige fecha y hora de salida"
                />
              </div>
              {/* Mapa compartido con la búsqueda flotando dentro: refleja y permite fijar el punto de salida. */}
              <div className="relative">
                <MapaPunto
                  punto={origen.punto}
                  interactivo
                  pie="Puedes salir desde cualquier dirección del mapa, incluido tu domicilio. Clic para fijar el pin · Ctrl para mover el mapa · Clic derecho abre el menú."
                  onQuitar={() => {
                    setOrigen((o) => (o.punto ? { ...o, punto: null } : o));
                    marcarRecalculo(0);
                  }}
                  onPunto={(latitud, longitud) => {
                    setOrigen((o) => ({
                      ...o,
                      punto: { nombre: o.punto?.nombre?.trim() || 'Punto seleccionado en mapa', latitud, longitud },
                    }));
                    marcarRecalculo(0);
                    // Completa estado/municipio con geocodificación inversa; solo
                    // aplica si el pin no se movió mientras respondía.
                    void geocodificarReversa(latitud, longitud).then((resuelto) => {
                      if (!resuelto) return;
                      setOrigen((o) =>
                        o.punto && o.punto.latitud === latitud && o.punto.longitud === longitud
                          ? { ...o, punto: resuelto }
                          : o,
                      );
                    });
                  }}
                  onMover={(latitud, longitud) => {
                    setOrigen((o) =>
                      o.punto
                        ? { ...o, punto: { ...o.punto, latitud, longitud, estado: undefined, municipio: undefined } }
                        : o,
                    );
                    marcarRecalculo(0);
                    void geocodificarReversa(latitud, longitud).then((resuelto) => {
                      if (!resuelto) return;
                      setOrigen((o) =>
                        o.punto && o.punto.latitud === latitud && o.punto.longitud === longitud
                          ? { ...o, punto: resuelto }
                          : o,
                      );
                    });
                  }}
                />
                <PuntoMapaPicker flotante ocultarMapa value={origen.punto} onChange={(punto) => {
                  // La geocodificación inversa solo cambia el nombre/estado: si
                  // las coordenadas no se movieron, no hay nada que recalcular.
                  const mismoPunto = origen.punto?.latitud === punto?.latitud && origen.punto?.longitud === punto?.longitud;
                  setOrigen((o) => ({ ...o, punto }));
                  if (!mismoPunto) marcarRecalculo(0);
                }} />
              </div>
            </section>
          ) : null}

          {paso === 5 ? (
            <section data-testid="paso-5" className="space-y-4">
              <style>{PULSO_AGREGAR_CSS}</style>
              <div className="flex items-center gap-1.5">
                <h2 className="font-semibold">Destinos ({destinos.length})</h2>
                <TooltipProvider delayDuration={150}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        aria-label="Cómo cambiar el nombre de los destinos"
                        className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        <Info className="h-4 w-4" aria-hidden />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Doble clic en una pestaña para cambiar el nombre.</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div>
                <div className="flex flex-wrap items-end gap-1">
                  <div role="tablist" aria-label="Destinos del viaje" className="flex flex-wrap items-end gap-1">
                    {destinos.map((d, i) =>
                      renombrando === i ? (
                        <div key={d.id} role="presentation" className="inline-flex">
                          <Input
                            autoFocus
                            aria-label={`Nombre de la pestaña del destino ${i + 1}`}
                            value={textoRenombre}
                            onChange={(e) => setTextoRenombre(e.target.value)}
                            onBlur={() => confirmarRenombre(i)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                confirmarRenombre(i);
                              } else if (e.key === 'Escape') {
                                e.preventDefault();
                                cancelarRenombre();
                              }
                            }}
                            className="h-9 w-56 rounded-t-lg rounded-b-none border-b-0 border-border bg-card"
                          />
                        </div>
                      ) : (
                        <Button
                          key={d.id}
                          type="button"
                          role="tab"
                          aria-selected={i === indiceActual}
                          variant="ghost"
                          title="Doble clic para renombrar la pestaña"
                          onClick={() => setIndiceActual(i)}
                          onDoubleClick={() => abrirRenombre(i)}
                          className={folderTabClassName(i === indiceActual)}
                        >
                          {i + 1}. {etiquetaDestino(d)}
                          {d.cotizacion?.necesitaRecalculo ? ' · recalcula' : ''}
                        </Button>
                      ),
                    )}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    aria-label="Agregar otro destino"
                    onClick={agregarDestino}
                    disabled={!puedeAvanzar}
                    className={cn(
                      'relative h-9 rounded-t-lg rounded-b-none border border-b-0 border-primary bg-primary px-3 text-sm text-primary-foreground shadow-md shadow-primary/25 hover:bg-primary/90',
                      pulsarAgregar && 'agregar-pulso',
                    )}
                  >
                    <Plus className="h-4 w-4" aria-hidden /> Agregar
                  </Button>
                </div>
                {destinoActual ? (
                  <DestinoEditor
                    key={destinoActual.id}
                    destino={destinoActual}
                    indice={indiceActual}
                    salidaOrigen={{ fecha: origen.fechaSalida, hora: origen.horaSalida }}
                    stickyTop={altoNav}
                    onCambiar={(cambio, invalida) => actualizarDestino(destinoActual.id, cambio, invalida ?? true)}
                  />
                ) : null}
              </div>
            </section>
          ) : null}

          {paso === 6 ? (
            <section data-testid="paso-6" className="space-y-4">
              <h2 className="font-semibold">Regreso</h2>
              <p className="text-xs text-muted-foreground">El regreso siempre forma parte del viaje: elige únicamente a dónde regresas.</p>
              <div className="grid gap-4 sm:grid-cols-2 max-w-2xl mx-auto" role="radiogroup" aria-label="Punto de regreso">
                <button
                  type="button"
                  role="radio"
                  aria-checked={retorno.destino === 'origen'}
                  aria-label="Regresar al mismo punto de origen"
                  onClick={() => setRetorno((r) => ({ ...r, destino: 'origen', punto: null }))}
                  className={cn(
                    'flex flex-col items-center gap-2 rounded-2xl border-2 p-6 text-center transition-[transform,box-shadow,border-color,background-color] duration-150 ease-out active:scale-[0.97]',
                    retorno.destino === 'origen'
                      ? 'border-primary bg-primary/10 shadow-md scale-[1.01]'
                      : 'border-border bg-background hover:border-primary/40 hover:bg-primary/5'
                  )}
                >
                  <span className="text-4xl" aria-hidden="true">🏠</span>
                  <span className="font-semibold text-base">Regresar al mismo punto de origen</span>
                  <span className="text-xs text-muted-foreground">Vuelves a {origen.punto?.nombre ?? 'el origen del viaje'}.</span>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={retorno.destino === 'otro'}
                  aria-label="Seleccionar un punto de regreso en el mapa"
                  onClick={() => setRetorno((r) => ({ ...r, destino: 'otro', punto: r.punto ?? origen.punto }))}
                  className={cn(
                    'flex flex-col items-center gap-2 rounded-2xl border-2 p-6 text-center transition-[transform,box-shadow,border-color,background-color] duration-150 ease-out active:scale-[0.97]',
                    retorno.destino === 'otro'
                      ? 'border-primary bg-primary/10 shadow-md scale-[1.01]'
                      : 'border-border bg-background hover:border-primary/40 hover:bg-primary/5'
                  )}
                >
                  <span className="text-4xl" aria-hidden="true">📍</span>
                  <span className="font-semibold text-base">Seleccionar un punto de regreso en el mapa</span>
                  <span className="text-xs text-muted-foreground">Buscas o marcas otro punto de regreso.</span>
                </button>
              </div>
              {retorno.destino === 'origen' && !origen.punto ? (
                <p role="alert" className="text-sm text-destructive">El origen no tiene un punto marcado. Vuelve al paso Origen para corregirlo.</p>
              ) : null}
              {retorno.destino === 'otro' ? (
                <div className="space-y-1">
                  <Label>Punto de regreso (busca o marca en el mapa)</Label>
                  <PuntoMapaPicker value={retorno.punto} onChange={(punto) => setRetorno((r) => ({ ...r, punto }))} flotante stickyTop={altoNav} />
                </div>
              ) : null}
            </section>
          ) : null}

          {paso === 7 ? (
            <section data-testid="paso-7" className="space-y-4">
              <h2 className="font-semibold">Resumen del viaje</h2>
              <Card>
                <CardContent className="pt-6">
                  <ResumenViaje
                    motivo={persona.motivo}
                    modoTransporte={transporte.modo}
                    compartido={transporte.compartir}
                    acompanantes={transporte.acompanantes.map((a) => a.nombreCompleto)}
                    origen={origen}
                    destinos={destinos}
                    retorno={retorno}
                    rango={rango}
                  />
                </CardContent>
              </Card>
            </section>
          ) : null}

          </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" disabled={paso === 1} onClick={() => setPaso((p) => (p - 1) as PasoId)} className="active:scale-[0.97]">
            Atrás
          </Button>
          {motivoSiguiente ? (
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  {/* El botón deshabilitado no recibe hover; el envoltorio sí. */}
                  <span tabIndex={0} className="inline-flex cursor-not-allowed">
                    <Button type="button" disabled onClick={() => setPaso((p) => (p + 1) as PasoId)} className="active:scale-[0.97]">
                      Siguiente
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>{motivoSiguiente}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : paso === PASOS.length ? (
            <Button type="button" disabled={enviando || !pasoValido(paso)} onClick={guardarBorrador} className="active:scale-[0.97]">
              {enviando ? 'Guardando…' : solicitudEditando ? 'Guardar cambios' : 'Guardar borrador'}
            </Button>
          ) : (
            <Button type="button" disabled={!pasoValido(paso)} onClick={() => setPaso((p) => (p + 1) as PasoId)} className="active:scale-[0.97]">
              Siguiente
            </Button>
          )}
        </div>
      </CardContent>
      </Card>
    </div>
  );
}

function DestinoEditor(props: {
  destino: DestinoV2;
  indice: number;
  salidaOrigen: { fecha: string; hora: string };
  stickyTop: number;
  onCambiar: (cambio: Partial<DestinoV2>, invalida?: boolean) => void;
}) {
  const { destino, indice } = props;
  const llegadaTxt = destino.debeEstarFecha && destino.debeEstarHora ? `${destino.debeEstarFecha}T${destino.debeEstarHora}` : '';
  const salidaTxt = destino.saleFecha && destino.saleHora ? `${destino.saleFecha}T${destino.saleHora}` : '';
  const salidaOrigenTxt = props.salidaOrigen.fecha && props.salidaOrigen.hora ? `${props.salidaOrigen.fecha}T${props.salidaOrigen.hora}` : '';
  const llegadaAntesDelOrigen = Boolean(salidaOrigenTxt && llegadaTxt && llegadaTxt < salidaOrigenTxt);
  const salidaAntesDeLlegada = Boolean(llegadaTxt && salidaTxt && salidaTxt < llegadaTxt);

  return (
    <div role="group" aria-label={`Destino ${indice + 1}`} className="space-y-3 rounded-b-md border bg-card p-4 shadow-[0_12px_30px_rgba(15,23,42,0.25)]">
      <div className="space-y-0.5">
        <p className="font-medium">Destino {indice + 1}: {etiquetaDestino(destino)}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={`dest-${destino.id}-debe`}>Hora de llegada al destino</Label>
          <DateTimePicker
            id={`dest-${destino.id}-debe`}
            fecha={destino.debeEstarFecha}
            hora={destino.debeEstarHora}
            desde={props.salidaOrigen.fecha && props.salidaOrigen.hora ? props.salidaOrigen : null}
            onFecha={(f) => props.onCambiar({ debeEstarFecha: f })}
            onHora={(h) => props.onCambiar({ debeEstarHora: h })}
            placeholder="Elige fecha y hora requerida"
          />
          {llegadaAntesDelOrigen ? <p role="alert" className="text-xs text-destructive">La llegada no puede ser antes de la salida del origen.</p> : null}
        </div>
        <div className="space-y-1">
          <Label htmlFor={`dest-${destino.id}-sale`}>Hora de salida del destino (opcional)</Label>
          <DateTimePicker
            id={`dest-${destino.id}-sale`}
            fecha={destino.saleFecha}
            hora={destino.saleHora}
            desde={destino.debeEstarFecha && destino.debeEstarHora ? { fecha: destino.debeEstarFecha, hora: destino.debeEstarHora } : null}
            onFecha={(f) => props.onCambiar({ saleFecha: f })}
            onHora={(h) => props.onCambiar({ saleHora: h })}
            placeholder="Elige fecha y hora de salida"
          />
          {salidaAntesDeLlegada ? <p role="alert" className="text-xs text-destructive">La salida no puede ser antes de la llegada al destino.</p> : null}
        </div>
      </div>
      <PuntoMapaPicker
        value={destino.punto}
        onChange={(punto) => {
          // La geocodificación inversa solo cambia el nombre/estado: si las
          // coordenadas no se movieron, no se invalida la cotización.
          const mismoPunto = destino.punto?.latitud === punto?.latitud && destino.punto?.longitud === punto?.longitud;
          props.onCambiar({ punto }, !mismoPunto);
        }}
        flotante
        stickyTop={props.stickyTop}
      />
    </div>
  );
}

export default SolicitudPage;
