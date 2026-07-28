using ErrorOr;
using Lefarma.API.Domain.Entities.Config;
using Lefarma.API.Domain.Entities.Operaciones;
using Lefarma.API.Domain.Interfaces.Config;
using Lefarma.API.Domain.ValueObjects.Config;
using Lefarma.API.Features.Config.Workflows.Notification;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Shared.Constants;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Lefarma.API.Features.Config.Workflows;

public static class WorkflowFirmaHelper
{
    /// <summary>
    /// Valida que el usuario puede ejecutar acciones en el paso actual.
    /// - Si es paso inicial y es el creador: siempre puede
    /// - Si hay participantes explícitos: debe estar en la lista (por usuario, por rol, o ser jefe inmediato)
    /// </summary>
    public static async Task<ErrorOr<Success>> ValidarParticipanteAsync(
        WorkflowPaso pasoActual,
        int idWorkflow,
        int idUsuario,
        int idUsuarioCreador,
        AsokamDbContext asokamContext,
        IJefeInmediatoResolver jefeInmediatoResolver,
        string? codigoAccion = null,
        int? idUsuarioSolicitante = null,
        CancellationToken ct = default)
    {
        // Paso inicial: el creador siempre puede ejecutar acciones (es quien envía)
        if (pasoActual.EsInicio && idUsuario == idUsuarioCreador)
            return Result.Success;

        // Si es el creador y la acción es CANCELAR, permitir aunque no sea participante
        if (idUsuario == idUsuarioCreador && codigoAccion == "CANCELAR")
            return Result.Success;

        // Si el paso tiene participantes explícitos, validar
        var participantesActivos = pasoActual.Participantes?.Where(p => p.Activo).ToList() ?? new();
        if (participantesActivos.Count == 0)
            return Result.Success; // Sin participantes = sin restricción

        // Verificar por usuario directo
        var esParticipante = participantesActivos.Any(p => p.IdUsuario == idUsuario);
        if (esParticipante)
            return Result.Success;

        // Verificar por rol del usuario
        var rolesUsuario = await asokamContext.UsuariosRoles
            .Where(ur => ur.IdUsuario == idUsuario
                      && (ur.FechaExpiracion == null || ur.FechaExpiracion > DateTime.Now))
            .Select(ur => ur.IdRol)
            .ToListAsync(ct);

        if (participantesActivos.Any(p => p.IdRol.HasValue && rolesUsuario.Contains(p.IdRol.Value)))
            return Result.Success;

        // Verificar si alguno de los participantes requiere jefe inmediato (por nivel)
        foreach (var p in participantesActivos.Where(p => p.RequiereJefeInmediato))
        {
            var idUsuarioBase = idUsuarioSolicitante ?? idUsuarioCreador;
            var jefe = await jefeInmediatoResolver.ResolverJefeEfectivoAsync(
                idWorkflow, idUsuarioBase, p.NivelJefe ?? 1, ct);
            if (jefe.IdUsuario.HasValue && jefe.IdUsuario.Value == idUsuario)
                return Result.Success;
        }

        return Error.Validation("Autorizacion", "No eres participante de este paso del workflow.");
    }

    /// <summary>
    /// Resuelve la notificación a disparar para (idAccion, idPasoDestino).
    /// Prioridad: match exacto por (idAccion, idPasoDestino) > match por (idAccion, idPasoDestino=null).
    /// </summary>
    public static WorkflowNotificacion? ResolverNotificacion(
        Workflow workflow,
        int idAccion,
        int? idPasoDestino)
    {
        if (workflow.Pasos == null) return null;

        return workflow.Pasos
            .SelectMany(p => p.AccionesOrigen ?? new List<WorkflowAccion>())
            .Where(a => a.IdAccion == idAccion)
            .SelectMany(a => a.Notificaciones ?? new List<WorkflowNotificacion>())
            .Where(n => n.Activo)
            .FirstOrDefault(n => n.IdPasoDestino == idPasoDestino)
            ?? workflow.Pasos
                .SelectMany(p => p.AccionesOrigen ?? new List<WorkflowAccion>())
                .Where(a => a.IdAccion == idAccion)
                .SelectMany(a => a.Notificaciones ?? new List<WorkflowNotificacion>())
                .Where(n => n.Activo && n.IdPasoDestino == null)
                .FirstOrDefault();
    }

    /// <summary>
    /// Despacha la notificación de forma asíncrona (fire-and-forget).
    /// Crea su propio scope porque el DbContext del request HTTP ya terminó.
    /// </summary>
    public static void DispatchNotificacionFireAndForget(
        IServiceScopeFactory scopeFactory,
        WorkflowNotificacion? notificacion,
        string tipoEntidad,
        int idEntidad,
        string folio,
        int idUsuarioCreador,
        Dictionary<string, string>? variablesExtra,
        int? idPasoDestino,
        int idUsuarioActual,
        string? comentario,
        string? contenidoAdicionalHtml = null,
        int? idUsuarioSolicitante = null)
    {
        _ = Task.Run(async () =>
        {
            try
            {
                using var scope = scopeFactory.CreateScope();
                var dispatcher = scope.ServiceProvider
                    .GetRequiredService<IWorkflowNotificationDispatcher>();
                await dispatcher.DispatchAsync(
                    notificacion: notificacion,
                    tipoEntidad: tipoEntidad,
                    idEntidad: idEntidad,
                    folio: folio,
                    idUsuarioCreador: idUsuarioCreador,
                    variablesExtra: variablesExtra,
                    idPasoDestino: idPasoDestino,
                    idUsuarioActual: idUsuarioActual,
                    comentario: comentario,
                    contenidoAdicionalHtml: contenidoAdicionalHtml,
                    idUsuarioSolicitante: idUsuarioSolicitante);
            }
            catch
            {
                // Log silencioso; la firma ya se ejecutó
            }
        });
    }
}