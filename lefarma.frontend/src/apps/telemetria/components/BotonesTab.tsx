import { useCallback, useEffect, useMemo, useState } from 'react';
import { Flame, RefreshCw, Search } from 'lucide-react';
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
import type { BotonResumen, RutaResumen } from '../types';
import { fechaHora, numero, porcentaje, recortar } from '../utils';

interface Props {
  desde: Date;
  hasta: Date;
}

export function BotonesTab({ desde, hasta }: Props) {
  const [ruta, setRuta] = useState('');
  const [botones, setBotones] = useState<BotonResumen[]>([]);
  const [rutas, setRutas] = useState<RutaResumen[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(
    async (rutaFiltro: string) => {
      setCargando(true);
      setError(null);
      try {
        const [datos, rutasPeriodo] = await Promise.all([
          telemetriaApi.botones(desde, hasta, rutaFiltro),
          telemetriaApi.rutas(desde, hasta).catch(() => []),
        ]);
        setBotones(datos);
        setRutas(rutasPeriodo);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudieron cargar los clics.');
      } finally {
        setCargando(false);
      }
    },
    [desde, hasta],
  );

  useEffect(() => {
    const temporizador = window.setTimeout(() => {
      void cargar(ruta);
    }, 350);
    return () => window.clearTimeout(temporizador);
  }, [ruta, cargar]);

  const totalClics = useMemo(
    () => botones.reduce((suma, boton) => suma + boton.clics, 0),
    [botones],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={ruta}
            onChange={(evento) => setRuta(evento.target.value)}
            placeholder="Filtrar por ruta, p. ej. /viaticos/mis-viajes"
            className="pl-9"
            aria-label="Filtrar clics por ruta"
            list="telemetria-rutas"
          />
          <datalist id="telemetria-rutas">
            {rutas.slice(0, 50).map((item) => (
              <option key={item.ruta} value={item.ruta} />
            ))}
          </datalist>
        </div>
        <Button variant="outline" size="sm" onClick={() => void cargar(ruta)} disabled={cargando}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Actualizar
        </Button>
        <span className="text-xs text-muted-foreground">
          {numero(botones.length)} botones · {numero(totalClics)} clics
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
                  <TableHead>Botón</TableHead>
                  <TableHead>Ruta</TableHead>
                  <TableHead className="text-right">Clics</TableHead>
                  <TableHead className="text-right">Usuarios</TableHead>
                  <TableHead className="text-right">Clics seguidos</TableHead>
                  <TableHead>Último clic</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {botones.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                      No hay clics registrados en el periodo.
                    </TableCell>
                  </TableRow>
                )}
                {botones.map((boton) => {
                  const enojo = porcentaje(boton.clicsDeEnojo, boton.clics);
                  return (
                    <TableRow key={`${boton.ruta}-${boton.elemento}`}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {recortar(boton.etiqueta ?? boton.elemento, 60)}
                          </span>
                          <span className="font-mono text-[11px] text-muted-foreground">
                            {boton.elemento}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate text-xs text-muted-foreground">
                        {boton.ruta}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {numero(boton.clics)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {numero(boton.usuariosUnicos)}
                      </TableCell>
                      <TableCell className="text-right">
                        {boton.clicsDeEnojo > 0 ? (
                          <Badge variant="outline" className="gap-1 border-amber-200 text-amber-700">
                            <Flame className="h-3 w-3" />
                            {numero(boton.clicsDeEnojo)} ({enojo})
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {fechaHora(boton.ultimoClic)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        «Clics seguidos» cuenta los clics al mismo botón con menos de un segundo de diferencia:
        suele indicar que la acción no respondió como la persona esperaba.
      </p>
    </div>
  );
}
