using ErrorOr;
using Lefarma.API.Features.Help.DTOs;
using Lefarma.API.Features.Help.Services;
using Lefarma.API.Shared.Extensions;
using Lefarma.API.Shared.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Swashbuckle.AspNetCore.Annotations;

namespace Lefarma.API.Features.Help.Controllers;
[ApiController]
[Route("api/help/images")]
public class HelpImagesController : ControllerBase
{
    private readonly IHelpImageService _helpImageService;

    public HelpImagesController(IHelpImageService helpImageService)
    {
        _helpImageService = helpImageService ?? throw new ArgumentNullException(nameof(helpImageService));
    }

    [HttpPost]
    [RequestSizeLimit(10_000_000)] 
    [SwaggerOperation(
        Summary = "Cargar imagen de ayuda",
        Description = "Carga una imagen (PNG, JPEG, GIF, WebP) para usar en artículos de ayuda. Tamaño máximo: 5 MB.")]
    [ProducesResponseType(typeof(ApiResponse<HelpImageUploadResponse>), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status413PayloadTooLarge)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> Upload(
        IFormFile file,
        CancellationToken ct)
    {
        if (file == null || file.Length == 0)
        {
            return BadRequest(new ApiResponse<object>
            {
                Success = false,
                Message = "No se proporcionó ningún archivo o el archivo está vacío.",
                Data = null
            });
        }

        var username = User.Identity?.Name ?? "unknown";

        using var stream = file.OpenReadStream();

        var result = await _helpImageService.UploadAsync(
            stream,
            file.FileName,
            file.ContentType,
            username,
            ct);

        return result.ToActionResult(this, data => CreatedAtAction(
            nameof(Upload),
            new { },
            new ApiResponse<HelpImageUploadResponse>
            {
                Success = true,
                Message = "Imagen cargada exitosamente.",
                Data = data
            }));
    }
}