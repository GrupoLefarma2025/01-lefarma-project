using ErrorOr;
using Lefarma.API.Domain.Entities.Help;
using Lefarma.API.Domain.Interfaces;
using Lefarma.API.Features.Help.DTOs;
using Lefarma.API.Shared.Errors;
using Microsoft.Extensions.Logging;

namespace Lefarma.API.Features.Help.Services;

/// <summary>
/// Servicio de artículos de ayuda
/// </summary>
public class HelpArticleService : IHelpArticleService
{
    private readonly IHelpArticleRepository _helpArticleRepository;
    private readonly ILogger<HelpArticleService> _logger;

    public HelpArticleService(
        IHelpArticleRepository helpArticleRepository,
        ILogger<HelpArticleService> logger)
    {
        _helpArticleRepository = helpArticleRepository
            ?? throw new ArgumentNullException(nameof(helpArticleRepository));
        _logger = logger
            ?? throw new ArgumentNullException(nameof(logger));
    }

    public async Task<ErrorOr<IEnumerable<HelpArticleDto>>> GetAllAsync(CancellationToken ct)
    {
        try
        {
            _logger.LogDebug("Obteniendo todos los artículos de ayuda");

            var articles = await _helpArticleRepository.GetAllAsync(ct);

            if (!articles.Any())
            {
                _logger.LogInformation("No se encontraron artículos de ayuda");
                return Errors.HelpArticle.NotFound;
            }

            var dtos = articles.Select(MapToDto).ToList();
            _logger.LogInformation("Se obtuvieron {Count} artículos de ayuda", dtos.Count);

            return dtos;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener todos los artículos de ayuda");
            return CommonErrors.DatabaseError("obtener los artículos de ayuda");
        }
    }

    public async Task<ErrorOr<IEnumerable<HelpArticleDto>>> GetByModuleAsync(string modulo, CancellationToken ct)
    {
        try
        {
            _logger.LogDebug("Obteniendo artículos de ayuda por módulo: {Modulo}", modulo);

            var articles = await _helpArticleRepository.GetByModuleAsync(modulo, ct);

            if (!articles.Any())
            {
                _logger.LogInformation("No se encontraron artículos de ayuda para el módulo: {Modulo}", modulo);
                return new List<HelpArticleDto>();
            }

            var dtos = articles.Select(MapToDto).ToList();
            _logger.LogInformation("Se obtuvieron {Count} artículos para el módulo: {Modulo}", dtos.Count, modulo);

            return dtos;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener artículos de ayuda por módulo: {Modulo}", modulo);
            return CommonErrors.DatabaseError($"obtener artículos del módulo {modulo}");
        }
    }

    public async Task<ErrorOr<IEnumerable<HelpArticleDto>>> GetByTypeAsync(string tipo, CancellationToken ct)
    {
        try
        {
            _logger.LogDebug("Obteniendo artículos de ayuda por tipo: {Tipo}", tipo);

            var articles = await _helpArticleRepository.GetByTypeAsync(tipo, ct);

            if (!articles.Any())
            {
                _logger.LogInformation("No se encontraron artículos de ayuda para el tipo: {Tipo}", tipo);
                return new List<HelpArticleDto>();
            }

            var dtos = articles.Select(MapToDto).ToList();
            _logger.LogInformation("Se obtuvieron {Count} artículos para el tipo: {Tipo}", dtos.Count, tipo);

            return dtos;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener artículos de ayuda por tipo: {Tipo}", tipo);
            return CommonErrors.DatabaseError($"obtener artículos del tipo {tipo}");
        }
    }

    public async Task<ErrorOr<IEnumerable<HelpArticleDto>>> GetForUserAsync(string? modulo, CancellationToken ct)
    {
        try
        {
            _logger.LogDebug("Obteniendo artículos de ayuda para usuario. Módulo: {Modulo}", modulo ?? "todos");

            var articles = await _helpArticleRepository.GetForUserAsync(modulo, ct);

            if (!articles.Any())
            {
                _logger.LogInformation("No se encontraron artículos de ayuda para usuario. Módulo: {Modulo}", modulo ?? "todos");
                return new List<HelpArticleDto>();
            }

            var dtos = articles.Select(MapToDto).ToList();
            _logger.LogInformation("Se obtuvieron {Count} artículos para usuario. Módulo: {Modulo}", dtos.Count, modulo ?? "todos");

            return dtos;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener artículos de ayuda para usuario. Módulo: {Modulo}", modulo ?? "todos");
            return CommonErrors.DatabaseError("obtener artículos de ayuda para usuario");
        }
    }

