using System.Text.Json.Serialization;

namespace Lefarma.API.Features.Viaticos.DTOs;

public class CostosRutaRequest
{
    public CostosRutaOpcionesInput Opciones { get; set; } = new();
    public List<CostosRutaPersonaInput> Personas { get; set; } = [];
}

public class CostosRutaOpcionesInput
{
    public bool RespetarHorarioLaboral { get; set; } = true;
    public bool CalcularHoteles { get; set; } = true;
    public bool CalcularViajesIntermedios { get; set; } = true;
    public bool CompartirViaje { get; set; } = false;
    public double? RendimientoKmL { get; set; }
}

public class CostosRutaPersonaInput
{
    public string? Nombre { get; set; }
    public bool CarroPropio { get; set; }
    public string? Gasolina { get; set; }
    public bool Draft { get; set; }
    public CostosRutaTrabajoInput? Trabajo { get; set; }
    public List<CostosRutaLugarInput> Lugares { get; set; } = [];

    [JsonPropertyName("carro_propio")]
    public bool CarroPropioWire { set => CarroPropio = value; }
}

public class CostosRutaTrabajoInput
{
    public string HoraEntrada { get; set; } = "08:00";
    public string HoraSalida { get; set; } = "18:30";
    public int PrimerDiaLaboral { get; set; } = 1;
    public int UltimoDiaLaboral { get; set; } = 5;

    [JsonPropertyName("hora_entrada")]
    public string HoraEntradaWire { set => HoraEntrada = value; }
    [JsonPropertyName("hora_salida")]
    public string HoraSalidaWire { set => HoraSalida = value; }
    [JsonPropertyName("primer_dia_laboral")]
    public int PrimerDiaLaboralWire { set => PrimerDiaLaboral = value; }
    [JsonPropertyName("ultimo_dia_laboral")]
    public int UltimoDiaLaboralWire { set => UltimoDiaLaboral = value; }
}

public class CostosRutaLugarInput
{
    public int Orden { get; set; }
    public string Tipo { get; set; } = string.Empty; 
    public string? Nombre { get; set; }
    public double Latitud { get; set; }
    public double Longitud { get; set; }
    public string? Municipio { get; set; }
    public string? Estado { get; set; }
    public string? FechaSalida { get; set; }
    public string? HoraSalida { get; set; }
    public string? FechaLlegada { get; set; }
    public string? HoraLlegada { get; set; }
    public string? FechaLimiteLlegada { get; set; }
    public string? HoraLimiteLlegada { get; set; }
    public string? FechaInicioActividad { get; set; }
    public string? HoraInicioActividad { get; set; }
    public string? FechaFinActividad { get; set; }
    public string? HoraFinActividad { get; set; }

    [JsonPropertyName("fecha_salida")]
    public string? FechaSalidaWire { set => FechaSalida = value; }
    [JsonPropertyName("hora_salida")]
    public string? HoraSalidaWire { set => HoraSalida = value; }
    [JsonPropertyName("fecha_llegada")]
    public string? FechaLlegadaWire { set => FechaLlegada = value; }
    [JsonPropertyName("hora_llegada")]
    public string? HoraLlegadaWire { set => HoraLlegada = value; }
    [JsonPropertyName("fecha_limite_llegada")]
    public string? FechaLimiteLlegadaWire { set => FechaLimiteLlegada = value; }
    [JsonPropertyName("hora_limite_llegada")]
    public string? HoraLimiteLlegadaWire { set => HoraLimiteLlegada = value; }
    [JsonPropertyName("fecha_inicio_actividad")]
    public string? FechaInicioActividadWire { set => FechaInicioActividad = value; }
    [JsonPropertyName("hora_inicio_actividad")]
    public string? HoraInicioActividadWire { set => HoraInicioActividad = value; }
    [JsonPropertyName("fecha_fin_actividad")]
    public string? FechaFinActividadWire { set => FechaFinActividad = value; }
    [JsonPropertyName("hora_fin_actividad")]
    public string? HoraFinActividadWire { set => HoraFinActividad = value; }
}

public class CostosRutaResponse
{
    public List<CostosRutaResultado> Resultados { get; set; } = [];
    public List<CostosRutaPropuesta> Propuestas { get; set; } = [];
    public Dictionary<string, List<CostosRutaOferta>> Categorias { get; set; } = new();
    public List<CostosRutaRecomendacion> Recomendaciones { get; set; } = [];
    public List<CostosRutaCompartido> Compartidos { get; set; } = [];
}

