using FluentValidation;
using Lefarma.API.Domain.Interfaces;
using Lefarma.API.Domain.Interfaces.Admin;
using Lefarma.API.Domain.Interfaces.Catalogos;
using Lefarma.API.Domain.Interfaces.Config;
using Lefarma.API.Domain.Interfaces.Logging;
using Lefarma.API.Domain.Interfaces.Operaciones;
using Lefarma.API.Features.Admin;
using Lefarma.API.Features.Auth;
using Lefarma.API.Features.Catalogos.Areas;
using Lefarma.API.Features.Catalogos.Bancos;
using Lefarma.API.Features.Catalogos.CentrosCosto;
using Lefarma.API.Features.Catalogos.CuentasContables;
using Lefarma.API.Features.Catalogos.EstatusOrden;
using Lefarma.API.Features.Catalogos.Proveedores;
using Lefarma.API.Features.Catalogos.RegimenesFiscales;
using Lefarma.API.Features.Catalogos.TiposImpuesto;
using Lefarma.API.Features.Catalogos.Empresas;
using Lefarma.API.Features.Catalogos.FormasPago;
using Lefarma.API.Features.Catalogos.Gastos;
using Lefarma.API.Features.Catalogos.Medidas;
using Lefarma.API.Features.Catalogos.MediosPago;
using Lefarma.API.Features.Catalogos.Sucursales;
using Lefarma.API.Features.Catalogos.UnidadesMedida;
using Lefarma.API.Features.Config.Engine;
using Lefarma.API.Features.Config.Workflows;
using Lefarma.API.Features.Logging;
using Lefarma.API.Features.Notifications.Services;
using Lefarma.API.Features.Notifications.Services.Channels;
using Lefarma.API.Features.OrdenesCompra.Captura;
using Lefarma.API.Features.OrdenesCompra.Firmas;
using Lefarma.API.Features.OrdenesCompra.Firmas.Handlers;
using Lefarma.API.Features.Profile;
using Lefarma.API.Features.Help.Services;
using Lefarma.API.Features.Archivos.Services;
using Lefarma.API.Features.Archivos.Settings;
using Lefarma.API.Features.Facturas;
using Microsoft.Extensions.FileProviders;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Infrastructure.Data.Repositories.Admin;
using Lefarma.API.Infrastructure.Data.Repositories.Catalogos;
using Lefarma.API.Infrastructure.Data.Repositories.Config;
using Lefarma.API.Infrastructure.Data.Repositories.Notifications;
using Lefarma.API.Infrastructure.Data.Repositories.Operaciones;
using Lefarma.API.Infrastructure.Data.Repositories;
using Lefarma.API.Infrastructure.Data.Seeding;
using Lefarma.API.Infrastructure.Filters;
using Lefarma.API.Infrastructure.Middleware;
using Lefarma.API.Services.Identity;
using Lefarma.API.Shared.Authorization;
using Lefarma.API.Shared.Constants;
using Lefarma.API.Shared.Logging;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi;
using Serilog;
using Serilog.Events;
using Serilog.Formatting.Json;
using System.Reflection;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

// Configure Serilog first
Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Information()

    // Se remueven logs de Microsoft (solo errores)
    .MinimumLevel.Override("Microsoft", LogEventLevel.Warning)
    .MinimumLevel.Override("Microsoft.AspNetCore", LogEventLevel.Warning)
    .MinimumLevel.Override("Microsoft.EntityFrameworkCore", LogEventLevel.Fatal)
    .MinimumLevel.Override("Microsoft.AspNetCore.Hosting.Diagnostics", LogEventLevel.Warning)
    .MinimumLevel.Override("Microsoft.AspNetCore.Routing.EndpointMiddleware", LogEventLevel.Warning)
    .MinimumLevel.Override("Microsoft.AspNetCore.Mvc", LogEventLevel.Warning)
    .MinimumLevel.Override("Microsoft.AspNetCore.Cors", LogEventLevel.Warning)

    // solo WideEvents
    .MinimumLevel.Override("Lefarma.API", LogEventLevel.Information)

    .Enrich.FromLogContext()
    .Enrich.WithProperty("Service", "Lefarma.API")
    .Enrich.WithProperty("Version", "1.0.0")

    .WriteTo.Console(
        restrictedToMinimumLevel: builder.Environment.IsDevelopment()
            ? LogEventLevel.Information
            : LogEventLevel.Warning)

    // Archivo logs JSON
    .WriteTo.File(
        new JsonFormatter(),
        path: "logs/wide-events-.json",
        rollingInterval: RollingInterval.Day,
        retainedFileCountLimit: 30,
        restrictedToMinimumLevel: LogEventLevel.Information,
        // SOLO WideEvents
        levelSwitch: new Serilog.Core.LoggingLevelSwitch(LogEventLevel.Information))

    .CreateLogger();

