export interface DashboardStatsResponse {
  cards: PipelineCardsStats;
  graficaMensual: GraficaMensualItem[];
  distribucionEmpresa: DistribucionItem[];
  distribucionSucursal: DistribucionItem[];
  pagosUrgentes: PagoUrgenteItem[];
  actividadReciente: ActividadRecienteItem[];
}

export interface PipelineCardsStats {
  pendientesEnvio: number;
  enFirmas: number;
  revisionDirector: number;
  cerradas: number;
  canceladas: number;
  rechazadas: number;
  vencidas: number;
  totalCreadasMes: number;
  totalGastado: number;
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