public class CostosRutaResultado
{
    public string Nombre { get; set; } = string.Empty;
    public string Gasolina { get; set; } = "magna";
    public CostosRutaPropuestaDraft Propuesta { get; set; } = new();
    public List<CostosRutaTramo> Tramos { get; set; } = [];
    public CostosRutaRutaArmada RutaArmada { get; set; } = new();
    public List<CostosRutaHotel> HotelesPropuestos { get; set; } = [];
    public List<string> Incumplimientos { get; set; } = [];
    public List<CostosRutaCaseta> Casetas { get; set; } = [];
    public List<CostosRutaCasetaDisponibilidad> CasetasDisponibilidad { get; set; } = [];
}

public class CostosRutaCaseta
{
    public int Tramo { get; set; }
    public string DeMunicipio { get; set; } = string.Empty;
    public string AMunicipio { get; set; } = string.Empty;
    public string Nombre { get; set; } = string.Empty;
    public string Carretera { get; set; } = string.Empty;
    public double Km { get; set; }
    public double Tarifa { get; set; }
    public string Direccion { get; set; } = string.Empty;
    public string Fuente { get; set; } = string.Empty;
}

public class CostosRutaCasetaDisponibilidad
{
    public int Tramo { get; set; }
    public string DeMunicipio { get; set; } = string.Empty;
    public string AMunicipio { get; set; } = string.Empty;
    public string Estado { get; set; } = string.Empty;
    public double? KmTotal { get; set; }
    public string? TiempoTotal { get; set; }
    public double? PeajeTotal { get; set; }
    public string Fuente { get; set; } = string.Empty;
}

public class CostosRutaPropuestaDraft
{
    public List<string> Razones { get; set; } = [];
    public List<Dictionary<string, object?>> Lugares { get; set; } = [];
}

public class CostosRutaTramo
{
    public string From { get; set; } = string.Empty;
    public string To { get; set; } = string.Empty;
    public double Km { get; set; }
    public List<CostosRutaOferta> Opciones { get; set; } = [];
}

public class CostosRutaTerminal
{
    public string Nombre { get; set; } = string.Empty;
    public double Latitud { get; set; }
    public double Longitud { get; set; }
}

public class CostosRutaOferta
{
    public string Id { get; set; } = string.Empty;
    public string Modo { get; set; } = string.Empty; 
    public string Linea { get; set; } = string.Empty;
    public string Servicio { get; set; } = string.Empty;
    public string Persona { get; set; } = string.Empty;
    public int? Tramo { get; set; }
    public string? De { get; set; }
    public string? A { get; set; }
    public string? Salida { get; set; }
    public string? Llegada { get; set; }
    public string SalidaTxt { get; set; } = string.Empty;
    public string LlegadaTxt { get; set; } = string.Empty;
    public string Duracion { get; set; } = string.Empty;
    public double? PuertaAPuertaH { get; set; }
    public int MinutosAntes { get; set; }
    public int MinutosDespues { get; set; }
    public int MinutosTaxi { get; set; }

    public int? MinutosTaxiOrigen { get; set; }

    public int? MinutosTaxiDestino { get; set; }

    public CostosRutaTerminal? TerminalOrigen { get; set; }

    public CostosRutaTerminal? TerminalDestino { get; set; }
    public string PrecioTxt { get; set; } = string.Empty;
    public bool PorPersona { get; set; }
    public double PrecioDesde { get; set; }
    public double PrecioHasta { get; set; }
    public double CostoGrupo { get; set; }
    public double CostoPorPersona { get; set; }
    public double CostoTaxi { get; set; }
    public double CostoTaxiOrigen { get; set; }
    public double CostoTaxiDestino { get; set; }
    public bool ATiempo { get; set; }
    public bool LlegaTarde { get; set; }
    public int MinutosTarde { get; set; }
    public bool NoTomable { get; set; }
    public string Badge { get; set; } = string.Empty;
    public string Nota { get; set; } = string.Empty;
    public string Fuente { get; set; } = string.Empty;
    public bool Estimado { get; set; }
    public string TipoPrecio { get; set; } = string.Empty;
    public string Proveedor { get; set; } = string.Empty;
    public string Disponibilidad { get; set; } = string.Empty;
    public string DisponibilidadDetalle { get; set; } = string.Empty;
    public double? Combustible { get; set; }
    public CostosRutaCompra Comprar { get; set; } = new();
}

