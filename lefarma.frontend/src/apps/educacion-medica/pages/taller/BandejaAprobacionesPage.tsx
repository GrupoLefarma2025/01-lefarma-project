import { WfPage, WfAlert, WfTable, WfButton } from '../../wireframes/wf';

export default function BandejaAprobacionesPage() {
  return (
    <WfPage title="Bandeja de Autorizaciones">
      <WfAlert text="Quien firma no puede editar (separación de funciones)." />
      <WfTable
        headers={['Documento', 'Solicitante', 'Pendiente con', 'Estado', 'Acción']}
        rows={[
          ['[Documento]', '[Solicitante]', '[Pendiente con]', '[Estado]', '[Acción]'],
          ['[Documento]', '[Solicitante]', '[Pendiente con]', '[Estado]', '[Acción]'],
          ['[Documento]', '[Solicitante]', '[Pendiente con]', '[Estado]', '[Acción]'],
          ['[Documento]', '[Solicitante]', '[Pendiente con]', '[Estado]', '[Acción]'],
          ['[Documento]', '[Solicitante]', '[Pendiente con]', '[Estado]', '[Acción]'],
        ]}
      />
      <WfButton label="Firmar" />
    </WfPage>
  );
}