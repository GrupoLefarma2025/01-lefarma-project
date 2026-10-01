import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { usePageTitle } from '@/hooks/usePageTitle';
import { toast } from 'sonner';
import { toApiError } from '@/utils/errors';
import { costosRutaApi } from '@/apps/educacion-medica/services/costosRuta.api';
import type { CostosRutaResponse } from '@/apps/educacion-medica/types/costosRuta.types';
import { Loader2 } from 'lucide-react';

const EJEMPLO = `{
  "personas": [
    {
      "nombre": "Ana",
      "carro_propio": true,
      "gasolina": "magna",
      "draft": true,
      "trabajo": {
        "hora_entrada": "08:00",
        "hora_salida": "18:30",
        "primer_dia_laboral": 1,
        "ultimo_dia_laboral": 5
      },
      "lugares": [
        {
          "orden": 1,
          "tipo": "salida",
          "nombre": "CDMX base",
          "latitud": 19.4326,
          "longitud": -99.1332,
          "fecha_salida": "2026-10-15",
          "hora_salida": "06:00"
        },
        {
          "orden": 2,
          "tipo": "taller",
          "nombre": "Taller Puebla 1",
          "latitud": 19.0414,
          "longitud": -98.2063,
          "fecha_inicio_actividad": "2026-10-15",
          "hora_inicio_actividad": "10:00",
          "fecha_fin_actividad": "2026-10-15",
          "hora_fin_actividad": "14:00"
        },
        {
          "orden": 3,
          "tipo": "taller",
          "nombre": "Taller Puebla 2",
          "latitud": 19.052,
          "longitud": -98.21,
          "fecha_inicio_actividad": "2026-10-16",
          "hora_inicio_actividad": "09:00",
          "fecha_fin_actividad": "2026-10-16",
          "hora_fin_actividad": "12:00"
        }
      ]
    }
  ]
}`;

function mxn(n: number): string {
  return `$${n.toLocaleString('es-MX', { maximumFractionDigits: 0 })} MXN`;
}

