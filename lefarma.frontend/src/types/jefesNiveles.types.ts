export interface EmpleadoJefeConfigItem {
  nivel: number;
  aplica: boolean;
  idUsuarioJefeOverride?: number | null;
}

export interface EmpleadoJefeNivelCompleto {
  nivel: number;
  aplica: boolean;
  idUsuarioJefeOverride?: number | null;
  nombreJefeOverride?: string | null;
  nominaJefeVista?: number | null;
  idUsuarioJefeVista?: number | null;
  nombreJefeVista?: string | null;
}

export interface JefeCadenaNivel {
  nivel: number;
  nominaJefe?: number | null;
  idUsuarioJefe?: number | null;
  nombreJefe?: string | null;
}

export interface EmpleadoJefesConfigListItem {
  idUsuario: number;
  numeroEmpleado?: string | null;
  nombreCompleto?: string | null;
  puesto?: string | null;
  niveles: EmpleadoJefeNivelCompleto[];
  cadena?: JefeCadenaNivel[];
}

export interface EmpleadoJefesConfigResponse {
  idUsuario: number;
  esConfigPorDefecto: boolean;
  niveles: EmpleadoJefeNivelCompleto[];
}

export interface UpdateEmpleadoJefesConfigRequest {
  niveles: EmpleadoJefeConfigItem[];
}

export interface EmpleadoJefesCadenaResponse {
  idUsuario: number;
  cadena: JefeCadenaNivel[];
}
