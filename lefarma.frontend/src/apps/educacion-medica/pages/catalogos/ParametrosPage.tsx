import { WfPage, WfAlert, WfPanel, WfField, WfButton } from '../../wireframes/wf';

export default function ParametrosPage() {
  return (
    <WfPage title="Parámetros">
      <WfAlert text="Solo Gerencia General / administración." />
      <WfPanel title="Configuración">
        <div className="grid gap-3 sm:grid-cols-2">
          <WfField label="Sesiones por mes" value="≈ 128" />
          <WfField label="Split por institución" value="IMSS / ISSSTE / Otros" />
          <WfField label="Visitas por día" value="3" />
          <WfField label="Visitas por semana" value="8" />
        </div>
      </WfPanel>
      <WfButton label="Guardar" />
    </WfPage>
  );
}