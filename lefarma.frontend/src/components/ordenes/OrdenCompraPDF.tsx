import { useEffect, useState } from 'react';
import type { OrdenCompraResponse } from '@/types/ordenCompra.types';
import { API } from '@/services/api';
import logoImage from '@/assets/logo.png';

// ─── Types ─────────────────────────────────────────────────────────────────

interface HistorialWorkflowItem {
  idEvento: number;
  idPaso: number;
  nombrePaso?: string | null;
  idAccion: number;
  nombreAccion?: string | null;
  idUsuario: number;
  nombreUsuario?: string | null;
  comentario?: string | null;
  fechaEvento: string;
}

interface ProveedorInfo {
  idProveedor: number;
  razonSocial: string;
  rfc?: string;
}

interface Props {
  orden: OrdenCompraResponse;
  historial?: HistorialWorkflowItem[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

function fmtDateTime(dateStr: string) {
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

function fmtMoney(n: number) {
  return n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}

// ─── Component ────────────────────────────────────────────────────────────────

export function OrdenCompraPDF({ orden, historial = [] }: Props) {
  const [proveedores, setProveedores] = useState<Map<number, ProveedorInfo>>(new Map());
  
  // Fetch proveedores para las partidas y el encabezado
  useEffect(() => {
    const fetchProveedores = async () => {
      console.log('Fetching proveedores for orden:', orden.idOrden);
      const ids = new Set<number>();

      // Agregar proveedor del encabezado
      if (orden.idProveedor) {
        ids.add(Number(orden.idProveedor));
        console.log('Added header provider:', orden.idProveedor);
      }

      // Agregar proveedores de las partidas
      orden.partidas?.forEach(p => {
        if (p.idProveedor) {
          ids.add(Number(p.idProveedor));
          console.log('Added partida provider:', p.idProveedor);
        }
      });

      if (ids.size === 0) {
        console.log('No provider IDs to fetch');
        return;
      }

      console.log('Fetching IDs:', Array.from(ids));
      const proveedoresMap = new Map<number, ProveedorInfo>();

      // Fetch cada proveedor
      for (const id of ids) {
        try {
          console.log(`Fetching proveedor ${id}...`);
          const response = await API.get(`/api/catalogos/proveedores/${id}`);
          console.log(`Response for ${id}:`, response.data);
          if (response.data?.Data) {
            const p = response.data.Data;
            proveedoresMap.set(Number(id), {
              idProveedor: Number(p.IdProveedor),
              razonSocial: p.RazonSocial,
              rfc: p.RFC
            });
            console.log(`Stored proveedor ${id}:`, p.RazonSocial);
          } else {
            console.warn(`No data for proveedor ${id}`);
          }
        } catch (error) {
          console.error(`Error fetching proveedor ${id}:`, error);
        }
      }

      console.log('Final proveedores map:', proveedoresMap);
      setProveedores(proveedoresMap);
    };

    fetchProveedores();
  }, [orden.idOrden]);

  const now = new Date().toLocaleString('es-MX', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const estadoBg =
    orden.estado === 'Rechazada' || orden.estado === 'Cancelada'
      ? '#fee2e2'
      : orden.estado === 'Cerrada' || orden.estado === 'Pagada'
        ? '#dcfce7'
        : '#dbeafe';

  const estadoColor =
    orden.estado === 'Rechazada' || orden.estado === 'Cancelada'
      ? '#991b1b'
      : orden.estado === 'Cerrada' || orden.estado === 'Pagada'
        ? '#166534'
        : '#1e3a8a';

  // Filtrar solo eventos de autorización/aprobación (no rechazos ni movimientos internos)
  const firmas = historial.filter(h => {
    const accion = (h.nombreAccion || '').toLowerCase();
    return accion.includes('autoriz') || accion.includes('aproba') || accion.includes('firm');
  });

  return (
    <div id="orden-compra-pdf-print">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="pdf-header">
        <div className="pdf-header-left">
          <img 
            src={logoImage} 
            alt="Lefarma" 
            style={{ height: '40px', width: 'auto', objectFit: 'contain' }}
          />
          <div className="pdf-subtitle">Orden de Compra</div>
        </div>
        <div className="pdf-header-right">
          <div className="pdf-report-title">Orden de Compra</div>
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
                {orden.estado}
              </span>
            </div>
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
              <span className="pdf-label">Centro costo</span>
              <span className="pdf-value">
                {orden.centroCostoNombre || (orden.idCentroCosto ? `#${orden.idCentroCosto}` : '-')}
              </span>
            </div>
            <div className="pdf-field">
              <span className="pdf-label">Cuenta contable</span>
              <span className="pdf-value">
                {orden.cuentaContableNumero
                  ? `${orden.cuentaContableNumero}${orden.cuentaContableDescripcion ? ` — ${orden.cuentaContableDescripcion}` : ''}`
                  : '-'}
              </span>
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

      {/* ── Datos del Proveedor (solo si hay proveedor a nivel de orden) ── */}
      {orden.idProveedor && (
        <div className="pdf-section">
          <div className="pdf-section-title">Datos del Proveedor</div>
          <div className="pdf-orden-grid">
            <div className="pdf-field-group">
              {(() => {
                const prov = proveedores.get(Number(orden.idProveedor));
                return (
                  <>
                    <div className="pdf-field">
                      <span className="pdf-label">Razón Social</span>
                      <span className="pdf-value">{prov?.razonSocial || `-`}</span>
                    </div>
                    <div className="pdf-field">
                      <span className="pdf-label">RFC</span>
                      <span className="pdf-value">{prov?.rfc || `-`}</span>
                    </div>
                  </>
                );
              })()}
            </div>
            <div className="pdf-field-group">
              <div className="pdf-field">
                <span className="pdf-label">Datos fiscales</span>
                <span className="pdf-value">
                  {orden.sinDatosFiscales ? 'Sin datos fiscales' : 'Con datos fiscales'}
                </span>
              </div>
              {orden.idsCuentasBancarias && orden.idsCuentasBancarias.length > 0 && (
                <div className="pdf-field">
                  <span className="pdf-label">Cuentas bancarias</span>
                  <span className="pdf-value">
                    {orden.idsCuentasBancarias.join(', ')}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Partidas ──────────────────────────────────────────────────── */}
      {orden.partidas && orden.partidas.length > 0 && (
        <div className="pdf-section">
          <div className="pdf-section-title">Partidas ({orden.partidas.length})</div>
          <table className="pdf-table">
            <thead>
              <tr>
                <th style={{ width: '32px' }}>#</th>
                <th>Descripción</th>
                <th className="pdf-num" style={{ width: '56px' }}>Cant.</th>
                <th className="pdf-num" style={{ width: '100px' }}>P. Unitario</th>
                <th className="pdf-num" style={{ width: '56px' }}>IVA</th>
                <th className="pdf-num" style={{ width: '80px' }}>Descuento</th>
                <th className="pdf-num" style={{ width: '100px' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {orden.partidas.map((p) => (
                <tr key={p.idPartida}>
                  <td>{p.numeroPartida}</td>
                  <td>
                    <span className="pdf-value">{p.descripcion}</span>
                    {p.deducible && (
                      <span style={{ marginLeft: '6px', fontSize: '7pt', color: '#16a34a', fontWeight: 600 }}>DEDUCIBLE</span>
                    )}
                    {p.idProveedor && (
                      <div style={{ marginTop: '4px', fontSize: '7.5pt', color: '#6b7280' }}>
                        {(() => {
                          const prov = proveedores.get(Number(p.idProveedor));
                          return (
                            <>
                              <span style={{ fontWeight: 600 }}>Proveedor:</span> {prov?.razonSocial || `#${p.idProveedor}`}
                              {p.sinDatosFiscales !== undefined && (
                                <span style={{ marginLeft: '8px' }}>
                                  ({p.sinDatosFiscales ? 'Sin datos fiscales' : 'Con datos fiscales'})
                                </span>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </td>
                  <td className="pdf-num">{p.cantidad}</td>
                  <td className="pdf-num">{fmtMoney(p.precioUnitario)}</td>
                  <td className="pdf-num">{p.porcentajeIva}%</td>
                  <td className="pdf-num">{fmtMoney(p.descuento)}</td>
                  <td className="pdf-num pdf-total-amount">{fmtMoney(p.total)}</td>
                </tr>
              ))}
              <tr style={{ background: '#f3f4f6', fontWeight: 700 }}>
                <td colSpan={5} style={{ textAlign: 'right', paddingRight: '8pt' }}>
                  <span className="pdf-label">Subtotal</span>
                </td>
                <td className="pdf-num" style={{ fontWeight: 700 }}>{fmtMoney(orden.subtotal)}</td>
              </tr>
              <tr style={{ background: '#f3f4f6', fontWeight: 700 }}>
                <td colSpan={5} style={{ textAlign: 'right', paddingRight: '8pt' }}>
                  <span className="pdf-label">IVA</span>
                </td>
                <td className="pdf-num" style={{ fontWeight: 700 }}>{fmtMoney(orden.totalIva)}</td>
              </tr>
              <tr style={{ background: '#1d4ed8', color: '#fff', fontWeight: 700 }}>
                <td colSpan={5} style={{ textAlign: 'right', paddingRight: '8pt' }}>
                  <span style={{ fontWeight: 700, fontSize: '10pt' }}>TOTAL</span>
                </td>
                <td className="pdf-num" style={{ fontWeight: 700, fontSize: '11pt', color: '#fff' }}>
                  {fmtMoney(orden.total)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* ── Firmas y Autorizaciones ────────────────────────────────────── */}
      {firmas.length > 0 && (
        <div className="pdf-section">
          <div className="pdf-section-title">Firmas y Autorizaciones</div>
          <div className="pdf-firmas-grid">
            {firmas.map((firma) => (
              <div key={firma.idEvento} className="pdf-firma-box">
                <div className="pdf-firma-line"></div>
                <div className="pdf-firma-nombre">{firma.nombreUsuario || `Usuario ${firma.idUsuario}`}</div>
                <div className="pdf-firma-paso">{firma.nombreAccion || `Acción ${firma.idAccion}`}</div>
                {firma.nombrePaso && (
                  <div style={{ fontSize: '7pt', color: '#6b7280', marginTop: '2px' }}>
                    {firma.nombrePaso}
                  </div>
                )}
                <div className="pdf-firma-fecha">{fmtDateTime(firma.fechaEvento)}</div>
                {firma.comentario && (
                  <div className="pdf-firma-comentario">"{firma.comentario}"</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <div className="pdf-footer">
        <span>Sistema Lefarma · Orden de Compra · Generado automáticamente · Confidencial</span>
        <span>{orden.folio}</span>
      </div>
    </div>
  );
}
