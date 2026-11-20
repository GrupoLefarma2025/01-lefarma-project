import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, MousePointer2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { telemetriaApi } from '../services/telemetriaApi';
import type { MapaCalorResumen, RutaResumen } from '../types';
import { colorCalor, descargarCsv, numero } from '../utils';

interface Props {
  desde: Date;
  hasta: Date;
}

export function MapaCalorTab({ desde, hasta }: Props) {
  const [rutas, setRutas] = useState<RutaResumen[]>([]);
  const [ruta, setRuta] = useState<string>('');
  const [mapa, setMapa] = useState<MapaCalorResumen | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargarRutas = useCallback(async () => {
    try {
      const datos = await telemetriaApi.rutas(desde, hasta);
      setRutas(datos);
      if (!ruta && datos.length > 0) {
        setRuta(datos[0].ruta);
      }
    } catch {
      setRutas([]);
    }
  }, [desde, hasta, ruta]);

  useEffect(() => {
    setRuta('');
    void cargarRutas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desde, hasta]);

  const cargarMapa = useCallback(async () => {
    if (!ruta) return;
    setCargando(true);
    setError(null);
    try {
      setMapa(await telemetriaApi.mapaCalor(ruta, desde, hasta));
    } catch {
      setMapa(null);
      setError('No hay movimientos del puntero para esa ruta en el periodo.');
    } finally {
      setCargando(false);
    }
  }, [ruta, desde, hasta]);

  useEffect(() => {
    void cargarMapa();
  }, [cargarMapa]);

  const maximo = useMemo(
    () => (mapa ? Math.max(1, ...mapa.celdas) : 1),
    [mapa],
  );

  const celdasVisibles = useMemo(
    () => (mapa ? mapa.celdas.filter((valor) => valor > 0).length : 0),
    [mapa],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={ruta} onValueChange={setRuta}>
          <SelectTrigger className="w-[320px]" aria-label="Ruta del mapa de calor">
            <SelectValue placeholder="Elige una ruta" />
          </SelectTrigger>
          <SelectContent>
            {rutas.map((item) => (
              <SelectItem key={item.ruta} value={item.ruta}>
                {item.ruta} ({numero(item.clics)} clics)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => void cargarMapa()} disabled={cargando || !ruta}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Actualizar
        </Button>
        {mapa && (
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              descargarCsv(
                `mapa-calor-${mapa.ruta.replace(/[^a-z0-9]+/gi, '-')}.csv`,
                mapa.celdas.map((valor, indice) => ({
                  celda: indice,
                  columna: indice % mapa.columnas,
                  fila: Math.floor(indice / mapa.columnas),
                  movimientos: valor,
                })),
              )
            }
          >
            <Download className="mr-2 h-4 w-4" />
            CSV
          </Button>
        )}
        <span className="text-xs text-muted-foreground">
          {rutas.length} rutas con actividad · {numero(celdasVisibles)} celdas con movimiento
        </span>
      </div>

      {error && <p className="text-sm text-amber-600">{error}</p>}

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">
              {mapa ? mapa.ruta : 'Movimiento del puntero'}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {mapa
                ? `${numero(mapa.totalMovimientos)} movimientos · rejilla ${mapa.columnas}×${mapa.filas} de ${mapa.tamanoCelda} px`
                : 'Elige una ruta para ver dónde se detiene el puntero.'}
            </p>
          </div>
          {mapa && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <MousePointer2 className="h-4 w-4" />
              <div className="flex items-center gap-1">
                <span>menos</span>
                {[0.15, 0.35, 0.55, 0.75, 0.95].map((alfa) => (
                  <span
                    key={alfa}
                    className="inline-block h-3 w-5 rounded-sm"
                    style={{ backgroundColor: `rgba(235, 108, 54, ${alfa})` }}
                  />
                ))}
                <span>más</span>
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {cargando ? (
            <Skeleton className="h-[420px] w-full" />
          ) : mapa ? (
            <div className="space-y-3">
              <div
                className="grid w-full overflow-hidden rounded-md border bg-muted/20"
                style={{
                  gridTemplateColumns: `repeat(${mapa.columnas}, minmax(0, 1fr))`,
                }}
                role="img"
                aria-label={`Mapa de calor de ${mapa.ruta}`}
              >
                {mapa.celdas.map((valor, indice) => (
                  <div
                    key={indice}
                    className="aspect-[4/3] border border-white/40"
                    style={{ backgroundColor: colorCalor(valor, maximo) }}
                    title={`Celda ${indice}: ${numero(valor)} movimientos`}
                  />
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                El calor es una aproximación de dónde se detuvo el ratón, no de dónde miró la
                persona. Si el diseño de la pantalla cambió dentro del periodo, las zonas viejas
                no coinciden con la versión actual.
              </p>
            </div>
          ) : (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Sin movimientos del puntero para esa ruta en el periodo.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
