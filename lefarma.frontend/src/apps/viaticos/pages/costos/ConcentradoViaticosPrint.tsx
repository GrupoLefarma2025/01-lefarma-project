import type { CSSProperties } from 'react';
import logo from '@/assets/logo_concentrado.png';

/**
 * Concentrado de viaticos FOR-008 sobre DATOS PERSISTIDOS.
 *
 * A diferencia de `CostosViaticosPrint`, este componente NO lee nada del estado
 * en memoria del wizard: recibe las solicitudes ya resueltas por el contenedor
 * (la bandeja de `aprobacionesApi`), asi que recargar la pagina no pierde el
 * concentrado. Por eso es puramente presentacional y no hace fetch: quien lo
 * monta decide de donde salen los datos y en que orden.
 */

const UNKNOWN = '—';

/** Estados que el concentrado imprime; el resto no llega al formato. */
const ESTADOS_AUTORIZADOS = ['autorizada', 'autorizada_con_ajustes'] as const;

/**
 * Una fila del concentrado. Comparte la identidad de la fila de la bandeja
 * (`SolicitudBandeja`) y agrega el desglose por concepto que exige el FOR-008.
 * `null` en cualquier importe es celda vacia en el concentrado, nunca cero.
 */
export interface SolicitudConcentrado {
  id_solicitud: number;
  nombre_solicitante: string;
  /** `autorizada` o `autorizada_con_ajustes` para que la fila se imprima. */
  estado: string;
  /** Rango del viaje tal como lo guarda la solicitud: "05/10/2026 AL 09/10/2026". */
  fecha: string;
  origen: string | null;
  destino: string | null;
  autobus: number | null;
  avion: number | null;
  gasolina: number | null;
  casetas: number | null;
  hospedaje: number | null;
  comida: number | null;
  taxi: number | null;
  total: number | null;
}

/** Columnas numericas del FOR-008, en el orden en que se imprimen. */
export type ConceptoConcentrado =
  | 'autobus'
  | 'avion'
  | 'gasolina'
  | 'casetas'
  | 'hospedaje'
  | 'comida'
  | 'taxi'
  | 'total';

