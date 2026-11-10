using System.Text.Json;
using ErrorOr;
using Lefarma.API.Shared.Errors;

namespace Lefarma.API.Features.Configuracion;

/// <summary>
/// Reglas de negocio puras del módulo Configuración (sin dependencias de base de datos),
/// para poder probarlas de forma aislada.
/// </summary>
public static class ConfiguracionReglas
{
    /// <summary>Una variable debe estar disponible al menos en un destino.</summary>
    public static bool TieneDestino(
        bool disponibleBackend,
        bool disponibleFrontend,
        bool disponibleSql,
        bool disponibleIntegraciones)
        => disponibleBackend || disponibleFrontend || disponibleSql || disponibleIntegraciones;

    /// <summary>
    /// Rechaza cualquier intento de cambiar la clave o el tipo de dato de una variable existente.
    /// Los valores nulos o vacíos significan "no enviado" (no se valida).
    /// </summary>
    public static ErrorOr<Success> ValidarInmutables(
        string claveActual,
        string tipoDatoActual,
        string? claveSolicitada,
        string? tipoDatoSolicitado)
    {
        if (!string.IsNullOrWhiteSpace(claveSolicitada) &&
            !string.Equals(claveActual, claveSolicitada.Trim(), StringComparison.Ordinal))
        {
            return CommonErrors.Validation(
                "clave",
                "La clave de una variable no se puede modificar después de crearla.");
        }

        if (!string.IsNullOrWhiteSpace(tipoDatoSolicitado))
        {
            var tipoNormalizado = ConfiguracionTiposDato.Normalizar(tipoDatoSolicitado);
            if (!string.Equals(
                    ConfiguracionTiposDato.Normalizar(tipoDatoActual),
                    tipoNormalizado,
                    StringComparison.Ordinal))
            {
                return CommonErrors.Validation(
                    "tipoDato",
                    "El tipo de dato de una variable no se puede modificar después de crearla.");
            }
        }

        return Result.Success;
    }

    /// <summary>
    /// Extrae de un snapshot de bitácora únicamente los campos restaurables:
    /// nombre, descripción, valor, esquema y disponibilidades.
    /// </summary>
    public static ErrorOr<ConfiguracionValoresRestaurables> ExtraerRestaurables(string? datosNuevosJson)
    {
        if (string.IsNullOrWhiteSpace(datosNuevosJson))
        {
            return CommonErrors.Validation(
                "idBitacoraOrigen",
                "La entrada de bitácora no contiene un snapshot JSON.");
        }

        JsonDocument documento;
        try
        {
            documento = JsonDocument.Parse(datosNuevosJson);
        }
        catch (JsonException)
        {
            return CommonErrors.Validation(
                "idBitacoraOrigen",
                "La entrada de bitácora no contiene un snapshot JSON válido.");
        }

        using (documento)
        {
            var raiz = documento.RootElement;
            if (raiz.ValueKind != JsonValueKind.Object)
            {
                return CommonErrors.Validation(
                    "idBitacoraOrigen",
                    "El snapshot de la bitácora no es un objeto JSON.");
            }

            string? nombre = null;
            if (raiz.TryGetProperty("nombre", out var nombreElemento) &&
                nombreElemento.ValueKind == JsonValueKind.String)
            {
                nombre = nombreElemento.GetString();
            }

            var descripcionDefinida = raiz.TryGetProperty("descripcion", out var descripcionElemento);
            var descripcion = descripcionDefinida && descripcionElemento.ValueKind == JsonValueKind.String
                ? descripcionElemento.GetString()
                : null;

            JsonElement? valor = null;
            if (raiz.TryGetProperty("valor", out var valorElemento) &&
                valorElemento.ValueKind != JsonValueKind.Undefined)
            {
                valor = valorElemento.Clone();
            }

            var esquemaDefinido = raiz.TryGetProperty("esquema", out var esquemaElemento);
            var esquema = esquemaDefinido && esquemaElemento.ValueKind != JsonValueKind.Null
                ? esquemaElemento.Clone()
                : (JsonElement?)null;

            return new ConfiguracionValoresRestaurables
            {
                Nombre = nombre,
                DescripcionDefinida = descripcionDefinida,
                Descripcion = descripcion,
                Valor = valor,
                EsquemaDefinido = esquemaDefinido,
                Esquema = esquema,
                DisponibleBackend = LeerBooleano(raiz, "disponibleBackend"),
                DisponibleFrontend = LeerBooleano(raiz, "disponibleFrontend"),
                DisponibleSql = LeerBooleano(raiz, "disponibleSql"),
                DisponibleIntegraciones = LeerBooleano(raiz, "disponibleIntegraciones")
            };
        }
    }

    private static bool? LeerBooleano(JsonElement raiz, string nombre)
    {
        if (!raiz.TryGetProperty(nombre, out var elemento))
        {
            return null;
        }

        return elemento.ValueKind switch
        {
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            _ => null
        };
    }
}
