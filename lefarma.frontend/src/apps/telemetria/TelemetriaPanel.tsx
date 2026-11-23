import { useMemo, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BotonesTab } from './components/BotonesTab';
import { ErroresNavegadorTab } from './components/ErroresNavegadorTab';
import { ErroresServidorTab } from './components/ErroresServidorTab';
import { MapaCalorTab } from './components/MapaCalorTab';
import { ResumenTab } from './components/ResumenTab';
import { OPCIONES_RANGO, fechaCorta, rangoDeDias } from './utils';

export function TelemetriaPanel() {
  const [dias, setDias] = useState(7);
  const rango = useMemo(() => rangoDeDias(dias), [dias]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Del {fechaCorta(rango.desde)} al {fechaCorta(rango.hasta)} · solo lectura
        </p>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Periodo</span>
          <Select value={String(dias)} onValueChange={(valor) => setDias(Number(valor))}>
            <SelectTrigger className="w-[130px]" aria-label="Periodo de la telemetría">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OPCIONES_RANGO.map((opcion) => (
                <SelectItem key={opcion.valor} value={String(opcion.valor)}>
                  {opcion.etiqueta}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="resumen" className="space-y-4">
        <TabsList>
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="errores">Errores</TabsTrigger>
          <TabsTrigger value="botones">Botones</TabsTrigger>
          <TabsTrigger value="mapa-calor">Mapa de calor</TabsTrigger>
          <TabsTrigger value="servidor">Errores del servidor</TabsTrigger>
        </TabsList>

        <TabsContent value="resumen">
          <ResumenTab desde={rango.desde} hasta={rango.hasta} />
        </TabsContent>
        <TabsContent value="errores">
          <ErroresNavegadorTab desde={rango.desde} hasta={rango.hasta} />
        </TabsContent>
        <TabsContent value="botones">
          <BotonesTab desde={rango.desde} hasta={rango.hasta} />
        </TabsContent>
        <TabsContent value="mapa-calor">
          <MapaCalorTab desde={rango.desde} hasta={rango.hasta} />
        </TabsContent>
        <TabsContent value="servidor">
          <ErroresServidorTab desde={rango.desde} hasta={rango.hasta} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
