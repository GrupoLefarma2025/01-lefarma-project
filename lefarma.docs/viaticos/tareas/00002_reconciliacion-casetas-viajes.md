# Toll Reconciliation and SCT Availability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Correct SCT totals parsing, expose truthful per-leg availability, persist new auto cost components in existing option metadata, and make preview/authorization count every selected transportation price exactly once without adding SCT reference tariffs.

**Architecture:** Keep the existing static calculator, per-leg modal requests, `solicitud_opciones.datos_json` metadata, and authorization snapshot flow. Extend the existing route DTOs with per-leg SCT status/totals and nullable auto components, return explicit states from the SCT adapter, cache only official successful results, and share the same metadata-based reconciliation rules between the TypeScript preview and C# authorization. Leave the current calculated timing-summary JSX and all OSRM/fuel/margin formulas intact.

**Tech Stack:** .NET 10, C#, ASP.NET Core, xUnit, FluentAssertions, EF Core InMemory, `HttpMessageHandler`, React 19, TypeScript 5.9, Vitest 3, Testing Library, Playwright, Tailwind CSS.

---

## Approved-scope decisions

- Persist `datos.combustible`, `datos.casetas_estimadas`, and `datos.source` on newly calculated auto options. `source` is the existing offer `fuente`; no database column or migration is added.
- Treat components as a valid new-auto split only when both amounts are finite, non-negative, `source` is non-empty, and their sum is within 0.02 MXN of the selected price after rounding. Otherwise preserve the selected price as a legacy combined `gasolina` amount and leave `casetas` unknown. This prevents malformed metadata from changing the billable price.
- For mixed selections, split each valid new auto option and keep each rental or legacy auto price combined under `gasolina`; sum only new-auto `casetas_estimadas` into `casetas`.
- SCT rows, official distance/time, and official toll totals are reference detail only. They never enter `resumenCostosRuta` or `resumen_autorizado` and never replace OSRM distance/time.
- Missing availability metadata is presented as `respuesta_invalida`, not as an official zero. Only `disponible` results, including valid zero-plaza results with a totals row, are cached for 24 hours.
- Preserve authorization's existing snapshot `comida`; pass that same value into the recalculation preview so preview and authorization totals remain identical.
- Do not substitute another SCT city, add providers, recalculate historical requests, or change the static reference catalog used by existing calculated-route snapshots.

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | 1,100-1,500 including fixtures and focused tests |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | Work unit 1: SCT parser/availability; work unit 2: auto metadata and cost reconciliation; work unit 3: modal presentation and browser verification |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Suggested review boundary | Notes |
|---|---|---|---|
| 1 | Parser correctness, per-leg states, and successful-only caching | Independent backend slice | Parser fixture, adapter, DTO propagation, and backend tests stay together |
| 2 | Selected-price reconciliation and auto metadata | Depends on unit 1 DTO fields | Frontend preview and backend authorization tests use the same amounts |
| 3 | State messages, source labels, and guarded round-trip total | Depends on units 1 and 2 | Preserve the pre-existing timing-summary edits |

## File Map

- Modify `lefarma.backend/src/Lefarma.API/Features/Viaticos/CasetasRutaService.cs`: explicit states, robust merged-cell totals parsing, valid zero-plaza success, and provider/invalid classification.
- Modify `lefarma.backend/src/Lefarma.API/Features/Viaticos/DTOs/CostosRutaDtos.cs`: per-leg availability DTO and nullable auto component fields.
- Modify `lefarma.backend/src/Lefarma.API/Features/Viaticos/CalculoCostosRuta.cs`: successful-only SCT caching, per-leg DTO projection, and auto component projection.
- Modify `lefarma.backend/src/Lefarma.API/Features/Viaticos/AprobacionesController.cs`: reconcile selected options from persisted components; never sum reference plaza rows.
- Create `lefarma.backend/tests/Lefarma.UnitTests/Features/Viaticos/CasetasRutaServiceTests.cs`: recorded parser, availability, DTO, and cache tests with fake HTTP only.
- Create `lefarma.backend/tests/Lefarma.UnitTests/Features/Viaticos/Fixtures/sct-cdmx-pachuca.html`: minimal recorded CDMX-to-Pachuca response.
- Modify `lefarma.backend/tests/Lefarma.UnitTests/Lefarma.UnitTests.csproj`: copy the recorded fixture to test output.
- Modify `lefarma.backend/tests/Lefarma.UnitTests/Features/Viaticos/CostosRutaServiceTests.cs`: verify auto components sum to each selected price.
- Modify `lefarma.backend/tests/Lefarma.UnitTests/Features/Viaticos/AprobacionesControllerTests.cs`: cover new auto, mixed legacy/rental, reference-only SCT detail, and food-cost parity.
- Modify `lefarma.frontend/src/apps/viaticos/types/costosRuta.types.ts`: mirror the new DTO fields and state union.
- Modify `lefarma.frontend/src/apps/viaticos/types/solicitud.types.ts`: document typed option metadata keys while retaining the extension index.
- Modify `lefarma.frontend/src/apps/viaticos/services/calculoViaje.ts`: persist auto metadata and reconcile preview totals without SCT double counting.
- Modify `lefarma.frontend/src/apps/viaticos/services/calculoViaje.propuesta.test.ts`: metadata, new-auto, legacy, rental, mixed, invalid-metadata, and parity tests.
- Modify `lefarma.frontend/src/apps/viaticos/components/CalculosViajeModal.tsx`: only toll derivations, toll JSX, and the preview-summary call; retain all current timing-summary hunks.
- Modify `lefarma.frontend/src/apps/viaticos/components/CalculosViajeModal.test.tsx`: append state/aggregate/source tests to the user's current file.
- Create `lefarma.frontend/tests/viaticos-casetas.spec.ts`: browser-mocked desktop visual flow and screenshots; no live provider calls.
- Do not modify `.env`, `.env.development`, `package-lock.json`, database scripts, EF configurations, `casetasRuta.ts`, or the approved timing-summary branches except for the single preview-summary call outside those branches.

### Task 0: Establish the preservation baseline

**Files:**
- Verify only; do not modify implementation files.

- [x] **Step 1: Record existing work before starting**

Run from `C:\Repos\01-lefarma-project`:

```powershell
git status --short
git diff -- lefarma.frontend/src/apps/viaticos/components/CalculosViajeModal.tsx lefarma.frontend/src/apps/viaticos/components/CalculosViajeModal.test.tsx
git diff -- lefarma.frontend/.env lefarma.frontend/.env.development lefarma.frontend/package-lock.json
```

Expected: the modal/test diff already contains the approved calculated timing-summary work, and both environment files already point to `https://localhost:7034/api`. Do not stash, restore, format, or overwrite those changes. All later diffs must be reviewed as additions on top of this baseline.

### Task 1: Add the recorded SCT parser fixture and failing parser tests

**Files:**
- Create: `lefarma.backend/tests/Lefarma.UnitTests/Features/Viaticos/Fixtures/sct-cdmx-pachuca.html`
- Create: `lefarma.backend/tests/Lefarma.UnitTests/Features/Viaticos/CasetasRutaServiceTests.cs`
- Modify: `lefarma.backend/tests/Lefarma.UnitTests/Lefarma.UnitTests.csproj`

- [x] **Step 1: Create the minimal recorded CDMX-to-Pachuca HTML**

The two-column merged `Totales` label is intentional: without logical cell expansion, `01:15` shifts into the distance column and `72.00` is lost.

```html
<table>
  <tr>
    <th>Tramo</th><th>Carretera</th><th>Long.</th><th>Tiempo</th><th>Caseta o puente</th><th>Automóvil</th>
  </tr>
  <tr><td>CDMX - Ojo de Agua</td><td>México - Pachuca</td><td>40.100</td><td>00:30</td><td></td><td></td></tr>
  <tr><td>Ojo de Agua - Pachuca</td><td>México - Pachuca</td><td>23.300</td><td>00:20</td><td>Ojo de Agua</td><td>72.00</td></tr>
  <tr><td>Entrada a Pachuca</td><td>México - Pachuca</td><td>33.950</td><td>00:25</td><td></td><td></td></tr>
  <tr><td colspan="2">Totales</td><td>97.350</td><td>01:15</td><td></td><td>72.00</td></tr>
</table>
```

- [x] **Step 2: Copy the fixture without adding packages**

Add this item group before the closing `</Project>` in `Lefarma.UnitTests.csproj`:

```xml
  <ItemGroup>
    <None Update="Features\Viaticos\Fixtures\sct-cdmx-pachuca.html">
      <CopyToOutputDirectory>PreserveNewest</CopyToOutputDirectory>
    </None>
  </ItemGroup>
```

- [x] **Step 3: Create parser tests for merged totals, zero plazas, localization, and malformed content**

Create `CasetasRutaServiceTests.cs` with this complete initial content:

```csharp
using FluentAssertions;
using Lefarma.API.Features.Viaticos;

namespace Lefarma.UnitTests.Features.Viaticos;

public class CasetasRutaServiceTests
{
    private const string CeroPlazasHtml = """
    <table>
      <tr><th>Tramo</th><th>Carretera</th><th>Long.</th><th>Tiempo</th><th>Caseta o puente</th><th>Automóvil</th></tr>
      <tr><td colspan="2">Totales</td><td>12.000</td><td>00:20</td><td></td><td>0.00</td></tr>
    </table>
    """;

    private static string Fixture() => File.ReadAllText(Path.Combine(
        AppContext.BaseDirectory, "Features", "Viaticos", "Fixtures", "sct-cdmx-pachuca.html"));

    [Fact]
    public void ParseMergedTotals_PreservesDistanceTimePlazaAndToll()
    {
        var resultado = CasetasRutaService.ParsearRuta(Fixture());

        resultado.Estado.Should().Be(EstadosCasetasRuta.Disponible);
        resultado.KmTotal.Should().BeApproximately(97.350, 0.0001);
        resultado.TiempoTotal.Should().Be("01:15");
        resultado.PeajeTotal.Should().Be(72.0);
        resultado.Fuente.Should().Be("SCT · Rutas Punto a Punto");
        resultado.Casetas.Should().ContainSingle();
        resultado.Casetas[0].Nombre.Should().Be("Ojo de Agua");
        resultado.Casetas[0].KmDesdeOrigen.Should().BeApproximately(63.4, 0.01);
        resultado.Casetas[0].TarifaAuto.Should().Be(72.0);
    }

    [Fact]
    public void ParseValidZeroPlazaResponse_ReturnsAvailableWithOfficialZero()
    {
        var resultado = CasetasRutaService.ParsearRuta(CeroPlazasHtml);

        resultado.Estado.Should().Be(EstadosCasetasRuta.Disponible);
        resultado.Casetas.Should().BeEmpty();
        resultado.KmTotal.Should().Be(12.0);
        resultado.TiempoTotal.Should().Be("00:20");
        resultado.PeajeTotal.Should().Be(0.0);
    }

    [Fact]
    public void ParseLocalizedNumbers_UsesCorrectSeparators()
    {
        var html = Fixture().Replace("97.350", "1,234.50", StringComparison.Ordinal)
            .Replace("72.00", "$72,50", StringComparison.Ordinal);

        var resultado = CasetasRutaService.ParsearRuta(html);

        resultado.Estado.Should().Be(EstadosCasetasRuta.Disponible);
        resultado.KmTotal.Should().Be(1234.50);
        resultado.PeajeTotal.Should().Be(72.50);
        resultado.Casetas[0].TarifaAuto.Should().Be(72.50);
    }

    [Theory]
    [InlineData("<html><body>sin tabla de ruta</body></html>")]
    [InlineData("<table><tr><th>Carretera</th></tr><tr><td>Incompleta</td></tr></table>")]
    public void ParseMalformedContent_ReturnsInvalidWithoutZeros(string html)
    {
        var resultado = CasetasRutaService.ParsearRuta(html);

        resultado.Estado.Should().Be(EstadosCasetasRuta.RespuestaInvalida);
        resultado.Casetas.Should().BeEmpty();
        resultado.KmTotal.Should().BeNull();
        resultado.TiempoTotal.Should().BeNull();
        resultado.PeajeTotal.Should().BeNull();
    }

    [Fact]
    public void ParseMalformedTotal_DoesNotConvertToZero()
    {
        var html = Fixture().Replace("97.350", "no disponible", StringComparison.Ordinal);

        var resultado = CasetasRutaService.ParsearRuta(html);

        resultado.Estado.Should().Be(EstadosCasetasRuta.RespuestaInvalida);
        resultado.KmTotal.Should().BeNull();
        resultado.PeajeTotal.Should().BeNull();
    }
}
```

