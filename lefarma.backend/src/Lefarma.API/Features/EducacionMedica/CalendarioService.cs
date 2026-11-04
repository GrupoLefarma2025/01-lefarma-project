using System.Text.Json;
using Lefarma.API.Domain.Entities.EducacionMedica;
using Lefarma.API.Features.EducacionMedica.DTOs;
using Lefarma.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Features.EducacionMedica;

public class CalendarioService : ICalendarioService
{
    private readonly ApplicationDbContext _context;
    private readonly AsokamDbContext _asokamContext;

    public CalendarioService(ApplicationDbContext context, AsokamDbContext asokamContext)
    {
        _context = context;
        _asokamContext = asokamContext;
    }

    public async Task<List<CalendarioItemDto>> GetCalendarioAsync(
        CalendarioFiltro filtro,
        int idUsuario,
        bool verTodas,
        CancellationToken ct = default)
    {
        var (inicio, fin) = await ResolverRangoAsync(filtro, ct);

        var query = from v in _context.RutasVisitas.AsNoTracking()
                    join r in _context.Rutas.AsNoTracking() on v.IdRuta equals r.IdRuta
                    join s in _context.SeleccionesMensuales.AsNoTracking() on r.IdSeleccionMensual equals s.IdSeleccionMensual
                    join h in _context.SeleccionesHospitales.AsNoTracking() on v.IdSeleccionHospital equals h.IdSeleccionHospital into hospitales
                    from h in hospitales.DefaultIfEmpty()
                    where v.FechaVisita >= inicio && v.FechaVisita <= fin
                    select new { v, r, s, h };

        if (!verTodas)
        {
            query = query.Where(x =>
                x.v.IdEjecutivo == idUsuario || x.v.IdEspecialista == idUsuario);
        }

        if (filtro.Version.HasValue)
        {
            query = query.Where(x => x.r.Version == filtro.Version.Value);
        }
        else
        {
            query = query.Where(x => x.r.Estado != Ruta.EstadoArchivada
                && x.r.Estado != Ruta.EstadoCancelada
                && x.r.Estado != Ruta.EstadoRechazada);
        }

        if (filtro.IdSeleccion.HasValue)
        {
            query = query.Where(x => x.s.IdSeleccionMensual == filtro.IdSeleccion.Value);
        }

        if (filtro.IdGerencia.HasValue)
        {
            query = query.Where(x => x.s.IdTipoGerencia == filtro.IdGerencia.Value);
        }

        if (filtro.IdGerencias is { Count: > 0 })
        {
            query = query.Where(x =>
                x.s.IdTipoGerencia.HasValue &&
                filtro.IdGerencias.Contains(x.s.IdTipoGerencia.Value));
        }

        if (filtro.IdRegion.HasValue)
        {
            query = query.Where(x => x.h != null && x.h.IdRegion == filtro.IdRegion.Value);
        }

        if (filtro.IdEjecutivo.HasValue)
        {
            query = query.Where(x => x.v.IdEjecutivo == filtro.IdEjecutivo.Value);
        }

        if (filtro.IdEspecialista.HasValue)
        {
            query = query.Where(x => x.v.IdEspecialista == filtro.IdEspecialista.Value);
        }

        var filas = await query.ToListAsync(ct);
        if (filas.Count == 0)
        {
            return [];
        }

        var idsVisitas = filas.Select(x => x.v.IdRutaVisita).ToList();
        var talleres = await _context.Talleres
            .AsNoTracking()
            .Include(t => t.Recursos)
            .Where(t => t.Activo
                && t.IdRutaVisita.HasValue
                && idsVisitas.Contains(t.IdRutaVisita.Value))
            .ToListAsync(ct);
        var tallerPorVisita = talleres
            .GroupBy(t => t.IdRutaVisita!.Value)
            .ToDictionary(g => g.Key, g => g.OrderBy(t => t.HoraTaller).ThenBy(t => t.IdTaller).ToList());

        var idsTaller = talleres.Select(t => t.IdTaller).ToList();
        var solicitudesPendientes = idsTaller.Count == 0
            ? new HashSet<int>()
            : (await _context.TalleresSolicitudesCambio
                .AsNoTracking()
                .Where(s => s.Estado == TallerSolicitudCambio.EstadoPendiente
                    && idsTaller.Contains(s.IdTaller))
                .Select(s => s.IdTaller)
                .Distinct()
                .ToListAsync(ct))
                .ToHashSet();

        var idsRegion = filas
            .Where(f => f.h != null && f.h.IdRegion.HasValue)
            .Select(f => f.h!.IdRegion!.Value)
            .Distinct()
            .ToList();
        var regiones = idsRegion.Count == 0
            ? new Dictionary<int, string?>()
            : await _context.SeleccionesRegiones
                .AsNoTracking()
                .Where(r => idsRegion.Contains(r.IdRegion))
                .ToDictionaryAsync(r => r.IdRegion, r => r.Nombre, ct);
        var tiposGerencia = await _context.TiposGerencia
            .AsNoTracking()
            .ToDictionaryAsync(t => t.IdTipoGerencia, t => t.Descripcion, ct);
        var tiposVisita = await _context.TiposVisita
            .AsNoTracking()
            .ToDictionaryAsync(t => t.IdTipoVisita, t => t.Descripcion, ct);
        var temas = await _context.TemasTaller
            .AsNoTracking()
            .ToDictionaryAsync(t => t.IdTemaTaller, t => t.Descripcion, ct);
        var productos = await EducacionMedicaNombres.ResolverProductosAsync(
            _asokamContext,
            talleres.SelectMany(t => t.Recursos).Select(r => r.IdProducto),
            ct);

        var idsHospital = filas
            .Select(x => x.v.IdHospital ?? x.h?.IdHospital)
            .Where(id => id.HasValue)
            .Select(id => id!.Value)
            .Distinct()
            .ToList();
        var hospitalesAsokam = idsHospital.Count == 0
            ? new Dictionary<int, Hospital>()
            : await _asokamContext.Hospitales
                .AsNoTracking()
                .Where(h => idsHospital.Contains(h.CodigoContacto))
                .ToDictionaryAsync(h => h.CodigoContacto, ct);

        var nombresEstados = await EducacionMedicaNombres.ResolverEstadosAsync(
            _asokamContext,
            hospitalesAsokam.Values.Select(h => h.CodigoEstado)
                .Concat(filas.Select(x => x.h?.EntidadFederativa)),
            ct);

        var idsPadre = hospitalesAsokam.Values
            .Select(h => h.CodigoContactoPrincipal)
            .Where(id => id.HasValue)
            .Select(id => id!.Value)
            .Distinct()
            .Except(idsHospital)
            .ToList();
        var padres = idsPadre.Count == 0
            ? new Dictionary<int, Hospital>()
            : await _asokamContext.Hospitales
                .AsNoTracking()
                .Where(h => idsPadre.Contains(h.CodigoContacto))
                .ToDictionaryAsync(h => h.CodigoContacto, ct);

        var idsUsuario = filas
            .SelectMany(x => new[] { x.v.IdEjecutivo, x.v.IdEspecialista })
            .Concat(talleres.SelectMany(t => new[] { t.IdEjecutivo, t.IdEspecialista }))
            .Where(id => id.HasValue)
            .Select(id => id!.Value)
            .Distinct()
            .ToList();
        var usuarios = idsUsuario.Count == 0
            ? new Dictionary<int, string?>()
            : await _asokamContext.Usuarios
                .AsNoTracking()
                .Where(u => idsUsuario.Contains(u.IdUsuario))
                .ToDictionaryAsync(u => u.IdUsuario, u => u.NombreCompleto, ct);

        var (maxDia, maxSemana) = await LeerCapacidadesAsync(ct);
        var visitasCapacidad = await LeerVisitasCapacidadAsync(filas
            .Select(x => x.v.IdEspecialista)
            .Where(id => id.HasValue)
            .Select(id => id!.Value)
            .Distinct()
            .ToList(), inicio, fin, ct);
        var elegibilidad = await LeerElegibilidadAsync(visitasCapacidad
            .Select(v => v.IdEspecialista)
            .Where(id => id.HasValue)
            .Select(id => id!.Value)
            .Distinct()
            .ToList(), ct);

        var items = new List<CalendarioItemDto>(filas.Count);
        foreach (var fila in filas)
        {
            var visita = fila.v;
            var hospital = fila.h;
            var idHospital = visita.IdHospital ?? hospital?.IdHospital;
            var hospitalAsokam = idHospital.HasValue
                ? hospitalesAsokam.GetValueOrDefault(idHospital.Value)
                : null;
            var nombreHospital = hospitalAsokam?.NombreContacto
                ?? (idHospital.HasValue ? $"Hospital {idHospital}" : null);
            var institucion = hospitalAsokam?.CodigoContactoPrincipal is int idPadre
                ? padres.GetValueOrDefault(idPadre)?.NombreContacto
                : null;

            var talleresVisita = tallerPorVisita.TryGetValue(visita.IdRutaVisita, out var listaTalleres)
                ? listaTalleres
                : [];
            var iteraciones = talleresVisita.Count > 0
                ? talleresVisita.Cast<Taller?>().ToList()
                : [null];

            foreach (var taller in iteraciones)
            {
                var recursoProducto = taller?.Recursos
                    .FirstOrDefault(r => r.TipoRecurso == TallerRecurso.RecursoProducto);
                string? producto = null;
                if (recursoProducto is not null)
                {
                    producto = int.TryParse(recursoProducto.IdProducto, out var idProducto)
                        && productos.TryGetValue(idProducto, out var nombreProducto)
                        ? nombreProducto
                        : recursoProducto.Descripcion ?? recursoProducto.IdProducto;
                }

                var tema = taller?.Tema
                    ?? (taller?.IdTemaTaller.HasValue == true
                        ? temas.GetValueOrDefault(taller.IdTemaTaller.Value)
                        : null);

                var idEjecutivo = visita.IdEjecutivo ?? taller?.IdEjecutivo;
                var idEspecialista = visita.IdEspecialista ?? taller?.IdEspecialista;
                var idTipoVisita = taller?.IdTipoVisita;
                var tipoVisita = idTipoVisita.HasValue
                    ? tiposVisita.GetValueOrDefault(idTipoVisita.Value)
                    : null;

                var conflictos = CalcularConflictos(
                    visita, fila.s, idEspecialista, maxDia, maxSemana,
                    visitasCapacidad, elegibilidad, nombreHospital);


            var costos = taller?.Recursos
                .Select(r => r.Subtotal
                    ?? (r.CostoUnitario.HasValue
                        ? r.CostoUnitario.Value * (r.Cantidad ?? 0)
                        : (decimal?)null))
                .Where(costo => costo.HasValue)
                .Select(costo => costo!.Value)
                .ToList() ?? [];
            var costo = costos.Count > 0 ? costos.Sum() : (decimal?)null;

            items.Add(new CalendarioItemDto
            {
                IdRutaVisita = visita.IdRutaVisita,
                IdRuta = visita.IdRuta,
                IdSeleccionMensual = fila.s.IdSeleccionMensual,
                IdTaller = taller?.IdTaller,
                TieneTalleres = talleresVisita.Count > 0,
                TalleresCount = talleresVisita.Count,
                IdSeleccionHospital = visita.IdSeleccionHospital,
                IdHospital = idHospital,
                Hospital = nombreHospital,
                Region = (hospital?.IdRegion.HasValue == true
                    ? regiones.GetValueOrDefault(hospital.IdRegion.Value)
                    : null) ?? hospital?.Region,
                Gerencia = tiposGerencia.GetValueOrDefault(fila.s.IdTipoGerencia ?? 0) ?? string.Empty,
                EstadoRuta = fila.r.Estado,
                Institucion = institucion,
                CiudadMunicipio = hospitalAsokam?.Ciudad,
                EntidadFederativa = hospitalAsokam?.CodigoEstado is { } codigoEstado
                    ? nombresEstados.GetValueOrDefault(codigoEstado, codigoEstado)
                    : (hospital?.EntidadFederativa is { } codigoSeleccion
                        ? nombresEstados.GetValueOrDefault(codigoSeleccion, codigoSeleccion)
                        : null),
                Fecha = visita.FechaVisita,
                Orden = visita.Orden,
                Hora = taller?.HoraTaller ?? visita.HoraSalida,
                IdEjecutivo = idEjecutivo,
                NombreEjecutivo = idEjecutivo.HasValue
                    ? usuarios.GetValueOrDefault(idEjecutivo.Value)
                    : null,
                IdEspecialista = idEspecialista,
                NombreEspecialista = idEspecialista.HasValue
                    ? usuarios.GetValueOrDefault(idEspecialista.Value)
                    : null,
                IdTipoVisita = idTipoVisita,
                TipoVisita = tipoVisita ?? "Sin tipo",
                Tema = tema ?? producto,
                Producto = producto,
                Cantidad = recursoProducto?.Cantidad,
                Costo = costo,
                Participantes = taller?.NumeroParticipantes,
                Estado = taller?.Estado ?? "SinTaller",
                EsExtraordinario = visita.EsExtraordinaria || taller?.EsExtraordinario == true,
                Bloqueado = taller is not null && taller.Estado != Taller.EstadoCreada,
                SolicitudCambioPendiente = taller is not null
                    && solicitudesPendientes.Contains(taller.IdTaller),
                Conflictos = conflictos,
            });
            }
        }

        if (!string.IsNullOrWhiteSpace(filtro.Estado))
        {
            items = items
                .Where(i => string.Equals(i.Estado, filtro.Estado, StringComparison.OrdinalIgnoreCase))
                .ToList();
        }

        if (!string.IsNullOrWhiteSpace(filtro.TipoVisita))
        {
            items = items
                .Where(i => string.Equals(i.TipoVisita, filtro.TipoVisita, StringComparison.OrdinalIgnoreCase))
                .ToList();
        }

        items.Sort((a, b) =>
        {
            var comparacion = a.Fecha.CompareTo(b.Fecha);
            if (comparacion != 0)
            {
                return comparacion;
            }

            comparacion = Nullable.Compare(a.Hora, b.Hora);
            if (comparacion != 0)
            {
                return comparacion;
            }

            comparacion = string.Compare(
                a.NombreEspecialista ?? string.Empty,
                b.NombreEspecialista ?? string.Empty,
                StringComparison.CurrentCultureIgnoreCase);
            return comparacion != 0
                ? comparacion
                : string.Compare(
                    a.Hospital ?? string.Empty,
                    b.Hospital ?? string.Empty,
                    StringComparison.CurrentCultureIgnoreCase);
        });

        return items;
    }

