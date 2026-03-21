using Lefarma.API.Features.Notifications.Services.Channels;
using Lefarma.API.Services.Identity;
using Lefarma.API.Shared.Models.Configuracion;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using Swashbuckle.AspNetCore.Annotations;

namespace Lefarma.API.Features.SystemConfig
{
    [Route("api/sistema/[controller]")]
    [ApiController]
    [EndpointGroupName("Sistema")]
    public class ConfigController : ControllerBase
    {
        private readonly JwtSettings _jwtSettings;
        private readonly EmailSettings _emailSettings;
        private readonly TelegramSettings _telegramSettings;

        public ConfigController(
            IOptions<JwtSettings> jwtSettings,
            IOptions<EmailSettings> emailSettings,
            IOptions<TelegramSettings> telegramSettings)
        {
            _jwtSettings = jwtSettings.Value;
            _emailSettings = emailSettings.Value;
            _telegramSettings = telegramSettings.Value;
        }

        [HttpGet("backend")]
        [SwaggerOperation(
            Summary = "Obtener configuración del backend",
            Description = "Retorna las variables de configuración del backend (appsettings.json). Solo incluye datos no sensibles."
        )]
        [ProducesResponseType(typeof(BackendConfigResponse), StatusCodes.Status200OK)]
        public IActionResult GetBackendConfig()
        {
            var response = new BackendConfigResponse
            {
                Jwt = new JwtSettingsPublic
                {
                    ExpirationMinutes = _jwtSettings.AccessTokenExpirationMinutes,
                    Issuer = _jwtSettings.Issuer,
                    Audience = _jwtSettings.Audience
                },
                Email = new EmailSettingsPublic
                {
                    SmtpServer = _emailSettings.SmtpServer,
                    SmtpPort = _emailSettings.SmtpPort,
                    FromEmail = _emailSettings.FromEmail,
                    FromName = _emailSettings.FromName,
                    EnableSSL = _emailSettings.UseSsl
                },
                Telegram = new TelegramSettingsPublic
                {
                    ApiUrl = _telegramSettings.ApiUrl
                }
            };

            return Ok(response);
        }
    }
}
