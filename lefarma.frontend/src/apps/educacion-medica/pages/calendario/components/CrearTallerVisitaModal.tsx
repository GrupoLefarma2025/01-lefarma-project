import { useEffect, useState } from 'react';
import { AlertTriangle, CalendarDays, Loader2, Presentation, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/ui/modal';
import { Textarea } from '@/components/ui/textarea';
import { usePermission } from '@/hooks/usePermission';
import { educacionMedicaApi } from '../../../services/educacionMedica.api';
import type {
  CalendarioItem,
  Producto,
  Taller,
  TipoVisitaOpcion,
} from '../../../types/educacionMedica.types';
import { fechaLarga, fmtHora } from '../calendarioUtils';
import { toApiError } from '@/utils/errors';

const SIN_PRODUCTO = 'producto-default';

interface CrearTallerVisitaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: CalendarioItem | null;
  onSaved: (taller: Taller) => void;
}

export function CrearTallerVisitaModal({
  open,
  onOpenChange,
  item,
  onSaved,
}: CrearTallerVisitaModalProps) {
  const puedeGestionarRutas = usePermission({
    require: 'educacion_medica.rutas.puede_gestionar',
  });
  const puedeAjustarRutas = usePermission({
    require: 'educacion_medica.rutas.puede_ajustar',
  });

  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState('');
  const [talleresExistentes, setTalleresExistentes] = useState<Taller[]>([]);
  const [participantes, setParticipantes] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [tema, setTema] = useState('');
  const [idTipoVisita, setIdTipoVisita] = useState('');
  const [tiposVisita, setTiposVisita] = useState<TipoVisitaOpcion[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [idProducto, setIdProducto] = useState(SIN_PRODUCTO);
  const [cantidadProducto, setCantidadProducto] = useState('1');
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- reinicio del formulario al abrir el modal */
  useEffect(() => {
    if (!open) return;
    setFecha(item?.fecha ?? '');
    setHora(item?.hora?.slice(0, 5) ?? '');
    setParticipantes(item?.participantes ? String(item.participantes) : '');
    setObservaciones('');
    setTema(item?.tema ?? '');
    setIdTipoVisita(item?.idTipoVisita ? String(item.idTipoVisita) : '');
    setIdProducto(SIN_PRODUCTO);
    setCantidadProducto('1');
    setMotivo('');
    setError(null);
  }, [open, item]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!open || tiposVisita.length > 0) return;
    void educacionMedicaApi.tipoVisita
      .getAll()
      .then((response) => {
        if (!response.data.success) return;
        const tipos = response.data.data ?? [];
        setTiposVisita(tipos);
        if (!item?.idTipoVisita && item?.tipoVisita) {
          const coincidencia = tipos.find((tipo) => tipo.descripcion === item.tipoVisita);
          if (coincidencia) setIdTipoVisita(String(coincidencia.idTipoVisita));
        }
      })
      .catch(() => setTiposVisita([]));
  }, [open, item?.idTipoVisita, item?.tipoVisita, tiposVisita.length]);

  useEffect(() => {
    if (!open || productos.length > 0) return;
    void educacionMedicaApi.productos
      .getAll()
      .then((response) => {
        if (response.data.success) setProductos(response.data.data ?? []);
      })
      .catch(() => setProductos([]));
  }, [open, productos.length]);

  useEffect(() => {
    if (!open || !item?.idRutaVisita) return;
    void educacionMedicaApi.talleres
      .getByVisita(item.idRutaVisita)
      .then((response) => {
        if (response.data.success) setTalleresExistentes(response.data.data ?? []);
      })
      .catch(() => setTalleresExistentes([]));
  }, [open, item?.idRutaVisita]);

  const fechaDistinta = Boolean(item && fecha && fecha !== item.fecha);
  const requiereAjuste = item?.estadoRuta === 'Cerrada';
  const puedeCambiarFecha = puedeGestionarRutas && (!requiereAjuste || puedeAjustarRutas);
  const motivoValido = !fechaDistinta || !requiereAjuste || motivo.trim().length >= 5;
  const horarioDuplicado = Boolean(
    item &&
    fecha === item.fecha &&
    hora &&
    talleresExistentes.some(
      (taller) =>
        taller.fechaTaller?.slice(0, 10) === fecha && taller.horaTaller?.slice(0, 5) === hora
    )
  );

  const guardar = async () => {
    if (!item) return;
    if (!hora) {
      setError('Selecciona la hora del taller.');
      return;
    }
    if (horarioDuplicado) {
      setError('Ya existe un taller para esta visita en esa fecha y hora. Elige otra hora.');
      return;
    }
    if (fechaDistinta && !puedeCambiarFecha) {
      setError('No tienes permiso para crear una visita en otra fecha.');
      return;
    }
    if (fechaDistinta && requiereAjuste && motivo.trim().length < 5) {
      setError('El motivo del ajuste es obligatorio.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        idRutaVisita: item.idRutaVisita,
        idTipoVisita: idTipoVisita ? Number(idTipoVisita) : null,
        numeroParticipantes: participantes ? Number(participantes) : null,
        observaciones: observaciones.trim() || null,
        tema: tema.trim() || null,
        recursos:
          idProducto !== SIN_PRODUCTO
            ? [
                {
                  tipoRecurso: 'Producto',
                  idProducto,
                  cantidad: Number(cantidadProducto) || 1,
                },
              ]
            : null,
        fechaTaller: fecha || item.fecha,
        horaTaller: hora,
        motivoAjuste: fechaDistinta ? motivo.trim() || null : null,
      };
      const response = fechaDistinta
        ? await educacionMedicaApi.talleres.crearDesdeVisita(payload)
        : await educacionMedicaApi.talleres.crear(payload);

      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.message ?? 'No se pudo crear el taller.');
      }

      toast.success(
        fechaDistinta ? 'Nueva visita y taller programados.' : 'Taller programado en la visita.'
      );
      onOpenChange(false);
      onSaved(response.data.data);
    } catch (err: unknown) {
      setError(toApiError(err).message ?? 'No se pudo crear el taller.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      id="calendario-crear-taller"
      open={open}
      setOpen={onOpenChange}
      title="Programar taller"
      subtitle="El hospital y los responsables se heredan de la visita."
      size="xl"
      footer={
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button
            className="bg-[#eb6c36] text-white hover:bg-[#d95a2b]"
            onClick={() => void guardar()}
            disabled={
              saving ||
              !motivoValido ||
              !hora ||
              horarioDuplicado ||
              (fechaDistinta && !puedeCambiarFecha)
            }
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Programar taller
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="rounded-2xl border border-orange-200/70 bg-orange-50/60 p-4 dark:border-orange-900/60 dark:bg-orange-950/30">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-orange-600 shadow-sm dark:bg-orange-900/50 dark:text-orange-300">
              <Presentation className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                {item?.hospital ?? 'Hospital'}
              </p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" />
                  Visita: {item ? fechaLarga(item.fecha) : 'Sin fecha'}
                </span>
                {item?.hora && <span>{fmtHora(item.hora)}</span>}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="grid gap-2">
            <Label htmlFor="calendario-fecha-taller">Fecha del taller</Label>
            <Input
              id="calendario-fecha-taller"
              type="date"
              value={fecha}
              disabled={!puedeCambiarFecha}
              onChange={(event) => setFecha(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="calendario-hora-taller">Hora del taller</Label>
            <Input
              id="calendario-hora-taller"
              type="time"
              value={hora}
              onChange={(event) => setHora(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="calendario-participantes">Participantes estimados</Label>
            <div className="relative">
              <Users className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="calendario-participantes"
                className="pl-9"
                type="number"
                min={0}
                placeholder="Ej. 24"
                value={participantes}
                onChange={(event) => setParticipantes(event.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="grid gap-2">
          <Label>Tipo de visita</Label>
          <Select
            value={idTipoVisita}
            onValueChange={setIdTipoVisita}
            disabled={!puedeGestionarRutas}
          >
            <SelectTrigger className="h-10">
              <SelectValue placeholder="Selecciona el tipo" />
            </SelectTrigger>
            <SelectContent>
              {tiposVisita.map((tipo) => (
                <SelectItem key={tipo.idTipoVisita} value={String(tipo.idTipoVisita)}>
                  {tipo.descripcion}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[10px] text-slate-500 dark:text-slate-400">
            {puedeGestionarRutas
              ? 'Clasifica la visita para reportes e indicadores.'
              : 'Necesitas permiso de gestión de rutas para cambiar el tipo.'}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_110px]">
          <div className="grid gap-2">
            <Label>Producto del taller</Label>
            <Select value={idProducto} onValueChange={setIdProducto}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Producto predeterminado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SIN_PRODUCTO}>Producto predeterminado</SelectItem>
                {productos.map((producto) => (
                  <SelectItem key={producto.codigoProducto} value={String(producto.codigoProducto)}>
                    {producto.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="calendario-cantidad-producto">Cantidad</Label>
            <Input
              id="calendario-cantidad-producto"
              type="number"
              min={1}
              value={cantidadProducto}
              onChange={(event) => setCantidadProducto(event.target.value)}
              disabled={idProducto === SIN_PRODUCTO}
            />
          </div>
        </div>

        {horarioDuplicado && (
          <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50/80 px-3 py-2.5 text-[11px] leading-relaxed text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>Ya existe un taller para esta visita a las {hora}. Elige otra hora.</span>
          </div>
        )}

        {fechaDistinta && (
          <div
            className={[
              'flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-[11px] leading-relaxed',
              puedeCambiarFecha
                ? 'border-sky-200 bg-sky-50/80 text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300'
                : 'border-rose-200 bg-rose-50/80 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300',
            ].join(' ')}
          >
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              {!puedeGestionarRutas
                ? 'Para otra fecha necesitas permiso de gestión de rutas.'
                : requiereAjuste && !puedeAjustarRutas
                  ? 'La ruta está cerrada. Solo el CEM puede autorizar el ajuste con rutas.puede_ajustar.'
                  : requiereAjuste
                    ? 'La ruta está cerrada: se creará otra visita y el ajuste quedará auditado con el motivo.'
                    : 'Se creará otra visita para este hospital en la fecha indicada.'}
            </span>
          </div>
        )}

        {fechaDistinta && requiereAjuste && puedeAjustarRutas && (
          <div className="grid gap-2">
            <Label htmlFor="calendario-motivo-ajuste">Motivo del ajuste</Label>
            <Textarea
              id="calendario-motivo-ajuste"
              rows={2}
              placeholder="Explica por qué se agrega otra visita a una ruta cerrada."
              value={motivo}
              onChange={(event) => setMotivo(event.target.value)}
            />
          </div>
        )}

        <div className="grid gap-2">
          <Label htmlFor="calendario-tema">Tema del taller</Label>
          <Input
            id="calendario-tema"
            placeholder="Ej. Manejo de antibióticos en el paciente crítico"
            value={tema}
            onChange={(event) => setTema(event.target.value)}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="calendario-observaciones">Notas de programación</Label>
          <Textarea
            id="calendario-observaciones"
            rows={3}
            placeholder="Indicaciones para el taller, tema o material especial."
            value={observaciones}
            onChange={(event) => setObservaciones(event.target.value)}
          />
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 px-3 py-2.5 text-xs leading-relaxed text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
          El producto se toma de la matriz del ejecutivo. Si no hay matriz, se usa el producto
          predeterminado con cantidad 2.
        </div>

        {error && (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
