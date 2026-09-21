using System.Text.Json;
using System.Text.Json.Nodes;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Shared.Constants;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Features.Config.Workflows.Handlers
{
    /// <summary>
    /// Maneja campos Archivo genéricos: valida que exista un archivo activo de la entidad
    /// etiquetado con el nombre técnico del campo (metadata.tipo = campo.NombreTecnico).
    /// Si la configuración trae {"requiereRevision":true}, exige que el paso actual haya
    /// quedado marcado como revisado y registra la revisión en el metadata del archivo.
    /// Aplica a solicitudes de personal y órdenes de compra.
    /// </summary>
    public class ArchivoWorkflowHandler : IWorkflowActionHandler
    {
        private readonly ApplicationDbContext _context;

        public ArchivoWorkflowHandler(ApplicationDbContext context)
        {
            _context = context;
        }

        public string HandlerKey => "Archivo";

        public IReadOnlySet<string> TiposEntidadCompatibles => new HashSet<string>
        {
            CodigoProceso.SOLICITUD_PERSONAL,
            CodigoProceso.ORDEN_COMPRA
        };

        public async Task<HandlerResult> ProcessAsync(WorkflowHandlerContext context, string? configJson)
        {
            if (context.Handler?.Campo is not { } campo)
                return HandlerResult.Fail("Archivo: el handler no tiene un campo vinculado.");

            if (!context.Handler.Requerido)
                return HandlerResult.Ok();

            var entidadTipo = context.TipoEntidad switch
            {
                CodigoProceso.SOLICITUD_PERSONAL => "SolicitudPersonal",
                CodigoProceso.ORDEN_COMPRA => "OrdenCompra",
                _ => context.TipoEntidad
            };

            var coincidentes = await _context.Archivos
                .Where(a => a.EntidadTipo == entidadTipo
                    && a.EntidadId == context.IdEntidad
                    && a.Activo)
                .ToListAsync();

            coincidentes = coincidentes
                .Where(a => ObtenerTipoMetadata(a.Metadata) == campo.NombreTecnico)
                .ToList();

            if (coincidentes.Count == 0)
                return HandlerResult.Fail($"Falta adjuntar: {campo.EtiquetaUsuario}.");

            if (!RequiereRevision(configJson))
                return HandlerResult.Ok();

            var clavePaso = (context.IdPaso ?? 0).ToString();

            if (coincidentes.Any(a => TieneRevision(a.Metadata, clavePaso)))
                return HandlerResult.Ok();

            if (!ElUsuarioMarcoRevision(context, campo.NombreTecnico))
                return HandlerResult.Fail($"Falta marcar como revisado: {campo.EtiquetaUsuario}.");

            foreach (var archivo in coincidentes)
            {
                archivo.Metadata = AgregarRevision(
                    archivo.Metadata, clavePaso, context.IdUsuario, context.Comentario);
            }

            await _context.SaveChangesAsync();
            return HandlerResult.Ok();
        }

        private static bool RequiereRevision(string? configJson)
        {
            if (string.IsNullOrWhiteSpace(configJson))
                return false;

            try
            {
                using var doc = JsonDocument.Parse(configJson);
                return doc.RootElement.ValueKind == JsonValueKind.Object
                    && doc.RootElement.TryGetProperty("requiereRevision", out var valor)
                    && valor.ValueKind == JsonValueKind.True;
            }
            catch
            {
                return false;
            }
        }

        private static bool ElUsuarioMarcoRevision(WorkflowHandlerContext context, string nombreTecnico)
        {
            if (context.DatosAdicionales is null)
                return false;

            if (!context.DatosAdicionales.TryGetValue($"revision_{nombreTecnico}", out var flag) || flag is null)
                return false;

            return flag is bool valor
                ? valor
                : string.Equals(flag.ToString(), "true", StringComparison.OrdinalIgnoreCase);
        }

        private static string? ObtenerTipoMetadata(string? metadata)
        {
            if (string.IsNullOrWhiteSpace(metadata))
                return null;

            try
            {
                using var doc = JsonDocument.Parse(metadata);
                return doc.RootElement.ValueKind == JsonValueKind.Object
                    && doc.RootElement.TryGetProperty("tipo", out var tipo)
                    ? tipo.GetString()
                    : null;
            }
            catch
            {
                return null;
            }
        }

        private static bool TieneRevision(string? metadata, string clavePaso)
        {
            if (string.IsNullOrWhiteSpace(metadata))
                return false;

            try
            {
                using var doc = JsonDocument.Parse(metadata);
                if (doc.RootElement.ValueKind != JsonValueKind.Object)
                    return false;

                if (!doc.RootElement.TryGetProperty("revisiones", out var revisiones)
                    || revisiones.ValueKind != JsonValueKind.Object)
                    return false;

                return revisiones.TryGetProperty(clavePaso, out var entrada)
                    && entrada.ValueKind == JsonValueKind.Object
                    && entrada.TryGetProperty("revisado", out var revisado)
                    && revisado.ValueKind == JsonValueKind.True;
            }
            catch
            {
                return false;
            }
        }

        private static string AgregarRevision(
            string? metadata, string clavePaso, int idUsuario, string? comentario)
        {
            JsonObject root;
            if (string.IsNullOrWhiteSpace(metadata))
            {
                root = new JsonObject();
            }
            else
            {
                try
                {
                    root = JsonNode.Parse(metadata) as JsonObject
                        ?? new JsonObject { ["observaciones"] = metadata };
                }
                catch
                {
                    root = new JsonObject { ["observaciones"] = metadata };
                }
            }

            if (root["revisiones"] is not JsonObject revisiones)
            {
                revisiones = new JsonObject();
                root["revisiones"] = revisiones;
            }

            revisiones[clavePaso] = new JsonObject
            {
                ["revisado"] = true,
                ["idUsuario"] = idUsuario,
                ["fecha"] = DateTime.Now.ToString("o"),
                ["comentario"] = comentario
            };

            return root.ToJsonString();
        }
    }
}
