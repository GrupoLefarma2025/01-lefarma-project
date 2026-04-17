using Lefarma.API.Domain.Entities.Catalogos;
using Lefarma.API.Features.Catalogos.Proveedores.DTOs;

namespace Lefarma.API.Features.Catalogos.Proveedores.Extensions;

public static class ProveedorExtensions
{
    public static ProveedorResponse ToResponse(this Proveedor entity)
    {
        return new ProveedorResponse
        {
            IdProveedor = entity.IdProveedor,
            RazonSocial = entity.RazonSocial,
            RazonSocialNormalizada = entity.RazonSocialNormalizada,
            RFC = entity.RFC,
            CodigoPostal = entity.CodigoPostal,
            RegimenFiscalId = entity.RegimenFiscalId,
            RegimenFiscalDescripcion = entity.RegimenFiscal?.Descripcion,
            UsoCfdi = entity.UsoCfdi,
            SinDatosFiscales = entity.SinDatosFiscales,
            Estatus = entity.Estatus,
            CambioEstatusPor = entity.CambioEstatusPor,
            FechaRegistro = entity.FechaRegistro,
            FechaModificacion = entity.FechaModificacion,
            Detalle = entity.Detalle?.ToResponse(),
            CuentasFormaPago = entity.CuentasFormaPago?.Select(c => c.ToResponse()).ToList() ?? new()
        };
    }

    public static ProveedorDetalleResponse ToResponse(this ProveedorDetalle entity)
    {
        return new ProveedorDetalleResponse
        {
            IdDetalle = entity.IdDetalle,
            IdProveedor = entity.IdProveedor,
            PersonaContactoNombre = entity.PersonaContactoNombre,
            ContactoTelefono = entity.ContactoTelefono,
            ContactoEmail = entity.ContactoEmail,
            Comentario = entity.Comentario
        };
    }

    public static ProveedorFormaPagoCuentaResponse ToResponse(this ProveedorFormaPagoCuenta entity)
    {
        return new ProveedorFormaPagoCuentaResponse
        {
            IdCuen = entity.IdCuen,
            IdProveedor = entity.IdProveedor,
            IdFormaPago = entity.IdFormaPago,
            FormaPagoNombre = entity.FormaPago?.Nombre,
            IdBanco = entity.IdBanco,
            BancoNombre = entity.Banco?.Nombre,
            NumeroCuenta = entity.NumeroCuenta,
            Clabe = entity.Clabe,
            NumeroTarjeta = entity.NumeroTarjeta,
            Beneficiario = entity.Beneficiario,
            CorreoNotificacion = entity.CorreoNotificacion,
            Activo = entity.Activo
        };
    }
}
