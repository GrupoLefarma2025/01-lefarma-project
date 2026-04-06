using Lefarma.API.Features.Catalogos.EstatusOrden.DTOs;

namespace Lefarma.API.Features.Catalogos.EstatusOrden.Extensions
{
public static class EstatusOrdenExtensions
    {
        public static EstatusOrdenResponse ToResponse(this Lefarma.API.Domain.Entities.Catalogos.EstatusOrden entity)
        {
            return new EstatusOrdenResponse
            {
                IdEstatusOrden = entity.IdEstatusOrden,
                Nombre = entity.Nombre,
                Descripcion = entity.Descripcion,
                SiguienteEstatusId = entity.SiguienteEstatusId,
                RequiereAccion = entity.RequiereAccion,
                Activo = entity.Activo,
                FechaCreacion = entity.FechaCreacion
            };
        }
    }
}
