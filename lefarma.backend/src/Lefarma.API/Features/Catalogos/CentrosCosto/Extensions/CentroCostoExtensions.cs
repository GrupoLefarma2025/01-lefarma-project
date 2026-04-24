using Lefarma.API.Domain.Entities.Catalogos;
using Lefarma.API.Features.Catalogos.CentrosCosto.DTOs;

namespace Lefarma.API.Features.Catalogos.CentrosCosto.Extensions
{
    public static class CentroCostoExtensions
    {
        public static CentroCostoResponse ToResponse(this CentroCosto entity)
        {
            return new CentroCostoResponse
            {
                IdCentroCosto = entity.IdCentroCosto,
                Nombre = entity.Nombre,
                NombreNormalizado = entity.NombreNormalizado ?? string.Empty,
                Descripcion = entity.Descripcion,
                DescripcionNormalizada = entity.DescripcionNormalizada,
                LimitePresupuesto = entity.LimitePresupuesto,
                Activo = entity.Activo,
                FechaCreacion = entity.FechaCreacion,
                FechaModificacion = entity.FechaModificacion
            };
        }
    }
}
