using Lefarma.API.Domain.Entities.Auth;
using Lefarma.API.Domain.Entities.Catalogos;
using Lefarma.API.Features.Admin.DTOs;
using Lefarma.API.Features.Catalogos.Areas.DTOs;
using Lefarma.API.Features.Catalogos.Bancos.DTOs;
using Lefarma.API.Features.Catalogos.Empresas.DTOs;
using Lefarma.API.Features.Catalogos.Gastos.DTOs;
using Lefarma.API.Features.Catalogos.Medidas.DTOs;
using Lefarma.API.Features.Catalogos.Sucursales.DTOs;
using Lefarma.API.Features.Catalogos.UnidadesMedida.DTOs;
using Lefarma.API.Features.Catalogos.MediosPago.DTOs;

namespace Lefarma.API.Shared.Extensions
{
/// <summary>
    /// Métodos de extensión para mapeo de entidades a DTOs de respuesta.
    /// </summary>
    public static class EntityMappings
    {
        #region Empresa Mappings

        public static EmpresaResponse ToResponse(this Empresa entity) => new()
        {
            IdEmpresa = entity.IdEmpresa,
            Nombre = entity.Nombre,
            Descripcion = entity.Descripcion ?? string.Empty,
            Clave = entity.Clave ?? string.Empty,
            RazonSocial = entity.RazonSocial ?? string.Empty,
            RFC = entity.RFC ?? string.Empty,
            Direccion = entity.Direccion ?? string.Empty,
            Colonia = entity.Colonia ?? string.Empty,
            Ciudad = entity.Ciudad ?? string.Empty,
            Estado = entity.Estado ?? string.Empty,
            CodigoPostal = entity.CodigoPostal ?? string.Empty,
            Telefono = entity.Telefono ?? string.Empty,
            Email = entity.Email ?? string.Empty,
            PaginaWeb = entity.PaginaWeb ?? string.Empty,
            NumeroEmpleados = entity.NumeroEmpleados ?? 0,
            Activo = entity.Activo,
            PuedeSeleccionarEmpresas = entity.PuedeSeleccionarEmpresas,
            FechaCreacion = entity.FechaCreacion,
            FechaModificacion = entity.FechaModificacion
        };

        #endregion

        #region Sucursal Mappings

        public static SucursalResponse ToResponse(this Sucursal entity) => new()
        {
            IdSucursal = entity.IdSucursal,
            IdEmpresa = entity.IdEmpresa,
            Nombre = entity.Nombre,
            Descripcion = entity.Descripcion ?? string.Empty,
            Clave = entity.Clave ?? string.Empty,
            ClaveContable = entity.ClaveContable ?? string.Empty,
            Direccion = entity.Direccion ?? string.Empty,
            CodigoPostal = entity.CodigoPostal ?? string.Empty,
            Ciudad = entity.Ciudad ?? string.Empty,
            Estado = entity.Estado ?? string.Empty,
            Telefono = entity.Telefono ?? string.Empty,
            Latitud = entity.Latitud,
            Longitud = entity.Longitud,
            NumeroEmpleados = entity.NumeroEmpleados,
            Activo = entity.Activo,
            FechaCreacion = entity.FechaCreacion,
            FechaModificacion = entity.FechaModificacion
        };

        #endregion

        #region Gasto Mappings

        public static GastoResponse ToResponse(this Gasto entity) => new()
        {
            IdGasto = entity.IdGasto,
            Nombre = entity.Nombre,
            Descripcion = entity.Descripcion ?? string.Empty,
            Clave = entity.Clave ?? string.Empty,
            Concepto = entity.Concepto ?? string.Empty,
            Cuenta = entity.Cuenta ?? string.Empty,
            SubCuenta = entity.SubCuenta ?? string.Empty,
            Analitica = entity.Analitica ?? string.Empty,
            Integracion = entity.Integracion ?? string.Empty,
            CuentaCatalogo = entity.CuentaCatalogo ?? string.Empty,
            RequiereComprobacionPago = entity.RequiereComprobacionPago,
            RequiereComprobacionGasto = entity.RequiereComprobacionGasto,
            PermiteSinDatosFiscales = entity.PermiteSinDatosFiscales,
            DiasLimiteComprobacion = entity.DiasLimiteComprobacion,
            Activo = entity.Activo,
            FechaCreacion = entity.FechaCreacion,
            FechaModificacion = entity.FechaModificacion,
            UnidadesMedida = entity.GastoUnidadesMedida
                .Where(gu => gu.Activo && gu.UnidadMedida != null)
                .Select(gu => new UnidadMedidaGastoResponse
                {
                    IdUnidadMedida = gu.IdUnidadMedida,
                    Nombre = gu.UnidadMedida!.Nombre,
                    Abreviatura = gu.UnidadMedida.Abreviatura,
                    Activo = gu.Activo
                })
                .ToList()
        };

