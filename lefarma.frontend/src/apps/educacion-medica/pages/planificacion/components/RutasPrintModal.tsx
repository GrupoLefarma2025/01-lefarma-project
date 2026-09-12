import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatearFecha, diaSemana } from '../rutasUtils';

export interface VisitaImpresion {
  orden: number;
  hospital: string;
  ubicacion: string;
  foranea: boolean;
}

export interface DiaImpresion {
  fecha: string;
  visitas: VisitaImpresion[];
}

export interface SemanaImpresion {
  semana: number;
  rango: string;
  totalVisitas: number;
  dias: DiaImpresion[];
}

export interface EquipoImpresion {
  idEquipo: number;
  nombre: string;
  integrantes: string;
  semanas: SemanaImpresion[];
  totalVisitas: number;
  foraneos: number;
  maxViajesForaneos: number;
  maxVisitasSemana: number;
  sinPlanificar: string[];
}

export interface EncabezadoImpresion {
  gerencia: string | null;
  vigencia: string;
  fechaSeleccion: string;
  version: number | null;
  estadoVersion: string | null;
  totalHospitales: number;
}

interface RutasPrintModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  encabezado: EncabezadoImpresion;
  equipos: EquipoImpresion[];
}

const CELDA = 'border border-border px-2 py-1 text-left align-top';
const CELDA_ENC = `${CELDA} bg-muted font-medium`;

function ContenidoRutasImpresion({
  encabezado,
  equipos,
}: {
  encabezado: EncabezadoImpresion;
  equipos: EquipoImpresion[];
}) {
  if (equipos.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin equipos en esta versión.</p>;
  }

  return (
    <div className="space-y-6 text-sm">
      <div className="space-y-1">
        <h2 className="text-base font-bold uppercase">
          Planificación de rutas · Educación Médica
        </h2>
        <p>
          {encabezado.gerencia ?? 'Sin gerencia'} · Vigencia {encabezado.vigencia} · Selección{' '}
          {encabezado.fechaSeleccion} · Versión{' '}
          {encabezado.version !== null ? `V${encabezado.version}` : '—'}
          {encabezado.estadoVersion ? ` (${encabezado.estadoVersion})` : ''} ·{' '}
          {encabezado.totalHospitales} hospitales en la selección
        </p>
      </div>

      {equipos.map((equipo) => (
        <section key={equipo.idEquipo} className="break-inside-avoid space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b pb-1">
            <h3 className="font-semibold uppercase">{equipo.nombre}</h3>
            <p className="text-xs">
              {equipo.integrantes} · {equipo.totalVisitas} visitas · Viajes foráneos{' '}
              {equipo.foraneos}/{equipo.maxViajesForaneos}
            </p>
          </div>

          {equipo.semanas.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sin visitas calendarizadas.</p>
          ) : (
            equipo.semanas.map((semana) => (
              <table key={semana.semana} className="w-full border-collapse text-xs">
                <thead>
                  <tr>
                    <th className={`${CELDA_ENC} uppercase`} colSpan={5}>
                      Semana {semana.semana} · {semana.rango} — {semana.totalVisitas}/
                      {equipo.maxVisitasSemana} visitas
                    </th>
                  </tr>
                  <tr>
                    <th className={CELDA_ENC}>Día</th>
                    <th className={`${CELDA_ENC} w-8 text-center`}>#</th>
                    <th className={CELDA_ENC}>Hospital</th>
                    <th className={CELDA_ENC}>Ubicación</th>
                    <th className={`${CELDA_ENC} w-16 text-center`}>Tipo</th>
                  </tr>
                </thead>
                <tbody>
                  {semana.dias.map((dia) =>
                    dia.visitas.map((visita, idx) => (
                      <tr key={`${dia.fecha}-${visita.orden}`} className="break-inside-avoid">
                        {idx === 0 && (
                          <td className={CELDA} rowSpan={dia.visitas.length}>
                            <span className="font-medium uppercase">
                              {diaSemana(dia.fecha)} {formatearFecha(dia.fecha)}
                            </span>
                            <span className="block text-muted-foreground">
                              {dia.visitas.length}/3 del día
                            </span>
                          </td>
                        )}
                        <td className={`${CELDA} text-center tabular-nums`}>{visita.orden}</td>
                        <td className={CELDA}>{visita.hospital}</td>
                        <td className={CELDA}>{visita.ubicacion || '—'}</td>
                        <td className={`${CELDA} text-center`}>
                          {visita.foranea ? 'Foráneo' : 'Local'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ))
          )}

          {equipo.sinPlanificar.length > 0 && (
            <p className="text-xs text-destructive">
              Sin planificar ({equipo.sinPlanificar.length}): {equipo.sinPlanificar.join(', ')}
            </p>
          )}
        </section>
      ))}

      <p className="text-[10px] text-muted-foreground">
        Documento de planificación generado por el módulo de Educación Médica. Los viajes
        foráneos máximos por equipo al mes son {equipos[0]?.maxViajesForaneos ?? 3}.
      </p>
    </div>
  );
}

export function RutasPrintModal({ open, onOpenChange, encabezado, equipos }: RutasPrintModalProps) {
  const [alcance, setAlcance] = useState<number | 'todos'>('todos');

  const equiposFiltrados = useMemo(
    () => (alcance === 'todos' ? equipos : equipos.filter((e) => e.idEquipo === alcance)),
    [equipos, alcance]
  );

  return (
    <>
      <Modal
        id="modal-rutas-print"
        open={open}
        setOpen={onOpenChange}
        title="Vista de impresión — planificación de rutas"
        size="wide"
        footer={
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
            <Button onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" />
              Imprimir
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2 print:hidden">
            <span className="text-xs text-muted-foreground">Alcance</span>
            <Select
              value={String(alcance)}
              onValueChange={(v) => setAlcance(v === 'todos' ? 'todos' : Number(v))}
            >
              <SelectTrigger className="h-8 w-[260px] text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los equipos</SelectItem>
                {equipos.map((e) => (
                  <SelectItem key={e.idEquipo} value={String(e.idEquipo)}>
                    {e.nombre} · {e.integrantes}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <ContenidoRutasImpresion encabezado={encabezado} equipos={equiposFiltrados} />
        </div>
      </Modal>

      {/* Copia exclusiva para impresión: flujo normal de página, sin animaciones del diálogo */}
      {createPortal(
        <div id="rutas-print" className="hidden print:block">
          <ContenidoRutasImpresion encabezado={encabezado} equipos={equiposFiltrados} />
        </div>,
        document.body
      )}
    </>
  );
}
