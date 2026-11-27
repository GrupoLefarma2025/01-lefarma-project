using FluentValidation;
using Lefarma.API.Domain.Interfaces;
using Lefarma.API.Domain.Interfaces.Admin;
using Lefarma.API.Domain.Interfaces.Catalogos;
using Lefarma.API.Domain.Interfaces.Config;
using Lefarma.API.Domain.Interfaces.Logging;
using Lefarma.API.Domain.Interfaces.Operaciones;
using Lefarma.API.Domain.Interfaces.Rh;
using Lefarma.API.Features.Admin;
using Lefarma.API.Features.Archivos.Notifications;
using Lefarma.API.Features.Archivos.Services;
using Lefarma.API.Features.Archivos.Settings;
using Lefarma.API.Features.Auth;
using Lefarma.API.Features.Catalogos.Areas;
using Lefarma.API.Features.Catalogos.Bancos;
using Lefarma.API.Features.Catalogos.CentrosCosto;
using Lefarma.API.Features.Catalogos.CuentasContables;
using Lefarma.API.Features.Catalogos.Empresas;
using Lefarma.API.Features.Catalogos.EstatusOrden;
using Lefarma.API.Features.Catalogos.FormasPago;
using Lefarma.API.Features.Catalogos.Medidas;
using Lefarma.API.Features.Catalogos.MediosPago;
using Lefarma.API.Features.Catalogos.Proveedores;
using Lefarma.API.Features.Catalogos.RegimenesFiscales;
using Lefarma.API.Features.Catalogos.Sucursales;
using Lefarma.API.Features.Catalogos.TiposGasto;
using Lefarma.API.Features.Catalogos.TiposImpuesto;
using Lefarma.API.Features.Catalogos.UnidadesMedida;
using Lefarma.API.Features.Config.Engine;
using Lefarma.API.Features.Config.Workflows;
using Lefarma.API.Features.Config.Workflows.Handlers;
using Lefarma.API.Features.Config.Workflows.Notification;
using Lefarma.API.Features.Facturas;
using Lefarma.API.Features.Help.Services;
using Lefarma.API.Features.Logging;
using Lefarma.API.Features.Notifications.Services;
using Lefarma.API.Features.Notifications.Services.Channels;
using Lefarma.API.Features.OrdenesCompra.Captura;
using Lefarma.API.Features.OrdenesCompra.Firmas;
using Lefarma.API.Features.OrdenesCompra.Visibilidad;
using Lefarma.API.Features.Profile;
using Lefarma.API.Features.Firmas;
using Lefarma.API.Features.Rh.IncidenciasChecado;
using Lefarma.API.Features.Rh.SolicitudesPersonal;
using Lefarma.API.Features.Rh.SolicitudesPersonal.Settings;
using Lefarma.API.Features.Sigma;
using Lefarma.API.Features.Sigma.Config;
using Lefarma.API.Features.Sigma.Services.PdfSignature;
using Lefarma.API.Features.Viaticos;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Infrastructure.Data.Repositories;
using Lefarma.API.Infrastructure.Data.Repositories.Admin;
using Lefarma.API.Infrastructure.Data.Repositories.Catalogos;
using Lefarma.API.Infrastructure.Data.Repositories.Config;
using Lefarma.API.Infrastructure.Data.Repositories.Notifications;
using Lefarma.API.Infrastructure.Data.Repositories.Operaciones;
using Lefarma.API.Infrastructure.Data.Repositories.Rh;
using Lefarma.API.Infrastructure.Data.Repositories.SolicitudesPersonal;
using Lefarma.API.Infrastructure.Filters;
using Lefarma.API.Infrastructure.Middleware;
using Lefarma.API.Infrastructure.Services;
using Lefarma.API.Services.Identity;
using Lefarma.API.Shared.Authorization;
using Lefarma.API.Shared.Constants;
using Lefarma.API.Shared.Logging;
using Lefarma.API.Shared.ModelBinders;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi;
using Serilog;
using Serilog.Events;
using Serilog.Formatting.Json;
using System.IO.Compression;
using System.Reflection;
using System.Text;
using System.Threading.RateLimiting;

var builder = WebApplication.CreateBuilder(args);

Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Information()

    .MinimumLevel.Override("Microsoft", LogEventLevel.Warning)
    .MinimumLevel.Override("Microsoft.AspNetCore", LogEventLevel.Warning)
    .MinimumLevel.Override("Microsoft.EntityFrameworkCore", LogEventLevel.Fatal)
    .MinimumLevel.Override("Microsoft.AspNetCore.Hosting.Diagnostics", LogEventLevel.Warning)
    .MinimumLevel.Override("Microsoft.AspNetCore.Routing.EndpointMiddleware", LogEventLevel.Warning)
    .MinimumLevel.Override("Microsoft.AspNetCore.Mvc", LogEventLevel.Warning)
    .MinimumLevel.Override("Microsoft.AspNetCore.Cors", LogEventLevel.Warning)

    .MinimumLevel.Override("Lefarma.API", LogEventLevel.Information)

    .Enrich.FromLogContext()
    .Enrich.WithProperty("Service", "Lefarma.API")
    .Enrich.WithProperty("Version", "1.0.0")

    .WriteTo.Console(
        restrictedToMinimumLevel: builder.Environment.IsDevelopment()
            ? LogEventLevel.Information
            : LogEventLevel.Warning)

    .WriteTo.File(
        new JsonFormatter(),
        path: "logs/wide-events-.json",
        rollingInterval: RollingInterval.Day,
        retainedFileCountLimit: 30,
        restrictedToMinimumLevel: LogEventLevel.Information,
        levelSwitch: new Serilog.Core.LoggingLevelSwitch(LogEventLevel.Information))

    .CreateLogger();

