import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertTriangle, MousePointerClick, MonitorSmartphone, Percent } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import type { EstadoTelemetria, ResumenTelemetria } from '../types';
import { fechaHora, numero, porcentaje, recortar } from '../utils';

interface Props {
  desde: Date;
  hasta: Date;
}

export function ResumenTab({ desde, hasta }: Props) {
  const [resumen, setResumen] = useState<ResumenTelemetria | null>(null);
  const [estado, setEstado] = useState<EstadoTelemetria | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [datosResumen, datosEstado] = await Promise.all([
        telemetriaApi.resumen(desde, hasta),
        telemetriaApi.estado().catch(() => null),
      ]);
      setResumen(datosResumen);
      setEstado(datosEstado);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el resumen.');
    } finally {
      setCargando(false);
    }
  }, [desde, hasta]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  if (cargando) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((indice) => (
          <Skeleton key={indice} className="h-28 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-destructive">{error}</CardContent>
      </Card>
    );
  }

  if (!resumen) return null;

  const datosGrafica = resumen.topErrores.slice(0, 8).map((item) => ({
    nombre: recortar(item.mensaje, 44),
    ocurrencias: item.ocurrencias,
  }));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <TarjetaIndicador
          titulo="Errores hoy"
          valor={numero(resumen.erroresHoy)}
          icono={<AlertTriangle className="h-5 w-5 text-orange-600" />}
        />
        <TarjetaIndicador
          titulo="Errores del periodo"
          valor={numero(resumen.erroresPeriodo)}
          detalle={`${resumen.topErrores.length} huellas distintas`}
          icono={<AlertTriangle className="h-5 w-5 text-red-600" />}
        />
        <TarjetaIndicador
          titulo="Clics del periodo"
          valor={numero(resumen.clicsPeriodo)}
          detalle={`${resumen.topBotones.length} botones con actividad`}
          icono={<MousePointerClick className="h-5 w-5 text-blue-600" />}
        />
        <TarjetaIndicador
          titulo="Visitas"
          valor={numero(resumen.visitasPeriodo)}
          detalle={
            resumen.visitasPeriodo > 0
              ? `${(resumen.clicsPeriodo / resumen.visitasPeriodo).toFixed(1)} clics por visita`
              : 'Sin visitas'
          }
          icono={<MonitorSmartphone className="h-5 w-5 text-emerald-600" />}
        />
      </div>

      {estado && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant={estado.almacen.disponible ? 'secondary' : 'destructive'}>
            Almacén {estado.almacen.disponible ? 'disponible' : 'no disponible'}
          </Badge>
          <span>Cola: {numero(estado.cola.pendientes)} pendientes de {numero(estado.cola.capacidad)}</span>
          <span>·</span>
          <span>Escritos: {numero(estado.escritor.eventosEscritos)}</span>
          {estado.cola.descartados > 0 && (
            <>
              <span>·</span>
              <span className="text-amber-600">Descartados: {numero(estado.cola.descartados)}</span>
            </>
          )}
          {estado.almacen.error && (
            <>
              <span>·</span>
              <span className="text-destructive">{estado.almacen.error}</span>
            </>
          )}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Errores con más ocurrencias</CardTitle>
          </CardHeader>
          <CardContent>
            {datosGrafica.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Sin errores en el periodo.
              </p>
            ) : (
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={datosGrafica} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis type="category" dataKey="nombre" width={220} tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(valor) => [numero(Number(valor)), 'Ocurrencias']}
                      labelStyle={{ fontSize: 12 }}
                    />
                    <Bar dataKey="ocurrencias" fill="#eb6c36" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Botones más usados</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Botón</TableHead>
                  <TableHead>Ruta</TableHead>
                  <TableHead className="text-right">Clics</TableHead>
                  <TableHead className="text-right">Enojo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resumen.topBotones.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                      Sin clics en el periodo.
                    </TableCell>
                  </TableRow>
                )}
                {resumen.topBotones.map((boton) => (
                  <TableRow key={`${boton.ruta}-${boton.elemento}`}>
                    <TableCell className="max-w-[180px] truncate" title={boton.etiqueta ?? boton.elemento}>
                      {boton.etiqueta ?? boton.elemento}
                    </TableCell>
                    <TableCell className="max-w-[160px] truncate text-xs text-muted-foreground">
                      {boton.ruta}
                    </TableCell>
                    <TableCell className="text-right">{numero(boton.clics)}</TableCell>
                    <TableCell className="text-right">
                      {boton.clicsDeEnojo > 0 ? (
                        <Badge variant="outline" className="gap-1 text-amber-700">
                          <Percent className="h-3 w-3" />
                          {porcentaje(boton.clicsDeEnojo, boton.clics)}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {resumen.eventosDescartados > 0 && (
        <p className="text-xs text-amber-600">
          {numero(resumen.eventosDescartados)} eventos no se pudieron escribir (revisa el estado del
          almacén). Último vaciado: {fechaHora(estado?.escritor.ultimoVaciado)}.
        </p>
      )}
    </div>
  );
}

function TarjetaIndicador({
  titulo,
  valor,
  detalle,
  icono,
}: {
  titulo: string;
  valor: string;
  detalle?: string;
  icono: ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 py-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{titulo}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{valor}</p>
          {detalle && <p className="mt-1 text-xs text-muted-foreground">{detalle}</p>}
        </div>
        {icono}
      </CardContent>
    </Card>
  );
}
