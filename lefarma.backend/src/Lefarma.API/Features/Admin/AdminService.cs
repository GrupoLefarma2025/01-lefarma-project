using ErrorOr;
using Lefarma.API.Domain.Entities.Auth;
using Lefarma.API.Domain.Entities.Catalogos;
using Lefarma.API.Domain.Interfaces.Admin;
using Lefarma.API.Features.Admin.DTOs;
using Lefarma.API.Shared.Errors;
using Lefarma.API.Shared.Extensions;
using Lefarma.API.Shared.Logging;
using Lefarma.API.Shared.Services;
using Microsoft.Extensions.Logging;

namespace Lefarma.API.Features.Admin;
public class AdminService : BaseService, IAdminService
{
    private readonly IAdminRepository _repository;
    private readonly ILogger<AdminService> _logger;
    protected override string EntityName => "Admin";

    public AdminService(
        IAdminRepository repository,
        IWideEventAccessor wideEventAccessor,
        ILogger<AdminService> logger)
        : base(wideEventAccessor)
    {
        _repository = repository;
        _logger = logger;
    }

    #region Usuarios

    public async Task<ErrorOr<IEnumerable<UsuarioResponse>>> GetAllUsuariosAsync()
    {
        try
        {
            var usuarios = await _repository.GetAllUsuariosAsync();

            if (!usuarios.Any())
            {
                EnrichWideEvent(action: "GetAllUsuarios", count: 0);
                return CommonErrors.NotFound("Usuarios");
            }

            // Obtener detalles de usuarios
            var usuariosIds = usuarios.Select(u => u.IdUsuario).ToList();
            var detallesLista = await _repository.GetUsuariosDetalleAsync(usuariosIds);
            var detalles = detallesLista.ToDictionary(ud => ud.IdUsuario);

            var response = usuarios.Select(u => u.ToResponse(
                detalles.ContainsKey(u.IdUsuario) ? detalles[u.IdUsuario] : null
            )).ToList();

            EnrichWideEvent(action: "GetAllUsuarios", count: response.Count, additionalContext: new Dictionary<string, object>
            {
                ["items"] = response.Select(u => u.NombreCompleto).ToList()
            });
            return response;
        }
        catch (Exception ex)
        {
            EnrichWideEvent(action: "GetAllUsuarios", exception: ex);
            return CommonErrors.DatabaseError("obtener los usuarios");
        }
    }

    public async Task<ErrorOr<UsuarioResponse>> GetUsuarioByIdAsync(int id)
    {
        try
        {
            var usuario = await _repository.GetUsuarioByIdConRelacionesAsync(id);

            if (usuario == null)
            {
                EnrichWideEvent(action: "GetUsuarioById", entityId: id, notFound: true);
                return CommonErrors.NotFound("Usuario", id.ToString());
            }

            // Obtener detalle del usuario
            var detalle = await _repository.GetUsuarioDetalleAsync(id);

            var response = usuario.ToResponse(detalle);

            EnrichWideEvent(action: "GetUsuarioById", entityId: id, nombre: usuario.NombreCompleto);
            return response;
        }
        catch (Exception ex)
        {
            EnrichWideEvent(action: "GetUsuarioById", entityId: id, exception: ex);
            return CommonErrors.DatabaseError("obtener el usuario");
        }
    }

    public async Task<ErrorOr<UsuarioResponse>> CreateUsuarioAsync(CreateUsuarioRequest request)
    {
        try
        {
            var existeUsuario = await _repository.ExisteUsuarioAsync(request.SamAccountName, request.Dominio);

            if (existeUsuario)
            {
                EnrichWideEvent(action: "CreateUsuario", nombre: request.SamAccountName, duplicate: true);
                return CommonErrors.AlreadyExists("Usuario", "SamAccountName", request.SamAccountName);
            }

            var usuario = new Usuario
            {
                SamAccountName = request.SamAccountName,
                Dominio = request.Dominio,
                NombreCompleto = request.NombreCompleto,
                Correo = request.Correo,
                EsAnonimo = request.EsAnonimo,
                EsActivo = request.EsActivo,
                EsRobot = request.EsRobot,
                FechaCreacion = DateTime.UtcNow
            };

            await _repository.CreateUsuarioAsync(usuario);

            if (request.RolesIds.Any())
            {
                await _repository.AsignarRolesAUsuarioAsync(usuario.IdUsuario, request.RolesIds);
            }

            var response = await GetUsuarioByIdAsync(usuario.IdUsuario);
            EnrichWideEvent(action: "CreateUsuario", entityId: usuario.IdUsuario, nombre: usuario.NombreCompleto);
            return response;
        }
        catch (Exception ex)
        {
            EnrichWideEvent(action: "CreateUsuario", nombre: request.SamAccountName, exception: ex);
            return CommonErrors.DatabaseError("crear el usuario");
        }
    }

