using FluentValidation;
using Lefarma.API.Features.Admin.DTOs;

namespace Lefarma.API.Features.Admin;
public class CreateUsuarioValidator : AbstractValidator<CreateUsuarioRequest>
{
    public CreateUsuarioValidator()
    {
        RuleFor(x => x.SamAccountName)
            .NotEmpty().WithMessage("El nombre de usuario es requerido")
            .MaximumLength(100).WithMessage("El nombre de usuario no puede exceder 100 caracteres");

        RuleFor(x => x.Dominio)
            .NotEmpty().WithMessage("El dominio es requerido")
            .MaximumLength(100).WithMessage("El dominio no puede exceder 100 caracteres");

        RuleFor(x => x.NombreCompleto)
            .NotEmpty().WithMessage("El nombre completo es requerido")
            .MaximumLength(200).WithMessage("El nombre completo no puede exceder 200 caracteres");

        RuleFor(x => x.Correo)
            .EmailAddress().WithMessage("El correo electr�nico no es v�lido")
            .When(x => !string.IsNullOrEmpty(x.Correo));
    }
}

public class UpdateUsuarioValidator : AbstractValidator<UpdateUsuarioRequest>
{
    public UpdateUsuarioValidator()
    {
        RuleFor(x => x.SamAccountName)
            .NotEmpty().WithMessage("El nombre de usuario (SamAccountName) es requerido")
            .MaximumLength(100).WithMessage("El nombre de usuario no puede exceder 100 caracteres");

        RuleFor(x => x.NombreCompleto)
            .NotEmpty().WithMessage("El nombre completo es requerido")
            .MaximumLength(200).WithMessage("El nombre completo no puede exceder 200 caracteres");

        RuleFor(x => x.Correo)
            .EmailAddress().WithMessage("El correo electr�nico no es v�lido")
            .MaximumLength(200).WithMessage("El correo no puede exceder 200 caracteres")
            .When(x => !string.IsNullOrEmpty(x.Correo));

        RuleFor(x => x.Detalle)
            .SetValidator(new UpdateUsuarioDetalleValidator()!)
            .When(x => x.Detalle != null);
    }
}

public class UpdateUsuarioDetalleValidator : AbstractValidator<UpdateUsuarioDetalleRequest>
{
    public UpdateUsuarioDetalleValidator()
    {
        RuleFor(x => x.IdEmpresa)
            .GreaterThan(0).WithMessage("Debe seleccionar una empresa v�lida");

        RuleFor(x => x.IdSucursal)
            .GreaterThan(0).WithMessage("Debe seleccionar una sucursal v�lida");

        RuleFor(x => x.IdArea)
            .GreaterThan(0).WithMessage("El �rea debe ser v�lida")
            .When(x => x.IdArea.HasValue);

        RuleFor(x => x.Puesto)
            .MaximumLength(150).WithMessage("El puesto no puede exceder 150 caracteres")
            .When(x => !string.IsNullOrEmpty(x.Puesto));

        RuleFor(x => x.NumeroEmpleado)
            .MaximumLength(50).WithMessage("El n�mero de empleado no puede exceder 50 caracteres")
            .When(x => !string.IsNullOrEmpty(x.NumeroEmpleado));

        RuleFor(x => x.TelefonoOficina)
            .MaximumLength(20).WithMessage("El tel�fono de oficina no puede exceder 20 caracteres")
            .When(x => !string.IsNullOrEmpty(x.TelefonoOficina));

        RuleFor(x => x.Extension)
            .MaximumLength(10).WithMessage("La extensi�n no puede exceder 10 caracteres")
            .When(x => !string.IsNullOrEmpty(x.Extension));

        RuleFor(x => x.Celular)
            .MaximumLength(20).WithMessage("El celular no puede exceder 20 caracteres")
            .When(x => !string.IsNullOrEmpty(x.Celular));

        RuleFor(x => x.TelegramChat)
            .MaximumLength(200).WithMessage("El telegram chat no puede exceder 200 caracteres")
            .When(x => !string.IsNullOrEmpty(x.TelegramChat));

        RuleFor(x => x.AvatarUrl)
            .MaximumLength(255).WithMessage("La URL del avatar no puede exceder 255 caracteres")
            .When(x => !string.IsNullOrEmpty(x.AvatarUrl));

        RuleFor(x => x.TemaInterfaz)
            .MaximumLength(20).WithMessage("El tema de interfaz no puede exceder 20 caracteres")
            .Must(x => x == "light" || x == "dark").WithMessage("El tema debe ser 'light' o 'dark'");

        RuleFor(x => x.DashboardInicio)
            .MaximumLength(50).WithMessage("El dashboard de inicio no puede exceder 50 caracteres")
            .When(x => !string.IsNullOrEmpty(x.DashboardInicio));

        RuleFor(x => x.DelegacionHasta)
            .GreaterThanOrEqualTo(DateTime.Today).WithMessage("La fecha de delegaci�n debe ser mayor o igual a hoy")
            .When(x => x.DelegacionHasta.HasValue);
    }
}

