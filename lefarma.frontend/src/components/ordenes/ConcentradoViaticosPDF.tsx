import type { CSSProperties } from 'react';
import logoAsokam from '@/assets/logo_7.png';
import type { MacroViatico } from '@/types/macroViatico.types';
import {
  fmtFechaLarga,
  fmtMoney,
  fmtMoneyCelda,
  sumarCostos,
  texto,
  totalViatico,
} from '@/utils/concentradoViaticos.helpers';

const NAVY = '#1f3864';
const HEADER_FILL = '#dbe5f1';

const border: CSSProperties = {
  border: '1px solid #777',
  padding: '4px',
  verticalAlign: 'top',
  overflowWrap: 'anywhere',
};

const thStyle: CSSProperties = {
  ...border,
  background: HEADER_FILL,
  color: NAVY,
  fontWeight: 700,
  textAlign: 'center',
};

const labelStyle: CSSProperties = {
  padding: '4px 2px',
  color: '#222222',
  fontWeight: 700,
  whiteSpace: 'nowrap',
  verticalAlign: 'bottom',
};

const headerValueStyle: CSSProperties = {
  padding: '4px 2px',
  borderBottom: '1px solid #777',
  verticalAlign: 'bottom',
  overflowWrap: 'anywhere',
};

const moneyStyle: CSSProperties = {
  ...border,
  textAlign: 'right',
  whiteSpace: 'nowrap',
};

const actionStyle: CSSProperties = {
  ...border,
  background: NAVY,
  color: '#ffffff',
  fontWeight: 700,
  textAlign: 'center',
  verticalAlign: 'middle',
};

const tableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  tableLayout: 'fixed',
  margin: '10px 0',
};

export interface ConcentradoViaticosPDFProps {
  filas: MacroViatico[];
  nombre: string;
  gerencia: string;
  fecha: string;
  firmas?: {
    diego?: string | null;
    luis?: string | null;
    erick?: string | null;
  };
}

