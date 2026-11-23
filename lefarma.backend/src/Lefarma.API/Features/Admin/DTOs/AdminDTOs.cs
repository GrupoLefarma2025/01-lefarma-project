namespace Lefarma.API.Features.Admin.DTOs
{
#region Usuario DTOs

    public class UsuarioResponse
    {
        public int IdUsuario { get; set; }
        public string? SamAccountName { get; set; }
        public string? Dominio { get; set; }
        public string? NombreCompleto { get; set; }
        public string? Correo { get; set; }
        public bool EsAnonimo { get; set; }
        public bool EsActivo { get; set; }
        public bool EsRobot { get; set; }
        public DateTime FechaCreacion { get; set; }
        public DateTime? UltimoLogin { get; set; }
        public string? PuestoEmpleado { get; set; }
        public string? AreaEmpleado { get; set; }
        public List<RolBasicoResponse> Roles { get; set; } = [];
        public List<PermisoBasicoResponse> PermisosDirectos { get; set; } = [];
        public UsuarioDetalleResponse? Detalle { get; set; }
    }

    public class CreateUsuarioRequest
    {
        public string SamAccountName { get; set; } = string.Empty;
        public string Dominio { get; set; } = string.Empty;
        public string NombreCompleto { get; set; } = string.Empty;
        public string? Correo { get; set; }

        public bool EsAnonimo { get; set; } = false;
        public bool EsActivo { get; set; } = true;
        public bool EsRobot { get; set; } = false;
        public List<int> RolesIds { get; set; } = [];
    }

    public class UsuarioBasicoResponse
    {
        public int IdUsuario { get; set; }
        public string? SamAccountName { get; set; }
        public string? NombreCompleto { get; set; }
        public string? Correo { get; set; }
        public bool EsActivo { get; set; }
    }

    public class UpdateUsuarioRequest
    {
        public string SamAccountName { get; set; } = string.Empty;
        public string NombreCompleto { get; set; } = string.Empty;
        public string? Correo { get; set; }

        public List<int> RolesIds { get; set; } = [];
        public List<int> PermisosIds { get; set; } = [];
        public UpdateUsuarioDetalleRequest? Detalle { get; set; }
    }

    public class UsuarioDetalleResponse
    {
        public int IdUsuario { get; set; }
        public int IdEmpresa { get; set; }
        public int IdSucursal { get; set; }
        public int? IdArea { get; set; }
        public int? IdCentroCosto { get; set; }

        public string? Puesto { get; set; }
        public string? NumeroEmpleado { get; set; }
        public string? FirmaDigital { get; set; }

        public string? TelefonoOficina { get; set; }
        public string? Extension { get; set; }
        public string? Celular { get; set; }
        public string? TelegramChat { get; set; }

        public bool NotificarEmail { get; set; }
        public bool NotificarApp { get; set; }
        public bool NotificarWhatsapp { get; set; }
        public bool NotificarSms { get; set; }
        public bool NotificarTelegram { get; set; }

        public bool NotificarSoloUrgentes { get; set; }
        public bool NotificarResumenDiario { get; set; }
        public bool NotificarRechazos { get; set; }
        public bool NotificarVencimientos { get; set; }

        public int? IdUsuarioDelegado { get; set; }
        public DateTime? DelegacionHasta { get; set; }

        public string? AvatarUrl { get; set; }
        public string? FirmaPath { get; set; }
        public string TemaInterfaz { get; set; } = "light";
        public string? DashboardInicio { get; set; }

        public bool Activo { get; set; }
    }

    public class UpdateUsuarioDetalleRequest
    {
        public int IdEmpresa { get; set; }
        public int IdSucursal { get; set; }
        public int? IdArea { get; set; }
        public int? IdCentroCosto { get; set; }

        public string? Puesto { get; set; }
        public string? NumeroEmpleado { get; set; }
        public string? FirmaDigital { get; set; }

        public string? TelefonoOficina { get; set; }
        public string? Extension { get; set; }
        public string? Celular { get; set; }
        public string? TelegramChat { get; set; }

        public bool NotificarEmail { get; set; } = true;
        public bool NotificarApp { get; set; } = true;
        public bool NotificarWhatsapp { get; set; } = false;
        public bool NotificarSms { get; set; } = false;
        public bool NotificarTelegram { get; set; } = false;

        public bool NotificarSoloUrgentes { get; set; } = false;
        public bool NotificarResumenDiario { get; set; } = true;
        public bool NotificarRechazos { get; set; } = true;
        public bool NotificarVencimientos { get; set; } = true;

        public int? IdUsuarioDelegado { get; set; }
        public DateTime? DelegacionHasta { get; set; }

        public string? AvatarUrl { get; set; }
        public string? FirmaPath { get; set; }
        public string TemaInterfaz { get; set; } = "light";
        public string? DashboardInicio { get; set; }

        public bool Activo { get; set; } = true;
    }

    #endregion

    #region Rol DTOs

    public class RolResponse
    {
        public int IdRol { get; set; }
        public string NombreRol { get; set; } = string.Empty;
        public string? Descripcion { get; set; }
        public bool EsActivo { get; set; }
        public bool EsSistema { get; set; }
        public DateTime FechaCreacion { get; set; }
        public int CantidadUsuarios { get; set; }
        public List<PermisoBasicoResponse> Permisos { get; set; } = [];
    }

    public class RolConUsuariosResponse
    {
        public int IdRol { get; set; }
        public string NombreRol { get; set; } = string.Empty;
        public string? Descripcion { get; set; }
        public bool EsActivo { get; set; }
        public bool EsSistema { get; set; }
        public DateTime FechaCreacion { get; set; }
        public int CantidadUsuarios { get; set; }
        public List<PermisoBasicoResponse> Permisos { get; set; } = [];
        public List<UsuarioBasicoResponse> Usuarios { get; set; } = [];
    }

    public class RolBasicoResponse
    {
        public int IdRol { get; set; }
        public string NombreRol { get; set; } = string.Empty;
        public string? Descripcion { get; set; }
        public bool EsActivo { get; set; }
    }

    public class CreateRolRequest
    {
        public string NombreRol { get; set; } = string.Empty;
        public string? Descripcion { get; set; }

        public bool EsActivo { get; set; } = true;
        public bool EsSistema { get; set; } = false;
        public List<int> PermisosIds { get; set; } = [];
    }

    public class UpdateRolRequest
    {
        public string NombreRol { get; set; } = string.Empty;
        public string? Descripcion { get; set; }

        public bool EsActivo { get; set; }
        public List<int> PermisosIds { get; set; } = [];
    }

    #endregion

    #region Permiso DTOs

    public class PermisoResponse
    {
        public int IdPermiso { get; set; }
        public string CodigoPermiso { get; set; } = string.Empty;
        public string NombrePermiso { get; set; } = string.Empty;
        public string? Descripcion { get; set; }
        public string? Categoria { get; set; }
        public string? Recurso { get; set; }
        public string? Accion { get; set; }
        public bool EsActivo { get; set; }
        public bool EsSistema { get; set; }
        public DateTime FechaCreacion { get; set; }
        public int CantidadRoles { get; set; }
        public int CantidadUsuarios { get; set; }
    }

    public class PermisoBasicoResponse
    {
        public int IdPermiso { get; set; }
        public string CodigoPermiso { get; set; } = string.Empty;
        public string NombrePermiso { get; set; } = string.Empty;
        public string? Categoria { get; set; }
        public string? Recurso { get; set; }
        public string? Accion { get; set; }
    }

    public class CreatePermisoRequest
    {
        public string CodigoPermiso { get; set; } = string.Empty;
        public string NombrePermiso { get; set; } = string.Empty;
        public string? Descripcion { get; set; }
        public string? Categoria { get; set; }
        public string? Recurso { get; set; }
        public string? Accion { get; set; }

        public bool EsActivo { get; set; } = true;
        public bool EsSistema { get; set; } = false;
    }

    public class UpdatePermisoRequest
    {
        public string CodigoPermiso { get; set; } = string.Empty;
        public string NombrePermiso { get; set; } = string.Empty;
        public string? Descripcion { get; set; }
        public string? Categoria { get; set; }
        public string? Recurso { get; set; }
        public string? Accion { get; set; }

        public bool EsActivo { get; set; }
    }

    #endregion

    #region Asignaciones DTOs

    public class AsignarRolesRequest
    {
        public List<int> RolesIds { get; set; } = [];
    }

    public class AsignarPermisosRequest
    {
        public List<int> PermisosIds { get; set; } = [];
    }

    public class AsignarUsuariosRequest
    {
        public List<int> UsuariosIds { get; set; } = [];
    }

    public class AsignarRolesAPermisoRequest
    {
        public List<int> RolesIds { get; set; } = [];
    }

    public class AsignarUsuariosAPermisoRequest
    {
        public List<int> UsuariosIds { get; set; } = [];
    }

    public class PermisoConRolesYUsuariosResponse : PermisoResponse
    {
        public List<RolBasicoResponse> Roles { get; set; } = [];
        public List<UsuarioBasicoResponse> Usuarios { get; set; } = [];
    }

    public class AsignarPermisosUsuarioRequest
    {
        public List<int> PermisosIds { get; set; } = [];

        public DateTime? FechaExpiracion { get; set; }
    }

    #endregion
}
