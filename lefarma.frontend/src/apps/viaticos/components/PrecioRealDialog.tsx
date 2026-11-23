import { useRef, useState } from 'react';
import { Camera, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toApiError } from '@/utils/errors';
import { evidenciasApi, type DatosViaje } from '../services/evidencias.api';
import { solicitudesApi } from '../services/solicitudes.api';
import { importeFormateado, precioReferenciaOpcion } from '../types/aprobaciones.types';
import type { Solicitud, SolicitudOpcion } from '../types/solicitud.types';
import { useCapturaAutenticada } from './celdasCotizacion';

export interface PrecioRealDialogProps {
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
  solicitudId: number;
  opcion: SolicitudOpcion;
  datosAgente?: DatosViaje | null;
  onGuardado: (solicitud: Solicitud) => void;
}

function fuenteDeUrl(url: string | null): string {
  if (!url) return 'Captura manual';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'Captura manual';
  }
}

export function PrecioRealDialog({
  abierto,
  onOpenChange,
  solicitudId,
  opcion,
  datosAgente = null,
  onGuardado,
}: PrecioRealDialogProps) {
  const transportista = datosAgente?.transportista?.trim() ?? '';
  const horario = datosAgente?.salida && datosAgente?.llegada
    ? `${datosAgente.salida}–${datosAgente.llegada}`
    : '';
  const lineaInicial = transportista
    ? `${transportista}${horario ? ` ${horario}` : ''}`
    : (/estimad/i.test(opcion.linea) ? '' : opcion.linea);
  const precioInicial = typeof datosAgente?.precio === 'number' && Number.isFinite(datosAgente.precio)
    ? String(datosAgente.precio)
    : '';

  const [linea, setLinea] = useState(lineaInicial);
  const [precio, setPrecio] = useState(precioInicial);
  const [moneda, setMoneda] = useState(datosAgente?.moneda || opcion.moneda || 'MXN');
  const [fuente, setFuente] = useState(fuenteDeUrl(opcion.url_compra));
  const [urlCompra, setUrlCompra] = useState(opcion.url_compra ?? '');
  const [salida, setSalida] = useState(datosAgente?.salida ?? '');
  const [llegada, setLlegada] = useState(datosAgente?.llegada ?? '');
  const [rutaCaptura, setRutaCaptura] = useState<string | null>(opcion.ruta_captura);
  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputArchivoRef = useRef<HTMLInputElement>(null);
  const captura = useCapturaAutenticada(rutaCaptura ?? undefined);

  const referencia = precioReferenciaOpcion(opcion);
  const precioNumero = Number(precio);
  const precioValido = Number.isFinite(precioNumero) && precioNumero > 0;
  const lineaValida = linea.trim() !== '' && !/estimad/i.test(linea);
  const fuenteValida = fuente.trim() !== '' && !/estimad/i.test(fuente);
  const urlValida = /^https?:\/\//i.test(urlCompra.trim());
  const capturaValida =
    typeof rutaCaptura === 'string' && rutaCaptura.startsWith('capturas-viaticos/');
  const puedeGuardar =
    !guardando
    && !subiendo
    && !generando
    && precioValido
    && lineaValida
    && fuenteValida
    && urlValida
    && capturaValida;

  async function subirCaptura(archivo: File) {
    setSubiendo(true);
    setError(null);
    try {
      const { data } = await evidenciasApi.subirCaptura(solicitudId, opcion.id_opcion, archivo);
      const evidencia = data.data.opciones.find((item) => item.id_opcion === opcion.id_opcion);
      if (evidencia?.ruta_captura) {
        setRutaCaptura(evidencia.ruta_captura);
        toast.success('Captura subida.');
      } else {
        setError('La captura se subió, pero el servidor no devolvió su ruta.');
      }
    } catch (falla: unknown) {
      setError(toApiError(falla).message || 'No se pudo subir la captura.');
    } finally {
      setSubiendo(false);
    }
  }

  async function generarCaptura() {
    setGenerando(true);
    setError(null);
    try {
      const { data } = await evidenciasApi.generar(solicitudId);
      const evidencia = data.data.opciones.find((item) => item.id_opcion === opcion.id_opcion);
      if (evidencia?.ruta_captura) {
        setRutaCaptura(evidencia.ruta_captura);
        toast.success('Captura generada.');
      } else {
        setError('No se pudo generar la captura. Revisa el enlace o sube un PNG.');
      }
    } catch (falla: unknown) {
      setError(toApiError(falla).message || 'No se pudo generar la captura.');
    } finally {
      setGenerando(false);
    }
  }

  async function guardar() {
    if (!rutaCaptura) {
      setError('Genera o sube la captura del precio antes de guardarlo.');
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      const { data } = await solicitudesApi.registrarPrecioReal(solicitudId, opcion.id_opcion, {
        linea: linea.trim(),
        precio: precioNumero,
        moneda: moneda.trim() || 'MXN',
        fuente: fuente.trim(),
        url_compra: urlCompra.trim(),
        ruta_captura: rutaCaptura,
        salida: salida.trim() || null,
        llegada: llegada.trim() || null,
      });
      if (!data.success || !data.data) {
        setError(data.message ?? 'No se pudo registrar el precio real.');
        return;
      }
      toast.success('Precio real registrado.');
      onGuardado(data.data);
      onOpenChange(false);
    } catch (falla: unknown) {
      setError(toApiError(falla).message || 'No se pudo registrar el precio real.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[94vw] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Precio real · {opcion.linea}</DialogTitle>
          <DialogDescription>
            El estimado del motor es solo una referencia. Captura el precio de la página
            y su evidencia; desde ese momento la opción cuenta como cotizada.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 p-3 text-sm">
            <Badge variant="secondary">Estimado</Badge>
            <span>
              Referencia actual:{' '}
              {referencia === null ? 'sin importe' : importeFormateado(referencia, opcion.moneda)}
            </span>
            {typeof datosAgente?.precio === 'number' && Number.isFinite(datosAgente.precio) ? (
              <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                Agente: {importeFormateado(datosAgente.precio, datosAgente.moneda ?? opcion.moneda)}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setPrecio(String(datosAgente.precio))}
                >
                  Usar
                </Button>
              </span>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="precio-real-linea">Aerolínea / línea</Label>
              <Input
                id="precio-real-linea"
                value={linea}
                onChange={(evento) => setLinea(evento.target.value)}
                placeholder="Aeroméxico 08:00–09:34"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="precio-real-importe">Precio real</Label>
              <Input
                id="precio-real-importe"
                type="number"
                min="0"
                step="0.01"
                value={precio}
                onChange={(evento) => setPrecio(evento.target.value)}
                placeholder="4974.00"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="precio-real-moneda">Moneda</Label>
              <Input
                id="precio-real-moneda"
                value={moneda}
                onChange={(evento) => setMoneda(evento.target.value)}
                placeholder="MXN"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="precio-real-fuente">Fuente</Label>
              <Input
                id="precio-real-fuente"
                value={fuente}
                onChange={(evento) => setFuente(evento.target.value)}
                placeholder="kayak.com.mx"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="precio-real-url">URL de compra</Label>
              <Input
                id="precio-real-url"
                value={urlCompra}
                onChange={(evento) => setUrlCompra(evento.target.value)}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="precio-real-salida">Salida</Label>
              <Input
                id="precio-real-salida"
                value={salida}
                onChange={(evento) => setSalida(evento.target.value)}
                placeholder="2026-11-20T08:00"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="precio-real-llegada">Llegada</Label>
              <Input
                id="precio-real-llegada"
                value={llegada}
                onChange={(evento) => setLlegada(evento.target.value)}
                placeholder="2026-11-20T09:34"
              />
            </div>
          </div>

          <div className="space-y-2 rounded-md border p-3">
            <p className="text-sm font-medium">Evidencia</p>
            {rutaCaptura && captura.url ? (
              <a href={captura.url} target="_blank" rel="noreferrer" className="block">
                <img
                  src={captura.url}
                  alt={`Captura de ${opcion.linea}`}
                  className="max-h-56 w-full rounded-md border object-contain"
                />
              </a>
            ) : (
              <p className="text-xs text-muted-foreground">
                {rutaCaptura ? 'Cargando captura…' : 'Sin captura: el precio real no se puede guardar sin ella.'}
              </p>
            )}
            {captura.error ? <p className="text-xs text-destructive">{captura.error}</p> : null}
            {rutaCaptura && !capturaValida ? (
              <p className="text-xs text-destructive">
                La captura actual no es del sistema; genera o sube una nueva.
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 px-2 text-xs"
                onClick={() => void generarCaptura()}
                disabled={generando || subiendo}
              >
                <Camera className="h-3.5 w-3.5" aria-hidden />
                {generando ? 'Generando…' : 'Generar captura'}
              </Button>
              <input
                ref={inputArchivoRef}
                type="file"
                accept="image/png,.png"
                className="hidden"
                onChange={(evento) => {
                  const archivo = evento.target.files?.[0];
                  evento.target.value = '';
                  if (archivo) void subirCaptura(archivo);
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 px-2 text-xs"
                onClick={() => inputArchivoRef.current?.click()}
                disabled={subiendo || generando}
              >
                <Upload className="h-3.5 w-3.5" aria-hidden />
                {subiendo ? 'Subiendo…' : 'Subir PNG'}
              </Button>
            </div>
          </div>

          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void guardar()} disabled={!puedeGuardar}>
            {guardando ? 'Guardando…' : 'Guardar precio real'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default PrecioRealDialog;
