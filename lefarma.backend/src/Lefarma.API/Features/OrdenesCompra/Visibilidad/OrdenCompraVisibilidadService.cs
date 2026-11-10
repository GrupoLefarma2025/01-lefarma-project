using Lefarma.API.Domain.Entities.Config;
using Lefarma.API.Domain.Entities.Operaciones;
using Lefarma.API.Domain.Interfaces.Config;
using Lefarma.API.Domain.ValueObjects.Config;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Services.Identity;
using Lefarma.API.Shared.Constants;
using Microsoft.EntityFrameworkCore;
using System.Linq.Expressions;

namespace Lefarma.API.Features.OrdenesCompra.Visibilidad;

/// <summary>
/// Resuelve y aplica el alcance de visibilidad de las órdenes de compra en un solo
/// punto (ADR 00001). Permisos desde la BD (no claims), roles vigentes desde Asokam,
/// empresas desde <c>config.usuario_alcance_empresa</c> y flujos desde
/// <c>config.workflow_mappings</c> / <c>config.workflow_participantes</c>.
/// </summary>
public class OrdenCompraVisibilidadService : IOrdenCompraVisibilidadService
{
    private const string ScopeUsuario = "USUARIO";

    // Estados que no exponen una orden por el simple hecho de estar detenida en un paso:
    // Creada (1), Rechazada (7) y Cancelada (9).
    private const int EstadoCreada = 1;
    private const int EstadoRechazada = 7;
    private const int EstadoCancelada = 9;

    private readonly ApplicationDbContext _context;
    private readonly AsokamDbContext _asokamContext;
    private readonly UserPermissionService _permissionService;
    private readonly IJefeInmediatoResolver _jefeInmediatoResolver;

    public OrdenCompraVisibilidadService(
        ApplicationDbContext context,
        AsokamDbContext asokamContext,
        UserPermissionService permissionService,
        IJefeInmediatoResolver jefeInmediatoResolver)
    {
        _context = context;
        _asokamContext = asokamContext;
        _permissionService = permissionService;
        _jefeInmediatoResolver = jefeInmediatoResolver;
    }

