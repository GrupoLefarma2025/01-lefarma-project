using Lefarma.API.Domain.Entities.Catalogos;
using Lefarma.API.Features.Catalogos.Proveedores.DTOs;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Features.Catalogos.Proveedores.Extensions
{
    public static class ProveedorExtensions
    {
        public static ProveedorResponse ToResponse(this Proveedor entity)
        {
            return new ProveedorResponse
            {
                IdProveedor = entity.IdProveedor,
                RazonSocial = entity.RazonSocial,
                RazonSocialNormalizada = entity.RazonSocialNormalizada,
                RFC = entity.RFC,
                CodigoPostal = entity.CodigoPostal,
                RegimenFiscalId = entity.RegimenFiscalId,
                RegimenFiscalDescripcion = entity.RegimenFiscal?.Descripcion,
                PersonaContacto = entity.PersonaContacto,
                NotasGenerales = entity.NotasGenerales,
                UsoCfdi = entity.UsoCfdi,
                FechaRegistro = entity.FechaRegistro,
                FechaModificacion = entity.FechaModificacion
            };
        }
    }
}