- [x] **Step 4: Run parser tests and verify RED**

Run from `lefarma.backend`:

```powershell
dotnet test tests/Lefarma.UnitTests/Lefarma.UnitTests.csproj --filter "FullyQualifiedName~CasetasRutaServiceTests"
```

Expected: FAIL during compilation with `CS0117` because the private `ParsearRuta` is not accessible on the static class, plus missing `Estado`/`EstadosCasetasRuta` errors. This is the intended contract-first RED; no test performs a network call.

### Task 2: Implement explicit SCT states and merged-cell parser correctness

**Files:**
- Modify: `lefarma.backend/src/Lefarma.API/Features/Viaticos/CasetasRutaService.cs`

- [x] **Step 1: Replace the result contract and add state constants**

Keep `CasetaRutaInfo` unchanged. Replace `ResultadoCasetasRuta` and add the constants with:

```csharp
public static class EstadosCasetasRuta
{
    public const string Disponible = "disponible";
    public const string DestinoNoSoportado = "destino_no_soportado";
    public const string ProveedorNoDisponible = "proveedor_no_disponible";
    public const string RespuestaInvalida = "respuesta_invalida";
}

/// <summary>Official route data when available; null totals never mean official zero.</summary>
public record ResultadoCasetasRuta(
    string Estado,
    IReadOnlyList<CasetaRutaInfo> Casetas,
    double? KmTotal,
    string? TiempoTotal,
    double? PeajeTotal,
    string Fuente);
```

- [x] **Step 2: Classify blank/unsupported endpoints and malformed catalogs without route substitution**

Replace the complete `ConsultarInternoAsync` method with:

```csharp
private static async Task<ResultadoCasetasRuta> ConsultarInternoAsync(
    HttpClient http,
    string origenMunicipio,
    string origenEstado,
    string destinoMunicipio,
    string destinoEstado,
    CancellationToken ct)
{
    var o = Normalizar(origenMunicipio);
    var d = Normalizar(destinoMunicipio);
    if (o.Length == 0 || d.Length == 0) return SinOficial(EstadosCasetasRuta.DestinoNoSoportado);

    var html = await GetAsync(http, $"{Base}?action=cmdEscogeRuta", ct);
    var estados = Opciones(html, "edoOrigen");
    if (estados.Count == 0)
    {
        Serilog.Log.Warning("SCT: catálogo inicial sin estados interpretables");
        return SinOficial(EstadosCasetasRuta.RespuestaInvalida);
    }

    var idEstadoOrigen = ResolverEstado(estados, origenEstado);
    var idEstadoDestino = ResolverEstado(estados, destinoEstado);
    if (idEstadoOrigen is null || idEstadoDestino is null)
    {
        Serilog.Log.Warning("SCT: no se resolvió el estado ({Origen} / {Destino})", origenEstado, destinoEstado);
        return SinOficial(EstadosCasetasRuta.DestinoNoSoportado);
    }

    var conCiudades = await PostAsync(http, Accion(html, "cmdEscogeRuta"), new Dictionary<string, string>
    {
        ["tipo"] = "1",
        ["edoOrigen"] = idEstadoOrigen,
        ["edoDestino"] = idEstadoDestino,
        ["ciudadOrigen"] = "",
        ["ciudadDestino"] = "",
        ["vehiculos"] = "",
        ["puntosIntermedios"] = "null",
        ["red"] = "simplificada",
        ["calculaRendimiento"] = "null",
    }, ct);

    var ciudadesOrigen = Opciones(conCiudades, "ciudadOrigen");
    var ciudadesDestino = Opciones(conCiudades, "ciudadDestino");
    if (ciudadesOrigen.Count == 0 && ciudadesDestino.Count == 0)
    {
        Serilog.Log.Warning("SCT: catálogo de ciudades vacío o no interpretable");
        return SinOficial(EstadosCasetasRuta.RespuestaInvalida);
    }

    var idCiudadOrigen = ResolverCiudad(ciudadesOrigen, o);
    var idCiudadDestino = ResolverCiudad(ciudadesDestino, d);
    if (idCiudadOrigen is null || idCiudadDestino is null)
    {
        Serilog.Log.Warning("SCT: no se resolvió la ciudad ({Origen} / {Destino})", o, d);
        return SinOficial(EstadosCasetasRuta.DestinoNoSoportado);
    }

    var resultado = await PostAsync(http, Accion(conCiudades, "cmdSolRutas"), new Dictionary<string, string>
    {
        ["tipo"] = "1",
        ["edoOrigen"] = idEstadoOrigen,
        ["edoDestino"] = idEstadoDestino,
        ["ciudadOrigen"] = idCiudadOrigen,
        ["ciudadDestino"] = idCiudadDestino,
        ["vehiculos"] = VehiculoAuto,
        ["puntosIntermedios"] = "null",
        ["red"] = "simplificada",
        ["calculaRendimiento"] = "null",
        ["cmdEnviar"] = "Consultar",
    }, ct);

    return ParsearRuta(resultado);
}
```

- [x] **Step 3: Replace the parser with logical colspan expansion and strict totals validation**

Replace `ParsearRuta` and `Vacio`, and add the helpers below. No other HTML/catalog helper changes.

```csharp
internal static ResultadoCasetasRuta ParsearRuta(string html)
{
    foreach (Match tabla in Regex.Matches(html, "<table[^>]*>(.*?)</table>", RegexOptions.Singleline))
    {
        var contenido = tabla.Groups[1].Value;
        if (!contenido.Contains("Caseta o puente", StringComparison.OrdinalIgnoreCase)) continue;

        var filas = new List<List<string>>();
        foreach (Match fila in Regex.Matches(contenido, "(?s)<tr[^>]*>(.*?)</tr>"))
        {
            var celdas = ExpandirCeldas(fila);
            if (celdas.Count > 0) filas.Add(celdas);
        }

        var idxEncabezado = filas.FindIndex(f =>
            f.Any(c => c.Contains("Caseta o puente", StringComparison.OrdinalIgnoreCase))
            && f.Any(c => c.Contains("Carretera", StringComparison.OrdinalIgnoreCase)));
        if (idxEncabezado < 0) continue;

        var encabezado = filas[idxEncabezado];
        var colCarretera = encabezado.FindIndex(c => c.Contains("Carretera", StringComparison.OrdinalIgnoreCase));
        var colKm = encabezado.FindIndex(c => c.Contains("Long", StringComparison.OrdinalIgnoreCase));
        var colTiempo = encabezado.FindIndex(c => c.Contains("Tiempo", StringComparison.OrdinalIgnoreCase));
        var colCaseta = encabezado.FindIndex(c => c.Contains("Caseta o puente", StringComparison.OrdinalIgnoreCase));
        var colAuto = encabezado.FindIndex(c =>
            c.Contains("Autom", StringComparison.OrdinalIgnoreCase)
            && !c.Contains("remolque", StringComparison.OrdinalIgnoreCase)
            && !c.Contains("Pick", StringComparison.OrdinalIgnoreCase));
        if (colCarretera < 0 || colKm < 0 || colTiempo < 0 || colCaseta < 0 || colAuto < 0)
            return Invalida("encabezado de ruta incompleto");

        var casetas = new List<CasetaRutaInfo>();
        var kmAcumulado = 0d;
        var ultimaColumna = Math.Max(colAuto, Math.Max(colCaseta, Math.Max(colKm, colTiempo)));
        foreach (var fila in filas.Skip(idxEncabezado + 1))
        {
            if (fila.All(string.IsNullOrWhiteSpace)) continue;
            if (fila.Count <= ultimaColumna) return Invalida("fila con columnas insuficientes");

            if (fila.Any(c => c.StartsWith("Totales", StringComparison.OrdinalIgnoreCase)))
            {
                if (!TryNumero(fila[colKm], out var kmTotal) || kmTotal < 0)
                    return Invalida($"distancia total inválida: {fila[colKm]}");
                if (!TryNumero(fila[colAuto], out var peajeTotal) || peajeTotal < 0)
                    return Invalida($"peaje total inválido: {fila[colAuto]}");
                var tiempoTotal = fila[colTiempo];
                if (!Regex.IsMatch(tiempoTotal, @"^\d{1,3}:\d{2}$"))
                    return Invalida($"tiempo total inválido: {tiempoTotal}");
                return new ResultadoCasetasRuta(
                    EstadosCasetasRuta.Disponible,
                    casetas,
                    kmTotal,
                    tiempoTotal,
                    peajeTotal,
                    "SCT · Rutas Punto a Punto");
            }

            if (!TryNumero(fila[colKm], out var largo) || largo < 0)
                return Invalida($"longitud de tramo inválida: {fila[colKm]}");
            kmAcumulado += largo;
            var plaza = fila[colCaseta];
            if (plaza.Length == 0) continue;
            if (!TryNumero(fila[colAuto], out var tarifa) || tarifa < 0)
                return Invalida($"tarifa inválida para {plaza}: {fila[colAuto]}");

            var tramo = fila[0];
            var carretera = fila[colCarretera];
            var direccion = tramo.Length > 0 ? $"{tramo} · {carretera}".Trim(' ', '·') : carretera;
            casetas.Add(new CasetaRutaInfo(plaza, carretera, Math.Round(kmAcumulado, 1), tarifa, direccion));
        }

        return Invalida("tabla de ruta sin fila de totales");
    }

    return Invalida("no se encontró una tabla de ruta interpretable");
}

private static List<string> ExpandirCeldas(Match fila)
{
    var celdas = new List<string>();
    foreach (Match celda in Regex.Matches(fila.Groups[1].Value, "(?s)<t[dh]([^>]*)>(.*?)</t[dh]>"))
    {
        var atributos = celda.Groups[1].Value;
        var colspanMatch = Regex.Match(atributos, "(?:^|\\s)colspan\\s*=\\s*[\\\"']?(\\d+)", RegexOptions.IgnoreCase);
        var colspan = colspanMatch.Success && int.TryParse(colspanMatch.Groups[1].Value, out var n) && n > 0 ? n : 1;
        celdas.Add(Limpiar(Regex.Replace(celda.Groups[2].Value, "<[^>]+>", " ")));
        for (var i = 1; i < colspan; i++) celdas.Add(string.Empty);
    }
    return celdas;
}

private static bool TryNumero(string texto, out double valor)
{
    valor = 0;
    var limpio = Limpiar(texto)
        .Replace("$", string.Empty, StringComparison.Ordinal)
        .Replace("MXN", string.Empty, StringComparison.OrdinalIgnoreCase)
        .Replace("km", string.Empty, StringComparison.OrdinalIgnoreCase)
        .Replace(" ", string.Empty, StringComparison.Ordinal);
    if (limpio.Length == 0) return false;

    var coma = limpio.LastIndexOf(',');
    var punto = limpio.LastIndexOf('.');
    if (coma >= 0 && punto >= 0)
    {
        limpio = coma > punto
            ? limpio.Replace(".", string.Empty, StringComparison.Ordinal).Replace(',', '.')
            : limpio.Replace(",", string.Empty, StringComparison.Ordinal);
    }
    else if (coma >= 0)
    {
        var partes = limpio.Split(',');
        var miles = partes.Length > 2 || (partes.Length == 2 && partes[1].Length == 3);
        limpio = miles ? string.Join(string.Empty, partes) : string.Join(".", partes);
    }
    else if (punto >= 0 && limpio.Count(c => c == '.') > 1)
    {
        limpio = limpio.Replace(".", string.Empty, StringComparison.Ordinal);
    }

    return double.TryParse(limpio, NumberStyles.Number, CultureInfo.InvariantCulture, out valor)
        && double.IsFinite(valor);
}

private static ResultadoCasetasRuta Invalida(string detalle)
{
    Serilog.Log.Warning("SCT: respuesta inválida: {Detalle}", detalle);
    return SinOficial(EstadosCasetasRuta.RespuestaInvalida);
}

private static ResultadoCasetasRuta SinOficial(string estado) =>
    new(estado, [], null, null, null, string.Empty);
```

- [x] **Step 4: Run parser tests and verify GREEN**

Run from `lefarma.backend`:

```powershell
dotnet test tests/Lefarma.UnitTests/Lefarma.UnitTests.csproj --filter "FullyQualifiedName~CasetasRutaServiceTests"
```

Expected: PASS for all parser tests. The CDMX-Pachuca fixture reports 97.350 km, `01:15`, Ojo de Agua at 63.4 km, and 72 MXN; malformed input never produces zero totals.