builder.Host.UseSerilog();

builder.Services.AddHttpClient();
builder.Services.AddHttpClient("capturas-agente", c =>
{
    c.Timeout = TimeSpan.FromSeconds(900);
});
builder.Services.AddHttpClient("sat", c =>
{
    c.Timeout = TimeSpan.FromSeconds(15);
});
builder.Services.AddHttpClient("nominatim", c =>
{
    c.DefaultRequestHeaders.UserAgent.ParseAdd("GrupoLefarmaViaticos/1.0 (soporte@lefarma.com)");
    c.Timeout = TimeSpan.FromSeconds(12);
});
builder.Services.AddHttpClient("photon", c =>
{
    c.DefaultRequestHeaders.UserAgent.ParseAdd("GrupoLefarmaViaticos/1.0 (soporte@lefarma.com)");
    c.Timeout = TimeSpan.FromSeconds(12);
});
builder.Services.AddHttpClient("enlaces", c =>
{
    c.DefaultRequestHeaders.UserAgent.ParseAdd("GrupoLefarmaViaticos/1.0 (soporte@lefarma.com)");
    c.Timeout = TimeSpan.FromSeconds(8);
}).ConfigurePrimaryHttpMessageHandler(() => new SocketsHttpHandler { AllowAutoRedirect = false });

builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddDbContext<AsokamDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("AsokamConnection")));

builder.Services.AddDbContext<AsistenciasDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("AsistenciasConnection")));

builder.Services.AddScoped<IEmpresaRepository, EmpresaRepository>();
builder.Services.AddScoped<ISucursalRepository, SucursalRepository>();
builder.Services.AddScoped<ITipoGastoRepository, TipoGastoRepository>();
builder.Services.AddScoped<IAreaRepository, AreaRepository>();
builder.Services.AddScoped<IMedidaRepository, MedidaRepository>();
builder.Services.AddScoped<IUnidadMedidaRepository, UnidadMedidaRepository>();
builder.Services.AddScoped<IAdminRepository, AdminRepository>();
builder.Services.AddScoped<IMedioPagoRepository, MedioPagoRepository>();
builder.Services.AddScoped<IFormaPagoRepository, FormaPagoRepository>();
builder.Services.AddScoped<IBancoRepository, BancoRepository>();
builder.Services.AddScoped<INotificationRepository, NotificationRepository>();

builder.Services.AddScoped<ICentroCostoRepository, CentroCostoRepository>();
builder.Services.AddScoped<IEstatusOrdenRepository, EstatusOrdenRepository>();
builder.Services.AddScoped<IRegimenFiscalRepository, RegimenFiscalRepository>();
builder.Services.AddScoped<IProveedorRepository, ProveedorRepository>();
builder.Services.AddScoped<ICuentaContableRepository, CuentaContableRepository>();
builder.Services.AddScoped<ITipoImpuestoRepository, TipoImpuestoRepository>();
builder.Services.AddScoped<IUsuarioConfiguracionRepository, UsuarioConfiguracionRepository>();

builder.Services.AddScoped<IHelpArticleRepository, HelpArticleRepository>();
builder.Services.AddScoped<IHelpArticleService, HelpArticleService>();
builder.Services.AddScoped<IHelpImageRepository, HelpImageRepository>();
builder.Services.AddScoped<IHelpImageService, HelpImageService>();
builder.Services.AddScoped<IHelpModuleRepository, HelpModuleRepository>();
builder.Services.AddScoped<IHelpModuleService, HelpModuleService>();
builder.Services.Configure<ArchivosSettings>(
    builder.Configuration.GetSection("ArchivosSettings"));
builder.Services.AddSingleton<Lefarma.API.Infrastructure.Files.IFileCipher, Lefarma.API.Infrastructure.Files.AesFileCipher>();
builder.Services.AddScoped<IArchivoRepository, ArchivoRepository>();
builder.Services.AddScoped<IArchivoService, ArchivoService>();
builder.Services.Configure<ArchivosEliminacionSettings>(
    builder.Configuration.GetSection("ArchivosEliminacion"));
builder.Services.AddScoped<IArchivoEliminacionNotifier, ArchivoEliminacionNotifier>();

builder.Services.AddScoped<IWorkflowRepository, WorkflowRepository>();
builder.Services.AddScoped<IOrdenCompraRepository, OrdenCompraRepository>();
builder.Services.AddScoped<IPagoRepository, PagoRepository>();
builder.Services.AddScoped<IComprobacionRepository, ComprobacionRepository>();
builder.Services.AddScoped<IComprobanteRepository, ComprobanteRepository>();

