using Lefarma.API.Domain.Entities.Catalogos;
using Lefarma.API.Features.Catalogos.Areas.DTOs;
using Lefarma.API.Features.Catalogos.Empresas.DTOs;
using Lefarma.API.Features.Catalogos.Sucursales.DTOs;
using Lefarma.API.Features.Catalogos.Medidas.DTOs;
using Lefarma.API.Features.Catalogos.Gastos.DTOs;
using Lefarma.API.Features.Catalogos.UnidadesMedida.DTOs;

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
    }
}
