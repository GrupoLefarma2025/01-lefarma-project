using ErrorOr;
using Lefarma.API.Domain.Firmas;
using Lefarma.API.Features.Firmas.DTOs;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Shared.Errors;
using Lefarma.API.Shared.Logging;
using Lefarma.API.Shared.Services;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Features.Firmas;

/// <summary>
/// Gestión de firmas digitales de usuarios por parte de RH:
/// listado con estado y habilitación de cambio (un solo uso).
/// El estado se deriva del historial de eventos JSON (firma_control).
/// </summary>
public class FirmasService : BaseService, IFirmasService
{
    private readonly AsokamDbContext _asokamContext;
    private readonly ApplicationDbContext _appContext;
    protected override string EntityName => "Firmas";

    public FirmasService(
        AsokamDbContext asokamContext,
        ApplicationDbContext appContext,
        IWideEventAccessor wideEventAccessor)
        : base(wideEventAccessor)
    {
        _asokamContext = asokamContext;
        _appContext = appContext;
    }

    public async Task<ErrorOr<List<FirmaUsuarioResponse>>> GetUsuariosConFirmaAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            // Detalles (Lefarma) de usuarios que ya registraron firma.
            var detalles = await _appContext.UsuariosDetalle
                .AsNoTracking()
                .Where(d => d.FirmaPath != null && d.FirmaPath != "")
                .ToListAsync(cancellationToken);

            if (detalles.Count == 0)
                return new List<FirmaUsuarioResponse>();

            // Estado derivado del historial JSON por usuario.
            var controles = detalles.ToDictionary(d => d.IdUsuario, d => FirmaControl.Parse(d.FirmaControlJson));

            var ids = detalles.Select(d => d.IdUsuario).ToList();
            var areaIds = detalles.Where(d => d.IdArea.HasValue).Select(d => d.IdArea!.Value).Distinct().ToList();
            var habilitoIds = controles.Values
                .Select(c => c.UltimaHabilitacion?.IdUsuario)
                .Where(id => id.HasValue && id.Value > 0)
                .Select(id => id!.Value)
                .Distinct()
                .ToList();

            // Nombres (Asokam) y áreas (Lefarma) en consultas separadas; se cruzan en memoria.
            var usuarios = await _asokamContext.Usuarios
                .AsNoTracking()
                .Where(u => ids.Contains(u.IdUsuario))
                .ToListAsync(cancellationToken);

            var areas = await _appContext.Areas
                .AsNoTracking()
                .Where(a => areaIds.Contains(a.IdArea))
                .ToDictionaryAsync(a => a.IdArea, a => a.Nombre, cancellationToken);

            var habilitoNombres = habilitoIds.Count == 0
                ? new Dictionary<int, string?>()
                : await _asokamContext.Usuarios
                    .AsNoTracking()
                    .Where(u => habilitoIds.Contains(u.IdUsuario))
                    .ToDictionaryAsync(u => u.IdUsuario, u => u.NombreCompleto, cancellationToken);

            var usuariosPorId = usuarios.ToDictionary(u => u.IdUsuario);

            var response = detalles.Select(d =>
            {
                usuariosPorId.TryGetValue(d.IdUsuario, out var u);
                var area = d.IdArea.HasValue && areas.TryGetValue(d.IdArea.Value, out var a) ? a : null;
                var control = controles[d.IdUsuario];
                var ultimaHabilitacion = control.UltimaHabilitacion;
                var nombreHabilito = ultimaHabilitacion != null && ultimaHabilitacion.IdUsuario > 0
                    && habilitoNombres.TryGetValue(ultimaHabilitacion.IdUsuario, out var n) ? n : null;

                return new FirmaUsuarioResponse
                {
                    IdUsuario = d.IdUsuario,
                    SamAccountName = u?.SamAccountName,
                    NombreCompleto = u?.NombreCompleto,
                    Correo = u?.Correo,
                    Area = area,
                    FirmaPath = d.FirmaPath,
                    FirmaSubidas = Math.Max(control.Subidas, 1),
                    FirmaCambioHabilitado = control.CambioHabilitado,
                    FirmaCambioSolicitado = control.SolicitudPendiente,
                    FechaSolicitudCambioFirma = control.SolicitudPendiente ? control.UltimaSolicitud?.Fecha : null,
                    IdUsuarioHabilito = ultimaHabilitacion?.IdUsuario > 0 ? ultimaHabilitacion.IdUsuario : null,
                    NombreUsuarioHabilito = nombreHabilito,
                    FechaHabilitoFirma = ultimaHabilitacion?.Fecha,
                };
            })
            // Primero quienes solicitaron cambio: son los pendientes de atender.
            .OrderByDescending(r => r.FirmaCambioSolicitado)
            .ThenBy(r => r.NombreCompleto)
            .ToList();

