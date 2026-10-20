/** Configuración compartida de viáticos (tarifas de comida y jornada). */
export interface ConfigViaticos {
  comidaMedia: string;
  comidaCompleta: string;
  horaEntrada: string;
  horaSalida: string;
}

export const CONFIG_VIATICOS_STORAGE_KEY = 'viaticos.config';

export const CONFIG_VIATICOS_DEFAULT: ConfigViaticos = {
  comidaMedia: '150',
  comidaCompleta: '300',
  horaEntrada: '07:00',
  horaSalida: '18:30',
};

export function leerConfigViaticos(): ConfigViaticos {
  try {
    const raw = localStorage.getItem(CONFIG_VIATICOS_STORAGE_KEY);
    if (!raw) return CONFIG_VIATICOS_DEFAULT;
    const guardada = JSON.parse(raw) as Partial<ConfigViaticos>;
    return { ...CONFIG_VIATICOS_DEFAULT, ...guardada };
  } catch {
    return CONFIG_VIATICOS_DEFAULT;
  }
}

export function guardarConfigViaticos(config: ConfigViaticos): void {
  try {
    localStorage.setItem(CONFIG_VIATICOS_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Si el navegador bloquea el almacenamiento, la configuración sigue en memoria.
  }
}
