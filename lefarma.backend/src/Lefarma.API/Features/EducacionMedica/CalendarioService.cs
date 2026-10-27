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

        if (filtro.IdSeleccion.HasValue)
        {
            query = query.Where(x => x.s.IdSeleccionMensual == filtro.IdSeleccion.Value);
        }

        if (filtro.IdGerencia.HasValue)
        {
            query = query.Where(x => x.s.IdTipoGerencia == filtro.IdGerencia.Value);
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
            .Where(t => t.IdRutaVisita.HasValue && idsVisitas.Contains(t.IdRutaVisita.Value))
            .ToListAsync(ct);
        var tallerPorVisita = talleres
            .GroupBy(t => t.IdRutaVisita!.Value)
            .ToDictionary(g => g.Key, g => g.OrderByDescending(t => t.IdTaller).First());

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
            var taller = tallerPorVisita.GetValueOrDefault(visita.IdRutaVisita);
            var idHospital = visita.IdHospital ?? hospital?.IdHospital;
            var hospitalAsokam = idHospital.HasValue
                ? hospitalesAsokam.GetValueOrDefault(idHospital.Value)
                : null;
            var nombreHospital = hospitalAsokam?.NombreContacto
                ?? (idHospital.HasValue ? $"Hospital {idHospital}" : null);
            var institucion = hospitalAsokam?.CodigoContactoPrincipal is int idPadre
                ? padres.GetValueOrDefault(idPadre)?.NombreContacto
                : null;

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

            var tema = taller?.IdTemaTaller.HasValue == true
                ? temas.GetValueOrDefault(taller.IdTemaTaller.Value)
                : null;

            var idEjecutivo = visita.IdEjecutivo ?? taller?.IdEjecutivo;
            var idEspecialista = visita.IdEspecialista ?? taller?.IdEspecialista;
            var tipoVisita = visita.IdTipoVisita.HasValue
                ? tiposVisita.GetValueOrDefault(visita.IdTipoVisita.Value)
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
                Fecha = visita.FechaVisita,
                Orden = visita.Orden,
                Hora = visita.HoraSalida ?? taller?.HoraTaller,
                IdEjecutivo = idEjecutivo,
                NombreEjecutivo = idEjecutivo.HasValue
                    ? usuarios.GetValueOrDefault(idEjecutivo.Value)
                    : null,
                IdEspecialista = idEspecialista,
                NombreEspecialista = idEspecialista.HasValue
                    ? usuarios.GetValueOrDefault(idEspecialista.Value)
                    : null,
                TipoVisita = tipoVisita ?? "Taller",
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

    public async Task<CalendarioItemDto?> GetItemAsync(int idRutaVisita, CancellationToken ct = default)
    {
        var fecha = await _context.RutasVisitas
            .AsNoTracking()
            .Where(v => v.IdRutaVisita == idRutaVisita)
            .Select(v => (DateOnly?)v.FechaVisita)
            .FirstOrDefaultAsync(ct);
        if (!fecha.HasValue)
        {
            return null;
        }

        var items = await GetCalendarioAsync(
            new CalendarioFiltro { Desde = fecha.Value, Hasta = fecha.Value },
            ct);
        return items.FirstOrDefault(i => i.IdRutaVisita == idRutaVisita);
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

        var filas = await _context.RutasVisitas
            .AsNoTracking()
            .Where(v => v.IdEspecialista.HasValue
                && idsEspecialista.Contains(v.IdEspecialista.Value)
                && v.FechaVisita >= inicio.AddDays(-7)
                && v.FechaVisita <= fin.AddDays(7))
            .Select(v => new
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
