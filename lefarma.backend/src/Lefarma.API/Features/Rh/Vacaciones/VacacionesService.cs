using System.Globalization;
using CsvHelper;
using CsvHelper.Configuration;
using ErrorOr;
using Lefarma.API.Domain.Entities.Catalogos;
using Lefarma.API.Domain.Entities.Rh;
using Lefarma.API.Features.Rh.Vacaciones.DTOs;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Shared.Errors;
using Lefarma.API.Shared.Logging;
using Lefarma.API.Shared.Services;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Features.Rh.Vacaciones
{
    public class VacacionesService : BaseService, IVacacionesService
    {
        private readonly ApplicationDbContext _context;
        private readonly AsistenciasDbContext _asistenciasContext;
        private readonly AsokamDbContext _asokamContext;

        public VacacionesService(ApplicationDbContext context, AsistenciasDbContext asistenciasContext, AsokamDbContext asokamContext, IWideEventAccessor wideEventAccessor)
            : base(wideEventAccessor)
        {
            _context = context;
            _asistenciasContext = asistenciasContext;
            _asokamContext = asokamContext;
        }

        protected override string EntityName => "DiasNoHabiles";

        public async Task<ErrorOr<List<DiaNoHabilResponse>>> ObtenerDiasNoHabilesAsync(DiaNoHabilRequest request)
        {
            try
            {
                var query = from d in _context.DiasNoHabiles.AsNoTracking().Where(d => d.Activo)
                              join e in _context.Empresas.AsNoTracking() on d.IdEmpresa equals e.IdEmpresa
                              join s in _context.Sucursales.AsNoTracking() on d.IdSucursal equals s.IdSucursal into sg
                              from s in sg.DefaultIfEmpty()
                              select new DiaNoHabilResponse
                              {
                                  IdDiaNoHabil = d.IdDiaNoHabil,
                                  IdEmpresa = d.IdEmpresa,
                                  EmpresaNombre = e.Nombre,
                                  IdSucursal = d.IdSucursal,
                                  SucursalNombre = s != null ? s.Nombre : null,
                                  Anio = d.Anio,
                                  Mes = d.Mes,
                                  Dia = d.Dia,
                                  Fecha = d.Fecha,
                                  Descripcion = d.Descripcion,
                                  Activo = d.Activo
                              };

                if (request.IdEmpresa.HasValue)
                    query = query.Where(d => d.IdEmpresa == request.IdEmpresa.Value);

                if (request.IdSucursal.HasValue)
                    query = query.Where(d => d.IdSucursal == request.IdSucursal.Value);

                if (request.Anio.HasValue)
                    query = query.Where(d => d.Anio == request.Anio.Value);

                if (request.Mes.HasValue)
                    query = query.Where(d => d.Mes == request.Mes.Value);

                var result = await query
                    .OrderBy(d => d.Fecha)
                    .ToListAsync();

                return result;
            }
            catch (Exception ex)
            {
                EnrichWideEvent("ObtenerDiasNoHabiles", exception: ex);
                return CommonErrors.InternalServerError("Error al obtener días no hábiles");
            }
        }

        public async Task<ErrorOr<CargaDiasNoHabilesResultResponse>> CargarDiasNoHabilesManualAsync(CargaDiasNoHabilesRequest request, int idUsuario)
        {
            try
            {
                var fechas = request.Fechas.Select(f => (
                    Fecha: new DateTime(f.Anio, f.Mes, f.Dia),
                    Descripcion: f.Descripcion ?? request.DescripcionGeneral
                )).ToList();
                return await CargarDiasNoHabilesInternoAsync(request.IdEmpresa, request.IdSucursal, fechas, idUsuario);
            }
            catch (Exception ex)
            {
                EnrichWideEvent("CargarDiasNoHabilesManual", exception: ex);
                return CommonErrors.InternalServerError("Error al cargar días no hábiles");
            }
        }

        public async Task<ErrorOr<CargaDiasNoHabilesResultResponse>> CargarDiasNoHabilesDesdeCsvAsync(IFormFile file, int idEmpresa, int? idSucursal, int idUsuario)
        {
            try
            {
                if (file == null || file.Length == 0)
                    return CommonErrors.Validation("file", "El archivo CSV es requerido");

                if (!file.FileName.EndsWith(".csv", StringComparison.OrdinalIgnoreCase))
                    return CommonErrors.Validation("file", "El archivo debe tener extensión .csv");

                var csvConfig = new CsvConfiguration(CultureInfo.InvariantCulture)
                {
                    HasHeaderRecord = true,
                    HeaderValidated = null,
                    MissingFieldFound = null,
                    TrimOptions = TrimOptions.Trim,
                    BadDataFound = null,
                };

                using var reader = new StreamReader(file.OpenReadStream());
                using var csv = new CsvReader(reader, csvConfig);

                var rows = csv.GetRecords<CargaDiasNoHabilesCsvRow>().ToList();
                var fechas = rows.Select(r => (
                    Fecha: new DateTime(r.Anio, r.Mes, r.Dia),
                    Descripcion: (string?)r.Descripcion
                )).ToList();

                return await CargarDiasNoHabilesInternoAsync(idEmpresa, idSucursal, fechas, idUsuario);
            }
            catch (Exception ex)
            {
                EnrichWideEvent("CargarDiasNoHabilesCsv", exception: ex);
                return CommonErrors.InternalServerError("Error al procesar el archivo CSV");
            }
        }

        private async Task<ErrorOr<CargaDiasNoHabilesResultResponse>> CargarDiasNoHabilesInternoAsync(
            int idEmpresa, int? idSucursal, List<(DateTime Fecha, string? Descripcion)> fechas, int idUsuario)
        {
            var result = new CargaDiasNoHabilesResultResponse
            {
                TotalRows = fechas.Count,
                SuccessCount = 0,
                ErrorCount = 0,
                Errors = new List<BulkUploadRowError>()
            };

            var empresa = await _context.Empresas.AsNoTracking().FirstOrDefaultAsync(e => e.IdEmpresa == idEmpresa);
            if (empresa == null)
                return CommonErrors.NotFound("Empresa", idEmpresa.ToString());

            if (idSucursal.HasValue)
            {
                var sucursal = await _context.Sucursales.AsNoTracking().FirstOrDefaultAsync(s => s.IdSucursal == idSucursal.Value);
                if (sucursal == null)
                    return CommonErrors.NotFound("Sucursal", idSucursal.Value.ToString());
            }

            using var transaction = await _context.Database.BeginTransactionAsync();

            try
            {
                var diasNoHabiles = new List<DiaNoHabil>();
                var rowNumber = 1;

                foreach (var (fecha, descripcion) in fechas)
                {
                    var exists = await _context.DiasNoHabiles
                        .AsNoTracking()
                        .AnyAsync(d => d.IdEmpresa == idEmpresa
                            && d.Fecha == fecha
                            && d.Activo);

                    if (exists)
                    {
                        result.ErrorCount++;
                        result.Errors.Add(new BulkUploadRowError
                        {
                            RowNumber = rowNumber,
                            RowData = $"{fecha.Day}/{fecha.Month}/{fecha.Year}",
                            Error = "El día ya existe para esta empresa."
                        });
                        rowNumber++;
                        continue;
                    }

                    var diaNoHabil = new DiaNoHabil
                    {
                        IdEmpresa = idEmpresa,
                        IdSucursal = idSucursal,
                        Anio = fecha.Year,
                        Mes = fecha.Month,
                        Dia = fecha.Day,
                        Fecha = fecha,
                        Descripcion = descripcion
                    };

                    diasNoHabiles.Add(diaNoHabil);
                    result.SuccessCount++;
                    rowNumber++;
                }

                await _context.DiasNoHabiles.AddRangeAsync(diasNoHabiles);
                await _context.SaveChangesAsync();

                var usuariosQuery = _context.UsuariosDetalle
                    .AsNoTracking()
                    .Where(u => u.IdEmpresa == idEmpresa && u.Activo);

                if (idSucursal.HasValue)
                    usuariosQuery = usuariosQuery.Where(u => u.IdSucursal == idSucursal.Value);

                var tipoFestivo = await _context.TiposDia
                    .AsNoTracking()
                    .FirstOrDefaultAsync(t => t.Activo && t.Clave == "FESTIVO");

                if (tipoFestivo == null)
                    return CommonErrors.NotFound("TipoDia", "FESTIVO");

                var usuarios = await usuariosQuery.Select(u => u.IdUsuario).ToListAsync();

                var diasUsuario = new List<DiaUsuario>();

                foreach (var diaNoHabil in diasNoHabiles)
                {
                    foreach (var idUser in usuarios)
                    {
                        var alreadyExists = await _context.DiasUsuarios
                            .AsNoTracking()
                            .AnyAsync(v => v.IdUsuario == idUser && v.Fecha == diaNoHabil.Fecha && v.Activo);

                        if (alreadyExists) continue;

                        diasUsuario.Add(new DiaUsuario
                        {
                            IdUsuario = idUser,
                            IdEmpresa = idEmpresa,
                            IdSucursal = idSucursal,
                            Anio = diaNoHabil.Anio,
                            Mes = diaNoHabil.Mes,
                            Dia = diaNoHabil.Dia,
                            Fecha = diaNoHabil.Fecha,
                            IdTipoDia = tipoFestivo.IdTipoDia,
                            Origen = "NO_HABIL",
                            ConsumeSaldo = false,
                            Estado = null,
                            IdDiaNoHabil = diaNoHabil.IdDiaNoHabil
                        });
                    }
                }

                await _context.DiasUsuarios.AddRangeAsync(diasUsuario);
                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                result.UsuariosAfectados = usuarios.Count;
                result.VacacionesGeneradas = diasUsuario.Count;

                EnrichWideEvent("CargarDiasNoHabiles", count: result.SuccessCount, additionalContext: new Dictionary<string, object>
                {
                    ["idEmpresa"] = idEmpresa,
                    ["idSucursal"] = idSucursal?.ToString() ?? "null",
                    ["usuariosAfectados"] = result.UsuariosAfectados,
                    ["vacacionesGeneradas"] = result.VacacionesGeneradas
                });

                return result;
            }
            catch (Exception)
            {
                await transaction.RollbackAsync();
                throw;
            }
        }

        public async Task<ErrorOr<Deleted>> EliminarDiaNoHabilAsync(int idDiaNoHabil, int idUsuario)
        {
            try
            {
                var dia = await _context.DiasNoHabiles.FirstOrDefaultAsync(d => d.IdDiaNoHabil == idDiaNoHabil && d.Activo);
                if (dia == null)
                    return CommonErrors.NotFound("DiaNoHabil", idDiaNoHabil.ToString());

                dia.Activo = false;

                var diasUsuario = await _context.DiasUsuarios
                    .Where(v => v.IdDiaNoHabil == idDiaNoHabil && v.Activo)
                    .ToListAsync();

                foreach (var v in diasUsuario)
                    v.Activo = false;

                await _context.SaveChangesAsync();
                return Result.Deleted;
            }
            catch (Exception ex)
            {
                EnrichWideEvent("EliminarDiaNoHabil", exception: ex);
                return CommonErrors.InternalServerError("Error al eliminar día no hábil");
            }
        }

        public async Task<ErrorOr<List<DiaUsuarioResponse>>> ObtenerUsuariosAfectadosAsync(int idDiaNoHabil)
        {
            try
            {
                var result = await _context.DiasUsuarios
                    .AsNoTracking()
                    .Where(v => v.IdDiaNoHabil == idDiaNoHabil && v.Activo)
                    .Select(v => new DiaUsuarioResponse
                    {
                        IdDiaUsuario = v.IdDiaUsuario,
                        IdUsuario = v.IdUsuario,
                        IdEmpresa = v.IdEmpresa,
                        IdSucursal = v.IdSucursal,
                        Fecha = v.Fecha,
                        IdTipoDia = v.IdTipoDia,
                        TipoDiaNombre = v.TipoDia != null ? v.TipoDia.Nombre : null,
                        Origen = v.Origen,
                        Estado = v.Estado,
                        ConsumeSaldo = v.ConsumeSaldo,
                        IdDiaNoHabil = v.IdDiaNoHabil,
                        Comentarios = v.Comentarios
                    })
                    .ToListAsync();

                return result;
            }
            catch (Exception ex)
            {
                EnrichWideEvent("ObtenerUsuariosAfectados", exception: ex);
                return CommonErrors.InternalServerError("Error al obtener vacaciones de usuarios");
            }
        }

        public async Task<ErrorOr<List<DiaUsuarioResponse>>> ObtenerDiasUsuarioAsync(DiaUsuarioRequest request)
        {
            try
            {
                var query = _context.DiasUsuarios
                    .AsNoTracking()
                    .Where(d => d.IdUsuario == request.IdUsuario && d.Activo)
                    .AsQueryable();

                if (request.Anio.HasValue)
                    query = query.Where(d => d.Anio == request.Anio.Value);

                var result = await query
                    .OrderByDescending(d => d.Fecha)
                    .Select(d => new DiaUsuarioResponse
                    {
                        IdDiaUsuario = d.IdDiaUsuario,
                        IdUsuario = d.IdUsuario,
                        IdEmpresa = d.IdEmpresa,
                        IdSucursal = d.IdSucursal,
                        Fecha = d.Fecha,
                        IdTipoDia = d.IdTipoDia,
                        TipoDiaNombre = d.TipoDia != null ? d.TipoDia.Nombre : null,
                        Origen = d.Origen,
                        Estado = d.Estado,
                        ConsumeSaldo = d.ConsumeSaldo,
                        IdDiaNoHabil = d.IdDiaNoHabil,
                        Comentarios = d.Comentarios
                    })
                    .ToListAsync();

                return result;
            }
            catch (Exception ex)
            {
                EnrichWideEvent("ObtenerDiasUsuario", exception: ex);
                return CommonErrors.InternalServerError("Error al obtener días del usuario");
            }
        }

        public async Task<ErrorOr<List<SaldoVacacionesResponse>>> ObtenerSaldosAsync(SaldoVacacionesRequest request)
        {
            try
            {
                var query = _context.SaldosVacacionesAnuales
                    .AsNoTracking()
                    .Where(s => s.Activo)
                    .AsQueryable();

                if (request.IdEmpresa.HasValue)
                    query = query.Where(s => s.IdEmpresa == request.IdEmpresa.Value);

                if (request.IdUsuario.HasValue)
                    query = query.Where(s => s.IdUsuario == request.IdUsuario.Value);

                if (request.Anio.HasValue)
                    query = query.Where(s => s.Anio == request.Anio.Value);

                var saldos = await query
                    .OrderBy(s => s.Anio)
                    .ThenBy(s => s.IdUsuario)
                    .ToListAsync();

                var idsUsuarios = saldos.Select(s => s.IdUsuario).Distinct().ToList();

                var usuarios = await _asokamContext.Usuarios
                    .AsNoTracking()
                    .Where(u => idsUsuarios.Contains(u.IdUsuario))
                    .Select(u => new { u.IdUsuario, u.Correo, u.NombreCompleto })
                    .ToListAsync();

                var usuarioPorId = usuarios
                    .GroupBy(u => u.IdUsuario)
                    .ToDictionary(g => g.Key, g => g.First());

                var correos = usuarios
                    .Select(u => u.Correo)
                    .Where(c => !string.IsNullOrWhiteSpace(c))
                    .Distinct()
                    .ToList();

                var empleados = await _asistenciasContext.VwEmpleados
                    .AsNoTracking()
                    .Where(e => e.Correo != null && correos.Contains(e.Correo))
                    .Select(e => new { e.Correo, e.Nomina })
                    .ToListAsync();

                var nominaPorCorreo = empleados
                    .GroupBy(e => e.Correo, StringComparer.OrdinalIgnoreCase)
                    .ToDictionary(g => g.Key!, g => g.First().Nomina, StringComparer.OrdinalIgnoreCase);

                var result = saldos.Select(s =>
                {
                    usuarioPorId.TryGetValue(s.IdUsuario, out var usuario);
                    long? nomina = null;
                    if (usuario != null && !string.IsNullOrWhiteSpace(usuario.Correo))
                        nominaPorCorreo.TryGetValue(usuario.Correo, out nomina);

                    return new SaldoVacacionesResponse
                    {
                        IdSaldo = s.IdSaldo,
                        IdUsuario = s.IdUsuario,
                        UsuarioNombre = usuario?.NombreCompleto,
                        Nomina = nomina,
                        IdEmpresa = s.IdEmpresa,
                        Anio = s.Anio,
                        DiasGenerados = s.DiasGenerados,
                        DiasVencidos = s.DiasVencidos,
                        DiasCompensados = s.DiasCompensados,
                        DiasAjustados = s.DiasAjustados,
                        DiasTomados = s.DiasTomados,
                        DiasPendientes = s.DiasPendientes,
                        Activo = s.Activo
                    };
                }).ToList();

                return result;
            }
            catch (Exception ex)
            {
                EnrichWideEvent("ObtenerSaldos", exception: ex);
                return CommonErrors.InternalServerError("Error al obtener saldos de vacaciones");
            }
        }

        public async Task<ErrorOr<SaldoVacacionesResponse>> CargarSaldoAsync(SaldoVacacionesCreateRequest request, int idUsuario)
        {
            try
            {
                var usuario = await _context.UsuariosDetalle.AsNoTracking().FirstOrDefaultAsync(u => u.IdUsuario == request.IdUsuario && u.Activo);
                if (usuario == null)
                    return CommonErrors.NotFound("Usuario", request.IdUsuario.ToString());

                var empresa = await _context.Empresas.AsNoTracking().FirstOrDefaultAsync(e => e.IdEmpresa == request.IdEmpresa);
                if (empresa == null)
                    return CommonErrors.NotFound("Empresa", request.IdEmpresa.ToString());

                var existing = await _context.SaldosVacacionesAnuales
                    .FirstOrDefaultAsync(s => s.IdUsuario == request.IdUsuario && s.Anio == request.Anio && s.Activo);

                if (existing != null)
                    return CommonErrors.AlreadyExists("SaldoVacacionesAnual", "usuario/año", $"{request.IdUsuario}/{request.Anio}");

                var correo = await _asokamContext.Usuarios
                    .AsNoTracking()
                    .Where(u => u.IdUsuario == request.IdUsuario)
                    .Select(u => u.Correo)
                    .FirstOrDefaultAsync();

                if (string.IsNullOrWhiteSpace(correo))
                    return CommonErrors.NotFound("CorreoUsuario", request.IdUsuario.ToString());

                var vacacionesPorAntiguedad = await _asistenciasContext.VwEmpleados
                    .AsNoTracking()
                    .Where(e => e.Correo == correo)
                    .Select(e => (decimal?)e.Vacacionesxantiguedad)
                    .FirstOrDefaultAsync();

                if (!vacacionesPorAntiguedad.HasValue)
                    return CommonErrors.NotFound("EmpleadoAsistencias", correo);

                var saldo = new SaldoVacacionesAnual
                {
                    IdUsuario = request.IdUsuario,
                    IdEmpresa = request.IdEmpresa,
                    Anio = request.Anio,
                    DiasGenerados = vacacionesPorAntiguedad.Value,
                    DiasVencidos = request.DiasVencidos,
                    DiasCompensados = request.DiasCompensados,
                    DiasAjustados = request.DiasAjustados,
                    DiasTomados = request.DiasTomados
                };

                _context.SaldosVacacionesAnuales.Add(saldo);
                await _context.SaveChangesAsync();

                return new SaldoVacacionesResponse
                {
                    IdSaldo = saldo.IdSaldo,
                    IdUsuario = saldo.IdUsuario,
                    IdEmpresa = saldo.IdEmpresa,
                    Anio = saldo.Anio,
                    DiasGenerados = saldo.DiasGenerados,
                    DiasVencidos = saldo.DiasVencidos,
                    DiasCompensados = saldo.DiasCompensados,
                    DiasAjustados = saldo.DiasAjustados,
                    DiasTomados = saldo.DiasTomados,
                    DiasPendientes = saldo.DiasPendientes,
                    Activo = saldo.Activo
                };
            }
            catch (Exception ex)
            {
                EnrichWideEvent("CargarSaldo", exception: ex);
                return CommonErrors.InternalServerError("Error al cargar saldo de vacaciones");
            }
        }
        public async Task<ErrorOr<SincronizarSaldosResponse>> SincronizarSaldosAsync(SincronizarSaldosRequest request, int idUsuario)
        {
            try
            {
                var anio = request.Anio ?? DateTime.Now.Year;

                var empleados = await _asistenciasContext.VwEmpleados
                    .AsNoTracking()
                    .ToListAsync();

                var correos = empleados
                    .Select(e => e.Correo)
                    .Where(c => !string.IsNullOrWhiteSpace(c))
                    .Distinct()
                    .ToList();

                var usuarios = await _asokamContext.Usuarios
                    .AsNoTracking()
                    .Where(u => u.Correo != null && correos.Contains(u.Correo))
                    .Select(u => new { u.IdUsuario, u.Correo })
                    .ToListAsync();

                var usuarioPorCorreo = usuarios
                    .GroupBy(u => u.Correo, StringComparer.OrdinalIgnoreCase)
                    .ToDictionary(
                        g => g.Key!,
                        g => g.First().IdUsuario,
                        StringComparer.OrdinalIgnoreCase);

                var idsUsuarios = usuarios.Select(u => u.IdUsuario).ToList();

                var detalles = await _context.UsuariosDetalle
                    .AsNoTracking()
                    .Where(d => idsUsuarios.Contains(d.IdUsuario) && d.Activo)
                    .Select(d => new { d.IdUsuario, d.IdEmpresa })
                    .ToListAsync();

                var detallePorUsuario = detalles.ToDictionary(d => d.IdUsuario);

                var existentes = await _context.SaldosVacacionesAnuales
                    .Where(s => s.Anio == anio && s.Activo)
                    .ToListAsync();

                var saldoPorUsuario = existentes.ToDictionary(s => s.IdUsuario);

                var resultado = new SincronizarSaldosResponse { Anio = anio };

                using var transaction = await _context.Database.BeginTransactionAsync();

                try
                {
                    foreach (var empleado in empleados)
                    {
                        resultado.Total++;

                        if (string.IsNullOrWhiteSpace(empleado.Correo)
                            || !empleado.Vacacionesxantiguedad.HasValue)
                        {
                            resultado.Omitidos++;
                            continue;
                        }

                        if (!usuarioPorCorreo.TryGetValue(empleado.Correo, out var idUsuarioEmpleado))
                        {
                            resultado.Omitidos++;
                            continue;
                        }

                        if (!detallePorUsuario.TryGetValue(idUsuarioEmpleado, out var detalle))
                        {
                            resultado.Omitidos++;
                            continue;
                        }

                        if (saldoPorUsuario.TryGetValue(idUsuarioEmpleado, out var saldo))
                        {
                            saldo.DiasGenerados = empleado.Vacacionesxantiguedad.Value;
                            resultado.Actualizados++;
                        }
                        else
                        {
                            var nuevoSaldo = new SaldoVacacionesAnual
                            {
                                IdUsuario = idUsuarioEmpleado,
                                IdEmpresa = detalle.IdEmpresa,
                                Anio = anio,
                                DiasGenerados = empleado.Vacacionesxantiguedad.Value
                            };
                            _context.SaldosVacacionesAnuales.Add(nuevoSaldo);
                            resultado.Creados++;
                        }
                    }

                    await _context.SaveChangesAsync();
                    await transaction.CommitAsync();
                }
                catch
                {
                    await transaction.RollbackAsync();
                    throw;
                }

                EnrichWideEvent("SincronizarSaldos", count: resultado.Creados + resultado.Actualizados, additionalContext: new Dictionary<string, object>
                {
                    ["anio"] = anio,
                    ["creados"] = resultado.Creados,
                    ["actualizados"] = resultado.Actualizados,
                    ["omitidos"] = resultado.Omitidos
                });

                return resultado;
            }
            catch (Exception ex)
            {
                EnrichWideEvent("SincronizarSaldos", exception: ex);
                return CommonErrors.InternalServerError("Error al sincronizar saldos de vacaciones");
            }
        }
    }
}