### Task 3: Add failing per-leg availability, propagation, and cache tests

**Files:**
- Modify: `lefarma.backend/tests/Lefarma.UnitTests/Features/Viaticos/CasetasRutaServiceTests.cs`

- [x] **Step 1: Add DTO/cache namespaces**

Add these imports to the test file:

```csharp
using System.Net;
using System.Text;
using System.Text.Json;
using Lefarma.API.Features.Viaticos.DTOs;
using Microsoft.Extensions.Caching.Memory;
```

- [x] **Step 2: Append fake SCT HTTP and motor request helpers**

Append inside `CasetasRutaServiceTests`:

```csharp
private static CostosRutaRequest Request(string municipioOrigen = "Ciudad de México") => new()
{
    Opciones = new CostosRutaOpcionesInput { CalcularHoteles = false, CalcularViajesIntermedios = false },
    Personas =
    [
        new CostosRutaPersonaInput
        {
            Nombre = "Ana",
            CarroPropio = true,
            Gasolina = "magna",
            Draft = false,
            Lugares =
            [
                new CostosRutaLugarInput
                {
                    Orden = 1,
                    Tipo = "salida",
                    Nombre = "Origen",
                    Municipio = municipioOrigen,
                    Estado = municipioOrigen == "Ciudad de México" ? "Ciudad de México" : "Hidalgo",
                    Latitud = 19.4326,
                    Longitud = -99.1332,
                    FechaSalida = "2026-11-10",
                    HoraSalida = "08:00",
                },
                new CostosRutaLugarInput
                {
                    Orden = 2,
                    Tipo = "taller",
                    Nombre = "Destino",
                    Municipio = "Pachuca",
                    Estado = "Hidalgo",
                    Latitud = 20.1011,
                    Longitud = -98.7591,
                    FechaInicioActividad = "2026-11-10",
                    HoraInicioActividad = "12:00",
                    FechaFinActividad = "2026-11-10",
                    HoraFinActividad = "13:00",
                },
            ],
        },
    ],
};

private sealed class SctFakeHandler : HttpMessageHandler
{
    private const string EstadosHtml = """
    <form name="frmConsulta" action="https://app.sct.gob.mx/sibuac_internet/ControllerUI?action=cmdEscogeRuta">
      <select name="edoOrigen"><option value="9">Distrito Federal</option><option value="13">Hidalgo</option></select>
    </form>
    """;
    private const string CiudadesHtml = """
    <form name="frmConsulta" action="https://app.sct.gob.mx/sibuac_internet/ControllerUI?action=cmdSolRutas">
      <select name="ciudadOrigen"><option value="1">Ciudad de México</option><option value="2">Pachuca</option></select>
      <select name="ciudadDestino"><option value="1">Ciudad de México</option><option value="2">Pachuca</option></select>
    </form>
    """;

    private readonly string _routeHtml;
    private readonly bool _fail;
    public int Calls { get; private set; }

    public SctFakeHandler(string routeHtml, bool fail = false)
    {
        _routeHtml = routeHtml;
        _fail = fail;
    }

    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
    {
        if (request.RequestUri?.Host != "app.sct.gob.mx")
            return Task.FromResult(Response(HttpStatusCode.InternalServerError, string.Empty));
        Calls++;
        if (_fail) return Task.FromResult(Response(HttpStatusCode.ServiceUnavailable, string.Empty));
        if (request.Method == HttpMethod.Get) return Task.FromResult(Response(HttpStatusCode.OK, EstadosHtml));
        if (request.RequestUri.Query.Contains("cmdEscogeRuta", StringComparison.Ordinal))
            return Task.FromResult(Response(HttpStatusCode.OK, CiudadesHtml));
        if (request.RequestUri.Query.Contains("cmdSolRutas", StringComparison.Ordinal))
            return Task.FromResult(Response(HttpStatusCode.OK, _routeHtml));
        return Task.FromResult(Response(HttpStatusCode.InternalServerError, string.Empty));
    }

    private static HttpResponseMessage Response(HttpStatusCode status, string body) => new(status)
    {
        Content = new StringContent(body, Encoding.UTF8, "text/html"),
    };
}
```

- [x] **Step 3: Append availability and successful-only cache tests**

```csharp
[Fact]
public async Task Motor_AvailableResultPropagatesAndUsesCache()
{
    using var handler = new SctFakeHandler(Fixture());
    using var http = new HttpClient(handler);
    using var cache = new MemoryCache(new MemoryCacheOptions());

    var primera = await CalculoCostosRuta.CalcularAsync(Request(), http, cache);
    var segunda = await CalculoCostosRuta.CalcularAsync(Request(), http, cache);

    var disponibilidad = primera.Resultados[0].CasetasDisponibilidad.Single();
    disponibilidad.Estado.Should().Be(EstadosCasetasRuta.Disponible);
    var wire = JsonSerializer.Serialize(primera.Resultados[0], new JsonSerializerOptions(JsonSerializerDefaults.Web));
    wire.Should().Contain("\"casetasDisponibilidad\"").And.Contain("\"estado\":\"disponible\"");
    disponibilidad.KmTotal.Should().Be(97.350);
    disponibilidad.TiempoTotal.Should().Be("01:15");
    disponibilidad.PeajeTotal.Should().Be(72.0);
    primera.Resultados[0].Casetas.Should().ContainSingle(c => c.Nombre == "Ojo de Agua" && c.Km == 63.4);
    segunda.Resultados[0].CasetasDisponibilidad.Single().Estado.Should().Be(EstadosCasetasRuta.Disponible);
    handler.Calls.Should().Be(3, "the second calculation must reuse the successful official result");
}

[Fact]
public async Task Motor_CachesValidZeroPlazaSuccess()
{
    using var handler = new SctFakeHandler(CeroPlazasHtml);
    using var http = new HttpClient(handler);
    using var cache = new MemoryCache(new MemoryCacheOptions());

    var primera = await CalculoCostosRuta.CalcularAsync(Request(), http, cache);
    await CalculoCostosRuta.CalcularAsync(Request(), http, cache);

    var disponibilidad = primera.Resultados[0].CasetasDisponibilidad.Single();
    disponibilidad.Estado.Should().Be(EstadosCasetasRuta.Disponible);
    disponibilidad.PeajeTotal.Should().Be(0);
    primera.Resultados[0].Casetas.Should().BeEmpty();
    handler.Calls.Should().Be(3);
}

[Fact]
public async Task Motor_InvalidResponseIsNotCachedAndHasNoZeros()
{
    using var handler = new SctFakeHandler("<html>respuesta no interpretable</html>");
    using var http = new HttpClient(handler);
    using var cache = new MemoryCache(new MemoryCacheOptions());

    var primera = await CalculoCostosRuta.CalcularAsync(Request(), http, cache);
    await CalculoCostosRuta.CalcularAsync(Request(), http, cache);

    var disponibilidad = primera.Resultados[0].CasetasDisponibilidad.Single();
    disponibilidad.Estado.Should().Be(EstadosCasetasRuta.RespuestaInvalida);
    disponibilidad.KmTotal.Should().BeNull();
    disponibilidad.PeajeTotal.Should().BeNull();
    primera.Resultados[0].Casetas.Should().BeEmpty();
    handler.Calls.Should().Be(6);
}

[Fact]
public async Task Motor_ProviderFailureIsNotCachedAndHasNoZeros()
{
    using var handler = new SctFakeHandler(string.Empty, fail: true);
    using var http = new HttpClient(handler);
    using var cache = new MemoryCache(new MemoryCacheOptions());

    var primera = await CalculoCostosRuta.CalcularAsync(Request(), http, cache);
    await CalculoCostosRuta.CalcularAsync(Request(), http, cache);

    var disponibilidad = primera.Resultados[0].CasetasDisponibilidad.Single();
    disponibilidad.Estado.Should().Be(EstadosCasetasRuta.ProveedorNoDisponible);
    disponibilidad.KmTotal.Should().BeNull();
    disponibilidad.PeajeTotal.Should().BeNull();
    primera.Resultados[0].Casetas.Should().BeEmpty();
    handler.Calls.Should().Be(2);
}

[Fact]
public async Task Motor_UnsupportedDestinationIsNotSubstitutedOrCached()
{
    using var handler = new SctFakeHandler(Fixture());
    using var http = new HttpClient(handler);
    using var cache = new MemoryCache(new MemoryCacheOptions());

    var primera = await CalculoCostosRuta.CalcularAsync(Request("Mineral de la Reforma"), http, cache);
    await CalculoCostosRuta.CalcularAsync(Request("Mineral de la Reforma"), http, cache);

    var disponibilidad = primera.Resultados[0].CasetasDisponibilidad.Single();
    disponibilidad.Estado.Should().Be(EstadosCasetasRuta.DestinoNoSoportado);
    disponibilidad.KmTotal.Should().BeNull();
    disponibilidad.PeajeTotal.Should().BeNull();
    primera.Resultados[0].Casetas.Should().BeEmpty();
    handler.Calls.Should().Be(4, "unsupported catalog entries must not reach the route request or the success cache");
}
```

- [x] **Step 4: Run the expanded tests and verify RED**

Run from `lefarma.backend`:

```powershell
dotnet test tests/Lefarma.UnitTests/Lefarma.UnitTests.csproj --filter "FullyQualifiedName~CasetasRutaServiceTests"
```

Expected: FAIL compilation because `CostosRutaResultado.CasetasDisponibilidad` does not exist. After that DTO exists, behavioral RED must show current caching of non-successful empty results if any implementation step is partially applied.

### Task 4: Propagate availability and cache only official success

**Files:**
- Modify: `lefarma.backend/src/Lefarma.API/Features/Viaticos/CasetasRutaService.cs`
- Modify: `lefarma.backend/src/Lefarma.API/Features/Viaticos/DTOs/CostosRutaDtos.cs`
- Modify: `lefarma.backend/src/Lefarma.API/Features/Viaticos/CalculoCostosRuta.cs`

- [x] **Step 1: Convert provider exceptions to `proveedor_no_disponible` while preserving caller cancellation**

Replace `ConsultarAsync` with:

```csharp
public static async Task<ResultadoCasetasRuta> ConsultarAsync(
    HttpClient http,
    string origenMunicipio,
    string origenEstado,
    string destinoMunicipio,
    string destinoEstado,
    CancellationToken ct)
{
    await Semaforo.WaitAsync(ct);
    try
    {
        return await ConsultarInternoAsync(http, origenMunicipio, origenEstado, destinoMunicipio, destinoEstado, ct);
    }
    catch (OperationCanceledException) when (ct.IsCancellationRequested)
    {
        throw;
    }
    catch (Exception ex)
    {
        Serilog.Log.Warning("SCT: proveedor no disponible {Origen} → {Destino}: {Error}",
            origenMunicipio, destinoMunicipio, ex.Message);
        return SinOficial(EstadosCasetasRuta.ProveedorNoDisponible);
    }
    finally
    {
        Semaforo.Release();
    }
}
```

- [x] **Step 2: Add the per-leg DTO and response property**

Add to `CostosRutaResultado`:

```csharp
/// <summary>One explicit SCT availability result per calculated leg.</summary>
public List<CostosRutaCasetaDisponibilidad> CasetasDisponibilidad { get; set; } = [];
```

Add this complete DTO immediately after `CostosRutaCaseta`:

```csharp
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
```

- [x] **Step 3: Carry both flat official rows and per-leg states through the calculator**

In `CalcularAsync`, replace the current conditional assignment to `casetas` with:

```csharp
var casetas = new List<CostosRutaCaseta>();
var casetasDisponibilidad = new List<CostosRutaCasetaDisponibilidad>();
if (norm.CarroPropio)
    (casetas, casetasDisponibilidad) = await CasetasAsync(prop, tramos, http, cache, ct);
```

In the `CostosRutaResultado` initializer, keep `Casetas = casetas` and add:

```csharp
CasetasDisponibilidad = casetasDisponibilidad,
```

- [x] **Step 4: Replace `CasetasAsync` with per-leg state projection and guarded caching**