    public async Task<CalendarioItemDto?> GetItemAsync(
        int idRutaVisita,
        int idUsuario,
        bool verTodas,
        CancellationToken ct = default)
    {
        var fecha = await _context.RutasVisitas
            .AsNoTracking()
            .Where(v => v.IdRutaVisita == idRutaVisita
                && (verTodas || v.IdEjecutivo == idUsuario || v.IdEspecialista == idUsuario))
            .Select(v => (DateOnly?)v.FechaVisita)
            .FirstOrDefaultAsync(ct);
        if (!fecha.HasValue)
        {
            return null;
        }

        var items = await GetCalendarioAsync(
            new CalendarioFiltro { Desde = fecha.Value, Hasta = fecha.Value },
            idUsuario,
            verTodas,
            ct);
        return items.FirstOrDefault(i => i.IdRutaVisita == idRutaVisita);
    }

    public async Task<ActividadVisitaDto?> GetActividadVisitaAsync(
        int idRutaVisita,
        int idUsuario,
        bool verTodas,
        CancellationToken ct = default)
    {
        var visita = await _context.RutasVisitas.AsNoTracking()
            .FirstOrDefaultAsync(v => v.IdRutaVisita == idRutaVisita
                && (verTodas || v.IdEjecutivo == idUsuario || v.IdEspecialista == idUsuario), ct);

        if (visita is null)
        {
            return null;
        }

        var idHospital = visita.IdHospital
            ?? (visita.IdSeleccionHospital.HasValue
                ? await _context.SeleccionesHospitales.AsNoTracking()
                    .Where(h => h.IdSeleccionHospital == visita.IdSeleccionHospital.Value)
                    .Select(h => h.IdHospital)
                    .FirstOrDefaultAsync(ct)
                : null);
        var hospital = idHospital.HasValue
            ? await _asokamContext.Hospitales.AsNoTracking()
                .FirstOrDefaultAsync(h => h.CodigoContacto == idHospital.Value, ct)
            : null;

        var talleres = await _context.Talleres.AsNoTracking()
            .Where(t => t.IdRutaVisita == idRutaVisita && t.Activo)
            .OrderByDescending(t => t.FechaCreacion)
            .ThenByDescending(t => t.IdTaller)
            .ToListAsync(ct);
        var idsTalleres = talleres.Select(t => t.IdTaller).ToList();

        var historial = idsTalleres.Count == 0
            ? []
            : await _context.TalleresEstadosHistorial.AsNoTracking()
                .Where(h => idsTalleres.Contains(h.IdTaller))
                .OrderByDescending(h => h.Fecha)
                .ThenByDescending(h => h.IdHistorial)
                .ToListAsync(ct);

        var solicitudes = idsTalleres.Count == 0
            ? []
            : await _context.TalleresSolicitudesCambio.AsNoTracking()
                .Where(s => idsTalleres.Contains(s.IdTaller))
                .OrderByDescending(s => s.FechaCreacion)
                .ThenByDescending(s => s.IdSolicitud)
                .ToListAsync(ct);

        var ajustes = await _context.AjustesPostCierre.AsNoTracking()
            .Where(a =>
                (a.EntidadTipo == AjustePostCierre.EntidadTaller && idsTalleres.Contains(a.IdEntidad))
                || (a.EntidadTipo == AjustePostCierre.EntidadRutaVisita && a.IdEntidad == idRutaVisita))
            .OrderByDescending(a => a.FechaAjuste)
            .ThenByDescending(a => a.IdAjuste)
            .ToListAsync(ct);

        var recursos = idsTalleres.Count == 0
            ? []
            : await _context.TalleresRecursos.AsNoTracking()
                .Where(r => idsTalleres.Contains(r.IdTaller) && r.TipoRecurso == TallerRecurso.RecursoProducto)
                .ToListAsync(ct);
        var idsProducto = recursos
            .Select(r => int.TryParse(r.IdProducto, out var id) ? id : (int?)null)
            .Where(id => id.HasValue)
            .Select(id => id!.Value)
            .Distinct()
            .ToList();
        var productos = idsProducto.Count == 0
            ? new Dictionary<int, string>()
            : await _asokamContext.Productos.AsNoTracking()
                .Where(p => idsProducto.Contains(p.CodigoProducto))
                .ToDictionaryAsync(
                    p => p.CodigoProducto,
                    p => p.NombreInternoProducto ?? p.CodigoProducto.ToString(),
                    ct);

        var idsMatrizGeneral = talleres
            .Where(t => t.IdMatrizGeneral.HasValue)
            .Select(t => t.IdMatrizGeneral!.Value)
            .Distinct()
            .ToList();
        var matricesGenerales = idsMatrizGeneral.Count == 0
            ? new Dictionary<int, MatrizGeneral>()
            : await _context.MatricesGenerales.AsNoTracking()
                .Where(m => idsMatrizGeneral.Contains(m.IdMatrizGeneral))
                .ToDictionaryAsync(m => m.IdMatrizGeneral, ct);
        var idsPaso = matricesGenerales.Values
            .Where(m => m.IdPasoActual.HasValue)
            .Select(m => m.IdPasoActual!.Value)
            .Distinct()
            .ToList();
        var pasos = idsPaso.Count == 0
            ? new Dictionary<int, (bool EsInicio, int IdWorkflow, bool Activo)>()
            : await _context.WorkflowPasos.AsNoTracking()
                .Where(p => idsPaso.Contains(p.IdPaso))
                .ToDictionaryAsync(
                    p => p.IdPaso,
                    p => (EsInicio: p.EsInicio, IdWorkflow: p.IdWorkflow, Activo: p.Activo),
                    ct);

        bool CandadoPuesto(Taller taller)
        {
            if (!taller.IdMatrizGeneral.HasValue
                || !matricesGenerales.TryGetValue(taller.IdMatrizGeneral.Value, out var general))
            {
                return false;
            }

            return !general.IdWorkflow.HasValue
                || !general.IdPasoActual.HasValue
                || !pasos.TryGetValue(general.IdPasoActual.Value, out var paso)
                || !paso.Activo
                || paso.IdWorkflow != general.IdWorkflow.Value
                || !paso.EsInicio;
        }

        var solicitudPendientePorTaller = solicitudes
            .Where(s => s.Estado == TallerSolicitudCambio.EstadoPendiente)
            .GroupBy(s => s.IdTaller)
            .ToDictionary(g => g.Key, g => g.First().IdSolicitud);
        var productoPorTaller = recursos
            .GroupBy(r => r.IdTaller)
            .ToDictionary(g => g.Key, g => g.First());
        var candados = talleres.ToDictionary(t => t.IdTaller, CandadoPuesto);
        var candadoPuesto = candados.Values.Any(v => v);

        var idsUsuarios = new HashSet<int>();
        void AgregarUsuario(int? id)
        {
            if (id.HasValue)
            {
                idsUsuarios.Add(id.Value);
            }
        }

        AgregarUsuario(visita.IdEjecutivo);
        AgregarUsuario(visita.IdEspecialista);
        AgregarUsuario(visita.IdUsuarioCreacion);
        foreach (var taller in talleres)
        {
            AgregarUsuario(taller.IdEjecutivo);
            AgregarUsuario(taller.IdEspecialista);
            AgregarUsuario(taller.IdUsuarioCreacion);
        }

        foreach (var evento in historial)
        {
            AgregarUsuario(evento.IdUsuario);
        }

        foreach (var solicitud in solicitudes)
        {
            AgregarUsuario(solicitud.IdUsuarioCreacion);
            AgregarUsuario(solicitud.IdUsuarioModificacion);
        }

        foreach (var ajuste in ajustes)
        {
            AgregarUsuario(ajuste.IdUsuario);
        }

        var nombresUsuarios = idsUsuarios.Count == 0
            ? new Dictionary<int, string>()
            : await _asokamContext.Usuarios.AsNoTracking()
                .Where(u => idsUsuarios.Contains(u.IdUsuario))
                .ToDictionaryAsync(
                    u => u.IdUsuario,
                    u => u.NombreCompleto ?? $"Usuario {u.IdUsuario}",
                    ct);

        string? Nombre(int? id) =>
            id.HasValue ? nombresUsuarios.GetValueOrDefault(id.Value) : null;

        var eventos = new List<ActividadVisitaEventoDto>();
        eventos.Add(new ActividadVisitaEventoDto
        {
            Tipo = "VISITA_CREADA",
            Fecha = visita.FechaCreacion,
            Titulo = "Visita creada",
            Detalle = hospital?.NombreContacto ?? $"Hospital {idHospital}",
            Actor = Nombre(visita.IdUsuarioCreacion),
        });

        foreach (var taller in talleres)
        {
            var producto = productoPorTaller.GetValueOrDefault(taller.IdTaller);
            var nombreProducto = producto is not null
                && int.TryParse(producto.IdProducto, out var idProducto)
                ? productos.GetValueOrDefault(idProducto) ?? producto.Descripcion ?? producto.IdProducto
                : producto?.Descripcion;

            eventos.Add(new ActividadVisitaEventoDto
            {
                Tipo = "TALLER_CREADO",
                Fecha = taller.FechaCreacion,
                IdTaller = taller.IdTaller,
                Titulo = "Taller creado",
                Detalle = taller.Tema ?? nombreProducto ?? "Sin tema capturado",
                Actor = Nombre(taller.IdUsuarioCreacion),
            });
        }

        foreach (var cambio in historial)
        {
            eventos.Add(new ActividadVisitaEventoDto
            {
                Tipo = "TALLER_ESTADO",
                Fecha = cambio.Fecha,
                IdTaller = cambio.IdTaller,
                Titulo = "Cambio de estado",
                Detalle = $"{cambio.EstadoAnterior ?? "Sin estado"} → {cambio.EstadoNuevo}",
                Actor = Nombre(cambio.IdUsuario) ?? "Sistema",
                EstadoAnterior = cambio.EstadoAnterior,
                EstadoNuevo = cambio.EstadoNuevo,
                Motivo = cambio.Motivo,
            });
        }

        var jsonOptions = new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true,
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        };

