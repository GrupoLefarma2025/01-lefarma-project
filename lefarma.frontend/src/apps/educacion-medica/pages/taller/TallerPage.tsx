import { WfPage, WfBadge, WfTabs, WfPanel, WfField, WfAlert, WfTable } from '../../wireframes/wf';

export default function TallerPage() {
  return (
    <WfPage title="Taller">
      <WfBadge text="Borrador → Elaborado → Revisado → Autorizado → Programado → En curso → Realizado/Cancelado" />
      <WfTabs
        tabs={['Datos y visita', 'Recursos y costos', 'Material', 'Asistencia', 'Aprobaciones', 'Evidencias']}
        active="Datos y visita"
      />
      <WfPanel title="Datos y visita">
        <div className="grid gap-3 sm:grid-cols-2">
          <WfField label="Hospital" />
          <WfField label="Fecha" />
          <WfField label="Hora" />
          <WfField label="Equipo de proyección" />
          <WfField label="Producto" />
          <WfField label="Cantidad" />
        </div>
      </WfPanel>
      <WfPanel title="Recursos y costos">
        <div className="grid gap-3 sm:grid-cols-2">
          <WfField label="Muestras" />
          <WfField label="Folletos" />
          <WfField label="Envío" />
          <WfField label="Box lunch" />
        </div>
        <div className="mt-3">
          <WfAlert text="Total calculado automáticamente." />
        </div>
      </WfPanel>
      <WfPanel title="Asistencia">
        <WfAlert text="Lista de hasta 20 médicos con firma." />
        <WfTable
          headers={['Nombre', 'Puesto', 'Teléfono', 'Correo', 'Firma']}
          rows={[
            ['[Nombre]', '[Puesto]', '[Teléfono]', '[Correo]', '[ ]'],
            ['[Nombre]', '[Puesto]', '[Teléfono]', '[Correo]', '[ ]'],
            ['[Nombre]', '[Puesto]', '[Teléfono]', '[Correo]', '[ ]'],
          ]}
        />
      </WfPanel>
      <WfPanel title="Aprobaciones">
        <WfAlert text="Log de firmas: Elaboró / Revisó / Autorizó." />
      </WfPanel>
      <WfPanel title="Evidencias">
        <WfAlert text="Fotos y documentos del taller." />
      </WfPanel>
    </WfPage>
  );
}