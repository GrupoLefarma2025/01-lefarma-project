import { WfPage, WfAlert, WfKpi, WfPanel } from '../../wireframes/wf';

const CHART_CELLS = Array.from({ length: 12 }, (_, i) => `[día ${i + 1}]`);

export default function IndicadoresPage() {
  return (
    <WfPage title="Indicadores">
      <WfAlert text="Se presentan semanalmente a Gerencia General y Dirección Corporativa." />
      <div className="grid gap-3 sm:grid-cols-3">
        <WfKpi label="Talleres realizados vs programados" />
        <WfKpi label="Producto entregado" />
        <WfKpi label="Satisfacción" />
        <WfKpi label="Médicos que acudieron" />
        <WfKpi label="Médicos adscritos" />
        <WfKpi label="Médicos residentes" />
      </div>
      <WfPanel title="Gráfica semanal">
        <div className="grid grid-cols-4 gap-1 sm:grid-cols-6">
          {CHART_CELLS.map((c) => (
            <div
              key={c}
              className="flex h-10 items-center justify-center rounded border-2 border-dashed border-neutral-300 text-[10px] text-neutral-400"
            >
              {c}
            </div>
          ))}
        </div>
      </WfPanel>
    </WfPage>
  );
}