builder.Host.UseSerilog();

// HttpClientFactory for external API calls
builder.Services.AddHttpClient();

// DbContext
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddDbContext<AsokamDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("AsokamConnection")));

// Repositorios
builder.Services.AddScoped<IEmpresaRepository, EmpresaRepository>();
builder.Services.AddScoped<ISucursalRepository, SucursalRepository>();
builder.Services.AddScoped<IGastoRepository, GastoRepository>();
builder.Services.AddScoped<IAreaRepository, AreaRepository>();
builder.Services.AddScoped<IMedidaRepository, MedidaRepository>();
builder.Services.AddScoped<IUnidadMedidaRepository, UnidadMedidaRepository>();
builder.Services.AddScoped<IAdminRepository, AdminRepository>();
builder.Services.AddScoped<IMedioPagoRepository, MedioPagoRepository>();
builder.Services.AddScoped<IFormaPagoRepository, FormaPagoRepository>();
builder.Services.AddScoped<IBancoRepository, BancoRepository>();
builder.Services.AddScoped<INotificationRepository, NotificationRepository>();

// Catálogos Faltantes
builder.Services.AddScoped<ICentroCostoRepository, CentroCostoRepository>();
builder.Services.AddScoped<IEstatusOrdenRepository, EstatusOrdenRepository>();
builder.Services.AddScoped<IRegimenFiscalRepository, RegimenFiscalRepository>();
builder.Services.AddScoped<IProveedorRepository, ProveedorRepository>();
builder.Services.AddScoped<ICuentaContableRepository, CuentaContableRepository>();
builder.Services.AddScoped<ITipoImpuestoRepository, TipoImpuestoRepository>();

// Help System
builder.Services.AddScoped<IHelpArticleRepository, HelpArticleRepository>();
builder.Services.AddScoped<IHelpArticleService, HelpArticleService>();
builder.Services.AddScoped<IHelpImageRepository, HelpImageRepository>();
builder.Services.AddScoped<IHelpImageService, HelpImageService>();
builder.Services.AddScoped<IHelpModuleRepository, HelpModuleRepository>();
builder.Services.AddScoped<IHelpModuleService, HelpModuleService>();
// Archivos
builder.Services.Configure<ArchivosSettings>(
    builder.Configuration.GetSection("ArchivosSettings"));
builder.Services.AddScoped<IArchivoRepository, ArchivoRepository>();
builder.Services.AddScoped<IArchivoService, ArchivoService>();

// Repositorios - Config y Operaciones
builder.Services.AddScoped<IWorkflowRepository, WorkflowRepository>();
builder.Services.AddScoped<IOrdenCompraRepository, OrdenCompraRepository>();
builder.Services.AddScoped<IPagoRepository, PagoRepository>();
builder.Services.AddScoped<IComprobacionRepository, ComprobacionRepository>();
builder.Services.AddScoped<IComprobanteRepository, ComprobanteRepository>();

// Comprobantes / Facturas CFDI
builder.Services.AddScoped<IComprobanteService, ComprobanteService>();

// Motor de Workflows
builder.Services.AddScoped<IWorkflowEngine, WorkflowEngine>();

// Config y Operaciones
builder.Services.AddScoped<IWorkflowService, WorkflowService>();
builder.Services.AddScoped<IOrdenCompraService, OrdenCompraService>();
builder.Services.AddScoped<IFirmasService, FirmasService>();
builder.Services.AddScoped<IWorkflowNotificationDispatcher, WorkflowNotificationDispatcher>();
builder.Services.AddScoped<WorkflowReminderService>();

// Dynamic Action Handlers (keyed por handler_key en config.workflow_accion_handlers)
builder.Services.AddKeyedScoped<IWorkflowActionHandler, FieldWorkflowHandler>("Field");
builder.Services.AddKeyedScoped<IWorkflowActionHandler, DocumentWorkflowHandler>("Document");

