import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { telemetriaApi } from '../services/telemetriaApi';
import type { PaginaErrorServidor } from '../types';
import { fechaHora, numero, recortar, severidadClase } from '../utils';

interface Props {
  desde: Date;
  hasta: Date;
}

const TAMANO = 25;

export function ErroresServidorTab({ desde, hasta }: Props) {
  const [texto, setTexto] = useState('');
  const [severidad, setSeveridad] = useState('todas');
  const [pagina, setPagina] = useState(1);
  const [datos, setDatos] = useState<PaginaErrorServidor | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(
    async (busqueda: string, severidadElegida: string, paginaElegida: number) => {
      setCargando(true);
      setError(null);
      try {
        setDatos(
          await telemetriaApi.erroresServidor({
            desde,
            hasta,
            texto: busqueda,
            severidad: severidadElegida === 'todas' ? undefined : severidadElegida,
            pagina: paginaElegida,
            tamano: TAMANO,
          }),
        );
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'No se pudieron leer los errores del servidor.',
        );
      } finally {
        setCargando(false);
      }
    },
    [desde, hasta],
  );

  useEffect(() => {
    const temporizador = window.setTimeout(() => {
      void cargar(texto, severidad, pagina);
    }, 350);
    return () => window.clearTimeout(temporizador);
  }, [texto, severidad, pagina, cargar]);

  const totalPaginas = datos ? Math.max(1, Math.ceil(datos.total / datos.tamano)) : 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={texto}
            onChange={(evento) => {
              setPagina(1);
              setTexto(evento.target.value);
            }}
            placeholder="Buscar por mensaje o tipo de excepción…"
            className="pl-9"
            aria-label="Buscar errores del servidor"
          />
        </div>
        <Select
          value={severidad}
          onValueChange={(valor) => {
            setPagina(1);
            setSeveridad(valor);
          }}
        >
          <SelectTrigger className="w-[160px]" aria-label="Severidad">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas</SelectItem>
            <SelectItem value="Critical">Crítico</SelectItem>
            <SelectItem value="Error">Error</SelectItem>
            <SelectItem value="Warning">Advertencia</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void cargar(texto, severidad, pagina)}
          disabled={cargando}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Actualizar
        </Button>
        <span className="text-xs text-muted-foreground">
          {numero(datos?.total ?? 0)} errores
        </span>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card>
        <CardContent className="p-0">
          {cargando ? (
            <div className="space-y-2 p-4">
              {[0, 1, 2, 3].map((indice) => (
                <Skeleton key={indice} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Severidad</TableHead>
                  <TableHead>Error</TableHead>
                  <TableHead>Ruta</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead className="text-right">Duración</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(datos?.elementos.length ?? 0) === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                      El servidor no registró errores en el periodo.
                    </TableCell>
                  </TableRow>
                )}
                {datos?.elementos.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {fechaHora(item.fechaError)}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${severidadClase(item.severidad)}`}
                      >
                        {item.severidad}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="font-medium" title={item.mensajeError}>
                          {recortar(item.mensajeError, 110)}
                        </span>
                        <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          <Badge variant="outline">{item.tipoExcepcion}</Badge>
                          {item.statusCode && <span>HTTP {item.statusCode}</span>}
                          {item.requestId && (
                            <span className="font-mono">{item.requestId.slice(0, 8)}</span>
                          )}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[190px] truncate text-xs text-muted-foreground">
                      {item.metodoHttp ? `${item.metodoHttp} ` : ''}
                      {item.rutaEndpoint ?? '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {item.nombreUsuario ?? '—'}
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                      {item.durationMs !== null ? `${numero(item.durationMs)} ms` : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPagina((valor) => Math.max(1, valor - 1))}
          disabled={pagina <= 1 || cargando}
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Anterior
        </Button>
        <span className="text-xs text-muted-foreground">
          Página {pagina} de {totalPaginas}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPagina((valor) => Math.min(totalPaginas, valor + 1))}
          disabled={pagina >= totalPaginas || cargando}
        >
          Siguiente
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
