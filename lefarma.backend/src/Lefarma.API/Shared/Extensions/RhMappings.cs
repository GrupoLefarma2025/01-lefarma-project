using Lefarma.API.Domain.Entities.Rh;
using Lefarma.API.Features.Rh.SolicitudesPersonal.DTOs;

namespace Lefarma.API.Shared.Extensions;

public static class RhMappings
{
    public record UsuarioInfo(string Nombre, string? Puesto);

    #region SolicitudPersonal Mappings

    public static SolicitudPersonalResponse ToResponse(
        this SolicitudPersonal s,
        TipoSolicitud? tipo,
        Dictionary<int, UsuarioInfo>? usuariosInfo = null,
        string? paso = null,
        string? estado = null)
    {
        return new SolicitudPersonalResponse
        {
            IdSolicitud = s.IdSolicitud,
            Folio = s.Folio,
            IdEmpresa = s.IdEmpresa,
            EmpresaNombre = s.Empresa?.NombreNormalizado ?? s.Empresa?.Nombre,
            IdSucursal = s.IdSucursal,
            SucursalNombre = s.Sucursal?.NombreNormalizado ?? s.Sucursal?.Nombre,
            IdArea = s.IdArea,
            AreaNombre = s.Area?.NombreNormalizado ?? s.Area?.Nombre,
            IdTipoSolicitud = s.IdTipoSolicitud,
            TipoSolicitudNombre = tipo?.Nombre,
            Categoria = ((int)(tipo?.Categoria ?? CategoriaSolicitud.Permiso)).ToString(),
            IdEstado = s.IdEstado,
            EstadoNombre = estado ?? s.Estado?.Codigo,
            EstadoColor = s.Estado?.ColorHex,
            IdWorkflow = s.IdWorkflow,
            IdPasoActual = s.IdPasoActual,
            PasoActual = paso,
            IdUsuarioCreador = s.IdUsuarioCreador,
            SolicitanteNombre = usuariosInfo != null && usuariosInfo.TryGetValue(s.IdUsuarioCreador, out var ui) ? ui.Nombre : null,
            SolicitantePuesto = usuariosInfo != null && usuariosInfo.TryGetValue(s.IdUsuarioCreador, out ui) ? ui.Puesto : null,
            LugarComision = s.LugarComision,
            Motivo = s.Motivo,
            FechaEnvio = s.FechaEnvio,
            FechaInicio = s.FechaInicio,
            FechaFin = s.FechaFin,
            FechaReposicion = s.FechaReposicion,
            DiasSolicitados = s.DiasSolicitados,
            FechaRegreso = s.FechaRegreso,
            FechaCreacion = s.FechaCreacion,
            FechaModificacion = s.FechaModificacion,
            Detalle = s.Detalle?
                .OrderBy(d => d.Fecha)
                .Select(d => d.ToDto())
                .ToList() ?? new List<SolicitudPersonalDetalleDto>()
        };
    }

    public static SolicitudPersonalDetalleDto ToDto(this SolicitudPersonalDetalle d)
    {
        return new SolicitudPersonalDetalleDto
        {
            Fecha = d.Fecha,
            Comentario = d.Comentario
        };
    }

    #endregion

    #region TipoSolicitud Mappings

    public static TipoSolicitudResponse ToResponse(this TipoSolicitud t)
    {
        return new TipoSolicitudResponse
        {
            IdTipoSolicitud = t.IdTipoSolicitud,
            Nombre = t.Nombre,
            Clave = t.Clave,
            Categoria = ((int)t.Categoria).ToString(),
            Descripcion = t.Descripcion,
            EsIncidencia = t.Categoria == CategoriaSolicitud.Incidencia,
            EsPermiso = t.Categoria == CategoriaSolicitud.Permiso,
            RequiereReposicionTiempo = t.RequiereReposicionTiempo,
            RequiereFechaFin = t.RequiereFechaFin,
            RequiereFechaRegreso = t.RequiereFechaRegreso,
            RequiereLugarComision = t.RequiereLugarComision,
            DescuentaNomina = t.DescuentaNomina,
            DescuentaVacaciones = t.DescuentaVacaciones,
            RequiereDocumentacion = t.RequiereDocumentacion,
            LimitePorPeriodo = t.LimitePorPeriodo,
            PeriodoLimite = t.PeriodoLimite,
            TotalParaDescuento = t.TotalParaDescuento,
            Activo = t.Activo,
            FechaCreacion = t.FechaCreacion,
            FechaModificacion = t.FechaModificacion
        };
    }

    #endregion
}