        foreach (var solicitud in solicitudes)
        {
            ActividadSolicitudDatos? datos = null;
            if (!string.IsNullOrWhiteSpace(solicitud.DatosJson))
            {
                try
                {
                    datos = JsonSerializer.Deserialize<ActividadSolicitudDatos>(
                        solicitud.DatosJson, jsonOptions);
                }
                catch (JsonException)
                {
                    datos = null;
                }
            }

            var antes = datos?.Antes is null ? null : JsonSerializer.Serialize(datos.Antes, jsonOptions);
            var despues = datos?.Despues is null ? null : JsonSerializer.Serialize(datos.Despues, jsonOptions);
            var cambios = DescribirCambios(datos?.Antes, datos?.Despues);

            eventos.Add(new ActividadVisitaEventoDto
            {
                Tipo = "TALLER_SOLICITUD",
                Fecha = solicitud.FechaCreacion,
                IdTaller = solicitud.IdTaller,
                IdSolicitud = solicitud.IdSolicitud,
                Titulo = "Solicitud de cambio",
                Detalle = cambios,
                Actor = Nombre(solicitud.IdUsuarioCreacion),
                Antes = antes,
                Despues = despues,
                Motivo = datos?.MotivoSolicitante,
                EstadoNuevo = solicitud.Estado,
            });

            if (solicitud.Estado != TallerSolicitudCambio.EstadoPendiente)
            {
                eventos.Add(new ActividadVisitaEventoDto
                {
                    Tipo = "TALLER_SOLICITUD_RESUELTA",
                    Fecha = solicitud.FechaModificacion,
                    IdTaller = solicitud.IdTaller,
                    IdSolicitud = solicitud.IdSolicitud,
                    Titulo = solicitud.Estado == TallerSolicitudCambio.EstadoAprobada
                        ? "Solicitud aprobada"
                        : "Solicitud rechazada",
                    Detalle = datos?.Resolucion?.Motivo,
                    Actor = Nombre(solicitud.IdUsuarioModificacion ?? datos?.Resolucion?.IdUsuarioResolutor),
                    Antes = antes,
                    Despues = despues,
                    Motivo = datos?.Resolucion?.Motivo,
                    EstadoNuevo = solicitud.Estado,
                });
            }
        }