builder.Services.AddScoped<ISolicitudPersonalRepository, SolicitudPersonalRepository>();
builder.Services.AddScoped<ITipoSolicitudRepository, TipoSolicitudRepository>();
builder.Services.AddScoped<ICalendarioRepository, CalendarioRepository>();
builder.Services.AddScoped<IEmpleadoRepository, EmpleadoRepository>();
builder.Services.AddScoped<IIncidenciasChecadoPlantillaRepository, IncidenciasChecadoPlantillaRepository>();
builder.Services.AddScoped<IIncidenciasChecadoRepository, IncidenciasChecadoRepository>();

builder.Services.Configure<Lefarma.API.Features.Facturas.SatValidation.SatValidationSettings>(
    builder.Configuration.GetSection("SatValidation"));
builder.Services.AddSingleton<Lefarma.API.Features.Facturas.SatValidation.ISatValidationService,
                               Lefarma.API.Features.Facturas.SatValidation.SatValidationService>();
builder.Services.AddScoped<IComprobanteService, ComprobanteService>();

builder.Services.AddScoped<IWorkflowEngine, WorkflowEngine>();
builder.Services.AddScoped<Lefarma.API.Features.Config.Workflows.Handlers.HandlerConditionEvaluator>();
builder.Services.AddScoped<IWorkflowResolver, WorkflowResolver>();
builder.Services.AddScoped<IJefeInmediatoResolver, JefeInmediatoResolver>();

builder.Services.AddScoped<IWorkflowService, WorkflowService>();
builder.Services.AddScoped<IWorkflowQueryService, WorkflowQueryService>();
builder.Services.AddScoped<Lefarma.API.Features.Config.EmpleadoJefes.IEmpleadoJefesConfigService,
                       Lefarma.API.Features.Config.EmpleadoJefes.EmpleadoJefesConfigService>();

builder.Services.AddScoped<IOrdenCompraService, OrdenCompraService>();
builder.Services.AddScoped<IOrdenCompraVisibilidadService, OrdenCompraVisibilidadService>();
builder.Services.AddScoped<IOrdenCompraFirmasService, OrdenCompraFirmasService>();

builder.Services.Configure<SolicitudesPersonalSettings>(
    builder.Configuration.GetSection("SolicitudesPersonalSettings"));
builder.Services.AddScoped<ISolicitudPersonalService, SolicitudPersonalService>();
builder.Services.AddScoped<ISolicitudPersonalFirmasService, SolicitudPersonalFirmasService>();
builder.Services.AddScoped<ITipoSolicitudService, TipoSolicitudService>();
builder.Services.AddScoped<Lefarma.API.Features.Rh.Empleados.IEmpleadoService, Lefarma.API.Features.Rh.Empleados.EmpleadoService>();
builder.Services.AddScoped<Lefarma.API.Features.Rh.Calendario.ICalendarioService, Lefarma.API.Features.Rh.Calendario.CalendarioService>();
builder.Services.AddScoped<Lefarma.API.Features.Rh.Vacaciones.IVacacionesService, Lefarma.API.Features.Rh.Vacaciones.VacacionesService>();
builder.Services.AddScoped<IIncidenciasChecadoNotificacionService, IncidenciasChecadoNotificacionService>();
builder.Services.AddScoped<Lefarma.API.Features.Rh.IncidenciasChecado.IIncidenciasChecadoService, Lefarma.API.Features.Rh.IncidenciasChecado.IncidenciasChecadoService>();
builder.Services.AddScoped<Lefarma.API.Domain.Interfaces.Rh.IIncidenciaChecadoConfigService, Lefarma.API.Features.Rh.IncidenciasChecado.IncidenciaChecadoConfigService>();
builder.Services.AddScoped<Lefarma.API.Features.Rh.IncidenciasChecado.IIncidenciaChecadoConfigAdminService, Lefarma.API.Features.Rh.IncidenciasChecado.IncidenciaChecadoConfigAdminService>();

