import { Fragment, useEffect, useMemo, useState } from 'react';
import { API } from '@/shared/api/apiClient';
import type { ApiResponse } from '@/types/api.types';
import type { MacroViatico } from '@/types/macroViatico.types';
import { toApiError } from '@/utils/errors';
import {
  AGRUPACION_VIATICO_LABELS,
  buildHeader,
  claveGrupoViatico,
  fmtFechaLarga,
  fmtMoney,
  ordenarViaticos,
  sumarCostos,
  texto,
  totalViatico,
  valorAgrupacion,
  type AgrupacionViatico,
} from '@/utils/concentradoViaticos.helpers';
import { generarConcentradoViaticosPDF } from '@/utils/generarConcentradoViaticosPDF';
import { ConcentradoViaticosPDF } from '@/components/ordenes/ConcentradoViaticosPDF';
import { fetchFirmaObjectUrl, firmasEndpoints } from '@/services/firmas.service';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  CheckSquare,
  LayoutGrid,
  Printer,
  RefreshCw,
  Send,
  Square,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Pestaña Viáticos del concentrado de CxP.
 *
 * La tabla `dbo.infoMacroViaticos` la llena un proceso externo y no tiene
 * estado de workflow ni `idOrden`: aquí se selecciona, se previsualiza, se
 * imprime, se descarga y se envía a autorización el PDF FOR-008.
 */

const AGRUPACIONES: Array<{ value: AgrupacionViatico; label: string }> = [
  { value: 'nombre', label: AGRUPACION_VIATICO_LABELS.nombre },
  { value: 'gerencia', label: AGRUPACION_VIATICO_LABELS.gerencia },
  { value: 'fecha', label: AGRUPACION_VIATICO_LABELS.fecha },
];