    public async Task<ErrorOr<UsuarioResponse>> UpdateUsuarioAsync(int id, UpdateUsuarioRequest request)
    {
        try
        {
            var usuario = await _repository.GetUsuarioByIdAsync(id);
            if (usuario == null)
            {
                EnrichWideEvent(action: "UpdateUsuario", entityId: id, notFound: true);
                return CommonErrors.NotFound("Usuario", id.ToString());
            }

            usuario.SamAccountName = request.SamAccountName;
            usuario.NombreCompleto = request.NombreCompleto;
            usuario.Correo = request.Correo;

            await _repository.UpdateUsuarioAsync(usuario);

            if (request.RolesIds.Any())
            {
                await _repository.AsignarRolesAUsuarioAsync(id, request.RolesIds);
            }

            if (request.PermisosIds.Any())
            {
                await _repository.AsignarPermisosAUsuarioAsync(id, request.PermisosIds);
            }

            // Actualizar o crear detalle del usuario
            if (request.Detalle != null)
            {
                var detalle = await _repository.GetUsuarioDetalleAsync(id);

                if (detalle == null)
                {
                    // Crear nuevo detalle
                    detalle = new UsuarioDetalle
                    {
                        IdUsuario = id,
                        FechaCreacion = DateTime.UtcNow
                    };

                    // Actualizar propiedades del detalle
                    detalle.IdEmpresa = request.Detalle.IdEmpresa;
                    detalle.IdSucursal = request.Detalle.IdSucursal;
                    detalle.IdArea = request.Detalle.IdArea;
                    detalle.IdCentroCosto = request.Detalle.IdCentroCosto;
                    detalle.Puesto = request.Detalle.Puesto;
                    detalle.NumeroEmpleado = request.Detalle.NumeroEmpleado;
                    detalle.FirmaPath = request.Detalle.FirmaPath;
                    detalle.TelefonoOficina = request.Detalle.TelefonoOficina;
                    detalle.Extension = request.Detalle.Extension;
                    detalle.Celular = request.Detalle.Celular;
                    detalle.TelegramChat = request.Detalle.TelegramChat;
                    detalle.NotificarEmail = request.Detalle.NotificarEmail;
                    detalle.NotificarApp = request.Detalle.NotificarApp;
                    detalle.NotificarWhatsapp = request.Detalle.NotificarWhatsapp;
                    detalle.NotificarSms = request.Detalle.NotificarSms;
                    detalle.NotificarTelegram = request.Detalle.NotificarTelegram;
                    detalle.NotificarSoloUrgentes = request.Detalle.NotificarSoloUrgentes;
                    detalle.NotificarResumenDiario = request.Detalle.NotificarResumenDiario;
                    detalle.NotificarRechazos = request.Detalle.NotificarRechazos;
                    detalle.NotificarVencimientos = request.Detalle.NotificarVencimientos;
                    detalle.IdUsuarioDelegado = request.Detalle.IdUsuarioDelegado;
                    detalle.DelegacionHasta = request.Detalle.DelegacionHasta;
                    detalle.AvatarUrl = request.Detalle.AvatarUrl;
                    detalle.TemaInterfaz = request.Detalle.TemaInterfaz;
                    detalle.DashboardInicio = request.Detalle.DashboardInicio;
                    detalle.Activo = request.Detalle.Activo;
                    detalle.FechaModificacion = DateTime.UtcNow;

                    await _repository.CreateUsuarioDetalleAsync(detalle);
                }
                else
                {
                    // Actualizar detalle existente
                    detalle.IdEmpresa = request.Detalle.IdEmpresa;
                    detalle.IdSucursal = request.Detalle.IdSucursal;
                    detalle.IdArea = request.Detalle.IdArea;
                    detalle.IdCentroCosto = request.Detalle.IdCentroCosto;
                    detalle.Puesto = request.Detalle.Puesto;
                    detalle.NumeroEmpleado = request.Detalle.NumeroEmpleado;
                    detalle.FirmaPath = request.Detalle.FirmaPath;
                    detalle.TelefonoOficina = request.Detalle.TelefonoOficina;
                    detalle.Extension = request.Detalle.Extension;
                    detalle.Celular = request.Detalle.Celular;
                    detalle.TelegramChat = request.Detalle.TelegramChat;
                    detalle.NotificarEmail = request.Detalle.NotificarEmail;
                    detalle.NotificarApp = request.Detalle.NotificarApp;
                    detalle.NotificarWhatsapp = request.Detalle.NotificarWhatsapp;
                    detalle.NotificarSms = request.Detalle.NotificarSms;
                    detalle.NotificarTelegram = request.Detalle.NotificarTelegram;
                    detalle.NotificarSoloUrgentes = request.Detalle.NotificarSoloUrgentes;
                    detalle.NotificarResumenDiario = request.Detalle.NotificarResumenDiario;
                    detalle.NotificarRechazos = request.Detalle.NotificarRechazos;
                    detalle.NotificarVencimientos = request.Detalle.NotificarVencimientos;
                    detalle.IdUsuarioDelegado = request.Detalle.IdUsuarioDelegado;
                    detalle.DelegacionHasta = request.Detalle.DelegacionHasta;
                    detalle.AvatarUrl = request.Detalle.AvatarUrl;
                    detalle.TemaInterfaz = request.Detalle.TemaInterfaz;
                    detalle.DashboardInicio = request.Detalle.DashboardInicio;
                    detalle.Activo = request.Detalle.Activo;
                    detalle.FechaModificacion = DateTime.UtcNow;

                    await _repository.UpdateUsuarioDetalleAsync(detalle);
                }
            }

            var response = await GetUsuarioByIdAsync(id);
            EnrichWideEvent(action: "UpdateUsuario", entityId: id, nombre: usuario.NombreCompleto);
            return response;
        }
        catch (Exception ex)
        {
            EnrichWideEvent(action: "UpdateUsuario", entityId: id, exception: ex);
            return CommonErrors.DatabaseError("actualizar el usuario");
        }
    }

