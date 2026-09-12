import React, { useMemo } from 'react';
import type { Props } from './SolicitudPersonalPDF';
import { firmantesDelFlujo, type FirmanteFlow } from './SolicitudPersonalPDF';
import logoImage from '@/assets/logo.png';
import { fmtDate } from './pdfFormat';

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

// ponytail: keyword heuristic for goce reason; map to a dedicated field if the backend ever stores it
function goceReasonIndex(motivo?: string | null, tipoNombre?: string | null): number {
  const text = `${motivo ?? ''} ${tipoNombre ?? ''}`.toLowerCase();
  if (/matrimonio|boda/.test(text)) return 0;
  if (/nacimiento|naci|alumbr|hijo/.test(text)) return 1;
  if (/fallec|defunc|deceso|muerte|viud/.test(text)) return 2;
  return 3;
}

const GOCE_OPCIONES = [
  'MATRIMONIO',
  'NACIMIENTO DE HIJO',
  'FALLECIMIENTO (PADRES,HIJOS,CONYUGE)',
  'OTROS',
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

function FormCopy({ solicitud, reasonIdx, firmantes }: { solicitud: Solicitud; reasonIdx: number; firmantes: FirmanteFlow[] }) {
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
      <img src={url} alt="Firma" style={{ maxHeight: 44, objectFit: 'contain', ...PRINT_EXACT }} />
    ) : null;
  const sigCell: React.CSSProperties = {
    borderTop: BORDER,
    height: 72,
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
          <div style={{ flex: 1, textAlign: 'center', ...s.bold, fontSize: 15, letterSpacing: 1 }}>
            SOLICITUD DE PERMISO
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
            <span style={fieldLabel}>MOTIVO:</span>
            <span style={line}>{solicitud.motivo ?? ''}</span>
          </div>
          {/* ponytail: no dedicated observations field on SolicitudPersonalResponse; line rendered empty */}
          <div style={fieldRow}>
            <span style={fieldLabel}>OBSERVACIONES:</span>
            <span style={line} />
          </div>

          {/* DÍAS */}
          <div style={{ marginTop: 6, marginBottom: 8 }}>
            <span style={s.bold}>No DE DIAS HABILES:</span> <Blank w={26}>{solicitud.diasSolicitados ?? ''}</Blank>{' '}
            DEL <Blank w={26}>{ini.d}</Blank> DE <Blank w={70}>{ini.mNombre}</Blank> AL{' '}
            <Blank w={26}>{fin.d}</Blank> DE <Blank w={70}>{fin.mNombre}</Blank> DEL 20
            <Blank w={18}>{ini.yy}</Blank>.
          </div>
        </div>

        {/* CON GOCE DE SUELDO POR — bordered 4-cell box + labels to the right */}
        <div style={{ borderTop: BORDER, padding: '10px 10px' }}>
          <table style={{ borderCollapse: 'collapse' }}>
            <tbody>
              {GOCE_OPCIONES.map((opcion, i) => (
                <tr key={opcion}>
                  {i === 0 && (
                    <td
                      rowSpan={4}
                      style={{ ...s.bold, verticalAlign: 'top', paddingRight: 16, whiteSpace: 'nowrap' }}
                    >
                      CON GOCE DE SUELDO POR:
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
                    {reasonIdx === i ? 'X' : ''}
                  </td>
                  <td style={{ ...s.bold, paddingLeft: 12, whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                    {opcion}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* FIRMAS — una caja por firmante del flujo aprobado (SOLICITA + cada AUTORIZA firmado) */}
        <div style={{ display: 'flex', flexWrap: 'wrap' }}>
          {firmantes.map((f, i) => (
            <div
              key={i}
              style={{
                flex: '1 1 23%',
                minWidth: 140,
                boxSizing: 'border-box',
                borderLeft: i > 0 ? BORDER : undefined,
              }}
            >
              <div style={sigCell}>
                <div style={sigInner}>
                  {/* Firma encima de una línea continua (la línea es elemento propio, no un border del contenedor). */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center' }}>
                    {sigImg(f.url)}
                    <div style={{ width: '100%', borderTop: BORDER }} />
                  </div>
                  <div style={sigLabel}>{f.esSolicitante ? 'SOLICITA' : 'AUTORIZA'}</div>
                  <div style={{ ...sigLabel, fontWeight: 400, textAlign: 'center' }}>{f.nombre}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function GoceDeSueldoPDF({ solicitud, historial = [], pasosWorkflow = [] }: Props) {
  // Firmantes del flujo aprobado: solicitante + cada paso firmado en orden de workflow.
  const firmantes = useMemo(() => firmantesDelFlujo(pasosWorkflow, historial), [pasosWorkflow, historial]);

  const reasonIdx = goceReasonIndex(solicitud.motivo, solicitud.tipoSolicitudNombre);

  // El formato físico lleva 2 copias idénticas por hoja (original + empleado).
  return (
    <div id="solicitud-personal-pdf-print" style={s.page}>
      <FormCopy solicitud={solicitud} reasonIdx={reasonIdx} firmantes={firmantes} />
      {/* ponytail: inter-copy cut gap (40px ≈ 10.6mm); keeps both copies on one A4 with default print margins. */}
      <div style={{ height: 40 }} />
      <FormCopy solicitud={solicitud} reasonIdx={reasonIdx} firmantes={firmantes} />
    </div>
  );
}

export default GoceDeSueldoPDF;
