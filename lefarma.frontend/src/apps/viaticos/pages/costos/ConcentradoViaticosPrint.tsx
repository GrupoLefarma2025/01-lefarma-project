import type { CSSProperties } from 'react';
import { Fragment } from 'react';
import logoAsokam from '@/assets/logo_7.png';
import { GRUPO_LABELS, type GrupoConcentrado } from '../../constants/grupos';
import { gerenciaVisible, GERENCIA_SIN_ASIGNAR } from '../../constants/gerencias';

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
  /** Gerencia con la que se capturó (Descentralizado / IMSS / IMSS Bienestar). */
  gerencia?: string | null;
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

/**
 * Paleta del formato original (ejemplo.xlsx, ASK-ADM-FOR-008): encabezados de
 * la tabla en azul claro y el bloque de firmas en azul marino con letra blanca.
 */
const NAVY = '#1f3864';
const HEADER_FILL = '#dbe5f1';

const thStyle: CSSProperties = {
  ...border,
  background: HEADER_FILL,
  fontWeight: 700,
  textAlign: 'center',
};

const firmaHeadStyle: CSSProperties = {
  ...border,
  background: NAVY,
  color: '#fff',
  fontWeight: 700,
  textAlign: 'center',
};

const firmaAccionStyle: CSSProperties = {
  ...border,
  background: NAVY,
  color: '#fff',
  fontWeight: 700,
  textAlign: 'center',
};

/** Banda que separa los bloques del concentrado (una por gerencia o persona). */
const grupoStyle: CSSProperties = {
  ...border,
  background: '#e8eef7',
  color: NAVY,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: 0.4,
};

const subtotalLabelStyle: CSSProperties = {
  ...border,
  background: '#f3f6fb',
  fontWeight: 700,
  textAlign: 'right',
};

const subtotalCellStyle: CSSProperties = {
  ...border,
  background: '#f3f6fb',
  fontWeight: 700,
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
            <th style={firmaHeadStyle} key={i}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {filas.map(([accion, puesto, nombre]) => (
          <tr key={puesto}>
            <td style={firmaAccionStyle}>{accion}</td>
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
  /** Solicitudes ya cargadas; por defecto el componente filtra las no autorizadas. */
  solicitudes: SolicitudConcentrado[];
  /** Nombre del responsable o gerencia responsable del concentrado. */
  nombreResponsable?: string | null;
  gerencia?: string;
  /** Fecha de emision; por defecto hoy en yyyy-MM-dd. */
  fecha?: string;
  /**
   * Filtrar solo las autorizadas (documento oficial FOR-008). El concentrado de
   * revision lo apaga para imprimir exactamente lo que la persona tiene
   * filtrado en pantalla, aunque todavia no este autorizado.
   */
  soloAutorizadas?: boolean;
  /**
   * Parte la tabla en bloques con encabezado y subtotal. `ninguna` imprime el
   * formato clasico de una sola tabla (comportamiento historico).
   */
  grupoPor?: GrupoConcentrado;
}

export function ConcentradoViaticosPrint({
  solicitudes,
  nombreResponsable,
  gerencia = 'EDUCACION MEDICA',
  fecha = hoyIso(),
  soloAutorizadas = true,
  grupoPor = 'ninguna',
}: Props) {
  const filas = soloAutorizadas
    ? solicitudes.filter(s => (ESTADOS_AUTORIZADOS as readonly string[]).includes(s.estado))
    : solicitudes;
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

  // El orden de llegada manda: quien monta el componente ya ordeno por el
  // criterio elegido. Aqui solo se corta en bloques contiguos.
  const grupos: Array<{ grupo: string | null; filas: SolicitudConcentrado[] }> =
    grupoPor === 'ninguna'
      ? [{ grupo: null, filas }]
      : (() => {
          const mapa = new Map<string, SolicitudConcentrado[]>();
          for (const fila of filas) {
            const clave =
              grupoPor === 'gerencia'
                ? gerenciaVisible(fila.gerencia)
                : fila.nombre_solicitante || GERENCIA_SIN_ASIGNAR;
            const lista = mapa.get(clave) ?? [];
            lista.push(fila);
            mapa.set(clave, lista);
          }
          return [...mapa.entries()].map(([grupo, filasGrupo]) => ({ grupo, filas: filasGrupo }));
        })();

  const numeroPorSolicitud = new Map(filas.map((fila, indice) => [fila.id_solicitud, indice + 1]));
  const COLUMNAS_FIJAS = 5;

  return (
    <article
      className="concentrado-viaticos"
      aria-label="Concentrado de viáticos FOR-008"
    >
      <style>{PRINT_CSS}</style>
      <header style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <img
          src={logoAsokam}
          alt="ASOKAM"
          style={{ width: 150, height: 48, objectFit: 'contain' }}
        />
        <h1 style={{ flex: 1, textAlign: 'right', fontSize: 18, color: NAVY, margin: 0 }}>
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
              <th key={h} rowSpan={2} style={thStyle}>
                {h}
              </th>
            ))}
            <th colSpan={2} style={thStyle}>
              Transporte
            </th>
            <th colSpan={2} style={thStyle}>
              Automóvil propio
            </th>
            {['Hospedaje', 'Comida', 'Taxi', 'Total'].map(h => (
              <th key={h} rowSpan={2} style={thStyle}>
                {h}
              </th>
            ))}
          </tr>
          <tr>
            {['Costo boleto Autobús', 'Costo boleto Avión', 'Gasolina', 'Casetas'].map(h => (
              <th key={h} style={thStyle}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grupos.map(({ grupo, filas: filasGrupo }) => (
            <Fragment key={grupo ?? 'concentrado-unico'}>
              {grupo !== null ? (
                <tr className="concentrado-grupo">
                  <td colSpan={COLUMNAS_FIJAS + conceptos.length} style={grupoStyle}>
                    {GRUPO_LABELS[grupoPor]}: {grupo} · {filasGrupo.length}{' '}
                    {filasGrupo.length === 1 ? 'solicitud' : 'solicitudes'}
                  </td>
                </tr>
              ) : null}
              {filasGrupo.map((s) => (
                <tr key={s.id_solicitud}>
                  <td style={border}>{numeroPorSolicitud.get(s.id_solicitud) ?? 0}</td>
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
              {grupo !== null ? (
                <tr className="concentrado-subtotal-grupo">
                  <td colSpan={COLUMNAS_FIJAS} style={subtotalLabelStyle}>
                    Subtotal {grupo}
                  </td>
                  {conceptos.map(c => (
                    <td style={subtotalCellStyle} key={c}>
                      {money(sumaColumna(filasGrupo, c))}
                    </td>
                  ))}
                </tr>
              ) : null}
            </Fragment>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={5} style={{ ...thStyle, textAlign: 'left' }}>
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

