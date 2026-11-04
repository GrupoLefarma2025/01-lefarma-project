import { useState, type ElementType, type ReactNode } from 'react';
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileSignature,
  MapPin,
  Plus,
  Route,
  Sparkles,
  Target,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Progress } from '@/components/ui/progress';
import type { SeleccionDetalle } from '@/apps/educacion-medica/types/educacionMedica.types';
import { formatearFechaSeleccion, formatearPeriodoSeleccion } from './seleccionUtils';

interface SeleccionResumenCardProps {
  detalle: SeleccionDetalle;
  editable: boolean;
  guardando: boolean;
  rankingCargando: boolean;
  onPlanificarRutas: () => void;
  onAgregarHospital: () => void;
  onSugerirHospitales: () => void;
}

const TONOS = {
  blue: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300',
  emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300',
  violet: 'bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-300',
  orange: 'bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-300',
} as const;

function KpiTile({
  icon: Icon,
  label,
  value,
  detail,
  tone,
  alerta = false,
  children,
}: {
  icon: ElementType;
  label: string;
  value: string | number;
  detail: string;
  tone: keyof typeof TONOS;
  alerta?: boolean;
  children?: ReactNode;
}) {
  return (
    <div
      className={[
        'rounded-lg border px-2.5 py-2',
        alerta
          ? 'border-amber-200 bg-amber-50/60 dark:border-amber-900/60 dark:bg-amber-950/20'
          : 'border-slate-200/80 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/40',
      ].join(' ')}
    >
      <div className="flex items-center gap-2">
        <span className={`flex h-6 w-6 items-center justify-center rounded-md ${TONOS[tone]}`}>
          <Icon className="h-3 w-3" />
        </span>
        <p className="text-[9px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          {label}
        </p>
      </div>
      <p className="mt-1.5 text-lg font-semibold leading-none tabular-nums">{value}</p>
      <p
        className={[
          'mt-0.5 text-[10px]',
          alerta ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground',
        ].join(' ')}
      >
        {detail}
      </p>
      {children}
    </div>
  );
}

function FirmaBadge({ nombre, fecha }: { nombre: string; fecha: string | null }) {
  return (
    <span
      title={fecha ? `Firmada el ${fecha}` : 'Pendiente de firma'}
      className={[
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium',
        fecha
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300'
          : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300',
      ].join(' ')}
    >
      {fecha ? <CheckCircle2 className="h-3 w-3" /> : <Clock3 className="h-3 w-3" />}
      {nombre} {fecha ? 'Firmada' : 'Pendiente'}
    </span>
  );
}