// Servicios
builder.Services.AddScoped<IEmpresaService, EmpresaService>();
builder.Services.AddScoped<ISucursalService, SucursalService>();
builder.Services.AddScoped<IGastoService, GastoService>();
builder.Services.AddScoped<IAreaService, AreaService>();
builder.Services.AddScoped<IMedidaService, MedidaService>();
builder.Services.AddScoped<IUnidadMedidaService, UnidadMedidaService>();
builder.Services.AddScoped<IMedioPagoService, MedioPagoService>();
builder.Services.AddScoped<IFormaPagoService, FormaPagoService>();
builder.Services.AddScoped<IBancoService, BancoService>();
builder.Services.AddScoped<Lefarma.API.Features.Auth.Usuarios.IUsuarioCatalogService, Lefarma.API.Features.Auth.Usuarios.UsuarioCatalogService>();
builder.Services.AddScoped<Lefarma.API.Features.Auth.Roles.IRolCatalogService, Lefarma.API.Features.Auth.Roles.RolCatalogService>();

// Catálogos Faltantes
builder.Services.AddScoped<ICentroCostoService, CentroCostoService>();
builder.Services.AddScoped<IEstatusOrdenService, EstatusOrdenService>();
builder.Services.AddScoped<IRegimenFiscalService, RegimenFiscalService>();
builder.Services.AddScoped<IProveedorService, ProveedorService>();
builder.Services.AddScoped<ICuentaContableService, CuentaContableService>();
builder.Services.AddScoped<ITipoImpuestoService, TipoImpuestoService>();

// Logging Services
builder.Services.AddScoped<IErrorLogService, ErrorLogService>();

builder.Services.AddActiveDirectoryServices(builder.Configuration);
builder.Services.AddJwtTokenServices(builder.Configuration);
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IAdminService, AdminService>();
builder.Services.AddScoped<IProfileService, ProfileService>();
builder.Services.AddScoped<IDatabaseSeeder, DatabaseSeeder>();
builder.Services.AddSingleton<ISseService, SseService>();

// Notification Services
builder.Services.AddScoped<Lefarma.API.Domain.Interfaces.ITemplateService, TemplateService>();
builder.Services.AddScoped<Lefarma.API.Domain.Interfaces.INotificationService, Lefarma.API.Features.Notifications.Services.NotificationService>();

// Email Settings configuration
builder.Services.Configure<EmailSettings>(builder.Configuration.GetSection("EmailSettings"));
builder.Services.AddOptions<EmailSettings>()
    .Validate(x => !string.IsNullOrWhiteSpace(x.SmtpServer), "SmtpServer is required")
    .Validate(x => !string.IsNullOrWhiteSpace(x.FromEmail), "FromEmail is required")
    .Validate(x => x.SmtpPort > 0 && x.SmtpPort <= 65535, "SmtpPort must be between 1 and 65535")
    //.ValidateOnStart()
    ;

// Register channels as KEYED SERVICES for multi-channel support
builder.Services.AddKeyedScoped<Lefarma.API.Domain.Interfaces.INotificationChannel, Lefarma.API.Features.Notifications.Services.Channels.EmailNotificationChannel>("email");
builder.Services.AddKeyedScoped<Lefarma.API.Domain.Interfaces.INotificationChannel, Lefarma.API.Features.Notifications.Services.Channels.TelegramNotificationChannel>("telegram");
builder.Services.AddKeyedScoped<Lefarma.API.Domain.Interfaces.INotificationChannel, Lefarma.API.Features.Notifications.Services.Channels.InAppNotificationChannel>("in-app");

// Telegram Settings configuration
builder.Services.Configure<TelegramSettings>(builder.Configuration.GetSection("TelegramSettings"));
builder.Services.AddOptions<TelegramSettings>()
    .Validate(x => !string.IsNullOrWhiteSpace(x.BotToken), "BotToken is required")
    .Validate(x => !string.IsNullOrWhiteSpace(x.ApiUrl), "ApiUrl is required")
    .ValidateOnStart();

// JWT Bearer Authentication
var jwtSettings = builder.Configuration.GetSection("JwtSettings").Get<JwtSettings>();
if (jwtSettings is not null && !string.IsNullOrWhiteSpace(jwtSettings.SecretKey))
{
    builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
        .AddJwtBearer(options =>
        {
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidateAudience = true,
                ValidateLifetime = true,
                ValidateIssuerSigningKey = true,
                ValidIssuer = jwtSettings.Issuer,
                ValidAudience = jwtSettings.Audience,
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSettings.SecretKey)),
                ClockSkew = TimeSpan.Zero
            };

            options.Events = new JwtBearerEvents
            {
                OnAuthenticationFailed = context =>
                {
                    Log.Warning("JWT authentication failed: {Message}", context.Exception.Message);
                    return Task.CompletedTask;
                },
                OnTokenValidated = context =>
                {
                    var userId = context.Principal?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
                    Log.Debug("JWT token validated for user {UserId}", userId);
                    return Task.CompletedTask;
                }
            };
        });
}
else
{
    Log.Warning("JWT settings not configured properly. Authentication will not work.");
}