```csharp
private static async Task<(List<CostosRutaCaseta> Casetas, List<CostosRutaCasetaDisponibilidad> Disponibilidad)> CasetasAsync(
    List<LugarNorm> lugares, List<TramoCalc> tramos, HttpClient http, IMemoryCache cache, CancellationToken ct)
{
    var salida = new List<CostosRutaCaseta>();
    var disponibilidad = new List<CostosRutaCasetaDisponibilidad>();
    for (var t = 0; t < tramos.Count && t + 1 < lugares.Count; t++)
    {
        var origen = lugares[t];
        var destino = lugares[t + 1];
        ResultadoCasetasRuta info;
        if (string.IsNullOrWhiteSpace(origen.Municipio) || string.IsNullOrWhiteSpace(destino.Municipio))
        {
            info = new ResultadoCasetasRuta(
                EstadosCasetasRuta.DestinoNoSoportado, [], null, null, null, string.Empty);
        }
        else
        {
            var clave = $"casetas-sct:{origen.Municipio}|{origen.Estado}|{destino.Municipio}|{destino.Estado}";
            if (!cache.TryGetValue(clave, out ResultadoCasetasRuta? guardada) || guardada is null)
            {
                guardada = await CasetasRutaService.ConsultarAsync(
                    http, origen.Municipio, origen.Estado, destino.Municipio, destino.Estado, ct);
                if (guardada.Estado == EstadosCasetasRuta.Disponible)
                    cache.Set(clave, guardada, TimeSpan.FromHours(24));
            }
            info = guardada;
        }

        disponibilidad.Add(new CostosRutaCasetaDisponibilidad
        {
            Tramo = t + 1,
            DeMunicipio = origen.Municipio,
            AMunicipio = destino.Municipio,
            Estado = info.Estado,
            KmTotal = info.KmTotal,
            TiempoTotal = info.TiempoTotal,
            PeajeTotal = info.PeajeTotal,
            Fuente = info.Fuente,
        });
        if (info.Estado != EstadosCasetasRuta.Disponible) continue;

        foreach (var caseta in info.Casetas)
        {
            salida.Add(new CostosRutaCaseta
            {
                Tramo = t + 1,
                DeMunicipio = origen.Municipio,
                AMunicipio = destino.Municipio,
                Nombre = caseta.Nombre,
                Carretera = caseta.Carretera,
                Km = caseta.KmDesdeOrigen,
                Tarifa = caseta.TarifaAuto,
                Direccion = caseta.Direccion,
                Fuente = info.Fuente,
            });
        }
    }
    return (salida, disponibilidad);
}
```

- [x] **Step 5: Run availability/parser tests and verify GREEN**

Run from `lefarma.backend`:

```powershell
dotnet test tests/Lefarma.UnitTests/Lefarma.UnitTests.csproj --filter "FullyQualifiedName~CasetasRutaServiceTests"
```

Expected: PASS for all parser and motor tests. Available success is fetched once and reused; invalid, provider-failure, and unsupported outcomes are fetched again on a later calculation and contain null totals rather than false zeros.

### Task 5: Expose new auto components without changing selected prices

**Files:**
- Modify: `lefarma.backend/tests/Lefarma.UnitTests/Features/Viaticos/CostosRutaServiceTests.cs`
- Modify: `lefarma.backend/src/Lefarma.API/Features/Viaticos/DTOs/CostosRutaDtos.cs`
- Modify: `lefarma.backend/src/Lefarma.API/Features/Viaticos/CalculoCostosRuta.cs`

- [x] **Step 1: Add the failing component invariant test**

Append inside `CostosRutaServiceTests`:

```csharp
[Fact]
public async Task AutoOffers_ExposeComponentsThatSumToSelectedPrice()
{
    var (http, cache) = Infra();

    var resp = await CalculoCostosRuta.CalcularAsync(new CostosRutaRequest
    {
        Opciones = new CostosRutaOpcionesInput { CalcularHoteles = false },
        Personas = [Ana()],
    }, http, cache);

    var autos = resp.Resultados.SelectMany(r => r.Tramos)
        .SelectMany(t => t.Opciones)
        .Where(o => o.Modo == "auto")
        .ToList();
    autos.Should().NotBeEmpty();
    foreach (var auto in autos)
    {
        auto.Combustible.Should().NotBeNull();
        auto.CasetasEstimadas.Should().NotBeNull();
        (auto.Combustible!.Value + auto.CasetasEstimadas!.Value)
            .Should().BeApproximately(auto.CostoGrupo, 0.02);
    }
}
```

Run from `lefarma.backend`:

```powershell
dotnet test tests/Lefarma.UnitTests/Lefarma.UnitTests.csproj --filter "FullyQualifiedName~AutoOffers_ExposeComponentsThatSumToSelectedPrice"
```

Expected RED: compilation fails because `Combustible` and `CasetasEstimadas` are absent.

- [x] **Step 2: Add nullable component fields to `CostosRutaOferta`**

Place these properties immediately before `Comprar`:

```csharp
/// <summary>Fuel component already included in CostoGrupo for newly calculated auto offers.</summary>
public double? Combustible { get; set; }
/// <summary>Estimated toll component already included in CostoGrupo; zero is valid for the free-road offer.</summary>
public double? CasetasEstimadas { get; set; }
```

- [x] **Step 3: Preserve component/price parity for shared auto offers**

Replace only the auto-offer loop in `CalcularTramoAsync` with:

```csharp
if (!sinAuto)
{
    var divisor = nSh is > 1 ? nSh.Value : 1;
    var litros = km / RendimientoEfectivo();
    foreach (var (nombre, casetas, factorT) in new[] { ("Auto (cuota)", cas.Costo, 1.0), ("Auto (libre)", 0.0, 1.15) })
    {
        var dur = hrs * factorT;
        var sal = salidaPrevia ?? deadline.AddHours(-dur).AddMinutes(-BufferMin);
        var arr = sal.AddHours(dur);
        var parte = (gas + casetas) / divisor;
        opts.Add(new OpCalc("auto", nombre + NotaSh(), $"{km:F0} km carretera", sal, arr, dur, 0,
            parte, parte * 1.1, parte, false, litros / divisor, precios.Magna, casetas / divisor, null,
            arr > deadline, false, arr > deadline ? (int)(arr - deadline).TotalMinutes : 0,
            $"OSRM + CNE ({srcRuta}; {precios.Fuente})", false,
            salidaPrevia is not null ? $"casetas + gasolina CNE · sales {sal:dd/MM HH:mm} (tu hora){NotaSh()}" : $"casetas + gasolina CNE · sale {sal:dd/MM HH:mm} para llegar {BufferMin} min antes{NotaSh()}",
            osm, "OSRM + OpenStreetMap", "ver ruta", $"ruta de manejo {a.Nombre} → {b.Nombre}", ""));
    }
}
```

- [x] **Step 4: Project the components in `OfertaDe`**

Add these assignments immediately before the `Comprar` assignment in the returned initializer:

```csharp
Combustible = o.Modo == "auto" && o.Litros is { } litros && o.PrecioLitro is { } precioLitro
    ? Math.Round(litros * precioLitro, 2)
    : null,
CasetasEstimadas = o.Modo == "auto" && o.CasetasVal is { } casetasEstimadas
    ? Math.Round(casetasEstimadas, 2)
    : null,
```

- [x] **Step 5: Verify GREEN and existing calculator regressions**

Run from `lefarma.backend`:

```powershell
dotnet test tests/Lefarma.UnitTests/Lefarma.UnitTests.csproj --filter "FullyQualifiedName~CostosRutaServiceTests|FullyQualifiedName~CasetasRutaServiceTests"
```

Expected: PASS. Every auto component pair sums to `CostoGrupo` within rounding tolerance; existing distance, subtotal, proposal, and provider-fallback tests remain green.

### Task 6: Persist option metadata and reconcile the frontend preview

**Files:**
- Modify: `lefarma.frontend/src/apps/viaticos/types/costosRuta.types.ts`
- Modify: `lefarma.frontend/src/apps/viaticos/types/solicitud.types.ts`
- Modify: `lefarma.frontend/src/apps/viaticos/services/calculoViaje.propuesta.test.ts`
- Modify: `lefarma.frontend/src/apps/viaticos/services/calculoViaje.ts`
- Modify: `lefarma.frontend/src/apps/viaticos/components/CalculosViajeModal.tsx` only at the `resumenCostosRuta` call

- [x] **Step 1: Extend frontend contracts without making existing fixtures invalid**

Add to `CostosRutaOferta`:

```typescript
/** Components already included in costoGrupo for newly calculated auto offers. */
combustible?: number | null;
casetasEstimadas?: number | null;
```

Add to `DatosOpcion`:

```typescript
combustible?: number;
casetas_estimadas?: number;
source?: string;
```

- [x] **Step 2: Add failing metadata persistence coverage**

Append inside the existing `construirOpcionesPropuesta` test group:

```typescript
it('persists auto components in datos without changing the selected price', () => {
  const auto = oferta({
    id: 'auto-nuevo',
    modo: 'auto',
    linea: 'Auto (cuota)',
    costoGrupo: 300,
    combustible: 180,
    casetasEstimadas: 120,
    fuente: 'OSRM + CNE (fixture)',
  });

  const opciones = construirOpcionesPropuesta(
    [tramo('Guadalajara', 'Zapopan')],
    { 0: respuesta([auto]) },
    { 0: 'auto-nuevo' },
  );

  expect(opciones).toHaveLength(1);
  expect(opciones[0].precio).toBe(300);
  expect(opciones[0].fue_elegida).toBe(true);
  expect(opciones[0].datos).toEqual({
    tramo: 0,
    de: 'Guadalajara',
    a: 'Zapopan',
    combustible: 180,
    casetas_estimadas: 120,
    source: 'OSRM + CNE (fixture)',
  });
});
```

- [x] **Step 3: Replace the summary test group with reconciliation scenarios**

Replace the complete existing `resumenCostosRuta` test group with:

```typescript
describe('resumenCostosRuta', () => {
  const calculo: CalculoViaje = {
    generado_en: '2026-11-10T08:00:00.000Z',
    margen: 0.1,
    modo_transporte: 'propio',
    km_total: 120,
    horas_total: null,
    tramos: [
      {
        de: 'Guadalajara',
        a: 'Zapopan',
        km: 120,
        duracion: null,
        duracion_con_margen: null,
        salida_fecha: null,
        salida_hora: null,
        llegada_fecha: null,
        llegada_hora: null,
        alcanza: null,
        casetas: [caseta({ costo: 72 })],
      },
    ],
  };
  const opciones = [
    opcionElegida({ tipo: 'autobus', precio: 500.25 }),
    opcionElegida({ tipo: 'hotel', precio: 1200 }),
    opcionElegida({ tipo: 'taxi', precio: 80.5 }),
    opcionElegida({ tipo: 'auto', precio: 300 }),
    opcionElegida({ tipo: 'vuelo', precio: 999, fue_elegida: false }),
    opcionElegida({ tipo: 'autobus', precio: 222, fue_elegida: false }),
  ];

  it('keeps legacy auto combined and never adds the SCT reference', () => {
    expect(resumenCostosRuta(calculo, opciones, 'propio')).toEqual({
      autobus: 500.25,
      avion: null,
      gasolina: 300,
      casetas: null,
      hospedaje: 1200,
      comida: null,
      taxi: 80.5,
      total: 2080.75,
    });
  });

  it('splits new auto 300 into fuel 180 and toll 120 without adding reference 72', () => {
    const autoNuevo = opcionElegida({
      tipo: 'auto',
      precio: 300,
      datos: { combustible: 180, casetas_estimadas: 120, source: 'OSRM + CNE (fixture)' },
    });

    expect(resumenCostosRuta(calculo, [autoNuevo], 'propio')).toEqual({
      autobus: null,
      avion: null,
      gasolina: 180,
      casetas: 120,
      hospedaje: null,
      comida: null,
      taxi: null,
      total: 300,
    });
  });

  it('keeps rental and legacy auto combined when mixed with a new auto', () => {
    const seleccion = [
      opcionElegida({
        tipo: 'auto',
        precio: 300,
        datos: { combustible: 180, casetas_estimadas: 120, source: 'OSRM + CNE (fixture)' },
      }),
      opcionElegida({ tipo: 'auto', precio: 500 }),
      opcionElegida({ tipo: 'renta', precio: 900 }),
    ];

    const resumen = resumenCostosRuta(calculo, seleccion, 'propio');
    expect(resumen.gasolina).toBe(1580);
    expect(resumen.casetas).toBe(120);
    expect(resumen.total).toBe(1700);
  });

  it('falls back to the combined price when components do not reconcile', () => {
    const inconsistente = opcionElegida({
      tipo: 'auto',
      precio: 300,
      datos: { combustible: 180, casetas_estimadas: 60, source: 'OSRM + CNE (fixture)' },
    });

    const resumen = resumenCostosRuta(calculo, [inconsistente], 'propio');
    expect(resumen.gasolina).toBe(300);
    expect(resumen.casetas).toBeNull();
    expect(resumen.total).toBe(300);
  });

  it('does not add reference tolls for requested transportation', () => {
    const resumen = resumenCostosRuta(calculo, opciones, 'solicitado');
    expect(resumen.casetas).toBeNull();
    expect(resumen.total).toBe(2080.75);
  });

  it('includes existing food cost so preview matches authorization', () => {
    const autoNuevo = opcionElegida({
      tipo: 'auto',
      precio: 300,
      datos: { combustible: 180, casetas_estimadas: 120, source: 'OSRM + CNE (fixture)' },
    });

    const resumen = resumenCostosRuta(calculo, [autoNuevo], 'propio', 350);
    expect(resumen).toMatchObject({ gasolina: 180, casetas: 120, comida: 350, total: 650 });
  });

  it('leaves concepts null when nothing is selected instead of inventing zeros', () => {
    expect(resumenCostosRuta(calculo, [], 'solicitado')).toEqual({
      autobus: null,
      avion: null,
      gasolina: null,
      casetas: null,
      hospedaje: null,
      comida: null,
      taxi: null,
      total: null,
    });
  });
});
```