builder.Services.AddScoped<Lefarma.API.Domain.Interfaces.EducacionMedica.IHospitalRepository, Lefarma.API.Infrastructure.Data.Repositories.EducacionMedica.HospitalRepository>();
builder.Services.AddScoped<Lefarma.API.Domain.Interfaces.EducacionMedica.IHospitalExtensionRepository, Lefarma.API.Infrastructure.Data.Repositories.EducacionMedica.HospitalExtensionRepository>();
builder.Services.AddScoped<Lefarma.API.Domain.Interfaces.EducacionMedica.IProductoRepository, Lefarma.API.Infrastructure.Data.Repositories.EducacionMedica.ProductoRepository>();
builder.Services.AddScoped<Lefarma.API.Domain.Interfaces.EducacionMedica.ITipoGerenciaRepository, Lefarma.API.Infrastructure.Data.Repositories.EducacionMedica.TipoGerenciaRepository>();
builder.Services.AddScoped<Lefarma.API.Domain.Interfaces.EducacionMedica.IParametroAnestesiaRepository, Lefarma.API.Infrastructure.Data.Repositories.EducacionMedica.ParametroAnestesiaRepository>();
builder.Services.AddScoped<Lefarma.API.Domain.Interfaces.EducacionMedica.IEquipoPareoRepository, Lefarma.API.Infrastructure.Data.Repositories.EducacionMedica.EquipoPareoRepository>();
builder.Services.AddScoped<Lefarma.API.Domain.Interfaces.EducacionMedica.ISeleccionMensualRepository, Lefarma.API.Infrastructure.Data.Repositories.EducacionMedica.SeleccionMensualRepository>();
builder.Services.AddScoped<Lefarma.API.Domain.Interfaces.EducacionMedica.IRutaRepository, Lefarma.API.Infrastructure.Data.Repositories.EducacionMedica.RutaRepository>();
builder.Services.AddScoped<Lefarma.API.Domain.Interfaces.EducacionMedica.IParametroModuloRepository, Lefarma.API.Infrastructure.Data.Repositories.EducacionMedica.ParametroModuloRepository>();
builder.Services.AddScoped<Lefarma.API.Domain.Interfaces.EducacionMedica.IRegionRepository, Lefarma.API.Infrastructure.Data.Repositories.EducacionMedica.RegionRepository>();

builder.Services.AddScoped<Lefarma.API.Features.EducacionMedica.IHospitalService, Lefarma.API.Features.EducacionMedica.HospitalService>();
builder.Services.AddScoped<Lefarma.API.Features.EducacionMedica.IProductoService, Lefarma.API.Features.EducacionMedica.ProductoService>();
builder.Services.AddScoped<Lefarma.API.Features.EducacionMedica.ITipoGerenciaService, Lefarma.API.Features.EducacionMedica.TipoGerenciaService>();
builder.Services.AddScoped<Lefarma.API.Features.EducacionMedica.IParametroAnestesiaService, Lefarma.API.Features.EducacionMedica.ParametroAnestesiaService>();
builder.Services.AddScoped<Lefarma.API.Features.EducacionMedica.IEquipoPareoService, Lefarma.API.Features.EducacionMedica.EquipoPareoService>();
builder.Services.AddScoped<Lefarma.API.Features.EducacionMedica.IPersonasService, Lefarma.API.Features.EducacionMedica.PersonasService>();
builder.Services.AddScoped<Lefarma.API.Features.EducacionMedica.ISeleccionEjecutivoService, Lefarma.API.Features.EducacionMedica.SeleccionEjecutivoService>();
builder.Services.AddScoped<Lefarma.API.Features.EducacionMedica.IAsignadorEspecialistasService, Lefarma.API.Features.EducacionMedica.AsignadorEspecialistasService>();
builder.Services.AddScoped<Lefarma.API.Features.EducacionMedica.ICalendarioService, Lefarma.API.Features.EducacionMedica.CalendarioService>();
builder.Services.AddScoped<Lefarma.API.Features.EducacionMedica.IEjecutivoElegibilidadService, Lefarma.API.Features.EducacionMedica.EjecutivoElegibilidadService>();
        builder.Services.AddScoped<Lefarma.API.Features.EducacionMedica.ISeleccionMensualService, Lefarma.API.Features.EducacionMedica.SeleccionMensualService>();
        builder.Services.AddScoped<Lefarma.API.Features.EducacionMedica.IRutasService, Lefarma.API.Features.EducacionMedica.RutasService>();
        builder.Services.AddScoped<Lefarma.API.Features.EducacionMedica.IAprobacionesService, Lefarma.API.Features.EducacionMedica.AprobacionesService>();
        builder.Services.AddScoped<Lefarma.API.Features.EducacionMedica.ITalleresService, Lefarma.API.Features.EducacionMedica.TalleresService>();
        builder.Services.AddScoped<Lefarma.API.Features.EducacionMedica.ITalleresVisitaService, Lefarma.API.Features.EducacionMedica.TalleresVisitaService>();
builder.Services.AddScoped<Lefarma.API.Features.EducacionMedica.ITallerImparticionService, Lefarma.API.Features.EducacionMedica.TallerImparticionService>();
builder.Services.AddScoped<Lefarma.API.Features.EducacionMedica.IAjustePostCierreService, Lefarma.API.Features.EducacionMedica.AjustePostCierreService>();
        builder.Services.AddScoped<Lefarma.API.Features.EducacionMedica.IMatrizTalleresService, Lefarma.API.Features.EducacionMedica.MatrizTalleresService>();
        builder.Services.AddScoped<Lefarma.API.Features.EducacionMedica.IDashboardService, Lefarma.API.Features.EducacionMedica.DashboardService>();
