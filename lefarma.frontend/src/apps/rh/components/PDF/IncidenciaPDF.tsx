import React, { useMemo } from 'react';
import type { Props } from './SolicitudPersonalPDF';
import { FirmaMarcador, firmantesDelFlujo, type FirmanteFlow } from './SolicitudPersonalPDF';
import { FirmaImg } from '@/components/common/FirmaImg';
import logoImage from '@/assets/logo.png';
import { fmtDate } from './pdfFormat';
import {
  INCIDENCIA_OPCIONES,
  NOTES,
  PERMISO_OPCIONES,
  indicesIncidencia,
  normalize,
  splitFechaISO as splitFecha,
} from '@/apps/rh/utils/pdf/incidenciaFormato';

const BLUE = '#00B0F0';
const CBOX = '#41719C';
const BLACK = '#000000';
// ponytail: gray bands behind the permiso checkbox rows copied from the printed form.
const GRAY = '#EDEDED';
const BORDER = `1px solid ${BLACK}`;

const PRINT_EXACT: React.CSSProperties = {
  printColorAdjust: 'exact',
  WebkitPrintColorAdjust: 'exact',
};

// ponytail: fontSize lives on the FormCopy wrapper (not only on #...-print) so the global
// print rule `#solicitud-personal-pdf-print { font-size:10pt !important }` can't inflate the
// body text — that inflation is what pushed the 2 copies onto a 2nd sheet.
const BODY = 8;

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
  row: { borderBottom: BORDER },
  rowFlex: { borderBottom: BORDER, display: 'flex' },
  cell: { padding: '1px 4px', fontSize: BODY },
  vDiv: { borderRight: BORDER },
  bold: { fontWeight: 700 },
};

// splitFecha/normalize ahora viven en incidenciaFormato.ts (splitFechaISO, normalize) y se
// comparten con el generador de texto.

// ponytail: checkbox selection by tipoSolicitudNombre is best-effort keyword match
// (tipo labels are DB-driven, not confirmable against these form strings). Falsy if no match.
// ponytail: shaded=false for the Justificación rows (white in the printed form);
// only the Permiso rows carry the gray band (zebra). spaced=true adds the vertical
// gap between the Justificación rows that the printed form shows.
function Checkbox({
  checked,
  label,
  shaded = true,
  spaced = false,
}: {
  checked: boolean;
  label: string;
  shaded?: boolean;
  spaced?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        background: shaded ? GRAY : 'transparent',
        padding: '0 3px',
        // ponytail: 9px gap on the (white) Justificación rows is what makes the spacing visible
        // at print-preview zoom; 1px gives the thin white seam between the Permiso gray bands.
        marginBottom: spaced ? 9 : 1,
        ...PRINT_EXACT,
      }}
    >
      <span
        style={{
          display: 'inline-block',
          width: 8,
          height: 8,
          flexShrink: 0,
          border: `1px solid ${CBOX}`,
          background: '#fff',
          lineHeight: '8px',
          textAlign: 'center',
          fontSize: 7,
          fontWeight: 700,
          ...PRINT_EXACT,
        }}
      >
        {checked ? 'X' : ''}
      </span>
      <span style={{ fontSize: 7.5 }}>{label}</span>
    </div>
  );
}

const gridCell: React.CSSProperties = {
  border: BORDER,
  fontSize: 6.5,
  textAlign: 'center',
  padding: '0 2px',
};