public class CreateRolValidator : AbstractValidator<CreateRolRequest>
{
    public CreateRolValidator()
    {
        RuleFor(x => x.NombreRol)
            .NotEmpty().WithMessage("El nombre del rol es requerido")
            .MaximumLength(100).WithMessage("El nombre del rol no puede exceder 100 caracteres");

        RuleFor(x => x.Descripcion)
            .MaximumLength(500).WithMessage("La descripci�n no puede exceder 500 caracteres")
            .When(x => !string.IsNullOrEmpty(x.Descripcion));
    }
}

public class UpdateRolValidator : AbstractValidator<UpdateRolRequest>
{
    public UpdateRolValidator()
    {
        RuleFor(x => x.NombreRol)
            .NotEmpty().WithMessage("El nombre del rol es requerido")
            .MaximumLength(100).WithMessage("El nombre del rol no puede exceder 100 caracteres");

        RuleFor(x => x.Descripcion)
            .MaximumLength(500).WithMessage("La descripci�n no puede exceder 500 caracteres")
            .When(x => !string.IsNullOrEmpty(x.Descripcion));
    }
}

public class CreatePermisoValidator : AbstractValidator<CreatePermisoRequest>
{
    public CreatePermisoValidator()
    {
        RuleFor(x => x.CodigoPermiso)
            .NotEmpty().WithMessage("El c�digo del permiso es requerido")
            .MaximumLength(100).WithMessage("El c�digo del permiso no puede exceder 100 caracteres");

        RuleFor(x => x.NombrePermiso)
            .NotEmpty().WithMessage("El nombre del permiso es requerido")
            .MaximumLength(200).WithMessage("El nombre del permiso no puede exceder 200 caracteres");

        RuleFor(x => x.Descripcion)
            .MaximumLength(500).WithMessage("La descripci�n no puede exceder 500 caracteres")
            .When(x => !string.IsNullOrEmpty(x.Descripcion));

        RuleFor(x => x.Categoria)
            .MaximumLength(100).WithMessage("La categor�a no puede exceder 100 caracteres")
            .When(x => !string.IsNullOrEmpty(x.Categoria));

        RuleFor(x => x.Recurso)
            .MaximumLength(100).WithMessage("El recurso no puede exceder 100 caracteres")
            .When(x => !string.IsNullOrEmpty(x.Recurso));

        RuleFor(x => x.Accion)
            .MaximumLength(50).WithMessage("La acci�n no puede exceder 50 caracteres")
            .When(x => !string.IsNullOrEmpty(x.Accion));
    }
}

public class UpdatePermisoValidator : AbstractValidator<UpdatePermisoRequest>
{
    public UpdatePermisoValidator()
    {
        RuleFor(x => x.CodigoPermiso)
            .NotEmpty().WithMessage("El c�digo del permiso es requerido")
            .MaximumLength(100).WithMessage("El c�digo del permiso no puede exceder 100 caracteres");

        RuleFor(x => x.NombrePermiso)
            .NotEmpty().WithMessage("El nombre del permiso es requerido")
            .MaximumLength(200).WithMessage("El nombre del permiso no puede exceder 200 caracteres");

        RuleFor(x => x.Descripcion)
            .MaximumLength(500).WithMessage("La descripci�n no puede exceder 500 caracteres")
            .When(x => !string.IsNullOrEmpty(x.Descripcion));

        RuleFor(x => x.Categoria)
            .MaximumLength(100).WithMessage("La categor�a no puede exceder 100 caracteres")
            .When(x => !string.IsNullOrEmpty(x.Categoria));

        RuleFor(x => x.Recurso)
            .MaximumLength(100).WithMessage("El recurso no puede exceder 100 caracteres")
            .When(x => !string.IsNullOrEmpty(x.Recurso));

        RuleFor(x => x.Accion)
            .MaximumLength(50).WithMessage("La acci�n no puede exceder 50 caracteres")
            .When(x => !string.IsNullOrEmpty(x.Accion));
    }
}