builder.Services.AddScoped<Lefarma.API.Features.EducacionMedica.IParametroModuloService, Lefarma.API.Features.EducacionMedica.ParametroModuloService>();
builder.Services.AddScoped<Lefarma.API.Features.EducacionMedica.IRegionService, Lefarma.API.Features.EducacionMedica.RegionService>();
builder.Services.AddScoped<Lefarma.API.Features.EducacionMedica.Services.IRankingHospitalesService, Lefarma.API.Features.EducacionMedica.Services.RankingHospitalesService>();
builder.Services.AddScoped<Lefarma.API.Features.EducacionMedica.Services.IConfigRankingService, Lefarma.API.Features.EducacionMedica.Services.ConfigRankingService>();

builder.Services.AddScoped<IWorkflowNotificationDispatcher, WorkflowNotificationDispatcher>();
builder.Services.AddScoped<WorkflowReminderService>();

builder.Services.AddKeyedScoped<IWorkflowActionHandler, FieldWorkflowHandler>("Field");
builder.Services.AddKeyedScoped<IWorkflowActionHandler, DocumentWorkflowHandler>("Document");
builder.Services.AddKeyedScoped<IWorkflowActionHandler, ArchivoWorkflowHandler>("Archivo");
builder.Services.AddKeyedScoped<IWorkflowActionHandler, ProviderAuthorizationWorkflowHandler>("ProviderAuthorization");
builder.Services.AddKeyedScoped<IWorkflowActionHandler, AlertaWorkflowHandler>("Alerta");

builder.Services.AddScoped<IEmpresaService, EmpresaService>();
builder.Services.AddScoped<ISucursalService, SucursalService>();
builder.Services.AddScoped<ITipoGastoService, TipoGastoService>();
builder.Services.AddScoped<IAreaService, AreaService>();
builder.Services.AddScoped<IMedidaService, MedidaService>();
builder.Services.AddScoped<IUnidadMedidaService, UnidadMedidaService>();
builder.Services.AddScoped<IMedioPagoService, MedioPagoService>();
builder.Services.AddScoped<Lefarma.API.Features.Catalogos.Monedas.IMonedaService, Lefarma.API.Features.Catalogos.Monedas.MonedaService>();
builder.Services.AddScoped<IFormaPagoService, FormaPagoService>();
builder.Services.AddScoped<IBancoService, BancoService>();
builder.Services.AddScoped<Lefarma.API.Features.Auth.Usuarios.IUsuarioCatalogService, Lefarma.API.Features.Auth.Usuarios.UsuarioCatalogService>();
builder.Services.AddScoped<Lefarma.API.Features.Auth.Roles.IRolCatalogService, Lefarma.API.Features.Auth.Roles.RolCatalogService>();

builder.Services.AddScoped<Lefarma.API.Features.Dashboard.IDashboardService, Lefarma.API.Features.Dashboard.DashboardService>();

builder.Services.AddScoped<ICentroCostoService, CentroCostoService>();
builder.Services.AddScoped<IEstatusOrdenService, EstatusOrdenService>();
builder.Services.AddScoped<IRegimenFiscalService, RegimenFiscalService>();
builder.Services.AddScoped<IProveedorService, ProveedorService>();
builder.Services.AddScoped<ICuentaContableService, CuentaContableService>();
builder.Services.AddScoped<ITipoImpuestoService, TipoImpuestoService>();

builder.Services.AddScoped<IErrorLogService, ErrorLogService>();
builder.Services.AddScoped<IBusinessAuditLogService, BusinessAuditLogService>();

builder.Services.AddActiveDirectoryServices(builder.Configuration);
builder.Services.AddJwtTokenServices(builder.Configuration);
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IAdminService, AdminService>();
    builder.Services.AddScoped<IProfileService, ProfileService>();
    builder.Services.AddScoped<IFirmasService, FirmasService>();
    builder.Services.AddSingleton<ISseService, SseService>();
builder.Services.AddSingleton<ISseTicketService, SseTicketService>();
builder.Services.AddMemoryCache();

builder.Services.AddScoped<Lefarma.API.Features.Configuracion.IConfiguracionService,
                           Lefarma.API.Features.Configuracion.ConfiguracionService>();
builder.Services.AddScoped<Lefarma.API.Features.Configuracion.IConfiguracionModulosService,
                           Lefarma.API.Features.Configuracion.ConfiguracionModulosService>();
builder.Services.AddScoped<Lefarma.API.Features.Configuracion.IConfiguracionRuntimeService,
                           Lefarma.API.Features.Configuracion.ConfiguracionRuntimeService>();
builder.Services.AddScoped<Lefarma.API.Features.Configuracion.IConfiguracionIntegracionesService,
                           Lefarma.API.Features.Configuracion.ConfiguracionIntegracionesService>();
builder.Services.AddScoped<Lefarma.API.Features.Configuracion.IIntegracionApiKeyService,
                           Lefarma.API.Features.Configuracion.IntegracionApiKeyService>();

builder.Services.Configure<CapturasSettings>(builder.Configuration.GetSection("CapturasSettings"));
builder.Services.AddSingleton<ICapturasScriptRunner, NodeCapturasScriptRunner>();
builder.Services.AddSingleton<CapturasService>();

builder.Services.Configure<Lefarma.API.Features.Telemetria.TelemetriaOpciones>(
    builder.Configuration.GetSection(Lefarma.API.Features.Telemetria.TelemetriaOpciones.Seccion));
