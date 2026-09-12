import React, { useMemo } from 'react';
import type { Props } from './SolicitudPersonalPDF';
import { firmantesDelFlujo, type FirmanteFlow } from './SolicitudPersonalPDF';
import logoImage from '@/assets/logo.png';

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

// ponytail: sin borderBottom aquí — la línea la dibuja el helper firma() como elemento
// propio debajo de la imagen, para que quede continua y la firma encima (sin cortarla).
const firmaLine: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'flex-end',
  alignItems: 'center',
  height: 44,
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
  height: 40,
  objectFit: 'contain',
  maxWidth: '100%',
};

export function VacacionesPDF({ solicitud, historial = [], pasosWorkflow = [] }: Props) {
  // Firmantes del flujo aprobado: solicitante + cada paso firmado en orden de workflow.
  const firmantes = useMemo(() => firmantesDelFlujo(pasosWorkflow, historial), [pasosWorkflow, historial]);
  const autorizan = firmantes.filter((f) => !f.esSolicitante);
  const solicitanteSig = firmantes.find((f) => f.esSolicitante) ?? firmantes[0];

  const empresa = solicitud.empresaNombre ?? '';
  const trabajador = solicitud.solicitanteNombre ?? '';
  const area = solicitud.areaNombre ?? '';
  const para = autorizan[0]?.nombre ?? '';

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

  const solicitaNombre = solicitanteSig?.nombre ?? trabajador;

  // ponytail: plain function returning JSX (not a nested component) to satisfy
  // react-hooks/static-components — a nested component remounts every render.
  const firma = (f?: string) => (
    <>
      {f ? <img src={f} alt="Firma" style={sigImgStyle} /> : null}
      <span style={{ display: 'block', width: '100%', borderBottom: `1px solid ${BLACK}` }} />
    </>
  );

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
            <div style={s.sub}>(Autoriza)</div>
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
              {firma(solicitanteSig?.url)}
            </span>
          </div>
        </div>

        {/* AUTORIZACIONES — una caja por autorizador del flujo */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 30, marginTop: 75 }}>
          {autorizan.map((f, i) => (
            <div key={i} style={{ flex: '1 1 30%', minWidth: 180 }}>
              <div style={{ marginBottom: 10 }}>AUTORIZA</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', marginBottom: 8 }}>
                <span style={{ whiteSpace: 'nowrap' }}>NOMBRE&nbsp;</span>
                <span style={fillLine}>{f.nombre}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <span style={{ whiteSpace: 'nowrap' }}>FIRMA&nbsp;</span>
                <span style={firmaLine}>{firma(f.url)}</span>
              </div>
            </div>
          ))}
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
