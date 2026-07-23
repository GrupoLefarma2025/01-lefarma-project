import React, { useMemo } from 'react';
import type { Props } from './SolicitudPersonalPDF';
import type { HistorialWorkflowItemResponse } from '@/types/solicitudPersonalWorkflow.types';
import logoImage from '@/assets/logo.png';

// ponytail: buildFirmasMap duplicated from SolicitudPersonalPDF (not exported there);
// inlining ~10 lines is a smaller diff than refactoring an unrelated file.
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

// Split an ISO date into DÍA/MES/AÑO without JS-Date timezone drift.
function splitFecha(fecha?: string | null) {
  if (!fecha) return { d: '', m: '', y: '' };
  const mt = /^(\d{4})-(\d{2})-(\d{2})/.exec(fecha);
  if (mt) return { y: mt[1], m: mt[2], d: mt[3] };
  const dt = new Date(fecha);
  if (isNaN(dt.getTime())) return { d: '', m: '', y: '' };
  return {
    y: String(dt.getFullYear()),
    m: String(dt.getMonth() + 1).padStart(2, '0'),
    d: String(dt.getDate()).padStart(2, '0'),
  };
}

const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function fmtShort(fecha?: string | null) {
  const { d, m, y } = splitFecha(fecha);
  return d ? `${d}/${m}/${y}` : '';
}

const BLACK = '#000';

