using Lefarma.API.Domain.Entities.Catalogos;
using Lefarma.API.Features.Catalogos.TiposImpuesto.DTOs;

namespace Lefarma.API.Features.Catalogos.TiposImpuesto.Extensions
{
    public static class TipoImpuestoExtensions
    {
        public static TipoImpuestoResponse ToResponse(this TipoImpuesto entity)
        {
            return new TipoImpuestoResponse
            {
                IdTipoImpuesto = entity.IdTipoImpuesto,
                Nombre = entity.Nombre,
                Clave = entity.Clave,
                Tasa = entity.Tasa,
                Descripcion = entity.Descripcion ?? string.Empty,
                Activo = entity.Activo,
                FechaCreacion = entity.FechaCreacion,
                FechaModificacion = entity.FechaModificacion
            };
        }
    }
}
