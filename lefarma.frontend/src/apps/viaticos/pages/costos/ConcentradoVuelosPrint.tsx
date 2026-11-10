import type { CSSProperties } from 'react';
import logoAsokam from '@/assets/logo_7.png';
import { Firmas } from './ConcentradoViaticosPrint';

/**
 * Concentrado de vuelos «Solicitud de avión» sobre DATOS PERSISTIDOS.
 *
 * Reproduce el formato del Excel VUELOS EDUCACION MEDICA OCTUBRE 2026 (hoja
 * «CONCENTRADO DE VUELOS»): un bloque por persona con Nombre completo, Puesto,
 * Fecha de la solicitud y Fecha de nacimiento, y una tabla ida/vuelta con
 * Fecha de salida, Hora planeada de salida, Origen, Destino y Motivo. Cierra
 * con el mismo bloque de firmas del concentrado y el pie del formato.
 *
 * Es puramente presentacional: las filas llegan ya resueltas por el contenedor
 * (bandeja de `aprobacionesApi`) y aquí no se hace fetch. Un campo `null` o
 * ausente se imprime como "—": en un documento que se entrega a la agencia de
 * viajes, inventar un dato es peor que dejarlo vacío.
 */

const UNKNOWN = '—';
const NAVY = '#1f3864';
const HEADER_FILL = '#dbe5f1';

/** Un tramo del itinerario: ida (índice 0) o vuelta (índice 1). */
export interface TrayectoVuelo {
  /** Fecha de salida ISO (`aaaa-mm-dd`) o texto ya formateado. */
  fecha?: string | null;
  /** Hora planeada de salida ("08:00"). */
  hora?: string | null;
  origen?: string | null;
  destino?: string | null;
}

/** Una fila del concentrado de vuelos. */
export interface SolicitudVuelo {
  id_solicitud: number;
  /** Persona que viaja (`datos.persona.nombre`, respaldo del directorio). */
  nombre: string;
  puesto?: string | null;
  /** Fecha de la solicitud (ISO o texto); en el formato es la fecha del bloque. */
  fecha_solicitud: string;
  fecha_nacimiento?: string | null;
  motivo?: string | null;
  /** Hasta dos tramos: ida y vuelta. */
  trayectos?: TrayectoVuelo[];
}

const border: CSSProperties = {
  border: '1px solid #777',
  padding: '3px 5px',
  verticalAlign: 'top',
  overflowWrap: 'anywhere',
};

const thStyle: CSSProperties = {
  ...border,
  background: HEADER_FILL,
  fontWeight: 700,
  textAlign: 'center',
};

const labelStyle: CSSProperties = {
  ...border,
  background: '#f3f6fb',
  fontWeight: 700,
  whiteSpace: 'nowrap',
};

const tableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  tableLayout: 'fixed',
};

/** Encabezados del itinerario, en el orden del formato (ida y vuelta). */
const COLUMNAS_ITINERARIO = [
  'Fecha de salida',
  'Hora planeada de salida',
  'Origen',
  'Destino',
  'Motivo',
];

const PRINT_CSS = `
@page concentrado-vuelos { size: A4 portrait; margin: 10mm; }
.concentrado-vuelos { page: concentrado-vuelos; font: 9px Arial, sans-serif; color: #000; background: #fff; }
.concentrado-vuelo-bloque { break-inside: avoid; margin: 0 0 10px; }
.concentrado-vuelos table { break-inside: auto; }
.concentrado-vuelos thead { display: table-header-group; }
@media print {
  body.concentrado-vuelos-print-active > *:not(#concentrado-vuelos-print) { display: none !important; }
  body.concentrado-vuelos-print-active #concentrado-vuelos-print { display: block !important; }
  .concentrado-vuelos { print-color-adjust: exact; }
}`;

/** Fecha ISO (aaaa-mm-dd) → dd/mm/aaaa; cualquier otro texto se conserva. */
function fechaTexto(valor: string | null | undefined): string {
  if (!valor) return UNKNOWN;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor);
  return iso ? `${iso[3]}/${iso[2]}/${iso[1]}` : valor;
}

/** Texto no vacío o "—": el documento nunca deja una celda en blanco. */
const texto = (valor: string | null | undefined): string =>
  valor !== null && valor !== undefined && valor.trim() !== '' ? valor.trim() : UNKNOWN;