builder.Services.AddSingleton<Lefarma.API.Features.Telemetria.Cola.TelemetriaCola>();
builder.Services.AddSingleton<Lefarma.API.Features.Telemetria.Escritor.TelemetriaEscritor>();
builder.Services.AddHostedService(sp => sp.GetRequiredService<Lefarma.API.Features.Telemetria.Escritor.TelemetriaEscritor>());
builder.Services.AddScoped<Lefarma.API.Features.Telemetria.Almacen.TelemetriaRepositorio>();
builder.Services.AddScoped<Lefarma.API.Features.Telemetria.Ingesta.IAtribucionUsuario, Lefarma.API.Features.Telemetria.Ingesta.AtribucionUsuario>();
builder.Services.AddScoped<Lefarma.API.Features.Telemetria.Ingesta.TelemetriaIngesta>();
builder.Services.AddScoped<Lefarma.API.Features.Telemetria.Consulta.ITelemetriaConsulta, Lefarma.API.Features.Telemetria.Consulta.TelemetriaConsulta>();
builder.Services.Configure<Lefarma.API.Features.Telemetria.Avisos.TelemetriaAvisosOpciones>(
    builder.Configuration.GetSection(Lefarma.API.Features.Telemetria.Avisos.TelemetriaAvisosOpciones.Seccion));
builder.Services.AddSingleton<Lefarma.API.Features.Telemetria.Avisos.TelemetriaAvisos>();
builder.Services.AddHostedService(sp => sp.GetRequiredService<Lefarma.API.Features.Telemetria.Avisos.TelemetriaAvisos>());
var seccionDeteccion = builder.Configuration.GetSection("DeteccionPrecioSettings");
if (!seccionDeteccion.GetChildren().Any())
{
    seccionDeteccion = builder.Configuration.GetSection("DeteccionVuelosSettings");
}
builder.Services.Configure<DeteccionPrecioSettings>(seccionDeteccion);
builder.Services.AddHttpClient("firecrawl", c =>
{
    c.Timeout = TimeSpan.FromSeconds(120);
});
builder.Services.AddSingleton<IDeteccionPrecioVueloService, DeteccionPrecioVueloService>();
builder.Services.AddSingleton<IDeteccionPrecioOtrosService, DeteccionPrecioOtrosService>();
builder.Services.AddSingleton<IDeteccionPrecioService, DeteccionPrecioService>();
builder.Services.AddSingleton<DeteccionPrecioPreviewGate>();
builder.Services.AddSingleton<IDeteccionAutomaticaQueue, DeteccionAutomaticaQueue>();
builder.Services.AddHostedService<DeteccionAutomaticaHostedService>();

builder.Services.AddScoped<Lefarma.API.Domain.Interfaces.ITemplateService, TemplateService>();
builder.Services.AddScoped<Lefarma.API.Domain.Interfaces.INotificationService, Lefarma.API.Features.Notifications.Services.NotificationService>();

builder.Services.Configure<EmailSettings>(builder.Configuration.GetSection("EmailSettings"));
builder.Services.AddOptions<EmailSettings>()
    .Validate(x => !string.IsNullOrWhiteSpace(x.SmtpServer), "SmtpServer is required")
    .Validate(x => !string.IsNullOrWhiteSpace(x.FromEmail), "FromEmail is required")
    .Validate(x => x.SmtpPort > 0 && x.SmtpPort <= 65535, "SmtpPort must be between 1 and 65535")
    ;

builder.Services.AddKeyedScoped<Lefarma.API.Domain.Interfaces.INotificationChannel, Lefarma.API.Features.Notifications.Services.Channels.EmailNotificationChannel>("email");
builder.Services.AddKeyedScoped<Lefarma.API.Domain.Interfaces.INotificationChannel, Lefarma.API.Features.Notifications.Services.Channels.TelegramNotificationChannel>("telegram");
builder.Services.AddKeyedScoped<Lefarma.API.Domain.Interfaces.INotificationChannel, Lefarma.API.Features.Notifications.Services.Channels.InAppNotificationChannel>("in-app");

builder.Services.Configure<SigmaOptions>(builder.Configuration.GetSection(SigmaOptions.SectionName));
builder.Services.Configure<DocumentosNotificacionesOptions>(
    builder.Configuration.GetSection(DocumentosNotificacionesOptions.SectionName));
builder.Services.Configure<SigmaPdfSignatureOptions>(
    builder.Configuration.GetSection(SigmaPdfSignatureOptions.SectionName));
builder.Services.AddScoped<SigmaDb>();
builder.Services.AddScoped<SigmaDocumentStorage>();
builder.Services.AddScoped<SigmaDocumentoEmailService>();
builder.Services.AddScoped<SigmaDocumentAccess>();
builder.Services.AddScoped<SigmaIdentity>();
builder.Services.AddSingleton<SigmaVisitorTokenService>();
builder.Services.AddScoped<IPdfDocumentStore, PdfDocumentStore>();
builder.Services.AddScoped<RasterStampRenderer>();
builder.Services.AddScoped<VectorStampRenderer>();
builder.Services.AddScoped<CSharpPdfSignatureEngine>();
builder.Services.AddScoped<PythonPdfSignatureEngine>();
builder.Services.AddScoped<SigmaPdfSignatureRunner>();

