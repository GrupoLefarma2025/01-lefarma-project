export interface EmpleadoJefeConfigItem {
  nivel: number;
  aplica: boolean;
}

export interface EmpleadoJefesConfigListItem {
  idUsuario: number;
  numeroEmpleado?: string | null;
  nombreCompleto?: string | null;
  puesto?: string | null;
  niveles: EmpleadoJefeConfigItem[];
}

export interface EmpleadoJefesConfigResponse {
  idUsuario: number;
  esConfigPorDefecto: boolean;
  niveles: EmpleadoJefeConfigItem[];
}

export interface UpdateEmpleadoJefesConfigRequest {
  niveles: EmpleadoJefeConfigItem[];
}

// ponytail: pre-existing fork bug — rh.api.ts imported these but they were never defined.
// Modeled from backend EmpleadoJefesConfigDtos.cs (JefeCadenaNivelDto / EmpleadoJefesCadenaResponse).
export interface JefeCadenaNivel {
  nivel: number;
  nominaJefe: number | null; // null = cadena rota en la vista
  idUsuarioJefe: number | null; // null = sin usuario en el sistema
  nombreJefe: string | null;
}

export interface EmpleadoJefesCadenaResponse {
  idUsuario: number;
  cadena: JefeCadenaNivel[];
}
