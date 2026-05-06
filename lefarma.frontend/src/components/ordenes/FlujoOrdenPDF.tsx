import type { OrdenCompraResponse } from '@/types/ordenCompra.types';
import logoImage from '@/assets/logo.png';

// ─── Types (mirrored from AutorizacionesOC) ─────────────────────────────────

export interface HistorialPDFItem {
  idEvento: number;
  idPaso: number;
  idAccion: number;
  nombreAccion?: string | null;
  idUsuario: number;
  nombreUsuario?: string | null;
  comentario?: string | null;
  datosSnapshot?: string | null;
  fechaEvento: string;
}

export interface PasoPDFConfig {
  idPaso: number;
  orden: number;
  nombrePaso: string;
  descripcionAyuda?: string | null;
  esInicio: boolean;
  esFinal: boolean;
}

export type EstadoVisual =
  | 'actual'
  | 'completado'
  | 'pendiente'
  | 'omitido'
  | 'rechazado'
  | 'devuelto';

export interface ProgresoPasoPDF extends PasoPDFConfig {
  estadoVisual: EstadoVisual;
}

interface Props {
  orden: OrdenCompraResponse;
  progresoPasos: ProgresoPasoPDF[];
  eventosPorPaso: Map<number, HistorialPDFItem[]>;
  pasosMap: Map<number, PasoPDFConfig>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ESTADO_INFO: Record<number, { label: string; bg: string; color: string }> = {
  1:  { label: 'Creada', bg: '#dbeafe', color: '#1e3a8a' },
  2:  { label: 'En Revisión', bg: '#dbeafe', color: '#1e3a8a' },
  3:  { label: 'Autorizada', bg: '#dbeafe', color: '#1e3a8a' },
  4:  { label: 'En Tesorería', bg: '#dbeafe', color: '#1e3a8a' },
  5:  { label: 'Pagada', bg: '#dcfce7', color: '#166534' },
  6:  { label: 'En Comprobación', bg: '#dbeafe', color: '#1e3a8a' },
  7:  { label: 'Cerrada', bg: '#dcfce7', color: '#166534' },
  8:  { label: 'Rechazada', bg: '#fee2e2', color: '#991b1b' },
  9:  { label: 'Cancelada', bg: '#fee2e2', color: '#991b1b' },
  10: { label: 'Devuelta', bg: '#dbeafe', color: '#1e3a8a' },
};

const ESTADO_COLOR: Record<EstadoVisual, string> = {
  completado: '#16a34a',
  rechazado: '#dc2626',
  devuelto: '#d97706',
  actual: '#1d4ed8',
  omitido: '#9ca3af',
  pendiente: '#9ca3af',
};

const ESTADO_VISUAL_LABEL: Record<EstadoVisual, string> = {
  completado: 'Completado',
  rechazado: 'Rechazado',
  devuelto: 'Devuelto',
  actual: 'Paso actual',
  omitido: 'Omitido',
  pendiente: 'En espera',
};

function fmt(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function fmtDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function fmtMoney(n: number) {
  return n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}

function getMovimiento(
  snap: string | null | undefined,
  pasosMap: Map<number, PasoPDFConfig>
): string | null {
  if (!snap) return null;
  try {
    const s = JSON.parse(snap) as {
      idPasoAnterior?: number | null;
      idPasoNuevo?: number | null;
    };
    const from = s.idPasoAnterior ? pasosMap.get(s.idPasoAnterior)?.nombrePaso : null;
    const to = s.idPasoNuevo ? pasosMap.get(s.idPasoNuevo)?.nombrePaso : null;
    if (!from && !to) return null;
    if (from && to && from !== to) return `${from} → ${to}`;
    if (to) return `Permanece en ${to}`;
    return null;
  } catch {
    return null;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FlujoOrdenPDF({ orden, progresoPasos, eventosPorPaso, pasosMap }: Props) {
  const now = new Date().toLocaleString('es-MX', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const estInfo = ESTADO_INFO[orden.idEstado] ?? { label: `Estado ${orden.idEstado}`, bg: '#dbeafe', color: '#1e3a8a' };
  const estadoBg = estInfo.bg;
  const estadoColor = estInfo.color;

  return (
    <div id="flujo-pdf-print">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="pdf-header">
        <div className="pdf-header-left">
          <img 
            src={logoImage} 
            alt="Lefarma" 
            style={{ height: '40px', width: 'auto', objectFit: 'contain' }}
          />
          <div className="pdf-subtitle">Sistema de Autorizaciones</div>
        </div>
        <div className="pdf-header-right">
          <div className="pdf-report-title">Comprobante de Autorización</div>
          <div className="pdf-report-date">Generado: {now}</div>
        </div>
      </div>

      {/* ── Datos de la Orden ──────────────────────────────────────────── */}
      <div className="pdf-section">
        <div className="pdf-section-title">Datos de la Orden</div>
        <div className="pdf-orden-grid">
          <div className="pdf-field-group">
            <div className="pdf-field">
              <span className="pdf-label">Folio</span>
              <span className="pdf-folio">{orden.folio}</span>
            </div>
            <div className="pdf-field">
              <span className="pdf-label">Estado</span>
              <span
                className="pdf-badge"
                style={{ backgroundColor: estadoBg, color: estadoColor }}
              >
                {estInfo.label}
              </span>
            </div>
          </div>

          <div className="pdf-field-group">
            <div className="pdf-field">
              <span className="pdf-label">Proveedor</span>
              <span className="pdf-value">{orden.razonSocialProveedor}</span>
            </div>
            {orden.rfcProveedor && (
              <div className="pdf-field">
                <span className="pdf-label">RFC</span>
                <span className="pdf-value">{orden.rfcProveedor}</span>
              </div>
            )}
            {orden.personaContacto && (
              <div className="pdf-field">
                <span className="pdf-label">Contacto</span>
                <span className="pdf-value">{orden.personaContacto}</span>
              </div>
            )}
          </div>

          <div className="pdf-field-group">
            <div className="pdf-field">
              <span className="pdf-label">Fecha solicitud</span>
              <span className="pdf-value">{fmtDate(orden.fechaSolicitud)}</span>
            </div>
            <div className="pdf-field">
              <span className="pdf-label">Fecha límite pago</span>
              <span className="pdf-value">{fmtDate(orden.fechaLimitePago)}</span>
            </div>
          </div>

          <div className="pdf-field-group">
            <div className="pdf-field">
              <span className="pdf-label">Subtotal</span>
              <span className="pdf-value">{fmtMoney(orden.subtotal)}</span>
            </div>
            <div className="pdf-field">
              <span className="pdf-label">IVA</span>
              <span className="pdf-value">{fmtMoney(orden.totalIva)}</span>
            </div>
            <div className="pdf-field">
              <span className="pdf-label">Total</span>
              <span className="pdf-total-amount">{fmtMoney(orden.total)}</span>
            </div>
          </div>
        </div>

        {(orden.notasGenerales || orden.notaFormaPago) && (
          <div style={{ display: 'flex', gap: '12px', marginTop: '8px', flexWrap: 'wrap' }}>
            {orden.notasGenerales && (
              <div className="pdf-notas" style={{ flex: 1 }}>
                <span className="pdf-label">Notas generales</span>
                <p>{orden.notasGenerales}</p>
              </div>
            )}
            {orden.notaFormaPago && (
              <div className="pdf-notas" style={{ flex: 1 }}>
                <span className="pdf-label">Nota forma de pago</span>
                <p>{orden.notaFormaPago}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Partidas ──────────────────────────────────────────────────── */}
      {orden.partidas && orden.partidas.length > 0 && (
        <div className="pdf-section">
          <div className="pdf-section-title">Partidas</div>
          <table className="pdf-table">
            <thead>
              <tr>
                <th style={{ width: '32px' }}>#</th>
                <th>Descripción</th>
                <th className="pdf-num" style={{ width: '56px' }}>Cant.</th>
                <th className="pdf-num" style={{ width: '100px' }}>Precio unit.</th>
                <th className="pdf-num" style={{ width: '56px' }}>IVA</th>
                <th className="pdf-num" style={{ width: '100px' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {orden.partidas.map((p) => (
                <tr key={p.idPartida}>
                  <td>{p.numeroPartida}</td>
                  <td>{p.descripcion}</td>
                  <td className="pdf-num">{p.cantidad}</td>
                  <td className="pdf-num">{fmtMoney(p.precioUnitario)}</td>
                  <td className="pdf-num">{p.porcentajeIva}%</td>
                  <td className="pdf-num">{fmtMoney(p.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Flujo de Autorización ─────────────────────────────────────── */}
      <div className="pdf-section">
        <div className="pdf-section-title">Flujo de Autorización</div>
        <div className="pdf-timeline">
          {progresoPasos.map((paso, index) => {
            const eventos = eventosPorPaso.get(paso.idPaso) || [];
            const color = ESTADO_COLOR[paso.estadoVisual];
            const isLast = index === progresoPasos.length - 1;

            const symbol =
              paso.estadoVisual === 'completado' ? '✓' :
              paso.estadoVisual === 'rechazado' ? '✗' :
              paso.estadoVisual === 'devuelto' ? '↩' :
              paso.estadoVisual === 'actual' ? '●' :
              String(paso.orden);

            return (
              <div key={paso.idPaso} className="pdf-paso">
                {/* Step circle + line */}
                <div className="pdf-paso-timeline">
                  <div className="pdf-paso-dot" style={{ background: color, border: `2px solid ${color}` }}>
                    {symbol}
                  </div>
                  {!isLast && (
                    <div className="pdf-paso-line" style={{ borderLeft: `2px solid ${color}33` }} />
                  )}
                </div>

                {/* Step content */}
                <div className="pdf-paso-content">
                  <div className="pdf-paso-header">
                    <span className="pdf-paso-nombre">{paso.nombrePaso}</span>
                    <span className="pdf-paso-estado" style={{ color, background: `${color}15` }}>
                      {ESTADO_VISUAL_LABEL[paso.estadoVisual]}
                    </span>
                  </div>

                  {paso.descripcionAyuda && (
                    <p className="pdf-paso-desc">{paso.descripcionAyuda}</p>
                  )}

                  {eventos.length === 0 && paso.estadoVisual !== 'pendiente' && paso.estadoVisual !== 'omitido' && (
                    <p className="pdf-sin-actividad">Sin actividad registrada.</p>
                  )}

                  {eventos.length > 0 && (
                    <div className="pdf-eventos">
                      {eventos.map((ev) => {
                        const movimiento = getMovimiento(ev.datosSnapshot, pasosMap);
                        return (
                          <div key={ev.idEvento} className="pdf-evento">
                            <div className="pdf-evento-header">
                              <span className="pdf-evento-accion">
                                {ev.nombreAccion || `Acción ${ev.idAccion}`}
                              </span>
                              <span className="pdf-evento-fecha">{fmt(ev.fechaEvento)}</span>
                            </div>
                            <div className="pdf-evento-body">
                              <div className="pdf-evento-row">
                                <span className="pdf-evento-label">Realizado por</span>
                                <span>{ev.nombreUsuario || `Usuario ${ev.idUsuario}`}</span>
                              </div>
                              {movimiento && (
                                <div className="pdf-evento-row">
                                  <span className="pdf-evento-label">Movimiento</span>
                                  <span>{movimiento}</span>
                                </div>
                              )}
                              {ev.comentario && (
                                <div className="pdf-evento-comentario">
                                  <div className="pdf-evento-label">Comentario</div>
                                  <p className="pdf-evento-comentario-text">"{ev.comentario}"</p>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <div className="pdf-footer">
        <span>Sistema Lefarma · Documento generado automáticamente · Confidencial</span>
        <span>{orden.folio}</span>
      </div>
    </div>
  );
}
