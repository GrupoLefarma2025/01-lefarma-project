import React, { useMemo } from 'react';
import type { SolicitudPersonalResponse } from '@/types/solicitudPersonal.types';
import { getCategoriaNombre } from '@/types/solicitudPersonal.types';
import type {
  HistorialWorkflowItemResponse,
  WorkflowPasoFlowResponse,
} from '@/types/solicitudPersonalWorkflow.types';
import logoImage from '@/assets/logo.png';
import { IncidenciaPDF } from './IncidenciaPDF';
import { PermisoPDF } from './PermisoPDF';
import { VacacionesPDF } from './VacacionesPDF';
import { GoceDeSueldoPDF } from './GoceDeSueldoPDF';
import { IncapacidadPDF } from './IncapacidadPDF';
import { fmtDate, fmtDateTime } from './pdfFormat';

export interface Props {
  solicitud: SolicitudPersonalResponse;
  historial?: HistorialWorkflowItemResponse[];
  pasosWorkflow?: WorkflowPasoFlowResponse[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildFirmasMap(historial: HistorialWorkflowItemResponse[]) {
  const baseUrl = import.meta.env.VITE_API_URL || window.location.origin;
  const apiUrl = baseUrl.endsWith('/api') ? baseUrl : `${baseUrl}/api`;
  const map = new Map<number, string>();
  for (const h of historial) {
    if (h.idUsuario > 0 && !map.has(h.idUsuario)) {
      map.set(h.idUsuario, `${apiUrl}/media/archivos/firmas_usuarios/${h.idUsuario}.png?t=${Date.now()}`);
    }
  }
  return map;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const HEADER_BG = '#1a3a5c';
const ROW_LABEL = '#2c5f8a';
const BORDER = '#4a7aad';
const WHITE = '#ffffff';

const s: Record<string, React.CSSProperties> = {
  page: {
    fontFamily: "'Arial', sans-serif",
    fontSize: 9,
    color: '#000',
    background: WHITE,
    padding: '20px 24px',
    maxWidth: 820,
    margin: '0 auto',
    boxSizing: 'border-box',
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  logoBox: {
    width: 140,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  docTitle: {
    flex: 1,
    textAlign: 'center',
    fontWeight: 700,
    fontSize: 14,
    letterSpacing: 2,
    color: '#000',
    textTransform: 'uppercase',
  },
  folioBox: {
    width: 180,
    border: `1px solid ${BORDER}`,
    fontSize: 9,
  },
  folioRow: {
    display: 'flex',
    borderBottom: `1px solid ${BORDER}`,
  },
  folioLabelCell: {
    background: HEADER_BG,
    color: WHITE,
    fontWeight: 700,
    padding: '2px 6px',
    width: 110,
    textAlign: 'right',
    printColorAdjust: 'exact' as const,
    WebkitPrintColorAdjust: 'exact' as const,
  },
  folioValueCell: {
    padding: '2px 6px',
    flex: 1,
  },
  sectionHeader: {
    background: HEADER_BG,
    color: WHITE,
    fontWeight: 700,
    textAlign: 'center',
    padding: '3px 0',
    fontSize: 9,
    letterSpacing: 0.5,
    border: `1px solid ${BORDER}`,
    borderBottom: 'none',
    printColorAdjust: 'exact' as const,
    WebkitPrintColorAdjust: 'exact' as const,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    marginBottom: 0,
  },
  thBlue: {
    background: ROW_LABEL,
    color: WHITE,
    fontWeight: 700,
    padding: '3px 5px',
    border: `1px solid ${BORDER}`,
    textAlign: 'left' as const,
    fontSize: 8.5,
    verticalAlign: 'top' as const,
    whiteSpace: 'nowrap' as const,
    printColorAdjust: 'exact' as const,
    WebkitPrintColorAdjust: 'exact' as const,
  },
  tdValue: {
    padding: '3px 5px',
    border: `1px solid ${BORDER}`,
    fontSize: 8.5,
    verticalAlign: 'top' as const,
  },
  fullCell: {
    padding: '3px 5px',
    border: `1px solid ${BORDER}`,
    fontSize: 8.5,
    verticalAlign: 'top' as const,
    textAlign: 'justify' as const,
  },
  detailTh: {
    background: HEADER_BG,
    color: WHITE,
    fontWeight: 700,
    padding: '3px 5px',
    border: `1px solid ${BORDER}`,
    fontSize: 8.5,
    textAlign: 'center' as const,
    printColorAdjust: 'exact' as const,
    WebkitPrintColorAdjust: 'exact' as const,
  },
  detailTd: {
    padding: '3px 5px',
    border: `1px solid ${BORDER}`,
    fontSize: 8.5,
    verticalAlign: 'top' as const,
    textAlign: 'center' as const,
  },
  detailTdLeft: {
    padding: '3px 5px',
    border: `1px solid ${BORDER}`,
    fontSize: 8.5,
    verticalAlign: 'top' as const,
    textAlign: 'left' as const,
  },
  firmasTable: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    marginTop: 8,
  },
  firmaTh: {
    background: HEADER_BG,
    color: WHITE,
    fontWeight: 700,
    padding: '2px 4px',
    border: `1px solid ${BORDER}`,
    fontSize: 7.5,
    textAlign: 'left' as const,
    printColorAdjust: 'exact' as const,
    WebkitPrintColorAdjust: 'exact' as const,
  },
  firmaTd: {
    padding: '2px 4px',
    border: `1px solid ${BORDER}`,
    fontSize: 7.5,
    minHeight: 28,
  },
};

// ─── Logo ─────────────────────────────────────────────────────────────────────

const Logo: React.FC = () => (
  <div style={s.logoBox}>
    <img
      src={logoImage}
      alt="Grupo Lefarma"
      style={{ width: 120, height: 50, objectFit: 'contain' }}
    />
  </div>
);

// ─── Legacy Formatted Fallback ────────────────────────────────────────────────

// ponytail: legacy formatted fallback = crash-proof safety net. Renders any category without a dedicated component, including unknown/future DB types. Do NOT remove even once all current categories are covered — a new DB type must keep working with zero code change.
function LegacyFormattedPDF({
  solicitud,
  historial = [],
  pasosWorkflow = [],
}: Props) {
  const firmasMap = useMemo(() => buildFirmasMap(historial), [historial]);

  const historialPorPaso = new Map<number, HistorialWorkflowItemResponse[]>();
  for (const h of historial) {
    const arr = historialPorPaso.get(h.idPaso) ?? [];
    arr.push(h);
    historialPorPaso.set(h.idPaso, arr);
  }

  const flujoPasos = pasosWorkflow
    .filter((p) => p.activo)
    .sort((a, b) => a.orden - b.orden)
    .map((paso) => {
      const eventos = historialPorPaso.get(paso.idPaso) ?? [];
      const ultimo = eventos.length > 0 ? eventos[eventos.length - 1] : null;
      return {
        idPaso: paso.idPaso,
        orden: paso.orden,
        nombrePaso: paso.nombrePaso,
        esInicio: paso.esInicio,
        esFinal: paso.esFinal,
        idUsuario: ultimo?.idUsuario ?? null,
        participante: ultimo ? (ultimo.nombreUsuario ?? `Usuario ${ultimo.idUsuario}`) : null,
        accion: ultimo ? (ultimo.nombreAccion ?? '') : null,
        fecha: ultimo?.fechaEvento ?? null,
        comentario: ultimo?.comentario ?? null,
        tieneEvento: eventos.length > 0,
      };
    })
    .filter((p) => p.tieneEvento);

  return (
    <div id="solicitud-personal-pdf-print" style={s.page}>
      {/* ── HEADER ── */}
      <div style={s.headerRow}>
        <Logo />
        <div style={s.docTitle}>SOLICITUD DE PERSONAL</div>
        <div style={s.folioBox}>
          <div style={{ ...s.folioRow, borderBottom: `1px solid ${BORDER}` }}>
            <div style={s.folioLabelCell}>Folio</div>
            <div style={s.folioValueCell}>{solicitud.folio ?? '-'}</div>
          </div>
          <div style={s.folioRow}>
            <div style={s.folioLabelCell}>Fecha</div>
            <div style={s.folioValueCell}>{fmtDate(solicitud.fechaCreacion)}</div>
          </div>
        </div>
      </div>

      {/* ── DATOS DEL SOLICITANTE ── */}
      <div style={s.sectionHeader}>Datos del solicitante</div>
      <table style={s.table}>
        <tbody>
          <tr>
            <td style={s.thBlue}>Empresa</td>
            <td style={s.tdValue}>
              {solicitud.empresaNombre?.toUpperCase() ?? `ID ${solicitud.idEmpresa}`}
            </td>
            <td style={s.thBlue}>Sucursal</td>
            <td style={s.tdValue}>
              {solicitud.sucursalNombre?.toUpperCase() ?? `ID ${solicitud.idSucursal}`}
            </td>
            <td style={s.thBlue}>Área</td>
            <td style={s.tdValue}>
              {solicitud.areaNombre?.toUpperCase() ?? `ID ${solicitud.idArea}`}
            </td>
          </tr>
          <tr>
            <td style={s.thBlue}>Nombre del solicitante</td>
            <td style={s.tdValue}>{solicitud.solicitanteNombre ?? '-'}</td>
            <td style={s.thBlue}>Puesto</td>
            <td style={s.tdValue}>{solicitud.solicitantePuesto ?? '-'}</td>
            <td style={s.thBlue}>Estado</td>
            <td style={s.tdValue}>{solicitud.estadoNombre ?? '-'}</td>
          </tr>
        </tbody>
      </table>

      {/* ── DATOS DE LA SOLICITUD ── */}
      <div style={{ ...s.sectionHeader, marginTop: 6 }}>Datos de la solicitud</div>
      <table style={s.table}>
        <tbody>
          <tr>
            <td style={s.thBlue}>Categoría</td>
            <td style={s.tdValue}>{getCategoriaNombre(solicitud.categoria)}</td>
            <td style={s.thBlue}>Tipo de solicitud</td>
            <td style={s.tdValue} colSpan={3}>
              {solicitud.tipoSolicitudNombre || `Tipo #${solicitud.idTipoSolicitud}`}
            </td>
          </tr>
          <tr>
            <td style={s.thBlue}>Fecha de inicio</td>
            <td style={s.tdValue}>{fmtDate(solicitud.fechaInicio)}</td>
            <td style={s.thBlue}>Fecha de fin</td>
            <td style={s.tdValue}>{fmtDate(solicitud.fechaFin)}</td>
            <td style={s.thBlue}>Días solicitados</td>
            <td style={s.tdValue}>{solicitud.diasSolicitados ?? '-'}</td>
          </tr>
          {solicitud.fechaRegreso && (
            <tr>
              <td style={s.thBlue}>Fecha de regreso</td>
              <td style={s.tdValue}>{fmtDate(solicitud.fechaRegreso)}</td>
              <td style={s.thBlue}>Fecha de reposición</td>
              <td style={s.tdValue} colSpan={3}>
                {fmtDate(solicitud.fechaReposicion)}
              </td>
            </tr>
          )}
          {solicitud.fechaEnvio && (
            <tr>
              <td style={s.thBlue}>Fecha de envío</td>
              <td style={s.tdValue}>{fmtDate(solicitud.fechaEnvio)}</td>
              <td style={s.thBlue}>Paso actual</td>
              <td style={s.tdValue} colSpan={3}>
                {solicitud.pasoActual || `Paso #${solicitud.idPasoActual ?? ''}`}
              </td>
            </tr>
          )}
          {solicitud.lugarComision && (
            <tr>
              <td style={s.thBlue}>Lugar de comisión</td>
              <td style={s.fullCell} colSpan={5}>
                {solicitud.lugarComision}
              </td>
            </tr>
          )}
          {solicitud.motivo && (
            <tr>
              <td style={s.thBlue}>Motivo</td>
              <td style={s.fullCell} colSpan={5}>
                {solicitud.motivo}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* ── DETALLE DE DÍAS ── */}
      {solicitud.detalle && solicitud.detalle.length > 0 && (
        <>
          <div style={{ ...s.sectionHeader, marginTop: 6 }}>Detalle de días</div>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={{ ...s.detailTh, width: '10%' }}>#</th>
                <th style={s.detailTh}>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {solicitud.detalle.map((d, idx) => (
                <tr key={idx}>
                  <td style={s.detailTd}>{idx + 1}</td>
                  <td style={s.detailTdLeft}>{fmtDate(d.fecha)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* ── FLUJO DE AUTORIZACIÓN ── */}
      {flujoPasos.length > 0 && (
        <table style={s.firmasTable}>
          <thead>
            <tr>
              <th style={{ ...s.firmaTh, width: '5%' }}>#</th>
              <th style={{ ...s.firmaTh, width: '20%' }}>Paso</th>
              <th style={{ ...s.firmaTh, width: '22%' }}>Participante</th>
              <th style={{ ...s.firmaTh, width: '18%' }}>Acción</th>
              <th style={{ ...s.firmaTh, width: '15%' }}>Fecha</th>
              <th style={{ ...s.firmaTh, width: '20%' }}>Firma</th>
            </tr>
          </thead>
          <tbody>
            {flujoPasos.map((paso, idx) => (
              <tr key={paso.idPaso}>
                <td style={{ ...s.firmaTd, textAlign: 'center' }}>{idx + 1}</td>
                <td style={s.firmaTd}>{paso.nombrePaso}</td>
                <td style={s.firmaTd}>{paso.participante ?? '—'}</td>
                <td style={s.firmaTd}>{paso.accion ?? '—'}</td>
                <td style={s.firmaTd}>{paso.fecha ? fmtDateTime(paso.fecha) : '—'}</td>
                <td style={s.firmaTd}>
                  {paso.idUsuario != null && firmasMap.has(paso.idUsuario) ? (
                    <img
                      src={firmasMap.get(paso.idUsuario)}
                      alt="Firma"
                      style={{
                        height: 28,
                        width: 80,
                        objectFit: 'contain',
                        display: 'block',
                        marginLeft: 'auto',
                        printColorAdjust: 'exact',
                        WebkitPrintColorAdjust: 'exact',
                      }}
                    />
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

export function SolicitudPersonalPDF(props: Props) {
  switch (getCategoriaNombre(props.solicitud.categoria)) {
    case 'Incidencia':
      return <IncidenciaPDF {...props} />;
    case 'Permiso':
      return <PermisoPDF {...props} />;
    case 'Vacaciones':
      return <VacacionesPDF {...props} />;
    case 'Goce de Sueldo':
      return <GoceDeSueldoPDF {...props} />;
    case 'Incapacidad':
      return <IncapacidadPDF {...props} />;
    default:
      // Safety net: any unknown or future category (e.g. a new DB type with no component yet) renders the legacy format instead of crashing.
      return <LegacyFormattedPDF {...props} />;
  }
}

export default SolicitudPersonalPDF;