    public async Task<AlcanceOrdenCompra> ResolverAsync(int idUsuario, CancellationToken ct = default)
    {
        if (idUsuario <= 0)
            return AlcanceOrdenCompra.Vacio(idUsuario);

        var permisos = await _permissionService.GetPermissionsAsync(idUsuario);
        if (permisos.Contains(Permissions.OrdenesCompra.VerTodas))
            return AlcanceOrdenCompra.Vacio(idUsuario) with { VerTodas = true };

        // Roles vigentes en Asokam (por id de rol, nunca por el nombre del claim).
        var roles = await (
                from ur in _asokamContext.UsuariosRoles.AsNoTracking()
                join rol in _asokamContext.Roles.AsNoTracking() on ur.IdRol equals rol.IdRol
                where ur.IdUsuario == idUsuario
                      && rol.EsActivo
                      && (ur.FechaExpiracion == null || ur.FechaExpiracion > DateTime.UtcNow)
                select ur.IdRol)
            .Distinct()
            .ToListAsync(ct);

        // Empresas asignadas: solo con el permiso y solo filas activas (fail-closed).
        var empresas = new List<int>();
        if (permisos.Contains(Permissions.OrdenesCompra.VerPorEmpresa))
        {
            empresas = await _context.UsuariosAlcanceEmpresa.AsNoTracking()
                .Where(a => a.IdUsuario == idUsuario && a.Activo)
                .Select(a => a.IdEmpresa)
                .Distinct()
                .ToListAsync(ct);
        }

        // Alcance base: pasos donde el usuario participa, por usuario o por rol vigente.
        var pasosParticipante = await ParticipantesDelUsuario(idUsuario, roles)
            .Select(p => p.IdPaso)
            .Distinct()
            .ToListAsync(ct);

        // Flujos: mappings con scope USUARIO del usuario + workflows donde participa.
        var workflows = new List<int>();
        if (permisos.Contains(Permissions.OrdenesCompra.VerPorFlujo))
        {
            var scopeTypesUsuario = await _context.WorkflowScopeTypes.AsNoTracking()
                .Where(s => s.Codigo.ToUpper() == ScopeUsuario)
                .Select(s => s.IdScopeType)
                .ToListAsync(ct);

            var workflowsOrdenCompra = _context.Workflows.AsNoTracking()
                .Where(w => w.Activo && w.CodigoProceso == CodigoProceso.ORDEN_COMPRA)
                .Select(w => w.IdWorkflow);

            var porMapping = scopeTypesUsuario.Count == 0
                ? new List<int>()
                : await _context.WorkflowMappings.AsNoTracking()
                    .Where(m => m.Activo
                                && m.CodigoProceso == CodigoProceso.ORDEN_COMPRA
                                && m.ScopeId == idUsuario
                                && scopeTypesUsuario.Contains(m.IdScopeType)
                                && workflowsOrdenCompra.Contains(m.IdWorkflow))
                    .Select(m => m.IdWorkflow)
                    .Distinct()
                    .ToListAsync(ct);

            var porParticipante = await (
                    from p in ParticipantesDelUsuario(idUsuario, roles)
                    join paso in _context.WorkflowPasos.AsNoTracking() on p.IdPaso equals paso.IdPaso
                    join w in _context.Workflows.AsNoTracking() on paso.IdWorkflow equals w.IdWorkflow
                    where paso.Activo
                          && w.Activo
                          && w.CodigoProceso == CodigoProceso.ORDEN_COMPRA
                    select w.IdWorkflow)
                .Distinct()
                .ToListAsync(ct);

            workflows = porMapping.Concat(porParticipante).Distinct().ToList();
        }

        // Jefe inmediato: nivel mínimo por paso que lo requiere.
        var pasosConJefeInmediato = await _context.WorkflowParticipantes.AsNoTracking()
            .Where(p => p.Activo && p.RequiereJefeInmediato)
            .GroupBy(p => p.IdPaso)
            .Select(g => new { IdPaso = g.Key, Nivel = g.Min(p => p.NivelJefe ?? 1) })
            .ToListAsync(ct);

        var nivelPorPaso = pasosConJefeInmediato.ToDictionary(x => x.IdPaso, x => x.Nivel);
        var creadoresPosibles = new HashSet<int>();

        if (nivelPorPaso.Count > 0)
        {
            var pasosJefe = nivelPorPaso.Keys.ToList();
            var ordenesEnPasosJefe = await _context.OrdenesCompra.AsNoTracking()
                .Where(o => o.IdPasoActual.HasValue && pasosJefe.Contains(o.IdPasoActual.Value))
                .Select(o => new { o.IdUsuarioCreador, o.IdPasoActual, o.IdWorkflow })
                .Distinct()
                .ToListAsync(ct);

            // Caché por (workflow, creador, nivel) para no repetir consultas.
            var jefeCache = new Dictionary<(int, int, int), JefeEfectivoResult>();

            foreach (var orden in ordenesEnPasosJefe)
            {
                if (!orden.IdPasoActual.HasValue)
                    continue;
                if (!nivelPorPaso.TryGetValue(orden.IdPasoActual.Value, out var nivel))
                    continue;

                var llave = (orden.IdWorkflow, orden.IdUsuarioCreador, nivel);
                if (!jefeCache.TryGetValue(llave, out var jefe))
                {
                    jefe = await _jefeInmediatoResolver.ResolverJefeEfectivoAsync(
                        orden.IdWorkflow, orden.IdUsuarioCreador, nivel, ct);
                    jefeCache[llave] = jefe;
                }

                if (jefe.IdUsuario.HasValue && jefe.IdUsuario.Value == idUsuario)
                    creadoresPosibles.Add(orden.IdUsuarioCreador);
            }
        }

        return new AlcanceOrdenCompra(
            idUsuario,
            VerTodas: false,
            Empresas: empresas.ToHashSet(),
            Workflows: workflows.ToHashSet(),
            PasosParticipante: pasosParticipante.ToHashSet(),
            NivelPorPaso: nivelPorPaso,
            CreadoresPosibles: creadoresPosibles);
    }

