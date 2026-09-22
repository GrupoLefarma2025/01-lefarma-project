namespace Lefarma.API.Shared.Constants
{
    public static class CodigoProceso
    {
        public const string ORDEN_COMPRA = "ORDEN_COMPRA";
        public const string SOLICITUD_PERSONAL = "SOLICITUD_PERSONAL";

        /// <summary>
        /// Educación Médica (ADR-00006): cada fase tiene workflows por gerencia, con el
        /// mismo codigo_proceso base (variantes distinguidas por mappings de scope TIPO_GERENCIA).
        /// El mismo valor es el tipo de entidad que usa el motor (bitácora).
        /// </summary>
        public const string EDUCACION_MEDICA_SELECCION = "EDUCACION_MEDICA_SELECCION";
        public const string EDUCACION_MEDICA_RUTAS = "EDUCACION_MEDICA_RUTAS";
    }

    /// <summary>Claves de scope usadas por los servicios al resolver workflows.</summary>
    public static class WorkflowScope
    {
        /// <summary>Scope por tipo de gerencia (1 = IMSS, 2 = Descentralizado) — mappings en el admin.</summary>
        public const string TIPO_GERENCIA = "TIPO_GERENCIA";
    }
}