export function ConcentradoViaticosPDF({
  filas,
  nombre,
  gerencia,
  fecha,
  firmas,
}: ConcentradoViaticosPDFProps) {
  const totales = sumarCostos(filas);

  return (
    <article
      aria-label="Concentrado de viáticos"
      style={{
        background: '#ffffff',
        color: '#000000',
        padding: 16,
        width: 1080,
        minWidth: 1080,
        maxWidth: 'none',
        flexShrink: 0,
        boxSizing: 'border-box',
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: 11,
      }}
    >
      <header style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <img
          src={logoAsokam}
          alt="ASOKAM"
          style={{ width: 84, height: 31, objectFit: 'contain' }}
        />
        <h1
          style={{
            flex: 1,
            textAlign: 'right',
            fontSize: 12,
            color: '#5b9bd5',
            margin: 0,
          }}
        >
          Concentrado de Viáticos
        </h1>
      </header>

      <table
        style={{ ...tableStyle, margin: '10px 0 0' }}
        aria-label="Encabezado del concentrado"
      >
        <colgroup>
          <col style={{ width: '6.2%' }} />
          <col style={{ width: '22%' }} />
          <col style={{ width: '8.8%' }} />
          <col style={{ width: '28%' }} />
          <col style={{ width: '6.2%' }} />
          <col style={{ width: '28.8%' }} />
        </colgroup>
        <tbody>
          <tr>
            <td style={labelStyle}>Nombre:</td>
            <td style={headerValueStyle}>{texto(nombre)}</td>
            <td style={labelStyle}>Gerencia:</td>
            <td style={headerValueStyle}>{texto(gerencia)}</td>
            <td style={labelStyle}>Fecha:</td>
            <td style={headerValueStyle}>{texto(fecha)}</td>
          </tr>
        </tbody>
      </table>

      <table style={tableStyle} aria-label="Tabla del concentrado de viáticos">
        <colgroup>
          <col style={{ width: '3%' }} />
          <col style={{ width: '13%' }} />
          <col style={{ width: '10%' }} />
          <col style={{ width: '9%' }} />
          <col style={{ width: '14%' }} />
          <col style={{ width: '7%' }} />
          <col style={{ width: '7%' }} />
          <col style={{ width: '5.5%' }} />
          <col style={{ width: '5.5%' }} />
          <col style={{ width: '7%' }} />
          <col style={{ width: '6%' }} />
          <col style={{ width: '6%' }} />
          <col style={{ width: '7%' }} />
        </colgroup>
        <thead>
          <tr>
            {['No.', 'Solicitante', 'Fecha', 'Origen', 'Destino'].map((titulo) => (
              <th key={titulo} rowSpan={2} style={thStyle}>
                {titulo}
              </th>
            ))}
            <th colSpan={2} style={thStyle}>
              Transporte
            </th>
            <th colSpan={2} style={thStyle}>
              Automóvil propio
            </th>
            {['Hospedaje', 'Comida', 'Taxi', 'Total'].map((titulo) => (
              <th key={titulo} rowSpan={2} style={thStyle}>
                {titulo}
              </th>
            ))}
          </tr>
          <tr>
            {[
              'Costo boleto Autobús',
              'Costo boleto Avión',
              'Gasolina',
              'Casetas',
            ].map((titulo) => (
              <th key={titulo} style={thStyle}>
                {titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((fila) => (
            <tr key={fila.folio}>
              <td style={{ ...border, textAlign: 'center' }}>
                {fila.renglon ?? ''}
              </td>
              <td style={border}>{texto(fila.solicitante)}</td>
              <td style={border}>{fmtFechaLarga(fila.fechInicio)}</td>
              <td style={border}>{texto(fila.origen)}</td>
              <td style={border}>{texto(fila.destino)}</td>
              <td style={moneyStyle}>{fmtMoneyCelda(fila.costoAutobus)}</td>
              <td style={moneyStyle}>{fmtMoneyCelda(fila.costoAvion)}</td>
              <td style={moneyStyle}>{fmtMoneyCelda(fila.costoGasolina)}</td>
              <td style={moneyStyle}>{fmtMoneyCelda(fila.costoCasetas)}</td>
              <td style={moneyStyle}>{fmtMoneyCelda(fila.costoHospedaje)}</td>
              <td style={moneyStyle}>{fmtMoneyCelda(fila.costoComida)}</td>
              <td style={moneyStyle}>{fmtMoneyCelda(fila.costoTaxi)}</td>
              <td style={{ ...moneyStyle, fontWeight: 700 }}>
                {fmtMoney(totalViatico(fila))}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td
              colSpan={4}
              aria-hidden="true"
              style={{ border: 'none', background: 'transparent' }}
            />
            <td style={{ ...thStyle, textAlign: 'right', color: '#000000' }}>
              Total
            </td>
            <td style={{ ...moneyStyle, fontWeight: 700 }}>
              {fmtMoneyCelda(totales.costoAutobus)}
            </td>
            <td style={{ ...moneyStyle, fontWeight: 700 }}>
              {fmtMoneyCelda(totales.costoAvion)}
            </td>
            <td style={{ ...moneyStyle, fontWeight: 700 }}>
              {fmtMoneyCelda(totales.costoGasolina)}
            </td>
            <td style={{ ...moneyStyle, fontWeight: 700 }}>
              {fmtMoneyCelda(totales.costoCasetas)}
            </td>
            <td style={{ ...moneyStyle, fontWeight: 700 }}>
              {fmtMoneyCelda(totales.costoHospedaje)}
            </td>
            <td style={{ ...moneyStyle, fontWeight: 700 }}>
              {fmtMoneyCelda(totales.costoComida)}
            </td>
            <td style={{ ...moneyStyle, fontWeight: 700 }}>
              {fmtMoneyCelda(totales.costoTaxi)}
            </td>
            <td style={{ ...moneyStyle, fontWeight: 700 }}>
              {fmtMoney(totales.total)}
            </td>
          </tr>
        </tfoot>
      </table>

      <table
        style={{ ...tableStyle, width: '61%', margin: '0 0 10px' }}
        aria-label="Firmas del concentrado"
      >
        <colgroup>
          <col style={{ width: '13%' }} />
          <col style={{ width: '30%' }} />
          <col style={{ width: '32%' }} />
          <col style={{ width: '25%' }} />
        </colgroup>
        <thead>
          <tr>
            <th style={{ ...thStyle, background: '#ffffff', color: NAVY }} />
            <th style={{ ...thStyle, background: NAVY, color: '#ffffff' }}>PUESTO</th>
            <th style={{ ...thStyle, background: NAVY, color: '#ffffff' }}>NOMBRE</th>
            <th style={{ ...thStyle, background: NAVY, color: '#ffffff' }}>FIRMA</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={actionStyle}>REVISÓ</td>
            <td style={{ ...border, padding: '7px 4px', textAlign: 'center' }}>
              Coordinador Administrativo
            </td>
            <td style={{ ...border, padding: '7px 4px', textAlign: 'center' }}>
              Erick Israel Aguilera Diaz
            </td>
            <td style={{ ...border, padding: '7px 4px', textAlign: 'center' }}>
              {firmas?.erick ? (
                <img
                  src={firmas.erick}
                  alt="Firma de Erick Israel Aguilera Diaz"
                  style={{ maxWidth: '100%', maxHeight: 24, objectFit: 'contain' }}
                />
              ) : null}
            </td>
          </tr>
          <tr>
            <td style={actionStyle}>REVISÓ</td>
            <td style={{ ...border, padding: '7px 4px', textAlign: 'center' }}>
              Gerente General
            </td>
            <td style={{ ...border, padding: '7px 4px', textAlign: 'center' }}>
              Luis Pozo Urquizo
            </td>
            <td style={{ ...border, padding: '7px 4px', textAlign: 'center' }}>
              {firmas?.luis ? (
                <img
                  src={firmas.luis}
                  alt="Firma de Luis Pozo Urquizo"
                  style={{ maxWidth: '100%', maxHeight: 24, objectFit: 'contain' }}
                />
              ) : null}
            </td>
          </tr>
          <tr>
            <td style={actionStyle}>REVISÓ</td>
            <td style={{ ...border, padding: '7px 4px', textAlign: 'center' }}>
              Gerente de Administración y Finanzas
            </td>
            <td style={{ ...border, padding: '7px 4px', textAlign: 'center' }}>
              Diego Angel Villaseñor Garduño
            </td>
            <td style={{ ...border, padding: '7px 4px', textAlign: 'center' }}>
              {firmas?.diego ? (
                <img
                  src={firmas.diego}
                  alt="Firma de Diego Ángel Villaseñor Garduño"
                  style={{ maxWidth: '100%', maxHeight: 24, objectFit: 'contain' }}
                />
              ) : null}
            </td>
          </tr>
          <tr>
            <td style={actionStyle}>AUTORIZÓ</td>
            <td style={{ ...border, padding: '7px 4px', textAlign: 'center' }}>
              Dirección Corporativa
            </td>
            <td style={{ ...border, padding: '7px 4px', textAlign: 'center' }}>
              Lic. Héctor Vélez Rivera
            </td>
            <td style={{ ...border, padding: '7px 4px', textAlign: 'center' }}>
              #firmad
            </td>
          </tr>
        </tbody>
      </table>

      <footer
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          borderTop: '1px solid #777',
          paddingTop: 5,
          fontSize: 9,
          color: '#444444',
        }}
      >
        <span>ASK-ADM-FOR-008</span>
        <span>Versió:01</span>
        <span>Prohibida su reproducción no autorizada</span>
        <span>Página 1 de 1</span>
      </footer>
    </article>
  );
}
