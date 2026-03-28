import { usePageTitle } from '@/hooks/usePageTitle';

export default function CrearOrdenCompra() {
  usePageTitle('Orden de compra', 'Captura de orden de compra');

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold">Orden de compra</h1>
      <p className="text-sm text-muted-foreground">
        Aquí irá el formulario para crear órdenes de compra.
      </p>
    </div>
  );
}

