import { Fragment, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import type {
  EquipoPareo,
  SeleccionDetalle,
  SeleccionHospital,
} from '@/apps/educacion-medica/types/educacionMedica.types';

interface ResumenContenidoProps {
  detalle: SeleccionDetalle;
  equipos: EquipoPareo[];
}

function formatearFecha(fecha: string | null): string {
  if (!fecha) return '—';
  const [anio, mes, dia] = fecha.split('-');
  return `${dia}/${mes}/${anio}`;
}

function ubicacionHospital(hospital: SeleccionHospital): string {
  const partes = [hospital.entidadFederativa, hospital.ciudadMunicipio].filter(Boolean);
  return partes.join(' / ') || '—';
}

function nombreEquipoRegion(
  region: SeleccionDetalle['regiones'][number],
  equipos: EquipoPareo[]
): string {
  if (!region.idEquipo) return 'Sin equipo asignado';
  const equipo = equipos.find((e) => e.idEquipo === region.idEquipo);
  if (equipo) return `Ejecutivo: ${equipo.nombreEjecutivo} · Especialista: ${equipo.nombreEspecialista}`;
  return region.nombreEquipo ?? 'Equipo';
}

const CLASES_CELDA = 'border border-border px-2 py-1 text-left align-top';
const CLASES_ENCABEZADO = `${CLASES_CELDA} bg-muted font-medium`;

function ResumenContenido({ detalle, equipos }: ResumenContenidoProps) {
  const hospitalesPorRegion = useMemo(() => {
    const mapa = new Map<number | null, SeleccionHospital[]>();
    for (const hospital of detalle.hospitales) {
      const lista = mapa.get(hospital.idRegion) ?? [];
      lista.push(hospital);
      mapa.set(hospital.idRegion, lista);
    }
    return mapa;
  }, [detalle.hospitales]);

  const sinRegion = hospitalesPorRegion.get(null) ?? [];

  const tablasPorRegion = useMemo(
    () =>
      detalle.regiones.map((region) => {
        const hospitales = hospitalesPorRegion.get(region.idRegion) ?? [];
        const porInstitucion = new Map<string, SeleccionHospital[]>();
        for (const hospital of hospitales) {
          const clave = hospital.institucion ?? 'Sin institución';
          const lista = porInstitucion.get(clave) ?? [];
          lista.push(hospital);
          porInstitucion.set(clave, lista);
        }
        return { region, grupos: [...porInstitucion.entries()] };
      }),
    [detalle.regiones, hospitalesPorRegion]
  );

  const totalesGlobales = useMemo(() => {
    const suma = (lista: SeleccionHospital[]) =>
      lista.reduce(
        (acum, h) => ({
          quirfanos: acum.quirfanos + (h.numeroQuirofanos ?? 0),
          anestesias: acum.anestesias + (h.anestesiasTotales ?? 0),
        }),
        { quirfanos: 0, anestesias: 0 }
      );
    return {
      conRegion: suma(detalle.hospitales.filter((h) => h.idRegion != null)),
      sinRegion: suma(sinRegion),
    };
  }, [detalle.hospitales, sinRegion]);

  return (
    <div className="space-y-6 text-sm">
      <div className="grid gap-2 sm:grid-cols-4">
        <div>
          <p className="text-xs text-muted-foreground">Gerencia</p>
          <p className="font-medium">{detalle.tipoGerencia ?? '—'}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Fecha de selección</p>
          <p className="font-medium">{formatearFecha(detalle.fechaSeleccion)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Vigencia</p>
          <p className="font-medium">
            {formatearFecha(detalle.fechaInicioVigencia)} —{' '}
            {formatearFecha(detalle.fechaFinVigencia)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Objetivo talleres/mes</p>
          <p className="font-medium">{detalle.talleresObjetivoMes ?? '—'}</p>
        </div>
      </div>

      {tablasPorRegion.map(({ region, grupos }) => {
        const hospitales = hospitalesPorRegion.get(region.idRegion) ?? [];
        const totalQuir = hospitales.reduce((a, h) => a + (h.numeroQuirofanos ?? 0), 0);
        const totalAnes = hospitales.reduce((a, h) => a + (h.anestesiasTotales ?? 0), 0);
        return (
          <section key={region.idRegion} className="space-y-2 break-inside-avoid">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b pb-1">
              <h3 className="font-semibold uppercase">
                {region.nombre ?? `Región ${region.idRegion}`}
              </h3>
              <p className="text-xs text-muted-foreground">
                Equipo: {nombreEquipoRegion(region, equipos)} · {hospitales.length} hospital(es)
              </p>
            </div>
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  <th className={CLASES_ENCABEZADO}>Hospital</th>
                  <th className={CLASES_ENCABEZADO}>Quirófanos</th>
                  <th className={CLASES_ENCABEZADO}>Anestesias</th>
                  <th className={CLASES_ENCABEZADO}>Estado / Ciudad</th>
                </tr>
              </thead>
              <tbody>
                {grupos.map(([institucion, hospitalesGrupo]) => (
                  <Fragment key={`inst-${region.idRegion}-${institucion}`}>
                    <tr>
                      <td colSpan={4} className={`${CLASES_CELDA} bg-muted/50 font-semibold`}>
                        {institucion} ({hospitalesGrupo.length})
                      </td>
                    </tr>
                    {hospitalesGrupo.map((hospital) => (
                      <tr key={hospital.idSeleccionHospital}>
                        <td className={CLASES_CELDA}>
                          {hospital.nombreHospital ?? `Hospital ${hospital.idHospital}`}
                        </td>
                        <td className={CLASES_CELDA}>{hospital.numeroQuirofanos ?? '—'}</td>
                        <td className={CLASES_CELDA}>{hospital.anestesiasTotales ?? '—'}</td>
                        <td className={CLASES_CELDA}>{ubicacionHospital(hospital)}</td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
                {grupos.length === 0 && (
                  <tr>
                    <td colSpan={4} className={CLASES_CELDA}>
                      Sin hospitales con coordenadas registradas.
                    </td>
                  </tr>
                )}
                <tr>
                  <td className={`${CLASES_CELDA} font-semibold`}>
                    Total {region.nombre ?? `Región ${region.idRegion}`}
                  </td>
                  <td className={`${CLASES_CELDA} font-semibold`}>{totalQuir}</td>
                  <td className={`${CLASES_CELDA} font-semibold`}>{totalAnes}</td>
                  <td colSpan={1} className={CLASES_CELDA} />
                </tr>
              </tbody>
            </table>
          </section>
        );
      })}

      {sinRegion.length > 0 && (
        <section className="space-y-2 break-inside-avoid">
          <div className="border-b pb-1">
            <h3 className="font-semibold uppercase">Sin región ({sinRegion.length})</h3>
          </div>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className={CLASES_ENCABEZADO}>Hospital</th>
                <th className={CLASES_ENCABEZADO}>Institución</th>
                <th className={CLASES_ENCABEZADO}>Estado / Ciudad</th>
              </tr>
            </thead>
            <tbody>
              {sinRegion.map((hospital) => (
                <tr key={hospital.idSeleccionHospital}>
                  <td className={CLASES_CELDA}>
                    {hospital.nombreHospital ?? `Hospital ${hospital.idHospital}`}
                  </td>
                  <td className={CLASES_CELDA}>{hospital.institucion ?? '—'}</td>
                  <td className={CLASES_CELDA}>{ubicacionHospital(hospital)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="grid gap-4 border-t pt-4 sm:grid-cols-2 break-inside-avoid">
        <div className="rounded-md border p-3 text-xs">
          <p className="font-semibold">Revisó — Gerente de Ventas</p>
          <p className="mt-2 text-muted-foreground">
            {detalle.firmaGvFecha
              ? `Firmado el ${formatearFecha(detalle.firmaGvFecha)}`
              : 'Pendiente'}
          </p>
        </div>
        <div className="rounded-md border p-3 text-xs">
          <p className="font-semibold">Autorizó — Gerencia General</p>
          <p className="mt-2 text-muted-foreground">
            {detalle.firmaGgFecha
              ? `Firmado el ${formatearFecha(detalle.firmaGgFecha)}`
              : 'Pendiente'}
          </p>
        </div>
      </section>

      <p className="text-xs text-muted-foreground">
        Totales: {detalle.totalHospitales} hospital(es), {totalesGlobales.conRegion.quirfanos}{' '}
        quirófanos y {totalesGlobales.conRegion.anestesias} anestesias en regiones
        {sinRegion.length > 0 &&
          `; ${sinRegion.length} hospital(es) sin región por ${totalesGlobales.sinRegion.quirfanos} quirófanos.`}
        .
      </p>
    </div>
  );
}

interface ResumenSeleccionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detalle: SeleccionDetalle;
  equipos: EquipoPareo[];
}

export function ResumenSeleccionModal({
  open,
  onOpenChange,
  detalle,
  equipos,
}: ResumenSeleccionModalProps) {
  return (
    <>
      <Modal
        id="modal-resumen-seleccion"
        open={open}
        setOpen={onOpenChange}
        title="Resumen de selección mensual"
        size="wide"
        footer={
          <div className="flex justify-end gap-2 pt-2 print:hidden">
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
        <ResumenContenido detalle={detalle} equipos={equipos} />
      </Modal>

      {/* Copia exclusiva para impresion: flujo normal de pagina, sin animaciones del dialogo */}
      {createPortal(
        <div id="resumen-seleccion-print" className="hidden print:block">
          <ResumenContenido detalle={detalle} equipos={equipos} />
        </div>,
        document.body
      )}
    </>
  );
}
