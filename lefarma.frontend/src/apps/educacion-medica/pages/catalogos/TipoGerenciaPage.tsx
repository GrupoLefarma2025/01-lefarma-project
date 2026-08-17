import { WfPage, WfAlert, WfButton, WfTable } from '../../wireframes/wf';

export default function TipoGerenciaPage() {
  return (
    <WfPage title="Tipo de Gerencia">
      <WfAlert text="Catálogo propio del módulo." />
      <WfButton label="+ Nueva gerencia" />
      <WfTable
        headers={['Descripción', 'Activo']}
        rows={[
          ['IMSS', '[Sí]'],
          ['Descentralizado', '[Sí]'],
          ['Privado', '[Sí]'],
        ]}
      />
    </WfPage>
  );
}