    public async Task<ErrorOr<HelpArticleDto>> GetByIdAsync(int id, CancellationToken ct)
    {
        try
        {
            _logger.LogDebug("Obteniendo artículo de ayuda por ID: {ArticleId}", id);

            var article = await _helpArticleRepository.GetByIdAsync(id, ct);

            if (article == null)
            {
                _logger.LogWarning("Artículo de ayuda con ID {ArticleId} no encontrado", id);
                return Errors.HelpArticle.NotFound;
            }

            _logger.LogInformation("Artículo de ayuda encontrado: {ArticleId} - {Titulo}", article.Id, article.Titulo);
            return MapToDto(article);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener artículo de ayuda por ID: {ArticleId}", id);
            return CommonErrors.DatabaseError("obtener el artículo de ayuda");
        }
    }

    public async Task<ErrorOr<HelpArticleDto>> CreateAsync(CreateHelpArticleRequest request, string createdBy, CancellationToken ct)
    {
        try
        {
            _logger.LogDebug("Creando nuevo artículo de ayuda: {Titulo}", request.Titulo);

            var article = new HelpArticle
            {
                Titulo = request.Titulo.Trim(),
                Contenido = request.Contenido,
                Resumen = request.Resumen?.Trim(),
                Modulo = request.Modulo,
                Tipo = request.Tipo,
                Categoria = request.Categoria?.Trim(),
                Orden = request.Orden,
                Activo = true,
                FechaCreacion = DateTime.UtcNow,
                FechaActualizacion = DateTime.UtcNow,
                CreadoPor = createdBy
            };

            var result = await _helpArticleRepository.CreateAsync(article, ct);

            _logger.LogInformation("Artículo de ayuda creado exitosamente: {ArticleId} - {Titulo}", result.Id, result.Titulo);
            return MapToDto(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al crear artículo de ayuda: {Titulo}", request.Titulo);
            return CommonErrors.DatabaseError("crear el artículo de ayuda");
        }
    }

    public async Task<ErrorOr<HelpArticleDto>> UpdateAsync(UpdateHelpArticleRequest request, string updatedBy, CancellationToken ct)
    {
        try
        {
            _logger.LogDebug("Actualizando artículo de ayuda: {ArticleId}", request.Id);

            var article = await _helpArticleRepository.GetByIdAsync(request.Id, ct);

            if (article == null)
            {
                _logger.LogWarning("Intento de actualizar artículo inexistente: {ArticleId}", request.Id);
                return Errors.HelpArticle.NotFound;
            }

            article.Titulo = request.Titulo.Trim();
            article.Contenido = request.Contenido;
            article.Resumen = request.Resumen?.Trim();
            article.Modulo = request.Modulo;
            article.Tipo = request.Tipo;
            article.Categoria = request.Categoria?.Trim();
            article.Orden = request.Orden;
            article.Activo = request.Activo;
            article.FechaActualizacion = DateTime.UtcNow;
            article.ActualizadoPor = updatedBy;

            var result = await _helpArticleRepository.UpdateAsync(article, ct);

            _logger.LogInformation("Artículo de ayuda actualizado exitosamente: {ArticleId} - {Titulo}", result.Id, result.Titulo);
            return MapToDto(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al actualizar artículo de ayuda: {ArticleId}", request.Id);
            return CommonErrors.DatabaseError("actualizar el artículo de ayuda");
        }
    }

    public async Task<ErrorOr<Success>> DeleteAsync(int id, CancellationToken ct)
    {
        try
        {
            _logger.LogDebug("Eliminando artículo de ayuda: {ArticleId}", id);

            var article = await _helpArticleRepository.GetByIdAsync(id, ct);

            if (article == null)
            {
                _logger.LogWarning("Intento de eliminar artículo inexistente: {ArticleId}", id);
                return Errors.HelpArticle.NotFound;
            }

            await _helpArticleRepository.DeleteAsync(id, ct);

            _logger.LogInformation("Artículo de ayuda eliminado exitosamente: {ArticleId} - {Titulo}", article.Id, article.Titulo);
            return Result.Success;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al eliminar artículo de ayuda: {ArticleId}", id);
            return CommonErrors.DatabaseError("eliminar el artículo de ayuda");
        }
    }

    /// <summary>
    /// Mapea una entidad HelpArticle a HelpArticleDto
    /// </summary>
    private static HelpArticleDto MapToDto(HelpArticle article)
    {
        return new HelpArticleDto
        {
            Id = article.Id,
            Titulo = article.Titulo,
            Contenido = article.Contenido,
            Resumen = article.Resumen,
            Modulo = article.Modulo,
            Tipo = article.Tipo,
            Categoria = article.Categoria,
            Orden = article.Orden,
            Activo = article.Activo,
            FechaCreacion = article.FechaCreacion,
            FechaActualizacion = article.FechaActualizacion,
            CreadoPor = article.CreadoPor,
            ActualizadoPor = article.ActualizadoPor
        };
    }
}
