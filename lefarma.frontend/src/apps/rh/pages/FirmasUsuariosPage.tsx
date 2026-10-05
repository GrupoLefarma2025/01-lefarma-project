import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, History, Hourglass, IdCard, Loader2, PenLine, Send, Trash2, Upload, UserCheck, XCircle, ZoomIn } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import type { ColumnDef } from '@/components/ui/data-table';
import { Modal } from '@/components/ui/modal';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { API } from '@/shared/api/apiClient';
import type { ApiResponse } from '@/types/api.types';
import { usePageTitle } from '@/hooks/usePageTitle';
import { toApiError } from '@/utils/errors';
import { fetchFirmaObjectUrl, firmasEndpoints } from '@/services/firmas.service';
import { ImageZoomDialog } from '@/components/common/ImageZoomDialog';

interface FirmaUsuario {
  idUsuario: number;
  samAccountName?: string;
  nombreCompleto?: string;
  correo?: string;
  area?: string;
  firmaPath?: string;
  firmaSubidas: number;
  firmaCambioHabilitado: boolean;
  firmaCambioSolicitado: boolean;
  fechaSolicitudCambioFirma?: string;
  enComprobacion: boolean;
  fechaRemision?: string;
  tieneIne: boolean;
  firmaPendientePath?: string;
  idUsuarioHabilito?: number;
  nombreUsuarioHabilito?: string;
  fechaHabilitoFirma?: string;
}

interface FirmaHistorialEvento {
  accion: string;
  fecha: string;
  idUsuario: number;
  nombreUsuario?: string;
  motivo?: string;
}

const ACCION_META: Record<string, { label: string; icon: LucideIcon; className: string }> = {
  subida: {
    label: 'Subió la firma',
    icon: Upload,
    className: 'border border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  eliminacion: {
    label: 'Eliminó la firma',
    icon: Trash2,
    className: 'border border-red-200 bg-red-50 text-red-700',
  },
  solicitud: {
    label: 'Solicitó cambio',
    icon: Send,
    className: 'border border-amber-200 bg-amber-50 text-amber-700',
  },
  habilitacion: {
    label: 'RH habilitó cambio',
    icon: UserCheck,
    className: 'border border-blue-200 bg-blue-50 text-blue-700',
  },
  remision: {
    label: 'Envió firma a comprobación',
    icon: Hourglass,
    className: 'border border-purple-200 bg-purple-50 text-purple-700',
  },
  aprobacion: {
    label: 'RH aprobó la firma',
    icon: CheckCircle2,
    className: 'border border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  rechazo: {
    label: 'RH rechazó la firma',
    icon: XCircle,
    className: 'border border-red-200 bg-red-50 text-red-700',
  },
};

