using System.Data;
using System.Reflection;
using Dapper;
using Microsoft.Data.SqlClient;

namespace Lefarma.API.Features.Sigma;

/// <summary>
/// Acceso Dapper a la base legacy Asokam (módulo Documentos, puerto de SIGMA).
/// Los procedimientos viven en el esquema <c>app</c>; también admite SQL directo.
/// </summary>
public sealed class SigmaDb
{
    private readonly string _connectionString;

    public SigmaDb(IConfiguration configuration)
    {
        _connectionString = configuration.GetConnectionString("AsokamConnection")
            ?? throw new InvalidOperationException("Falta la cadena de conexión 'AsokamConnection'.");
    }

    /// <summary>Ejecuta una consulta (SP por defecto) y devuelve todas las filas mapeadas.</summary>
    public async Task<IReadOnlyList<T>> QueryAsync<T>(
        string sql,
        object? parametros = null,
        CommandType tipoComando = CommandType.StoredProcedure,
        CancellationToken ct = default)
    {
        await using var conexion = await AbrirConexionAsync(ct);
        var filas = await conexion.QueryAsync<T>(new CommandDefinition(sql, parametros, commandType: tipoComando, cancellationToken: ct));
        return filas.AsList();
    }

    /// <summary>Ejecuta una consulta (SP por defecto) y devuelve la primera fila o null.</summary>
    public async Task<T?> QueryFirstOrDefaultAsync<T>(
        string sql,
        object? parametros = null,
        CommandType tipoComando = CommandType.StoredProcedure,
        CancellationToken ct = default)
    {
        await using var conexion = await AbrirConexionAsync(ct);
        return await conexion.QueryFirstOrDefaultAsync<T>(new CommandDefinition(sql, parametros, commandType: tipoComando, cancellationToken: ct));
    }

    /// <summary>Ejecuta una sentencia y devuelve las filas afectadas.</summary>
    public async Task<int> ExecuteAsync(
        string sql,
        object? parametros = null,
        CommandType tipoComando = CommandType.StoredProcedure,
        CancellationToken ct = default)
    {
        await using var conexion = await AbrirConexionAsync(ct);
        return await conexion.ExecuteAsync(new CommandDefinition(sql, parametros, commandType: tipoComando, cancellationToken: ct));
    }

    /// <summary>Ejecuta una sentencia y devuelve el primer valor escalar.</summary>
    public async Task<T?> ExecuteScalarAsync<T>(
        string sql,
        object? parametros = null,
        CommandType tipoComando = CommandType.StoredProcedure,
        CancellationToken ct = default)
    {
        await using var conexion = await AbrirConexionAsync(ct);
        return await conexion.ExecuteScalarAsync<T>(new CommandDefinition(sql, parametros, commandType: tipoComando, cancellationToken: ct));
    }

    /// <summary>
    /// Ejecuta un SP que devuelve dos result sets (sp_ObtenerFlujoDocumento) y los mapea.
    /// Se lee con SqlDataReader para tolerar SPs que solo devuelven el primero (RAISERROR/RETURN).
    /// </summary>
    public async Task<(IReadOnlyList<TFirst> Primero, IReadOnlyList<TSecond> Segundo)> QueryMultipleAsync<TFirst, TSecond>(
        string procedimiento,
        object? parametros = null,
        CommandType tipoComando = CommandType.StoredProcedure,
        CancellationToken ct = default)
    {
        await using var conexion = await AbrirConexionAsync(ct);
        await using var comando = (SqlCommand)conexion.CreateCommand();
        comando.CommandText = procedimiento;
        comando.CommandType = tipoComando;

        if (parametros is not null)
        {
            foreach (var propiedad in parametros.GetType().GetProperties(BindingFlags.Public | BindingFlags.Instance))
            {
                comando.Parameters.AddWithValue("@" + propiedad.Name, propiedad.GetValue(parametros) ?? DBNull.Value);
            }
        }

        await using var lector = await comando.ExecuteReaderAsync(ct);

        var primero = new List<TFirst>();
        var parserPrimero = lector.GetRowParser<TFirst>();
        while (await lector.ReadAsync(ct))
        {
            primero.Add(parserPrimero(lector));
        }

        var segundo = new List<TSecond>();
        if (await lector.NextResultAsync(ct))
        {
            var parserSegundo = lector.GetRowParser<TSecond>();
            while (await lector.ReadAsync(ct))
            {
                segundo.Add(parserSegundo(lector));
            }
        }

        return (primero, segundo);
    }

    private async Task<SqlConnection> AbrirConexionAsync(CancellationToken ct)
    {
        var conexion = new SqlConnection(_connectionString);
        await conexion.OpenAsync(ct);
        return conexion;
    }
}