    #endregion

    #region Roles

    public async Task<ErrorOr<IEnumerable<RolResponse>>> GetAllRolesAsync()
    {
        try
        {
            var roles = await _repository.GetAllRolesAsync();

            if (!roles.Any())
            {
                EnrichWideEvent(action: "GetAllRoles", count: 0);
                return CommonErrors.NotFound("Roles");
            }

            var response = roles.Select(r => r.ToResponse()).ToList();

            EnrichWideEvent(action: "GetAllRoles", count: response.Count, additionalContext: new Dictionary<string, object>
            {
                ["items"] = response.Select(r => r.NombreRol).ToList()
            });
            return response;
        }
        catch (Exception ex)
        {
            EnrichWideEvent(action: "GetAllRoles", exception: ex);
            return CommonErrors.DatabaseError("obtener los roles");
        }
    }

    public async Task<ErrorOr<RolResponse>> GetRolByIdAsync(int id)
    {
        try
        {
            var rol = await _repository.GetRolByIdConRelacionesAsync(id);

            if (rol == null)
            {
                EnrichWideEvent(action: "GetRolById", entityId: id, notFound: true);
                return CommonErrors.NotFound("Rol", id.ToString());
            }

            var response = rol.ToResponse();

            EnrichWideEvent(action: "GetRolById", entityId: id, nombre: rol.NombreRol);
            return response;
        }
        catch (Exception ex)
        {
            EnrichWideEvent(action: "GetRolById", entityId: id, exception: ex);
            return CommonErrors.DatabaseError("obtener el rol");
        }
    }

