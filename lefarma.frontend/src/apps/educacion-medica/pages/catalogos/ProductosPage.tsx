import { WfPage, WfAlert, WfInput, WfTable } from '../../wireframes/wf';

export default function ProductosPage() {
  return (
    <WfPage title="Productos">
      <WfAlert text="Solo lectura (catálogo del sistema legado)." />
      <div className="w-64">
        <WfInput placeholder="Buscar" />
      </div>
      <WfTable
        headers={['Clave', 'Nombre', 'Línea']}
        rows={[
          ['[Clave 1]', '[Producto A]', '[Línea]'],
          ['[Clave 2]', '[Producto B]', '[Línea]'],
          ['[Clave 3]', '[Producto C]', '[Línea]'],
          ['[Clave 4]', '[Producto D]', '[Línea]'],
        ]}
      />
    </WfPage>
  );
}