// TODO: Uncomment when Notifications feature is implemented
// // Telegram Settings validation
// builder.Services.Configure<Features.Notifications.Services.Channels.TelegramSettings>(
//     builder.Configuration.GetSection("TelegramSettings"));
// builder.Services.AddOptions<Features.Notifications.Services.Channels.TelegramSettings>()
//     .Validate(x => !string.IsNullOrWhiteSpace(x.BotToken), "BotToken is required")
//     .ValidateOnStart();
//
// // Notification Settings validation
// builder.Services.Configure<Features.Notifications.DTOs.NotificationSettings>(
//     builder.Configuration.GetSection("NotificationSettings"));
// builder.Services.AddOptions<Features.Notifications.DTOs.NotificationSettings>()
//     .Validate(x => x.MaxRetryCount > 0 && x.MaxRetryCount <= 10, "MaxRetryCount must be 1-10")
//     .ValidateOnStart();

// Authorization Policies
builder.Services.AddAuthorization(options =>
{
    // Policy for administrators
    options.AddPolicy(AuthorizationPolicies.RequireAdministrator, policy =>
        policy.RequireRole(AuthorizationConstants.Roles.Administrador));

    // Policy for managers (Gerentes)
    options.AddPolicy(AuthorizationPolicies.RequireManager, policy =>
        policy.RequireRole(
            AuthorizationConstants.Roles.GerenteArea,
            AuthorizationConstants.Roles.GerenteAdmon,
            AuthorizationConstants.Roles.DireccionCorp,
            AuthorizationConstants.Roles.Administrador));

    // Policy for finance users
    options.AddPolicy(AuthorizationPolicies.RequireFinance, policy =>
        policy.RequireRole(
            AuthorizationConstants.Roles.CxP,
            AuthorizationConstants.Roles.Tesoreria,
            AuthorizationConstants.Roles.AuxiliarPagos,
            AuthorizationConstants.Roles.GerenteAdmon,
            AuthorizationConstants.Roles.DireccionCorp,
            AuthorizationConstants.Roles.Administrador));

    // Policy for payment processing
    options.AddPolicy(AuthorizationPolicies.RequirePaymentProcessing, policy =>
        policy.RequireRole(
            AuthorizationConstants.Roles.Tesoreria,
            AuthorizationConstants.Roles.AuxiliarPagos,
            AuthorizationConstants.Roles.Administrador));

    // Permission-based policies (legacy named policies kept for backward compat)
    options.AddPolicy(AuthorizationPolicies.CanViewCatalogos, policy =>
        policy.Requirements.Add(new PermissionRequirement(Permissions.Catalogos.View)));

    options.AddPolicy(AuthorizationPolicies.CanManageCatalogos, policy =>
        policy.Requirements.Add(new PermissionRequirement(Permissions.Catalogos.Manage)));

    options.AddPolicy(AuthorizationPolicies.CanViewOrdenes, policy =>
        policy.Requirements.Add(new PermissionRequirement(Permissions.OrdenesCompra.View)));

    options.AddPolicy(AuthorizationPolicies.CanCreateOrdenes, policy =>
        policy.Requirements.Add(new PermissionRequirement(Permissions.OrdenesCompra.Create)));

    options.AddPolicy(AuthorizationPolicies.CanApproveOrdenes, policy =>
        policy.Requirements.Add(new PermissionRequirement(Permissions.OrdenesCompra.Approve)));

    options.AddPolicy(AuthorizationPolicies.CanManageUsers, policy =>
        policy.Requirements.Add(new PermissionRequirement(Permissions.Usuarios.Manage)));

    // Auto-register [HasPermission("x")] policies from all permission constants
    var allPermissions = new[]
    {
        Permissions.Catalogos.View, Permissions.Catalogos.Manage,
        Permissions.OrdenesCompra.View, Permissions.OrdenesCompra.Create, Permissions.OrdenesCompra.Edit, Permissions.OrdenesCompra.Delete, Permissions.OrdenesCompra.Approve,
        Permissions.Usuarios.View, Permissions.Usuarios.Manage, Permissions.Usuarios.AssignRoles,
        Permissions.Reportes.View, Permissions.Reportes.Export,
        Permissions.Tesoreria.View, Permissions.Tesoreria.Pay, Permissions.Tesoreria.Export,
        Permissions.Comprobaciones.View, Permissions.Comprobaciones.Create, Permissions.Comprobaciones.Validate,
        Permissions.Config.View, Permissions.Config.Manage,
        Permissions.Workflows.View, Permissions.Workflows.Manage,
        Permissions.Proveedores.Autorizar, Permissions.Proveedores.Rechazar,
    };

    foreach (var perm in allPermissions)
    {
        var policyName = $"{HasPermissionAttribute.PolicyPrefix}{perm}";
        options.AddPolicy(policyName, policy =>
            policy.Requirements.Add(new PermissionRequirement(perm)));
    }
});

