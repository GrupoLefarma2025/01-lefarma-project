using Lefarma.API.Domain.Entities.Catalogos;
using Lefarma.API.Features.Catalogos.FormasPago.DTOs;

namespace Lefarma.API.Features.Catalogos.FormasPago.Extensions
{
    public static class FormaPagoExtensions
    {
        public static FormaPagoResponse ToResponse(this FormaPago entity)
        {
            return new FormaPagoResponse
            {
                IdFormaPago = entity.IdFormaPago,
                Nombre = entity.Nombre,
                Descripcion = entity.Descripcion ?? string.Empty,
                Clave = entity.Clave ?? string.Empty,
                Activo = entity.Activo,
                FechaCreacion = entity.FechaCreacion,
                FechaModificacion = entity.FechaModificacion
            };
        }
    }
}