export function SeleccionResumenCard({
  detalle,
  editable,
  guardando,
  rankingCargando,
  onPlanificarRutas,
  onAgregarHospital,
  onSugerirHospitales,
}: SeleccionResumenCardProps) {
  const totalRegiones = detalle.regiones.length;
  const regionesConResponsable = detalle.regiones.filter(
    (region) => region.idEjecutivo != null || region.idEquipo != null
  ).length;
  const regionesConAdvertencia = detalle.regiones.filter((region) => region.advertenciaMinimo).length;
  const hospitalesSinRegion = detalle.hospitales.filter((hospital) => hospital.idRegion == null).length;
  const cobertura =
    totalRegiones > 0 ? Math.round((regionesConResponsable / totalRegiones) * 100) : 0;
  const firmaGg = detalle.firmaGgFecha ? formatearFechaSeleccion(detalle.firmaGgFecha) : null;
  const firmaGv = detalle.firmaGvFecha ? formatearFechaSeleccion(detalle.firmaGvFecha) : null;
  const [abierto, setAbierto] = useState(false);

  const alertas = [
    hospitalesSinRegion > 0 ? `${hospitalesSinRegion} sin región` : null,
    regionesConAdvertencia > 0 ? `${regionesConAdvertencia} con menos de 4 hospitales` : null,
    regionesConResponsable < totalRegiones
      ? `${totalRegiones - regionesConResponsable} sin responsable`
      : null,
  ].filter(Boolean);

  return (
    <Collapsible open={abierto} onOpenChange={setAbierto}>
      <Card className="shadow-sm">
        <CardContent className="p-3 sm:px-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.09em] text-muted-foreground transition-colors hover:text-foreground"
                  aria-expanded={abierto}
                >
                  Resumen
                  <ChevronDown
                    className={`h-3 w-3 transition-transform ${abierto ? 'rotate-180' : ''}`}
                  />
                </button>
              </CollapsibleTrigger>

              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                <Building2 className="h-3 w-3" />
                <strong className="font-semibold text-foreground">{detalle.totalHospitales}</strong>
                hospitales
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                <MapPin className="h-3 w-3" />
                <strong className="font-semibold text-foreground">{totalRegiones}</strong>
                regiones
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                <Target className="h-3 w-3" />
                <strong className="font-semibold text-foreground">
                  {detalle.talleresObjetivoMes ?? '—'}
                </strong>
                objetivo
              </span>
              {alertas.length > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-300">
                  <AlertTriangle className="h-3 w-3" />
                  <strong className="font-semibold">{alertas.length}</strong>
                  alertas
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {detalle.estado === 'Cerrada' && (
                <Button size="sm" onClick={onPlanificarRutas}>
                  <Route className="mr-1.5 h-3.5 w-3.5" />
                  Planificar rutas
                </Button>
              )}
              {editable && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={guardando}
                    onClick={onAgregarHospital}
                  >
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Agregar hospital
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={guardando || rankingCargando}
                    onClick={onSugerirHospitales}
                  >
                    <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                    Sugerir hospitales
                  </Button>
                </>
              )}
            </div>
          </div>

          <CollapsibleContent className="mt-3 space-y-3 border-t pt-3">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <KpiTile
                icon={CalendarDays}
                label="Mes"
                value={formatearPeriodoSeleccion(detalle.fechaSeleccion)}
                detail="Planeación del mes"
                tone="blue"
              />
              <KpiTile
                icon={Building2}
                label="Hospitales"
                value={detalle.totalHospitales}
                detail={
                  hospitalesSinRegion > 0
                    ? `${hospitalesSinRegion} sin región`
                    : 'Todos con región'
                }
                tone="emerald"
                alerta={hospitalesSinRegion > 0}
              />
              <KpiTile
                icon={MapPin}
                label="Regiones"
                value={totalRegiones}
                detail={`${regionesConResponsable} de ${totalRegiones} con responsable`}
                tone="violet"
                alerta={regionesConResponsable < totalRegiones}
              >
                <Progress value={cobertura} className="mt-1.5 h-1" />
              </KpiTile>
              <KpiTile
                icon={Target}
                label="Objetivo"
                value={detalle.talleresObjetivoMes ?? '—'}
                detail="Talleres mínimos del mes"
                tone="orange"
              />
            </div>

            <div className="grid gap-2 border-t pt-3 sm:grid-cols-3">
              <div className="flex items-start gap-2 px-1">
                <FileSignature className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-[9px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                    Firmas
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <FirmaBadge nombre="GG" fecha={firmaGg} />
                    <FirmaBadge nombre="GV" fecha={firmaGv} />
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2 px-1">
                <Route className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-[9px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                    Rutas
                  </p>
                  <p
                    className={[
                      'mt-1 text-xs font-medium',
                      detalle.tieneRutas
                        ? 'text-emerald-700 dark:text-emerald-300'
                        : 'text-muted-foreground',
                    ].join(' ')}
                  >
                    {detalle.tieneRutas ? 'Generadas' : 'Sin generar'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2 px-1">
                {alertas.length > 0 ? (
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-300" />
                ) : (
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-300" />
                )}
                <div className="min-w-0">
                  <p className="text-[9px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                    Alertas de cobertura
                  </p>
                  <p
                    className={[
                      'mt-1 text-xs font-medium',
                      alertas.length > 0
                        ? 'text-amber-700 dark:text-amber-300'
                        : 'text-emerald-700 dark:text-emerald-300',
                    ].join(' ')}
                  >
                    {alertas.length > 0 ? alertas.join(' · ') : 'Sin alertas'}
                  </p>
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </CardContent>
      </Card>
    </Collapsible>
  );
}
