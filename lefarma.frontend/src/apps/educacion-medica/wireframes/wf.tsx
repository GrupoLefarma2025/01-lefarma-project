import type { ReactNode } from 'react';

/**
 * Primitivas compartidas de wireframes LO-FI para Educación Médica.
 *
 * TODO(wireframe): componentes solo visuales, sin datos reales ni interacción.
 * Se eliminarán cuando el módulo se implemente con componentes reales.
 */

export function WfPage({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-5xl space-y-4 p-6">
      <div className="space-y-1">
        <span className="inline-block rounded border border-dashed border-amber-500 px-2 py-0.5 text-[10px] uppercase tracking-wider text-amber-600">
          WIREFRAME LO-FI — PANTALLA NO FUNCIONAL
        </span>
        <h1 className="text-xl font-semibold text-neutral-800">{title}</h1>
        {subtitle ? <p className="text-sm text-neutral-500">{subtitle}</p> : null}
      </div>
      {children}
    </div>
  );
}

export function WfPanel({
  title,
  children,
  className = '',
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded border-2 border-dashed border-neutral-300 bg-white p-4 ${className}`}>
      <h2 className="mb-3 text-[10px] uppercase tracking-wider text-neutral-500">{title}</h2>
      {children}
    </section>
  );
}

export function WfTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr>
            {headers.map((h) => (
              <th
                key={h}
                className="border-b-2 border-dashed border-neutral-300 px-2 py-1.5 text-[10px] uppercase tracking-wider text-neutral-500"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} className="border-b border-dashed border-neutral-200 px-2 py-2">
                  <span className="inline-block min-w-[3rem] rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500">
                    {cell}
                  </span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function WfField({ label, value }: { label: string; value?: string }) {
  return (
    <div className="space-y-1">
      <span className="text-xs text-neutral-600">{label}</span>
      <div className="flex min-h-[2rem] items-center rounded border-2 border-dashed border-neutral-300 bg-neutral-100 px-2 text-xs text-neutral-500">
        {value ?? `[${label}]`}
      </div>
    </div>
  );
}

export function WfButton({ label, variant = 'primary' }: { label: string; variant?: 'primary' | 'ghost' }) {
  return variant === 'primary' ? (
    <span className="inline-block cursor-default rounded bg-neutral-800 px-3 py-1.5 text-xs text-white">
      {label}
    </span>
  ) : (
    <span className="inline-block cursor-default rounded border-2 border-dashed border-neutral-400 px-3 py-1.5 text-xs text-neutral-600">
      {label}
    </span>
  );
}

export function WfInput({ placeholder }: { placeholder?: string }) {
  return (
    <div className="flex min-h-[2rem] items-center rounded border-2 border-dashed border-neutral-400 bg-white px-2 text-xs text-neutral-400">
      {placeholder ?? '[Buscar…]'}
    </div>
  );
}

export function WfKpi({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded border-2 border-dashed border-neutral-300 bg-white p-3">
      <div className="text-lg font-semibold text-neutral-800">{value ?? '[—]'}</div>
      <div className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</div>
    </div>
  );
}

export function WfTabs({ tabs, active }: { tabs: string[]; active?: string }) {
  return (
    <div className="flex flex-wrap gap-1 border-b-2 border-dashed border-neutral-300 pb-2">
      {tabs.map((t) => (
        <span
          key={t}
          className={`cursor-default rounded-t px-3 py-1 text-xs ${
            t === active
              ? 'border border-b-0 border-neutral-400 bg-neutral-800 text-white'
              : 'border border-dashed border-neutral-300 bg-neutral-50 text-neutral-500'
          }`}
        >
          {t}
        </span>
      ))}
    </div>
  );
}

export function WfAlert({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 rounded border-2 border-dashed border-neutral-300 bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
      <span className="mt-0.5 text-neutral-400">ℹ</span>
      <span>{text}</span>
    </div>
  );
}

export function WfBadge({ text }: { text: string }) {
  return (
    <span className="inline-block rounded border border-dashed border-neutral-400 bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-600">
      {text}
    </span>
  );
}
