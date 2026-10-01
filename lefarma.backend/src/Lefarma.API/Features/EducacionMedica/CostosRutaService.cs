using Lefarma.API.Features.EducacionMedica.DTOs;

namespace Lefarma.API.Features.EducacionMedica;

public class CostosRutaService(
    IOsrmClient osrm,
    IGasolinaClient gasolina,
    IHotelesClient hoteles,
    IClickBusClient clickbus,
    IDistribusionClient distribusion,
    IVuelosClient vuelos) : ICostosRutaService
{
    // RENDIMIENTO FIJO 12 km/L (fase 1: se ignora rendimiento_km_l de la entrada).
    public const double RendimientoKmL = 12.0;

    private static readonly string[] CategoriasSalida =
        ["aviones", "autobuses", "hoteles", "autos", "renta_autos", "taxis_uber", "trenes", "ferris", "transporte_publico"];

    private static readonly Dictionary<string, string> CatDeModo = new()
    {
        ["avion"] = "aviones", ["bus"] = "autobuses", ["auto"] = "autos",
        ["renta"] = "renta_autos", ["uber"] = "taxis_uber", ["metro"] = "transporte_publico",
    };

    private sealed record LugarNorm(int Orden, string Tipo, string Nombre, double Lat, double Lon,
        DateTime? Salida, DateTime? Llegada, DateTime? Deadline, DateTime? Fin, DateTime? FinActividad, bool Propuesto);

    private sealed record PersonaNorm(string Nombre, bool CarroPropio, string Gasolina, bool Draft,
        TimeOnly HIn, TimeOnly HOut, int DIn, int DOut, List<LugarNorm> Lugares);

    private sealed record OpCalc(string Modo, string Linea, string Codigo, DateTime Salida, DateTime Llegada,
        double PuertaH, int OverheadMin, double Lo, double Hi, double CostoGrupo, bool PorPersona,
        double? Litros, double? PrecioLitro, double? CasetasVal, double? TarifaDia,
        bool Late, bool SaleAntes, int LateMin, string Fuente, bool Estimado, string Nota,
        string Url, string Sitio, string Accion, string Objetivo, string Badge);

    private sealed record TramoCalc(string From, string To, double Km, double Hrs, List<OpCalc> Opciones);
    private sealed record ComparteInfo(int N, string? Conductor);

    public async Task<CostosRutaResponse> CalcularAsync(CostosRutaRequest request, CancellationToken ct = default)
    {
        if (request.Personas is null || request.Personas.Count == 0)
            throw new ArgumentException("Manda 'personas' con al menos 1 persona.");
        if (request.Personas.Count > 9)
            throw new ArgumentException("Máximo 9 personas por llamada.");
        var opciones = request.Opciones ?? new CostosRutaOpcionesInput();

        var normas = new List<PersonaNorm>();
        for (var i = 0; i < request.Personas.Count; i++)
            normas.Add(await NormalizarAsync(request.Personas[i], i, ct));

        var grupos = DetectarCompartidos(normas);
        var precios = await gasolina.ObtenerPreciosAsync(ct);

        var resp = new CostosRutaResponse
        {
            Categorias = CategoriasSalida.ToDictionary(c => c, _ => new List<CostosRutaOferta>()),
        };

        for (var i = 0; i < normas.Count; i++)
        {
            var norm = normas[i];
            var (prop, razones) = await DraftAsync(norm, ct);
            var tramos = new List<TramoCalc>();
            for (var t = 0; t < prop.Count - 1; t++)
            {
                ComparteInfo? ci = null;
                if (opciones.CompartirViaje && grupos.TryGetValue(i, out var gd))
                    gd.TryGetValue(t, out ci);
                var intermedio = t > 0 && t < prop.Count - 2;
                tramos.Add(await CalcularTramoAsync(norm, i, t, prop[t], prop[t + 1],
                    ci, !opciones.CalcularViajesIntermedios && intermedio, precios, ct));
            }

            var incumplimientos = new List<string>();
            if (opciones.RespetarHorarioLaboral)
                incumplimientos.AddRange(AvisosLaborales(norm));
            if (tramos.Any(t => t.Opciones.Count > 0 && t.Opciones.All(o => o.Late || o.SaleAntes)))
                incumplimientos.Add("Con tu horario, algún tramo no tiene alternativa viable (todas llegan tarde o salen antes de que puedas tomarlas).");

            var hoteles = await HotelesAsync(norm, i, prop, tramos, opciones.CalcularHoteles, ct, incumplimientos);
            var resultado = new CostosRutaResultado
            {
                Nombre = norm.Nombre,
                Gasolina = norm.Gasolina,
                Propuesta = new CostosRutaPropuestaDraft { Razones = razones, Lugares = prop.Select(LugarOut).ToList() },
                Tramos = tramos.Select((t, ti) => new CostosRutaTramo
                {
                    From = t.From, To = t.To, Km = Math.Round(t.Km, 1),
                    Opciones = t.Opciones.Select(o => OfertaDe(o, norm.Nombre, i, ti + 1, t.From, t.To)).ToList(),
                }).ToList(),
                RutaArmada = RutaArmada(prop, tramos, precios),
                HotelesPropuestos = hoteles,
                Incumplimientos = incumplimientos,
            };
            resp.Resultados.Add(resultado);

            foreach (var (t, ti) in tramos.Select((t, ti) => (t, ti)))
                foreach (var o in t.Opciones)
                {
                    var of = OfertaDe(o, norm.Nombre, i, ti + 1, t.From, t.To);
                    resp.Categorias[CatDeModo[o.Modo]].Add(of);
                }
            foreach (var h in hoteles)
                resp.Categorias["hoteles"].Add(new CostosRutaOferta
                {
                    Id = $"p{i}-h-{h.Lugar}", Modo = "hotel", Linea = h.Lugar, Servicio = h.Motivo,
                    Persona = norm.Nombre, A = h.Lugar, LlegadaTxt = h.CheckIn, SalidaTxt = h.CheckOut,
                    Duracion = $"{h.Noches} noche(s)", PrecioTxt = h.Motivo, Nota = h.Motivo,
                    Fuente = h.Fuente, Estimado = true,
                    Comprar = new CostosRutaCompra { Url = h.Link, Sitio = "Booking.com", Accion = "reservar hotel", Objetivo = h.Lugar, Fecha = h.CheckIn },
                });

            var propuestas = ArmarPropuestas(norm, prop, tramos, hoteles, incumplimientos);
            resp.Propuestas.AddRange(propuestas);

            for (var ti = 0; ti < tramos.Count; ti++)
            {
                var viables = tramos[ti].Opciones.Where(o => !o.Late && !o.SaleAntes).ToList();
                var pool = viables.Count > 0 ? viables : tramos[ti].Opciones;
                if (pool.Count == 0) continue;
                var mejor = pool.MinBy(o => o.CostoGrupo)!;
                resp.Recomendaciones.Add(new CostosRutaRecomendacion
                {
                    Persona = norm.Nombre, Tramo = ti + 1, De = tramos[ti].From, A = tramos[ti].To,
                    Km = Math.Round(tramos[ti].Km, 1),
                    Razon = $"Prioridad del motor: 1º llegar a tiempo, 2º precio, 3º tiempo puerta a puerta. «{mejor.Linea}» encabeza este tramo.",
                    MejorOfertaId = $"p{i}-t{ti + 1}-{mejor.Modo}",
                });
            }
        }

        resp.Compartidos = CompartidosResumen(normas, grupos, opciones.CompartirViaje);
        return resp;
    }

    // ---------- Normalización ----------

    private async Task<PersonaNorm> NormalizarAsync(CostosRutaPersonaInput p, int i, CancellationToken ct)
    {
        var tag = $"Persona {i + 1} ({p.Nombre ?? $"persona_{i + 1}"})";
        var nombre = string.IsNullOrWhiteSpace(p.Nombre) ? $"persona_{i + 1}" : p.Nombre.Trim();
        var gas = string.IsNullOrWhiteSpace(p.Gasolina) ? "magna" : p.Gasolina.Trim().ToLowerInvariant();
        if (gas is not ("magna" or "premium" or "diesel"))
            throw new ArgumentException($"{tag}: gasolina inválida ({p.Gasolina}), usa magna|premium|diesel.");
        var tr = p.Trabajo ?? new CostosRutaTrabajoInput();
        if (!TimeOnly.TryParse(tr.HoraEntrada, out var hIn) || !TimeOnly.TryParse(tr.HoraSalida, out var hOut))
            throw new ArgumentException($"{tag}: horario laboral inválido (usa HH:mm).");
        if (tr.PrimerDiaLaboral is < 1 or > 7 || tr.UltimoDiaLaboral is < 1 or > 7 || tr.PrimerDiaLaboral > tr.UltimoDiaLaboral)
            throw new ArgumentException($"{tag}: días laborales fuera de 1-7 o invertidos.");

        var raw = p.Lugares ?? [];
        if (raw.Count < 2) throw new ArgumentException($"{tag}: necesita al menos 2 lugares.");
        var ordenados = raw.OrderBy(l => l.Orden).ToList();
        if (ordenados.Select(l => l.Orden).SequenceEqual(Enumerable.Range(1, raw.Count)) is false)
            throw new ArgumentException($"{tag}: 'orden' debe ser 1..{raw.Count} sin saltos ni repetidos.");
        if (ordenados[0].Tipo != "salida")
            throw new ArgumentException($"{tag}: el lugar 1 debe ser tipo 'salida'.");

        var tipos = new[] { "salida", "punto", "taller", "hotel" };
        var lugares = new List<LugarNorm>();
        foreach (var l in ordenados)
        {
            var q = $"{tag} lugar {l.Orden}";
            if (!tipos.Contains(l.Tipo))
                throw new ArgumentException($"{q}: tipo inválido ({l.Tipo}), usa salida|punto|taller|hotel.");
            var nombreL = string.IsNullOrWhiteSpace(l.Nombre) ? $"lugar {l.Orden}" : l.Nombre.Trim();
            if (l.Tipo == "salida")
            {
                DateTime? sal = null;
                if (l.FechaSalida is not null || l.HoraSalida is not null)
                {
                    if (l.FechaSalida is null || l.HoraSalida is null)
                        throw new ArgumentException($"{q}: manda fecha Y hora de salida, o ninguna (se calcula).");
                    sal = Dt(l.FechaSalida, l.HoraSalida, q + " salida");
                }
                lugares.Add(new LugarNorm(l.Orden, l.Tipo, nombreL, l.Latitud, l.Longitud, sal, null, null, null, null, false));
            }
            else if (l.Tipo == "hotel")
            {
                var llegada = DtReq(l.FechaLlegada, l.HoraLlegada, q + " check-in");
                var salida = DtReq(l.FechaSalida, l.HoraSalida, q + " check-out");
                lugares.Add(new LugarNorm(l.Orden, l.Tipo, nombreL, l.Latitud, l.Longitud, salida, llegada, llegada, null, null, false));
            }
            else
            {
                string? fiD, fiH;
                if (l.Tipo == "taller")
                {
                    fiD = l.FechaInicioActividad; fiH = l.HoraInicioActividad;
                    if (fiD is null || fiH is null)
                        throw new ArgumentException($"{q}: el taller necesita fecha/hora de inicio.");
                }
                else
                {
                    fiD = l.FechaLimiteLlegada; fiH = l.HoraLimiteLlegada;
                    if (fiD is null || fiH is null)
                        throw new ArgumentException($"{q}: el punto necesita fecha/hora límite de llegada.");
                    fiD = l.FechaInicioActividad ?? fiD; fiH = l.HoraInicioActividad ?? fiH;
                }
                var deadline = DtReq(l.Tipo == "taller" ? fiD : l.FechaLimiteLlegada,
                    l.Tipo == "taller" ? fiH : l.HoraLimiteLlegada, q + " inicio");
                var fin = DtReq(fiD, fiH, q + " inicio actividad");
                var finAct = l.HoraFinActividad is not null
                    ? DtReq(l.FechaFinActividad ?? fiD, l.HoraFinActividad, q + " fin actividad")
                    : fin.AddHours(1);
                DateTime salida = l.FechaSalida is not null
                    ? DtReq(l.FechaSalida, l.HoraSalida ?? throw new ArgumentException($"{q}: hora de salida requerida."), q + " salida")
                    : finAct.AddHours(2);
                if (!(deadline <= fin && fin <= finAct && finAct <= salida))
                    throw new ArgumentException($"{q}: cadena inválida (llegada <= inicio <= fin <= salida).");
                lugares.Add(new LugarNorm(l.Orden, l.Tipo, nombreL, l.Latitud, l.Longitud, salida, null, deadline, fin, finAct, false));
            }
        }

        if (lugares[0].Salida is null)
        {
            var p1 = lugares[1];
            if (p1.Deadline is null) throw new ArgumentException($"{tag}: para calcular la salida, el lugar 2 necesita fecha límite.");
            var hrs = await HorasManejoAsync(lugares[0].Lat, lugares[0].Lon, p1.Lat, p1.Lon, ct);
            lugares[0] = lugares[0] with { Salida = p1.Deadline.Value.AddHours(-hrs).AddMinutes(-CostosRutaSeeds.BufferMin) };
        }
        return new PersonaNorm(nombre, p.CarroPropio, gas, p.Draft, hIn, hOut, tr.PrimerDiaLaboral, tr.UltimoDiaLaboral, lugares);
    }

    private static DateTime DtReq(string? fecha, string? hora, string quien)
    {
        if (fecha is null || hora is null) throw new ArgumentException($"{quien}: fecha y hora requeridas.");
        return Dt(fecha, hora, quien);
    }

    private static DateTime Dt(string fecha, string hora, string quien)
    {
        if (!DateOnly.TryParseExact(fecha, "yyyy-MM-dd", out var d))
            throw new ArgumentException($"{quien}: fecha inválida ({fecha}), usa yyyy-MM-dd.");
        if (!TimeOnly.TryParse(hora, out var t))
            throw new ArgumentException($"{quien}: hora inválida ({hora}), usa HH:mm.");
        return d.ToDateTime(t);
    }

    private static Dictionary<string, object?> LugarOut(LugarNorm nl)
    {
        var o = new Dictionary<string, object?>
        {
            ["orden"] = nl.Orden, ["tipo"] = nl.Tipo, ["nombre"] = nl.Nombre,
            ["latitud"] = nl.Lat, ["longitud"] = nl.Lon,
        };
        if (nl.Propuesto) o["propuesto"] = true;
        if (nl.Tipo == "salida") { o["fecha_salida"] = F(nl.Salida!.Value); o["hora_salida"] = H(nl.Salida!.Value); }
        else if (nl.Tipo == "hotel")
        {
            o["fecha_llegada"] = F(nl.Llegada!.Value); o["hora_llegada"] = H(nl.Llegada!.Value);
            o["fecha_salida"] = F(nl.Salida!.Value); o["hora_salida"] = H(nl.Salida!.Value);
        }
        else
        {
            o["fecha_limite_llegada"] = F(nl.Deadline!.Value); o["hora_limite_llegada"] = H(nl.Deadline!.Value);
            o["fecha_inicio_actividad"] = F(nl.Fin!.Value); o["hora_inicio_actividad"] = H(nl.Fin!.Value);
            o["fecha_fin_actividad"] = F(nl.FinActividad!.Value); o["hora_fin_actividad"] = H(nl.FinActividad!.Value);
            o["fecha_salida"] = F(nl.Salida!.Value); o["hora_salida"] = H(nl.Salida!.Value);
        }
        return o;
        static string F(DateTime x) => x.ToString("yyyy-MM-dd");
        static string H(DateTime x) => x.ToString("HH:mm");
    }

    // ---------- Draft ----------

    private async Task<(List<LugarNorm> Prop, List<string> Razones)> DraftAsync(PersonaNorm norm, CancellationToken ct)
    {
        var lugares = norm.Lugares.Select(l => l).ToList();
        var razones = new List<string>();
        if (!norm.Draft) return (lugares, razones);
        var origen = lugares[0];
        var last = lugares[^1];
        var finUlt = last.Tipo is "punto" or "taller" ? last.FinActividad!.Value : last.Salida!.Value;
        var drive = await HorasManejoAsync(last.Lat, last.Lon, origen.Lat, origen.Lon, ct);
        var llegada = finUlt.AddHours(drive);
        var limite = llegada.Date.Add(norm.HOut.ToTimeSpan()).AddHours(4);
        var inviable = llegada > limite || (drive > 3 && llegada.Hour >= 22);
        if (last.Tipo != "hotel" && inviable)
        {
            var checkin = finUlt.AddHours(1);
            var checkout = checkin.AddDays(1).Date.AddHours(7);
            if (checkout <= checkin) checkout = checkout.AddDays(1);
            var (key, _) = CostosRutaSeeds.SnapCiudad(last.Lat, last.Lon);
            var ciudad = key is not null ? CostosRutaSeeds.Ciudades[key].Nombre : "la zona";
            lugares.Add(new LugarNorm(lugares.Count + 1, "hotel", $"Hotel propuesto — {ciudad}",
                last.Lat, last.Lon, checkout, checkin, checkin, null, null, true));
            razones.Add($"Regresar esa noche llegaría {llegada:dd/MM HH:mm} (manejo ~{drive:F1} h), fuera de tu jornada -> hotel en {ciudad}.");
            finUlt = checkout;
        }
        var regresoHora = finUlt.AddHours(drive + 0.5);
        lugares.Add(new LugarNorm(lugares.Count + 1, "punto", $"Regreso — {origen.Nombre}",
            origen.Lat, origen.Lon, regresoHora, null, regresoHora, regresoHora, regresoHora, true));
        razones.Add($"Regreso propuesto a {origen.Nombre}: {regresoHora:dd/MM HH:mm}.");
        return (lugares, razones);
    }

    private static List<string> AvisosLaborales(PersonaNorm norm)
    {
        var avisos = new List<string>();
        foreach (var nl in norm.Lugares)
        {
            if (nl.Tipo != "punto" || nl.Propuesto || nl.Deadline is null) continue;
            var d = nl.Deadline.Value;
            if (d.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday
                && (norm.DIn > (int)d.DayOfWeek || (int)d.DayOfWeek > norm.DOut))
                continue;
            var dow = (int)d.DayOfWeek == 0 ? 7 : (int)d.DayOfWeek;
            if (dow < norm.DIn || dow > norm.DOut) continue;
            var ini = d.Date.Add(norm.HIn.ToTimeSpan());
            var fin = d.Date.Add(norm.HOut.ToTimeSpan());
            if (nl.Fin < fin && nl.FinActividad > ini)
                avisos.Add($"⚠️ {nl.Nombre} ({d:dd/MM HH:mm}) cae en tu horario laboral ({norm.HIn:HH:mm}-{norm.HOut:HH:mm}).");
        }
        return avisos;
    }

    // ---------- Tramos ----------

    private async Task<double> HorasManejoAsync(double latO, double lonO, double latD, double lonD, CancellationToken ct)
    {
        var r = await osrm.ObtenerRutaAsync(latO, lonO, latD, lonD, ct);
        return r is not null ? r.Horas : CostosRutaGeo.HaversineKm(latO, lonO, latD, lonD) / 70.0;
    }

    private async Task<TramoCalc> CalcularTramoAsync(PersonaNorm norm, int ixP, int ti,
        LugarNorm a, LugarNorm b, ComparteInfo? comparte, bool intermedioSimple, PreciosGasolina precios, CancellationToken ct)
    {
        var deadline = b.Deadline ?? b.Llegada ?? b.Salida ?? throw new ArgumentException($"Tramo {ti + 1}: sin hora de referencia.");
        var salidaPrevia = a.Salida;
        var ruta = await osrm.ObtenerRutaAsync(a.Lat, a.Lon, b.Lat, b.Lon, ct);
        double km, hrs;
        string srcRuta;
        if (ruta is not null) { km = ruta.Km; hrs = ruta.Horas; srcRuta = ruta.Fuente; }
        else
        {
            km = CostosRutaGeo.HaversineKm(a.Lat, a.Lon, b.Lat, b.Lon) * 1.25;
            hrs = km / 70.0;
            srcRuta = "seed de distancia (OSRM no respondió)";
        }
        var air = CostosRutaGeo.HaversineKm(a.Lat, a.Lon, b.Lat, b.Lon);
        var (keyO, _) = CostosRutaSeeds.SnapCiudad(a.Lat, a.Lon);
        var (keyD, _) = CostosRutaSeeds.SnapCiudad(b.Lat, b.Lon);
        var cas = Casetas(keyO, keyD, km);
        var gas = km / RendimientoKmL * precios.Magna;
        var osm = $"https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route={a.Lat}%2C{a.Lon}%3B{b.Lat}%2C{b.Lon}";
        var opts = new List<OpCalc>();
        var sinAuto = !norm.CarroPropio && comparte?.Conductor is null;
        var nSh = comparte?.N;

        string NotaSh() => nSh is > 1 ? $" · compartido entre {nSh}" + (comparte!.Conductor is not null ? $" (maneja {comparte.Conductor})" : " (renta compartida)") : "";

        if (!sinAuto)
        {
            foreach (var (nombre, casetas, factorT) in new[] { ("Auto (cuota)", cas.Costo, 1.0), ("Auto (libre)", 0.0, 1.15) })
            {
                var dur = hrs * factorT;
                var sal = salidaPrevia ?? deadline.AddHours(-dur).AddMinutes(-CostosRutaSeeds.BufferMin);
                var arr = sal.AddHours(dur);
                var parte = (gas + casetas) / (nSh is > 1 ? nSh.Value : 1);
                opts.Add(new OpCalc("auto", nombre + NotaSh(), $"{km:F0} km carretera", sal, arr, dur, 0,
                    parte, parte * 1.1, parte, false, km / RendimientoKmL, precios.Magna, casetas, null,
                    arr > deadline, false, arr > deadline ? (int)(arr - deadline).TotalMinutes : 0,
                    $"OSRM + CNE ({srcRuta}; {precios.Fuente})", false,
                    salidaPrevia is not null ? $"casetas + gasolina CNE · sales {sal:dd/MM HH:mm} (tu hora){NotaSh()}" : $"casetas + gasolina CNE · sale {sal:dd/MM HH:mm} para llegar {CostosRutaSeeds.BufferMin} min antes{NotaSh()}",
                    osm, "OSRM + OpenStreetMap", "ver ruta", $"ruta de manejo {a.Nombre} → {b.Nombre}", ""));
            }
        }

        foreach (var (nombre, tarifa, notaR) in new[] { ("Renta económica", 650.0, "auto compacto"), ("Renta SUV", 1150.0, "camioneta familiar") })
        {
            var sal = salidaPrevia ?? deadline.AddHours(-hrs).AddMinutes(-CostosRutaSeeds.BufferMin);
            var arr = sal.AddHours(hrs);
            var total = (tarifa + gas + cas.Costo) / (nSh is > 1 ? nSh.Value : 1);
            opts.Add(new OpCalc("renta", nombre + NotaSh(), $"{km:F0} km carretera", sal, arr, hrs, 0,
                total, total * 1.12, total, false, km / RendimientoKmL, precios.Magna, cas.Costo, tarifa,
                arr > deadline, false, arr > deadline ? (int)(arr - deadline).TotalMinutes : 0,
                "seed renta", true, $"{notaR} · tarifa/día ${tarifa:F0}{NotaSh()}",
                $"https://www.google.com/search?q=renta de autos {b.Nombre} por día", "Google", "cotizar renta", $"renta en {b.Nombre}", ""));
        }

        if (!intermedioSimple)
        {
            var fechas = new[] { deadline.Date, deadline.Date.AddDays(-1) };
            var candidatos = new List<ViajeBus>();
            foreach (var f in fechas)
            {
                candidatos.AddRange(await clickbus.BuscarAsync(a.Nombre, b.Nombre, DateOnly.FromDateTime(f), km, ct));
                candidatos.AddRange(await distribusion.BuscarAsync(a.Nombre, b.Nombre, DateOnly.FromDateTime(f), km, ct));
            }
            foreach (var g in candidatos.GroupBy(v => v.Linea))
            {
                var mejor = MejorHorario(g.ToList(), salidaPrevia, 30, deadline,
                    v => v.Salida, v => v.Llegada, out var saleAntes);
                var durB = (mejor.Llegada - mejor.Salida).TotalHours;
                opts.Add(new OpCalc("bus", mejor.Linea, "Directo", mejor.Salida, mejor.Llegada, durB + 0.5, 30,
                    mejor.PrecioDesde, mejor.PrecioHasta, (mejor.PrecioDesde + mejor.PrecioHasta) / 2, true,
                    null, null, null, null, mejor.Llegada > deadline, saleAntes,
                    mejor.Llegada > deadline ? (int)(mejor.Llegada - deadline).TotalMinutes : 0,
                    mejor.Fuente, true, $"{mejor.Nota} · cotiza en el sitio/app oficial",
                    $"https://www.clickbus.com.mx/trips?departure_date={mejor.Salida:yyyy-MM-dd}", "ClickBus",
                    "ver costo del boleto", $"boleto {mejor.Linea} {a.Nombre} → {b.Nombre}", ""));
            }

            var (iataO, iataD) = (keyO is not null ? CostosRutaSeeds.Ciudades[keyO].Iata : null,
                keyD is not null ? CostosRutaSeeds.Ciudades[keyD].Iata : null);
            if (air >= 300 || (iataO is not null && iataD is not null))
            {
                var cands = new List<ViajeVuelo>();
                foreach (var f in fechas)
                    cands.AddRange(await vuelos.BuscarAsync(air, iataO ?? a.Nombre, iataD ?? b.Nombre, DateOnly.FromDateTime(f), ct));
                foreach (var g in cands.GroupBy(v => v.Linea))
                {
                    var mejor = MejorHorario(g.ToList(), salidaPrevia, 120, deadline,
                        v => v.Salida, v => v.Llegada, out var saleAntes);
                    var puerta = (mejor.Llegada - mejor.Salida).TotalHours + 2.5;
                    opts.Add(new OpCalc("avion", mejor.Linea, "estimado", mejor.Salida, mejor.Llegada, puerta, 120,
                        mejor.PrecioDesde, mejor.PrecioHasta, (mejor.PrecioDesde + mejor.PrecioHasta) / 2, true,
                        null, null, null, null, mejor.Llegada > deadline, saleAntes,
                        mejor.Llegada > deadline ? (int)(mejor.Llegada - deadline).TotalMinutes : 0,
                        mejor.Fuente, true, $"{mejor.Nota} · llegar al aeropuerto + 120 min antes · cotiza en el sitio oficial",
                        mejor.Url, mejor.Linea, "ver costo del vuelo", $"vuelo {mejor.Linea} {iataO} → {iataD}", ""));
                }
            }

            if (km <= 80)
                opts.AddRange(TaxiUber(a, b, km, hrs, keyD ?? keyO, salidaPrevia, deadline, osm));
            if (km <= 40)
                opts.Add(TransportePublico(a, b, km, hrs, keyD ?? keyO, salidaPrevia, deadline, osm));
        }
        else if (km <= 80)
        {
            // Viaje intermedio sin conectores: solo referencia de manejo.
            opts.Add(new OpCalc("uber", "Taxi (referencia intermedia)", $"{km:F0} km", salidaPrevia ?? deadline.AddHours(-hrs),
                (salidaPrevia ?? deadline.AddHours(-hrs)).AddHours(hrs), hrs, 0, 0, 0, 0, false,
                null, null, null, null, false, false, 0, "seed", true,
                "viaje intermedio sin conectores (opción desactivada)", osm, "OSRM", "ver ruta", "referencia", ""));
        }

        for (var bi = 0; bi < opts.Count; bi++)
            opts[bi] = opts[bi] with { Badge = "" };
        if (opts.Count > 0)
        {
            var iBar = opts.Index().MinBy(p => p.Item.CostoGrupo).Index;
            var iRap = opts.Index().MinBy(p => p.Item.PuertaH).Index;
            opts[iBar] = opts[iBar] with { Badge = iRap == iBar ? "más barato y rápido" : "más barato" };
            if (iRap != iBar) opts[iRap] = opts[iRap] with { Badge = "más rápido" };
        }
        return new TramoCalc(a.Nombre, b.Nombre, km, hrs, opts.OrderBy(o => o.CostoGrupo).ToList());
    }

    private static T MejorHorario<T>(List<T> cands, DateTime? salidaPrevia, int overheadMin, DateTime deadline,
        Func<T, DateTime> sal, Func<T, DateTime> arr, out bool saleAntes)
    {
        var limite = salidaPrevia?.AddMinutes(overheadMin);
        var tomables = limite is null ? cands : cands.Where(c => sal(c) >= limite).ToList();
        var pool = tomables.Count > 0 ? tomables : cands;
        var puntuales = pool.Where(c => arr(c) <= deadline).ToList();
        saleAntes = salidaPrevia is not null && tomables.Count == 0;
        return puntuales.Count > 0 ? puntuales.MaxBy(c => sal(c))! : pool.MinBy(c => arr(c))!;
    }

    private static (double Costo, string Fuente) Casetas(string? keyO, string? keyD, double km)
    {
        foreach (var par in new[] { $"{keyO}-{keyD}", $"{keyD}-{keyO}" })
            if (CostosRutaSeeds.CasetasIda.TryGetValue(par, out var v))
                return (v, $"seed de corredor {par} (estilo CAPUFE)");
        return (Math.Round(km * CostosRutaSeeds.CasetaPorKm), "seed ~$1.4/km (estilo CAPUFE)");
    }

    private static List<OpCalc> TaxiUber(LugarNorm a, LugarNorm b, double km, double hrs,
        string? ciudadKey, DateTime? salidaPrevia, DateTime deadline, string osm)
    {
        var list = new List<OpCalc>();
        var ciudad = ciudadKey ?? "CDMX";
        var esNoche = (salidaPrevia ?? deadline).Hour is >= 22 or < 6;
        var recargo = esNoche ? " · noche +20%" : "";
        void Add(string linea, double costo, string nota, string fuente, string url, string sitio)
        {
            var dur = hrs * 1.3;
            var sal = salidaPrevia ?? deadline.AddHours(-dur).AddMinutes(-CostosRutaSeeds.BufferMin);
            var arr = sal.AddHours(dur);
            list.Add(new OpCalc("uber", linea, $"{km:F0} km · por auto (hasta 4 pax)", sal, arr, dur, 0,
                costo, costo * 1.25, costo, false, null, null, null, null,
                arr > deadline, false, arr > deadline ? (int)(arr - deadline).TotalMinutes : 0,
                fuente, true, salidaPrevia is not null ? $"{nota} · sales {sal:dd/MM HH:mm} (tu hora)" : $"{nota}{recargo}",
                url, sitio, "cotizar viaje", $"viaje {linea} {a.Nombre} → {b.Nombre}", ""));
        }
        if (ciudad == "CDMX")
        {
            var f = esNoche ? 1.2 : 1.0;
            Add("Taxi libre CDMX", (8.74 + 4.28 * km) * f, "SEMOVI libre $8.74 + $4.28/km", "SEMOVI CDMX (oficial)", osm, "OSRM");
            Add("Taxi sitio CDMX", (13.10 + 5.20 * km) * f, "SEMOVI sitio $13.10 + $5.20/km", "SEMOVI CDMX (oficial)", osm, "OSRM");
            Add("Radio taxi CDMX", (27.30 + 7.36 * km) * f, "SEMOVI radio $27.30 + $7.36/km", "SEMOVI CDMX (oficial)", osm, "OSRM");
        }
        else if (ciudad == "XAL")
        {
            if (km <= 8) Add("Taxi Xalapa (perímetro)", 38.5, "perímetro Xalapa $27–$50", "seed Veracruz por perímetros", osm, "OSRM");
            else Add("Taxi Xalapa (fuera de perímetro)", 50 + 10 * km, "fuera de perímetro → tarifa a convenir; valida con el operador", "seed Veracruz (a convenir)", osm, "OSRM");
        }
        else
        {
            var (tb, tk) = CostosRutaSeeds.Taxi.GetValueOrDefault(ciudad, (30, 11));
            Add($"Taxi {ciudad}", tb + tk * km, $"seed tarifa base ${tb} + ${tk}/km", "seed taxi", osm, "OSRM");
        }
        var (bb, bk) = CostosRutaSeeds.Taxi.GetValueOrDefault(ciudad, (30, 11));
        var baseKm = bb + bk * km;
        Add("UberX", baseKm, "uber económico · cotiza en la app", "seed apps", CostosRutaSeeds.UberEstimateUrl, "Uber");
        Add("Uber Comfort", baseKm * 1.35, "uber confort · cotiza en la app", "seed apps", CostosRutaSeeds.UberEstimateUrl, "Uber");
        Add("DiDi Taxi", baseKm * 1.15, "taxi vía DiDi · verifica disponibilidad en tu ciudad", "seed apps", CostosRutaSeeds.DidiUrl, "DiDi");
        return list;
    }

    private static OpCalc TransportePublico(LugarNorm a, LugarNorm b, double km, double hrs,
        string? ciudadKey, DateTime? salidaPrevia, DateTime deadline, string osm)
    {
        var (sist, tarifa) = (ciudadKey ?? "") switch
        {
            "CDMX" => ("Metro / Metrobús", 6.0),
            "GDL" => ("Mi Tren / Macro", 10.0),
            "MTY" => ("Metrorrey", 9.0),
            _ => ("Camión urbano", 14.0),
        };
        var dur = hrs * 2.2 + 0.3;
        var sal = salidaPrevia ?? deadline.AddHours(-dur).AddMinutes(-CostosRutaSeeds.BufferMin);
        var arr = sal.AddHours(dur);
        return new OpCalc("metro", $"Transporte público ({sist})", $"{km:F0} km · tarifa plana", sal, arr, dur + 0.33, 20,
            tarifa, tarifa * 1.3, tarifa, true, null, null, null, null,
            arr > deadline, false, arr > deadline ? (int)(arr - deadline).TotalMinutes : 0,
            "seed transporte público", true, $"tarifa plana ~${tarifa:F0}",
            $"https://www.google.com/search?q={Uri.EscapeDataString(sist + " " + b.Nombre + " tarifa")}", "Google",
            "ver tarifa", "transporte público", "");
    }

    // ---------- Hoteles ----------

    private async Task<List<CostosRutaHotel>> HotelesAsync(PersonaNorm norm, int ixP, List<LugarNorm> prop,
        List<TramoCalc> tramos, bool calcular, CancellationToken ct,         List<string> incumplimientos)
    {
        var propuestos = new List<CostosRutaHotel>();
        for (var idx = 0; idx < prop.Count; idx++)
        {
            var nl = prop[idx];
            if (nl.Tipo == "punto" && nl.Propuesto) continue; // regreso: solo marca llegada
            if (nl.Salida is null) continue;
            DateTime llegada;
            string modo;
            if (nl.Tipo == "hotel") { llegada = nl.Llegada!.Value; modo = "hotel"; }
            else
            {
                if (idx == 0 || nl.Deadline is null) continue;
                var viables = tramos[idx - 1].Opciones.Where(o => !o.Late && !o.SaleAntes).ToList();
                var rep = (viables.Count > 0 ? viables : tramos[idx - 1].Opciones).MinBy(o => o.CostoGrupo);
                if (rep is null) continue;
                llegada = rep.Llegada; modo = rep.Modo;
            }
            var noches = NochesEstadia(llegada, modo, nl.Salida.Value);
            if (noches < 1) continue;
            if (!calcular)
            {
                incumplimientos.Add($"{nl.Nombre}: requiere hospedaje no calculado (pernocte de {noches} noche(s)).");
                continue;
            }
            var (key, _) = CostosRutaSeeds.SnapCiudad(nl.Lat, nl.Lon);
            var ciudad = key is not null ? CostosRutaSeeds.Ciudades[key].Nombre : nl.Nombre;
            var tarifa = CostosRutaSeeds.Viaticos.GetValueOrDefault(key ?? "CDMX", (600, 2000)).HospedajeNoche;
            var ci = llegada.Date.ToString("yyyy-MM-dd");
            var co = nl.Salida.Value.Date.ToString("yyyy-MM-dd");
            var link = (string n) => $"https://www.booking.com/searchresults.es.html?ss={Uri.EscapeDataString(n)}&checkin={ci}&checkout={co}&group_adults=1&no_rooms=1";
            propuestos.Add(new CostosRutaHotel
            {
                Lugar = nl.Nombre, Ciudad = ciudad, CheckIn = ci, CheckOut = co, Noches = noches, Habitaciones = 1,
                Motivo = $"pernocte {noches} noche(s) × 1 hab · tarifa tabulador ~${tarifa:F0}/noche",
                Fuente = "seed tabulador SHCP", Link = link(ciudad),
            });
            var reales = await hoteles.BuscarCercanosAsync(nl.Lat, nl.Lon, ct);
            foreach (var h in reales.Take(5))
                propuestos.Add(new CostosRutaHotel
                {
                    Lugar = nl.Nombre, Ciudad = ciudad, CheckIn = ci, CheckOut = co, Noches = noches, Habitaciones = 1,
                    Motivo = $"{h.Nombre} a {h.DistKm:F1} km de {nl.Nombre} · precio estimado con tarifa tabulador",
                    Fuente = reales.Count > 0 ? "OpenStreetMap/Overpass" : "seed tabulador SHCP (Overpass no respondió)",
                    Link = link(h.Nombre),
                });
        }
        return propuestos;
    }

    private static int NochesEstadia(DateTime llegada, string modo, DateTime salida)
    {
        if (salida <= llegada) return 0;
        var n = (salida.Date - llegada.Date).Days;
        if (n == 0 && llegada.Hour < 6 && modo is "auto" or "uber" or "renta" && (salida - llegada).TotalHours >= 4)
            n = 1;
        return Math.Max(0, n);
    }

    // ---------- Propuestas (6) ----------

    private List<CostosRutaPropuesta> ArmarPropuestas(PersonaNorm norm, List<LugarNorm> prop,
        List<TramoCalc> tramos, List<CostosRutaHotel> hoteles, List<string> incumplimientosBase)
    {
        var defs = new[]
        {
            ("barata", "💰 Más barato", "menor costo total estimado", null as string),
            ("rapida", "⚡ Más rápido", "menor tiempo total puerta a puerta", null),
            ("equilibrada", "⚖️ Equilibrado", "compromiso costo/tiempo por tramo", null),
            ("tipo1-carro", "🚗 Tipo 1 · Carro", "prioriza auto propio", "auto"),
            ("tipo2-bus", "🚌 Tipo 2 · Bus", "prioriza autobús", "bus"),
            ("tipo3-avion", "✈️ Tipo 3 · Avión", "prioriza avión", "avion"),
        };
        var totalRoadH = tramos.Sum(t => t.Hrs);
        var diasComidas = Math.Max(1, (int)Math.Ceiling(totalRoadH * 2 / 24));
        var comidas = diasComidas * CostosRutaSeeds.ComidaDiaEstandar;
        var out_ = new List<CostosRutaPropuesta>();
        foreach (var (clave, titulo, razon, modoPref) in defs)
        {
            var elegidas = new List<OpCalc?>();
            var inc = new List<string>(incumplimientosBase);
            for (var ti = 0; ti < tramos.Count; ti++)
            {
                var pool = Viables(tramos[ti]);
                OpCalc? pick = (clave, modoPref) switch
                {
                    ("barata", _) => pool.MinBy(o => o.CostoGrupo),
                    ("rapida", _) => pool.MinBy(o => o.PuertaH),
                    ("equilibrada", _) => Equilibrada(pool),
                    (_, string m) => pool.Where(o => o.Modo == m).MinBy(o => o.CostoGrupo) ?? pool.MinBy(o => o.CostoGrupo),
                    _ => pool.MinBy(o => o.CostoGrupo),
                };
                if (modoPref is not null && (pick is null || pick.Modo != modoPref))
                    inc.Add($"Tramo {ti + 1} ({tramos[ti].From} → {tramos[ti].To}): sin oferta {modoPref} viable.");
                if (pick is null) inc.Add($"Tramo {ti + 1}: sin opciones.");
                elegidas.Add(pick);
            }
            var validas = elegidas.Where(o => o is not null).Cast<OpCalc>().ToList();
            var transporte = validas.Sum(o => o.CostoGrupo);
            var taxiExtra = validas
                .Select((o, ti) => o.Modo is "bus" or "avion" ? MillaExtra(prop[ti], prop[ti + 1]) : 0)
                .Sum();
            var hosp = hoteles.Sum(h => h.Noches * 1 * TarifaHotel(h.Ciudad));
            var total = transporte + taxiExtra + hosp + comidas;
            var margenes = new List<int>();
            for (var ti = 0; ti < validas.Count; ti++)
            {
                var dl = prop[ti + 1].Deadline ?? prop[ti + 1].Llegada ?? prop[ti + 1].Salida;
                if (dl is not null) margenes.Add((int)(dl.Value - validas[ti].Llegada).TotalMinutes);
            }
            var cumple = validas.Count == tramos.Count
                && validas.All(o => !o.Late && !o.SaleAntes)
                && !inc.Any(m => m.Contains("hospedaje no calculado"));
            out_.Add(new CostosRutaPropuesta
            {
                Persona = norm.Nombre, Clave = clave, Titulo = $"{titulo} — {razon}",
                CumpleTodos = cumple,
                SalidaOrigen = prop[0].Salida?.ToString("dd/MM HH:mm") ?? "",
                LlegadaFinal = validas.Count > 0 ? validas[^1].Llegada.ToString("dd/MM HH:mm") : "",
                MargenMinimoMinutos = margenes.Count > 0 ? margenes.Min() : 0,
                CostoTotalMxn = Math.Round(total, 2),
                Tramos = validas.Select((o, ti) => new CostosRutaPropuestaTramo
                {
                    Tramo = ti + 1, De = tramos[ti].From, A = tramos[ti].To, Modo = o.Modo, Linea = o.Linea,
                    Salida = o.Salida.ToString("dd/MM HH:mm"), Llegada = o.Llegada.ToString("dd/MM HH:mm"),
                    Costo = Math.Round(o.CostoGrupo, 2),
                }).ToList(),
                HotelesPropuestos = hoteles,
                Incumplimientos = inc.Distinct().ToList(),
                Fuentes = validas.Select(o => o.Fuente).Distinct().ToList(),
            });
        }
        return out_;
    }

    private static List<OpCalc> Viables(TramoCalc t)
    {
        var v = t.Opciones.Where(o => !o.Late && !o.SaleAntes).ToList();
        return v.Count > 0 ? v : t.Opciones.ToList();
    }

    private static OpCalc? Equilibrada(List<OpCalc> pool)
    {
        if (pool.Count == 0) return null;
        var cs = pool.Select(o => o.CostoGrupo).ToList();
        var ts = pool.Select(o => o.PuertaH).ToList();
        double Rango(List<double> v) => (v.Max() - v.Min()) is var r && r > 0 ? r : 1.0;
        var rc = Rango(cs); var rt = Rango(ts);
        return pool.MinBy(o => 0.5 * (o.CostoGrupo - cs.Min()) / rc + 0.5 * (o.PuertaH - ts.Min()) / rt);
    }

    private static double MillaExtra(LugarNorm a, LugarNorm b)
    {
        double extra = 0;
        foreach (var s in new[] { a, b })
        {
            var (key, _) = CostosRutaSeeds.SnapCiudad(s.Lat, s.Lon);
            if (key is null) continue;
            var c = CostosRutaSeeds.Ciudades[key];
            var d = CostosRutaGeo.HaversineKm(s.Lat, s.Lon, c.Lat, c.Lon);
            if (d <= 3) continue;
            var (tb, tk) = CostosRutaSeeds.Taxi.GetValueOrDefault(key, (30, 11));
            extra += tb + tk * d;
        }
        return extra;
    }

    private static double TarifaHotel(string ciudad)
    {
        var kv = CostosRutaSeeds.Ciudades.FirstOrDefault(kv => kv.Value.Nombre == ciudad);
        return CostosRutaSeeds.Viaticos.GetValueOrDefault(kv.Key ?? "CDMX", (600, 2000)).HospedajeNoche;
    }

    // ---------- Ruta armada / ofertas ----------

    private static CostosRutaRutaArmada RutaArmada(List<LugarNorm> prop, List<TramoCalc> tramos, PreciosGasolina precios)
    {
        var armada = new CostosRutaRutaArmada();
        for (var ti = 0; ti < tramos.Count; ti++)
        {
            var t = tramos[ti];
            var litros = t.Km / RendimientoKmL;
            var (keyO, _) = CostosRutaSeeds.SnapCiudad(prop[ti].Lat, prop[ti].Lon);
            var (keyD, _) = CostosRutaSeeds.SnapCiudad(prop[ti + 1].Lat, prop[ti + 1].Lon);
            var cas = Casetas(keyO, keyD, t.Km);
            var cm = litros * precios.Magna;
            var cp = litros * precios.Premium;
            armada.Tramos.Add(new CostosRutaRutaTramo
            {
                De = t.From, A = t.To, Km = Math.Round(t.Km, 1), Litros = Math.Round(litros, 2),
                Gasolina = new CostosRutaGasolinaDetalle
                {
                    Magna = new CostosRutaPrecioCombustible { PrecioL = precios.Magna, Costo = Math.Round(cm, 2), Fuente = precios.Fuente },
                    Premium = new CostosRutaPrecioCombustible { PrecioL = precios.Premium, Costo = Math.Round(cp, 2), Fuente = precios.Fuente },
                },
                Casetas = new CostosRutaCasetasDetalle { Costo = cas.Costo, Fuente = cas.Fuente },
                SubtotalMagna = Math.Round(cm + cas.Costo, 2),
                SubtotalPremium = Math.Round(cp + cas.Costo, 2),
            });
        }
        armada.Totales = new CostosRutaRutaTotales
        {
            Km = Math.Round(armada.Tramos.Sum(t => t.Km), 1),
            Litros = Math.Round(armada.Tramos.Sum(t => t.Litros), 2),
            Casetas = Math.Round(armada.Tramos.Sum(t => t.Casetas.Costo), 2),
            SubtotalMagna = Math.Round(armada.Tramos.Sum(t => t.SubtotalMagna), 2),
            SubtotalPremium = Math.Round(armada.Tramos.Sum(t => t.SubtotalPremium), 2),
        };
        return armada;
    }

    private static CostosRutaOferta OfertaDe(OpCalc o, string persona, int ixP, int tramo, string de, string a)
    {
        var mid = (o.Lo + o.Hi) / 2;
        return new CostosRutaOferta
        {
            Id = $"p{ixP}-t{tramo}-{o.Modo}",
            Modo = o.Modo, Linea = o.Linea, Servicio = o.Codigo, Persona = persona,
            Tramo = tramo, De = de, A = a,
            Salida = o.Salida.ToString("yyyy-MM-ddTHH:mm"), Llegada = o.Llegada.ToString("yyyy-MM-ddTHH:mm"),
            SalidaTxt = o.Salida.ToString("dd/MM HH:mm"), LlegadaTxt = o.Llegada.ToString("dd/MM HH:mm"),
            Duracion = $"{(int)o.PuertaH}h {((int)Math.Round(o.PuertaH % 1 * 60)):D2}m",
            PuertaAPuertaH = Math.Round(o.PuertaH, 2),
            PrecioTxt = o.PorPersona ? $"${o.Lo:F0}–${o.Hi:F0} MXN /persona" : $"${o.Lo:F0}–${o.Hi:F0} MXN total",
            PorPersona = o.PorPersona, PrecioDesde = Math.Round(o.Lo, 2), PrecioHasta = Math.Round(o.Hi, 2),
            CostoGrupo = Math.Round(o.CostoGrupo, 2), CostoPorPersona = Math.Round(mid, 2),
            ATiempo = !o.Late && !o.SaleAntes, LlegaTarde = o.Late, MinutosTarde = o.LateMin, NoTomable = o.SaleAntes,
            Badge = o.Badge, Nota = o.Nota, Fuente = o.Fuente, Estimado = o.Estimado,
            Comprar = new CostosRutaCompra { Url = o.Url, Sitio = o.Sitio, Accion = o.Accion, Objetivo = o.Objetivo, Fecha = o.Salida.ToString("yyyy-MM-dd") },
        };
    }

    // ---------- Compartidos ----------

    private static Dictionary<int, Dictionary<int, ComparteInfo>> DetectarCompartidos(List<PersonaNorm> normas)
    {
        var legGroups = new Dictionary<int, Dictionary<int, ComparteInfo>>();
        var maxLegs = normas.Count > 0 ? normas.Max(n => n.Lugares.Count - 1) : 0;
        for (var j = 0; j < maxLegs; j++)
        {
            var grupos = new Dictionary<(double, double, double, double), List<int>>();
            for (var i = 0; i < normas.Count; i++)
            {
                var n = normas[i];
                if (j + 1 >= n.Lugares.Count) continue;
                var a = n.Lugares[j]; var b = n.Lugares[j + 1];
                var key = (Math.Round(a.Lat, 3), Math.Round(a.Lon, 3), Math.Round(b.Lat, 3), Math.Round(b.Lon, 3));
                if (!grupos.TryGetValue(key, out var g)) grupos[key] = g = [];
                g.Add(i);
            }
            foreach (var miembros in grupos.Values)
            {
                if (miembros.Count is < 2 or > 4) continue;
                var driver = miembros.Select(m => normas[m]).FirstOrDefault(n => n.CarroPropio)?.Nombre;
                foreach (var m in miembros)
                {
                    if (!legGroups.TryGetValue(m, out var d)) legGroups[m] = d = new();
                    d[j] = new ComparteInfo(miembros.Count, driver);
                }
            }
        }
        return legGroups;
    }

    private List<CostosRutaCompartido> CompartidosResumen(List<PersonaNorm> normas,
        Dictionary<int, Dictionary<int, ComparteInfo>> grupos, bool compartirActivo)
    {
        var vistos = new HashSet<string>();
        var out_ = new List<CostosRutaCompartido>();
        foreach (var (i, legs) in grupos)
            foreach (var (j, info) in legs)
            {
                var n = normas[i];
                if (j + 1 >= n.Lugares.Count) continue;
                var a = n.Lugares[j]; var b = n.Lugares[j + 1];
                var miembros = grupos.Where(kv => kv.Value.TryGetValue(j, out var ci)
                        && Math.Round(normas[kv.Key].Lugares[j].Lat, 3) == Math.Round(a.Lat, 3)
                        && Math.Round(normas[kv.Key].Lugares[j + 1].Lat, 3) == Math.Round(b.Lat, 3))
                    .Select(kv => normas[kv.Key].Nombre).Distinct().OrderBy(x => x).ToList();
                var clave = $"{a.Nombre}|{b.Nombre}|{string.Join(",", miembros)}";
                if (!vistos.Add(clave)) continue;
                var km = CostosRutaGeo.HaversineKm(a.Lat, a.Lon, b.Lat, b.Lon) * 1.25;
                var indiv = km / RendimientoKmL * 23.5 + Math.Round(km * CostosRutaSeeds.CasetaPorKm);
                var ahorro = Math.Round(indiv * (1 - 1.0 / info.N), 2);
                out_.Add(new CostosRutaCompartido
                {
                    De = a.Nombre, A = b.Nombre, Personas = miembros, Conductor = info.Conductor,
                    AhorroEstimadoMxn = ahorro,
                    Nota = compartirActivo
                        ? $"auto compartido entre {info.N}" + (info.Conductor is not null ? $" (maneja {info.Conductor})" : " (renta compartida)")
                        : $"ahorro potencial si comparten (~${ahorro:F0} por persona con seed magna/casetas)",
                });
            }
        return out_;
    }
}
