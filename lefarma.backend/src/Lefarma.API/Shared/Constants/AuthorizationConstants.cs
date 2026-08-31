namespace Lefarma.API.Shared.Constants;

/// <summary>
/// Permission codes as typed constants for compile-time safety and IntelliSense.
/// The source of truth is app.Permisos in the database.
/// These constants are optional convenience: a permission that exists in app.Permisos
/// but has no constant here still works at runtime.
/// </summary>
public static class Permissions
{
    public static class Catalogos
    {
        public const string View = "catalogos.view";
        public const string Manage = "catalogos.manage";
    }

    public static class OrdenesCompra
    {
        public const string View = "ordenes.view";
        public const string Create = "ordenes.create";
        public const string Edit = "ordenes.edit";
        public const string Delete = "ordenes.delete";
        public const string Approve = "ordenes.approve";
    }

    public static class Usuarios
    {
        public const string View = "usuarios.view";
        public const string Manage = "usuarios.manage";
        public const string AssignRoles = "usuarios.assignroles";
    }

    public static class Reportes
    {
        public const string View = "reportes.view";
        public const string Export = "reportes.export";
    }

    public static class Tesoreria
    {
        public const string View = "tesoreria.view";
        public const string Pay = "tesoreria.pay";
        public const string Export = "tesoreria.export";
    }

    public static class Comprobaciones
    {
        public const string View = "comprobaciones.view";
        public const string Create = "comprobaciones.create";
        public const string Validate = "comprobaciones.validate";
    }

    public static class Config
    {
        public const string View = "config.view";
        public const string Manage = "config.manage";
    }

    public static class Workflows
    {
        public const string View = "workflows.view";
        public const string Manage = "workflows.manage";
    }

    public static class Proveedores
    {
        public const string Autorizar = "proveedores.autorizar";
        public const string Rechazar = "proveedores.rechazar";
        public const string CargaMasiva = "proveedores.cargaMasiva";
    }

    public static class IncidenciasChecado
    {
        public const string VerTodas = "incidencias_checado.ver_todas";
    }

    public static class Vacaciones
    {
        public const string Ver = "rh.vacaciones.ver";
        public const string Cargar = "rh.vacaciones.cargar";
        public const string Eliminar = "rh.vacaciones.eliminar";
        public const string SaldosVer = "rh.vacaciones.saldos.ver";
        public const string SaldosCargar = "rh.vacaciones.saldos.cargar";
        public const string SolicitudesCrear = "rh.vacaciones.solicitudes.crear";
    }
}
