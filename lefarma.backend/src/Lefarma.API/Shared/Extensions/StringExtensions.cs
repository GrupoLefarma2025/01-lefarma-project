using Serilog;
using System.Globalization;
using System.Text;

namespace Lefarma.API.Shared.Extensions
{
/// <summary>
    /// Extensiones para manipulación de cadenas de texto
    /// </summary>
    public static class StringExtensions
    {
        /// <summary>
        /// Valor por defecto de app.Usuarios.Puesto para los usuarios que nunca se
        /// sincronizaron con RH. Nunca debe mostrarse como si fuera un puesto real.
        /// </summary>
        public const string PuestoSinAsignar = "Sin asignar";

        /// <summary>
        /// Devuelve el puesto listo para mostrarse: <c>null</c> cuando llega vacío o con
        /// el valor por defecto 'Sin asignar' de app.Usuarios; en otro caso el texto recortado.
        /// El puesto oficial del empleado sale de Asistencias.dbo.vwEmpleados.
        /// </summary>
        public static string? PuestoVisible(this string? puesto)
        {
            if (string.IsNullOrWhiteSpace(puesto))
                return null;

            var valor = puesto.Trim();
            return string.Equals(valor, PuestoSinAsignar, StringComparison.OrdinalIgnoreCase)
                ? null
                : valor;
        }

        /// <summary>
        /// Remueve diacríticos (acentos) de una cadena de texto
        /// </summary>
        /// <param name="text">Texto a normalizar</param>
        /// <returns>Texto sin acentos</returns>
        public static string RemoveDiacritics(this string? text)
        {
            if (string.IsNullOrWhiteSpace(text))
                return text ?? string.Empty;

            var normalizedString = text.Normalize(NormalizationForm.FormD);
            var stringBuilder = new StringBuilder();

            foreach (var c in normalizedString)
            {
                var unicodeCategory = CharUnicodeInfo.GetUnicodeCategory(c);
                if (unicodeCategory != UnicodeCategory.NonSpacingMark)
                {
                    stringBuilder.Append(c);
                }
            }

            return stringBuilder.ToString().Normalize(NormalizationForm.FormC);
        }

        /// <summary>
        /// Valida si un RFC tiene formato válido
        /// </summary>
        public static bool IsValidRFC(this string rfc)
        {
            if (string.IsNullOrWhiteSpace(rfc))
                return false;

            return rfc.Length == 12 || rfc.Length == 13;
        }
    }
}