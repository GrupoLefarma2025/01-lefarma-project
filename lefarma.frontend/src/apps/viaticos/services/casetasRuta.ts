/**
 * Plazas de cobro de referencia por corredor. El motor de costos todavía no
 * expone el desglose de casetas: solo estima el costo por kilómetro. Los km
 * están escalados a la distancia que muestra el motor y las tarifas son
 * referencias de auto 2026; la ruta y las plazas pueden variar.
 */
export interface CasetaRuta {
  nombre: string;
  km: number;
  direccion: string;
  costo: number | null;
}

interface CasetasRuta {
  origen: string;
  destino: string;
  plazas: CasetaRuta[];
}

const CASETAS_RUTA: CasetasRuta[] = [
  {
    origen: 'Ciudad de México',
    destino: 'Ciudad Victoria',
    plazas: [
      { nombre: 'San Cristóbal–Indios Verdes', km: 26, direccion: 'México → Pachuca', costo: 43 },
      { nombre: 'La Revolución (Plaza 91)', km: 28, direccion: 'México → Pachuca', costo: 35 },
      { nombre: 'Pachuca (A-4 / A-2)', km: 28, direccion: 'México → Pachuca', costo: 14 },
      { nombre: 'Tulancingo', km: 75, direccion: 'México → Tulancingo', costo: 74 },
      { nombre: 'Tejocotal', km: 135, direccion: 'Tulancingo → Nuevo Necaxa', costo: 75 },
      { nombre: 'Nuevo Necaxa', km: 152, direccion: 'Tejocotal → Nuevo Necaxa', costo: 27 },
      { nombre: 'El Piñal', km: 212, direccion: 'Nuevo Necaxa → Tihuatlán', costo: 95 },
      { nombre: 'Tihuatlán', km: 242, direccion: 'Tihuatlán → Túxpam', costo: 6 },
      { nombre: 'Puente Tampico', km: 440, direccion: 'Tuxpan → Tampico', costo: 38 },
    ],
  },
];

function normalizar(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function casetasDeRuta(origen: string, destino: string): CasetaRuta[] {
  const o = normalizar(origen);
  const d = normalizar(destino);
  return (
    CASETAS_RUTA.find(
      (ruta) => o.includes(normalizar(ruta.origen)) && d.includes(normalizar(ruta.destino)),
    )?.plazas ?? []
  );
}
