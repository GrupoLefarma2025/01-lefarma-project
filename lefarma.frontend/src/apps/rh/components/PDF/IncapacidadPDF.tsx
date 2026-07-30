import React, { useMemo } from 'react';
import type { Props } from './SolicitudPersonalPDF';
import type { HistorialWorkflowItemResponse } from '@/types/solicitudPersonalWorkflow.types';
import logoImage from '@/assets/logo.png';
import { fmtDate } from './pdfFormat';

// ponytail: buildFirmasMap duplicated from SolicitudPersonalPDF (not exported there) — same
// convention as IncidenciaPDF / GoceDeSueldoPDF; exporting it would refactor an unrelated file.
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

function firmaUrl(idUsuario: number) {
  const baseUrl = import.meta.env.VITE_API_URL || window.location.origin;
  const apiUrl = baseUrl.endsWith('/api') ? baseUrl : `${baseUrl}/api`;
  return `${apiUrl}/media/archivos/firmas_usuarios/${idUsuario}.png?t=${Date.now()}`;
}

const BLACK = '#000000';
const BORDER = `1px solid ${BLACK}`;

const PRINT_EXACT: React.CSSProperties = {
  printColorAdjust: 'exact',
  WebkitPrintColorAdjust: 'exact',
};

// ponytail: fontSize lives on the FormCopy wrapper (not only on #...-print) so the global
// print rule `#solicitud-personal-pdf-print { font-size:10pt !important }` can't inflate the
// body text — that inflation is what pushes the 2 copies onto a 2nd sheet.
const BODY = 9;

const MESES = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE',
];

// Split an ISO date into day / month-name / 2-digit-year without JS-Date timezone drift.
function splitFecha(fecha?: string | null) {
  if (!fecha) return { d: '', mNombre: '', yy: '' };
  const mt = /^(\d{4})-(\d{2})-(\d{2})/.exec(fecha);
  if (!mt) return { d: '', mNombre: '', yy: '' };
  return {
    d: String(parseInt(mt[3], 10)),
    mNombre: MESES[parseInt(mt[2], 10) - 1] ?? '',
    yy: mt[1].slice(2),
  };
}

function stripAccents(text: string) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// ponytail: keyword heuristic for incapacity type; map to a dedicated field if the backend
// ever stores it (today SolicitudPersonalResponse has no incapacity-specific field).
function incapacidadTypeIndex(motivo?: string | null, tipoNombre?: string | null): number {
  const text = stripAccents(`${motivo ?? ''} ${tipoNombre ?? ''}`.toLowerCase());
  if (/maternidad|embarazo|parto|gestac|prenatal|puerperio/.test(text)) return 2;
  if (/riesgo|accident|laboral/.test(text)) return 1;
  if (/prolong|prorrog|extension|recaida|reinciden|otro/.test(text)) return 3;
  return 0; // enfermedad general (most common)
}

const INCAPACIDAD_OPCIONES = [
  'ENFERMEDAD GENERAL',
  'RIESGO DE TRABAJO',
  'MATERNIDAD',
  'PROLONGACIÓN / OTROS',
];

const s: Record<string, React.CSSProperties> = {
  page: {
    fontFamily: "'Arial', sans-serif",
    fontSize: BODY,
    color: BLACK,
    background: '#fff',
    padding: '10px 12px',
    maxWidth: 820,
    margin: '0 auto',
    boxSizing: 'border-box',
  },
  form: { border: BORDER, boxSizing: 'border-box' },
  bold: { fontWeight: 700 },
};

// A fill-in blank: value sits on a short underline; empty still shows the line (like the form).
const Blank: React.FC<{ children?: React.ReactNode; w?: number }> = ({ children, w = 30 }) => (
  <span
    style={{
      display: 'inline-block',
      minWidth: w,
      borderBottom: BORDER,
      textAlign: 'center',
      padding: '0 3px',
      ...PRINT_EXACT,
    }}
  >
    {children}
  </span>
);

type Solicitud = Props['solicitud'];

interface Firmas {
  solicitante?: string;
  autorizacion?: string;
  nomina?: string;
}