// ponytail: fontSize is left to inherit (10pt) on body text because the global print rule
// forces #solicitud-personal-pdf-print { font-size:10pt !important }; only the small
// sub-labels set an explicit size to override that inheritance.
const s: Record<string, React.CSSProperties> = {
  page: {
    fontFamily: "'Arial', sans-serif",
    color: BLACK,
    background: '#fff',
    padding: '24px 30px',
    maxWidth: 820,
    margin: '0 auto',
    boxSizing: 'border-box',
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  box: {
    border: `3px double ${BLACK}`,
    padding: '22px 30px',
    marginTop: 36,
    minHeight: 700,
    boxSizing: 'border-box',
  },
  sub: { textAlign: 'center', fontSize: 9 },
};

const fillLine: React.CSSProperties = {
  flex: 1,
  borderBottom: `1px solid ${BLACK}`,
  display: 'inline-block',
  textAlign: 'center',
  padding: '0 6px',
  minHeight: '1.3em',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
};

const firmaLine: React.CSSProperties = {
  flex: 1,
  borderBottom: `1px solid ${BLACK}`,
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'center',
  height: 30,
  padding: '0 6px',
};

const blank = (w: number): React.CSSProperties => ({
  display: 'inline-block',
  width: w,
  borderBottom: `1px solid ${BLACK}`,
  textAlign: 'center',
  padding: '0 2px',
  minHeight: '1.3em',
});

const ctlCell: React.CSSProperties = {
  border: `1px solid ${BLACK}`,
  padding: '2px 8px',
  textAlign: 'center',
  fontSize: 9,
};

const sigImgStyle: React.CSSProperties = {
  height: 24,
  objectFit: 'contain',
  maxWidth: '100%',
};

interface Firmante {
  nombre: string;
  url?: string;
}

export function VacacionesPDF({ solicitud, historial = [], pasosWorkflow = [] }: Props) {
  const firmasMap = useMemo(() => buildFirmasMap(historial), [historial]);

  // ponytail: role->slot mapping is best-effort by workflow order
  // ([0] solicitante, [1] jefe de área, [2] jefe nómina); unsigned slots stay blank.
  const firmantes = useMemo(
    () =>
      pasosWorkflow
        .filter((p) => p.activo)
        .sort((a, b) => a.orden - b.orden)
        .map((paso): Firmante | null => {
          const eventos = historial.filter((h) => h.idPaso === paso.idPaso);
          const ultimo = eventos.length > 0 ? eventos[eventos.length - 1] : null;
          return ultimo
            ? {
                nombre: ultimo.nombreUsuario ?? `Usuario ${ultimo.idUsuario}`,
                url: ultimo.idUsuario > 0 ? firmasMap.get(ultimo.idUsuario) : undefined,
              }
            : null;
        })
        .slice(0, 3),
    [pasosWorkflow, historial, firmasMap],
  );

  const empresa = solicitud.empresaNombre ?? '';
  const trabajador = solicitud.solicitanteNombre ?? '';
  const area = solicitud.areaNombre ?? '';
  const para = firmantes[1]?.nombre ?? '';

  const elab = splitFecha(solicitud.fechaCreacion);
  const dias = solicitud.diasSolicitados ?? '';

  const detalle = solicitud.detalle ?? [];
  const fechas =
    detalle.length > 0
      ? detalle.map((d) => fmtShort(d.fecha)).join(', ')
      : [fmtShort(solicitud.fechaInicio), fmtShort(solicitud.fechaFin)]
          .filter(Boolean)
          .join(' al ');

  const reg = splitFecha(solicitud.fechaRegreso);
  const regMes = reg.m ? MONTHS[parseInt(reg.m, 10) - 1] ?? '' : '';

  const solicitaNombre = firmantes[0]?.nombre ?? trabajador;

  // ponytail: plain function returning JSX (not a nested component) to satisfy
  // react-hooks/static-components — a nested component remounts every render.
  const firma = (f?: string) => (f ? <img src={f} alt="Firma" style={sigImgStyle} /> : null);

  return (
    <div id="solicitud-personal-pdf-print" style={s.page}>
      {/* ── ENCABEZADO: logo + tabla de control ── */}
      <div style={s.headerRow}>
        <img
          src={logoImage}
          alt="Grupo Lefarma"
          style={{ width: 170, height: 64, objectFit: 'contain' }}
        />
        <table style={{ borderCollapse: 'collapse', width: '56%' }}>
          <tbody>
            <tr>
              <td rowSpan={3} style={{ ...ctlCell, width: '42%', lineHeight: 1.2 }}>
                SOLICITUD
                <br />
                DE
                <br />
                VACACIONES
              </td>
              <td style={ctlCell}>Código</td>
              <td style={ctlCell}>FT-RH-RS-06</td>
            </tr>
            <tr>
              <td style={ctlCell}>Revisión</td>
              <td style={ctlCell}>01</td>
            </tr>
            <tr>
              <td style={ctlCell}>Periodo de Ret.</td>
              <td style={ctlCell}>1 Año</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── CUERPO DEL FORMATO ── */}
      <div style={s.box}>
        {/* EMPRESA */}
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ width: '40%' }} />
          <span style={{ whiteSpace: 'nowrap' }}>EMPRESA:&nbsp;</span>
          <span style={fillLine}>{empresa}</span>
        </div>

        {/* DE / PARA */}
        <div style={{ display: 'flex', gap: 24, marginTop: 16 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <span style={{ whiteSpace: 'nowrap' }}>DE:&nbsp;</span>
              <span style={fillLine}>{trabajador}</span>
            </div>
            <div style={s.sub}>(Nombre del trabajador)</div>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <span style={{ whiteSpace: 'nowrap' }}>PARA:&nbsp;</span>
              <span style={fillLine}>{para}</span>
            </div>
            <div style={s.sub}>(Jefe de área)</div>
          </div>
        </div>

        {/* ÁREA / FECHA DE ELABORACIÓN */}
        <div style={{ display: 'flex', gap: 24, marginTop: 12 }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end' }}>
            <span style={{ whiteSpace: 'nowrap' }}>ÁREA:&nbsp;</span>
            <span style={fillLine}>{area}</span>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
              <span>DÍA:</span>
              <span style={blank(28)}>{elab.d}</span>
              <span>MES:</span>
              <span style={blank(28)}>{elab.m}</span>
              <span>AÑO:</span>
              <span style={blank(40)}>{elab.y}</span>
            </div>
            <div style={s.sub}>(Fecha de elaboración)</div>
          </div>
        </div>

        {/* PÁRRAFO DE SOLICITUD */}
        <div style={{ marginTop: 28, lineHeight: 1.7 }}>
          <div>
            Por medio de la presente, solicito a usted se me otorguen vacaciones, por{' '}
            <span style={blank(28)}>{dias}</span>día(s)
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <span style={{ whiteSpace: 'nowrap' }}>
              Deseo que dichas vacaciones sean en las siguientes fechas:&nbsp;
            </span>
            <span style={fillLine}>{fechas}</span>
          </div>
          <div style={{ borderBottom: `1px solid ${BLACK}`, minHeight: '1.3em', marginTop: 2 }} />
          <div style={{ marginTop: 6 }}>
            Acordando lo presente a Gerencia General para su autorización.
          </div>
        </div>

        {/* SOLICITA EL TRABAJADOR */}
        <div style={{ width: '60%', marginLeft: 'auto', marginTop: 95 }}>
          <div style={{ textAlign: 'right', marginBottom: 12 }}>SOLICITA EL TRABAJADOR</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', marginBottom: 8 }}>
            <span style={{ whiteSpace: 'nowrap' }}>NOMBRE:&nbsp;</span>
            <span style={fillLine}>{solicitaNombre}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <span style={{ whiteSpace: 'nowrap' }}>FIRMA:&nbsp;</span>
            <span style={firmaLine}>
              {firma(firmantes[0]?.url)}
            </span>
          </div>
        </div>

        {/* AUTORIZACIONES */}
        <div style={{ display: 'flex', gap: 30, marginTop: 75 }}>
          <div style={{ flex: 1 }}>
            <div style={{ marginBottom: 10 }}>AUTORIZACION&nbsp;&nbsp;JEFE&nbsp;&nbsp;DE ÁREA</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', marginBottom: 8 }}>
              <span style={{ whiteSpace: 'nowrap' }}>NOMBRE&nbsp;</span>
              <span style={fillLine}>{firmantes[1]?.nombre ?? ''}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <span style={{ whiteSpace: 'nowrap' }}>FIRMA&nbsp;</span>
              <span style={firmaLine}>
                {firma(firmantes[1]?.url)}
              </span>
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ textAlign: 'center', marginBottom: 10 }}>Vo. Bo. JEFE NOMINA</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', marginBottom: 8 }}>
              <span style={{ whiteSpace: 'nowrap' }}>NOMBRE&nbsp;</span>
              <span style={fillLine}>{firmantes[2]?.nombre ?? ''}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <span style={{ whiteSpace: 'nowrap' }}>FIRMA&nbsp;</span>
              <span style={firmaLine}>
                {firma(firmantes[2]?.url)}
              </span>
            </div>
          </div>
        </div>

        {/* FECHA DE REGRESO */}
        <div style={{ textAlign: 'center', marginTop: 65 }}>
          La fecha a presentarse a trabajar será el día <span style={blank(28)}>{reg.d}</span> de{' '}
          <span style={blank(80)}>{regMes}</span> del 20<span style={blank(28)}>{reg.y.slice(-2)}</span>
        </div>
      </div>
    </div>
  );
}

export default VacacionesPDF;