export function FirmasUsuariosPage() {
  usePageTitle('Firmas digitales', 'Control de cambios de firma de usuarios');

  const [items, setItems] = useState<FirmaUsuario[]>([]);
  const [firmaThumbs, setFirmaThumbs] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [isHabilitando, setIsHabilitando] = useState(false);
  const [selected, setSelected] = useState<FirmaUsuario | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [historialOpen, setHistorialOpen] = useState(false);
  const [historialLoading, setHistorialLoading] = useState(false);
  const [historialItems, setHistorialItems] = useState<FirmaHistorialEvento[]>([]);
  const [historialUsuario, setHistorialUsuario] = useState<FirmaUsuario | null>(null);
  const [comprobacionOpen, setComprobacionOpen] = useState(false);
  const [comprobacionUsuario, setComprobacionUsuario] = useState<FirmaUsuario | null>(null);
  const [ineBlobUrl, setIneBlobUrl] = useState<string | null>(null);
  const [pendienteBlobUrl, setPendienteBlobUrl] = useState<string | null>(null);
  const [loadingIne, setLoadingIne] = useState(false);
  const [isResolviendo, setIsResolviendo] = useState(false);
  const [rechazando, setRechazando] = useState(false);
  const [motivoRechazo, setMotivoRechazo] = useState('');
  const [zoomImage, setZoomImage] = useState<{ src: string; alt: string; title: string } | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const response = await API.get<ApiResponse<FirmaUsuario[]>>('/firmas/usuarios');
      const data = response.data.data ?? [];
      setItems(data);
      // Thumbnails: las firmas ya no son públicas; se descargan como blobs autenticados.
      const entries = await Promise.all(
        data
          .filter((u) => u.firmaPath)
          .map(async (u) =>
            [u.idUsuario, await fetchFirmaObjectUrl(firmasEndpoints.firmaUsuario(u.idUsuario))] as const,
          ),
      );
      setFirmaThumbs((prev) => {
        Object.values(prev).forEach((u) => URL.revokeObjectURL(u));
        return Object.fromEntries(entries.filter(([, url]) => url) as [number, string][]);
      });
    } catch (error) {
      toast.error(toApiError(error).message ?? 'Error al obtener las firmas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Liberar el object URL de la INE al cerrar la comprobación.
  useEffect(() => {
    return () => {
      if (ineBlobUrl) URL.revokeObjectURL(ineBlobUrl);
    };
  }, [ineBlobUrl]);

  const handleVerComprobacion = async (item: FirmaUsuario) => {
    setComprobacionUsuario(item);
    setComprobacionOpen(true);
    setRechazando(false);
    setMotivoRechazo('');
    setIneBlobUrl(null);
    setPendienteBlobUrl(null);
    setLoadingIne(true);
    try {
      const [ineUrl, pendienteUrl] = await Promise.all([
        fetchFirmaObjectUrl(firmasEndpoints.ineUsuario(item.idUsuario)),
        fetchFirmaObjectUrl(firmasEndpoints.firmaPendiente(item.idUsuario)),
      ]);
      setIneBlobUrl(ineUrl);
      setPendienteBlobUrl(pendienteUrl);
    } catch {
      // La INE puede no estar disponible; la firma pendiente igual se muestra.
    } finally {
      setLoadingIne(false);
    }
  };

  const cerrarComprobacion = () => {
    setZoomImage(null);
    setComprobacionOpen(false);
    setComprobacionUsuario(null);
    setRechazando(false);
    setMotivoRechazo('');
    if (ineBlobUrl) {
      URL.revokeObjectURL(ineBlobUrl);
      setIneBlobUrl(null);
    }
    if (pendienteBlobUrl) {
      URL.revokeObjectURL(pendienteBlobUrl);
      setPendienteBlobUrl(null);
    }
  };

  const handleAprobar = async () => {
    if (!comprobacionUsuario) return;
    try {
      setIsResolviendo(true);
      const response = await API.post<ApiResponse<boolean>>(
        `/firmas/usuarios/${comprobacionUsuario.idUsuario}/aprobar`
      );
      if (response.data.success) {
        toast.success(`Firma aprobada para ${comprobacionUsuario.nombreCompleto ?? 'el usuario'}`);
        cerrarComprobacion();
        load();
      } else {
        toast.error(response.data.message ?? 'No se pudo aprobar la firma');
      }
    } catch (error) {
      toast.error(toApiError(error).message ?? 'Error al aprobar la firma');
    } finally {
      setIsResolviendo(false);
    }
  };

  const handleRechazar = async () => {
    if (!comprobacionUsuario) return;
    if (!motivoRechazo.trim()) {
      toast.error('El motivo del rechazo es obligatorio');
      return;
    }
    try {
      setIsResolviendo(true);
      const response = await API.post<ApiResponse<boolean>>(
        `/firmas/usuarios/${comprobacionUsuario.idUsuario}/rechazar`,
        { motivo: motivoRechazo.trim() }
      );
      if (response.data.success) {
        toast.success(`Firma rechazada para ${comprobacionUsuario.nombreCompleto ?? 'el usuario'}`);
        cerrarComprobacion();
        load();
      } else {
        toast.error(response.data.message ?? 'No se pudo rechazar la firma');
      }
    } catch (error) {
      toast.error(toApiError(error).message ?? 'Error al rechazar la firma');
    } finally {
      setIsResolviendo(false);
    }
  };

  const handleVerHistorial = async (item: FirmaUsuario) => {
    setHistorialUsuario(item);
    setHistorialOpen(true);
    setHistorialLoading(true);
    try {
      const response = await API.get<ApiResponse<FirmaHistorialEvento[]>>(
        `/firmas/usuarios/${item.idUsuario}/historial`
      );
      setHistorialItems(response.data.data ?? []);
    } catch (error) {
      toast.error(toApiError(error).message ?? 'Error al obtener el historial');
      setHistorialItems([]);
    } finally {
      setHistorialLoading(false);
    }
  };

  const handleHabilitar = async () => {
    if (!selected) return;
    try {
      setIsHabilitando(true);
      const response = await API.post<ApiResponse<boolean>>(
        `/firmas/usuarios/${selected.idUsuario}/habilitar-cambio`
      );
      if (response.data.success) {
        toast.success(`Cambio habilitado para ${selected.nombreCompleto ?? 'el usuario'}`);
        setConfirmOpen(false);
        setSelected(null);
        load();
      } else {
        toast.error(response.data.message ?? 'No se pudo habilitar el cambio');
      }
    } catch (error) {
      toast.error(toApiError(error).message ?? 'Error al habilitar el cambio');
    } finally {
      setIsHabilitando(false);
    }
  };

  const columns = useMemo<ColumnDef<FirmaUsuario>[]>(() => [
    {
      accessorKey: 'nombreCompleto',
      header: 'Usuario',
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="text-sm font-medium">{row.original.nombreCompleto}</span>
          <span className="text-xs text-muted-foreground">
            {row.original.samAccountName}
            {row.original.area ? ` · ${row.original.area}` : ''}
          </span>
        </div>
      ),
    },
    {
      id: 'firma',
      header: 'Firma',
      cell: ({ row }) => {
        const url = firmaThumbs[row.original.idUsuario];
        return url ? (
          <div className="flex h-12 w-28 items-center justify-center rounded border bg-white p-1">
            <img src={url} alt="firma" className="max-h-10 max-w-full object-contain" />
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        );
      },
    },
    {
      accessorKey: 'firmaSubidas',
      header: 'Cambios',
      cell: ({ row }) => (
        <span className="text-sm tabular-nums">{row.original.firmaSubidas}</span>
      ),
    },
    {
      id: 'estado',
      header: 'Estado',
      cell: ({ row }) => {
        if (row.original.enComprobacion)
          return (
            <div className="flex flex-col gap-0.5">
              <Badge variant="default" className="bg-purple-600">En comprobación</Badge>
              {row.original.fechaRemision && (
                <span className="text-[10px] text-muted-foreground">
                  {new Date(row.original.fechaRemision).toLocaleString()}
                </span>
              )}
            </div>
          );
        if (row.original.firmaCambioHabilitado)
          return <Badge variant="default" className="bg-blue-600">Cambio habilitado</Badge>;
        if (row.original.firmaCambioSolicitado)
          return (
            <div className="flex flex-col gap-0.5">
              <Badge variant="default" className="bg-amber-600">Solicitó cambio</Badge>
              {row.original.fechaSolicitudCambioFirma && (
                <span className="text-[10px] text-muted-foreground">
                  {new Date(row.original.fechaSolicitudCambioFirma).toLocaleString()}
                </span>
              )}
            </div>
          );
        if (!row.original.firmaPath)
          return <Badge variant="outline">Sin firma</Badge>;
        return <Badge variant="secondary">Bloqueada</Badge>;
      },
    },
    {
      id: 'habilitadoPor',
      header: 'Habilitado por',
      cell: ({ row }) =>
        row.original.firmaCambioHabilitado && row.original.nombreUsuarioHabilito ? (
          <div className="flex flex-col">
            <span className="text-xs">{row.original.nombreUsuarioHabilito}</span>
            <span className="text-[10px] text-muted-foreground">
              {row.original.fechaHabilitoFirma
                ? new Date(row.original.fechaHabilitoFirma).toLocaleString()
                : ''}
            </span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex justify-end gap-1.5">
          {row.original.enComprobacion && (
            <Button
              size="sm"
              className="h-8 gap-1.5 bg-purple-600 text-white hover:bg-purple-700"
              onClick={() => handleVerComprobacion(row.original)}
            >
              <IdCard className="h-3.5 w-3.5" />
              Comprobar
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5"
            onClick={() => handleVerHistorial(row.original)}
          >
            <History className="h-3.5 w-3.5" />
            Historial
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5"
            disabled={row.original.firmaCambioHabilitado || row.original.enComprobacion || !row.original.firmaPath}
            onClick={() => {
              setSelected(row.original);
              setConfirmOpen(true);
            }}
          >
            <UserCheck className="h-3.5 w-3.5" />
            Habilitar cambio
          </Button>
        </div>
      ),
    },
  ], [firmaThumbs]);

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">
            Toda firma (nueva o cambio) pasa por comprobación: compara la firma
            enviada con la foto del INE y aprueba o rechaza con motivo. Para
            cambios, primero habilita la opción aquí (se consume al remitir).
          </p>
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        data={items}
        title="Firmas digitales de usuarios"
        subtitle="Controla qué usuarios pueden cambiar su firma"
        globalFilter
        showRefreshButton
        showRowCount
        onRefresh={load}
        loading={loading}
      />

      <Modal
        id="modal-habilitar-firma"
        open={confirmOpen}
        setOpen={setConfirmOpen}
        title="Habilitar cambio de firma"
        size="md"
        footer={
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" disabled={isHabilitando} onClick={handleHabilitar}>
              {isHabilitando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Habilitar
            </Button>
          </div>
        }
      >
        {selected && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <PenLine className="h-5 w-5 text-muted-foreground" />
              <p className="text-sm">
                Vas a habilitar <b>un solo cambio</b> de firma para{' '}
                <b>{selected.nombreCompleto}</b>.
              </p>
            </div>
            {firmaThumbs[selected.idUsuario] && (
              <div className="flex justify-center rounded-lg border bg-muted/30 p-4">
                <img
                  src={firmaThumbs[selected.idUsuario]}
                  alt="firma actual"
                  className="max-h-24 max-w-full object-contain"
                />
              </div>
            )}
            {selected.firmaCambioSolicitado && (
              <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                El usuario solicitó este cambio
                {selected.fechaSolicitudCambioFirma
                  ? ` el ${new Date(selected.fechaSolicitudCambioFirma).toLocaleString()}`
                  : ''}
                . Al habilitarlo, la solicitud queda atendida.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              El usuario podrá reemplazar su firma una vez; después quedará
              bloqueado de nuevo.
            </p>
          </div>
        )}
      </Modal>

      <Modal
        id="modal-comprobacion-firma"
        open={comprobacionOpen}
        setOpen={(o) => {
          if (!o) cerrarComprobacion();
        }}
        title="Comprobar firma"
        subtitle={comprobacionUsuario?.nombreCompleto}
        size="lg"
        footer={
          <div className="flex justify-end gap-2 pt-2">
            {rechazando ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isResolviendo}
                  onClick={() => {
                    setRechazando(false);
                    setMotivoRechazo('');
                  }}
                >
                  Volver
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={isResolviendo || !motivoRechazo.trim()}
                  onClick={handleRechazar}
                >
                  {isResolviendo && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Confirmar rechazo
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={isResolviendo}
                  onClick={() => setRechazando(true)}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Rechazar
                </Button>
                <Button type="button" disabled={isResolviendo} onClick={handleAprobar}>
                  {isResolviendo ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                  )}
                  Aprobar firma
                </Button>
              </>
            )}
          </div>
        }
      >
        {comprobacionUsuario && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Compara la firma enviada con la del INE
              {comprobacionUsuario.fechaRemision
                ? ` (remitida el ${new Date(comprobacionUsuario.fechaRemision).toLocaleString()})`
                : ''}
              . Al aprobar, la firma queda activa; al rechazar, ambas imágenes se eliminan.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Firma enviada
                  </p>
                  {pendienteBlobUrl && (
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <ZoomIn className="h-3 w-3" />
                      Clic para ampliar
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  disabled={!pendienteBlobUrl}
                  onClick={() =>
                    pendienteBlobUrl &&
                    setZoomImage({ src: pendienteBlobUrl, alt: 'Firma pendiente', title: 'Firma enviada' })
                  }
                  className="flex h-48 w-full items-center justify-center rounded-lg border bg-white p-3 transition hover:border-primary/50 disabled:cursor-default cursor-zoom-in"
                >
                  {loadingIne ? (
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  ) : pendienteBlobUrl ? (
                    <img
                      src={pendienteBlobUrl}
                      alt="Firma pendiente"
                      className="pointer-events-none max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">Sin firma pendiente</span>
                  )}
                </button>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Foto del INE
                  </p>
                  {ineBlobUrl && (
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <ZoomIn className="h-3 w-3" />
                      Clic para ampliar
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  disabled={!ineBlobUrl}
                  onClick={() =>
                    ineBlobUrl &&
                    setZoomImage({ src: ineBlobUrl, alt: 'Foto del INE', title: 'Foto del INE' })
                  }
                  className="flex h-48 w-full items-center justify-center rounded-lg border bg-white p-3 transition hover:border-primary/50 disabled:cursor-default cursor-zoom-in"
                >
                  {loadingIne ? (
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  ) : ineBlobUrl ? (
                    <img
                      src={ineBlobUrl}
                      alt="Foto del INE"
                      className="pointer-events-none max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">INE no disponible</span>
                  )}
                </button>
              </div>
            </div>
            {rechazando && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground">
                  Motivo del rechazo (obligatorio, se notifica al usuario)
                </p>
                <Textarea
                  value={motivoRechazo}
                  onChange={(e) => setMotivoRechazo(e.target.value)}
                  placeholder="Ej. La firma no coincide con la del INE"
                  rows={3}
                  disabled={isResolviendo}
                />
              </div>
            )}
          </div>
        )}
      </Modal>

      <ImageZoomDialog image={zoomImage} onClose={() => setZoomImage(null)} />

      <Modal
        id="modal-historial-firma"
        open={historialOpen}
        setOpen={setHistorialOpen}
        title="Historial de firma"
        subtitle={historialUsuario?.nombreCompleto}
        size="md"
      >
        {historialLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : historialItems.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Sin eventos registrados.
          </p>
        ) : (
          <ol>
            {historialItems.map((e, index) => {
              const meta = ACCION_META[e.accion];
              const Icon = meta?.icon ?? History;
              return (
                <li key={`${e.accion}-${e.fecha}`} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                        meta?.className ?? 'border bg-muted text-muted-foreground'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    {index < historialItems.length - 1 && (
                      <span className="my-1 w-px flex-1 bg-border" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 pb-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <p className="text-sm font-medium">{meta?.label ?? e.accion}</p>
                      <time className="text-xs tabular-nums text-muted-foreground">
                        {new Date(e.fecha).toLocaleString(undefined, {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </time>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {e.nombreUsuario ?? `Usuario #${e.idUsuario}`}
                    </p>
                    {e.accion === 'rechazo' && e.motivo && (
                      <p className="mt-0.5 text-xs text-red-700">Motivo: {e.motivo}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </Modal>
    </div>
  );
}

export default FirmasUsuariosPage;
