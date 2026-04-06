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
    Task<ErrorOr<MigrateArticlesResult>> MigrateExistingModulesAsync(CancellationToken ct);
}

public class MigrateArticlesResult
{
    public int ModulesProcessed { get; set; }
    public int ArticlesCreated { get; set; }
    public List<string> Details { get; set; } = [];
}

public class HelpModuleService : IHelpModuleService
{
    private readonly IHelpModuleRepository _repository;
    private readonly IHelpArticleRepository _articleRepository;
    private readonly ILogger<HelpModuleService> _logger;

    public HelpModuleService(
        IHelpModuleRepository repository,
        IHelpArticleRepository articleRepository,
        ILogger<HelpModuleService> logger)
    {
        _repository = repository ?? throw new ArgumentNullException(nameof(repository));
        _articleRepository = articleRepository ?? throw new ArgumentNullException(nameof(articleRepository));
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

            var emptyContent = string.Empty;
            var now = DateTime.UtcNow;

            var usuarioArticle = new HelpArticle
            {
                Titulo = $"{request.Label} - Usuario",
                Contenido = emptyContent,
                Modulo = request.Nombre.Trim(),
                Tipo = "usuario",
                Orden = 0,
                Activo = true,
                FechaCreacion = now,
                FechaActualizacion = now
            };

            var desarrolladorArticle = new HelpArticle
            {
                Titulo = $"{request.Label} - Desarrollo",
                Contenido = emptyContent,
                Modulo = request.Nombre.Trim(),
                Tipo = "desarrollador",
                Orden = 0,
                Activo = true,
                FechaCreacion = now,
                FechaActualizacion = now
            };

            await _articleRepository.CreateAsync(usuarioArticle, ct);
            await _articleRepository.CreateAsync(desarrolladorArticle, ct);
            _logger.LogInformation("Artículos automáticos creados para módulo: {Nombre}", request.Nombre);

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

    public async Task<ErrorOr<MigrateArticlesResult>> MigrateExistingModulesAsync(CancellationToken ct)
    {
        try
        {
            _logger.LogDebug("Iniciando migración de artículos para módulos existentes");

            var result = new MigrateArticlesResult();
            var modules = await _repository.GetAllAsync(ct);

            foreach (var module in modules)
            {
                result.ModulesProcessed++;
                var existingArticles = await _articleRepository.GetByModuleAsync(module.Nombre, ct);
                var existingTypes = existingArticles.Select(a => a.Tipo).ToHashSet();

                var now = DateTime.UtcNow;

                if (!existingTypes.Contains("usuario"))
                {
                    var usuarioArticle = new HelpArticle
                    {
                        Titulo = $"{module.Label} - Usuario",
                        Contenido = string.Empty,
                        Modulo = module.Nombre,
                        Tipo = "usuario",
                        Orden = 0,
                        Activo = true,
                        FechaCreacion = now,
                        FechaActualizacion = now
                    };

                    await _articleRepository.CreateAsync(usuarioArticle, ct);
                    result.ArticlesCreated++;
                    result.Details.Add($"Creado artículo 'usuario' para módulo '{module.Label}'");
                    _logger.LogInformation("Artículo 'usuario' creado para módulo: {Nombre}", module.Nombre);
                }

                if (!existingTypes.Contains("desarrollador"))
                {
                    var desarrolladorArticle = new HelpArticle
                    {
                        Titulo = $"{module.Label} - Desarrollo",
                        Contenido = string.Empty,
                        Modulo = module.Nombre,
                        Tipo = "desarrollador",
                        Orden = 0,
                        Activo = true,
                        FechaCreacion = now,
                        FechaActualizacion = now
                    };

                    await _articleRepository.CreateAsync(desarrolladorArticle, ct);
                    result.ArticlesCreated++;
                    result.Details.Add($"Creado artículo 'desarrollador' para módulo '{module.Label}'");
                    _logger.LogInformation("Artículo 'desarrollador' creado para módulo: {Nombre}", module.Nombre);
                }
            }

            _logger.LogInformation(
                "Migración completada. Módulos procesados: {Modules}, Artículos creados: {Articles}",
                result.ModulesProcessed,
                result.ArticlesCreated);

            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al migrar artículos para módulos existentes");
            return CommonErrors.DatabaseError("migrar los artículos de ayuda");
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
