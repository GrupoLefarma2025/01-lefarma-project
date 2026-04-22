export interface DashboardStatsResponse {
  cards: PipelineCardsStats;
  graficaMensual: GraficaMensualItem[];
  distribucionArea: DistribucionItem[];
  distribucionSucursal: DistribucionItem[];
  pagosUrgentes: PagoUrgenteItem[];
  actividadReciente: ActividadRecienteItem[];
}

export interface PipelineCardsStats {
  pendientesEnvio: number;
  enFirmas: number;
  enTesoreria: number;
  vencidas: number;
}

export interface GraficaMensualItem {
  mes: string;
  presupuesto: number;
  solicitado: number;
  pagado: number;
}

export interface DistribucionItem {
  name: string;
  value: number;
}

export interface PagoUrgenteItem {
  id: number;
  folio: string;
  proveedor: string;
  monto: number;
  fechaLimitePago: string;
  status: string;
}

export interface ActividadRecienteItem {
  id: number;
  usuario: string;
  accion: string;
  entidad: string;
  fechaEvento: string;
  tipo: string;
}