// Register permission handler
builder.Services.AddSingleton<IAuthorizationHandler, PermissionHandler>();

// Controllers
builder.Services.AddControllers(options =>
{
    options.Filters.Add<ValidationFilter>();
})
.AddJsonOptions(options =>
{
    // Make JSON binding case-insensitive (frontend sends camelCase, C# uses PascalCase)
    options.JsonSerializerOptions.PropertyNameCaseInsensitive = true;
});

// Validators
builder.Services.AddValidatorsFromAssemblyContaining<Program>();

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Version = "v1",
        Title = "Lefarma API",
        Description = "Lefarma",
    });
    options.EnableAnnotations();

    options.DocInclusionPredicate((docName, apiDesc) =>
    {
        return true;
    });
    options.TagActionsBy(api => new List<string>() { api.GroupName ?? "Sin Categoría" });
});

// Configure CORS to allow all origins
builder.Services.AddCors(options =>
{
    options.AddPolicy("CorsPolicy", policy =>
    {
        policy.AllowAnyOrigin()
                  .AllowAnyHeader()
                  .AllowAnyMethod();
    });
});

// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

// Wide Event logging accessor
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<IWideEventAccessor>(sp =>
{
    var httpContextAccessor = sp.GetRequiredService<IHttpContextAccessor>();
    var httpContext = httpContextAccessor.HttpContext;
    return httpContext != null
        ? new HttpContextWideEventAccessor(httpContext)
        : new NullWideEventAccessor();
});

// Configurar límites de formularios multipart para upload de imágenes (TinyMCE)
builder.Services.Configure<Microsoft.AspNetCore.Http.Features.FormOptions>(options =>
{
    options.MultipartBodyLengthLimit = 10_000_000; // 10 MB
});

// Configurar límites de Kestrel para uploads
builder.WebHost.ConfigureKestrel(options =>
{
    options.Limits.MaxRequestBodySize = 10_000_000; // 10 MB
});

var app = builder.Build();

// Use CORS
app.UseCors("CorsPolicy");
// Configure the HTTP request pipeline.
// if (app.Environment.IsDevelopment())
// {
app.MapOpenApi();
app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "Lefarma API v1");
    // c.RoutePrefix = ""; // Hacer que Swagger est disponible en la raz
});
// }

app.UseHttpsRedirection();

// ---> AGREGADO PARA LA SPA <---
// Permite servir index.html por defecto y habilita los archivos estáticos base de wwwroot
app.UseDefaultFiles();
app.UseStaticFiles();

app.UseSerilogRequestLogging(options =>
{
    // Se deshabilita el log automático de Serilog porque ya tenemos WideEvent
    options.MessageTemplate = "HTTP {RequestMethod} {RequestPath} responded {StatusCode}";
    options.GetLevel = (httpContext, elapsed, ex) => LogEventLevel.Fatal; // Nunca se ejecuta
});

// Wide Event logging - logs one rich event per request
app.UseWideEventLogging();


// Static files for help images
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(
        Path.Combine(app.Environment.WebRootPath, "media")),
    RequestPath = "/api/media",
    OnPrepareResponse = ctx =>
    {
        ctx.Context.Response.Headers.Append("Cache-Control", "public,max-age=31536000");
    }
});

// Dev Token middleware for testing (Development only)
if (app.Environment.IsDevelopment())
{
    app.UseDevToken();
}

// Authentication & Authorization - Order matters: Authentication must come before Authorization
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// Database seeding deshabilitado temporalmente
// if (app.Environment.IsDevelopment())
// {
//     using var scope = app.Services.CreateScope();
//     var seeder = scope.ServiceProvider.GetRequiredService<IDatabaseSeeder>();
//     await seeder.SeedAsync();
// }

// ---> AGREGADO PARA LA SPA <---
// Redirige cualquier petición no manejada al index.html para que el router de tu frontend se encargue
app.MapFallbackToFile("/index.html");

app.Run();