public class CostosRutaCompra
{
    public string Url { get; set; } = string.Empty;
    public string Sitio { get; set; } = string.Empty;
    public string Accion { get; set; } = string.Empty;
    public string Objetivo { get; set; } = string.Empty;
    public string Fecha { get; set; } = string.Empty;
}

public class CostosRutaPropuesta
{
    public string Persona { get; set; } = string.Empty;
    public string Clave { get; set; } = string.Empty; 
    public string Titulo { get; set; } = string.Empty;
    public bool CumpleTodos { get; set; }
    public string SalidaOrigen { get; set; } = string.Empty;
    public string LlegadaFinal { get; set; } = string.Empty;
    public int MargenMinimoMinutos { get; set; }
    public double CostoTotalMxn { get; set; }
    public double Comida { get; set; }
    public double Taxi { get; set; }
    public double Hospedaje { get; set; }
    public List<CostosRutaPropuestaTramo> Tramos { get; set; } = [];
    public List<CostosRutaHotel> HotelesPropuestos { get; set; } = [];
    public List<string> Incumplimientos { get; set; } = [];
    public List<string> Fuentes { get; set; } = [];
}

public class CostosRutaPropuestaTramo
{
    public int Tramo { get; set; }
    public string De { get; set; } = string.Empty;
    public string A { get; set; } = string.Empty;
    public string Modo { get; set; } = string.Empty;
    public string Linea { get; set; } = string.Empty;
    public string Salida { get; set; } = string.Empty;
    public string Llegada { get; set; } = string.Empty;
    public double Costo { get; set; }
}

public class CostosRutaHotel
{
    public string Lugar { get; set; } = string.Empty;
    public string Nombre { get; set; } = string.Empty;
    public string Ciudad { get; set; } = string.Empty;
    public string CheckIn { get; set; } = string.Empty;
    public string CheckOut { get; set; } = string.Empty;
    public int Noches { get; set; }
    public int Habitaciones { get; set; }
    public double DistanciaKm { get; set; }
    public double Latitud { get; set; }
    public double Longitud { get; set; }
    public double? PrecioNoche { get; set; }
    public double? PrecioTotal { get; set; }
    public double? Rating { get; set; }
    public int? RatingCount { get; set; }
    public string? Direccion { get; set; }
    public string Motivo { get; set; } = string.Empty;
    public string Fuente { get; set; } = string.Empty;
    public string TipoPrecio { get; set; } = string.Empty;
    public string Proveedor { get; set; } = string.Empty;
    public string Disponibilidad { get; set; } = string.Empty;
    public string DisponibilidadDetalle { get; set; } = string.Empty;
    public string Link { get; set; } = string.Empty;
    public string? LinkMapa { get; set; }
    public string? LinkReserva { get; set; }
}

public class CostosRutaRecomendacion
{
    public string Persona { get; set; } = string.Empty;
    public int Tramo { get; set; }
    public string De { get; set; } = string.Empty;
    public string A { get; set; } = string.Empty;
    public double Km { get; set; }
    public string Razon { get; set; } = string.Empty;
    public string MejorOfertaId { get; set; } = string.Empty;
}

public class CostosRutaCompartido
{
    public string De { get; set; } = string.Empty;
    public string A { get; set; } = string.Empty;
    public List<string> Personas { get; set; } = [];
    public string? Conductor { get; set; }
    public double AhorroEstimadoMxn { get; set; }
    public string Nota { get; set; } = string.Empty;
}

public class CostosRutaRutaArmada
{
    public List<CostosRutaRutaTramo> Tramos { get; set; } = [];
    public CostosRutaRutaTotales Totales { get; set; } = new();
}

public class CostosRutaRutaTramo
{
    public string De { get; set; } = string.Empty;
    public string A { get; set; } = string.Empty;
    public double Km { get; set; }
    public List<double[]>? Grafica { get; set; }
    public double Litros { get; set; }
    public CostosRutaGasolinaDetalle Gasolina { get; set; } = new();
    public double SubtotalMagna { get; set; }
    public double SubtotalPremium { get; set; }
}

public class CostosRutaGasolinaDetalle
{
    public CostosRutaPrecioCombustible Magna { get; set; } = new();
    public CostosRutaPrecioCombustible Premium { get; set; } = new();
}

public class CostosRutaPrecioCombustible
{
    public double PrecioL { get; set; }
    public double Costo { get; set; }
    public string Fuente { get; set; } = string.Empty;
}

public class CostosRutaRutaTotales
{
    public double Km { get; set; }
    public double Litros { get; set; }
    public double SubtotalMagna { get; set; }
    public double SubtotalPremium { get; set; }
}
