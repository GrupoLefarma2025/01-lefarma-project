import { useState } from 'react';
import { Camera, ExternalLink, ImageOff, RefreshCw, Ticket } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileViewer } from '@/components/archivos/FileViewer';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCapturaAutenticada } from './celdasCotizacion';
import { GrupoRutaCollapsible } from './GrupoRutaCollapsible';
import {
  esOpcionCotizada,
  importeFormateado,
  precioReferenciaOpcion,
  SIN_PRECIO,
} from '../types/aprobaciones.types';
import { nombreCortoOpcion } from '../utils/nombresOpciones';
import type { SolicitudOpcion } from '../types/solicitud.types';

/** Tipo de opción como etiqueta y color; lo desconocido se muestra tal cual. */
const TIPO_ESTILO: Record<string, { texto: string; clase: string }> = {
  vuelo: { texto: 'Vuelo', clase: 'border-violet-200 bg-violet-50 text-violet-700' },
  avion: { texto: 'Vuelo', clase: 'border-violet-200 bg-violet-50 text-violet-700' },
  autobus: { texto: 'Autobús', clase: 'border-sky-200 bg-sky-50 text-sky-700' },
  auto: { texto: 'Carro propio', clase: 'border-amber-200 bg-amber-50 text-amber-800' },
  renta: { texto: 'Renta de auto', clase: 'border-amber-200 bg-amber-50 text-amber-800' },
  taxi: { texto: 'Taxi', clase: 'border-amber-200 bg-amber-50 text-amber-800' },
  publico: { texto: 'Transporte público', clase: 'border-teal-200 bg-teal-50 text-teal-700' },
  hotel: { texto: 'Hospedaje', clase: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
};

/** Captura de la opción: miniatura que abre la imagen completa, o su ausencia. */
function CapturaBoleto({ ruta, etiqueta }: { ruta?: string; etiqueta: string }) {
  const estado = useCapturaAutenticada(ruta);
  const [verCaptura, setVerCaptura] = useState(false);
  const nombreArchivo = (ruta?.split('/').pop() ?? `captura-${etiqueta}.png`).split('?')[0];

  if (!ruta) {
    return (
      <div className="flex h-24 w-full items-center justify-center gap-1.5 rounded-lg border border-dashed bg-slate-50 text-xs text-muted-foreground sm:w-40">
        <ImageOff className="h-4 w-4" aria-hidden />
        Sin captura
      </div>
    );
  }
  if (estado.error) {
    return (
      <p role="alert" className="flex h-24 w-full items-center justify-center rounded-lg border text-xs text-destructive sm:w-40">
        {estado.error}
      </p>
    );
  }
  if (!estado.url) {
    return (
      <div className="flex h-24 w-full items-center justify-center rounded-lg border text-xs text-muted-foreground sm:w-40">
        Cargando captura…
      </div>
    );
  }
  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={() => setVerCaptura(true)}
        className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Ver captura completa de ${etiqueta}`}
        title={`Ver captura completa · ${etiqueta}`}
      >
        <img
          src={estado.url}
          alt={`Captura de pantalla de ${etiqueta}`}
          className="h-24 w-full rounded-lg border bg-slate-50 object-contain sm:w-40"
        />
      </button>
      <FileViewer
        open={verCaptura}
        onClose={() => setVerCaptura(false)}
        src={estado.url}
        nombre={nombreArchivo}
        titulo={`Captura · ${etiqueta}`}
        descargar
      />
    </div>
  );
}

/** Kayak solo conserva la búsqueda por ruta/fecha: sus enlaces al vuelo caducan. */
function esBusquedaKayak(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const destino = new URL(url);
    return destino.hostname.includes('kayak')
      && destino.pathname.startsWith('/flights/');
  } catch {
    return false;
  }
}

/** Fase y destino del boleto a partir del snapshot de la opción. */
interface GrupoBoleto {
  clave: string;
  etiqueta: string;
  detalle: string | null;
  punto: string;
  texto: string;
  tramo: number;
}

function grupoDeBoleto(opcion: SolicitudOpcion): GrupoBoleto {
  const de = typeof opcion.datos?.de === 'string' ? opcion.datos.de : '';
  const a = typeof opcion.datos?.a === 'string' ? opcion.datos.a : '';
  const tramo = typeof opcion.datos?.tramo === 'number' ? opcion.datos.tramo : 99;
  const detalle = de && a ? `${de} → ${a}` : null;

  if (tramo === 99) {
    return {
      clave: 'sin-tramo',
      etiqueta: 'Boletos',
      detalle,
      punto: 'bg-slate-400',
      texto: 'text-slate-600',
      tramo,
    };
  }
  if (tramo === 0) {
    return {
      clave: 'tramo-0',
      etiqueta: 'Ida',
      detalle,
      punto: 'bg-primary',
      texto: 'text-primary',
      tramo,
    };
  }
  if (/regreso|origen/i.test(a)) {
    return {
      clave: `tramo-${tramo}`,
      etiqueta: 'Regreso',
      detalle,
      punto: 'bg-sky-500',
      texto: 'text-sky-700',
      tramo,
    };
  }
  return {
    clave: `tramo-${tramo}`,
    etiqueta: `Destino ${tramo + 1}`,
    detalle,
    punto: 'bg-violet-500',
    texto: 'text-violet-700',
    tramo,
  };
}

/** Una opción con su boleto: línea, precio, fuente, enlace de compra y captura. */
function FilaBoleto({
  opcion,
  onSolicitarCaptura,
  capturandoId,
}: {
  opcion: SolicitudOpcion;
  onSolicitarCaptura?: (opcion: SolicitudOpcion) => void;
  capturandoId?: number | null;
}) {
  const captura = opcion.ruta_captura ?? undefined;
  const busquedaKayak = esBusquedaKayak(opcion.url_compra);
  const estiloTipo = TIPO_ESTILO[(opcion.tipo ?? '').trim().toLowerCase()] ?? {
    texto: opcion.tipo,
    clase: 'border-slate-200 bg-slate-50 text-slate-600',
  };
  const nombre = nombreCortoOpcion(opcion);
  const real = esOpcionCotizada(opcion);
  const referencia = precioReferenciaOpcion(opcion);
  const tienePrecioReal = real && opcion.precio !== null;
  const tieneReferencia = !tienePrecioReal && referencia !== null;
  const importe = tienePrecioReal
    ? importeFormateado(opcion.precio as number, opcion.moneda)
    : tieneReferencia
      ? importeFormateado(referencia, opcion.moneda)
      : SIN_PRECIO;

  return (
    <li className="grid gap-3 rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm sm:grid-cols-[minmax(0,1fr)_auto]">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="min-w-0 break-words text-[15px] font-semibold" title={opcion.linea}>
            {nombre}
          </span>
          <Badge variant="outline" className={`px-1.5 py-0 text-[10px] font-normal ${estiloTipo.clase}`}>
            {estiloTipo.texto}
          </Badge>
          {opcion.fue_elegida ? (
            <Badge className="border-primary/30 bg-primary/10 px-1.5 py-0 text-[10px] font-normal text-primary">
              Elegida
            </Badge>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <p
            className={
              tienePrecioReal || tieneReferencia
                ? 'text-[15px] font-semibold tabular-nums'
                : 'text-xs text-muted-foreground'
            }
          >
            {importe}
          </p>
          {tienePrecioReal || tieneReferencia ? (
            <Badge
              variant="outline"
              className={tienePrecioReal
                ? 'px-1.5 py-0 text-[10px] font-normal border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'px-1.5 py-0 text-[10px] font-normal border-amber-200 bg-amber-50 text-amber-700'}
            >
              {tienePrecioReal ? 'Precio real' : 'Estimado'}
            </Badge>
          ) : null}
        </div>
        {opcion.fuente ? (
          <p className="text-[11px] leading-snug text-muted-foreground">
            <span className="font-semibold text-foreground/70">Fuente:</span>{' '}
            <span className="italic">{opcion.fuente}</span>
          </p>
        ) : null}
        {opcion.url_compra ? (
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="default" size="sm" className="gap-1.5 rounded-lg">
                <a href={opcion.url_compra} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  {busquedaKayak ? 'Buscar en Kayak' : 'Ver boleto'}
                </a>
              </Button>
              {onSolicitarCaptura ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 rounded-lg border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 hover:text-primary"
                  onClick={() => onSolicitarCaptura(opcion)}
                  disabled={capturandoId === opcion.id_opcion}
                >
                  {capturandoId === opcion.id_opcion ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  ) : (
                    <Camera className="h-3.5 w-3.5" aria-hidden />
                  )}
                  {capturandoId === opcion.id_opcion
                    ? 'Generando…'
                    : captura
                      ? 'Reemplazar captura'
                      : 'Generar captura'}
                </Button>
              ) : null}
            </div>
            {busquedaKayak ? (
              <p className="text-[11px] leading-snug text-muted-foreground">
                Kayak abre la búsqueda de esta ruta y fecha; los enlaces directos al vuelo caducan.
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Sin enlace de compra registrado.</p>
        )}
      </div>
      <CapturaBoleto ruta={captura} etiqueta={opcion.linea} />
    </li>
  );
}

/**
 * Boletos del viaje: la URL de compra y la captura de pantalla de las opciones
 * que se le pasen. Sirve para todas las elegidas (desde el encabezado) y para
 * una sola (desde el botón de cada renglón).
 */
export function BoletoViajeDialog({
  abierto,
  onOpenChange,
  titulo,
  descripcion,
  opciones,
  onSolicitarCaptura,
  capturandoId,
}: {
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
  titulo: string;
  descripcion?: string;
  opciones: SolicitudOpcion[];
  /** Genera o reemplaza la captura de una opción concreta. */
  onSolicitarCaptura?: (opcion: SolicitudOpcion) => void;
  capturandoId?: number | null;
}) {
  const mapa = new Map<string, GrupoBoleto & { opciones: SolicitudOpcion[] }>();
  for (const opcion of opciones) {
    const grupo = grupoDeBoleto(opcion);
    const existente = mapa.get(grupo.clave);
    if (existente) {
      existente.opciones.push(opcion);
    } else {
      mapa.set(grupo.clave, { ...grupo, opciones: [opcion] });
    }
  }
  const grupos = [...mapa.values()].sort((a, b) => a.tramo - b.tramo);
  const mostrarEncabezado = opciones.length > 1;

  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[90vw] max-w-3xl overflow-y-auto sm:rounded-2xl">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>
            {descripcion ?? 'Datos, enlace de compra y captura de cada boleto.'}
          </DialogDescription>
        </DialogHeader>

        {opciones.length === 0 ? (
          <p className="rounded-xl border border-dashed bg-card p-4 text-sm text-muted-foreground">
            Esta solicitud no tiene boletos ni capturas registrados: se envió sin pasar por los cálculos.
          </p>
        ) : mostrarEncabezado ? (
          <div className="space-y-3">
            {grupos.map((grupo, indice) => (
              <GrupoRutaCollapsible
                key={grupo.clave}
                etiqueta={grupo.etiqueta}
                detalle={grupo.detalle}
                punto={grupo.punto}
                texto={grupo.texto}
                count={grupo.opciones.length}
                inicialmenteAbierto={indice === 0}
              >
                <ul className="space-y-3">
                  {grupo.opciones.map((opcion) => (
                    <FilaBoleto
                      key={opcion.id_opcion}
                      opcion={opcion}
                      onSolicitarCaptura={onSolicitarCaptura}
                      capturandoId={capturandoId}
                    />
                  ))}
                </ul>
              </GrupoRutaCollapsible>
            ))}
          </div>
        ) : (
          <ul className="space-y-3">
            {grupos[0]?.opciones.map((opcion) => (
              <FilaBoleto
                key={opcion.id_opcion}
                opcion={opcion}
                onSolicitarCaptura={onSolicitarCaptura}
                capturandoId={capturandoId}
              />
            ))}
          </ul>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Botón estándar para abrir los boletos del viaje. */
export function BotonVerBoleto({ onClick }: { onClick: () => void }) {
  return (
    <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={onClick}>
      <Ticket className="h-4 w-4" aria-hidden />
      Ver boletos
    </Button>
  );
}

export default BoletoViajeDialog;
