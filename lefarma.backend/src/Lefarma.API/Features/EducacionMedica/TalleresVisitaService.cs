using Lefarma.API.Domain.Entities.EducacionMedica;
using Lefarma.API.Features.EducacionMedica.DTOs;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Services.Identity;
using Lefarma.API.Shared.Constants;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Features.EducacionMedica;

public class TalleresVisitaService : ITalleresVisitaService
{
    private readonly ApplicationDbContext _context;
    private readonly ITalleresService _talleres;
    private readonly IRutasService _rutas;
    private readonly UserPermissionService _permissionService;

    public TalleresVisitaService(
        ApplicationDbContext context,
        ITalleresService talleres,
        IRutasService rutas,
        UserPermissionService permissionService)
    {
        _context = context;
        _talleres = talleres;
        _rutas = rutas;
        _permissionService = permissionService;
    }

    public async Task<TallerDto> CrearAsync(
        CrearTallerRequest request,
        int idUsuario,
        CancellationToken ct = default)
    {
        if (!request.IdRutaVisita.HasValue || !request.FechaTaller.HasValue)
        {
            return await _talleres.CrearAsync(request, idUsuario, ct);
        }

        var visita = await _context.RutasVisitas
            .AsNoTracking()
            .FirstOrDefaultAsync(v => v.IdRutaVisita == request.IdRutaVisita.Value, ct)
            ?? throw new InvalidOperationException($"La visita {request.IdRutaVisita} no existe.");

        if (visita.FechaVisita == request.FechaTaller.Value)
        {
            return await _talleres.CrearAsync(request, idUsuario, ct);
        }

        var ruta = await _context.Rutas
            .AsNoTracking()
            .FirstOrDefaultAsync(r => r.IdRuta == visita.IdRuta, ct)
            ?? throw new InvalidOperationException($"La ruta {visita.IdRuta} no existe.");

        if (ruta.Estado is Ruta.EstadoArchivada or Ruta.EstadoCancelada or Ruta.EstadoRechazada)
        {
            throw new InvalidOperationException(
                $"La ruta está {ruta.Estado}; no se puede crear una visita para el taller.");
        }

        if (!visita.IdSeleccionHospital.HasValue)
        {
            throw new InvalidOperationException(
                "La visita no tiene hospital de la selección; no se puede crear otra visita para el taller.");
        }

        var permisos = await _permissionService.GetPermissionsAsync(idUsuario);
        if (!permisos.Contains(Permissions.EducacionMedica.RutasGestionar))
        {
            throw new InvalidOperationException(
                "No tienes permiso para agregar visitas a la ruta (educacion_medica.rutas.puede_gestionar).");
        }

        if (ruta.Estado == Ruta.EstadoCerrada)
        {
            if (!permisos.Contains(Permissions.EducacionMedica.RutasAjustar))
            {
                throw new InvalidOperationException(
                    "No tienes permiso para ajustar rutas cerradas (educacion_medica.rutas.puede_ajustar).");
            }

            if (string.IsNullOrWhiteSpace(request.MotivoAjuste))
            {
                throw new InvalidOperationException(
                    "El motivo del ajuste es obligatorio para crear una visita en una ruta cerrada.");
            }
        }

        var idTipoVisita = request.IdTipoVisita ?? visita.IdTipoVisita;
        if (idTipoVisita.HasValue)
        {
            var tipoValido = await _context.TiposVisita
                .AsNoTracking()
                .AnyAsync(t => t.IdTipoVisita == idTipoVisita.Value && t.Activo, ct);
            if (!tipoValido)
            {
                throw new InvalidOperationException("El tipo de visita seleccionado no existe o está inactivo.");
            }
        }

        var orden = (await _context.RutasVisitas
            .AsNoTracking()
            .Where(v => v.IdRuta == ruta.IdRuta && v.FechaVisita == request.FechaTaller.Value)
            .MaxAsync(v => (int?)v.Orden, ct) ?? 0) + 1;

        await using var tx = await _context.Database.BeginTransactionAsync(ct);

        var nuevaVisita = await _rutas.AgregarVisitaAsync(
            ruta.IdRuta,
            new AgregarVisitaRequest
            {
                IdSeleccionHospital = visita.IdSeleccionHospital.Value,
                IdTipoVisita = idTipoVisita,
                FechaVisita = request.FechaTaller.Value,
                Orden = orden,
                Motivo = request.MotivoAjuste,
            },
            idUsuario,
            ct);

        request.IdRutaVisita = nuevaVisita.IdRutaVisita;
        request.IdSeleccionHospital = nuevaVisita.IdSeleccionHospital;

        var taller = await _talleres.CrearAsync(request, idUsuario, ct);
        await tx.CommitAsync(ct);
        return taller;
    }
}
