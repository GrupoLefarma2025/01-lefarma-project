namespace Lefarma.API.Shared.Constants;

/// <summary>
/// Defines the system roles based on Section 17 of the specification.
/// </summary>
public static class AuthorizationConstants
{
    /// <summary>
    /// System role names matching the database.
    /// </summary>
    public static class Roles
    {
        public const string Capturista = "Capturista";
        public const string GerenteArea = "GerenteArea";
        public const string CxP = "CxP";
        public const string GerenteAdmon = "GerenteAdmon";
        public const string DireccionCorp = "DireccionCorp";
        public const string Tesoreria = "Tesoreria";
        public const string AuxiliarPagos = "AuxiliarPagos";
        public const string Administrador = "Administrador";
    }

    /// <summary>
    /// Human-readable role descriptions.
    /// </summary>
    public static class RoleDescriptions
    {
        public const string Capturista = "Crea ordenes de compra";
        public const string GerenteArea = "Firma 2 - Autorizacion inicial";
        public const string CxP = "Firma 3 - Revision y asignacion contable";
        public const string GerenteAdmon = "Firma 4 - Revision financiera";
        public const string DireccionCorp = "Firma 5 - Autorizacion final";
        public const string Tesoreria = "Realiza pagos";
        public const string AuxiliarPagos = "Apoyo en conciliaciones";
        public const string Administrador = "Gestion de catalogos y usuarios";
    }
}

/// <summary>
/// Defines the authorization policy names.
/// </summary>
public static class AuthorizationPolicies
{
    public const string RequireAdministrator = "RequireAdministrator";
    public const string RequireManager = "RequireManager";
    public const string RequireFinance = "RequireFinance";
    public const string RequirePaymentProcessing = "RequirePaymentProcessing";

    public const string CanViewCatalogos = "CanViewCatalogos";
    public const string CanManageCatalogos = "CanManageCatalogos";
    public const string CanViewOrdenes = "CanViewOrdenes";
    public const string CanCreateOrdenes = "CanCreateOrdenes";
    public const string CanApproveOrdenes = "CanApproveOrdenes";
    public const string CanManageUsers = "CanManageUsers";
}

/// <summary>
/// Defines permission codes for fine-grained authorization.
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
}
