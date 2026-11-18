/**
 * Fila de dbo.infoMacroViaticos tal como la expone
 * GET /api/viaticos/macro-concentrado.
 *
 * La tabla la llena un proceso externo y no tiene estado de workflow: cada
 * folio es una solicitud de viático ya capturada. `renglon` es el número que
 * se imprime en el concentrado.
 */
export interface MacroViatico {
  folio: string;
  nombre: string | null;
  gerencia: string | null;
  fecha: string | null;
  renglon: number | null;
  solicitante: string | null;
  fechInicio: string | null;
  fechaFin: string | null;
  origen: string | null;
  destino: string | null;
  costoAutobus: number | null;
  costoAvion: number | null;
  costoGasolina: number | null;
  costoCasetas: number | null;
  costoHospedaje: number | null;
  costoComida: number | null;
  costoTaxi: number | null;
  diasHospedaje: number | null;
  numeroComidas: number | null;
}
