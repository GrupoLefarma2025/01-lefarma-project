import type { CostosRutaPropuesta, CostosRutaResponse } from '../../types/costosRuta.types';

export function selectedProposal(response: CostosRutaResponse, name: string, selection: Record<string, string> = {}): CostosRutaPropuesta | undefined {
  const proposals = response.propuestas.filter(p => p.persona === name);
  return proposals.find(p => p.clave === selection[name]) ?? proposals.find(p => p.cumpleTodos) ?? proposals[0];
}

// A car quote is a reference, not an extra cost of a bus/air proposal.
export function selectedCosts(response: CostosRutaResponse, proposal: CostosRutaPropuesta) {
  const result = response.resultados.find(r => r.nombre === proposal.persona);
  const modeCost = (mode: string) => {
    const legs = proposal.tramos.filter(t => t.modo === mode);
    return legs.length ? legs.reduce((sum, t) => sum + t.costo, 0) : null;
  };
  const carLegs = proposal.tramos.filter(t => t.modo === 'auto');
  let gasoline: number | null = null;
  let tolls: number | null = null;
  if (carLegs.length && result) {
    const references = carLegs.map(t => result.rutaArmada.tramos[t.tramo - 1]);
    const matches = references.every((r, i) => r && r.de === carLegs[i].de && r.a === carLegs[i].a);
    if (matches) {
      const fuel = result.gasolina === 'premium' ? 'premium' : 'magna';
      const fuelCost = references.reduce((sum, r) => sum + r.gasolina[fuel].costo, 0);
      const tollCost = references.reduce((sum, r) => sum + r.casetas.costo, 0);
      const selected = carLegs.reduce((sum, t) => sum + t.costo, 0);
      // Shared/discounted proposals without a matching breakdown must not inherit a whole-car quote.
      if (Math.abs(selected - fuelCost - tollCost) < 0.02) { gasoline = fuelCost; tolls = tollCost; }
    }
  }
  return {
    autobus: modeCost('bus'),
    avion: modeCost('avion'),
    gasolina: gasoline,
    casetas: tolls,
    // Hospedaje, comida y taxi ya vienen calculados por el motor dentro de la
    // propuesta; se exponen tal cual para que el importador los persista.
    hospedaje: proposal.hospedaje,
    comida: proposal.comida,
    taxi: proposal.taxi,
    total: proposal.costoTotalMxn,
  };
}