        #endregion

        #region Area Mappings

        public static AreaResponse ToResponse(this Area entity) => new()
        {
            IdArea = entity.IdArea,
            IdEmpresa = entity.IdEmpresa,
            Nombre = entity.Nombre,
            Descripcion = entity.Descripcion ?? string.Empty,
            Clave = entity.Clave ?? string.Empty,
            NumeroEmpleados = entity.NumeroEmpleados,
            Activo = entity.Activo,
            FechaCreacion = entity.FechaCreacion,
            FechaModificacion = entity.FechaModificacion
        };

        #endregion

        #region Medida Mappings

        public static MedidaResponse ToResponse(this Medida entity) => new()
        {
            IdMedida = entity.IdMedida,
            Nombre = entity.Nombre,
            Descripcion = entity.Descripcion ?? string.Empty,
            Activo = entity.Activo,
            FechaCreacion = entity.FechaCreacion,
            FechaModificacion = entity.FechaModificacion,
            UnidadesMedida = entity.UnidadesMedida.Select(u => u.ToResponse()).ToList()
        };

        #endregion

        #region UnidadMedida Mappings

        public static UnidadMedidaResponse ToResponse(this UnidadMedida entity) => new()
        {
            IdUnidadMedida = entity.IdUnidadMedida,
            IdMedida = entity.IdMedida,
            NombreMedida = null, // Navegación no incluida para evitar carga
            Nombre = entity.Nombre,
            Descripcion = entity.Descripcion ?? string.Empty,
            Abreviatura = entity.Abreviatura,
            Activo = entity.Activo,
            FechaCreacion = entity.FechaCreacion,
            FechaModificacion = entity.FechaModificacion
        };

        #endregion

        #region UsuarioDetalle Mappings

        public static UsuarioDetalleResponse ToResponse(this UsuarioDetalle entity) => new()
        {
            IdUsuario = entity.IdUsuario,
            IdEmpresa = entity.IdEmpresa,
            IdSucursal = entity.IdSucursal,
            IdArea = entity.IdArea,
            IdCentroCosto = entity.IdCentroCosto,
            Puesto = entity.Puesto,
            NumeroEmpleado = entity.NumeroEmpleado,
            FirmaPath = entity.FirmaPath,
            TelefonoOficina = entity.TelefonoOficina,
            Extension = entity.Extension,
            Celular = entity.Celular,
            TelegramChat = entity.TelegramChat,
            NotificarEmail = entity.NotificarEmail,
            NotificarApp = entity.NotificarApp,
            NotificarWhatsapp = entity.NotificarWhatsapp,
            NotificarSms = entity.NotificarSms,
            NotificarTelegram = entity.NotificarTelegram,
            NotificarSoloUrgentes = entity.NotificarSoloUrgentes,
            NotificarResumenDiario = entity.NotificarResumenDiario,
            NotificarRechazos = entity.NotificarRechazos,
            NotificarVencimientos = entity.NotificarVencimientos,
            IdUsuarioDelegado = entity.IdUsuarioDelegado,
            DelegacionHasta = entity.DelegacionHasta,
            AvatarUrl = entity.AvatarUrl,
            TemaInterfaz = entity.TemaInterfaz,
            DashboardInicio = entity.DashboardInicio,
            Activo = entity.Activo
        };

        #endregion

        #region Usuario Mappings

