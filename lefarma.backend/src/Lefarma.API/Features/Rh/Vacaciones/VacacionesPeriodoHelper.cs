namespace Lefarma.API.Features.Rh.Vacaciones
{
    public static class VacacionesPeriodoHelper
    {
        public static (DateTime Inicio, DateTime Fin, DateTime LimiteDisfrute, int NumeroPeriodo)
            CalcularPeriodo(DateTime fechaIngreso, DateTime fecha)
        {
            var numero = 0;
            while (fechaIngreso.AddYears(numero + 1) <= fecha.Date)
                numero++;

            var inicio = fechaIngreso.AddYears(numero);
            var fin = fechaIngreso.AddYears(numero + 1).AddDays(-1);
            var limite = fechaIngreso.AddYears(numero + 1).AddMonths(18);
            return (inicio, fin, limite, numero);
        }

        public static decimal CalcularDiasGenerados(int numeroPeriodo)
        {
            if (numeroPeriodo <= 0) return 0;
            if (numeroPeriodo <= 5) return 10 + numeroPeriodo * 2;
            return 22 + Math.Ceiling((numeroPeriodo - 10) / 5.0m) * 2;
        }

        public static string EtiquetaPeriodo(DateTime inicio, DateTime fin)
            => $"{inicio:dd/MM/yyyy} - {fin:dd/MM/yyyy}";
    }
}