- [x] **Step 4: Run the frontend service tests and verify RED**

Run from `lefarma.frontend`:

```powershell
npm test -- src/apps/viaticos/services/calculoViaje.propuesta.test.ts
```

Expected: FAIL because auto `datos` lacks components and current summaries add the 72 MXN SCT reference. The legacy expectation is 2080.75; new-auto total must be 300, not 372.

- [x] **Step 5: Persist auto components in existing `datos` metadata**

Replace `opcionDesdeOferta` with:

```typescript
function opcionDesdeOferta(
  oferta: CostosRutaOferta,
  datos: DatosOpcionPropuesta,
  fueElegida: boolean,
): OpcionCotizacion {
  const capturas = oferta.capturas ?? (oferta.rutaCaptura ? [oferta.rutaCaptura] : []);
  const precio = precioOferta(oferta);
  const estimado = oferta.estimado || precio === null;
  const fuente = fuenteConEstimado(oferta.fuente?.trim() || 'Motor', estimado);
  const combustible = oferta.combustible;
  const casetasEstimadas = oferta.casetasEstimadas;
  const componentesValidos = oferta.modo === 'auto'
    && precio !== null
    && typeof combustible === 'number'
    && Number.isFinite(combustible)
    && combustible >= 0
    && typeof casetasEstimadas === 'number'
    && Number.isFinite(casetasEstimadas)
    && casetasEstimadas >= 0
    && Math.abs(combustible + casetasEstimadas - precio) <= 0.02;

  return {
    tipo: TIPO_OPCION[oferta.modo] ?? oferta.modo,
    linea: oferta.linea,
    precio,
    moneda: 'MXN',
    url_compra: urlCompraValida(oferta.comprar?.url),
    fuente,
    fue_elegida: fueElegida,
    ruta_captura: capturas[0] ?? null,
    capturas,
    datos: componentesValidos
      ? {
          ...datos,
          combustible: dosDecimales(combustible),
          casetas_estimadas: dosDecimales(casetasEstimadas),
          source: oferta.fuente.trim() || 'Motor',
        }
      : datos,
  };
}
```

- [x] **Step 6: Implement metadata-based preview reconciliation and snapshot food parity**

Add these helpers before `resumenCostosRuta`:

```typescript
interface ComponentesAutoPersistidos {
  combustible: number;
  casetas: number;
}

function componentesAutoPersistidos(opcion: OpcionCotizacion): ComponentesAutoPersistidos | null {
  if (opcion.tipo !== 'auto' || opcion.precio === null || !Number.isFinite(opcion.precio)) return null;
  const combustible = opcion.datos?.combustible;
  const casetas = opcion.datos?.casetas_estimadas;
  const source = opcion.datos?.source;
  if (
    typeof combustible !== 'number' || !Number.isFinite(combustible) || combustible < 0
    || typeof casetas !== 'number' || !Number.isFinite(casetas) || casetas < 0
    || typeof source !== 'string' || source.trim() === ''
    || Math.abs(combustible + casetas - opcion.precio) > 0.02
  ) {
    return null;
  }
  return { combustible, casetas };
}

export function comidaDesdeSnapshot(datos: unknown): number | null {
  if (typeof datos !== 'object' || datos === null || Array.isArray(datos)) return null;
  const comida = (datos as Record<string, unknown>).comida;
  return typeof comida === 'number' && Number.isFinite(comida) ? comida : null;
}
```

Replace `resumenCostosRuta` with:

```typescript
export function resumenCostosRuta(
  calculo: CalculoViaje,
  opciones: OpcionCotizacion[],
  modoTransporte: 'propio' | 'solicitado',
  comida: number | null = null,
): ResumenCostosRuta {
  void calculo;
  const sumarElegidas = (filtro: (opcion: OpcionCotizacion) => boolean): number | null => {
    const precios = opciones
      .filter((opcion) => opcion.fue_elegida && filtro(opcion))
      .map((opcion) => opcion.precio)
      .filter((precio): precio is number => typeof precio === 'number' && Number.isFinite(precio));
    if (precios.length === 0) return null;
    return dosDecimales(precios.reduce((suma, precio) => suma + precio, 0));
  };

  let gasolinaAcumulada = 0;
  let casetasAcumuladas = 0;
  let hayGasolina = false;
  let hayCasetas = false;
  for (const opcion of opciones) {
    if (!opcion.fue_elegida || (opcion.tipo !== 'auto' && opcion.tipo !== 'renta')) continue;
    if (typeof opcion.precio !== 'number' || !Number.isFinite(opcion.precio)) continue;
    const componentes = modoTransporte === 'propio' ? componentesAutoPersistidos(opcion) : null;
    if (componentes) {
      gasolinaAcumulada += componentes.combustible;
      casetasAcumuladas += componentes.casetas;
      hayCasetas = true;
    } else {
      gasolinaAcumulada += opcion.precio;
    }
    hayGasolina = true;
  }

  const autobus = sumarElegidas((opcion) => opcion.tipo === 'autobus');
  const avion = sumarElegidas((opcion) => opcion.tipo === 'vuelo');
  const gasolina = hayGasolina ? dosDecimales(gasolinaAcumulada) : null;
  const casetas = hayCasetas ? dosDecimales(casetasAcumuladas) : null;
  const hospedaje = sumarElegidas((opcion) => opcion.tipo === 'hotel');
  const taxi = sumarElegidas((opcion) => opcion.tipo === 'taxi');
  const comidaConocida = typeof comida === 'number' && Number.isFinite(comida) ? dosDecimales(comida) : null;
  const conceptos = [autobus, avion, gasolina, casetas, hospedaje, comidaConocida, taxi];
  const total = conceptos.some((valor) => valor !== null)
    ? dosDecimales(conceptos.reduce<number>((suma, valor) => suma + (valor ?? 0), 0))
    : null;

  return { autobus, avion, gasolina, casetas, hospedaje, comida: comidaConocida, taxi, total };
}
```

The `calculo` parameter is retained for call compatibility and explicitly marked unused; reference tolls are not read.

In `CalculosViajeModal.tsx`, add `comidaDesdeSnapshot` to the existing `calculoViaje` import and replace only the summary call with:

```typescript
const resumen = resumenCostosRuta(
  calculo,
  opciones,
  modoCalculo,
  comidaDesdeSnapshot(solicitud.datos),
);
```

- [x] **Step 7: Run the service tests and verify GREEN**

Run from `lefarma.frontend`:

```powershell
npm test -- src/apps/viaticos/services/calculoViaje.propuesta.test.ts
```

Expected: PASS. Selected prices remain unchanged; reference tariffs do not affect any total; mixed and invalid-metadata scenarios preserve combined amounts; the 300 + 350 food scenario totals 650.

### Task 7: Make backend authorization match the preview exactly

**Files:**
- Modify: `lefarma.backend/tests/Lefarma.UnitTests/Features/Viaticos/AprobacionesControllerTests.cs`
- Modify: `lefarma.backend/src/Lefarma.API/Features/Viaticos/AprobacionesController.cs`

- [x] **Step 1: Update the existing legacy-auto expectation**

In `Autorizar_ConRutaNueva_GuardaResumenAutorizadoYBandejaLoDevuelve`, keep the 800 MXN auto option without component metadata and all three reference plazas. Replace the affected assertions in both the sealed summary and bandeja with:

```csharp
resumen.GetProperty("gasolina").GetDecimal().Should().Be(800m);
resumen.GetProperty("casetas").ValueKind.Should().Be(JsonValueKind.Null);
resumen.GetProperty("total").GetDecimal().Should().Be(8450m);
```

```csharp
fila.Gasolina.Should().Be(800m);
fila.Casetas.Should().BeNull();
fila.Total.Should().Be(8450m);
```

The previous 8750 total was 5000 flight + 800 legacy auto + 300 reference toll + 2000 hotel + 350 food + 300 taxi. Removing only the reference toll produces 8450.

- [x] **Step 2: Add failing authorization parity and mixed-selection tests**

Append these tests before the adjustment-test section:

```csharp
[Fact]
public async Task Authorize_NewAuto_SplitsComponentsAndMatchesPreviewWithoutSct()
{
    using var ctx = new TestContext();
    const int adminId = 7160;
    var id = ctx.SembrarSolicitud(adminId, "enviada", """{"comida":350,"total":1000}""");
    using var cliente = ctx.Servidor.CreateClient();
    cliente.DefaultRequestHeaders.Add("X-Test-UserId", adminId.ToString());
    cliente.DefaultRequestHeaders.Add("X-Test-Permissions", Permissions.Viaticos.Autorizar);

    var resp = await cliente.PostAsJsonAsync($"/api/viaticos/solicitudes/{id}/autorizar", new
    {
        calculo = new
        {
            modo_transporte = "propio",
            tramos = new[]
            {
                new { de = "CDMX", a = "Pachuca", casetas = new[] { new { nombre = "Ojo de Agua", costo = 72m } } },
            },
        },
        opciones = new[]
        {
            new
            {
                tipo = "auto",
                linea = "Auto (cuota)",
                precio = 300m,
                moneda = "MXN",
                fuente = "OSRM + CNE (fixture)",
                fue_elegida = true,
                datos = new { combustible = 180m, casetas_estimadas = 120m, source = "OSRM + CNE (fixture)" },
            },
        },
    });

    resp.StatusCode.Should().Be(HttpStatusCode.OK);
    var opcion = ctx.LeeOpciones(id).Single();
    opcion.Precio.Should().Be(300m);
    opcion.DatosJson.Should().Contain("combustible").And.Contain("casetas_estimadas").And.Contain("source");
    var resumen = ctx.LeeResumenAutorizado(id);
    resumen.GetProperty("gasolina").GetDecimal().Should().Be(180m);
    resumen.GetProperty("casetas").GetDecimal().Should().Be(120m);
    resumen.GetProperty("comida").GetDecimal().Should().Be(350m);
    resumen.GetProperty("total").GetDecimal().Should().Be(650m);
}

[Fact]
public async Task Authorize_MixedNewLegacyAndRental_CountsEachPriceOnce()
{
    using var ctx = new TestContext();
    const int adminId = 7161;
    var id = ctx.SembrarSolicitud(adminId, "enviada", """{"total":1000}""");
    using var cliente = ctx.Servidor.CreateClient();
    cliente.DefaultRequestHeaders.Add("X-Test-UserId", adminId.ToString());
    cliente.DefaultRequestHeaders.Add("X-Test-Permissions", Permissions.Viaticos.Autorizar);

    var resp = await cliente.PostAsJsonAsync($"/api/viaticos/solicitudes/{id}/autorizar", new
    {
        calculo = new
        {
            modo_transporte = "propio",
            tramos = new[] { new { de = "CDMX", a = "Pachuca", casetas = new[] { new { nombre = "Referencia", costo = 72m } } } },
        },
        opciones = new object[]
        {
            new { tipo = "auto", linea = "Nuevo", precio = 300m, moneda = "MXN", fuente = "motor", fue_elegida = true,
                datos = new { combustible = 180m, casetas_estimadas = 120m, source = "motor" } },
            new { tipo = "auto", linea = "Legado", precio = 500m, moneda = "MXN", fuente = "motor", fue_elegida = true },
            new { tipo = "renta", linea = "Renta", precio = 900m, moneda = "MXN", fuente = "seed renta", fue_elegida = true },
        },
    });

    resp.StatusCode.Should().Be(HttpStatusCode.OK);
    var resumen = ctx.LeeResumenAutorizado(id);
    resumen.GetProperty("gasolina").GetDecimal().Should().Be(1580m);
    resumen.GetProperty("casetas").GetDecimal().Should().Be(120m);
    resumen.GetProperty("total").GetDecimal().Should().Be(1700m);
}

[Fact]
public async Task Authorize_InconsistentComponents_PreserveCombinedPrice()
{
    using var ctx = new TestContext();
    const int adminId = 7162;
    var id = ctx.SembrarSolicitud(adminId, "enviada", """{"total":1000}""");
    using var cliente = ctx.Servidor.CreateClient();
    cliente.DefaultRequestHeaders.Add("X-Test-UserId", adminId.ToString());
    cliente.DefaultRequestHeaders.Add("X-Test-Permissions", Permissions.Viaticos.Autorizar);

    var resp = await cliente.PostAsJsonAsync($"/api/viaticos/solicitudes/{id}/autorizar", new
    {
        calculo = new { modo_transporte = "propio", tramos = Array.Empty<object>() },
        opciones = new[]
        {
            new { tipo = "auto", linea = "Metadata inconsistente", precio = 300m, moneda = "MXN", fuente = "motor", fue_elegida = true,
                datos = new { combustible = 180m, casetas_estimadas = 60m, source = "motor" } },
        },
    });

    resp.StatusCode.Should().Be(HttpStatusCode.OK);
    var resumen = ctx.LeeResumenAutorizado(id);
    resumen.GetProperty("gasolina").GetDecimal().Should().Be(300m);
    resumen.GetProperty("casetas").ValueKind.Should().Be(JsonValueKind.Null);
    resumen.GetProperty("total").GetDecimal().Should().Be(300m);
}
```