    public async Task<ErrorOr<RolResponse>> CreateRolAsync(CreateRolRequest request)
    {
        try
        {
            var existeRol = await _repository.ExisteRolAsync(request.NombreRol);
            if (existeRol)
            {
                EnrichWideEvent(action: "CreateRol", nombre: request.NombreRol, duplicate: true);
                return CommonErrors.AlreadyExists("Rol", "nombre", request.NombreRol);
            }

            var rol = new Rol
            {
                NombreRol = request.NombreRol,
                Descripcion = request.Descripcion,
                EsActivo = request.EsActivo,
                EsSistema = request.EsSistema,
                FechaCreacion = DateTime.UtcNow
            };

            await _repository.CreateRolAsync(rol);

            if (request.PermisosIds.Any())
            {
                await _repository.AsignarPermisosARolAsync(rol.IdRol, request.PermisosIds);
            }

            var response = await GetRolByIdAsync(rol.IdRol);
            EnrichWideEvent(action: "CreateRol", entityId: rol.IdRol, nombre: rol.NombreRol);
            return response;
        }
        catch (Exception ex)
        {
            EnrichWideEvent(action: "CreateRol", nombre: request.NombreRol, exception: ex);
            return CommonErrors.DatabaseError("crear el rol");
        }
    }

    public async Task<ErrorOr<RolResponse>> UpdateRolAsync(int id, UpdateRolRequest request)
    {
        try
        {
            var rol = await _repository.GetRolByIdAsync(id);
            if (rol == null)
            {
                EnrichWideEvent(action: "UpdateRol", entityId: id, notFound: true);
                return CommonErrors.NotFound("Rol", id.ToString());
            }

            var existeOtro = await _repository.ExisteOtroRolAsync(request.NombreRol, id);
            if (existeOtro)
            {
                EnrichWideEvent(action: "UpdateRol", entityId: id, nombre: request.NombreRol, duplicate: true);
                return CommonErrors.AlreadyExists("Rol", "nombre", request.NombreRol);
            }

            rol.NombreRol = request.NombreRol;
            rol.Descripcion = request.Descripcion;
            rol.EsActivo = request.EsActivo;

            await _repository.UpdateRolAsync(rol);

            if (request.PermisosIds.Any())
            {
                await _repository.AsignarPermisosARolAsync(id, request.PermisosIds);
            }

            var response = await GetRolByIdAsync(id);
            EnrichWideEvent(action: "UpdateRol", entityId: id, nombre: rol.NombreRol);
            return response;
        }
        catch (Exception ex)
        {
            EnrichWideEvent(action: "UpdateRol", entityId: id, exception: ex);
            return CommonErrors.DatabaseError("actualizar el rol");
        }
    }

    public async Task<ErrorOr<RolConUsuariosResponse>> GetRolWithUsuariosAsync(int id)
    {
        try
        {
            var rol = await _repository.GetRolByIdConRelacionesAsync(id);

            if (rol == null)
            {
                EnrichWideEvent(action: "GetRolWithUsuarios", entityId: id, notFound: true);
                return CommonErrors.NotFound("Rol", id.ToString());
            }

            // Obtener IDs de usuarios asignados
            var usuarioIds = rol.UsuariosRoles.Select(ur => ur.IdUsuario).ToList();

            // Obtener datos completos de usuarios
            var usuarios = new List<Usuario>();
            foreach (var usuarioId in usuarioIds)
            {
                var usuario = await _repository.GetUsuarioByIdAsync(usuarioId);
                if (usuario != null)
                {
                    usuarios.Add(usuario);
                }
            }

            var response = new RolConUsuariosResponse
            {
                IdRol = rol.IdRol,
                NombreRol = rol.NombreRol,
                Descripcion = rol.Descripcion,
                EsActivo = rol.EsActivo,
                EsSistema = rol.EsSistema,
                FechaCreacion = rol.FechaCreacion,
                CantidadUsuarios = rol.UsuariosRoles.Count,
                Permisos = rol.RolesPermisos
                    .Where(rp => rp.Permiso.EsActivo)
                    .Select(rp => rp.Permiso.ToPermisoBasicoResponse())
                    .ToList(),
                Usuarios = usuarios.Select(u => u.ToUsuarioBasicoResponse()).ToList()
            };

            EnrichWideEvent(action: "GetRolWithUsuarios", entityId: id, nombre: rol.NombreRol);
            return response;
        }
        catch (Exception ex)
        {
            EnrichWideEvent(action: "GetRolWithUsuarios", entityId: id, exception: ex);
            return CommonErrors.DatabaseError("obtener el rol con usuarios");
        }
    }