function hoyIso(): string {
  const d = new Date();
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

export interface EnvioConcentradoViaticosProps {
  refreshToken: number;
}

export default function EnvioConcentradoViaticos({
  refreshToken,
}: EnvioConcentradoViaticosProps) {
  const [filas, setFilas] = useState<MacroViatico[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [agrupacion, setAgrupacion] = useState<AgrupacionViatico>('gerencia');
  const [generando, setGenerando] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [firmaDiego, setFirmaDiego] = useState<string | null>(null);
  const [firmaLuis, setFirmaLuis] = useState<string | null>(null);
  const [firmaErick, setFirmaErick] = useState<string | null>(null);
  const [firmasCargadas, setFirmasCargadas] = useState(false);
  const [showEnvio, setShowEnvio] = useState(false);
  const [comentario, setComentario] = useState(
    'Concentrado de viáticos enviado a autorización',
  );
  const [enviando, setEnviando] = useState(false);
  const [envioError, setEnvioError] = useState<string | null>(null);
  const [envioOk, setEnvioOk] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    const objectUrls: string[] = [];

    Promise.all([
      fetchFirmaObjectUrl(firmasEndpoints.firmaUsuario(63)),
      fetchFirmaObjectUrl(firmasEndpoints.firmaUsuario(23)),
      fetchFirmaObjectUrl(firmasEndpoints.firmaUsuario(56)),
    ]).then(([diego, luis, erick]) => {
      if (cancelado) {
        if (diego) URL.revokeObjectURL(diego);
        if (luis) URL.revokeObjectURL(luis);
        if (erick) URL.revokeObjectURL(erick);
        return;
      }
      if (diego) objectUrls.push(diego);
      if (luis) objectUrls.push(luis);
      if (erick) objectUrls.push(erick);
      setFirmaDiego(diego);
      setFirmaLuis(luis);
      setFirmaErick(erick);
      setFirmasCargadas(true);
    });

    return () => {
      cancelado = true;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  useEffect(() => {
    let cancelado = false;

    const cargar = async () => {
      setLoading(true);
      setFetchError(null);
      try {
        const res = await API.get<ApiResponse<MacroViatico[]>>(
          '/viaticos/macro-concentrado',
        );
        if (cancelado) return;

        const data = res.data.data ?? [];
        setFilas(data);
        // Si un folio desapareció entre refrescos, se descarta de la selección.
        setSelected((prev) => {
          const vigentes = new Set(data.map((fila) => fila.folio));
          return new Set([...prev].filter((folio) => vigentes.has(folio)));
        });
      } catch (e) {
        if (!cancelado) {
          setFetchError(
            toApiError(e).message ||
              'No se pudo cargar el concentrado de viáticos.',
          );
        }
      } finally {
        if (!cancelado) setLoading(false);
      }
    };

    cargar();
    return () => {
      cancelado = true;
    };
  }, [refreshToken]);

  const filasOrdenadas = useMemo(
    () => ordenarViaticos(filas, agrupacion),
    [filas, agrupacion],
  );

  const seleccionadas = useMemo(
    () => filasOrdenadas.filter((fila) => selected.has(fila.folio)),
    [filasOrdenadas, selected],
  );

  const totalSeleccionado = useMemo(
    () => sumarCostos(seleccionadas).total,
    [seleccionadas],
  );

  const header = useMemo(() => buildHeader(seleccionadas), [seleccionadas]);

  const grupos = useMemo(() => {
    const mapa = new Map<string, { label: string; items: MacroViatico[] }>();
    for (const fila of filasOrdenadas) {
      const label = valorAgrupacion(fila, agrupacion);
      const grupo = mapa.get(label);
      if (grupo) grupo.items.push(fila);
      else mapa.set(label, { label, items: [fila] });
    }
    return Array.from(mapa.values());
  }, [filasOrdenadas, agrupacion]);

  const grupoActivo = useMemo(() => {
    const primera = seleccionadas[0] ?? grupos[0]?.items[0];
    return primera ? claveGrupoViatico(primera) : null;
  }, [seleccionadas, grupos]);

  const filasGrupoActivo = useMemo(
    () => filasOrdenadas.filter((fila) => claveGrupoViatico(fila) === grupoActivo),
    [filasOrdenadas, grupoActivo],
  );

  const estaBloqueada = (fila: MacroViatico) =>
    selected.size > 0 &&
    claveGrupoViatico(fila) !== grupoActivo &&
    !selected.has(fila.folio);

  const toggleSelect = (fila: MacroViatico) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(fila.folio)) {
        next.delete(fila.folio);
        return next;
      }

      if (prev.size > 0) {
        const primera = filas.find((f) => prev.has(f.folio));
        if (primera && claveGrupoViatico(primera) !== claveGrupoViatico(fila)) {
          return prev;
        }
      }

      next.add(fila.folio);
      return next;
    });
  };

  const todosSeleccionados =
    filasGrupoActivo.length > 0 &&
    filasGrupoActivo.every((fila) => selected.has(fila.folio));
  const algunosSeleccionados =
    filasGrupoActivo.some((fila) => selected.has(fila.folio)) &&
    !todosSeleccionados;

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (todosSeleccionados) {
        filasGrupoActivo.forEach((fila) => next.delete(fila.folio));
      } else {
        filasGrupoActivo.forEach((fila) => next.add(fila.folio));
      }
      return next;
    });
  };

  const faltantesGrupo = useMemo(
    () => filasGrupoActivo.filter((fila) => !selected.has(fila.folio)),
    [filasGrupoActivo, selected],
  );

  const generarPdf = async (): Promise<Blob | null> => {
    if (seleccionadas.length === 0) return null;

    setGenerando(true);
    setPdfError(null);
    try {
      return await generarConcentradoViaticosPDF({
        filas: seleccionadas,
        nombre: header.nombre,
        gerencia: header.gerencia,
        fecha: header.fecha,
        firmas: { diego: firmaDiego, luis: firmaLuis, erick: firmaErick },
      });
    } catch (e) {
      setPdfError(
        toApiError(e).message || 'No se pudo generar el concentrado de viáticos.',
      );
      return null;
    } finally {
      setGenerando(false);
    }
  };

  const handleImprimir = async () => {
    const blob = await generarPdf();
    if (!blob) return;

    const url = URL.createObjectURL(blob);
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.src = url;

    iframe.onload = () => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      window.setTimeout(() => {
        URL.revokeObjectURL(url);
        iframe.remove();
      }, 3000);
    };

    document.body.appendChild(iframe);
  };

  const handleEnviar = async () => {
    if (seleccionadas.length === 0) return;

    setEnviando(true);
    setEnvioError(null);
    setEnvioOk(null);
    try {
      const pdfBlob = await generarPdf();
      if (!pdfBlob) {
        setEnvioError('No se pudo generar el PDF del concentrado.');
        return;
      }

      const formData = new FormData();
      for (const fila of seleccionadas) {
        formData.append('Folios', fila.folio);
      }
      formData.append('nombre', `concentrado-viaticos-${hoyIso()}`);
      formData.append('gerencia', header.gerencia);
      formData.append('fecha', header.fecha);
      formData.append(
        'comentario',
        comentario.trim() || 'Concentrado de viáticos enviado a autorización',
      );
      formData.append('usuario', '41@Grupolefarma');
      formData.append('correo', '41@grupolefarma.com.mx');
      formData.append('correoCC', '');
      formData.append(
        'archivo',
        pdfBlob,
        `concentrado-viaticos-${hoyIso()}.pdf`,
      );

      const res = await API.post<
        ApiResponse<{
          idDocumento: string;
          nombreArchivo: string;
          totalFolios: number;
        }>
      >('/viaticos/macro-concentrado/pdf', formData);
      const documento = res.data.data;
      const foliosEnviados = new Set(seleccionadas.map((fila) => fila.folio));
      setFilas((prev) => prev.filter((fila) => !foliosEnviados.has(fila.folio)));
      setEnvioOk(
        `Concentrado enviado. Documento ${documento?.idDocumento ?? ''} guardado en app.Documentos.`,
      );
      setShowEnvio(false);
      setSelected(new Set());
    } catch (error: unknown) {
      const err = toApiError(error);
      setEnvioError(err.message || 'No se pudo enviar el concentrado.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="flex flex-col h-full gap-4">
      {envioOk && (
        <div
          role="status"
          className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-900"
        >
          {envioOk}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-3 bg-muted/40 border rounded-lg px-3 py-2">
        <div className="flex items-center gap-1.5 text-sm font-medium">
          <LayoutGrid className="h-4 w-4 text-muted-foreground" />
          Agrupar por:
        </div>
        <Select
          value={agrupacion}
          onValueChange={(v) => setAgrupacion(v as AgrupacionViatico)}
        >
          <SelectTrigger className="h-7 w-36 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AGRUPACIONES.map((a) => (
              <SelectItem key={a.value} value={a.value} className="text-xs">
                {a.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          <span>{filas.length} viáticos disponibles</span>
          {selected.size > 0 && (
            <Badge variant="secondary" className="text-xs">
              {selected.size} seleccionados
            </Badge>
          )}
        </div>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Panel izquierdo: tabla */}
        <div className="flex flex-col gap-3 w-[55%] min-w-0">
          <div className="border rounded-lg overflow-auto flex-1">
            {loading ? (
              <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                Cargando viáticos…
              </div>
            ) : fetchError ? (
              <div className="flex flex-col items-center justify-center h-40 text-sm text-destructive gap-2 px-4 text-center">
                <span>{fetchError}</span>
                <span className="text-xs text-muted-foreground">
                  Usa «Actualizar» para reintentar.
                </span>
              </div>
            ) : filas.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-sm text-muted-foreground gap-1">
                <span className="text-2xl">🧾</span>
                <span>No hay viáticos pendientes de envío</span>
                <span className="text-xs opacity-60">
                  Los viáticos enviados se ocultan automáticamente.
                </span>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="w-10">
                      <button
                        onClick={toggleAll}
                        className="flex items-center justify-center"
                        title={
                          todosSeleccionados
                            ? 'Deseleccionar grupo'
                            : 'Seleccionar grupo'
                        }
                      >
                        {todosSeleccionados ? (
                          <CheckSquare className="h-4 w-4 text-primary" />
                        ) : algunosSeleccionados ? (
                          <CheckSquare className="h-4 w-4 text-primary opacity-50" />
                        ) : (
                          <Square className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>
                    </TableHead>
                    <TableHead className="w-12 text-xs font-semibold text-right">
                      No.
                    </TableHead>
                    <TableHead className="text-xs font-semibold">Folio</TableHead>
                    <TableHead className="text-xs font-semibold">
                      {AGRUPACION_VIATICO_LABELS[agrupacion]}
                    </TableHead>
                    <TableHead className="text-xs font-semibold">
                      Solicitante
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-right">
                      Fecha
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-right">
                      Total
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {grupos.map((grupo) => (
                    <Fragment key={grupo.label}>
                      <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableCell colSpan={7} className="text-xs font-semibold">
                          {AGRUPACION_VIATICO_LABELS[agrupacion]}: {grupo.label}
                        </TableCell>
                      </TableRow>
                      {grupo.items.map((fila) => {
                        const isSelected = selected.has(fila.folio);
                        const bloqueada = estaBloqueada(fila);
                        return (
                          <TableRow
                            key={fila.folio}
                            className={cn(
                              'cursor-pointer transition-colors',
                              isSelected
                                ? 'bg-primary/10 hover:bg-primary/20'
                                : 'hover:bg-muted/40',
                              bloqueada && 'opacity-50',
                            )}
                            onClick={() => toggleSelect(fila)}
                          >
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={isSelected}
                                disabled={bloqueada}
                                onCheckedChange={() => toggleSelect(fila)}
                              />
                            </TableCell>
                            <TableCell className="text-xs text-right tabular-nums text-muted-foreground">
                              {fila.renglon ?? '—'}
                            </TableCell>
                            <TableCell className="text-xs font-mono font-medium">
                              {fila.folio}
                            </TableCell>
                            <TableCell className="text-xs">
                              {valorAgrupacion(fila, agrupacion)}
                            </TableCell>
                            <TableCell className="text-xs">
                              {texto(fila.solicitante)}
                            </TableCell>
                            <TableCell className="text-xs text-right text-muted-foreground">
                              {fmtFechaLarga(fila.fechInicio)}
                            </TableCell>
                            <TableCell className="text-xs text-right font-medium">
                              {fmtMoney(totalViatico(fila))}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {selected.size > 0 && (
            <div className="flex items-center justify-between border rounded-lg px-4 py-2.5 bg-primary/5 border-primary/20">
              <div className="text-sm">
                <span className="font-semibold text-primary">{selected.size}</span>
                <span className="text-muted-foreground ml-1">
                  {selected.size === 1
                    ? 'viático seleccionado'
                    : 'viáticos seleccionados'}
                </span>
              </div>
              <div className="text-sm font-bold text-primary">
                {fmtMoney(totalSeleccionado)}
              </div>
            </div>
          )}
        </div>

        {/* Panel derecho: vista previa */}
        <div className="flex flex-col gap-3 flex-1 min-w-0">
          <div className="flex items-center justify-between bg-muted/40 border rounded-lg px-3 py-2">
            <span className="text-sm font-medium text-muted-foreground">
              Vista previa del PDF
            </span>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 h-7 text-xs"
                onClick={handleImprimir}
                disabled={
                  seleccionadas.length === 0 ||
                  generando ||
                  enviando ||
                  !firmasCargadas
                }
              >
                <Printer className="h-3.5 w-3.5" />
                Vista previa
              </Button>
              <Button
                size="sm"
                className="gap-1.5 h-7 text-xs"
                onClick={() => {
                  setEnvioError(null);
                  setShowEnvio(true);
                }}
                disabled={
                  seleccionadas.length === 0 ||
                  generando ||
                  enviando ||
                  !firmasCargadas
                }
              >
                <Send className="h-3.5 w-3.5" />
                Enviar a concentrado
              </Button>
            </div>
          </div>

          <div className="flex-1 border rounded-lg overflow-auto bg-zinc-100 dark:bg-zinc-900 p-3">
            {seleccionadas.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                <div className="text-4xl opacity-30">📄</div>
                <span className="text-sm">
                  Selecciona viáticos para ver la vista previa del PDF
                </span>
                <span className="text-xs opacity-60">
                  El documento usa el formato institucional ASK-ADM-FOR-008
                </span>
              </div>
            ) : (
              <ConcentradoViaticosPDF
                filas={seleccionadas}
                nombre={header.nombre}
                gerencia={header.gerencia}
                fecha={header.fecha}
                firmas={{ diego: firmaDiego, luis: firmaLuis, erick: firmaErick }}
              />
            )}
          </div>

          {pdfError && (
            <div className="text-xs text-destructive px-1">{pdfError}</div>
          )}
        </div>
      </div>

      <Dialog
        open={showEnvio}
        onOpenChange={(open) => {
          if (!enviando) setShowEnvio(open);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Enviar concentrado de viáticos</DialogTitle>
          </DialogHeader>

          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 rounded-lg border bg-muted/30 p-3 text-sm">
            <dt className="text-muted-foreground">Nombre de quien se envía:</dt>
            <dd className="font-medium">{texto(header.nombre)}</dd>
            <dt className="text-muted-foreground">Fecha:</dt>
            <dd>{texto(header.fecha)}</dd>
            <dt className="text-muted-foreground">Gerencia:</dt>
            <dd>{texto(header.gerencia)}</dd>
            <dt className="text-muted-foreground">Número de órdenes:</dt>
            <dd className="font-medium">{seleccionadas.length}</dd>
          </dl>

          {faltantesGrupo.length > 0 && (
            <div className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <p className="text-sm font-semibold text-destructive">
                Solo seleccionaste {seleccionadas.length} de{' '}
                {filasGrupoActivo.length} órdenes.
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-destructive/80">
                  Las órdenes faltantes son:
                </span>
                {faltantesGrupo.map((fila) => (
                  <Badge
                    key={fila.folio}
                    variant="destructive"
                    className="font-mono text-[10px]"
                  >
                    {fila.folio}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="comentario-envio-viaticos">Comentario</Label>
            <Textarea
              id="comentario-envio-viaticos"
              rows={4}
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              disabled={enviando}
              className="min-h-24 resize-none"
              placeholder="Escribe un comentario para el concentrado"
            />
            {envioError && (
              <p className="text-xs text-destructive">{envioError}</p>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowEnvio(false)}
              disabled={enviando}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleEnviar}
              disabled={enviando || !firmasCargadas}
            >
              {enviando ? 'Enviando…' : 'Confirmar envío'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
