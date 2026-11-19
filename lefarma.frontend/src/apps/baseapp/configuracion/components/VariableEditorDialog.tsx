import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  KeyRound,
  List,
  Loader2,
  Lock,
  Save,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  actualizarVariable,
  crearVariable,
} from '../services/configuracionAdminApi';
import {
  DESTINOS,
  TIPOS_DATO,
  type CampoDestino,
  type JsonSchemaNodo,
  type ModuloConfig,
  type SchemaField,
  type TipoDatoConfig,
  type VariableConfiguracion,
} from '../types';
import {
  CLAVE_MODULO_REGEX,
  aCamelCase,
  clavesAdicionalesDeEsquema,
  construirEsquema,
  depurarValorSegunEsquema,
  esCancelado,
  esConflicto,
  esErrorReintentable,
  esObjetoPlano,
  esquemaACampos,
  etiquetaTipo,
  itemListaDeEsquema,
  jsonATexto,
  mensajeErrorCompleto,
  normalizarTipoDato,
  nuevoIdOperacion,
  opcionesDeEsquema,
  segmentosDeClave,
  tipoEfectivo,
  tipoDatoBackend,
  validarClave,
  validarConstructor,
  validarValorVariable,
  valorDesdeServidor,
  valorInicialFormulario,
} from '../utils';
import { TypeSelector } from './TypeSelector';
import {
  FieldSchemaBuilder,
  OpcionesSeleccionEditor,
} from './FieldSchemaBuilder';
import { DynamicValueEditor } from './DynamicValueEditor';
import { ICONOS_TIPO, TONOS_TIPO } from './typeVisuals';

interface VariableEditorDialogProps {
  /** `null` = creación. */
  variable: VariableConfiguracion | null;
  /** Módulos disponibles; el primero define el prefijo de la clave. */
  modulos: ModuloConfig[];
  onClose: () => void;
  onSaved: () => void;
  onConflicto: () => void;
}

type DestinosEstado = Record<CampoDestino, boolean>;

interface EstadoInicial {
  tipo: TipoDatoConfig | '';
  esLista: boolean;
  nombre: string;
  descripcion: string;
  clave: string;
  namespace: string;
  idModulo: number | null;
  destinos: DestinosEstado;
  campos: SchemaField[];
  opciones: string[];
  clavesAdicionales: boolean;
  valor: unknown;
}

const PASOS = [
  { numero: 1, titulo: 'Tipo' },
  { numero: 2, titulo: 'Definición' },
  { numero: 3, titulo: 'Valor' },
];

/**
 * Separación vertical fluida: se encoge en pantallas bajas para que el asistente
 * quepa completo sin scroll. `dvh` mide el alto visible real del navegador.
 */
const ESTILO_FLUIDO = {
  '--ve-gap': 'clamp(0.5rem, 1.5dvh, 1.25rem)',
  '--ve-gap-sm': 'clamp(0.375rem, 1dvh, 0.875rem)',
} as CSSProperties;

function estadoInicial(variable: VariableConfiguracion | null): EstadoInicial {
  if (!variable) {
    return {
      tipo: '',
      esLista: false,
      nombre: '',
      descripcion: '',
      clave: '',
      namespace: '',
      idModulo: null,
      destinos: {
        disponibleBackend: false,
        disponibleFrontend: false,
        disponibleSql: false,
        disponibleIntegraciones: false,
      },
      campos: [],
      opciones: [],
      clavesAdicionales: false,
      valor: '',
    };
  }

  const tipoGuardado = normalizarTipoDato(variable.tipoDato);
  const esquema = esObjetoPlano(variable.esquema)
    ? (variable.esquema as JsonSchemaNodo)
    : null;
  const esLista =
    tipoGuardado === 'lista' ||
    esquema?.type === 'array';

  let tipoBase: TipoDatoConfig = tipoGuardado ?? 'json';
  let campos: SchemaField[] = [];
  let opciones: string[] = [];
  let clavesAdicionales = false;

  if (esLista) {
    const item = itemListaDeEsquema(esquema);
    tipoBase = item.tipo === 'lista' ? 'json' : item.tipo;
    campos = item.campos;
    opciones = item.opciones;
    clavesAdicionales = item.clavesAdicionales;
  } else {
    campos = tipoBase === 'objeto' ? esquemaACampos(esquema) : [];
    opciones = tipoBase === 'seleccion' ? opcionesDeEsquema(esquema) : [];
    clavesAdicionales =
      tipoBase === 'objeto' ? clavesAdicionalesDeEsquema(esquema) : false;
  }

  if (tipoBase === 'lista') {
    tipoBase = 'json';
  }

  // Con tres segmentos (modulo.namespace.clave) el primero es el módulo y el
  // segundo el namespace; con dos (namespace.clave) se mantiene el formato previo.
  const partesClave = segmentosDeClave(variable.clave);
  const tieneModulo = partesClave.length >= 3;
  const namespace = tieneModulo ? (partesClave[1] ?? '') : (partesClave[0] ?? '');
  const restoClave = tieneModulo ? partesClave.slice(2) : partesClave.slice(1);

  return {
    tipo: tipoBase,
    esLista,
    nombre: variable.nombre,
    descripcion: variable.descripcion ?? '',
    clave: restoClave.join('.'),
    namespace,
    idModulo: variable.idModulo ?? null,
    destinos: {
      disponibleBackend: variable.disponibleBackend,
      disponibleFrontend: variable.disponibleFrontend,
      disponibleSql: variable.disponibleSql,
      disponibleIntegraciones: variable.disponibleIntegraciones,
    },
    campos,
    opciones,
    clavesAdicionales,
    valor: esLista
      ? (Array.isArray(variable.valor) ? variable.valor : [])
      : valorDesdeServidor(tipoBase, variable.valor),
  };
}