    public IQueryable<OrdenCompra> Aplicar(IQueryable<OrdenCompra> query, AlcanceOrdenCompra alcance)
    {
        ArgumentNullException.ThrowIfNull(query);
        ArgumentNullException.ThrowIfNull(alcance);

        if (alcance.VerTodas)
            return query;

        var idUsuario = alcance.IdUsuario;
        Expression<Func<OrdenCompra, bool>> criterio = o => o.IdUsuarioCreador == idUsuario;

        // Los sets se copian a listas locales para que EF los traduzca y, si están
        // vacíos, se omite esa rama del OR (no amplía ni rompe la traducción).
        var creadoresPosibles = alcance.CreadoresPosibles.ToList();
        if (creadoresPosibles.Count > 0)
            criterio = CombinarConOr(criterio, o => creadoresPosibles.Contains(o.IdUsuarioCreador));

        var empresas = alcance.Empresas.ToList();
        if (empresas.Count > 0)
            criterio = CombinarConOr(criterio, o => empresas.Contains(o.IdEmpresa));

        var workflows = alcance.Workflows.ToList();
        if (workflows.Count > 0)
            criterio = CombinarConOr(criterio, o => workflows.Contains(o.IdWorkflow));

        var pasos = alcance.PasosParticipante.ToList();
        if (pasos.Count > 0)
        {
            criterio = CombinarConOr(criterio, o =>
                o.IdPasoActual.HasValue
                && pasos.Contains(o.IdPasoActual.Value)
                && o.IdEstado != EstadoCreada
                && o.IdEstado != EstadoRechazada
                && o.IdEstado != EstadoCancelada);
        }

        return query.Where(criterio);
    }

    public async Task<bool> PuedeVerAsync(int idOrden, int idUsuario, CancellationToken ct = default)
    {
        if (idOrden <= 0 || idUsuario <= 0)
            return false;

        var alcance = await ResolverAsync(idUsuario, ct);

        var orden = await _context.OrdenesCompra.AsNoTracking()
            .Where(o => o.IdOrden == idOrden)
            .Select(o => new { o.IdUsuarioCreador, o.IdEmpresa, o.IdWorkflow, o.IdPasoActual })
            .FirstOrDefaultAsync(ct);

        if (orden is null)
            return false;

        if (alcance.VerTodas)
            return true;
        if (orden.IdUsuarioCreador == alcance.IdUsuario)
            return true;
        if (alcance.CreadoresPosibles.Contains(orden.IdUsuarioCreador))
            return true;
        if (alcance.Empresas.Contains(orden.IdEmpresa))
            return true;
        if (alcance.Workflows.Contains(orden.IdWorkflow))
            return true;
        if (!orden.IdPasoActual.HasValue)
            return false;
        if (alcance.PasosParticipante.Contains(orden.IdPasoActual.Value))
            return true;

        // El jefe inmediato se resuelve para el paso y creador concretos.
        if (!alcance.NivelPorPaso.TryGetValue(orden.IdPasoActual.Value, out var nivel))
            return false;

        var jefe = await _jefeInmediatoResolver.ResolverJefeEfectivoAsync(
            orden.IdWorkflow, orden.IdUsuarioCreador, nivel, ct);
        return jefe.IdUsuario.HasValue && jefe.IdUsuario.Value == alcance.IdUsuario;
    }

    private IQueryable<WorkflowParticipante> ParticipantesDelUsuario(int idUsuario, List<int> roles)
    {
        var query = _context.WorkflowParticipantes.AsNoTracking().Where(p => p.Activo);
        return roles.Count == 0
            ? query.Where(p => p.IdUsuario == idUsuario)
            : query.Where(p => p.IdUsuario == idUsuario || (p.IdRol != null && roles.Contains(p.IdRol.Value)));
    }

    private static Expression<Func<OrdenCompra, bool>> CombinarConOr(
        Expression<Func<OrdenCompra, bool>>? izquierda,
        Expression<Func<OrdenCompra, bool>> derecha)
    {
        if (izquierda is null)
            return derecha;

        var parametro = Expression.Parameter(typeof(OrdenCompra), "o");
        var visitante = new ReemplazarParametroVisitor(parametro);
        var cuerpo = Expression.OrElse(visitante.Visit(izquierda.Body)!, visitante.Visit(derecha.Body)!);
        return Expression.Lambda<Func<OrdenCompra, bool>>(cuerpo, parametro);
    }

    private sealed class ReemplazarParametroVisitor(ParameterExpression parametro) : ExpressionVisitor
    {
        protected override Expression VisitParameter(ParameterExpression nodo)
            => nodo.Type == parametro.Type ? parametro : base.VisitParameter(nodo);
    }
}
