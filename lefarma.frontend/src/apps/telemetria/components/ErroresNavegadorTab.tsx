import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, RefreshCw, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import type { HuellaErrorResumen, OcurrenciaError } from '../types';
import { fechaHora, numero, recortar } from '../utils';

interface Props {
  desde: Date;
  hasta: Date;
}

export function ErroresNavegadorTab({ desde, hasta }: Props) {
  const [texto, setTexto] = useState('');
  const [errores, setErrores] = useState<HuellaErrorResumen[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [ocurrencias, setOcurrencias] = useState<Record<string, OcurrenciaError[]>>({});
  const [cargandoOcurrencias, setCargandoOcurrencias] = useState(false);

  const cargar = useCallback(
    async (busqueda: string) => {
      setCargando(true);
      setError(null);
      try {
        setErrores(await telemetriaApi.errores(desde, hasta, busqueda));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudieron cargar los errores.');
      } finally {
        setCargando(false);
      }
    },
    [desde, hasta],
  );

  useEffect(() => {
    const temporizador = window.setTimeout(() => {
      void cargar(texto);
    }, 350);
    return () => window.clearTimeout(temporizador);
  }, [texto, cargar]);

  const alternar = async (huella: string) => {
    if (abierta === huella) {
      setAbierta(null);
      return;
    }
    setAbierta(huella);
    if (ocurrencias[huella]) return;

    setCargandoOcurrencias(true);
    try {
      const datos = await telemetriaApi.ocurrencias(huella, 1, 25);
      setOcurrencias((previo) => ({ ...previo, [huella]: datos }));
    } catch {
      setOcurrencias((previo) => ({ ...previo, [huella]: [] }));
    } finally {
      setCargandoOcurrencias(false);
    }
  };

  const totalOcurrencias = useMemo(
    () => errores.reduce((suma, item) => suma + item.ocurrencias, 0),
    [errores],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={texto}
            onChange={(evento) => setTexto(evento.target.value)}
            placeholder="Buscar por mensaje o huella…"
            className="pl-9"
            aria-label="Buscar errores del navegador"
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => void cargar(texto)} disabled={cargando}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Actualizar
        </Button>
        <span className="text-xs text-muted-foreground">
          {numero(errores.length)} huellas · {numero(totalOcurrencias)} ocurrencias
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
                  <TableHead className="w-8" />
                  <TableHead>Error</TableHead>
                  <TableHead>Ruta</TableHead>
                  <TableHead className="text-right">Ocurrencias</TableHead>
                  <TableHead className="text-right">Usuarios</TableHead>
                  <TableHead>Última vez</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {errores.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                      No hay errores del navegador en el periodo.
                    </TableCell>
                  </TableRow>
                )}
                {errores.map((item) => {
                  const expandida = abierta === item.huella;
                  return (
                    <Fragment key={item.huella}>
                      <TableRow
                        className="cursor-pointer"
                        onClick={() => void alternar(item.huella)}
                      >
                        <TableCell>
                          {expandida ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <span className="font-medium" title={item.mensaje}>
                              {recortar(item.mensaje, 110)}
                            </span>
                            <span className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Badge variant="outline">{item.tipoError}</Badge>
                              <span>huella {item.huella}</span>
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                          {item.ruta}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {numero(item.ocurrencias)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {numero(item.usuariosAfectados)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {fechaHora(item.ultimaVez)}
                        </TableCell>
                      </TableRow>
                      {expandida && (
                        <TableRow key={`${item.huella}-detalle`}>
                          <TableCell colSpan={6} className="bg-muted/30">
                            {cargandoOcurrencias && !ocurrencias[item.huella] ? (
                              <Skeleton className="h-16 w-full" />
                            ) : (
                              <ListaOcurrencias ocurrencias={ocurrencias[item.huella] ?? []} />
                            )}
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ListaOcurrencias({ ocurrencias }: { ocurrencias: OcurrenciaError[] }) {
  if (ocurrencias.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin ocurrencias registradas.</p>;
  }

  return (
    <div className="space-y-3">
      {ocurrencias.map((ocurrencia) => (
        <div key={`${ocurrencia.recibidoEn}-${ocurrencia.requestId ?? ''}`} className="rounded-md border bg-background p-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{fechaHora(ocurrencia.ocurridoEn)}</span>
            <span>·</span>
            <span>{ocurrencia.ruta}</span>
            {ocurrencia.navegador && (
              <>
                <span>·</span>
                <span>{ocurrencia.navegador}</span>
              </>
            )}
            {ocurrencia.estadoHttp && (
              <>
                <span>·</span>
                <Badge variant="outline">HTTP {ocurrencia.estadoHttp}</Badge>
              </>
            )}
            {ocurrencia.requestId && (
              <>
                <span>·</span>
                <span className="font-mono">{ocurrencia.requestId}</span>
              </>
            )}
          </div>
          <p className="mt-2 text-sm">{ocurrencia.mensaje}</p>
          {ocurrencia.stack && (
            <pre className="mt-2 max-h-48 overflow-auto rounded bg-muted p-2 text-[11px] leading-relaxed">
              {ocurrencia.stack}
            </pre>
          )}
        </div>
      ))}
    </div>
  );
}
