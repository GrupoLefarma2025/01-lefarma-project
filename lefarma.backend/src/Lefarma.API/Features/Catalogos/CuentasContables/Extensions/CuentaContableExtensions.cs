using Lefarma.API.Domain.Entities.Catalogos;
using Lefarma.API.Features.Catalogos.CuentasContables.DTOs;

namespace Lefarma.API.Features.Catalogos.CuentasContables.Extensions
{
    public static class CuentaContableExtensions
    {
        public static CuentaContableResponse ToResponse(this CuentaContable entity)
        {
            return new CuentaContableResponse
            {
                IdCuentaContable = entity.IdCuentaContable,
                Cuenta = entity.Cuenta,
                Descripcion = entity.Descripcion,
                DescripcionNormalizada = entity.DescripcionNormalizada,
                Nivel1 = entity.Nivel1,
                Nivel2 = entity.Nivel2,
                //EmpresaPrefijo = entity.EmpresaPrefijo,
                IdEmpresa = entity.IdEmpresa,
                EmpresaNombre = entity.Empresa?.Nombre,
                CentroCostoId = entity.CentroCostoId,
                CentroCostoNombre = entity.CentroCosto?.Nombre,
                Activo = entity.Activo,
                FechaCreacion = entity.FechaCreacion,
                FechaModificacion = entity.FechaModificacion
            };
        }
    }
}