    public async Task<ErrorOr<bool>> UpdateRolUsuariosAsync(int id, AsignarUsuariosRequest request)
    {
        try
        {
            var rol = await _repository.GetRolByIdAsync(id);
            if (rol == null)
            {
                EnrichWideEvent(action: "UpdateRolUsuarios", entityId: id, notFound: true);
                return CommonErrors.NotFound("Rol", id.ToString());
            }

            await _repository.AsignarUsuariosARolAsync(id, request.UsuariosIds);

            EnrichWideEvent(action: "UpdateRolUsuarios", entityId: id, nombre: rol.NombreRol, count: request.UsuariosIds.Count);
            return true;
        }
        catch (Exception ex)
        {
            EnrichWideEvent(action: "UpdateRolUsuarios", entityId: id, exception: ex);
            return CommonErrors.DatabaseError("actualizar los usuarios del rol");
        }
    }

    public async Task<ErrorOr<bool>> DeleteRolAsync(int id)
    {
        try
        {
            var rol = await _repository.GetRolByIdConRelacionesAsync(id);

            if (rol == null)
            {
                EnrichWideEvent(action: "DeleteRol", entityId: id, notFound: true);
                return CommonErrors.NotFound("Rol", id.ToString());
            }

            if (rol.EsSistema)
            {
                EnrichWideEvent(action: "DeleteRol", entityId: id, error: "No se puede eliminar un rol de sistema");
                return CommonErrors.Validation("rol", "No se puede eliminar un rol de sistema");
            }

            if (await _repository.RolTieneUsuariosAsync(id))
            {
                EnrichWideEvent(action: "DeleteRol", entityId: id, error: "El rol tiene usuarios asignados");
                return CommonErrors.Validation("rol", "No se puede eliminar un rol que tiene usuarios asignados");
            }

            await _repository.DeleteRolAsync(rol);

            EnrichWideEvent(action: "DeleteRol", entityId: id, nombre: rol.NombreRol);
            return true;
        }
        catch (Exception ex)
        {
            EnrichWideEvent(action: "DeleteRol", entityId: id, exception: ex);
            return CommonErrors.DatabaseError("eliminar el rol");
        }
    }

    #endregion

    #region Permisos

    public async Task<ErrorOr<IEnumerable<PermisoResponse>>> GetAllPermisosAsync()
    {
        try
        {
            var permisos = await _repository.GetAllPermisosAsync();

            if (!permisos.Any())
            {
                EnrichWideEvent(action: "GetAllPermisos", count: 0);
                return CommonErrors.NotFound("Permisos");
            }

            var response = permisos.Select(p => p.ToResponse()).ToList();

            EnrichWideEvent(action: "GetAllPermisos", count: response.Count, additionalContext: new Dictionary<string, object>
            {
                ["items"] = response.Select(p => p.NombrePermiso).ToList()
            });
            return response;
        }
        catch (Exception ex)
        {
            EnrichWideEvent(action: "GetAllPermisos", exception: ex);
            return CommonErrors.DatabaseError("obtener los permisos");
        }
    }

    public async Task<ErrorOr<PermisoResponse>> GetPermisoByIdAsync(int id)
    {
        try
        {
            var permiso = await _repository.GetPermisoByIdConRelacionesAsync(id);

            if (permiso == null)
            {
                EnrichWideEvent(action: "GetPermisoById", entityId: id, notFound: true);
                return CommonErrors.NotFound("Permiso", id.ToString());
            }

            var response = permiso.ToResponse();

            EnrichWideEvent(action: "GetPermisoById", entityId: id, nombre: permiso.NombrePermiso);
            return response;
        }
        catch (Exception ex)
        {
            EnrichWideEvent(action: "GetPermisoById", entityId: id, exception: ex);
            return CommonErrors.DatabaseError("obtener el permiso");
        }
    }