            EnrichWideEvent(action: "GetUsuariosConFirma", count: response.Count);
            return response;
        }
        catch (Exception ex)
        {
            EnrichWideEvent(action: "GetUsuariosConFirma", exception: ex);
            return CommonErrors.DatabaseError("obtener los usuarios con firma");
        }
    }

    public async Task<ErrorOr<List<FirmaHistorialEventoResponse>>> GetHistorialAsync(int idUsuario, CancellationToken cancellationToken = default)
    {
        try
        {
            var detalle = await _appContext.UsuariosDetalle
                .AsNoTracking()
                .FirstOrDefaultAsync(d => d.IdUsuario == idUsuario, cancellationToken);

            if (detalle == null)
            {
                EnrichWideEvent(action: "GetHistorialFirma", entityId: idUsuario, notFound: true);
                return CommonErrors.NotFound("Usuario");
            }

            var control = FirmaControl.Parse(detalle.FirmaControlJson);
            if (control.Eventos.Count == 0)
                return new List<FirmaHistorialEventoResponse>();

            var actorIds = control.Eventos.Select(e => e.IdUsuario).Where(id => id > 0).Distinct().ToList();
            var nombres = actorIds.Count == 0
                ? new Dictionary<int, string?>()
                : await _asokamContext.Usuarios
                    .AsNoTracking()
                    .Where(u => actorIds.Contains(u.IdUsuario))
                    .ToDictionaryAsync(u => u.IdUsuario, u => u.NombreCompleto, cancellationToken);

            var response = control.Eventos
                .OrderByDescending(e => e.Fecha)
                .Select(e => new FirmaHistorialEventoResponse
                {
                    Accion = e.Accion,
                    Fecha = e.Fecha,
                    IdUsuario = e.IdUsuario,
                    NombreUsuario = e.IdUsuario > 0 && nombres.TryGetValue(e.IdUsuario, out var n) ? n : null
                })
                .ToList();

            EnrichWideEvent(action: "GetHistorialFirma", entityId: idUsuario, count: response.Count);
            return response;
        }
        catch (Exception ex)
        {
            EnrichWideEvent(action: "GetHistorialFirma", entityId: idUsuario, exception: ex);
            return CommonErrors.DatabaseError("obtener el historial de la firma");
        }
    }

    public async Task<ErrorOr<bool>> HabilitarCambioFirmaAsync(int idUsuario, int idUsuarioRh, CancellationToken cancellationToken = default)
    {
        try
        {
            var detalle = await _appContext.UsuariosDetalle
                .FirstOrDefaultAsync(d => d.IdUsuario == idUsuario, cancellationToken);

            if (detalle == null || string.IsNullOrEmpty(detalle.FirmaPath))
            {
                EnrichWideEvent(action: "HabilitarCambioFirma", entityId: idUsuario, notFound: true);
                return CommonErrors.NotFound("Firma");
            }

            var control = FirmaControl.Parse(detalle.FirmaControlJson);
            if (control.CambioHabilitado)
                return CommonErrors.Validation("Firma.CambioYaHabilitado", "Este usuario ya tiene un cambio de firma habilitado.");

            // Un evento "habilitacion" habilita el cambio (un solo uso) y, si existía,
            // atiende la solicitud pendiente (el estado se deriva del último evento).
            control.AgregarHabilitacion(idUsuarioRh, DateTime.Now);
            detalle.FirmaControlJson = control.Serialize();
            detalle.FechaModificacion = DateTime.Now;
            await _appContext.SaveChangesAsync(cancellationToken);

            EnrichWideEvent(action: "HabilitarCambioFirma", entityId: idUsuario, additionalContext: new Dictionary<string, object>
            {
                ["habilitadoPor"] = idUsuarioRh
            });
            return true;
        }
        catch (Exception ex)
        {
            EnrichWideEvent(action: "HabilitarCambioFirma", entityId: idUsuario, exception: ex);
            return CommonErrors.DatabaseError("habilitar el cambio de firma");
        }
    }
}