export function CostosDemoPage() {
  usePageTitle('Costos demo', 'Educación Médica');
  const [jsonText, setJsonText] = useState(EJEMPLO);
  const [respetarHorario, setRespetarHorario] = useState(true);
  const [calcularHoteles, setCalcularHoteles] = useState(true);
  const [calcularIntermedios, setCalcularIntermedios] = useState(true);
  const [compartir, setCompartir] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<CostosRutaResponse | null>(null);

  const payloadPreview = useMemo(() => {
    try {
      const parsed = JSON.parse(jsonText) as { personas?: unknown[] } | unknown[];
      const personas = Array.isArray(parsed) ? parsed : (parsed.personas ?? []);
      return { personas: (personas as unknown[]).length };
    } catch {
      return null;
    }
  }, [jsonText]);

  async function calcular() {
    let parsed: { personas?: unknown[] } | unknown[];
    try {
      parsed = JSON.parse(jsonText) as { personas?: unknown[] } | unknown[];
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'JSON inválido');
      return;
    }
    const personas = Array.isArray(parsed) ? parsed : (parsed.personas ?? []);
    if (personas.length === 0) {
      toast.error("Manda 'personas' con al menos 1 persona.");
      return;
    }
    setLoading(true);
    try {
      const res = await costosRutaApi.calcular({
        opciones: {
          respetarHorarioLaboral: respetarHorario,
          calcularHoteles,
          calcularViajesIntermedios: calcularIntermedios,
          compartirViaje: compartir,
        },
        personas,
      });
      if (!res.data.success || !res.data.data) {
        toast.error(res.data.message ?? 'Error al calcular el itinerario');
        return;
      }
      setData(res.data.data);
      toast.success('Itinerario calculado exitosamente.');
    } catch (error: unknown) {
      toast.error(toApiError(error).message ?? 'Error al calcular el itinerario');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Costos de ruta (demo aislada · fase 1)</CardTitle>
          <CardDescription>
            Pega el JSON de personas, ajusta las opciones y calcula precios + itinerario.
            {payloadPreview
              ? ` ${payloadPreview.personas} persona(s) en el JSON.`
              : ' El JSON no es válido.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            rows={18}
            className="font-mono text-xs"
            spellCheck={false}
          />
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2">
              <Checkbox
                id="opt-horario"
                checked={respetarHorario}
                onCheckedChange={(v) => setRespetarHorario(v === true)}
              />
              <Label htmlFor="opt-horario">Respetar horario laboral</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="opt-hoteles"
                checked={calcularHoteles}
                onCheckedChange={(v) => setCalcularHoteles(v === true)}
              />
              <Label htmlFor="opt-hoteles">Calcular hoteles</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="opt-intermedios"
                checked={calcularIntermedios}
                onCheckedChange={(v) => setCalcularIntermedios(v === true)}
              />
              <Label htmlFor="opt-intermedios">Calcular viajes intermedios</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="opt-compartir" checked={compartir} onCheckedChange={setCompartir} />
              <Label htmlFor="opt-compartir">Compartir viaje</Label>
            </div>
            <Button onClick={calcular} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Calcular precios y proponer itinerario
            </Button>
          </div>
        </CardContent>
      </Card>

      {data && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Propuestas ({data.propuestas.length})</CardTitle>
              <CardDescription>Costo, horarios, margen y cumplimiento por propuesta.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              {data.propuestas.map((p) => (
                <Card key={`${p.persona}-${p.clave}`}>
                  <CardHeader>
                    <CardTitle className="text-base">{p.titulo}</CardTitle>
                    <CardDescription>
                      {p.persona} · sale {p.salidaOrigen} → llega {p.llegadaFinal} · margen{' '}
                      {p.margenMinimoMinutos} min
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{mxn(p.costoTotalMxn)}</span>
                      <Badge variant={p.cumpleTodos ? 'default' : 'destructive'}>
                        {p.cumpleTodos ? 'cumple' : 'no cumple'}
                      </Badge>
                    </div>
                    {p.incumplimientos.length > 0 && (
                      <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                        {p.incumplimientos.map((inc, ix) => (
                          <li key={ix}>{inc}</li>
                        ))}
                      </ul>
                    )}
                    <div className="text-xs text-muted-foreground">
                      Fuentes: {p.fuentes.join(' · ') || '—'}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>

          {data.resultados.map((r) => (
            <Card key={r.nombre}>
              <CardHeader>
                <CardTitle>Ruta armada · {r.nombre}</CardTitle>
                <CardDescription>Magna vs premium (12 km/L fijos) + totales.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tramo</TableHead>
                      <TableHead className="text-right">Km</TableHead>
                      <TableHead className="text-right">Litros</TableHead>
                      <TableHead className="text-right">Magna</TableHead>
                      <TableHead className="text-right">Premium</TableHead>
                      <TableHead className="text-right">Casetas</TableHead>
                      <TableHead className="text-right">Subt. magna</TableHead>
                      <TableHead className="text-right">Subt. premium</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {r.rutaArmada.tramos.map((t, ix) => (
                      <TableRow key={ix}>
                        <TableCell>
                          {t.de} → {t.a}
                        </TableCell>
                        <TableCell className="text-right">{t.km}</TableCell>
                        <TableCell className="text-right">{t.litros}</TableCell>
                        <TableCell className="text-right">
                          ${t.gasolina.magna.precioL}/L · {mxn(t.gasolina.magna.costo)}
                        </TableCell>
                        <TableCell className="text-right">
                          ${t.gasolina.premium.precioL}/L · {mxn(t.gasolina.premium.costo)}
                        </TableCell>
                        <TableCell className="text-right">{mxn(t.casetas.costo)}</TableCell>
                        <TableCell className="text-right">{mxn(t.subtotalMagna)}</TableCell>
                        <TableCell className="text-right">{mxn(t.subtotalPremium)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell className="font-semibold">Totales</TableCell>
                      <TableCell className="text-right font-semibold">{r.rutaArmada.totales.km}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {r.rutaArmada.totales.litros}
                      </TableCell>
                      <TableCell className="text-right">—</TableCell>
                      <TableCell className="text-right">—</TableCell>
                      <TableCell className="text-right font-semibold">
                        {mxn(r.rutaArmada.totales.casetas)}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {mxn(r.rutaArmada.totales.subtotalMagna)}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {mxn(r.rutaArmada.totales.subtotalPremium)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>

                {r.tramos.map((t, ix) => (
                  <div key={ix} className="space-y-1 text-sm">
                    <div className="font-medium">
                      Tramo {ix + 1}: {t.from} → {t.to} ({t.km} km)
                    </div>
                    <ul className="space-y-1">
                      {t.opciones.slice(0, 8).map((o) => (
                        <li key={o.id} className="flex flex-wrap items-center gap-2">
                          <span>
                            {o.linea} · {o.salidaTxt} → {o.llegadaTxt} · {o.precioTxt}
                          </span>
                          {o.badge && <Badge variant="outline">{o.badge}</Badge>}
                          {!o.aTiempo && <Badge variant="destructive">tarde</Badge>}
                          <a
                            href={o.comprar.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary underline"
                          >
                            {o.comprar.accion} ↗
                          </a>
                          <span className="text-xs text-muted-foreground">({o.fuente})</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}

                {r.hotelesPropuestos.length > 0 && (
                  <div className="space-y-1 text-sm">
                    <div className="font-medium">Hoteles propuestos</div>
                    <ul className="space-y-1">
                      {r.hotelesPropuestos.map((h, ix) => (
                        <li key={ix}>
                          {h.lugar} · {h.ciudad} · {h.checkIn} → {h.checkOut} · {h.motivo} ·{' '}
                          <a href={h.link} target="_blank" rel="noreferrer" className="text-primary underline">
                            reservar ↗
                          </a>{' '}
                          <span className="text-xs text-muted-foreground">({h.fuente})</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          {data.compartidos.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Viajes compartidos</CardTitle>
                <CardDescription>Ahorro estimado por persona.</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 text-sm">
                  {data.compartidos.map((c, ix) => (
                    <li key={ix}>
                      {c.de} → {c.a} · {c.personas.join(', ')}
                      {c.conductor ? ` · maneja ${c.conductor}` : ''} · ahorro {mxn(c.ahorroEstimadoMxn)} ·{' '}
                      {c.nota}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