builder.Services.Configure<TelegramSettings>(builder.Configuration.GetSection("TelegramSettings"));
builder.Services.AddOptions<TelegramSettings>()
    .Validate(x => !string.IsNullOrWhiteSpace(x.BotToken), "BotToken is required")
    .Validate(x => !string.IsNullOrWhiteSpace(x.ApiUrl), "ApiUrl is required")
    .ValidateOnStart();

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

builder.Services.AddAuthorization(options =>
{
});

builder.Services.AddSingleton<IAuthorizationPolicyProvider, DynamicPermissionPolicyProvider>();

builder.Services.AddScoped<UserPermissionService>();
builder.Services.AddScoped<IAuthorizationHandler, PermissionHandler>();
builder.Services.AddScoped<IAuthorizationHandler, AnyPermissionHandler>();

builder.Services.AddControllers(options =>
{
    options.Filters.Add<ValidationFilter>();
    options.ModelBinderProviders.Insert(0, new DecimalModelBinderProvider());
})
.AddJsonOptions(options =>
{
    options.JsonSerializerOptions.PropertyNameCaseInsensitive = true;
});

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

builder.Services.AddCors(options =>
{
    options.AddPolicy("CorsPolicy", policy =>
    {
        policy.AllowAnyOrigin()
                  .AllowAnyHeader()
                  .AllowAnyMethod();
    });
});

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy(Lefarma.API.Features.Telemetria.Ingesta.TelemetriaRateLimit.Politica, contexto =>
        RateLimitPartition.GetFixedWindowLimiter(
            Lefarma.API.Features.Telemetria.Ingesta.TelemetriaRateLimit.Particion(contexto),
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = Lefarma.API.Features.Telemetria.Ingesta.TelemetriaRateLimit.PorMinuto,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
                AutoReplenishment = true
            }));
    options.AddPolicy(Lefarma.API.Features.Telemetria.Ingesta.TelemetriaRateLimit.PoliticaAnonima, contexto =>
        RateLimitPartition.GetFixedWindowLimiter(
            Lefarma.API.Features.Telemetria.Ingesta.TelemetriaRateLimit.ParticionAnonima(contexto),
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = Lefarma.API.Features.Telemetria.Ingesta.TelemetriaRateLimit.AnonimoPorMinuto,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
                AutoReplenishment = true
            }));
});

// Compresión de respuestas (JSON de API, JS, CSS, HTML, SVG). Reduce el tiempo
// de descarga del bundle y de las respuestas de datos en redes lentas o VPN.
builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
    options.Providers.Add<BrotliCompressionProvider>();
    options.Providers.Add<GzipCompressionProvider>();
    options.MimeTypes = ResponseCompressionDefaults.MimeTypes.Concat(new[]
    {
        "application/json",
        "application/manifest+json",
        "image/svg+xml",
        "application/wasm",
    });
});
builder.Services.Configure<BrotliCompressionProviderOptions>(options =>
{
    options.Level = CompressionLevel.Fastest;
});
builder.Services.Configure<GzipCompressionProviderOptions>(options =>
{
    options.Level = CompressionLevel.Fastest;
});

builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<IWideEventAccessor>(sp =>
{
    var httpContextAccessor = sp.GetRequiredService<IHttpContextAccessor>();
    var httpContext = httpContextAccessor.HttpContext;
    return httpContext != null
        ? new HttpContextWideEventAccessor(httpContext)
        : new NullWideEventAccessor();
});

builder.Services.Configure<Microsoft.AspNetCore.Http.Features.FormOptions>(options =>
{
    options.MultipartBodyLengthLimit = 10_000_000; 
});

builder.WebHost.ConfigureKestrel(options =>
{
    options.Limits.MaxRequestBodySize = 10_000_000; 
});

var app = builder.Build();

var pathBase = builder.Configuration["AppSettings:PathBase"];
if (!string.IsNullOrEmpty(pathBase))
{
    app.UsePathBase(pathBase);
}

app.UseCors("CorsPolicy");
app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("./v1/swagger.json", "Lefarma API v1");
});

app.UseHttpsRedirection();

app.UseResponseCompression();

app.Use(async (context, next) =>
{
    var ruta = context.Request.Path;
    if (ruta.StartsWithSegments("/api/media/capturas-viaticos")
        || ruta.StartsWithSegments("/media/capturas-viaticos"))
    {
        context.Response.StatusCode = StatusCodes.Status404NotFound;
        return;
    }

    await next();
});