    public async Task<ErrorOr<PermisoResponse>> CreatePermisoAsync(CreatePermisoRequest request)
    {
        try
        {
            var existePermiso = await _repository.ExistePermisoAsync(request.CodigoPermiso);
            if (existePermiso)
            {
                EnrichWideEvent(action: "CreatePermiso", nombre: request.CodigoPermiso, duplicate: true);
                return CommonErrors.AlreadyExists("Permiso", "c�digo", request.CodigoPermiso);
            }

            var permiso = new Permiso
            {
                CodigoPermiso = request.CodigoPermiso,
                NombrePermiso = request.NombrePermiso,
                Descripcion = request.Descripcion,
                Categoria = request.Categoria,
                Recurso = request.Recurso,
                Accion = request.Accion,
                EsActivo = request.EsActivo,
                EsSistema = request.EsSistema,
                FechaCreacion = DateTime.UtcNow
            };

            await _repository.CreatePermisoAsync(permiso);

            var response = await GetPermisoByIdAsync(permiso.IdPermiso);
            EnrichWideEvent(action: "CreatePermiso", entityId: permiso.IdPermiso, nombre: permiso.NombrePermiso);
            return response;
        }
        catch (Exception ex)
        {
            EnrichWideEvent(action: "CreatePermiso", nombre: request.CodigoPermiso, exception: ex);
            return CommonErrors.DatabaseError("crear el permiso");
        }
    }

    public async Task<ErrorOr<PermisoResponse>> UpdatePermisoAsync(int id, UpdatePermisoRequest request)
    {
        try
        {
            var permiso = await _repository.GetPermisoByIdAsync(id);
            if (permiso == null)
            {
                EnrichWideEvent(action: "UpdatePermiso", entityId: id, notFound: true);
                return CommonErrors.NotFound("Permiso", id.ToString());
            }

            var existeOtro = await _repository.ExisteOtroPermisoAsync(request.CodigoPermiso, id);
            if (existeOtro)
            {
                EnrichWideEvent(action: "UpdatePermiso", entityId: id, nombre: request.CodigoPermiso, duplicate: true);
                return CommonErrors.AlreadyExists("Permiso", "c�digo", request.CodigoPermiso);
            }

            permiso.CodigoPermiso = request.CodigoPermiso;
            permiso.NombrePermiso = request.NombrePermiso;
            permiso.Descripcion = request.Descripcion;
            permiso.Categoria = request.Categoria;
            permiso.Recurso = request.Recurso;
            permiso.Accion = request.Accion;
            permiso.EsActivo = request.EsActivo;

            await _repository.UpdatePermisoAsync(permiso);

            var response = await GetPermisoByIdAsync(id);
            EnrichWideEvent(action: "UpdatePermiso", entityId: id, nombre: permiso.NombrePermiso);
            return response;
        }
        catch (Exception ex)
        {
            EnrichWideEvent(action: "UpdatePermiso", entityId: id, exception: ex);
            return CommonErrors.DatabaseError("actualizar el permiso");
        }
    }

    public async Task<ErrorOr<bool>> DeletePermisoAsync(int id)
    {
        try
        {
            var permiso = await _repository.GetPermisoByIdConRelacionesAsync(id);

            if (permiso == null)
            {
                EnrichWideEvent(action: "DeletePermiso", entityId: id, notFound: true);
                return CommonErrors.NotFound("Permiso", id.ToString());
            }

            if (permiso.EsSistema)
            {
                EnrichWideEvent(action: "DeletePermiso", entityId: id, error: "No se puede eliminar un permiso de sistema");
                return CommonErrors.Validation("permiso", "No se puede eliminar un permiso de sistema");
            }

            if (await _repository.PermisoTieneRolesAsync(id))
            {
                EnrichWideEvent(action: "DeletePermiso", entityId: id, error: "El permiso est� asignado a roles");
                return CommonErrors.Validation("permiso", "No se puede eliminar un permiso que est� asignado a roles");
            }

            await _repository.DeletePermisoAsync(permiso);

            EnrichWideEvent(action: "DeletePermiso", entityId: id, nombre: permiso.NombrePermiso);
            return true;
        }
        catch (Exception ex)
        {
            EnrichWideEvent(action: "DeletePermiso", entityId: id, exception: ex);
            return CommonErrors.DatabaseError("eliminar el permiso");
        }
    }

