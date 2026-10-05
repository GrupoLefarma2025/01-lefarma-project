import type { CSSProperties, ReactNode } from 'react';
import logo from '@/assets/logo_concentrado.png';
import type { CostosRutaRequest, CostosRutaResponse } from '../../types/costosRuta.types';
import { selectedCosts, selectedProposal } from './costosViaticosData';
import type { ViajeEjemplo } from './costosRutaEjemplos';
import './costosViaticosPrint.css';

const UNKNOWN = '—';
const money = (n: number | null) => n === null ? UNKNOWN : `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const border: CSSProperties = { border: '1px solid #777', padding: '4px', verticalAlign: 'top', overflowWrap: 'anywhere' };
const tableStyle: CSSProperties = { width: '100%', borderCollapse: 'collapse', margin: '10px 0', tableLayout: 'fixed' };
const reviewers = [
  ['REVISÓ', 'Coordinador Administrativo', 'Erick Israel Aguilera Diaz'],
  ['REVISÓ', 'Gerente General', 'Luis Pozo  Urquizo'],
  ['REVISÓ', 'Gerente de Administración y Finanzas', 'Diego Angel Villaseñor Garduño'],
  ['AUTORIZÓ', 'Dirección Corporativa', 'Lic. Héctor Vélez Rivera'],
];
const authors = [
  ['ELABORÓ', 'AUXILIAR ADMINISTRATIVO', 'Lesly Isamar Zendejas Araiza'],
  ['ELABORÓ', 'COORDINADOR DE EDUCACIÓN MÉDICA', 'DANIEL PADILLA'],
  ['AUTORIZÓ', 'AUXILIAR DE COMPRAS', 'Adriana Arredondo Ortiz'],
];

function Header({ title }: { title: string }) {
  return <header style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
    <img src={logo} alt="ASOKAM" style={{ width: 120, height: 40, objectFit: 'contain' }} />
    <h1 style={{ flex: 1, textAlign: 'center', fontSize: 18 }}>{title}</h1>
  </header>;
}
function Footer({ code }: { code: string }) {
  return <footer style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #777', paddingTop: 5 }}>
    <span>{code}</span><span>Versió:01</span><span>Prohibida su reproducción no autorizada</span>
  </footer>;
}
function Signatures({ rows }: { rows: string[][] }) {
  return <table style={tableStyle} aria-label="Firmas pendientes">
    <thead><tr>{['', 'PUESTO', 'NOMBRE', 'FIRMA', 'FECHA'].map((h, i) => <th style={border} key={i}>{h}</th>)}</tr></thead>
    <tbody>{rows.map(([action, role, name]) => <tr key={role}>
      <td style={border}>{action}</td><td style={border}>{role}</td><td style={border}>{name}</td>
      <td style={{ ...border, height: 35 }} /><td style={border} />
    </tr>)}</tbody>
  </table>;
}
function Grid({ headings, rows, label }: { headings: string[]; rows: ReactNode[][]; label: string }) {
  return <table style={tableStyle} aria-label={label}>
    <thead><tr>{headings.map((h, i) => <th style={border} key={i}>{h}</th>)}</tr></thead>
    <tbody>{(rows.length ? rows : [headings.map(() => UNKNOWN)]).map((row, i) => <tr key={i}>
      {row.map((cell, j) => <td style={border} key={j}>{cell}</td>)}
    </tr>)}</tbody>
  </table>;
}

function RequestRange({ request, name }: { request: CostosRutaRequest | null; name: string }) {
  const places = request?.personas.find(p => p.nombre === name)?.lugares.slice(1) ?? [];
  const dates = places.flatMap(p => [p.fecha_inicio_actividad, p.fecha_fin_actividad].filter((d): d is string => !!d));
  return <>{dates.length ? `${dates[0]} al ${dates[dates.length - 1]}` : UNKNOWN}</>;
}

interface Props {
  respuesta: CostosRutaResponse | null;
  solicitud: CostosRutaRequest | null;
  nombreSolicitante?: string | null;
  seleccion?: Record<string, string>;
  ejemplo?: ViajeEjemplo | null;
  aviso?: string;
}

function SourceReference({ example }: { example?: ViajeEjemplo | null }) {
  if (!example) return null;
  return <aside>
    <p>Referencia documental (no cotización vigente): {example.inicio} al {example.fin} · {example.ciudades.join(' → ')}.</p>
    <p>Salida de terminal FOR-007: {example.salidaFecha} {example.salidaHora} · {example.transporte}.
      {example.vueloHora ? ` Solicitud de vuelos: ${example.vueloHora}.` : ''}</p>
    <p>Total histórico FOR-008: {money(example.referenciaHistorica.total)}. No se suma al cálculo.</p>
    <p>Fuentes: {example.fuentes.join(' · ')}</p>
    {example.conflictos.map(c => <p key={c}>Discrepancia documental: {c}</p>)}
  </aside>;
}

export function CostosViaticosPrint({ respuesta, solicitud, nombreSolicitante, seleccion = {}, ejemplo, aviso }: Props) {
  if (!respuesta) return null;
  const names = solicitud?.personas.map(p => p.nombre) ?? [...new Set(respuesta.propuestas.map(p => p.persona))];
  const proposals = names.map(n => selectedProposal(respuesta, n, seleccion));
  const costs = proposals.map(p => p ? selectedCosts(respuesta, p) : null);
  const sum = (key: 'autobus' | 'avion' | 'gasolina' | 'casetas' | 'total') => {
    const known = costs.flatMap(c => c?.[key] !== null && c?.[key] !== undefined ? [c[key]!] : []);
    return known.length ? money(known.reduce((a, b) => a + b, 0)) : UNKNOWN;
  };
  return <article className="costos-report costos-report-concentrado" aria-label="Concentrado de viáticos FOR-008">
    <Header title="Concentrado de Viáticos" />
    {aviso && <p>{aviso}</p>}
    <table style={tableStyle}><tbody><tr>
      <td style={border}>Nombre: {nombreSolicitante || UNKNOWN}</td><td style={border}>Gerencia: EDUCACION MEDICA</td>
      <td style={border}>Fecha: {new Date().toLocaleDateString('es-MX')}</td>
    </tr></tbody></table>
    <table style={tableStyle} aria-label="Concentrado de gastos seleccionados">
      <thead><tr>
        {['No.', 'Solicitante', 'Fecha', 'Origen', 'Destino'].map(h => <th key={h} rowSpan={2} style={border}>{h}</th>)}
        <th colSpan={2} style={border}>Transporte</th><th colSpan={2} style={border}>Automóvil propio</th>
        {['Hospedaje','Comida','Taxi','Total'].map(h => <th key={h} rowSpan={2} style={border}>{h}</th>)}
      </tr><tr>{['Costo boleto Autobús','Costo boleto Avión','Gasolina','Casetas'].map(h => <th key={h} style={border}>{h}</th>)}</tr></thead>
      <tbody>{names.map((name, i) => {
        const p = proposals[i]; const c = costs[i];
        return <tr key={name}>
          <td style={border}>{i + 1}</td><td style={border}>{name}<br />{p?.cumpleTodos ? 'CUMPLE' : 'NO VIABLE'}<br />{p?.titulo ?? 'Sin propuesta'}</td>
          <td style={border}><RequestRange request={solicitud} name={name} /></td>
          <td style={border}>{p?.tramos[0]?.de ?? UNKNOWN}</td><td style={border}>{p?.tramos.map(t => t.a).join(' → ') || UNKNOWN}</td>
          {[c?.autobus, c?.avion, c?.gasolina, c?.casetas].map((n, j) => <td style={border} key={j}>{money(n ?? null)}</td>)}
          <td style={border}>{UNKNOWN}</td><td style={border}>{UNKNOWN}</td><td style={border}>{UNKNOWN}</td>
          <td style={border}>{money(c?.total ?? null)}</td>
        </tr>;
      })}<tr><td colSpan={5} style={border}>Total conocido</td>
        {(['autobus','avion','gasolina','casetas'] as const).map(key => <td key={key} style={border}>{sum(key)}</td>)}
        <td style={border}>{UNKNOWN}</td><td style={border}>{UNKNOWN}</td><td style={border}>{UNKNOWN}</td><td style={border}>{sum('total')}</td>
      </tr></tbody>
    </table>
    <p>Estimación de la propuesta seleccionada, no autorización. Total: costo reportado por la propuesta; no incluye precios desconocidos de hospedaje, comida o taxis adicionales. Guion: no desglosado/no disponible, nunca cero. La cotización de automóvil de referencia no se agrega a autobús/avión.</p>
    {proposals.map((p, i) => <p key={names[i]}>{names[i]}: {p?.incumplimientos.join(' · ') || (p ? 'Sin incumplimientos reportados.' : 'Sin propuesta.')}</p>)}
    <SourceReference example={ejemplo} />
    <Signatures rows={reviewers} /><Footer code="ASK-ADM-FOR-008" />
  </article>;
}

export function CostosSolicitudPrint({ respuesta, solicitud, seleccion = {}, persona, ejemplo, aviso }: Props & { persona: string }) {
  if (!respuesta || !solicitud) return null;
  const person = solicitud.personas.find(p => p.nombre === persona);
  if (!person) return null;
  const proposal = selectedProposal(respuesta, persona, seleccion);
  const legs = proposal?.tramos ?? [];
  const hotels = proposal?.hotelesPropuestos ?? [];
  const taxis = legs.filter(t => ['uber', 'taxi'].includes(t.modo));
  const split = (text: string | undefined) => text?.split(' ') ?? [];
  return <article className="costos-report costos-report-solicitud" aria-label="Solicitud individual FOR-007">
    <Header title="Solicitud de Viáticos" />
    {aviso && <p>{aviso}</p>}
    <p>Fecha: {new Date().toLocaleDateString('es-MX')}</p>
    <p>Nombre del solicitante: {person.nombre} · Puesto: {UNKNOWN} · Gerencia: Educación Médica</p>
    <p>{proposal?.cumpleTodos ? 'CUMPLE' : 'NO VIABLE'} · {proposal?.titulo ?? 'Sin propuesta'} · Estimación, no autorización.</p>
    <Grid label="Objetivo y fechas del viaje" headings={['No.','Fecha del viaje','Origen','Destino','Objetivo del viaje']}
      rows={person.lugares.slice(1).map((p, i) => [i + 1, `${p.fecha_inicio_actividad} ${p.hora_inicio_actividad}–${p.hora_fin_actividad}`,
        person.lugares[0]?.nombre ?? UNKNOWN, p.nombre, 'Presencia solicitada; objetivo específico pendiente.'])} />
    <p>¿Requiere compra de boleto para transporte? Si [{legs.some(t => ['bus','avion'].includes(t.modo)) ? 'X' : ' '}] · No [{legs.length && legs.every(t => t.modo === 'auto') ? 'X' : ' '}] · Auto propio [{person.carro_propio ? 'X' : ' '}]</p>
    <Grid label="Transporte de la propuesta" headings={['No.','Fecha de salida','Tipo de transporte','Origen','Horario de salida','Destino','Horario de llegada','Costo conocido']}
      rows={legs.map((t, i) => [i + 1, split(t.salida)[0] ?? UNKNOWN, t.modo, t.de, split(t.salida).slice(1).join(' ') || UNKNOWN,
        t.a, t.llegada || UNKNOWN, money(t.costo)])} />
    <p>Hospedaje · Si [{hotels.length ? 'X' : ' '}] · No [ ] · {hotels.length ? 'Propuesto, precio no disponible.' : 'No propuesto; necesidad no confirmada.'}</p>
    <Grid label="Hospedaje propuesto" headings={['No.','Entrada','Salida','Número de noches','Lugar']}
      rows={hotels.map((h, i) => [i + 1, h.checkIn, h.checkOut, h.noches, `${h.lugar} · ${h.ciudad}`])} />
    <h2>Desglose uso de Taxis</h2>
    <Grid label="Taxis conocidos" headings={['Fecha','No. de Taxis','Origen','Destino','Costo conocido']}
      rows={taxis.map((t, i) => [split(t.salida)[0] ?? UNKNOWN, i + 1, t.de, t.a, money(t.costo)])} />
    <p>Total de propuesta: {money(proposal?.costoTotalMxn ?? null)}. Guion: dato no disponible; hospedaje/comida/taxis adicionales no cotizados.</p>
    <p>{proposal?.incumplimientos.join(' · ')}</p><SourceReference example={ejemplo} />
    <Signatures rows={authors} /><Footer code="ASK-ADM-FOR-007" />
  </article>;
}
