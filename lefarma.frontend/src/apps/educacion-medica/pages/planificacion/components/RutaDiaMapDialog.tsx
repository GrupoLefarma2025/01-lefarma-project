import { lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { HospitalUbicacion } from '@/apps/educacion-medica/types/educacionMedica.types';

const HospitalesMap = lazy(() =>
  import('@/apps/educacion-medica/components/HospitalesMap').then((m) => ({
    default: m.HospitalesMap,
  }))
);

interface RutaDiaMapDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titulo: string;
  subtitulo: string;
  hospitales: HospitalUbicacion[];
}

export function RutaDiaMapDialog({
  open,
  onOpenChange,
  titulo,
  subtitulo,
  hospitales,
}: RutaDiaMapDialogProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{titulo}</SheetTitle>
          <SheetDescription>{subtitulo}</SheetDescription>
        </SheetHeader>
        <div className="h-[70vh] px-3 pb-3">
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center rounded-md border bg-muted">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            }
          >
            <div className="h-full">
              <HospitalesMap
                hospitales={hospitales}
                focusCodigos={hospitales.map((h) => h.codigoContacto)}
              />
            </div>
          </Suspense>
        </div>
      </SheetContent>
    </Sheet>
  );
}