    public async Task<ErrorOr<PermisoConRolesYUsuariosResponse>> GetPermisoConRelacionesAsync(int id)
    {
        try
        {
            var permiso = await _repository.GetPermisoByIdConRelacionesAsync(id);

            if (permiso == null)
            {
                EnrichWideEvent(action: "GetPermisoConRelaciones", entityId: id, notFound: true);
                return CommonErrors.NotFound("Permiso", id.ToString());
            }

            var rolIds = permiso.RolesPermisos.Select(rp => rp.IdRol).ToList();
            var roles = new List<Rol>();
            foreach (var rolId in rolIds)
            {
                var rol = await _repository.GetRolByIdAsync(rolId);
                if (rol != null) roles.Add(rol);
            }

            var usuarioIds = permiso.UsuariosPermisos.Select(up => up.IdUsuario).ToList();
            var usuarios = new List<Usuario>();
            foreach (var usuarioId in usuarioIds)
            {
                var usuario = await _repository.GetUsuarioByIdAsync(usuarioId);
                if (usuario != null) usuarios.Add(usuario);
            }

            return new PermisoConRolesYUsuariosResponse
            {
                IdPermiso = permiso.IdPermiso,
                CodigoPermiso = permiso.CodigoPermiso,
                NombrePermiso = permiso.NombrePermiso,
                Descripcion = permiso.Descripcion,
                Categoria = permiso.Categoria,
                Recurso = permiso.Recurso,
                Accion = permiso.Accion,
                EsActivo = permiso.EsActivo,
                EsSistema = permiso.EsSistema,
                FechaCreacion = permiso.FechaCreacion,
                CantidadRoles = permiso.RolesPermisos.Count,
                Roles = roles.Select(r => r.ToRolBasicoResponse()).ToList(),
                Usuarios = usuarios.Select(u => u.ToUsuarioBasicoResponse()).ToList()
            };
        }
        catch (Exception ex)
        {
            EnrichWideEvent(action: "GetPermisoConRelaciones", entityId: id, exception: ex);
            return CommonErrors.DatabaseError("obtener el permiso con relaciones");
        }
    }

    public async Task<ErrorOr<bool>> UpdatePermisoRolesAsync(int id, AsignarRolesAPermisoRequest request)
    {
        try
        {
            var permiso = await _repository.GetPermisoByIdAsync(id);

            if (permiso == null)
            {
                EnrichWideEvent(action: "UpdatePermisoRoles", entityId: id, notFound: true);
                return CommonErrors.NotFound("Permiso", id.ToString());
            }

            await _repository.AsignarRolesAPermisoAsync(id, request.RolesIds);

            EnrichWideEvent(action: "UpdatePermisoRoles", entityId: id, nombre: permiso.NombrePermiso, count: request.RolesIds.Count);
            return true;
        }
        catch (Exception ex)
        {
            EnrichWideEvent(action: "UpdatePermisoRoles", entityId: id, exception: ex);
            return CommonErrors.DatabaseError("actualizar los roles del permiso");
        }
    }

    public async Task<ErrorOr<bool>> UpdatePermisoUsuariosAsync(int id, AsignarUsuariosAPermisoRequest request)
    {
        try
        {
            var permiso = await _repository.GetPermisoByIdAsync(id);

            if (permiso == null)
            {
                EnrichWideEvent(action: "UpdatePermisoUsuarios", entityId: id, notFound: true);
                return CommonErrors.NotFound("Permiso", id.ToString());
            }

            await _repository.AsignarUsuariosAPermisoAsync(id, request.UsuariosIds);

            EnrichWideEvent(action: "UpdatePermisoUsuarios", entityId: id, nombre: permiso.NombrePermiso, count: request.UsuariosIds.Count);
            return true;
        }
        catch (Exception ex)
        {
            EnrichWideEvent(action: "UpdatePermisoUsuarios", entityId: id, exception: ex);
            return CommonErrors.DatabaseError("actualizar los usuarios del permiso");
        }
    }

    #endregion
}
