using Lefarma.API.Domain.Entities.Rh;
using Lefarma.API.Features.Rh.SolicitudesPersonal.DTOs;

namespace Lefarma.API.Shared.Extensions;

public static class RhMappings
{
    public record UsuarioInfo(string Nombre, string? Puesto);

    /// <summary>
    /// Datos del empleado en Asistencias (vwEmpleados). Son la fuente oficial de lo que se
    /// imprime en los formatos de RH, por encima de los catálogos de Lefarma.
    /// </summary>
    public record EmpleadoAsistenciasInfo(
        string? EmpresaReal,
        string? Departamento,
        string? Puesto,
        string? LugarRegistro,
        string? Ubicacion);

    #region SolicitudPersonal Mappings

    public static SolicitudPersonalResponse ToResponse(
        this SolicitudPersonal s,
        TipoSolicitud? tipo,
        Dictionary<int, UsuarioInfo>? usuariosInfo = null,
        string? paso = null,
        string? estado = null,
        Dictionary<int, EmpleadoAsistenciasInfo>? empleadosInfo = null)
    {
        var empleado = ResolveEmpleadoInfo(s, empleadosInfo);

        return new SolicitudPersonalResponse
        {
            IdSolicitud = s.IdSolicitud,
            Folio = s.Folio,
            IdEmpresa = s.IdEmpresa,
            EmpresaNombre = PrimeroConValor(empleado?.EmpresaReal, s.Empresa?.NombreNormalizado ?? s.Empresa?.Nombre),
            IdSucursal = s.IdSucursal,
            SucursalNombre = PrimeroConValor(empleado?.LugarRegistro, s.Sucursal?.NombreNormalizado ?? s.Sucursal?.Nombre),
            IdArea = s.IdArea,
            AreaNombre = PrimeroConValor(empleado?.Departamento, s.Area?.NombreNormalizado ?? s.Area?.Nombre),
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
            CreadorNombre = usuariosInfo != null && usuariosInfo.TryGetValue(s.IdUsuarioCreador, out var creadorInfo) ? creadorInfo.Nombre : null,
            IdUsuarioSolicitante = s.IdUsuarioSolicitante,
            SolicitanteNombre = ResolveSolicitanteNombre(s, usuariosInfo),
            SolicitantePuesto = PrimeroConValor(empleado?.Puesto, ResolveSolicitantePuesto(s, usuariosInfo)),
            Ubicacion = empleado?.Ubicacion,
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

    private static string? ResolveSolicitanteNombre(SolicitudPersonal s, Dictionary<int, UsuarioInfo>? usuariosInfo)
    {
        if (usuariosInfo is null) return null;
        var id = s.IdUsuarioSolicitante ?? s.IdUsuarioCreador;
        return usuariosInfo.TryGetValue(id, out var info) ? info.Nombre : null;
    }

    private static string? ResolveSolicitantePuesto(SolicitudPersonal s, Dictionary<int, UsuarioInfo>? usuariosInfo)
    {
        if (usuariosInfo is null) return null;
        var id = s.IdUsuarioSolicitante ?? s.IdUsuarioCreador;
        return usuariosInfo.TryGetValue(id, out var info) ? info.Puesto : null;
    }

    private static EmpleadoAsistenciasInfo? ResolveEmpleadoInfo(
        SolicitudPersonal s,
        Dictionary<int, EmpleadoAsistenciasInfo>? empleadosInfo)
    {
        if (empleadosInfo is null) return null;
        var id = s.IdUsuarioSolicitante ?? s.IdUsuarioCreador;
        return empleadosInfo.TryGetValue(id, out var info) ? info : null;
    }

    /// <summary>Primer valor no vacío: el dato de Asistencias manda sobre el catálogo de Lefarma.</summary>
    private static string? PrimeroConValor(params string?[] valores) =>
        valores.Select(v => v?.Trim()).FirstOrDefault(v => !string.IsNullOrWhiteSpace(v));

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
            EsIncapacidad = t.Categoria == CategoriaSolicitud.Incapacidad,
            RequiereReposicionTiempo = t.RequiereReposicionTiempo,
            RequiereFechaFin = t.RequiereFechaFin,
            RequiereFechaRegreso = t.RequiereFechaRegreso,
            RequiereLugarComision = t.RequiereLugarComision,
            DescuentaNomina = t.DescuentaNomina,
            DescuentaVacaciones = t.DescuentaVacaciones,
            RequiereDocumentacion = t.RequiereDocumentacion,
            PermiteFechasPasadas = t.PermiteFechasPasadas,
            PermiteFechasFuturas = t.PermiteFechasFuturas,
            TomaEnCuentaChecado = t.TomaEnCuentaChecado,
            RequiereIncidenciasExistentes = t.RequiereIncidenciasExistentes,
            PideDiasSolicitados = t.PideDiasSolicitados,
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