        foreach (var ajuste in ajustes)
        {
            eventos.Add(new ActividadVisitaEventoDto
            {
                Tipo = ajuste.EntidadTipo == AjustePostCierre.EntidadRutaVisita
                    ? "VISITA_AJUSTE"
                    : "TALLER_AJUSTE",
                Fecha = ajuste.FechaAjuste,
                IdTaller = ajuste.EntidadTipo == AjustePostCierre.EntidadTaller
                    ? ajuste.IdEntidad
                    : null,
                Titulo = TituloAjuste(ajuste.Accion),
                Detalle = ajuste.Motivo,
                Actor = Nombre(ajuste.IdUsuario),
                Antes = ajuste.ValoresAntes,
                Despues = ajuste.ValoresDespues,
                Motivo = ajuste.Motivo,
            });
        }

        return new ActividadVisitaDto
        {
            IdRutaVisita = visita.IdRutaVisita,
            IdRuta = visita.IdRuta,
            Hospital = hospital?.NombreContacto ?? $"Hospital {idHospital}",
            FechaVisita = visita.FechaVisita,
            IdEjecutivo = visita.IdEjecutivo,
            NombreEjecutivo = Nombre(visita.IdEjecutivo),
            IdEspecialista = visita.IdEspecialista,
            NombreEspecialista = Nombre(visita.IdEspecialista),
            CandadoPuesto = candadoPuesto,
            Talleres = talleres.Select(t =>
            {
                var producto = productoPorTaller.GetValueOrDefault(t.IdTaller);
                var nombreProducto = producto is not null
                    && int.TryParse(producto.IdProducto, out var idProducto)
                    ? productos.GetValueOrDefault(idProducto) ?? producto.Descripcion ?? producto.IdProducto
                    : producto?.Descripcion;

                return new ActividadVisitaTallerDto
                {
                    IdTaller = t.IdTaller,
                    Tema = t.Tema,
                    Producto = nombreProducto,
                    FechaTaller = t.FechaTaller,
                    HoraTaller = t.HoraTaller,
                    Estado = t.Estado,
                    FechaCreacion = t.FechaCreacion,
                    IdEjecutivo = t.IdEjecutivo,
                    NombreEjecutivo = Nombre(t.IdEjecutivo),
                    IdEspecialista = t.IdEspecialista,
                    NombreEspecialista = Nombre(t.IdEspecialista),
                    EsIntegranteEquipo = t.IdEjecutivo == idUsuario || t.IdEspecialista == idUsuario,
                    CandadoPuesto = candados.GetValueOrDefault(t.IdTaller),
                    IdSolicitudPendiente = solicitudPendientePorTaller.GetValueOrDefault(t.IdTaller),
                };
            }).ToList(),
            Eventos = eventos
                .OrderByDescending(e => e.Fecha)
                .ThenByDescending(e => e.Tipo)
                .ToList(),
        };
    }

    private static string? DescribirCambios(
        ActividadSolicitudDiff? antes,
        ActividadSolicitudDiff? despues)
    {
        if (despues is null)
        {
            return null;
        }

        var campos = new List<string>();
        if (despues.FechaVisita.HasValue && despues.FechaVisita != antes?.FechaVisita)
            campos.Add("fecha de visita");
        if (despues.FechaTaller.HasValue && despues.FechaTaller != antes?.FechaTaller)
            campos.Add("fecha del taller");
        if (despues.HoraTaller.HasValue && despues.HoraTaller != antes?.HoraTaller)
            campos.Add("hora");
        if (despues.Lugar is not null && despues.Lugar != antes?.Lugar)
            campos.Add("lugar");
        if (despues.NumeroParticipantes.HasValue
            && despues.NumeroParticipantes != antes?.NumeroParticipantes)
            campos.Add("participantes");
        if (despues.IdEjecutivo.HasValue && despues.IdEjecutivo != antes?.IdEjecutivo)
            campos.Add("ejecutivo");
        if (despues.IdEspecialista.HasValue && despues.IdEspecialista != antes?.IdEspecialista)
            campos.Add("especialista");

        return campos.Count == 0 ? null : $"Cambios: {string.Join(", ", campos)}";
    }

    private static string TituloAjuste(string accion) => accion switch
    {
        AjustePostCierre.AccionMoverVisita => "Movimiento de visita",
        AjustePostCierre.AccionEditarHoras => "Cambio de horario",
        AjustePostCierre.AccionEditarEjecutivo => "Cambio de ejecutivo",
        AjustePostCierre.AccionAltaVisita => "Alta de visita",
        AjustePostCierre.AccionBajaVisita => "Baja de visita",
        AjustePostCierre.AccionEditarTaller => "Ajuste de taller",
        _ => "Ajuste",
    };

    private sealed class ActividadSolicitudDatos
    {
        public ActividadSolicitudDiff? Antes { get; set; }
        public ActividadSolicitudDiff? Despues { get; set; }
        public string? MotivoSolicitante { get; set; }
        public int? IdSolicitante { get; set; }
        public ActividadSolicitudResolucion? Resolucion { get; set; }
    }

    private sealed class ActividadSolicitudDiff
    {
        public DateOnly? FechaVisita { get; set; }
        public DateOnly? FechaTaller { get; set; }
        public TimeOnly? HoraTaller { get; set; }
        public string? Lugar { get; set; }
        public int? NumeroParticipantes { get; set; }
        public int? IdEjecutivo { get; set; }
        public int? IdEspecialista { get; set; }
    }

    private sealed class ActividadSolicitudResolucion
    {
        public bool Aprobada { get; set; }
        public string? Motivo { get; set; }
        public int? IdUsuarioResolutor { get; set; }
        public DateTime Fecha { get; set; }
    }

    private async Task<(DateOnly Inicio, DateOnly Fin)> ResolverRangoAsync(
        CalendarioFiltro filtro,
        CancellationToken ct)
    {
        DateOnly? inicio = filtro.Desde;
        DateOnly? fin = filtro.Hasta;

        if (filtro.IdSeleccion.HasValue)
        {
            var seleccion = await _context.SeleccionesMensuales
                .AsNoTracking()
                .Where(s => s.IdSeleccionMensual == filtro.IdSeleccion.Value)
                .Select(s => new { s.FechaInicioVigencia, s.FechaFinVigencia })
                .FirstOrDefaultAsync(ct);
            if (seleccion is not null)
            {
                inicio ??= seleccion.FechaInicioVigencia;
                fin ??= seleccion.FechaFinVigencia;
            }
        }

        if (!inicio.HasValue && !fin.HasValue)
        {
            var hoy = DateOnly.FromDateTime(DateTime.Today);
            inicio = new DateOnly(hoy.Year, hoy.Month, 1);
            fin = inicio.Value.AddMonths(1).AddDays(-1);
        }
        else
        {
            inicio ??= fin!.Value.AddDays(-30);
            fin ??= inicio.Value.AddDays(45);
        }

        if (inicio > fin)
        {
            throw new InvalidOperationException("El rango de fechas es inválido.");
        }

        if (fin.Value.DayNumber - inicio.Value.DayNumber > 45)
        {
            fin = inicio.Value.AddDays(45);
        }

        return (inicio.Value, fin.Value);
    }

    private async Task<(int MaxDia, int MaxSemana)> LeerCapacidadesAsync(CancellationToken ct)
    {
        var claves = new[] { "max_visitas_dia", "max_visitas_semana" };
        var valores = await _context.ParametrosModulo
            .AsNoTracking()
            .Where(p => claves.Contains(p.Clave))
            .ToDictionaryAsync(p => p.Clave, p => (int)p.Valor, ct);

        return (
            valores.GetValueOrDefault("max_visitas_dia", 3),
            valores.GetValueOrDefault("max_visitas_semana", 8));
    }

    private async Task<List<VisitaCapacidad>> LeerVisitasCapacidadAsync(
        List<int> idsEspecialista,
        DateOnly inicio,
        DateOnly fin,
        CancellationToken ct)
    {
        if (idsEspecialista.Count == 0)
        {
            return [];
        }

        var filas = await (
            from v in _context.RutasVisitas.AsNoTracking()
            join r in _context.Rutas.AsNoTracking() on v.IdRuta equals r.IdRuta
            where v.IdEspecialista.HasValue
                && idsEspecialista.Contains(v.IdEspecialista.Value)
                && r.Estado != Ruta.EstadoArchivada
                && r.Estado != Ruta.EstadoCancelada
                && r.Estado != Ruta.EstadoRechazada
                && v.FechaVisita >= inicio.AddDays(-7)
                && v.FechaVisita <= fin.AddDays(7)
            select new
            {
                v.IdRutaVisita,
                v.IdEspecialista,
                v.FechaVisita,
                v.HoraSalida,
            })
            .ToListAsync(ct);

        return filas
            .Select(v => new VisitaCapacidad(
                v.IdRutaVisita,
                v.IdEspecialista,
                v.FechaVisita,
                v.HoraSalida))
            .ToList();
    }

    private async Task<Dictionary<int, HashSet<int>>> LeerElegibilidadAsync(
        List<int> idsEspecialista,
        CancellationToken ct)
    {
        if (idsEspecialista.Count == 0)
        {
            return [];
        }

        var filas = await _context.EspecialistasGerencia
            .AsNoTracking()
            .Where(e => e.Activo && idsEspecialista.Contains(e.IdUsuario))
            .Select(e => new { e.IdUsuario, e.IdTipoGerencia })
            .ToListAsync(ct);

        return filas
            .GroupBy(e => e.IdUsuario)
            .ToDictionary(
                g => g.Key,
                g => g.Select(e => e.IdTipoGerencia).ToHashSet());
    }

    private static List<string> CalcularConflictos(
        RutaVisita visita,
        SeleccionMensual seleccion,
        int? idEspecialista,
        int maxDia,
        int maxSemana,
        List<VisitaCapacidad> visitasCapacidad,
        Dictionary<int, HashSet<int>> elegibilidad,
        string? nombreHospital)
    {
        var conflictos = new List<string>();

        if (nombreHospital is null)
        {
            conflictos.Add("Hospital sin datos en Asokam");
        }

        if (!idEspecialista.HasValue)
        {
            conflictos.Add("Hospital sin especialista");
            return conflictos.Distinct().ToList();
        }

        var propias = visitasCapacidad
            .Where(v => v.IdEspecialista == idEspecialista.Value)
            .ToList();
        var cargaDia = propias.Count(v => v.Fecha == visita.FechaVisita);
        var inicioSemana = InicioSemana(visita.FechaVisita);
        var cargaSemana = propias.Count(v => InicioSemana(v.Fecha) == inicioSemana);

        if (cargaDia > maxDia)
        {
            conflictos.Add($"Capacidad diaria excedida ({cargaDia}/{maxDia})");
        }

        if (cargaSemana > maxSemana)
        {
            conflictos.Add($"Capacidad semanal excedida ({cargaSemana}/{maxSemana})");
        }

        if (visita.HoraSalida.HasValue
            && propias.Any(v => v.IdRutaVisita != visita.IdRutaVisita
                && v.Fecha == visita.FechaVisita
                && v.Hora == visita.HoraSalida))
        {
            conflictos.Add("Choque de horario con otra visita");
        }

        if (seleccion.IdTipoGerencia.HasValue
            && elegibilidad.TryGetValue(idEspecialista.Value, out var gerencias)
            && !gerencias.Contains(seleccion.IdTipoGerencia.Value))
        {
            conflictos.Add("Especialista no elegible para la gerencia");
        }

        return conflictos.Distinct().ToList();
    }

    private static DateOnly InicioSemana(DateOnly fecha)
    {
        var offset = ((int)fecha.DayOfWeek + 6) % 7;
        return fecha.AddDays(-offset);
    }

    private sealed record VisitaCapacidad(
        int IdRutaVisita,
        int? IdEspecialista,
        DateOnly Fecha,
        TimeOnly? Hora);
}
