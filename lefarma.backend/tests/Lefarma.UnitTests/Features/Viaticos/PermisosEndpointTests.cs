using System.Net;
using System.Security.Claims;
using System.Text.Encodings.Web;
using FluentAssertions;
using Lefarma.API.Shared.Authorization;
using Lefarma.API.Shared.Constants;
// WebHostBuilder y TestServer(IWebHostBuilder) estan marcados obsoletos en
// .NET 8+ (ASPDEPR004/ASPDEPR008). El reemplazo moderno recomendado
// (WebApplicationFactory<TEntryPoint> con WebApplicationBuilder) requiere un
// entry point publico valido, lo cual obligaria a importar la app completa
// y sus DBs. Aqui preferimos un pipeline in-memory sin tocar Program.cs.
#pragma warning disable ASPDEPR004
#pragma warning disable ASPDEPR008
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Lefarma.UnitTests.Features.Viaticos;

/// <summary>
/// Smoke test HTTP del helper <see cref="ClaimsPrincipalExtensions.TienePermiso"/>
/// + <see cref="ClaimsPrincipalExtensions.GetUserId"/> levantando una mini
/// aplicacion ASP.NET Core en memoria (<see cref="TestServer"/>).
///
/// El endpoint de prueba devuelve 200 con el claim correspondiente y 403 sin
/// el. Las cabeceras <c>X-Test-UserId</c> y <c>X-Test-Permissions</c> (CSV)
/// inyectan los claims via un <see cref="AuthenticationHandler{TOptions}"/>
/// propio, sin necesidad de JWT real.
/// </summary>
public class PermisosEndpointTests
{
    [Fact]
    public async Task Ping_ConClaimViaticosAutorizar_Retorna200YUserId()
    {
        using var servidor = CrearServidor();
        using var cliente = servidor.CreateClient();
        cliente.DefaultRequestHeaders.Add("X-Test-UserId", "4242");
        cliente.DefaultRequestHeaders.Add("X-Test-Permissions",
            string.Join(",", Permissions.Viaticos.Autorizar, Permissions.Viaticos.VerTodos));

        using var respuesta = await cliente.GetAsync(
            "/permisos-test/ping?permiso=" + Permissions.Viaticos.Autorizar);

        respuesta.StatusCode.Should().Be(HttpStatusCode.OK);
        var cuerpo = await respuesta.Content.ReadAsStringAsync();
        cuerpo.Should().Contain("\"userId\":4242");
        cuerpo.Should().Contain("\"hasPermission\":true");
    }

    [Fact]
    public async Task Ping_SinClaimViaticosAutorizar_Retorna403()
    {
        using var servidor = CrearServidor();
        using var cliente = servidor.CreateClient();
        cliente.DefaultRequestHeaders.Add("X-Test-UserId", "9000");
        cliente.DefaultRequestHeaders.Add("X-Test-Permissions", Permissions.Viaticos.Solicitar);

        using var respuesta = await cliente.GetAsync(
            "/permisos-test/ping?permiso=" + Permissions.Viaticos.Autorizar);

        respuesta.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Ping_SinCabecerasDeAuth_Retorna401()
    {
        using var servidor = CrearServidor();
        using var cliente = servidor.CreateClient();
        // sin X-Test-Permissions => TestAuthHandler devuelve NoResult => [Authorize] => 401

        using var respuesta = await cliente.GetAsync(
            "/permisos-test/ping?permiso=" + Permissions.Viaticos.Autorizar);

        respuesta.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    private static TestServer CrearServidor()
    {
        var builder = new WebHostBuilder()
            .UseEnvironment(Environments.Development)
            .ConfigureServices(services =>
            {
                services.AddLogging();
                services.AddRouting();
                services.AddAuthentication(TestAuthHandler.NombreEsquema)
                    .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(
                        TestAuthHandler.NombreEsquema, _ => { });
                services.AddAuthorization();
            })
            .Configure(app =>
            {
                app.UseRouting();
                app.UseAuthentication();
                app.UseAuthorization();

                app.UseEndpoints(endpoints =>
                {
                    endpoints.MapGet("/permisos-test/ping",
                        [Authorize] (HttpContext ctx, string? permiso) =>
                        {
                            if (string.IsNullOrWhiteSpace(permiso))
                            {
                                return Results.BadRequest(new { error = "permiso requerido" });
                            }

                            if (!ctx.User.TienePermiso(permiso))
                            {
                                return Results.Json(
                                    new { userId = ctx.User.GetUserId(), hasPermission = false, permiso },
                                    statusCode: StatusCodes.Status403Forbidden);
                            }

                            return Results.Ok(new
                            {
                                userId = ctx.User.GetUserId(),
                                hasPermission = true,
                                permiso,
                            });
                        });
                });
            });

        return new TestServer(builder);
    }

    // ------------------------------------------------------------------ //
    //                       Tipos de la mini-app                          //
    // ------------------------------------------------------------------ //

    /// <summary>
    /// Handler de autenticacion de pruebas. Lee <c>X-Test-UserId</c> y
    /// <c>X-Test-Permissions</c> (CSV) para emitir los claims sin necesidad
    /// de JWT real. Si ninguna cabecera esta presente devuelve <c>NoResult</c>,
    /// lo que el atributo <c>[Authorize]</c> traduce en 401.
    /// </summary>
    public sealed class TestAuthHandler : AuthenticationHandler<AuthenticationSchemeOptions>
    {
        public const string NombreEsquema = "Test";

        public TestAuthHandler(
            IOptionsMonitor<AuthenticationSchemeOptions> options,
            ILoggerFactory logger,
            UrlEncoder encoder)
            : base(options, logger, encoder)
        {
        }

        protected override Task<AuthenticateResult> HandleAuthenticateAsync()
        {
            var headers = Request.Headers;
            var userId = headers["X-Test-UserId"].ToString();
            var permisos = headers["X-Test-Permissions"].ToString();

            if (string.IsNullOrEmpty(userId) && string.IsNullOrEmpty(permisos))
            {
                return Task.FromResult(AuthenticateResult.NoResult());
            }

            var claims = new List<Claim>();
            if (!string.IsNullOrEmpty(userId))
            {
                claims.Add(new Claim(ClaimTypes.NameIdentifier, userId));
            }

            if (!string.IsNullOrEmpty(permisos))
            {
                foreach (var permiso in permisos.Split(',', StringSplitOptions.RemoveEmptyEntries))
                {
                    claims.Add(new Claim("permission", permiso.Trim()));
                }
            }

            var identity = new ClaimsIdentity(claims, authenticationType: NombreEsquema);
            var principal = new ClaimsPrincipal(identity);
            var ticket = new AuthenticationTicket(principal, NombreEsquema);
            return Task.FromResult(AuthenticateResult.Success(ticket));
        }
    }
}