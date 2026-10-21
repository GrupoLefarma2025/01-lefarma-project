import { Bus, Car } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type ModoTransporteViaje = 'propio' | 'solicitado';

/**
 * Cómo se traslada la persona. Los dos modos se distinguen por color en toda
 * la aplicación: verde para el carro propio y azul para la solicitud de
 * transporte, para no confundirlos al revisar una tabla o un detalle.
 */
const ESTILO: Record<ModoTransporteViaje, { texto: string; clase: string; Icono: typeof Car }> = {
  propio: {
    texto: 'Carro propio',
    clase: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    Icono: Car,
  },
  solicitado: {
    texto: 'Solicitud de transporte',
    clase: 'border-indigo-200 bg-indigo-50 text-indigo-700',
    Icono: Bus,
  },
};

export function ModoTransporteBadge({
  modo,
  className,
}: {
  modo: ModoTransporteViaje;
  className?: string;
}) {
  const { texto, clase, Icono } = ESTILO[modo];
  return (
    <Badge variant="outline" className={cn('gap-1 font-medium', clase, className)}>
      <Icono className="h-3 w-3" aria-hidden />
      {texto}
    </Badge>
  );
}

export default ModoTransporteBadge;