- [x] **Step 3: Run authorization tests and verify RED**

Run from `lefarma.backend`:

```powershell
dotnet test tests/Lefarma.UnitTests/Lefarma.UnitTests.csproj --filter "FullyQualifiedName~AprobacionesControllerTests"
```

Expected: FAIL on new-auto 180/120/650 versus current 300/72/722, mixed 1580/120/1700 versus current combined-plus-reference behavior, and the updated legacy 8450 expectation versus current 8750.

- [x] **Step 4: Replace authorization reconciliation with selected-option metadata rules**

Replace `GuardarResumenAutorizado` and add the component reader below it. Keep `SumarOpciones` for bus/flight/hotel/taxi and keep `EsModoPropio`.

```csharp
private static void GuardarResumenAutorizado(
    Solicitud solicitud,
    IEnumerable<SolicitudOpcion> opciones,
    JsonElement? calculo)
{
    var elegidas = opciones.Where(o => o.FueElegida).ToList();

    decimal? autobus = SumarOpciones(elegidas, "autobus");
    decimal? avion = SumarOpciones(elegidas, "vuelo", "avion");
    decimal? hospedaje = SumarOpciones(elegidas, "hotel");
    decimal? taxi = SumarOpciones(elegidas, "taxi");
    decimal? gasolina = null;
    decimal? casetas = null;
    var desglosaAuto = EsModoPropio(calculo);
    foreach (var opcion in elegidas.Where(o =>
        o.Precio.HasValue
        && (string.Equals(o.Tipo, "auto", StringComparison.OrdinalIgnoreCase)
            || string.Equals(o.Tipo, "renta", StringComparison.OrdinalIgnoreCase))))
    {
        var componentes = desglosaAuto ? LeerComponentesAuto(opcion) : null;
        if (componentes is null)
        {
            gasolina = (gasolina ?? 0m) + opcion.Precio!.Value;
        }
        else
        {
            gasolina = (gasolina ?? 0m) + componentes.Combustible;
            casetas = (casetas ?? 0m) + componentes.Casetas;
        }
    }

    decimal? comida = LeerDecimal(ParsearDatosJson(solicitud.DatosJson), "comida");
    var conceptos = new[] { autobus, avion, gasolina, casetas, hospedaje, comida, taxi };
    decimal? total = conceptos.Any(c => c.HasValue)
        ? conceptos.Sum(c => c ?? 0m)
        : null;

    EscribirPropiedadSnapshot(
        solicitud,
        "resumen_autorizado",
        JsonSerializer.SerializeToElement(new
        {
            autobus,
            avion,
            gasolina,
            casetas,
            hospedaje,
            comida,
            taxi,
            total,
        }));
}

private sealed record ComponentesAuto(decimal Combustible, decimal Casetas);

private static ComponentesAuto? LeerComponentesAuto(SolicitudOpcion opcion)
{
    if (!string.Equals(opcion.Tipo, "auto", StringComparison.OrdinalIgnoreCase)
        || opcion.Precio is not { } precio
        || string.IsNullOrWhiteSpace(opcion.DatosJson))
    {
        return null;
    }

    try
    {
        using var doc = JsonDocument.Parse(opcion.DatosJson);
        var datos = doc.RootElement;
        if (datos.ValueKind != JsonValueKind.Object
            || !datos.TryGetProperty("combustible", out var combustibleEl)
            || combustibleEl.ValueKind != JsonValueKind.Number
            || !combustibleEl.TryGetDecimal(out var combustible)
            || !datos.TryGetProperty("casetas_estimadas", out var casetasEl)
            || casetasEl.ValueKind != JsonValueKind.Number
            || !casetasEl.TryGetDecimal(out var casetas)
            || !datos.TryGetProperty("source", out var sourceEl)
            || sourceEl.ValueKind != JsonValueKind.String
            || string.IsNullOrWhiteSpace(sourceEl.GetString())
            || combustible < 0
            || casetas < 0
            || Math.Abs(combustible + casetas - precio) > 0.02m)
        {
            return null;
        }
        return new ComponentesAuto(combustible, casetas);
    }
    catch (JsonException)
    {
        return null;
    }
}
```

Delete the now-unused `SumarCasetas` method and update the `GuardarResumenAutorizado` XML comment to state: selected auto/rental prices are counted once; valid new-auto metadata supplies the split; SCT `calculo.tramos[].casetas` is reference-only. Do not change bandeja fallback behavior or historical snapshots outside authorization.

- [x] **Step 5: Run authorization and preview parity tests and verify GREEN**

Run from `lefarma.backend` and `lefarma.frontend` respectively:

```powershell
dotnet test tests/Lefarma.UnitTests/Lefarma.UnitTests.csproj --filter "FullyQualifiedName~AprobacionesControllerTests"
```

```powershell
npm test -- src/apps/viaticos/services/calculoViaje.propuesta.test.ts
```

Expected: PASS in both. For identical inputs, both produce fuel 180, toll 120, food 350, total 650; legacy/rental amounts remain combined and SCT reference 72 is never added.

### Task 8: Add state-based modal presentation without disturbing the timing summary

**Files:**
- Modify: `lefarma.frontend/src/apps/viaticos/types/costosRuta.types.ts`
- Modify: `lefarma.frontend/src/apps/viaticos/components/CalculosViajeModal.test.tsx`
- Modify: `lefarma.frontend/src/apps/viaticos/components/CalculosViajeModal.tsx`

- [x] **Step 1: Mirror per-leg availability in frontend types**

Add before `CostosRutaResultado`:

```typescript
export type EstadoCasetasSct =
  | 'disponible'
  | 'destino_no_soportado'
  | 'proveedor_no_disponible'
  | 'respuesta_invalida';

export interface CostosRutaCasetaDisponibilidad {
  tramo: number;
  deMunicipio?: string;
  aMunicipio?: string;
  estado: EstadoCasetasSct;
  kmTotal: number | null;
  tiempoTotal: string | null;
  peajeTotal: number | null;
  fuente: string;
}
```

Add to `CostosRutaResultado`:

```typescript
casetasDisponibilidad?: CostosRutaCasetaDisponibilidad[];
```

- [x] **Step 2: Extend the existing car response factory without replacing user tests**

Replace the current `carEngineResponse` helper and add the availability factory immediately before it:

```tsx
function disponibilidadSct(
  estado: import('../types/costosRuta.types').EstadoCasetasSct,
  peajeTotal: number | null = null,
  regreso = false,
): import('../types/costosRuta.types').CostosRutaCasetaDisponibilidad {
  return {
    tramo: 1,
    deMunicipio: regreso ? 'Zapopan' : 'Guadalajara',
    aMunicipio: regreso ? 'Guadalajara' : 'Zapopan',
    estado,
    kmTotal: estado === 'disponible' ? 97.35 : null,
    tiempoTotal: estado === 'disponible' ? '01:15' : null,
    peajeTotal,
    fuente: estado === 'disponible' ? 'SCT · Rutas Punto a Punto' : '',
  };
}

const carEngineResponse = (
  duration = '2h 00m',
  estado: import('../types/costosRuta.types').EstadoCasetasSct = 'destino_no_soportado',
  regreso = false,
): CostosRutaResponse => {
  const response = respuestaMotor();
  response.resultados[0].tramos = [
    {
      from: 'Guadalajara',
      to: 'Zapopan',
      km: 120,
      opciones: [
        {
          ...oferta('auto', 'Auto propio', 900),
          modo: 'auto',
          duracion: duration,
          combustible: 780,
          casetasEstimadas: 120,
          fuente: 'OSRM + CNE (fixture)',
        },
      ],
    },
  ];
  response.resultados[0].casetasDisponibilidad = [disponibilidadSct(estado, null, regreso)];
  return response;
};
```

- [x] **Step 3: Append state, source-label, and aggregate tests**

Append this new group after the existing calculated car summary group and before the authorization group:

```tsx
describe('CalculosViajeModal SCT availability and source labels', () => {
  it('shows official detail as reference and the estimated components already included in the auto price', async () => {
    const response = carEngineResponse('2h 00m', 'disponible');
    response.resultados[0].casetas = [
      {
        tramo: 1,
        deMunicipio: 'Guadalajara',
        aMunicipio: 'Zapopan',
        nombre: 'Ojo de Agua',
        carretera: 'México - Pachuca',
        km: 63.4,
        tarifa: 72,
        direccion: 'México - Pachuca',
        fuente: 'SCT · Rutas Punto a Punto',
      },
    ];
    response.resultados[0].casetasDisponibilidad = [disponibilidadSct('disponible', 72)];
    mocks.calcular.mockResolvedValue({ data: { success: true, data: response } });

    await renderCarSummary(carTrip());
    const detail = await screen.findByRole('region', { name: 'Detalle de casetas SCT' });
    expect(within(detail).getByText('Ojo de Agua')).toBeInTheDocument();
    expect(within(detail).getByText('Total casetas del tramo')).toBeInTheDocument();
    expect(within(detail).getAllByText('$72')).toHaveLength(2);
    expect(detail).toHaveTextContent('Fuente oficial: SCT · Rutas Punto a Punto');
    expect(detail).toHaveTextContent('Referencia: 97.350 km · 01:15');
    expect(detail).toHaveTextContent('No se suma al precio seleccionado.');
    expect(detail).toHaveTextContent('combustible $780 + casetas estimadas $120 = $900');
    expect(detail).toHaveTextContent('Fuente de la estimación: OSRM + CNE (fixture).');
    expect(screen.getByRole('region', { name: 'Resumen calculado del viaje' }))
      .toHaveTextContent('Duración ajustada: 2h 12m · Incluye 10% de margen.');
  });

  it('distinguishes a valid official zero-plaza result from unavailable detail', async () => {
    const response = carEngineResponse('2h 00m', 'disponible');
    response.resultados[0].casetasDisponibilidad = [disponibilidadSct('disponible', 0)];
    mocks.calcular.mockResolvedValue({ data: { success: true, data: response } });

    await renderCarSummary(carTrip());
    const detail = await screen.findByRole('region', { name: 'Detalle de casetas SCT' });
    expect(detail).toHaveTextContent('La SCT no reporta plazas de cobro para este tramo.');
    expect(within(detail).queryByRole('table')).not.toBeInTheDocument();
    expect(detail).not.toHaveTextContent('Sin desglose de plazas para esta ruta.');
  });

  it.each([
    ['destino_no_soportado', 'La SCT no tiene este origen o destino en su catálogo; no hay desglose oficial disponible.'],
    ['proveedor_no_disponible', 'No fue posible consultar la SCT. Intenta nuevamente.'],
    ['respuesta_invalida', 'No fue posible interpretar el desglose oficial de casetas.'],
  ] as const)('shows the exact message for %s without a false zero or reference table', async (estado, mensaje) => {
    mocks.calcular.mockResolvedValue({
      data: { success: true, data: carEngineResponse('2h 00m', estado) },
    });

    await renderCarSummary(carTrip());
    const detail = await screen.findByRole('region', { name: 'Detalle de casetas SCT' });
    expect(detail).toHaveTextContent(mensaje);
    expect(within(detail).queryByRole('table')).not.toBeInTheDocument();
    expect(detail).not.toHaveTextContent('$0');
  });

  it('does not present a complete official round-trip total when the return leg is unavailable', async () => {
    const user = userEvent.setup();
    const outbound = carEngineResponse('2h 00m', 'disponible');
    outbound.resultados[0].casetasDisponibilidad = [disponibilidadSct('disponible', 72)];
    mocks.calcular
      .mockResolvedValueOnce({ data: { success: true, data: outbound } })
      .mockResolvedValueOnce({
        data: { success: true, data: carEngineResponse('2h 00m', 'proveedor_no_disponible', true) },
      });
    render(
      <CalculosViajeModal solicitud={carTrip()} open onOpenChange={vi.fn()} onEnviado={vi.fn()} />,
    );

    const next = await screen.findByRole('button', { name: /siguiente/i });
    await waitFor(() => expect(next).toBeEnabled());
    await user.click(next);

    const detail = await screen.findByRole('region', { name: 'Detalle de casetas SCT' });
    expect(detail).toHaveTextContent('No fue posible consultar la SCT. Intenta nuevamente.');
    expect(detail).toHaveTextContent('No hay un total oficial de ida y vuelta');
    expect(screen.queryByText(/Total oficial SCT de ida y vuelta:/)).not.toBeInTheDocument();
  });

  it('sums official leg totals only when every leg is available', async () => {
    const user = userEvent.setup();
    let calls = 0;
    const response = (regreso: boolean) => {
      const value = carEngineResponse('2h 00m', 'disponible', regreso);
      value.resultados[0].casetasDisponibilidad = [disponibilidadSct('disponible', 72, regreso)];
      return value;
    };
    mocks.calcular.mockImplementation(async () => {
      calls += 1;
      return { data: { success: true, data: response(calls === 2) } };
    });
    render(
      <CalculosViajeModal solicitud={carTrip()} open onOpenChange={vi.fn()} onEnviado={vi.fn()} />,
    );

    const next = await screen.findByRole('button', { name: /siguiente/i });
    await waitFor(() => expect(next).toBeEnabled());
    await user.click(next);

    const detail = await screen.findByRole('region', { name: 'Detalle de casetas SCT' });
    expect(detail).toHaveTextContent('Total oficial SCT de ida y vuelta: $144');
    expect(screen.getByRole('region', { name: 'Resumen calculado del viaje' }))
      .toHaveTextContent('Duración ajustada: 2h 12m · Incluye 10% de margen.');
  });
});
```