        public static UsuarioResponse ToResponse(this Usuario entity, UsuarioDetalle? detalle = null) => new()
        {
            IdUsuario = entity.IdUsuario,
            SamAccountName = entity.SamAccountName,
            Dominio = entity.Dominio,
            NombreCompleto = entity.NombreCompleto,
            Correo = entity.Correo,
            EsAnonimo = entity.EsAnonimo,
            EsActivo = entity.EsActivo,
            EsRobot = entity.EsRobot,
            FechaCreacion = entity.FechaCreacion,
            UltimoLogin = entity.UltimoLogin,
            Roles = entity.UsuariosRoles
                .Where(ur => ur.Rol.EsActivo)
                .Select(ur => ur.Rol.ToRolBasicoResponse())
                .ToList(),
            PermisosDirectos = entity.UsuariosPermisos
                .Where(up => up.Permiso.EsActivo)
                .Select(up => up.Permiso.ToPermisoBasicoResponse())
                .ToList(),
            Detalle = detalle?.ToResponse()
        };

        public static UsuarioBasicoResponse ToUsuarioBasicoResponse(this Usuario entity) => new()
        {
            IdUsuario = entity.IdUsuario,
            SamAccountName = entity.SamAccountName,
            NombreCompleto = entity.NombreCompleto,
            Correo = entity.Correo,
            EsActivo = entity.EsActivo
        };

        #endregion

        #region Banco Mappings

        public static BancoResponse ToResponse(this Banco entity) => new()
        {
            IdBanco = entity.IdBanco,
            Nombre = entity.Nombre,
            Clave = entity.Clave ?? string.Empty,
            CodigoSWIFT = entity.CodigoSWIFT ?? string.Empty,
            Descripcion = entity.Descripcion ?? string.Empty,
            Activo = entity.Activo,
            FechaCreacion = entity.FechaCreacion,
            FechaModificacion = entity.FechaModificacion
        };

        #endregion

        #region Rol Mappings

        public static RolResponse ToResponse(this Rol entity) => new()
        {
            IdRol = entity.IdRol,
            NombreRol = entity.NombreRol,
            Descripcion = entity.Descripcion,
            EsActivo = entity.EsActivo,
            EsSistema = entity.EsSistema,
            FechaCreacion = entity.FechaCreacion,
            CantidadUsuarios = entity.UsuariosRoles.Count,
            Permisos = entity.RolesPermisos
                .Where(rp => rp.Permiso.EsActivo)
                .Select(rp => rp.Permiso.ToPermisoBasicoResponse())
                .ToList()
        };

        public static RolBasicoResponse ToRolBasicoResponse(this Rol entity) => new()
        {
            IdRol = entity.IdRol,
            NombreRol = entity.NombreRol,
            Descripcion = entity.Descripcion,
            EsActivo = entity.EsActivo
        };

        #endregion

        #region Permiso Mappings

        public static PermisoResponse ToResponse(this Permiso entity) => new()
        {
            IdPermiso = entity.IdPermiso,
            CodigoPermiso = entity.CodigoPermiso,
            NombrePermiso = entity.NombrePermiso,
            Descripcion = entity.Descripcion,
            Categoria = entity.Categoria,
            Recurso = entity.Recurso,
            Accion = entity.Accion,
            EsActivo = entity.EsActivo,
            EsSistema = entity.EsSistema,
            FechaCreacion = entity.FechaCreacion,
            CantidadRoles = entity.RolesPermisos.Count,
            CantidadUsuarios = entity.UsuariosPermisos.Count
        };

        public static PermisoBasicoResponse ToPermisoBasicoResponse(this Permiso entity) => new()
        {
            IdPermiso = entity.IdPermiso,
            CodigoPermiso = entity.CodigoPermiso,
            NombrePermiso = entity.NombrePermiso,
            Categoria = entity.Categoria,
            Recurso = entity.Recurso,
            Accion = entity.Accion
        };

        #endregion

        #region MedioPago Mappings

        public static MedioPagoResponse ToResponse(this MedioPago entity) => new()
        {
            IdMedioPago = entity.IdMedioPago,
            Nombre = entity.Nombre,
            Clave = entity.Clave ?? string.Empty,
            Descripcion = entity.Descripcion ?? string.Empty,
            Activo = entity.Activo,
            FechaCreacion = entity.FechaCreacion,
            FechaModificacion = entity.FechaModificacion
        };

        #endregion
    }
}
