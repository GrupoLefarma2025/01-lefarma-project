using Lefarma.API.Domain.Entities.Catalogos;
using Lefarma.API.Features.Catalogos.RegimenesFiscales.DTOs;

namespace Lefarma.API.Features.Catalogos.RegimenesFiscales.Extensions
{
public static class RegimenFiscalExtensions
    {
        public static RegimenFiscalResponse ToResponse(this RegimenFiscal entity)
        {
            return new RegimenFiscalResponse
            {
                IdRegimenFiscal = entity.IdRegimenFiscal,
                Clave = entity.Clave,
                Descripcion = entity.Descripcion,
                TipoPersona = entity.TipoPersona,
                Activo = entity.Activo,
                FechaCreacion = entity.FechaCreacion
            };
        }
    }
}
