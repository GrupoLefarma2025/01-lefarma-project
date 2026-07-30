namespace Lefarma.API.Domain.ValueObjects.Config;

public enum MotivoOmisionJefe
{
    ConfigNoAplica,
    CadenaRota,
    SinUsuario,
    Excluido
}

public sealed record JefeEfectivoResult(int? IdUsuario, MotivoOmisionJefe? MotivoOmision = null);
