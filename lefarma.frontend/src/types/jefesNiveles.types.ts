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
