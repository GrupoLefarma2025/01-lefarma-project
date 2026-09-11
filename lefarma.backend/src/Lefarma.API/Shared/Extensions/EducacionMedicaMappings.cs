using Lefarma.API.Domain.Entities.EducacionMedica;
using Lefarma.API.Features.EducacionMedica.DTOs;

namespace Lefarma.API.Shared.Extensions;

public static class EducacionMedicaMappings
{
    #region Hospital Mappings

    public static HospitalDto ToResponse(
        this Hospital hospital,
        HospitalExtension? extension = null,
        Dictionary<int, string>? tiposDict = null,
        string? institucion = null,
        Dictionary<int, string>? regionesDict = null)
    {
        string? tipoGerencia = null;
        if (extension?.IdTipoGerencia.HasValue == true && tiposDict?.TryGetValue(extension.IdTipoGerencia.Value, out var desc) == true)
        {
            tipoGerencia = desc;
        }

        string? regionNombre = null;
        if (extension?.IdRegion.HasValue == true && regionesDict?.TryGetValue(extension.IdRegion.Value, out var nomRegion) == true)
        {
            regionNombre = nomRegion;
        }

        return new HospitalDto
        {
            CodigoContacto = hospital.CodigoContacto,
            NombreContacto = hospital.NombreContacto ?? string.Empty,
            NombreCorto = hospital.NombreCorto,
            Clues = hospital.Clues,
            Ciudad = hospital.Ciudad,
            CodigoEstado = hospital.CodigoEstado,
            Activo = hospital.Activo,
            CodigoContactoPrincipal = hospital.CodigoContactoPrincipal,
            Institucion = institucion,
            Latitud = hospital.Latitud,
            Longitud = hospital.Longitud,
            EsInstitucion = hospital.CodigoContactoPrincipal == null,
            Extension = extension?.ToResponse(tipoGerencia, regionNombre)
        };
    }

    #endregion

    #region HospitalExtension Mappings

    public static HospitalExtensionDto ToResponse(
        this HospitalExtension extension,
        string? tipoGerencia = null,
        string? regionNombre = null)
    {
        return new HospitalExtensionDto
        {
            IdHospitalExtension = extension.IdHospitalExtension,
            IdHospital = extension.IdHospital,
            Fecha = extension.Fecha,
            IdTipoGerencia = extension.IdTipoGerencia,
            TipoGerencia = tipoGerencia,
            IdRegion = extension.IdRegion,
            RegionNombre = regionNombre,
            ConSia = extension.ConSia,
            NumeroQuirofanos = extension.NumeroQuirofanos,
            EsZonaMetropolitana = extension.EsZonaMetropolitana,
            AnestesiasTotales = extension.AnestesiasTotales,
            AnestesiasGenerales = extension.AnestesiasGenerales,
            AnestesiasRegionales = extension.AnestesiasRegionales,
            AnestesiasEpidurales = extension.AnestesiasEpidurales,
            AnestesiasSubdurales = extension.AnestesiasSubdurales,
            AnestesiasMixtasObesos = extension.AnestesiasMixtasObesos,
            AnestesiasMixtasNoObesos = extension.AnestesiasMixtasNoObesos
        };
    }

    #endregion

    #region Producto Mappings

    public static ProductoDto ToResponse(this Producto producto)
    {
        return new ProductoDto
        {
            CodigoProducto = producto.CodigoProducto,
            Nombre = producto.NombreInternoProducto ?? producto.DescripcionCorta ?? $"Producto {producto.CodigoProducto}",
            DescripcionCorta = producto.DescripcionCorta,
            Tipo = producto.Tipo,
            TipoAsokam = producto.TipoAsokam,
            MarcaIMSS = producto.MarcaIMSS
        };
    }

    #endregion

    #region TipoGerencia Mappings

    public static TipoGerenciaDto ToResponse(this TipoGerencia tipoGerencia)
    {
        return new TipoGerenciaDto
        {
            IdTipoGerencia = tipoGerencia.IdTipoGerencia,
            Descripcion = tipoGerencia.Descripcion
        };
    }

