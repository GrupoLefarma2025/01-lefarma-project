import { WfPage, WfAlert, WfKpi, WfPanel, WfTable } from '../../wireframes/wf';

export default function PanelMesPage() {
  return (
    <WfPage title="Panel del mes">
      <WfAlert text="Vista de seguimiento mensual." />
      <div className="grid gap-3 sm:grid-cols-4">
        <WfKpi label="Seleccionados" />
        <WfKpi label="En calendario" />
        <WfKpi label="Realizados" />
        <WfKpi label="Costos acumulados" />
      </div>
      <WfPanel title="Estado de autorizaciones">
        <WfTable
          headers={['Taller', 'Autorización', 'Estado']}
          rows={[
            ['[Taller]', '[Autorización]', '[Estado]'],
            ['[Taller]', '[Autorización]', '[Estado]'],
            ['[Taller]', '[Autorización]', '[Estado]'],
            ['[Taller]', '[Autorización]', '[Estado]'],
          ]}
        />
      </WfPanel>
    </WfPage>
  );
}