export function VariableEditorDialog({
  variable,
  modulos,
  onClose,
  onSaved,
  onConflicto,
}: VariableEditorDialogProps) {
  const esEdicion = variable !== null;
  const [inicial] = useState(() => estadoInicial(variable));

  // Al editar, el tipo y la clave son inmutables; abrimos directamente la
  // definición para que nombre, descripción y destinos sean evidentes.
  const [paso, setPaso] = useState(esEdicion ? 2 : 1);
  const [pasoMax, setPasoMax] = useState(esEdicion ? 3 : 1);

  const [tipo, setTipo] = useState<TipoDatoConfig | ''>(inicial.tipo);
  const [esLista, setEsLista] = useState(inicial.esLista);
  const [nombre, setNombre] = useState(inicial.nombre);
  const [descripcion, setDescripcion] = useState(inicial.descripcion);
  const [clave, setClave] = useState(inicial.clave);
  const [namespace, setNamespace] = useState(inicial.namespace);
  const [idModulo, setIdModulo] = useState<number | null>(inicial.idModulo);
  const [claveTocada, setClaveTocada] = useState(false);
  const [destinos, setDestinos] = useState<DestinosEstado>(inicial.destinos);

  const [campos, setCampos] = useState<SchemaField[]>(inicial.campos);
  const [opciones, setOpciones] = useState<string[]>(inicial.opciones);
  const [clavesAdicionales, setClavesAdicionales] = useState(inicial.clavesAdicionales);

  const [valor, setValor] = useState<unknown>(inicial.valor);

  const [intentoPaso2, setIntentoPaso2] = useState(false);
  const [intentoGuardar, setIntentoGuardar] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const idOperacionRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const tipoActual = tipo === '' ? '' : tipoEfectivo(tipo);
  const tipoCanonicoEditado =
    esEdicion && variable ? normalizarTipoDato(variable.tipoDato) !== null : true;

  const namespaceLimpio = namespace.trim();
  const claveLimpia = clave.trim();

  const moduloSeleccionado =
    idModulo != null ? (modulos.find((modulo) => modulo.idModulo === idModulo) ?? null) : null;
  // Al editar, una variable sin módulo pertenece a «Global».
  const moduloEfectivo = esEdicion
    ? (moduloSeleccionado ?? modulos.find((modulo) => modulo.clave === 'global') ?? null)
    : moduloSeleccionado;

  const claveEfectiva =
    esEdicion && variable
      ? variable.clave
      : namespaceLimpio && claveLimpia
        ? moduloSeleccionado
          ? `${moduloSeleccionado.clave}.${namespaceLimpio}.${claveLimpia}`
          : `${namespaceLimpio}.${claveLimpia}`
        : '';
  const errorClave =
    intentoPaso2 || claveTocada
      ? validarClave(claveEfectiva, { requiereModulo: !esEdicion })
      : null;
  const tipoParaValor = esLista ? 'lista' : (tipoActual || 'json');
  const metaTipoSeleccionado = tipoActual
    ? TIPOS_DATO.find((tipoDato) => tipoDato.valor === tipoActual)
    : undefined;
  const IconoTipoSeleccionado = tipoActual ? ICONOS_TIPO[tipoActual] : null;
  const tonoTipoSeleccionado = metaTipoSeleccionado
    ? TONOS_TIPO[metaTipoSeleccionado.tono]
    : null;

  const esquemaActual = useMemo<JsonSchemaNodo | null>(() => {
    if (!tipoActual) return null;
    return construirEsquema({
      tipo: tipoActual,
      esLista,
      campos,
      opciones,
      clavesAdicionales,
    });
  }, [tipoActual, esLista, campos, opciones, clavesAdicionales]);

  const erroresConstructor = useMemo(() => {
    if (tipoActual === 'objeto') return validarConstructor(campos);
    return [];
  }, [tipoActual, campos]);

  // El payload se ajusta al esquema: sin claves fuera de properties cuando
  // additionalProperties=false (el backend las rechazaría).
  const valorParaGuardar = useMemo(
    () => (esquemaActual ? depurarValorSegunEsquema(valor, esquemaActual) : valor),
    [valor, esquemaActual],
  );

  const erroresPaso2: Record<string, string> = intentoPaso2 ? validarPaso2() : {};

  const valorVacio =
    valorParaGuardar === undefined ||
    valorParaGuardar === null ||
    (typeof valorParaGuardar === 'string' && valorParaGuardar.trim() === '');

  const erroresValor = intentoGuardar
    ? [
        ...(valorVacio ? ['Captura un valor antes de guardar.'] : []),
        ...validarValorVariable(tipoParaValor, valorParaGuardar, esquemaActual),
      ]
    : [];

  function validarPaso2(): Record<string, string> {
    const errores: Record<string, string> = {};

    if (!nombre.trim()) {
      errores.nombre = 'El nombre es obligatorio.';
    }

    if (!esEdicion && idModulo === null) {
      errores.modulo = 'Selecciona el módulo al que pertenece la variable.';
    } else if (!esEdicion && moduloSeleccionado && !moduloSeleccionado.activo) {
      errores.modulo = 'El módulo seleccionado está inactivo; reactívalo o elige otro.';
    }

    if (!esEdicion) {
      const errorDeClave = validarClave(claveEfectiva, { requiereModulo: true });
      if (errorDeClave) errores.clave = errorDeClave;
    }

    if (!DESTINOS.some((destino) => destinos[destino.campo])) {
      errores.destinos = 'Selecciona al menos un destino.';
    }

    if (tipoActual === 'seleccion' && opciones.length === 0) {
      errores.esquema = 'Agrega al menos una opción de selección.';
    }

    if (tipoActual === 'objeto') {
      if (campos.length === 0 && !clavesAdicionales) {
        errores.esquema = esLista
          ? 'Agrega al menos un campo a los elementos de la lista.'
          : 'Agrega al menos un campo o habilita claves adicionales.';
      } else if (erroresConstructor.length > 0) {
        errores.esquema = erroresConstructor[0];
      }
    }

    return errores;
  }

  const cambiarTipo = (nuevo: TipoDatoConfig) => {
    if (esEdicion) return;
    setTipo(nuevo);
    setValor(valorInicialFormulario(nuevo, esLista));
    setCampos([]);
    setOpciones([]);
    setClavesAdicionales(false);
    setIntentoPaso2(false);
    setIntentoGuardar(false);
  };

  const alternarLista = (marcado: boolean) => {
    if (esEdicion) return;
    setEsLista(marcado);
    setValor(valorInicialFormulario(tipoActual || 'json', marcado));
    setIntentoGuardar(false);
  };

  const alternarDestino = (campo: CampoDestino, marcado: boolean) => {
    setDestinos((actual) => ({ ...actual, [campo]: marcado }));
  };

  const avanzar = () => {
    if (paso === 1) {
      if (!tipoActual) {
        toast.error('Selecciona un tipo de dato para continuar.');
        return;
      }
      setPaso(2);
      setPasoMax((max) => Math.max(max, 2));
      return;
    }

    if (paso === 2) {
      setIntentoPaso2(true);
      const errores = validarPaso2();
      if (Object.keys(errores).length > 0) {
        toast.error('Revisa la definición antes de continuar.');
        return;
      }
      setPaso(3);
      setPasoMax((max) => Math.max(max, 3));
    }
  };

  const retroceder = () => {
    if (guardando) return;
    setPaso((actual) => Math.max(1, actual - 1));
  };

  const irAPaso = (destino: number) => {
    if (guardando || destino > pasoMax || destino === paso) return;
    setPaso(destino);
  };

  const guardar = async () => {
    if (guardando) return;

    setIntentoPaso2(true);
    setIntentoGuardar(true);
    setErrorGeneral(null);

    const erroresDefinicion = validarPaso2();
    const tipoGuardar = tipoParaValor;
    const erroresValorActual = [
      ...(valorVacio ? ['Captura un valor antes de guardar.'] : []),
      ...validarValorVariable(tipoGuardar, valorParaGuardar, esquemaActual),
    ];

    if (Object.keys(erroresDefinicion).length > 0) {
      setPaso(2);
      toast.error('Faltan datos en la definición de la variable.');
      return;
    }

    if (erroresValorActual.length > 0) {
      setPaso(3);
      toast.error(erroresValorActual[0]);
      return;
    }

    if (!esEdicion && idModulo === null) {
      setPaso(2);
      toast.error('Selecciona el módulo al que pertenece la variable.');
      return;
    }

    if (!esEdicion && !CLAVE_MODULO_REGEX.test(claveEfectiva.trim())) {
      setPaso(2);
      setClaveTocada(true);
      toast.error('La clave debe tener el formato módulo.namespace.clave.');
      return;
    }

    setGuardando(true);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // La generación del identificador también va protegida: cualquier
      // excepción debe liberar el estado "Guardando…".
      // Un idOperacion por intento lógico: se conserva si hay timeout.
      const idOperacion = idOperacionRef.current ?? nuevoIdOperacion();
      idOperacionRef.current = idOperacion;

      const comun = {
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || null,
        valor: valorParaGuardar,
        esquema: esquemaActual,
        disponibleBackend: destinos.disponibleBackend,
        disponibleFrontend: destinos.disponibleFrontend,
        disponibleSql: destinos.disponibleSql,
        disponibleIntegraciones: destinos.disponibleIntegraciones,
      };

      if (variable) {
        await actualizarVariable(
          variable.idVariable,
          {
            ...comun,
            versionEsperada: variable.version,
            idOperacion,
          },
          controller.signal,
        );
      } else {
        await crearVariable(
          {
            ...comun,
            clave: claveEfectiva.trim(),
            tipoDato: tipoDatoBackend(tipoGuardar),
            idModulo: idModulo as number,
            idOperacion,
          },
          controller.signal,
        );
      }

      idOperacionRef.current = null;
      toast.success(esEdicion ? 'Variable actualizada.' : 'Variable creada.');
      onSaved();
    } catch (error) {
      if (esCancelado(error)) return;

      if (esConflicto(error)) {
        idOperacionRef.current = null;

        if (variable) {
          toast.error('Otra persona modificó esta variable.', {
            description: 'Se recargaron los datos para que revises la versión más reciente.',
          });
          onConflicto();
        } else {
          const mensaje = mensajeErrorCompleto(
            error,
            'No se pudo crear la variable. Revisa la clave.',
          );
          setErrorGeneral(mensaje);
          setPaso(2);
          toast.error(mensaje, {
            description: 'Es posible que ya exista una variable con esa clave.',
          });
        }
        return;
      }

      const mensaje = mensajeErrorCompleto(error, 'No se pudo guardar la variable.');
      setErrorGeneral(mensaje);

      if (esErrorReintentable(error)) {
        toast.error(mensaje, {
          description:
            'Pudo ser un timeout. Reintenta el guardado: se reutilizará el mismo identificador de operación.',
        });
      } else {
        idOperacionRef.current = null;
        toast.error(mensaje);
      }
    } finally {
      setGuardando(false);
      abortRef.current = null;
    }
  };

  const textoGuardar = esEdicion ? 'Guardar cambios' : 'Crear variable';

  return (
    <Modal
      id="modal-variable-configuracion"
      open
      setOpen={(abierto) => {
        if (!abierto) onClose();
      }}
      title={esEdicion ? 'Editar variable' : 'Nueva variable global'}
      subtitle={
        esEdicion
          ? 'La clave y el tipo de dato no se pueden modificar después de crear la variable.'
          : 'Define el tipo, la clave y el valor de la variable que consumirán las aplicaciones.'
      }
      size="wide"
      beforeClose={() => !guardando}
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={guardando}
          >
            Cancelar
          </Button>

          <div className="flex items-center gap-2">
            {paso > 1 && (
              <Button
                type="button"
                variant="outline"
                onClick={retroceder}
                disabled={guardando}
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </Button>
            )}

            {paso < 3 && (
              <Button
                type="button"
                onClick={avanzar}
                disabled={paso === 1 && !tipoActual}
              >
                Siguiente
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}

            {paso === 3 && (
              <Button type="button" onClick={guardar} disabled={guardando}>
                {guardando ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {guardando ? 'Guardando…' : textoGuardar}
              </Button>
            )}
          </div>
        </div>
      }
      bodyClassName="flex flex-col"
    >
      <div
        className="flex min-h-0 flex-1 flex-col gap-[var(--ve-gap)]"
        style={ESTILO_FLUIDO}
      >
        {/* Pasos */}
        <ol className="flex shrink-0 items-center gap-1.5">
          {PASOS.map((item, indice) => {
            const activo = paso === item.numero;
            const completado = paso > item.numero;
            const clickable = item.numero <= pasoMax && item.numero !== paso && !guardando;

            return (
              <Fragment key={item.numero}>
                <li>
                  <button
                    type="button"
                    onClick={() => irAPaso(item.numero)}
                    disabled={!clickable}
                    className={cn(
                      'flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs transition-colors',
                      clickable && 'hover:bg-muted',
                      !clickable && 'cursor-default',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-semibold',
                        activo && 'border-primary bg-primary text-primary-foreground',
                        completado && 'border-primary/40 bg-primary/10 text-primary',
                        !activo && !completado && 'border-border text-muted-foreground',
                      )}
                    >
                      {completado ? <Check className="h-3 w-3" /> : item.numero}
                    </span>
                    <span
                      className={cn(
                        'font-medium',
                        activo ? 'text-foreground' : 'text-muted-foreground',
                      )}
                    >
                      {item.titulo}
                    </span>
                  </button>
                </li>
                {indice < PASOS.length - 1 && (
                  <li className="h-px flex-1 bg-border" aria-hidden />
                )}
              </Fragment>
            );
          })}
        </ol>

        {errorGeneral && (
          <div className="flex shrink-0 items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-2.5 py-1.5 text-xs text-destructive">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p>{errorGeneral}</p>
          </div>
        )}

        {/* Paso 1: tipo */}
        {paso === 1 && (
          <section className="flex min-h-0 flex-1 flex-col gap-[var(--ve-gap-sm)] overflow-y-auto overscroll-contain">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <h3 className="text-sm font-semibold">Tipo de dato</h3>
              <p className="text-[11px] text-muted-foreground">
                Define qué clase de valor guarda la variable; el editor y la validación se adaptan
                automáticamente.
              </p>
            </div>

            <TypeSelector value={tipoActual} onChange={cambiarTipo} disabled={esEdicion} />

            <label
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-lg border-2 p-2 transition-colors',
                esLista
                  ? 'border-teal-400 bg-teal-50/60'
                  : 'border-border bg-card hover:bg-muted/30',
                (!tipoActual || esEdicion) && 'cursor-default',
              )}
            >
              <Checkbox
                checked={esLista}
                disabled={!tipoActual || esEdicion}
                onCheckedChange={(marcado) => alternarLista(marcado === true)}
                className="shrink-0"
              />
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-teal-200 bg-teal-100 text-teal-700">
                <List className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="text-xs font-semibold">Convertir este dato en una lista</span>
                  {esLista && tipoActual && (
                    <Badge variant="secondary" className="gap-1 px-1.5 py-0 text-[9px]">
                      <List className="h-2.5 w-2.5" />
                      Lista de {etiquetaTipo(tipoActual)}
                    </Badge>
                  )}
                </span>
                <span className="mt-0.5 block text-[10px] leading-snug text-muted-foreground">
                  {tipoActual
                    ? `Guardará varios elementos de tipo «${etiquetaTipo(tipoActual)}», cada uno validado por separado.`
                    : 'Selecciona primero un tipo para definir qué elementos contendrá la lista.'}
                </span>
              </span>
            </label>

            {esEdicion && (
              <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-2.5 py-1.5 text-[11px] text-muted-foreground">
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <p>
                  El tipo de dato forma parte de la identidad de la variable y no se puede
                  cambiar. Si necesitas otro tipo, crea una variable nueva.
                </p>
              </div>
            )}

            {!tipoCanonicoEditado && variable && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 px-2.5 py-1.5 text-[11px] text-amber-700 dark:text-amber-400">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <p>
                  El tipo guardado («{variable.tipoDato}») no es reconocido por esta versión del
                  editor; el valor se editará como JSON libre.
                </p>
              </div>
            )}
          </section>
        )}

        {/* Paso 2: definición */}
        {paso === 2 && (
          <section className="grid min-h-0 flex-1 content-start gap-x-5 gap-y-[var(--ve-gap-sm)] overflow-y-auto overscroll-contain md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
            {esEdicion && (
              <div className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50/50 px-2.5 py-1.5 text-[11px] leading-snug text-sky-800 md:col-span-2">
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <p>
                  Puedes actualizar <strong>nombre, descripción, destinos, esquema y valor</strong>.
                  La clave y el tipo de dato permanecen bloqueados para no romper a los
                  consumidores.
                </p>
              </div>
            )}

            <div className="flex min-w-0 flex-col gap-1 md:col-span-2">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <Label className="text-xs">
                  Módulo <span className="text-destructive">*</span>
                </Label>
                <p className="text-[10px] leading-snug text-muted-foreground">
                  Define el prefijo de la clave: módulo.namespace.clave.
                </p>
              </div>

              {esEdicion ? (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 px-2.5 py-1.5">
                  <Badge variant="secondary" className="font-mono text-[10px]">
                    {moduloEfectivo?.clave ?? 'global'}
                  </Badge>
                  <span className="text-xs font-medium">
                    {moduloEfectivo?.nombre ?? 'Global'}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    El módulo no cambia después de crear la variable.
                  </span>
                </div>
              ) : modulos.length === 0 ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50/60 px-2.5 py-1.5 text-[11px] leading-snug text-amber-800">
                  No hay módulos disponibles. Crea uno en la pestaña «Módulos» antes de
                  registrar variables.
                </p>
              ) : (
                <Select
                  value={idModulo != null ? String(idModulo) : ''}
                  onValueChange={(valor) => setIdModulo(Number(valor))}
                >
                  <SelectTrigger
                    className={cn(
                      'h-9 max-w-[360px]',
                      erroresPaso2.modulo &&
                        'border-destructive focus:ring-destructive/30',
                    )}
                    aria-label="Módulo de la variable"
                    aria-invalid={Boolean(erroresPaso2.modulo)}
                  >
                    <SelectValue placeholder="Selecciona un módulo" />
                  </SelectTrigger>
                  <SelectContent>
                    {modulos.map((modulo) => (
                      <SelectItem
                        key={modulo.idModulo}
                        value={String(modulo.idModulo)}
                        disabled={!modulo.activo}
                      >
                        {modulo.nombre} · {modulo.clave}
                        {modulo.activo ? '' : ' (inactivo)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {erroresPaso2.modulo && (
                <p className="flex items-center gap-1.5 text-[11px] text-destructive">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {erroresPaso2.modulo}
                </p>
              )}
            </div>

            <div className="flex min-w-0 flex-col gap-1">
              <Label htmlFor="variable-nombre" className="text-xs">
                Nombre <span className="text-destructive">*</span>
              </Label>
              <Input
                id="variable-nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej. Días límite de viáticos"
                maxLength={200}
                aria-invalid={Boolean(erroresPaso2.nombre)}
                className={cn(
                  'h-9',
                  erroresPaso2.nombre &&
                    'border-destructive focus-visible:ring-destructive/30',
                )}
              />
              {erroresPaso2.nombre && (
                <p className="flex items-center gap-1.5 text-[11px] text-destructive">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {erroresPaso2.nombre}
                </p>
              )}
            </div>

            <div className="flex min-w-0 flex-col gap-1">
              <Label htmlFor="variable-descripcion" className="text-xs">
                Descripción{' '}
                <span className="font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <Textarea
                id="variable-descripcion"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Para qué sirve y qué impacto tiene cambiarla"
                className="min-h-[clamp(3rem,7dvh,6rem)] resize-none bg-background text-sm leading-relaxed"
                rows={3}
                maxLength={1000}
              />
              <p className="text-[10px] leading-snug text-muted-foreground">
                Ayuda a que otras personas entiendan el impacto de cambiarla.
              </p>
            </div>

            <div className="flex min-w-0 flex-col gap-1.5">
              <div className="flex flex-wrap items-end justify-between gap-x-2 gap-y-1">
                <div className="min-w-0">
                  <Label className="text-xs">Clave de la variable</Label>
                  <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
                    Identificador permanente para Backend, Frontend, SQL e integraciones.
                  </p>
                </div>
                {!esEdicion && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-6 px-2 text-[10px]"
                    disabled={!nombre.trim()}
                    onClick={() => {
                      setClave(aCamelCase(nombre));
                      setClaveTocada(true);
                    }}
                  >
                    <Sparkles className="h-3 w-3" />
                    Generar desde el nombre
                  </Button>
                )}
              </div>

              {esEdicion ? (
                <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-1.5">
                  <Input value={variable?.clave ?? ''} readOnly disabled className="h-8 font-mono text-xs" />
                  <Badge variant="secondary" className="shrink-0 gap-1 text-[10px]">
                    <Lock className="h-3 w-3" />
                    Solo lectura
                  </Badge>
                </div>
              ) : (
                <>
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="variable-namespace" className="text-[10px] text-muted-foreground">
                        Namespace
                      </Label>
                      <Input
                        id="variable-namespace"
                        value={namespace}
                        onChange={(e) => setNamespace(e.target.value)}
                        onBlur={() => setClaveTocada(true)}
                        placeholder="Ej. catalogo"
                        className={cn(
                          'h-8 font-mono text-xs',
                          errorClave &&
                            'border-destructive focus-visible:ring-destructive/30',
                        )}
                        aria-label="Namespace de la clave"
                        aria-invalid={Boolean(errorClave)}
                        maxLength={100}
                        spellCheck={false}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="variable-clave" className="text-[10px] text-muted-foreground">
                        Nombre de la clave
                      </Label>
                      <Input
                        id="variable-clave"
                        value={clave}
                        onChange={(e) => setClave(e.target.value)}
                        onBlur={() => setClaveTocada(true)}
                        placeholder="Ej. diasLimite"
                        className={cn(
                          'h-8 font-mono text-xs',
                          errorClave &&
                            'border-destructive focus-visible:ring-destructive/30',
                        )}
                        aria-label="Nombre de la clave"
                        aria-invalid={Boolean(errorClave)}
                        spellCheck={false}
                        maxLength={200}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">Clave final:</span>
                    <Badge
                      variant="outline"
                      className="max-w-full gap-1.5 border-primary/25 bg-primary/5 px-2 py-0.5 font-mono text-[10px] font-medium text-foreground"
                    >
                      <KeyRound className="h-3 w-3 shrink-0 text-primary" />
                      <span className="truncate">
                        {claveEfectiva || 'módulo.namespace.clave'}
                      </span>
                    </Badge>
                  </div>

                  <p className="text-[10px] leading-snug text-muted-foreground">
                    Usa minúsculas, sin espacios. La clave final es módulo.namespace.clave; el
                    namespace agrupa las variables dentro del módulo.
                  </p>

                  {errorClave && (
                    <p className="flex items-center gap-1.5 text-[11px] text-destructive">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {errorClave}
                    </p>
                  )}
                </>
              )}
            </div>

            <div className="flex min-w-0 flex-col gap-1.5">
              <div className="flex flex-col gap-0.5">
                <Label className="text-xs">Destinos</Label>
                <p className="text-[10px] leading-snug text-muted-foreground">
                  Dónde puede consumirse la variable. Debe haber al menos uno.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {DESTINOS.map((destino) => {
                  const marcado = destinos[destino.campo];
                  return (
                    <label
                      key={destino.clave}
                      className={cn(
                        'flex cursor-pointer items-start gap-2 rounded-lg border p-2 transition-colors',
                        marcado
                          ? 'border-primary/50 bg-primary/5'
                          : 'border-border hover:bg-muted/40',
                      )}
                    >
                      <Checkbox
                        checked={marcado}
                        onCheckedChange={(valorCheck) =>
                          alternarDestino(destino.campo, valorCheck === true)
                        }
                        className="mt-0.5"
                      />
                      <span className="min-w-0">
                        <span className="block text-xs font-medium leading-tight">
                          {destino.etiqueta}
                        </span>
                        <span className="mt-0.5 block text-[10px] leading-snug text-muted-foreground">
                          {destino.descripcion}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
              {erroresPaso2.destinos && (
                <p className="text-[11px] text-destructive">{erroresPaso2.destinos}</p>
              )}
            </div>

            {tipoActual === 'seleccion' && (
              <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-card p-2 md:col-span-2">
                <div className="max-h-[min(16rem,30dvh)] overflow-y-auto overscroll-contain pr-1">
                  <OpcionesSeleccionEditor
                    opciones={opciones}
                    onChange={setOpciones}
                    disabled={guardando}
                  />
                </div>
                {erroresPaso2.esquema && (
                  <p className="text-[11px] text-destructive">{erroresPaso2.esquema}</p>
                )}
              </div>
            )}

            {tipoActual === 'objeto' && (
              <div className="flex flex-col gap-2 rounded-xl border border-blue-200/70 bg-blue-50/20 p-2.5 md:col-span-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold">
                      {esLista ? 'Campos de cada elemento' : 'Estructura del objeto'}
                    </p>
                    <p className="text-[10px] leading-snug text-muted-foreground">
                      {esLista
                        ? 'Cada elemento de la lista tendrá estas propiedades y validaciones.'
                        : 'Define las propiedades, su tipo y cuáles son obligatorias.'}
                    </p>
                  </div>
                  <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <Checkbox
                      checked={clavesAdicionales}
                      onCheckedChange={(marcado) => setClavesAdicionales(marcado === true)}
                    />
                    Permitir claves adicionales
                  </label>
                </div>

                <div className="max-h-[min(20rem,34dvh)] overflow-y-auto overscroll-contain pr-1">
                  <FieldSchemaBuilder
                    campos={campos}
                    onChange={setCampos}
                    disabled={guardando}
                    titulo={esLista ? 'Campos de cada elemento' : 'Propiedades'}
                  />
                </div>

                <details className="rounded-md border border-border bg-background/70 p-2">
                  <summary className="cursor-pointer text-[11px] font-medium text-muted-foreground">
                    Ver JSON Schema generado
                  </summary>
                  <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap font-mono text-[10px] text-foreground">
                    {jsonATexto(esquemaActual)}
                  </pre>
                </details>

                {erroresConstructor.length > 0 && intentoPaso2 && (
                  <ul className="space-y-1">
                    {erroresConstructor.slice(0, 4).map((error) => (
                      <li key={error} className="text-[11px] text-destructive">
                        • {error}
                      </li>
                    ))}
                  </ul>
                )}

                {intentoPaso2 &&
                  erroresPaso2.esquema &&
                  erroresConstructor.length === 0 && (
                    <p className="text-[11px] text-destructive">{erroresPaso2.esquema}</p>
                  )}
              </div>
            )}

            {esLista && tipoActual !== 'objeto' && tipoActual !== 'seleccion' && (
              <div className="flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50/60 px-2.5 py-1.5 text-[11px] leading-snug text-teal-800 md:col-span-2">
                <List className="h-3.5 w-3.5 shrink-0" />
                <p>
                  Este valor se guardará como una lista de <strong>{etiquetaTipo(tipoActual)}</strong>.
                  Podrás agregar, quitar y validar cada elemento por separado en el paso 3.
                </p>
              </div>
            )}
          </section>
        )}

        {/* Paso 3: valor */}
        {paso === 3 && (
          <section className="flex min-h-0 flex-1 flex-col gap-[var(--ve-gap-sm)]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold">Valor y validaciones</h3>
                <p className="text-[11px] leading-snug text-muted-foreground">
                  Captura un valor de tipo{' '}
                  <strong>
                    {esLista
                      ? `lista de ${etiquetaTipo(tipoActual || 'json')}`
                      : etiquetaTipo(tipoActual || 'json')}
                  </strong>
                  . Los ejemplos son solo guías: no se guardan si no los escribes.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="font-mono text-[10px]">
                  {claveEfectiva}
                </Badge>
                {metaTipoSeleccionado && (
                  <Badge
                    variant="secondary"
                    className={cn('gap-1 text-[10px]', tonoTipoSeleccionado?.chip)}
                  >
                    {IconoTipoSeleccionado && <IconoTipoSeleccionado size={12} isAnimated />}
                    {esLista ? 'Lista de ' : ''}
                    {metaTipoSeleccionado.etiqueta}
                  </Badge>
                )}
              </div>
            </div>

            {metaTipoSeleccionado && (
              <div className="flex flex-wrap items-start gap-2.5 rounded-lg border border-border bg-muted/20 p-2">
                {IconoTipoSeleccionado && (
                  <span
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border',
                      tonoTipoSeleccionado?.icono,
                    )}
                  >
                    <IconoTipoSeleccionado size={18} isAnimated />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium">{metaTipoSeleccionado.explicacion}</p>
                  <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
                    Editor: <strong>{metaTipoSeleccionado.editor}</strong>. Ejemplo:{' '}
                    <code className="rounded bg-background px-1 py-0.5">
                      {metaTipoSeleccionado.ejemplo}
                    </code>
                  </p>
                </div>
              </div>
            )}

            <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_340px] lg:grid-rows-[minmax(0,1fr)]">
              <div className="flex min-h-0 flex-col gap-2 overflow-y-auto overscroll-contain pr-1">
                <DynamicValueEditor
                  tipo={tipoParaValor}
                  esquema={esquemaActual}
                  valor={valor}
                  onChange={setValor}
                  disabled={guardando}
                  requerido
                  mostrarValidacion={intentoGuardar}
                />

                {erroresValor.length > 0 && (
                  <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-2.5">
                    <p className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-destructive">
                      <AlertCircle className="h-3.5 w-3.5" />
                      Revisa el valor
                    </p>
                    <ul className="space-y-0.5">
                      {erroresValor.slice(0, 6).map((error) => (
                        <li key={error} className="text-[11px] text-destructive">
                          • {error}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <p className="text-[10px] leading-snug text-muted-foreground">
                  Los cambios quedan en el historial y pueden restaurarse a una versión anterior.
                </p>
              </div>

              <div className="flex min-h-0 flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px]">Vista previa JSON</Label>
                  <span className="text-[10px] text-muted-foreground">campo «valor»</span>
                </div>
                <pre className="min-h-[clamp(4.5rem,12dvh,10rem)] flex-1 overflow-auto rounded-lg border border-border bg-muted/30 p-2.5 font-mono text-[11px] leading-relaxed">
                  {valorParaGuardar === undefined
                    ? '// JSON inválido: corrige el editor'
                    : jsonATexto(valorParaGuardar) || '—'}
                </pre>
              </div>
            </div>
          </section>
        )}
      </div>
    </Modal>
  );
}
