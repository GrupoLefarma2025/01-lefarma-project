import { WfPage, WfAlert, WfPanel, WfField, WfTable } from '../../wireframes/wf';

export default function EquiposPareoPage() {
  return (
    <WfPage title="Equipos y pareo">
      <WfAlert text="Se valida capacidad: máximo 3 visitas por día y 8 por semana por persona." />
      <WfPanel title="Roles">
        <div className="grid gap-3 sm:grid-cols-3">
          <WfField label="Ejecutivo de Ventas" />
          <WfField label="Especialista de Producto" />
          <WfField label="Gerente de Ventas" />
        </div>
      </WfPanel>
      <WfPanel title="Pareo por ruta">
        <WfTable
          headers={['Ruta', 'Ejecutivo', 'Especialista', 'Zona']}
          rows={[
            ['[Ruta 1]', '[Ejecutivo]', '[Especialista]', '[Zona]'],
            ['[Ruta 2]', '[Ejecutivo]', '[Especialista]', '[Zona]'],
            ['[Ruta 3]', '[Ejecutivo]', '[Especialista]', '[Zona]'],
            ['[Ruta 4]', '[Ejecutivo]', '[Especialista]', '[Zona]'],
          ]}
        />
      </WfPanel>
    </WfPage>
  );
}