/** Fecha de emisión en ISO corto (aaaa-mm-dd), en hora local. */
function hoyIso(): string {
  const d = new Date();
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

interface Props {
  /** Solicitudes ya resueltas por el contenedor; el orden de llegada manda. */
  solicitudes: SolicitudVuelo[];
  /** Gerencia del concentrado (encabezado del documento). */
  gerencia?: string;
  /** Fecha de emisión; por defecto hoy. */
  fecha?: string;
}

export function ConcentradoVuelosPrint({
  solicitudes,
  gerencia = 'EDUCACIÓN MÉDICA',
  fecha = hoyIso(),
}: Props) {
  return (
    <article
      className="concentrado-vuelos"
      aria-label="Concentrado de vuelos: solicitudes de avión"
    >
      <style>{PRINT_CSS}</style>
      <header style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <img
          src={logoAsokam}
          alt="ASOKAM"
          style={{ width: 150, height: 48, objectFit: 'contain' }}
        />
        <h1 style={{ flex: 1, textAlign: 'right', fontSize: 18, color: NAVY, margin: 0 }}>
          Concentrado de Vuelos
        </h1>
      </header>

      <p style={{ margin: '2px 0 8px', fontSize: 9 }}>
        Gerencia: {gerencia} · Fecha de emisión: {fechaTexto(fecha)} ·{' '}
        {solicitudes.length} {solicitudes.length === 1 ? 'solicitud' : 'solicitudes'}
      </p>

      {solicitudes.length === 0 ? (
        <p style={{ ...border, textAlign: 'center' }}>
          Sin solicitudes seleccionadas para el concentrado de vuelos.
        </p>
      ) : null}

      {solicitudes.map((solicitud) => {
        const tramos = solicitud.trayectos ?? [];
        return (
          <section
            key={solicitud.id_solicitud}
            className="concentrado-vuelo-bloque"
            aria-label={`Solicitud de avión de ${solicitud.nombre}`}
          >
            <div
              style={{
                ...border,
                background: '#e8eef7',
                color: NAVY,
                fontWeight: 700,
                textAlign: 'right',
                letterSpacing: 0.3,
              }}
            >
              Solicitud de avión
            </div>

            <table style={tableStyle} aria-label="Datos de la persona que viaja">
              <tbody>
                <tr>
                  <td style={labelStyle}>Nombre completo:</td>
                  <td style={border}>{texto(solicitud.nombre)}</td>
                  <td style={labelStyle}>Fecha:</td>
                  <td style={border}>{fechaTexto(solicitud.fecha_solicitud)}</td>
                </tr>
                <tr>
                  <td style={labelStyle}>Puesto:</td>
                  <td style={border}>{texto(solicitud.puesto)}</td>
                  <td style={labelStyle}>Fecha de nacimiento:</td>
                  <td style={border}>{fechaTexto(solicitud.fecha_nacimiento)}</td>
                </tr>
              </tbody>
            </table>

            <table
              style={tableStyle}
              aria-label="Itinerario de ida y vuelta"
            >
              <colgroup>
                <col style={{ width: '11%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '10%' }} />
              </colgroup>
              <thead>
                <tr>
                  {COLUMNAS_ITINERARIO.map((columna) => (
                    <th key={`ida-${columna}`} style={thStyle}>
                      {columna}
                    </th>
                  ))}
                  {COLUMNAS_ITINERARIO.map((columna) => (
                    <th key={`vuelta-${columna}`} style={thStyle}>
                      {columna}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {[0, 1].map((indice) => {
                    const tramo = tramos[indice];
                    return (
                      // El motivo del viaje es uno solo (datos.persona.motivo):
                      // la ida lo imprime y la vuelta no inventa uno propio.
                      [
                        <td style={border} key={`fecha-${indice}`}>
                          {fechaTexto(tramo?.fecha)}
                        </td>,
                        <td style={border} key={`hora-${indice}`}>
                          {texto(tramo?.hora)}
                        </td>,
                        <td style={border} key={`origen-${indice}`}>
                          {texto(tramo?.origen)}
                        </td>,
                        <td style={border} key={`destino-${indice}`}>
                          {texto(tramo?.destino)}
                        </td>,
                        <td style={border} key={`motivo-${indice}`}>
                          {indice === 0 ? texto(solicitud.motivo) : UNKNOWN}
                        </td>,
                      ]
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </section>
        );
      })}

      <Firmas />

      <footer
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          borderTop: '1px solid #777',
          paddingTop: 5,
        }}
      >
        <span>Versió:01</span>
        <span>Prohibida su reproducción no autorizada</span>
      </footer>
    </article>
  );
}

export default ConcentradoVuelosPrint;
