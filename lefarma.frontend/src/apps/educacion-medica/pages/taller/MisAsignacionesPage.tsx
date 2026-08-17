import { WfPage, WfAlert, WfKpi, WfTable } from '../../wireframes/wf';

export default function MisAsignacionesPage() {
  return (
    <WfPage title="Mis hospitales del mes">
      <WfAlert text="Reemplaza el correo del día 15." />
      <div className="grid gap-3 sm:grid-cols-3">
        <WfKpi label="Hospitales asignados" />
        <WfKpi label="Visitas hoy" />
        <WfKpi label="Visitas esta semana" />
      </div>
      <WfTable
        headers={['Hospital', 'Fecha', 'Hora', 'Estado de la visita']}
        rows={[
          ['[Hospital]', '[Fecha]', '[Hora]', '[Estado]'],
          ['[Hospital]', '[Fecha]', '[Hora]', '[Estado]'],
          ['[Hospital]', '[Fecha]', '[Hora]', '[Estado]'],
          ['[Hospital]', '[Fecha]', '[Hora]', '[Estado]'],
          ['[Hospital]', '[Fecha]', '[Hora]', '[Estado]'],
        ]}
      />
    </WfPage>
  );
}