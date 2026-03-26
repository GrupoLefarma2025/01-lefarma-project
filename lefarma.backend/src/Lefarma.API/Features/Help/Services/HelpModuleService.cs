using ErrorOr;
using Lefarma.API.Domain.Entities.Help;
using Lefarma.API.Domain.Interfaces;
using Lefarma.API.Features.Help.DTOs;
using Lefarma.API.Shared.Errors;
using Microsoft.Extensions.Logging;

namespace Lefarma.API.Features.Help.Services;

public interface IHelpModuleService
{
    Task<ErrorOr<IEnumerable<HelpModuleDto>>> GetAllAsync(CancellationToken ct);
    Task<ErrorOr<HelpModuleDto>> GetByIdAsync(int id, CancellationToken ct);
    Task<ErrorOr<HelpModuleDto>> CreateAsync(CreateHelpModuleRequest request, CancellationToken ct);
    Task<ErrorOr<HelpModuleDto>> UpdateAsync(UpdateHelpModuleRequest request, CancellationToken ct);
    Task<ErrorOr<Success>> DeleteAsync(int id, CancellationToken ct);
}

public class HelpModuleService : IHelpModuleService
{
    private readonly IHelpModuleRepository _repository;
    private readonly ILogger<HelpModuleService> _logger;

    public HelpModuleService(
        IHelpModuleRepository repository,
        ILogger<HelpModuleService> logger)
    {
        _repository = repository ?? throw new ArgumentNullException(nameof(repository));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    public async Task<ErrorOr<IEnumerable<HelpModuleDto>>> GetAllAsync(CancellationToken ct)
    {
        try
        {
            _logger.LogDebug("Obteniendo todos los módulos de ayuda");
            var modules = await _repository.GetAllAsync(ct);
            var dtos = modules.Select(MapToDto).ToList();
            _logger.LogInformation("Se obtuvieron {Count} módulos de ayuda", dtos.Count);
            return dtos;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener módulos de ayuda");
            return CommonErrors.DatabaseError("obtener los módulos de ayuda");
        }
    }

    public async Task<ErrorOr<HelpModuleDto>> GetByIdAsync(int id, CancellationToken ct)
    {
        try
        {
            _logger.LogDebug("Obteniendo módulo de ayuda por ID: {Id}", id);
            var module = await _repository.GetByIdAsync(id, ct);

            if (module == null)
            {
                _logger.LogWarning("Módulo de ayuda con ID {Id} no encontrado", id);
                return Errors.HelpArticle.NotFound;
            }

            return MapToDto(module);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener módulo de ayuda por ID: {Id}", id);
            return CommonErrors.DatabaseError("obtener el módulo de ayuda");
        }
    }

    public async Task<ErrorOr<HelpModuleDto>> CreateAsync(CreateHelpModuleRequest request, CancellationToken ct)
    {
        try
        {
            _logger.LogDebug("Creando nuevo módulo de ayuda: {Nombre}", request.Nombre);

            var existing = await _repository.GetByNombreAsync(request.Nombre, ct);
            if (existing != null)
            {
                _logger.LogWarning("Ya existe un módulo con el nombre: {Nombre}", request.Nombre);
                return Error.Conflict("HelpModule.Duplicate", $"Ya existe un módulo con el nombre '{request.Nombre}'");
            }

            var module = new HelpModule
            {
                Nombre = request.Nombre.Trim(),
                Label = request.Label.Trim(),
                Orden = request.Orden,
                Activo = true
            };

            var result = await _repository.CreateAsync(module, ct);
            _logger.LogInformation("Módulo de ayuda creado exitosamente: {Id} - {Nombre}", result.Id, result.Nombre);
            return MapToDto(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al crear módulo de ayuda: {Nombre}", request.Nombre);
            return CommonErrors.DatabaseError("crear el módulo de ayuda");
        }
    }

    public async Task<ErrorOr<HelpModuleDto>> UpdateAsync(UpdateHelpModuleRequest request, CancellationToken ct)
    {
        try
        {
            _logger.LogDebug("Actualizando módulo de ayuda: {Id}", request.Id);

            var module = await _repository.GetByIdAsync(request.Id, ct);
            if (module == null)
            {
                _logger.LogWarning("Módulo de ayuda con ID {Id} no encontrado", request.Id);
                return Errors.HelpArticle.NotFound;
            }

            var existingWithNombre = await _repository.GetByNombreAsync(request.Nombre, ct);
            if (existingWithNombre != null && existingWithNombre.Id != request.Id)
            {
                _logger.LogWarning("Ya existe otro módulo con el nombre: {Nombre}", request.Nombre);
                return Error.Conflict("HelpModule.Duplicate", $"Ya existe un módulo con el nombre '{request.Nombre}'");
            }

            module.Nombre = request.Nombre.Trim();
            module.Label = request.Label.Trim();
            module.Orden = request.Orden;
            module.Activo = request.Activo;

            var result = await _repository.UpdateAsync(module, ct);
            _logger.LogInformation("Módulo de ayuda actualizado exitosamente: {Id} - {Nombre}", result.Id, result.Nombre);
            return MapToDto(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al actualizar módulo de ayuda: {Id}", request.Id);
            return CommonErrors.DatabaseError("actualizar el módulo de ayuda");
        }
    }

    public async Task<ErrorOr<Success>> DeleteAsync(int id, CancellationToken ct)
    {
        try
        {
            _logger.LogDebug("Eliminando módulo de ayuda: {Id}", id);

            var module = await _repository.GetByIdAsync(id, ct);
            if (module == null)
            {
                _logger.LogWarning("Módulo de ayuda con ID {Id} no encontrado", id);
                return Errors.HelpArticle.NotFound;
            }

            await _repository.DeleteAsync(id, ct);
            _logger.LogInformation("Módulo de ayuda eliminado exitosamente: {Id} - {Nombre}", id, module.Nombre);
            return Result.Success;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al eliminar módulo de ayuda: {Id}", id);
            return CommonErrors.DatabaseError("eliminar el módulo de ayuda");
        }
    }

    private static HelpModuleDto MapToDto(HelpModule module)
    {
        return new HelpModuleDto
        {
            Id = module.Id,
            Nombre = module.Nombre,
            Label = module.Label,
            Orden = module.Orden,
            Activo = module.Activo,
            FechaCreacion = module.FechaCreacion,
            FechaActualizacion = module.FechaActualizacion
        };
    }
}