app.UseDefaultFiles();
app.UseStaticFiles(new StaticFileOptions
{
    OnPrepareResponse = ctx =>
    {
        var path = ctx.Context.Request.Path.Value ?? string.Empty;
        // Los assets de Vite llevan hash en el nombre: se pueden cachear un año.
        if (path.Contains("/assets/", StringComparison.OrdinalIgnoreCase))
        {
            ctx.Context.Response.Headers.CacheControl = "public,max-age=31536000,immutable";
        }
        else
        {
            // index.html y el resto deben revalidarse para recibir versiones nuevas.
            ctx.Context.Response.Headers.CacheControl = "no-cache";
        }
    }
});

app.UseSerilogRequestLogging(options =>
{
    options.MessageTemplate = "HTTP {RequestMethod} {RequestPath} responded {StatusCode}";
    options.GetLevel = (httpContext, elapsed, ex) => LogEventLevel.Fatal; 
});

app.UseWideEventLogging();

var archivosBasePath = builder.Configuration["ArchivosSettings:BasePath"]
    ?? Path.Combine(app.Environment.WebRootPath, "media", "archivos");

if (!Path.IsPathRooted(archivosBasePath))
{
    archivosBasePath = Path.GetFullPath(Path.Combine(app.Environment.ContentRootPath, archivosBasePath));
}

app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(archivosBasePath),
    RequestPath = "/api/media/archivos",
    OnPrepareResponse = ctx =>
    {
        ctx.Context.Response.Headers.Append("Cache-Control", "no-cache, no-store, must-revalidate");
        ctx.Context.Response.Headers.Append("Pragma", "no-cache");
        ctx.Context.Response.Headers.Append("Expires", "0");
    }
});

app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(archivosBasePath),
    RequestPath = "/media/archivos",
    OnPrepareResponse = ctx =>
    {
        ctx.Context.Response.Headers.Append("Cache-Control", "no-cache, no-store, must-revalidate");
        ctx.Context.Response.Headers.Append("Pragma", "no-cache");
        ctx.Context.Response.Headers.Append("Expires", "0");
    }
});

app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(
        Path.Combine(app.Environment.WebRootPath, "media", "help")),
    RequestPath = "/api/media/help",
    OnPrepareResponse = ctx =>
    {
        ctx.Context.Response.Headers.Append("Cache-Control", "public,max-age=31536000");
    }
});

var capturasDir = Path.Combine(app.Environment.WebRootPath, "media", "capturas-viaticos");
Directory.CreateDirectory(capturasDir);

app.UseAuthentication();

if (app.Environment.IsDevelopment())
{
    app.UseDevToken();
}

app.UseAuthorization();

app.UseRateLimiter();

var startedAtUtc = DateTime.UtcNow;
app.Lifetime.ApplicationStarted.Register(() => startedAtUtc = DateTime.UtcNow);

var appVersion = System.Reflection.Assembly.GetExecutingAssembly()
    .GetCustomAttributes(typeof(System.Reflection.AssemblyMetadataAttribute), false)
    .Cast<System.Reflection.AssemblyMetadataAttribute>()
    .FirstOrDefault(a => a.Key == "AppVersion")?.Value ?? "dev";

app.MapGet("/api/health", (HttpContext http) =>
{
    var ahora = DateTime.UtcNow;

    http.Response.Headers.CacheControl = "no-store";

    return Results.Ok(new
    {
        status = "ok",
        version = appVersion,
        startedAt = startedAtUtc,
        uptimeSeconds = (long)(ahora - startedAtUtc).TotalSeconds,
        timestamp = ahora
    });
})
.AllowAnonymous();

app.MapGet("/api/version", () => Results.Ok(new { version = appVersion }))
   .AllowAnonymous();

app.MapControllers();

app.MapFallbackToFile("/index.html", new StaticFileOptions
{
    OnPrepareResponse = ctx =>
    {
        // El HTML de entrada nunca se cachea: así el siguiente despliegue se ve al instante.
        ctx.Context.Response.Headers.CacheControl = "no-cache";
    }
});

app.Lifetime.ApplicationStarted.Register(() =>
{
    _ = Task.Run(async () =>
    {
        try
        {
            using var scope = app.Services.CreateScope();

            foreach (var tipoContexto in new[]
            {
                typeof(Lefarma.API.Infrastructure.Data.ApplicationDbContext),
                typeof(Lefarma.API.Infrastructure.Data.AsokamDbContext),
            })
            {
                try
                {
                    var contexto = (DbContext)scope.ServiceProvider.GetRequiredService(tipoContexto);
                    _ = contexto.Model;
                    await contexto.Database.OpenConnectionAsync(CancellationToken.None);
                    await contexto.Database.CloseConnectionAsync();
                }
                catch (Exception ex)
                {
                    app.Logger.LogWarning(ex, "Calentamiento de {Contexto} falló.", tipoContexto.Name);
                }
            }

            var atribucion = scope.ServiceProvider
                .GetRequiredService<Lefarma.API.Features.Telemetria.Ingesta.IAtribucionUsuario>();
            await atribucion.ObtenerHashAsync("calentamiento", CancellationToken.None);
        }
        catch (Exception ex)
        {
            app.Logger.LogWarning(
                ex,
                "Calentamiento de base de datos falló; la primera petición pagará el arranque en frío.");
        }
    });
});

app.Run();

public partial class Program { }