function FormCopy({
  solicitud,
  typeIdx,
  firmas,
}: {
  solicitud: Solicitud;
  typeIdx: number;
  firmas: Firmas;
}) {
  const ini = splitFecha(solicitud.fechaInicio);
  const fin = splitFecha(solicitud.fechaFin);

  const line: React.CSSProperties = {
    flex: 1,
    borderBottom: BORDER,
    minHeight: 14,
    marginLeft: 4,
    ...PRINT_EXACT,
  };
  const fieldRow: React.CSSProperties = { display: 'flex', alignItems: 'baseline', marginBottom: 12 };
  const fieldLabel: React.CSSProperties = { ...s.bold, whiteSpace: 'nowrap', fontSize: BODY };

  const sigImg = (url?: string) =>
    url ? (
      <img src={url} alt="Firma" style={{ maxHeight: 30, objectFit: 'contain', ...PRINT_EXACT }} />
    ) : null;
  const sigCell: React.CSSProperties = {
    borderTop: BORDER,
    height: 58,
    verticalAlign: 'top',
    textAlign: 'center',
    padding: '4px 2px 2px',
    ...PRINT_EXACT,
  };
  const sigInner: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    justifyContent: 'space-between',
    alignItems: 'center',
  };
  const sigLabel: React.CSSProperties = { ...s.bold, fontSize: 8 };

  return (
    // fontSize here shields the body text from the global print 10pt !important rule.
    <div style={{ fontSize: BODY, breakInside: 'avoid' }}>
      <div style={s.form}>
        {/* HEADER */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '8px 10px' }}>
          <div style={{ width: 150 }}>
            <img src={logoImage} alt="Grupo Lefarma" style={{ width: 130, height: 46, objectFit: 'contain' }} />
          </div>
          {/* ponytail: title text — no physical incapacidad form exists; mirror the permiso header */}
          <div style={{ flex: 1, textAlign: 'center', ...s.bold, fontSize: 15, letterSpacing: 1 }}>
            AVISO DE INCAPACIDAD
          </div>
          <div style={{ width: 150, textAlign: 'right', paddingRight: 4 }}>
            <div style={{ fontSize: BODY }}>FECHA</div>
            <div style={{ borderBottom: BORDER, minHeight: 13, ...PRINT_EXACT }}>
              {fmtDate(solicitud.fechaCreacion)}
            </div>
          </div>
        </div>

        {/* FIELDS */}
        <div style={{ padding: '2px 10px 4px' }}>
          <div style={fieldRow}>
            <span style={fieldLabel}>NOMBRE:</span>
            <span style={line}>{solicitud.solicitanteNombre ?? ''}</span>
          </div>
          <div style={fieldRow}>
            <span style={fieldLabel}>PUESTO:</span>
            <span style={line}>{solicitud.solicitantePuesto ?? ''}</span>
          </div>
          <div style={fieldRow}>
            <span style={fieldLabel}>MOTIVO / DIAGNÓSTICO:</span>
            <span style={line}>{solicitud.motivo ?? ''}</span>
          </div>
          {/* ponytail: no observations field on SolicitudPersonalResponse; line rendered empty */}
          <div style={fieldRow}>
            <span style={fieldLabel}>OBSERVACIONES:</span>
            <span style={line} />
          </div>
          {/* ponytail: IMSS folio not on the response type; blank until backend exposes it */}
          <div style={fieldRow}>
            <span style={fieldLabel}>FOLIO DE INCAPACIDAD (IMSS):</span>
            <span style={line} />
          </div>
          {/* ponytail: doctor / institution not on the response type; blank until backend exposes it */}
          <div style={fieldRow}>
            <span style={fieldLabel}>MÉDICO / INSTITUCIÓN:</span>
            <span style={line} />
          </div>

          {/* DÍAS */}
          <div style={{ marginTop: 6, marginBottom: 8 }}>
            <span style={s.bold}>No DE DÍAS DE INCAPACIDAD:</span>{' '}
            <Blank w={26}>{solicitud.diasSolicitados ?? ''}</Blank> DEL <Blank w={26}>{ini.d}</Blank> DE{' '}
            <Blank w={70}>{ini.mNombre}</Blank> AL <Blank w={26}>{fin.d}</Blank> DE{' '}
            <Blank w={70}>{fin.mNombre}</Blank> DEL 20<Blank w={18}>{ini.yy}</Blank>.
          </div>
        </div>

        {/* TIPO DE INCAPACIDAD — bordered 4-cell box + labels to the right */}
        <div style={{ borderTop: BORDER, padding: '10px 10px' }}>
          <table style={{ borderCollapse: 'collapse' }}>
            <tbody>
              {INCAPACIDAD_OPCIONES.map((opcion, i) => (
                <tr key={opcion}>
                  {i === 0 && (
                    <td
                      rowSpan={4}
                      style={{ ...s.bold, verticalAlign: 'top', paddingRight: 16, whiteSpace: 'nowrap' }}
                    >
                      TIPO DE INCAPACIDAD:
                    </td>
                  )}
                  <td
                    style={{
                      border: BORDER,
                      width: 66,
                      height: 15,
                      textAlign: 'center',
                      ...s.bold,
                      ...PRINT_EXACT,
                    }}
                  >
                    {typeIdx === i ? 'X' : ''}
                  </td>
                  <td style={{ ...s.bold, paddingLeft: 12, whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                    {opcion}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* FIRMAS */}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={sigCell}>
                <div style={sigInner}>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>{sigImg(firmas.solicitante)}</div>
                  <div style={sigLabel}>FIRMA SOLICITANTE</div>
                </div>
              </td>
              <td style={{ ...sigCell, borderLeft: BORDER }}>
                <div style={sigInner}>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>{sigImg(firmas.autorizacion)}</div>
                  <div style={sigLabel}>FIRMA AUTORIZACIÓN</div>
                </div>
              </td>
              <td style={{ ...sigCell, borderLeft: BORDER }}>
                <div style={sigInner}>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>{sigImg(firmas.nomina)}</div>
                  <div style={sigLabel}>JEFE NÓMINAS</div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function IncapacidadPDF({ solicitud, historial = [], pasosWorkflow = [] }: Props) {
  const firmasMap = useMemo(() => buildFirmasMap(historial), [historial]);

  const flujoPasos = useMemo(() => {
    const porPaso = new Map<number, HistorialWorkflowItemResponse[]>();
    for (const h of historial) {
      const arr = porPaso.get(h.idPaso) ?? [];
      arr.push(h);
      porPaso.set(h.idPaso, arr);
    }
    return pasosWorkflow
      .filter((p) => p.activo)
      .sort((a, b) => a.orden - b.orden)
      .map((paso) => {
        const eventos = porPaso.get(paso.idPaso) ?? [];
        const ultimo = eventos.length > 0 ? eventos[eventos.length - 1] : null;
        return { paso, ultimo };
      });
  }, [pasosWorkflow, historial]);

  // ponytail: FIRMA AUTORIZACIÓN — step name keyword match; fallback to first non-start step with event
  const autorizacion = useMemo(() => {
    const byName = flujoPasos.find(
      (f) => f.ultimo && /autoriz|jefe|directo|valida|aprueba/i.test(f.paso.nombrePaso),
    );
    if (byName?.ultimo) return byName.ultimo;
    return flujoPasos.find((f) => f.ultimo && !f.paso.esInicio)?.ultimo ?? null;
  }, [flujoPasos]);

  // ponytail: JEFE NÓMINAS — step name keyword match; empty cell if no match
  const nomina = useMemo(
    () =>
      flujoPasos.find((f) => f.ultimo && /n[oó]mina|nomina|rh|recursos/i.test(f.paso.nombrePaso))?.ultimo ?? null,
    [flujoPasos],
  );

  const firmas: Firmas = {
    solicitante: solicitud.idUsuarioCreador > 0 ? firmaUrl(solicitud.idUsuarioCreador) : undefined,
    autorizacion: autorizacion && autorizacion.idUsuario > 0 ? firmasMap.get(autorizacion.idUsuario) : undefined,
    nomina: nomina && nomina.idUsuario > 0 ? firmasMap.get(nomina.idUsuario) : undefined,
  };

  const typeIdx = incapacidadTypeIndex(solicitud.motivo, solicitud.tipoSolicitudNombre);

  // El formato físico lleva 2 copias idénticas por hoja (original + empleado).
  return (
    <div id="solicitud-personal-pdf-print" style={s.page}>
      <FormCopy solicitud={solicitud} typeIdx={typeIdx} firmas={firmas} />
      {/* ponytail: inter-copy cut gap (40px ≈ 10.6mm); keeps both copies on one A4 with default print margins. */}
      <div style={{ height: 40 }} />
      <FormCopy solicitud={solicitud} typeIdx={typeIdx} firmas={firmas} />
    </div>
  );
}

export default IncapacidadPDF;