// DÍA/MES/AÑO grid; `filas` = total value rows; `fillRow` (1-based) = the only value row that
// carries the date — the row aligned with the checked option. 0 / out of range => all empty.
function FechaGrid({
  titulo,
  fecha,
  filas = 1,
  fillRow = 0,
  width,
}: {
  titulo?: string;
  fecha?: string | null;
  filas?: number;
  fillRow?: number;
  width?: number | string;
}) {
  const { d, m, y } = splitFecha(fecha);
  const show = (i: number) => (fecha && i === fillRow ? { d, m, y } : { d: '', m: '', y: '' });
  return (
    <table style={{ width: width ?? '100%', borderCollapse: 'collapse' }}>
      <tbody>
        {titulo ? (
          <tr>
            <td colSpan={3} style={{ ...gridCell, fontWeight: 700 }}>
              {titulo}
            </td>
          </tr>
        ) : null}
        <tr>
          <td style={{ ...gridCell, fontWeight: 700, width: '34%' }}>DÍA</td>
          <td style={{ ...gridCell, fontWeight: 700, width: '33%' }}>MES</td>
          <td style={{ ...gridCell, fontWeight: 700 }}>AÑO</td>
        </tr>
        {Array.from({ length: filas }, (_, i) => {
          const v = show(i + 1);
          return (
            <tr key={i}>
              <td style={{ ...gridCell, height: 9 }}>{v.d}</td>
              <td style={gridCell}>{v.m}</td>
              <td style={gridCell}>{v.y}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// INCIDENCIA_OPCIONES / PERMISO_OPCIONES / NOTES / indicesIncidencia viven en
// incidenciaFormato.ts (compartidos con el generador de texto).

type Solicitud = Props['solicitud'];

function FormCopy({
  solicitud,
  firmantes,
  marcadorVisible = false,
}: {
  solicitud: Solicitud;
  firmantes: FirmanteFlow[];
  marcadorVisible?: boolean;
}) {
  const empresa = solicitud.empresaNombre ?? `ID ${solicitud.idEmpresa}`;
  const area = solicitud.areaNombre ?? `ID ${solicitud.idArea}`;
  const puesto = solicitud.solicitantePuesto ?? '-';
  const nombre = solicitud.solicitanteNombre ?? '-';
  const fechaInc = solicitud.fechaInicio;
  const tipoNorm = normalize(solicitud.tipoSolicitudNombre);

  // Index (0-based) of the checked option in each group; -1 if none. Drives both the tick and
  // the grid row the date lands on (so the date sits "enfrente" of its option, not always row 1).
  // Reposición grid rows map to the two "con reposición" options (idx 1 and 3).
  const { idxJust, idxPerm, fillRepos } = indicesIncidencia(solicitud.tipoSolicitudNombre);

  const sigCell: React.CSSProperties = {
    height: 44,
    verticalAlign: 'bottom',
    textAlign: 'center',
  };
  const sigLabel: React.CSSProperties = {
    borderTop: BORDER,
    fontSize: 6.5,
    textAlign: 'center',
    padding: '0 2px',
    verticalAlign: 'top',
    fontWeight: 700,
  };
  const sigImg = (f: FirmanteFlow | null | undefined) =>
    f?.pendienteFirma ? (
      <FirmaMarcador style={{ fontSize: 12 }} visible={marcadorVisible} />
    ) : f?.url ? (
      <FirmaImg endpoint={f.url} style={{ height: 36, objectFit: 'contain', ...PRINT_EXACT }} />
    ) : null;

  const colLeft: React.CSSProperties = { width: '38%', paddingRight: 6, boxSizing: 'border-box' };

  return (
    // fontSize here shields the body text from the global print 10pt !important rule.
    <div style={{ fontSize: BODY, breakInside: 'avoid' }}>
      <div style={s.form}>
        {/* HEADER — sin divisor vertical entre logo y título (como el original) */}
        <div style={{ ...s.row, display: 'flex', alignItems: 'center' }}>
          <div style={{ width: 130, padding: '3px 4px', display: 'flex', alignItems: 'center' }}>
            <img src={logoImage} alt="Grupo Lefarma" style={{ width: 92, height: 26, objectFit: 'contain' }} />
          </div>
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              paddingRight: 14,
              fontWeight: 700,
              fontSize: 11,
              letterSpacing: 0.5,
              textTransform: 'uppercase',
              color: BLUE,
              ...PRINT_EXACT,
            }}
          >
            FORMATO DE INCIDENCIAS Y PERMISOS
          </div>
        </div>

        {/* DATOS */}
        <div style={s.rowFlex}>
          <div style={{ ...s.cell, ...s.vDiv, flex: 1 }}>
            <span style={s.bold}>Empresa:</span> {empresa}
          </div>
          <div style={{ ...s.cell, ...s.vDiv, flex: 1 }}>
            <span style={s.bold}>Area:</span> {area}
          </div>
          <div style={{ ...s.cell, ...s.vDiv, flex: 1 }}>
            <span style={s.bold}>Puesto:</span> {puesto}
          </div>
          <div style={{ ...s.cell, flex: 1 }}>
            <span style={s.bold}>Fecha:</span> {fmtDate(solicitud.fechaCreacion)}
          </div>
        </div>

        {/* NOMBRE */}
        <div style={s.rowFlex}>
          <div style={{ ...s.cell, ...s.vDiv, width: '24%', textAlign: 'center' }}>
            <span style={s.bold}>NOMBRE:</span>
          </div>
          <div style={{ ...s.cell, flex: 1 }}>{nombre}</div>
        </div>

        {/* BLOQUE CENTRAL — una sola celda, SIN líneas internas (como el original) */}
        <div style={{ ...s.row, padding: '3px 5px' }}>
          {/* Banda 1: Justificación + Fecha de incidencia */}
          <div style={{ display: 'flex' }}>
            <div style={colLeft}>
              <div style={s.bold}>Justificación de Incidencia:</div>
              <div style={{ marginTop: 2 }}>
                {INCIDENCIA_OPCIONES.map((o) => (
                  <Checkbox
                    key={o.label}
                    shaded={false}
                    spaced
                    checked={o.match(tipoNorm)}
                    label={o.label}
                  />
                ))}
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ width: 150 }}>
                <div style={{ ...s.bold, textAlign: 'center', fontSize: 7.5 }}>Fecha de incidencia</div>
                <FechaGrid fecha={fechaInc} filas={3} fillRow={idxJust >= 0 ? idxJust + 1 : 0} width={150} />
              </div>
            </div>
          </div>

          {/* Banda 2: Permiso + Fecha de aplicación + Reposición + Lugar */}
          <div style={{ display: 'flex', marginTop: 3 }}>
            <div style={colLeft}>
              <div style={s.bold}>Solicitud de Permiso:</div>
              <div style={{ marginTop: 2 }}>
                {PERMISO_OPCIONES.map((o, i) => (
                  <Checkbox
                    key={o.label}
                    shaded={i % 2 === 1}
                    checked={o.match(tipoNorm)}
                    label={o.label}
                  />
                ))}
              </div>
            </div>
            <div style={{ width: '24%', paddingRight: 6, boxSizing: 'border-box' }}>
              <div style={{ ...s.bold, textAlign: 'center', fontSize: 7.5 }}>Fecha de aplicación:</div>
              <FechaGrid
                fecha={fechaInc}
                filas={4}
                fillRow={idxPerm >= 0 && idxPerm <= 3 ? idxPerm + 1 : 0}
              />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ ...s.bold, fontSize: 7.5 }}>En caso de reposición de tiempo especificar:</div>
              <div style={{ marginTop: 1 }}>
                <FechaGrid fecha={solicitud.fechaReposicion} filas={2} fillRow={fillRepos} width={'78%'} />
              </div>
              <div style={{ marginTop: 2, ...s.bold, fontSize: 7.5 }}>Lugar de comisión:</div>
              <div style={{ border: BORDER, minHeight: 10, width: '78%', padding: '0 3px', marginTop: 1 }}>
                {solicitud.lugarComision ?? ''}
              </div>
            </div>
          </div>

          {/* Banda 3: Consideraciones */}
          <div style={{ marginTop: 3 }}>
            <span style={s.bold}>Consideraciones:</span>
            <div style={{ fontSize: 6.5, lineHeight: 1.2 }}>
              {NOTES.map((n, i) => (
                <div key={i}>{n}</div>
              ))}
            </div>
          </div>
        </div>

        {/* DESCRIPCIÓN / MOTIVO */}
        <div style={{ ...s.row, padding: '1px 5px' }}>
          <span style={s.bold}>Descripción / Motivo&nbsp; / Incidencia o Permiso:</span>
          <div style={{ minHeight: 26, padding: '1px 0', textAlign: 'justify' }}>{solicitud.motivo ?? ''}</div>
        </div>

        {/* FIRMAS — una caja por firmante del flujo aprobado (SOLICITA + cada AUTORIZA firmado) */}
        <div style={{ borderTop: BORDER }}>
          <div style={{ borderBottom: BORDER, textAlign: 'center', fontSize: 7, fontWeight: 700, padding: '1px 0' }}>
            FIRMAS DE AUTORIZACIÓN
          </div>
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
                <div
                  style={{
                    ...sigCell,
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'center',
                    padding: '0 4px',
                  }}
                >
                  {sigImg(f)}
                </div>
                <div style={sigLabel}>
                  {f.esSolicitante ? 'SOLICITA' : 'AUTORIZA'}
                  <div style={{ fontWeight: 400 }}>{f.nombre}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FOOTER (fuera del borde, como el formato) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 5, padding: '1px 2px' }}>
        <span>LEF-RHU-FOR-007</span>
        <span>Versión: 01</span>
        <span>Prohibida su reproducción no autorizada</span>
        <span>Página 1 de 1</span>
      </div>
    </div>
  );
}

export function IncidenciaPDF({
  solicitud,
  historial = [],
  pasosWorkflow = [],
  firmaDirector = false,
  marcadorVisible = false,
}: Props) {
  // Firmantes del flujo aprobado: solicitante + cada paso firmado en orden de workflow.
  const firmantes = useMemo(
    () => firmantesDelFlujo(pasosWorkflow, historial, firmaDirector),
    [pasosWorkflow, historial, firmaDirector]
  );

  // El formato físico lleva 2 copias idénticas por hoja (original + empleado).
  return (
    <div id="solicitud-personal-pdf-print" style={s.page}>
      <FormCopy solicitud={solicitud} firmantes={firmantes} marcadorVisible={marcadorVisible} />
      {/* ponytail: inter-copy cut gap (40px ≈ 10.6mm); max visible value that keeps both copies on one A4 even with default print margins. */}
      <div style={{ height: 40 }} />
      <FormCopy solicitud={solicitud} firmantes={firmantes} marcadorVisible={marcadorVisible} />
    </div>
  );
}

export default IncidenciaPDF;
