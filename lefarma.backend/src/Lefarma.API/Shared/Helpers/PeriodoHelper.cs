namespace Lefarma.API.Shared.Helpers
{
    public static class PeriodoHelper
    {
        public const string Semana = "semana";
        public const string Quincena = "quincena";
        public const string Mes = "mes";

        public static (DateTime inicio, DateTime fin, string etiqueta) ObtenerPeriodoActual(DateTime fecha, string periodo)
        {
            return periodo.ToLowerInvariant() switch
            {
                Semana => ObtenerSemana(fecha),
                Mes => ObtenerMes(fecha),
                Quincena or _ => ObtenerQuincena(fecha)
            };
        }

        private static (DateTime inicio, DateTime fin, string etiqueta) ObtenerQuincena(DateTime fecha)
        {
            var inicio = fecha.Day <= 15
                ? new DateTime(fecha.Year, fecha.Month, 1)
                : new DateTime(fecha.Year, fecha.Month, 16);

            var fin = fecha.Day <= 15
                ? new DateTime(fecha.Year, fecha.Month, 15)
                : new DateTime(fecha.Year, fecha.Month, DateTime.DaysInMonth(fecha.Year, fecha.Month));

            var numero = fecha.Day <= 15 ? 1 : 2;
            var etiqueta = $"Quincena {numero} - {fecha:MMMM yyyy}";

            return (inicio, fin, etiqueta);
        }

        private static (DateTime inicio, DateTime fin, string etiqueta) ObtenerMes(DateTime fecha)
        {
            var inicio = new DateTime(fecha.Year, fecha.Month, 1);
            var fin = new DateTime(fecha.Year, fecha.Month, DateTime.DaysInMonth(fecha.Year, fecha.Month));
            var etiqueta = $"{fecha:MMMM yyyy}";
            return (inicio, fin, etiqueta);
        }

        private static (DateTime inicio, DateTime fin, string etiqueta) ObtenerSemana(DateTime fecha)
        {
            var diaInicioSemana = DayOfWeek.Monday;
            var diff = fecha.DayOfWeek - diaInicioSemana;
            if (diff < 0) diff += 7;

            var inicio = fecha.AddDays(-diff).Date;
            var fin = inicio.AddDays(6);
            var etiqueta = $"Semana del {inicio:dd/MM/yyyy} al {fin:dd/MM/yyyy}";
            return (inicio, fin, etiqueta);
        }
    }
}
