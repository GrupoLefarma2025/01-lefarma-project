using Lefarma.API.Domain.Entities.EducacionMedica;
using Lefarma.API.Domain.Interfaces.EducacionMedica;
using Lefarma.API.Features.EducacionMedica.DTOs;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Shared.Extensions;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Features.EducacionMedica;

public class SeleccionEjecutivoService : ISeleccionEjecutivoService
{
    private readonly ISeleccionMensualRepository _repository;
    private readonly ApplicationDbContext _context;
    private readonly AsokamDbContext _asokamContext;
    private readonly IEjecutivoElegibilidadService _elegibilidad;

    public SeleccionEjecutivoService(
        ISeleccionMensualRepository repository,
        ApplicationDbContext context,
        AsokamDbContext asokamContext,
        IEjecutivoElegibilidadService elegibilidad)
    {
        _repository = repository;
        _context = context;
        _asokamContext = asokamContext;
        _elegibilidad = elegibilidad;
    }

    public async Task<SeleccionRegionDto?> AsignarEjecutivoAsync(
        int idSeleccionMensual,
        int idRegion,
        AsignarEjecutivoRegionRequest request,
        int idUsuario,
        CancellationToken ct = default)
    {
        var seleccion = await _repository.GetByIdAsync(idSeleccionMensual, ct);
        if (seleccion is null)
        {
            return null;
        }

        if (seleccion.Estado != SeleccionMensual.EstadoCreada)
        {
            throw new InvalidOperationException(
                $"La selección está {seleccion.Estado}; solo se puede editar en estado Creada.");
        }

        var region = await _repository.GetRegionByIdAsync(idRegion, ct);
        if (region is null || region.IdSeleccionMensual != idSeleccionMensual)
        {
            throw new InvalidOperationException($"La región {idRegion} no pertenece a la selección {idSeleccionMensual}.");
        }

        await ValidarEjecutivoAsync(request.IdEjecutivo, region, seleccion, ct);

        if (request.IdEspecialista.HasValue)
        {
            await ValidarEspecialistaAsync(request.IdEspecialista.Value, seleccion, ct);
        }

        region.IdEjecutivo = request.IdEjecutivo;
        region.IdEspecialista = request.IdEspecialista;
        region.IdUsuarioModificacion = idUsuario;
        await _repository.UpdateRegionAsync(region, ct);

        var idsUsuarios = new[] { request.IdEjecutivo, request.IdEspecialista }
            .Where(id => id.HasValue)
            .Select(id => id!.Value)
            .Distinct()
            .ToList();
        var nombres = await _asokamContext.Usuarios
            .AsNoTracking()
            .Where(u => idsUsuarios.Contains(u.IdUsuario))
            .ToDictionaryAsync(u => u.IdUsuario, u => u.NombreCompleto ?? string.Empty, ct);

        return region.ToResponse([], nombres);
    }

