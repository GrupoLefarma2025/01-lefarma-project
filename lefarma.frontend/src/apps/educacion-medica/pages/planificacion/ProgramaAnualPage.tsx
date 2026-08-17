import { WfPage, WfTabs, WfKpi, WfTable, WfBadge, WfAlert } from '../../wireframes/wf';

export default function ProgramaAnualPage() {
  return (
    <WfPage title="Programa Anual">
      <WfTabs tabs={['Programa', 'Autorización', 'Revisión trimestral']} active="Programa" />
      <div className="grid gap-3 sm:grid-cols-3">
        <WfKpi label="Meta anual" value="[hospitales] × 1.5" />
      </div>
      <WfTable
        headers={['Hospital', 'Frecuencia', 'Talleres', 'Estatus']}
        rows={[
          ['[Hospital A]', '[Frecuencia]', '[N]', '[Estatus]'],
          ['[Hospital B]', '[Frecuencia]', '[N]', '[Estatus]'],
          ['[Hospital C]', '[Frecuencia]', '[N]', '[Estatus]'],
          ['[Hospital D]', '[Frecuencia]', '[N]', '[Estatus]'],
        ]}
      />
      <div className="flex flex-wrap gap-2">
        <WfBadge text="Firma electrónica: Gerencia General" />
        <WfBadge text="Dirección Corporativa" />
      </div>
      <WfAlert text="La revisión trimestral genera un recordatorio automático." />
    </WfPage>
  );
}