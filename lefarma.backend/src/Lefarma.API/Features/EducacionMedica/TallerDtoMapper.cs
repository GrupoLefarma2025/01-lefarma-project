using Lefarma.API.Domain.Entities.EducacionMedica;
using Lefarma.API.Features.EducacionMedica.DTOs;

namespace Lefarma.API.Features.EducacionMedica;

/// <summary>Mapeo compartido Taller -> TallerDto (lo usan TalleresService y MatrizTalleresService).</summary>
internal static class TallerDtoMapper
{
    public static TallerDto Armar(
        Taller taller,
        IReadOnlyDictionary<int, string>? nombresHospitales = null,
        IReadOnlyDictionary<int, string>? nombresUsuarios = null)
    {
        var recursos = taller.Recursos
            .OrderBy(r => r.IdTallerRecurso)
            .Select(r => new TallerRecursoDto
            {
                IdTallerRecurso = r.IdTallerRecurso,
                TipoRecurso = r.TipoRecurso,
                IdProducto = r.IdProducto,
                Descripcion = r.Descripcion,
                TipoEnvio = r.TipoEnvio,
                Cantidad = r.Cantidad,
                CostoUnitario = r.CostoUnitario,
                Subtotal = r.Subtotal,
                Observaciones = r.Observaciones,
            })
            .ToList();

        return new TallerDto
        {
            IdTaller = taller.IdTaller,
            IdSeleccionHospital = taller.IdSeleccionHospital,
            IdHospital = taller.IdHospital,
            NombreHospital = taller.IdHospital.HasValue
                ? nombresHospitales?.GetValueOrDefault(taller.IdHospital.Value)
                : null,
            Region = taller.Region,
            EntidadFederativa = taller.EntidadFederativa,
            CiudadMunicipio = taller.CiudadMunicipio,
            NumeroParticipantes = taller.NumeroParticipantes,
            IdEjecutivo = taller.IdEjecutivo,
            NombreEjecutivo = taller.IdEjecutivo.HasValue
                ? nombresUsuarios?.GetValueOrDefault(taller.IdEjecutivo.Value)
                : null,
            IdEspecialista = taller.IdEspecialista,
            NombreEspecialista = taller.IdEspecialista.HasValue
                ? nombresUsuarios?.GetValueOrDefault(taller.IdEspecialista.Value)
                : null,
            UnidadMedica = taller.UnidadMedica,
            Lugar = taller.Lugar,
            FechaTaller = taller.FechaTaller,
            HoraTaller = taller.HoraTaller,
            RequiereEquipoProyeccion = taller.RequiereEquipoProyeccion,
            TipoEquipoProyeccion = taller.TipoEquipoProyeccion,
            Estado = taller.Estado,
            Observaciones = taller.Observaciones,
            IdMatrizIndividual = taller.IdMatrizIndividual,
            IdMatrizGeneral = taller.IdMatrizGeneral,
            Recursos = recursos,
            CostoTotal = recursos.Sum(r => r.Subtotal ?? 0m),
        };
    }
}