- [x] **Step 4: Run modal tests and verify RED**

Run from `lefarma.frontend`:

```powershell
npm test -- src/apps/viaticos/components/CalculosViajeModal.test.tsx
```

Expected: FAIL because `Detalle de casetas SCT`, state-specific messages, source labels, and guarded official aggregate do not exist. The four pre-existing calculated timing-summary tests must continue to pass once the new region exists; do not edit their assertions.

- [x] **Step 5: Add focused availability helpers and derivations**

Remove the modal's `casetasDeRuta` import. Replace the existing type import from `costosRuta.types` with:

```typescript
import type {
  CostosRutaCasetaDisponibilidad,
  CostosRutaResponse,
  EstadoCasetasSct,
} from '../types/costosRuta.types';
```

Add outside the component:

```typescript
function disponibilidadDeTramo(
  respuesta: CostosRutaResponse | undefined,
  tramo: TramoViaje | undefined,
): CostosRutaCasetaDisponibilidad | null {
  if (!tramo) return null;
  return respuesta?.resultados[0]?.casetasDisponibilidad?.find(
    (item) => item.deMunicipio === tramo.desde.punto.municipio
      && item.aMunicipio === tramo.hasta.punto.municipio,
  ) ?? null;
}

function mensajeCasetasNoDisponible(estado: EstadoCasetasSct | undefined): string {
  switch (estado) {
    case 'destino_no_soportado':
      return 'La SCT no tiene este origen o destino en su catálogo; no hay desglose oficial disponible.';
    case 'proveedor_no_disponible':
      return 'No fue posible consultar la SCT. Intenta nuevamente.';
    case 'respuesta_invalida':
    default:
      return 'No fue posible interpretar el desglose oficial de casetas.';
  }
}
```

Replace the current `casetasSct` through `totalIdaVuelta` derivation block with:

```typescript
const disponibilidadActual = disponibilidadDeTramo(resultadoActual, tramo);
const casetasSct = (resultadoActual?.resultados[0]?.casetas ?? []).filter(
  (c) =>
    tramo !== undefined
    && c.deMunicipio === tramo.desde.punto.municipio
    && c.aMunicipio === tramo.hasta.punto.municipio,
);
const casetasRuta = disponibilidadActual?.estado === 'disponible'
  ? casetasSct.map((c) => ({
      nombre: c.nombre,
      km: c.km,
      direccion: c.direccion || c.carretera,
      costo: c.tarifa,
    }))
  : [];
const totalCasetasTramo = disponibilidadActual?.estado === 'disponible'
  ? disponibilidadActual.peajeTotal
  : null;
const ofertaCostos = ofertaCalculada(resultadoActual, seleccion[paso] ?? null) ?? null;
const totalIdaVuelta = useMemo(() => {
  if (!tramo?.esRegreso) return null;
  const totales = tramos.map((tramoViaje, indice) => {
    const disponibilidad = disponibilidadDeTramo(resultados[indice], tramoViaje);
    return disponibilidad?.estado === 'disponible' && typeof disponibilidad.peajeTotal === 'number'
      ? disponibilidad.peajeTotal
      : null;
  });
  return totales.every((total): total is number => total !== null)
    ? totales.reduce((suma, total) => suma + total, 0)
    : null;
}, [resultados, tramo?.esRegreso, tramos]);
```

- [x] **Step 6: Replace only the toll presentation block**

Keep every `Resumen calculado del viaje` branch byte-for-byte intact. Replace the current `<div className="space-y-1">` block that begins with `Casetas en la ruta` and ends after the reference-source note with:

```tsx
<section aria-label="Detalle de casetas SCT" className="space-y-2">
  <p className="text-xs font-medium">Casetas en la ruta</p>
  {ofertaCostos?.modo === 'auto'
    && typeof ofertaCostos.combustible === 'number'
    && typeof ofertaCostos.casetasEstimadas === 'number' ? (
      <p className="text-xs text-muted-foreground">
        Estimación de {ofertaCostos.linea}: combustible {mxn(ofertaCostos.combustible)} + casetas estimadas {mxn(ofertaCostos.casetasEstimadas)} = {mxn(ofertaCostos.costoGrupo)}.
        {' '}Fuente de la estimación: {ofertaCostos.fuente}. Ya está incluida en el precio seleccionado.
      </p>
    ) : null}
  {disponibilidadActual?.estado === 'disponible' ? (
    <>
      {casetasRuta.length > 0 ? (
        <table className="w-full max-w-3xl text-left text-xs">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th className="py-1 pr-2 font-medium">Caseta</th>
              <th className="py-1 text-right font-medium">Km</th>
              <th className="py-1 pl-3 font-medium">Dirección</th>
              <th className="py-1 text-right font-medium">Tarifa auto</th>
            </tr>
          </thead>
          <tbody>
            {casetasRuta.map((plaza) => (
              <tr key={`${plaza.nombre}-${plaza.km}`} className="border-b border-border/50 last:border-0">
                <td className="py-1 pr-2">{plaza.nombre}</td>
                <td className="py-1 text-right tabular-nums">{plaza.km}</td>
                <td className="py-1 pl-3 text-muted-foreground">{plaza.direccion}</td>
                <td className="py-1 text-right tabular-nums">{plaza.costo != null ? mxn(plaza.costo) : 's/d'}</td>
              </tr>
            ))}
          </tbody>
          {totalCasetasTramo !== null ? (
            <tfoot>
              <tr className="border-t">
                <td className="py-1 pr-2 font-medium" colSpan={3}>Total casetas del tramo</td>
                <td className="py-1 text-right font-medium tabular-nums">{mxn(totalCasetasTramo)}</td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      ) : (
        <p className="text-xs text-muted-foreground">La SCT no reporta plazas de cobro para este tramo.</p>
      )}
      <p className="text-[11px] text-muted-foreground">
        Fuente oficial: {disponibilidadActual.fuente}. Referencia: {disponibilidadActual.kmTotal?.toLocaleString('es-MX', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} km · {disponibilidadActual.tiempoTotal}. No se suma al precio seleccionado.
      </p>
    </>
  ) : (
    <p className="text-xs text-muted-foreground">{mensajeCasetasNoDisponible(disponibilidadActual?.estado)}</p>
  )}
  {tramo.esRegreso && totalIdaVuelta !== null ? (
    <p className="text-xs font-medium">
      Total oficial SCT de ida y vuelta: {mxn(totalIdaVuelta)}. Incluye solo tramos con resultado oficial.
    </p>
  ) : null}
  {tramo.esRegreso && totalIdaVuelta === null ? (
    <p className="text-xs text-muted-foreground">
      No hay un total oficial de ida y vuelta: falta detalle oficial en al menos un tramo.
    </p>
  ) : null}
</section>
```

- [x] **Step 7: Run modal and service tests and verify GREEN**

Run from `lefarma.frontend`:

```powershell
npm test -- src/apps/viaticos/components/CalculosViajeModal.test.tsx src/apps/viaticos/services/calculoViaje.propuesta.test.ts
```

Expected: PASS. All existing timing-summary scenarios retain their exact text and responsive classes; every SCT state has the required message; incomplete official detail never yields a complete round-trip total.

### Task 9: Add browser-mocked visual verification

**Files:**
- Create: `lefarma.frontend/tests/viaticos-casetas.spec.ts`

- [x] **Step 1: Create the browser-mocked visual scenario**

The test uses the real Vite app and React components, but intercepts every API call to either the repository's original backend host or the user's current uncommitted host. It never requires a running backend or calls SCT/OSRM.

