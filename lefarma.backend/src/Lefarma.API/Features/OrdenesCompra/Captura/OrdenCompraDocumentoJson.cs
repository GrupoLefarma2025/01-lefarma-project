using System.Text.Json;
using System.Text.Json.Nodes;
using Lefarma.API.Features.OrdenesCompra.Captura.DTOs;

namespace Lefarma.API.Features.OrdenesCompra.Captura
{
    /// <summary>
    /// Helper del documento JSON compartido en OrdenCompra.IdsCuentasBancarias (nvarchar(max)).
    /// Cada flujo escribe SOLO sus propias claves y preserva las demas (merge-on-write).
    /// </summary>
    public static class OrdenCompraDocumentoJson
    {
        // ponytail: read-modify-write sobre una sola columna nvarchar(max). Techo de concurrencia:
        // si dos actores escriben a la vez gana el ultimo (last-writer-wins). Riesgo bajo: un actor por paso de workflow.
        public static string MergeClavesJson(string? jsonActual, IDictionary<string, object?> clavesPropias)
        {
            var raiz = ParseARaiz(jsonActual);
            foreach (var par in clavesPropias)
                raiz[par.Key] = par.Value is null ? null : JsonSerializer.SerializeToNode(par.Value);
            return raiz.ToJsonString();
        }

        // ponytail: el historial vive dentro del mismo JSON y crece sin limite; si el volumen de eventos por orden
        // llega a ser alto, migrar a una tabla de historial. Hoy: pocos eventos por orden.
        public static string AgregarHistorial(string? jsonActual, int idUsuario, string? nombreUsuario, string tipo, string comentario)
        {
            var raiz = ParseARaiz(jsonActual);
            if (raiz["historial"] is not JsonArray historial)
            {
                historial = new JsonArray();
                raiz["historial"] = historial;
            }
            historial.Add(new JsonObject
            {
                ["fecha"] = DateTime.Now,
                ["idUsuario"] = idUsuario,
                ["nombreUsuario"] = nombreUsuario,
                ["tipo"] = tipo,
                ["comentario"] = comentario
            });
            return raiz.ToJsonString();
        }

        public static string AgregarPagoBitacora(string? jsonActual, int idUsuario, string? banco, string? cuenta, string? clabe)
        {
            var raiz = ParseARaiz(jsonActual);
            if (raiz["historial"] is not JsonArray historial)
            {
                historial = new JsonArray();
                raiz["historial"] = historial;
            }
            historial.Add(new JsonObject
            {
                ["fecha"] = DateTime.Now,
                ["idUsuario"] = idUsuario,
                ["banco"] = banco,
                ["cuenta"] = cuenta,
                ["clabe"] = clabe
            });
            return raiz.ToJsonString();
        }

        public static CuentaPagoTesoreroResponse? LeerCuentaPagoTesorero(string? json)
        {
            var raiz = ParseARaiz(json);
            if (raiz["cuentaPagoTesorero"] is not JsonObject obj) return null;
            return new CuentaPagoTesoreroResponse
            {
                IdFormaPago = LeerInt(obj, "idFormaPago"),
                FormaPago = LeerString(obj, "formaPago"),
                IdBanco = LeerInt(obj, "idBanco"),
                Banco = LeerString(obj, "banco"),
                NumeroCuenta = LeerString(obj, "numeroCuenta"),
                Clabe = LeerString(obj, "clabe")
            };
        }

        public static List<HistorialOrdenItemResponse>? LeerHistorial(string? json)
        {
            var raiz = ParseARaiz(json);
            if (raiz["historial"] is not JsonArray arreglo) return null;
            var resultado = new List<HistorialOrdenItemResponse>();
            foreach (var nodo in arreglo)
            {
                if (nodo is not JsonObject o) continue;
                resultado.Add(new HistorialOrdenItemResponse
                {
                    Fecha = o["fecha"]?.GetValue<DateTime>() ?? default,
                    IdUsuario = o["idUsuario"]?.GetValue<int>() ?? 0,
                    Banco = LeerString(o, "banco"),
                    Cuenta = LeerString(o, "cuenta"),
                    Clabe = LeerString(o, "clabe")
                });
            }
            return resultado;
        }

        private static string? LeerString(JsonObject obj, string clave)
        {
            var nodo = obj[clave];
            if (nodo is null) return null;
            try { return nodo.GetValue<string>(); }
            catch { return nodo.ToJsonString(); }
        }

        private static int? LeerInt(JsonObject obj, string clave)
        {
            var nodo = obj[clave];
            if (nodo is null) return null;
            try { return nodo.GetValue<int>(); }
            catch { return null; }
        }

        private static JsonObject ParseARaiz(string? json)
        {
            if (string.IsNullOrWhiteSpace(json)) return new JsonObject();
            try
            {
                var nodo = JsonNode.Parse(json);
                if (nodo is JsonObject obj) return obj;
                // Legacy: arreglo plano [1,2,3] => {"IdsCuentasBancarias":[1,2,3]}
                if (nodo is JsonArray arreglo)
                    return new JsonObject { ["IdsCuentasBancarias"] = arreglo };
                return new JsonObject();
            }
            catch
            {
                return new JsonObject();
            }
        }
    }
}