    #endregion

    #region EquipoPareo Mappings

    public static EquipoPareoDto ToResponse(this EquipoPareo equipo, Dictionary<int, string> nombres, List<string> regionesActuales, string? nombreRegion = null)
    {
        return new EquipoPareoDto
        {
            IdEquipo = equipo.IdEquipo,
            IdRegion = equipo.IdRegion,
            NombreRegion = nombreRegion,
            IdEjecutivo = equipo.IdEjecutivo,
            NombreEjecutivo = nombres.GetValueOrDefault(equipo.IdEjecutivo, $"Usuario {equipo.IdEjecutivo}"),
            IdEspecialista = equipo.IdEspecialista,
            NombreEspecialista = nombres.GetValueOrDefault(equipo.IdEspecialista, $"Usuario {equipo.IdEspecialista}"),
            FechaInicio = equipo.FechaInicio,
            FechaFin = equipo.FechaFin,
            Activo = equipo.Activo,
            RegionesActuales = regionesActuales,
        };
    }

    #endregion

    #region SeleccionMensual Mappings

    public static SeleccionMensualDto ToResponse(
        this SeleccionMensual seleccion,
        Dictionary<int, string> tiposGerencia,
        int totalHospitales,
        int totalRegiones)
    {
        return new SeleccionMensualDto
        {
            IdSeleccionMensual = seleccion.IdSeleccionMensual,
            FechaSeleccion = seleccion.FechaSeleccion,
            IdTipoGerencia = seleccion.IdTipoGerencia,
            TipoGerencia = seleccion.IdTipoGerencia.HasValue
                ? tiposGerencia.GetValueOrDefault(seleccion.IdTipoGerencia.Value)
                : null,
            FechaInicioVigencia = seleccion.FechaInicioVigencia,
            FechaFinVigencia = seleccion.FechaFinVigencia,
            TalleresObjetivoMes = seleccion.TalleresObjetivoMes,
            Estado = seleccion.Estado,
            FirmaGvFecha = seleccion.FirmaGvFecha,
            FirmaGgFecha = seleccion.FirmaGgFecha,
            TotalHospitales = totalHospitales,
            TotalRegiones = totalRegiones,
        };
    }

    public static SeleccionRegionDto ToResponse(this SeleccionRegion region, Dictionary<int, string> nombresEquipos)
    {
        return new SeleccionRegionDto
        {
            IdRegion = region.IdRegion,
            Nombre = region.Nombre,
            CentroLatitud = region.CentroLatitud,
            CentroLongitud = region.CentroLongitud,
            CantidadHospitales = region.CantidadHospitales,
            IdEquipo = region.IdEquipo,
            NombreEquipo = region.IdEquipo.HasValue
                ? nombresEquipos.GetValueOrDefault(region.IdEquipo.Value, $"Equipo {region.IdEquipo}")
                : null,
            IdRegionCatalogo = region.IdRegionCatalogo,
            Algoritmo = region.Algoritmo,
            FechaCalculo = region.FechaCalculo,
            AdvertenciaMinimo = region.CantidadHospitales < 4,
        };
    }

    #endregion

    #region ParametroModulo Mappings

    public static ParametroModuloDto ToResponse(this ParametroModulo parametro)
    {
        return new ParametroModuloDto
        {
            Clave = parametro.Clave,
            Valor = parametro.Valor,
            Descripcion = parametro.Descripcion,
        };
    }

    #endregion

    #region ParametroAnestesia Mappings

    public static ParametroAnestesiaDto ToResponse(this ParametroAnestesia parametro)
    {
        return new ParametroAnestesiaDto
        {
            IdParametroAnestesia = parametro.IdParametroAnestesia,
            Anio = parametro.Anio,
            Clave = parametro.Clave,
            Valor = parametro.Valor,
            Descripcion = parametro.Descripcion,
            Orden = parametro.Orden
        };
    }

    #endregion
}
