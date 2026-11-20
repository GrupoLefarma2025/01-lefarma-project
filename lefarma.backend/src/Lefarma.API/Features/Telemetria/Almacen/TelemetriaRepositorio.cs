using System.Buffers.Binary;
using Lefarma.API.Domain.Entities.Telemetria;
using Lefarma.API.Features.Telemetria.Modelo;
using Lefarma.API.Infrastructure.Data;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Features.Telemetria.Almacen;

/// <summary>
/// Único punto de escritura y de mantenimiento del almacén de telemetría.
/// Escribe por lotes en SQL Server (esquema `telemetria`) y nunca lanza hacia el
/// llamador: quien escribe es un proceso de fondo.
/// </summary>
public class TelemetriaRepositorio(
    ApplicationDbContext contexto,
    ILogger<TelemetriaRepositorio> log)
{
    public const string ClaveSalUsuario = "sal_usuario";

    public Task<bool> ExisteLoteAsync(string loteId, CancellationToken cancellationToken) =>
        contexto.TelemetriaLotesProcesados
            .AsNoTracking()
            .AnyAsync(l => l.LoteId == loteId, cancellationToken);

    /// <summary>
    /// Guarda un lote completo en una transacción. Devuelve cuántos eventos
    /// entraron. Si el lote ya estaba registrado, devuelve 0 sin duplicar.
    /// </summary>
    public async Task<int> GuardarLoteAsync(LoteTelemetria lote, CancellationToken cancellationToken)
    {
        await using var transaccion = await contexto.Database.BeginTransactionAsync(cancellationToken);

        contexto.TelemetriaLotesProcesados.Add(new LoteTelemetriaProcesado
        {
            LoteId = lote.LoteId,
            RecibidoEn = lote.RecibidoEn
        });

        var insertados = 0;
        foreach (var evento in lote.Eventos)
        {
            switch (evento)
            {
                case EventoError error:
                    contexto.TelemetriaErrores.Add(AMapearError(error, lote));
                    break;
                case EventoClic clic:
                    contexto.TelemetriaClics.Add(AMapearClic(clic, lote));
                    break;
                case EventoMapaCalor mapa:
                    contexto.TelemetriaMapasCalor.Add(AMapearMapa(mapa, lote));
                    break;
                case EventoVisita visita:
                    contexto.TelemetriaVisitas.Add(AMapearVisita(visita, lote));
                    break;
                default:
                    continue;
            }

            insertados++;
        }

        if (insertados > 0)
            await contexto.SaveChangesAsync(cancellationToken);

        // El lote también se registra cuando viene vacío o solo con tipos desconocidos.
        await contexto.SaveChangesAsync(cancellationToken);
        await transaccion.CommitAsync(cancellationToken);

        return insertados;
    }

    /// <summary>Sal con la que se calcula la huella del usuario; se crea una vez.</summary>
    public async Task<string> ObtenerOCrearSalAsync(CancellationToken cancellationToken)
    {
        var actual = await contexto.TelemetriaParametros
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Clave == ClaveSalUsuario, cancellationToken);

        if (actual is not null)
            return actual.Valor;

        var nueva = Convert.ToBase64String(System.Security.Cryptography.RandomNumberGenerator.GetBytes(32));
        contexto.TelemetriaParametros.Add(new ParametroTelemetria
        {
            Clave = ClaveSalUsuario,
            Valor = nueva,
            ActualizadoEn = DateTime.UtcNow
        });

        try
        {
            await contexto.SaveChangesAsync(cancellationToken);
            return nueva;
        }
        catch (DbUpdateException)
        {
            // Otra petición la creó al mismo tiempo: se lee la que ganó.
            contexto.ChangeTracker.Clear();
            var ganadora = await contexto.TelemetriaParametros
                .AsNoTracking()
                .FirstAsync(p => p.Clave == ClaveSalUsuario, cancellationToken);
            return ganadora.Valor;
        }
    }

    public async Task<EstadoAlmacen> ObtenerEstadoAsync(bool habilitada, CancellationToken cancellationToken)
    {
        var conexion = contexto.Database.GetDbConnection();
        var destino = $"{conexion.DataSource} · {conexion.Database}";

        try
        {
            if (!await contexto.Database.CanConnectAsync(cancellationToken))
                return new EstadoAlmacen(habilitada, false, destino, "No se pudo abrir la conexión.", new Dictionary<string, long>());
        }
        catch (Exception ex)
        {
            return new EstadoAlmacen(habilitada, false, destino, ex.Message, new Dictionary<string, long>());
        }

        Dictionary<string, long> tablas;
        try
        {
            tablas = new Dictionary<string, long>
            {
                ["evento_error"] = await contexto.TelemetriaErrores.LongCountAsync(cancellationToken),
                ["evento_clic"] = await contexto.TelemetriaClics.LongCountAsync(cancellationToken),
                ["mapa_calor"] = await contexto.TelemetriaMapasCalor.LongCountAsync(cancellationToken),
                ["visita"] = await contexto.TelemetriaVisitas.LongCountAsync(cancellationToken),
                ["lote_procesado"] = await contexto.TelemetriaLotesProcesados.LongCountAsync(cancellationToken)
            };
        }
        catch (Exception ex)
        {
            // Lo más probable: todavía no se ejecutó el script del esquema. No se
            // tumba el API: el módulo se reporta como no disponible con el motivo.
            log.LogWarning(ex, "El esquema de telemetría no está listo en la base de datos.");
            var motivo = ex is SqlException { Number: 208 }
                ? "Falta aplicar el script del esquema de telemetría (esquema 'telemetria')."
                : ex.Message;
            return new EstadoAlmacen(habilitada, false, destino, motivo, new Dictionary<string, long>());
        }

        return new EstadoAlmacen(habilitada, true, destino, null, tablas);
    }

    /// <summary>Borra lo que excedió su retención. Devuelve las filas eliminadas por tabla.</summary>
    public async Task<Dictionary<string, int>> LimpiarAntiguosAsync(
        int diasErrores,
        int diasClics,
        int diasMapaCalor,
        int diasVisitas,
        CancellationToken cancellationToken)
    {
        var eliminados = new Dictionary<string, int>();
        var ahora = DateTime.UtcNow;

        eliminados["evento_error"] = await BorrarAsync(contexto.TelemetriaErrores.Where(e => e.RecibidoEn < ahora.AddDays(-diasErrores)), cancellationToken);
        eliminados["evento_clic"] = await BorrarAsync(contexto.TelemetriaClics.Where(e => e.RecibidoEn < ahora.AddDays(-diasClics)), cancellationToken);
        eliminados["mapa_calor"] = await BorrarAsync(contexto.TelemetriaMapasCalor.Where(e => e.RecibidoEn < ahora.AddDays(-diasMapaCalor)), cancellationToken);
        eliminados["visita"] = await BorrarAsync(contexto.TelemetriaVisitas.Where(e => e.RecibidoEn < ahora.AddDays(-diasVisitas)), cancellationToken);

        return eliminados;

        async Task<int> BorrarAsync<T>(IQueryable<T> consulta, CancellationToken ct) where T : class
        {
            try
            {
                return await consulta.ExecuteDeleteAsync(ct);
            }
            catch (Exception ex)
            {
                log.LogWarning(ex, "No se pudo limpiar la tabla de telemetría {Tabla}.", typeof(T).Name);
                return 0;
            }
        }
    }

    private static EventoErrorTelemetria AMapearError(EventoError error, LoteTelemetria lote) => new()
    {
        RecibidoEn = lote.RecibidoEn,
        OcurridoEn = error.OcurridoEn,
        LoteId = lote.LoteId,
        VisitaId = lote.VisitaId,
        Huella = error.Huella,
        TipoError = error.TipoError,
        Mensaje = error.Mensaje,
        Stack = error.Stack,
        Url = error.Url,
        Ruta = error.Ruta,
        MetodoHttp = error.MetodoHttp,
        EstadoHttp = (short?)error.EstadoHttp,
        RequestId = error.RequestId,
        Navegador = error.Navegador,
        VersionApp = lote.VersionApp,
        UsuarioHash = lote.Peticion.UsuarioHash,
        Rol = lote.Peticion.Rol,
        Contexto = error.Contexto,
        Entorno = lote.Peticion.Entorno,
        Servidor = lote.Peticion.Servidor
    };

    private static EventoClicTelemetria AMapearClic(EventoClic clic, LoteTelemetria lote) => new()
    {
        RecibidoEn = lote.RecibidoEn,
        OcurridoEn = clic.OcurridoEn,
        LoteId = lote.LoteId,
        VisitaId = lote.VisitaId,
        Ruta = clic.Ruta,
        Elemento = clic.Elemento,
        Etiqueta = clic.Etiqueta,
        TipoElemento = clic.TipoElemento,
        X = clic.X,
        Y = clic.Y,
        ViewportAncho = (short?)clic.ViewportAncho,
        ViewportAlto = (short?)clic.ViewportAlto,
        VersionApp = lote.VersionApp,
        UsuarioHash = lote.Peticion.UsuarioHash,
        Rol = lote.Peticion.Rol,
        Entorno = lote.Peticion.Entorno,
        Servidor = lote.Peticion.Servidor
    };

    private static MapaCalorTelemetria AMapearMapa(EventoMapaCalor mapa, LoteTelemetria lote) => new()
    {
        RecibidoEn = lote.RecibidoEn,
        OcurridoEn = mapa.OcurridoEn,
        LoteId = lote.LoteId,
        VisitaId = lote.VisitaId,
        Ruta = mapa.Ruta,
        Columnas = (short)mapa.Columnas,
        Filas = (short)mapa.Filas,
        TamanoCelda = (byte)mapa.TamanoCelda,
        Celdas = AABytes(mapa.Celdas),
        Movimientos = mapa.Celdas.Sum(),
        ScrollMax = mapa.ScrollMax,
        SegundosVisibles = mapa.SegundosVisibles,
        ViewportAncho = (short?)mapa.ViewportAncho,
        ViewportAlto = (short?)mapa.ViewportAlto,
        VersionApp = lote.VersionApp,
        UsuarioHash = lote.Peticion.UsuarioHash,
        Rol = lote.Peticion.Rol,
        Entorno = lote.Peticion.Entorno,
        Servidor = lote.Peticion.Servidor
    };

    private static VisitaTelemetria AMapearVisita(EventoVisita visita, LoteTelemetria lote) => new()
    {
        RecibidoEn = lote.RecibidoEn,
        LoteId = lote.LoteId,
        VisitaId = lote.VisitaId,
        RutaEntrada = visita.RutaEntrada,
        Inicio = visita.Inicio,
        Fin = visita.Fin,
        Segundos = visita.Segundos,
        ScrollMax = visita.ScrollMax,
        Navegador = visita.Navegador,
        Sistema = visita.Sistema,
        ViewportAncho = (short?)visita.ViewportAncho,
        ViewportAlto = (short?)visita.ViewportAlto,
        VersionApp = lote.VersionApp,
        UsuarioHash = lote.Peticion.UsuarioHash,
        Rol = lote.Peticion.Rol,
        Entorno = lote.Peticion.Entorno,
        Servidor = lote.Peticion.Servidor
    };

    internal static byte[] AABytes(int[] celdas)
    {
        var bytes = new byte[celdas.Length * sizeof(int)];
        for (var i = 0; i < celdas.Length; i++)
            BinaryPrimitives.WriteInt32LittleEndian(bytes.AsSpan(i * sizeof(int), sizeof(int)), celdas[i]);

        return bytes;
    }

    internal static int[] AEnteros(byte[] bytes)
    {
        var celdas = new int[bytes.Length / sizeof(int)];
        for (var i = 0; i < celdas.Length; i++)
            celdas[i] = BinaryPrimitives.ReadInt32LittleEndian(bytes.AsSpan(i * sizeof(int), sizeof(int)));

        return celdas;
    }
}
