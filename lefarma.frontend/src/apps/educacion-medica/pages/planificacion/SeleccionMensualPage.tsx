import { WfPage, WfTabs, WfAlert, WfTable, WfBadge } from '../../wireframes/wf';

export default function SeleccionMensualPage() {
  return (
    <WfPage title="Selección Mensual">
      <WfTabs tabs={['Selección', 'Autorización']} active="Selección" />
      <WfAlert text="Reglas: próximos 45 días, mínimo 4 hospitales por zona, al menos 64 talleres en IMSS y 64 en descentralizados." />
      <WfTable
        headers={['Región', 'Hospital', 'Ejecutivo', 'Producto', 'Observaciones']}
        rows={[
          ['[Región]', '[Hospital]', '[Ejecutivo]', '[Producto]', '[Observaciones]'],
          ['[Región]', '[Hospital]', '[Ejecutivo]', '[Producto]', '[Observaciones]'],
          ['[Región]', '[Hospital]', '[Ejecutivo]', '[Producto]', '[Observaciones]'],
          ['[Región]', '[Hospital]', '[Ejecutivo]', '[Producto]', '[Observaciones]'],
          ['[Región]', '[Hospital]', '[Ejecutivo]', '[Producto]', '[Observaciones]'],
        ]}
      />
      <WfBadge text="Doble firma: Gerencia General + cada Gerente de Ventas" />
    </WfPage>
  );
}