    public async Task<SeleccionHospitalDto?> AsignarEjecutivoHospitalAsync(
        int idSeleccionMensual,
        int idSeleccionHospital,
        AsignarEjecutivoHospitalRequest request,
        int idUsuario,
        CancellationToken ct = default)
    {
        var seleccion = await _repository.GetByIdAsync(idSeleccionMensual, ct);
        if (seleccion is null)
        {
            return null;
        }

        if (seleccion.Estado != SeleccionMensual.EstadoCreada)
        {
            throw new InvalidOperationException(
                $"La selección está {seleccion.Estado}; solo se puede editar en estado Creada.");
        }

        var hospital = await _repository.GetHospitalByIdAsync(idSeleccionHospital, ct);
        if (hospital is null || hospital.IdSeleccionMensual != idSeleccionMensual)
        {
            throw new InvalidOperationException(
                $"El hospital {idSeleccionHospital} no pertenece a la selección {idSeleccionMensual}.");
        }

        if (request.IdEjecutivo.HasValue)
        {
            if (!hospital.IdRegion.HasValue)
            {
                throw new InvalidOperationException(
                    "El hospital no tiene región asignada; no se puede validar el ejecutivo override.");
            }

            var region = await _repository.GetRegionByIdAsync(hospital.IdRegion.Value, ct)
                ?? throw new InvalidOperationException(
                    $"La región {hospital.IdRegion} del hospital no existe.");

            await ValidarEjecutivoAsync(request.IdEjecutivo.Value, region, seleccion, ct);
        }

        hospital.IdEjecutivo = request.IdEjecutivo;
        hospital.IdUsuarioModificacion = idUsuario;
        hospital.FechaModificacion = DateTime.UtcNow;
        await _repository.SaveChangesAsync(ct);

        var regionHospital = hospital.IdRegion.HasValue
            ? await _repository.GetRegionByIdAsync(hospital.IdRegion.Value, ct)
            : null;
        var nombreEjecutivo = request.IdEjecutivo.HasValue
            ? await _asokamContext.Usuarios.AsNoTracking()
                .Where(u => u.IdUsuario == request.IdEjecutivo.Value)
                .Select(u => u.NombreCompleto)
                .FirstOrDefaultAsync(ct)
            : null;

        return new SeleccionHospitalDto
        {
            IdSeleccionHospital = hospital.IdSeleccionHospital,
            IdHospital = hospital.IdHospital,
            Region = hospital.Region,
            EntidadFederativa = hospital.EntidadFederativa,
            CiudadMunicipio = hospital.CiudadMunicipio,
            ProductoAPromocionar = hospital.ProductoAPromocionar,
            Observaciones = hospital.Observaciones,
            LatitudSnapshot = hospital.LatitudSnapshot,
            LongitudSnapshot = hospital.LongitudSnapshot,
            IdRegion = hospital.IdRegion,
            NombreRegion = regionHospital?.Nombre,
            IdEjecutivo = hospital.IdEjecutivo,
            NombreEjecutivo = nombreEjecutivo,
            IdEspecialista = hospital.IdEspecialista,
        };
    }

    private async Task ValidarEjecutivoAsync(
        int idEjecutivo,
        SeleccionRegion region,
        SeleccionMensual seleccion,
        CancellationToken ct)
    {
        var existe = await _asokamContext.Usuarios
            .AsNoTracking()
            .AnyAsync(u => u.IdUsuario == idEjecutivo, ct);
        if (!existe)
        {
            throw new InvalidOperationException($"El ejecutivo {idEjecutivo} no existe en Asokam.");
        }

        var esPrimario = await _elegibilidad.EsEjecutivoPrimarioAsync(
            idEjecutivo, region.IdRegionCatalogo, seleccion.IdTipoGerencia, ct);
        var esSuplente = !esPrimario && await _elegibilidad.EsEjecutivoSuplenteAsync(
            idEjecutivo, region.IdRegionCatalogo, seleccion.IdTipoGerencia, ct);

        if (!esPrimario && !esSuplente)
        {
            throw new InvalidOperationException(
                "El ejecutivo no tiene una región activa compatible ni cobertura como suplente para la región/gerencia de la selección. Configúralo en Colaboradores.");
        }
    }

    private async Task ValidarEspecialistaAsync(
        int idEspecialista,
        SeleccionMensual seleccion,
        CancellationToken ct)
    {
        var existe = await _asokamContext.Usuarios
            .AsNoTracking()
            .AnyAsync(u => u.IdUsuario == idEspecialista, ct);
        if (!existe)
        {
            throw new InvalidOperationException($"El especialista {idEspecialista} no existe en Asokam.");
        }

        var query = _context.EspecialistasGerencia
            .AsNoTracking()
            .Where(e => e.Activo && e.IdUsuario == idEspecialista);

        if (seleccion.IdTipoGerencia.HasValue)
        {
            query = query.Where(e => e.IdTipoGerencia == seleccion.IdTipoGerencia.Value);
        }

        if (!await query.AnyAsync(ct))
        {
            throw new InvalidOperationException(
                "El especialista no es elegible para la gerencia de la selección. Configúralo en Colaboradores.");
        }
    }
}
