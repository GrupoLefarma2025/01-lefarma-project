using System.Text.Json;
using Lefarma.API.Domain.Entities.EducacionMedica;
using Lefarma.API.Domain.Entities.Operaciones;
using Lefarma.API.Domain.Entities.Rh;
using Lefarma.API.Domain.Interfaces.Config;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Shared.Constants;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Features.Config.Workflows.Handlers
{
    /// <summary>
    /// Evalúa la condición "aplica" del JSON de un handler: el handler solo se ejecuta/muestra
    /// cuando la entidad cumple los scopes indicados. Soporta:
    ///  - SOLICITUD_PERSONAL: tipoSolicitud, categoria, empresa, sucursal, area
    ///  - ORDEN_COMPRA: empresa, sucursal, area, tipoGasto, proveedor
    ///  - EDUCACION_MEDICA_SELECCION / RUTAS: tipoGerencia
    /// Sin condición, con JSON inválido o en procesos no soportados → aplica.
    /// </summary>
    public class HandlerConditionEvaluator
    {
        private readonly ApplicationDbContext _context;

        public HandlerConditionEvaluator(ApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<bool> AplicaAsync(
            string? configuracionJson,
            IWorkflowEntity entidad,
            string tipoEntidad,
            CancellationToken ct = default)
        {
            var aplica = ParsearAplica(configuracionJson);
            if (aplica.Count == 0)
                return true;

            return tipoEntidad switch
            {
                CodigoProceso.SOLICITUD_PERSONAL when entidad is SolicitudPersonal solicitud
                    => await AplicaSolicitudAsync(aplica, solicitud, ct),

                CodigoProceso.ORDEN_COMPRA when entidad is OrdenCompra orden
                    => AplicaOrdenCompra(aplica, orden),

                CodigoProceso.EDUCACION_MEDICA_SELECCION when entidad is SeleccionMensual seleccion
                    => Coincide(aplica, "tipoGerencia", seleccion.IdTipoGerencia),

                CodigoProceso.EDUCACION_MEDICA_RUTAS when entidad is RutaVersion ruta
                    => Coincide(aplica, "tipoGerencia", ruta.IdTipoGerencia),

                _ => true
            };
        }

        public static bool TieneCondiciones(string? configuracionJson)
            => ParsearAplica(configuracionJson).Count > 0;

        private async Task<bool> AplicaSolicitudAsync(
            Dictionary<string, List<int>> aplica, SolicitudPersonal solicitud, CancellationToken ct)
        {
            if (!Coincide(aplica, "tipoSolicitud", solicitud.IdTipoSolicitud))
                return false;

            if (!Coincide(aplica, "empresa", solicitud.IdEmpresa))
                return false;

            if (!Coincide(aplica, "sucursal", solicitud.IdSucursal))
                return false;

            if (!Coincide(aplica, "area", solicitud.IdArea))
                return false;

            if (aplica.TryGetValue("categoria", out var categorias) && categorias.Count > 0)
            {
                var categoria = await _context.TiposSolicitud
                    .AsNoTracking()
                    .Where(t => t.IdTipoSolicitud == solicitud.IdTipoSolicitud)
                    .Select(t => (int?)t.Categoria)
                    .FirstOrDefaultAsync(ct);

                if (!categoria.HasValue || !categorias.Contains(categoria.Value))
                    return false;
            }

            return true;
        }

        private static bool AplicaOrdenCompra(Dictionary<string, List<int>> aplica, OrdenCompra orden)
        {
            if (!Coincide(aplica, "empresa", orden.IdEmpresa))
                return false;

            if (!Coincide(aplica, "sucursal", orden.IdSucursal))
                return false;

            if (!Coincide(aplica, "area", orden.IdArea))
                return false;

            if (!Coincide(aplica, "tipoGasto", orden.IdTipoGasto))
                return false;

            if (!Coincide(aplica, "proveedor", orden.IdProveedor))
                return false;

            return true;
        }

        /// <summary>
        /// true si la clave no viene, viene vacía, o el valor de la entidad está en la lista.
        /// Si la clave viene y el valor de la entidad es nulo → no coincide.
        /// </summary>
        private static bool Coincide(Dictionary<string, List<int>> aplica, string clave, int? valor)
        {
            if (!aplica.TryGetValue(clave, out var ids) || ids.Count == 0)
                return true;

            return valor.HasValue && ids.Contains(valor.Value);
        }

        private static Dictionary<string, List<int>> ParsearAplica(string? configuracionJson)
        {
            var resultado = new Dictionary<string, List<int>>(StringComparer.OrdinalIgnoreCase);
            if (string.IsNullOrWhiteSpace(configuracionJson))
                return resultado;

            try
            {
                using var doc = JsonDocument.Parse(configuracionJson);
                if (doc.RootElement.ValueKind != JsonValueKind.Object
                    || !doc.RootElement.TryGetProperty("aplica", out var aplica)
                    || aplica.ValueKind != JsonValueKind.Object)
                    return resultado;

                foreach (var prop in aplica.EnumerateObject())
                {
                    if (prop.Value.ValueKind != JsonValueKind.Array)
                        continue;

                    var ids = new List<int>();
                    foreach (var item in prop.Value.EnumerateArray())
                    {
                        if (item.ValueKind == JsonValueKind.Number && item.TryGetInt32(out var id) && id > 0)
                            ids.Add(id);
                    }

                    if (ids.Count > 0)
                        resultado[prop.Name] = ids;
                }

                return resultado;
            }
            catch
            {
                return resultado;
            }
        }
    }
}