```typescript
import { expect, test } from '@playwright/test';

const bandejaItem = {
  id_solicitud: 5,
  folio: 'VIA-E2E-0005',
  id_usuario_solicitante: 9,
  nombre_solicitante: 'Persona E2E',
  periodo: '2026-11',
  gerencia: 'Operaciones',
  destino: 'Zapopan',
  origen: 'Guadalajara',
  estado: 'enviada',
  autobus: null,
  avion: null,
  gasolina: 900,
  casetas: 120,
  vehiculo_propio: null,
  hospedaje: null,
  comida: null,
  taxi: null,
  total: 900,
  fecha_creacion: '2026-11-05T10:00:00',
  fecha_modificacion: '2026-11-05T10:00:00',
  recalculada: true,
};

const detalle = {
  id_solicitud: 5,
  id_usuario_solicitante: 9,
  periodo: '2026-11',
  gerencia: 'Operaciones',
  estado: 'enviada',
  activo: true,
  fecha_creacion: '2026-11-05T10:00:00',
  fecha_modificacion: '2026-11-05T10:00:00',
  datos: {
    version: 'solicitud-v2',
    persona: { modo: 'mia', nombre: 'Persona E2E', motivo: 'Visual verification' },
    transporte: { modo: 'propio', compartir: false, acompanantes: [] },
    origen: {
      punto: {
        nombre: 'Guadalajara',
        latitud: 20.67,
        longitud: -103.34,
        municipio: 'Guadalajara',
        estado: 'Jalisco',
      },
      fechaSalida: '2026-11-10',
      horaSalida: '08:00',
    },
    destinos: [
      {
        punto: {
          nombre: 'Zapopan',
          latitud: 20.72,
          longitud: -103.39,
          municipio: 'Zapopan',
          estado: 'Jalisco',
        },
        debeEstarFecha: '2026-11-10',
        debeEstarHora: '14:00',
        saleFecha: '2026-11-10',
        saleHora: '18:00',
      },
    ],
    retorno: { destino: 'origen' },
    calculo: {
      generado_en: '2026-11-05T10:00:00Z',
      margen: 0.1,
      modo_transporte: 'propio',
      km_total: 120,
      horas_total: '2h 12m',
      tramos: [
        {
          de: 'Guadalajara, Jalisco',
          a: 'Zapopan, Jalisco',
          km: 120,
          duracion: '2h 00m',
          duracion_con_margen: '2h 12m',
          salida_fecha: '2026-11-10',
          salida_hora: '08:00',
          llegada_fecha: '2026-11-10',
          llegada_hora: '10:12',
          alcanza: true,
          casetas: [],
          costo: 900,
          moneda: 'MXN',
          url_compra: null,
          linea: 'Auto propio',
        },
      ],
    },
  },
  opciones: [],
  eventos: [],
};

function motorResponse(disponible: boolean, regreso = false) {
  return {
    resultados: [
      {
        nombre: 'Persona E2E',
        gasolina: 'magna',
        propuesta: { razones: [], lugares: [] },
        tramos: [
          {
            from: 'Guadalajara',
            to: 'Zapopan',
            km: 120,
            opciones: [
              {
                id: 'auto-e2e',
                modo: 'auto',
                linea: 'Auto propio',
                servicio: '120 km carretera',
                persona: 'Persona E2E',
                tramo: 1,
                de: 'Guadalajara',
                a: 'Zapopan',
                salida: '2026-11-10T08:00',
                llegada: '2026-11-10T10:00',
                salidaTxt: '10/11 08:00',
                llegadaTxt: '10/11 10:00',
                duracion: '2h 00m',
                puertaAPuertaH: 2,
                minutosAntes: 0,
                minutosDespues: 0,
                minutosTaxi: 0,
                minutosTaxiOrigen: null,
                minutosTaxiDestino: null,
                terminalOrigen: null,
                terminalDestino: null,
                precioTxt: '$900 MXN total',
                porPersona: false,
                precioDesde: 900,
                precioHasta: 900,
                costoGrupo: 900,
                costoPorPersona: 900,
                aTiempo: true,
                llegaTarde: false,
                minutosTarde: 0,
                noTomable: false,
                badge: '',
                nota: '',
                fuente: 'OSRM + CNE (browser fixture)',
                estimado: false,
                combustible: 780,
                casetasEstimadas: 120,
                comprar: { url: '', sitio: '', accion: '', objetivo: '', fecha: '2026-11-10' },
              },
            ],
          },
        ],
        rutaArmada: {
          tramos: [],
          totales: { km: 120, litros: 10, casetas: 120, subtotalMagna: 900, subtotalPremium: 1000 },
        },
        hotelesPropuestos: [],
        incumplimientos: [],
        casetas: disponible
          ? [
              {
                tramo: 1,
                deMunicipio: 'Guadalajara',
                aMunicipio: 'Zapopan',
                nombre: 'Ojo de Agua',
                carretera: 'México - Pachuca',
                km: 63.4,
                tarifa: 72,
                direccion: 'México - Pachuca',
                fuente: 'SCT · Rutas Punto a Punto',
              },
            ]
          : [],
        casetasDisponibilidad: [
          {
            tramo: 1,
            deMunicipio: regreso ? 'Zapopan' : 'Guadalajara',
            aMunicipio: regreso ? 'Guadalajara' : 'Zapopan',
            estado: disponible ? 'disponible' : 'proveedor_no_disponible',
            kmTotal: disponible ? 97.35 : null,
            tiempoTotal: disponible ? '01:15' : null,
            peajeTotal: disponible ? 72 : null,
            fuente: disponible ? 'SCT · Rutas Punto a Punto' : '',
          },
        ],
      },
    ],
    propuestas: [],
    categorias: {},
    recomendaciones: [],
    compartidos: [],
  };
}

test.use({ viewport: { width: 1280, height: 900 } });

test('shows official reference, included estimate, preserved timing, and incomplete round-trip state', async ({ page }) => {
  let calculationCalls = 0;
  await page.addInitScript(() => {
    localStorage.setItem('accessToken', 'e2e-fake-token');
    localStorage.setItem('user', JSON.stringify({
      id: 1,
      username: 'e2e',
      nombre: 'Persona E2E',
      correo: 'e2e@example.test',
      dominio: 'DC',
      roles: [],
      permisos: [
        {
          idPermiso: 1,
          codigoPermiso: 'viaticos.autorizar',
          nombrePermiso: 'Autorizar viáticos',
          categoria: 'Viaticos',
          recurso: 'viaticos',
          accion: 'autorizar',
        },
        {
          idPermiso: 2,
          codigoPermiso: 'viaticos.ver_todos',
          nombrePermiso: 'Ver todos los viáticos',
          categoria: 'Viaticos',
          recurso: 'viaticos',
          accion: 'ver_todos',
        },
      ],
    }));
  });

  await page.route(/^https?:\/\/localhost:(?:5174|7034)\/api\//, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const fulfill = (data: unknown) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, message: '', data }),
    });

    if (path === '/api/profile') {
      await fulfill({ permissions: ['viaticos.autorizar', 'viaticos.ver_todos'], detalle: {} });
      return;
    }
    if (path === '/api/viaticos/solicitudes' && request.method() === 'GET') {
      await fulfill([bandejaItem]);
      return;
    }
    if (path === '/api/viaticos/solicitudes/5' && request.method() === 'GET') {
      await fulfill(detalle);
      return;
    }
    if (path === '/api/viaticos/costos-ruta/calcular' && request.method() === 'POST') {
      calculationCalls += 1;
      await fulfill(motorResponse(calculationCalls === 1, calculationCalls === 2));
      return;
    }
    await fulfill([]);
  });

  await page.goto('/viaticos/concentrado', { waitUntil: 'domcontentloaded' });
  const row = page.getByTestId('concentrado-5');
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: /Ver detalle/i }).click();
  await expect(page.getByTestId('revision-solicitud')).toBeVisible();
  await page.getByRole('button', { name: 'Recalcular ruta' }).click();

  const dialog = page.getByRole('dialog', { name: /Cálculos del viaje/ });
  const detailRegion = dialog.getByRole('region', { name: 'Detalle de casetas SCT' });
  await expect(detailRegion).toBeVisible();
  await expect(detailRegion).toContainText('Ojo de Agua');
  await expect(detailRegion).toContainText('Referencia: 97.350 km · 01:15');
  await expect(detailRegion).toContainText('No se suma al precio seleccionado.');
  await expect(detailRegion).toContainText('combustible $780 + casetas estimadas $120 = $900');
  await expect(dialog.getByRole('region', { name: 'Resumen calculado del viaje' }))
    .toContainText('Duración ajustada: 2h 12m · Incluye 10% de margen.');
  await page.screenshot({ path: 'test-results/viaticos-casetas-oficial.png', fullPage: true });
  await page.setViewportSize({ width: 360, height: 900 });
  await expect(dialog.getByRole('region', { name: 'Resumen calculado del viaje' })).toBeVisible();
  await page.screenshot({ path: 'test-results/viaticos-casetas-oficial-360.png', fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });

  await dialog.getByRole('button', { name: 'Siguiente' }).click();
  await expect(detailRegion).toContainText('No fue posible consultar la SCT. Intenta nuevamente.');
  await expect(detailRegion).toContainText('No hay un total oficial de ida y vuelta');
  await expect(page.getByText(/Total oficial SCT de ida y vuelta:/)).toHaveCount(0);
  await expect(dialog.getByRole('region', { name: 'Resumen calculado del viaje' }))
    .toContainText('Llegada estimada al origen');
  await page.screenshot({ path: 'test-results/viaticos-casetas-incompleto.png', fullPage: true });
  expect(calculationCalls).toBe(2);
});
```

- [x] **Step 2: Run the browser test and inspect both screenshots**

Run from `lefarma.frontend`:

```powershell
npx playwright test tests/viaticos-casetas.spec.ts --config=playwright.e2e.config.ts
```

Expected: one Chromium test passes, exactly two calculation calls are intercepted, and `test-results/viaticos-casetas-oficial.png`, `test-results/viaticos-casetas-oficial-360.png`, plus `test-results/viaticos-casetas-incompleto.png` are written. Visually inspect at 1280 px and 360 px: official and estimated sources are distinct, no incomplete aggregate appears, and the previously approved timing card stacks without clipping or unreadable truncation. Repeat with `--headed` only when local visual inspection is needed; the assertions and mocks are identical.

### Task 10: Run focused regressions, build/lint, and scoped diff checks

**Files:**
- Verify all files in the File Map; make no unrelated cleanup edits.

- [x] **Step 1: Run the complete backend Viáticos unit-test scope**

Run from `lefarma.backend`:

```powershell
dotnet test tests/Lefarma.UnitTests/Lefarma.UnitTests.csproj --filter "FullyQualifiedName~Features.Viaticos"
```

Expected: PASS for the new parser/availability/cache/component/authorization tests and all existing Viáticos controller, parser, permission, and calculation regressions. No live SCT, OSRM, CNE, or other provider request is allowed; the new tests use `SctFakeHandler` or the existing failing handlers.

- [x] **Step 2: Build the backend solution**

Run from `lefarma.backend`:

```powershell
dotnet build Lefarma.slnx
```

Expected: exit code 0 with no C# errors. Nullable totals and component fields remain intentional; there are no EF migrations or database changes.

- [x] **Step 3: Run the Viáticos frontend regression scope**

Run from `lefarma.frontend`:

```powershell
npm test -- src/apps/viaticos
```

Expected: PASS for the modal, proposal construction/reconciliation, calculation, authorization, print, wizard, and related existing Viáticos suites. In particular, the existing authorization proposal still returns selected prices and the four current timing-summary tests remain green.

- [x] **Step 4: Verify TypeScript, the production bundle, and lint for changed files**

Run from `lefarma.frontend`:

```powershell
npm run build
& ".\node_modules\.bin\eslint.cmd" "src/apps/viaticos/types/costosRuta.types.ts" "src/apps/viaticos/types/solicitud.types.ts" "src/apps/viaticos/services/calculoViaje.ts" "src/apps/viaticos/services/calculoViaje.propuesta.test.ts" "src/apps/viaticos/components/CalculosViajeModal.tsx" "src/apps/viaticos/components/CalculosViajeModal.test.tsx" "tests/viaticos-casetas.spec.ts" --max-warnings 0
```

Expected: both commands exit 0. No type errors, unused imports, hook dependency warnings, Tailwind-related build failures, or lint findings in changed files remain. The repository-wide `npm run lint` already has 233 findings outside this scope; record those separately if rerun and do not require unrelated cleanup in this plan.

- [x] **Step 5: Check whitespace and the scoped change set without reverting user work**

Run from `C:\Repos\01-lefarma-project`:

```powershell
git diff --check
git status --short
git diff --stat
git diff -U0 -- lefarma.frontend/src/apps/viaticos/components/CalculosViajeModal.tsx
git diff -- lefarma.frontend/.env lefarma.frontend/.env.development lefarma.frontend/package-lock.json
```

Expected: `git diff --check` prints nothing. The status includes the pre-existing modal/test, environment, and lockfile changes plus only files listed in this plan. The modal diff still contains the pre-existing timing-summary hunks; new hunks are limited to imports, toll derivations, toll presentation, and the preview-summary call. Environment and lockfile diffs are exactly the baseline recorded in Task 0, not newly rewritten content. Do not restore, stage, commit, or publish any file as part of this plan.

- [x] **Step 6: Perform the final ADR acceptance review**

Verify each statement against code and test evidence:

- The recorded fixture asserts 97.350 km, `01:15`, Ojo de Agua at 63.4 km, and 72 MXN; zero-plaza success and malformed/localized numbers are distinct.
- Every calculated own-car leg has exactly one of `disponible`, `destino_no_soportado`, `proveedor_no_disponible`, or `respuesta_invalida`; only `disponible` is cached.
- New auto options retain their selected price and persist `combustible`, `casetas_estimadas`, and `source` inside existing `datos`.
- New auto 300 = 180 + 120 yields preview and authorization totals of 300 before food and 650 with existing food 350; reference SCT 72 never changes either result.
- Rental and legacy auto selections retain combined amounts; mixed selections count each selected price once; invalid component metadata falls back safely.
- Official round-trip aggregation requires every included leg to be `disponible`; unavailable/malformed results never display as official zero.
- Existing OSRM distance/time, fuel rates, 10% margin, timing-summary presentation, historical snapshots, and database schema remain unchanged.

## Implementation handoff

Execute tasks in order. Stop at any RED result whose cause differs from the stated expectation, and do not proceed with a later task until the current focused scope is GREEN. No commit, staging, deployment, version bump, live provider validation, or historical-data rewrite is included in this plan.

