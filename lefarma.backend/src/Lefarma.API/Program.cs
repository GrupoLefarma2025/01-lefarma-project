using FluentValidation;
using Lefarma.API.Domain.Interfaces.Catalogos;
using Lefarma.API.Features.Auth;
using Lefarma.API.Features.Catalogos.Areas;
using Lefarma.API.Features.Catalogos.Empresas;
using Lefarma.API.Features.Catalogos.Sucursales;
using Lefarma.API.Features.Catalogos.TipoGastos;
using Lefarma.API.Features.Catalogos.TiposMedida;
using Lefarma.API.Features.Catalogos.UnidadesMedida;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Infrastructure.Data.Repositories.Catalogos;
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
    .MinimumLevel.Override("Microsoft.EntityFrameworkCore", LogEventLevel.Warning)
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

// DbContext 
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddDbContext<AsokamDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("AsokamConnection")));

// Repositorios
builder.Services.AddScoped<IEmpresaRepository, EmpresaRepository>();
builder.Services.AddScoped<ISucursalRepository, SucursalRepository>();
builder.Services.AddScoped<ITipoGastoRepository, TipoGastoRepository>();
builder.Services.AddScoped<IAreaRepository, AreaRepository>();
builder.Services.AddScoped<ITipoMedidaRepository, TipoMedidaRepository>();
builder.Services.AddScoped<IUnidadMedidaRepository, UnidadMedidaRepository>();

// Servicios
builder.Services.AddScoped<IEmpresaService, EmpresaService>();
builder.Services.AddScoped<ISucursalService, SucursalService>();
builder.Services.AddScoped<ITipoGastoService, TipoGastoService>();
builder.Services.AddScoped<IAreaService, AreaService>();
builder.Services.AddScoped<ITipoMedidaService, TipoMedidaService>();
builder.Services.AddScoped<IUnidadMedidaService, UnidadMedidaService>();

builder.Services.AddActiveDirectoryServices(builder.Configuration);
builder.Services.AddJwtTokenServices(builder.Configuration);
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IDatabaseSeeder, DatabaseSeeder>();

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

    // Permission-based policies
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
});

// Register permission handler
builder.Services.AddSingleton<IAuthorizationHandler, PermissionHandler>();

// Controllers
builder.Services.AddControllers(options =>
{
    options.Filters.Add<ValidationFilter>();
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
    options.TagActionsBy(api => new List<string>() { api.GroupName ?? "Sin Categor�a" });
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


var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi(); 
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "Lefarma API v1");
        c.RoutePrefix = ""; // Hacer que Swagger est� disponible en la ra�z
    });
}

app.UseHttpsRedirection();

app.UseSerilogRequestLogging(options =>
{
    // Se deshabilita el log automático de Serilog porque ya tenemos WideEvent
    options.MessageTemplate = "HTTP {RequestMethod} {RequestPath} responded {StatusCode}";
    options.GetLevel = (httpContext, elapsed, ex) => LogEventLevel.Fatal; // Nunca se ejecuta
});

// Wide Event logging - logs one rich event per request
app.UseWideEventLogging();

// Use CORS
app.UseCors("CorsPolicy");

// Authentication & Authorization - Order matters: Authentication must come before Authorization
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

if (app.Environment.IsDevelopment())
{
    using var scope = app.Services.CreateScope();
    var seeder = scope.ServiceProvider.GetRequiredService<IDatabaseSeeder>();
    await seeder.SeedAsync();
}

app.Run();