const money = (n: number | null) =>
  n === null
    ? UNKNOWN
    : `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const border: CSSProperties = {
  border: '1px solid #777',
  padding: '4px',
  verticalAlign: 'top',
  overflowWrap: 'anywhere',
};
const tableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  margin: '10px 0',
  tableLayout: 'fixed',
};

/** Firmas del renglon de autorizacion del FOR-008: tres REVISO y un AUTORIZO. */
const revisores: [string, string, string][] = [
  ['REVISÓ', 'Coordinador Administrativo', 'Erick Israel Aguilera Diaz'],
  ['REVISÓ', 'Gerente General', 'Luis Pozo  Urquizo'],
  ['REVISÓ', 'Gerente de Administración y Finanzas', 'Diego Angel Villaseñor Garduño'],
  ['AUTORIZÓ', 'Dirección Corporativa', 'Lic. Héctor Vélez Rivera'],
];

/** Fecha de emission en ISO corto (yyyy-MM-dd), en hora local. */
function hoyIso(): string {
  const d = new Date();
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

/**
 * Solo las filas autorizadas y solo si el backend trajo importes de al menos
 * una columna: una columna sin ningun dato conocido no se inventa en cero.
 */
function sumaColumna(filas: SolicitudConcentrado[], concepto: ConceptoConcentrado): number | null {
  const conocidos = filas
    .map(f => f[concepto])
    .filter((v): v is number => v !== null && v !== undefined);
  return conocidos.length ? conocidos.reduce((a, b) => a + b, 0) : null;
}

function Firmas({ filas }: { filas: [string, string, string][] }) {
  return (
    <table
      className="concentrado-firmas"
      style={tableStyle}
      aria-label="Firmas pendientes"
    >
      <thead>
        <tr>
          {['', 'PUESTO', 'NOMBRE', 'FIRMA', 'FECHA'].map((h, i) => (
            <th style={border} key={i}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {filas.map(([accion, puesto, nombre]) => (
          <tr key={puesto}>
            <td style={border}>{accion}</td>
            <td style={border}>{puesto}</td>
            <td style={border}>{nombre}</td>
            <td style={{ ...border, height: 35 }} />
            <td style={border} />
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Reglas de impresion del concentrado. Se declaran aqui y no en la hoja de
 * estilos compartida porque son del portal FOR-008 y no deben afectar al
 * FOR-007 del wizard.
 */
const PRINT_CSS = `
@page concentrado-viaticos { size: A4 landscape; margin: 10mm; }
.concentrado-viaticos { page: concentrado-viaticos; font: 10px Arial, sans-serif; color: #000; background: #fff; }
.concentrado-viaticos table { break-inside: auto; }
.concentrado-viaticos thead { display: table-header-group; }
.concentrado-viaticos tfoot { display: table-row-group; }
.concentrado-viaticos tr, .concentrado-viaticos footer { break-inside: avoid; }
.concentrado-firmas { break-before: auto; }
@media print {
  body.concentrado-print-active > *:not(#concentrado-viaticos-print) { display: none !important; }
  body.concentrado-print-active #concentrado-viaticos-print { display: block !important; }
  .concentrado-viaticos { print-color-adjust: exact; }
}`;

interface Props {
  /** Solicitudes ya cargadas; el componente filtra las no autorizadas. */
  solicitudes: SolicitudConcentrado[];
  /** Nombre del responsable o gerencia responsable del concentrado. */
  nombreResponsable?: string | null;
  gerencia?: string;
  /** Fecha de emision; por defecto hoy en yyyy-MM-dd. */
  fecha?: string;
}

export function ConcentradoViaticosPrint({
  solicitudes,
  nombreResponsable,
  gerencia = 'EDUCACION MEDICA',
  fecha = hoyIso(),
}: Props) {
  const filas = solicitudes.filter(s =>
    (ESTADOS_AUTORIZADOS as readonly string[]).includes(s.estado),
  );
  const conceptos: ConceptoConcentrado[] = [
    'autobus',
    'avion',
    'gasolina',
    'casetas',
    'hospedaje',
    'comida',
    'taxi',
    'total',
  ];

  return (
    <article
      className="concentrado-viaticos"
      aria-label="Concentrado de viáticos FOR-008"
    >
      <style>{PRINT_CSS}</style>
      <header style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <img
          src={logo}
          alt="ASOKAM"
          style={{ width: 120, height: 40, objectFit: 'contain' }}
        />
        <h1 style={{ flex: 1, textAlign: 'center', fontSize: 18 }}>
          Concentrado de Viáticos
        </h1>
      </header>

      <table style={tableStyle} aria-label="Encabezado del concentrado">
        <tbody>
          <tr>
            <td style={border}>Nombre: {nombreResponsable || UNKNOWN}</td>
            <td style={border}>Gerencia: {gerencia}</td>
            <td style={border}>Fecha: {fecha}</td>
          </tr>
        </tbody>
      </table>

      <table style={tableStyle} aria-label="Concentrado de viáticos autorizados">
        <thead>
          <tr>
            {['No.', 'Solicitante', 'Fecha', 'Origen', 'Destino'].map(h => (
              <th key={h} rowSpan={2} style={border}>
                {h}
              </th>
            ))}
            <th colSpan={2} style={border}>
              Transporte
            </th>
            <th colSpan={2} style={border}>
              Automóvil propio
            </th>
            {['Hospedaje', 'Comida', 'Taxi', 'Total'].map(h => (
              <th key={h} rowSpan={2} style={border}>
                {h}
              </th>
            ))}
          </tr>
          <tr>
            {['Costo boleto Autobús', 'Costo boleto Avión', 'Gasolina', 'Casetas'].map(h => (
              <th key={h} style={border}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((s, i) => (
            <tr key={s.id_solicitud}>
              <td style={border}>{i + 1}</td>
              <td style={border}>{s.nombre_solicitante || UNKNOWN}</td>
              <td style={border}>{s.fecha || UNKNOWN}</td>
              <td style={border}>{s.origen ?? UNKNOWN}</td>
              <td style={border}>{s.destino ?? UNKNOWN}</td>
              {conceptos.map(c => (
                <td style={border} key={c}>
                  {money(s[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={5} style={border}>
              Total
            </td>
            {conceptos.map(c => (
              <td style={border} key={c}>
                {money(sumaColumna(filas, c))}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>

      <Firmas filas={revisores} />

      <footer
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          borderTop: '1px solid #777',
          paddingTop: 5,
        }}
      >
        <span>ASK-ADM-FOR-008</span>
        <span>Versió:01</span>
        <span>Prohibida su reproducción no autorizada</span>
      </footer>
    </article>
  );
}

