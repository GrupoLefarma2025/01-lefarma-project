namespace Lefarma.API.Features.Sigma.Services.PdfSignature;

public readonly record struct CajaDibujo(double X0, double Y0, double X1, double Y1)
{
    public double Ancho => X1 - X0;

    public double Alto => Y1 - Y0;

    public double CentroX => X0 + (Ancho / 2);

    public bool EsValida => Ancho > 0 && Alto > 0;
}

public readonly record struct CajaContenido(double X0, double Y0, double X1, double Y1)
{
    public double Ancho => X1 - X0;

    public double Alto => Y1 - Y0;

    public bool EsValida => Ancho > 0 && Alto > 0;
}

public readonly record struct EstampaFirma(CajaDibujo CajaFirma, IReadOnlyList<double> LineasBase);

public static class StampGeometry
{
    public static EstampaFirma Calcular(CajaDibujo cajaTexto, PdfSignatureSettings ajustes, int cantidadLineas)
    {
        var firmaX0 = cajaTexto.CentroX - (ajustes.AnchoFirma / 2) + ajustes.DesplazamientoX;
        var firmaY0 = cajaTexto.Y0 + ajustes.DesplazamientoY;
        var cajaFirma = new CajaDibujo(firmaX0, firmaY0, firmaX0 + ajustes.AnchoFirma, firmaY0 + ajustes.AltoFirma);

        var lineas = new List<double>(Math.Max(0, cantidadLineas));
        var y = cajaFirma.Y1 + ajustes.SeparacionTexto;
        for (var i = 0; i < cantidadLineas; i++)
        {
            lineas.Add(y);
            y += ajustes.InterlineadoTexto;
        }

        return new EstampaFirma(cajaFirma, lineas);
    }

    public static CajaDibujo AjustarImagen(double anchoImagen, double altoImagen, CajaDibujo destino)
    {
        if (anchoImagen <= 0 || altoImagen <= 0)
        {
            return destino;
        }

        var escala = Math.Min(destino.Ancho / anchoImagen, destino.Alto / altoImagen);
        var ancho = anchoImagen * escala;
        var alto = altoImagen * escala;
        var x0 = destino.X0 + ((destino.Ancho - ancho) / 2);
        var y0 = destino.Y0 + ((destino.Alto - alto) / 2);

        return new CajaDibujo(x0, y0, x0 + ancho, y0 + alto);
    }

    public static (double Ancho, double Alto) DimensionesVisuales(double anchoContenido, double altoContenido, int rotacion)
    {
        var normalizada = NormalizarRotacion(rotacion);
        return normalizada is 90 or 270
            ? (altoContenido, anchoContenido)
            : (anchoContenido, altoContenido);
    }

    public static CajaDibujo ContenidoAVisual(
        CajaContenido caja,
        double anchoContenido,
        double altoContenido,
        int rotacion)
    {
        var esquinas = new[]
        {
            PuntoAVisual(caja.X0, caja.Y0, anchoContenido, altoContenido, rotacion),
            PuntoAVisual(caja.X1, caja.Y0, anchoContenido, altoContenido, rotacion),
            PuntoAVisual(caja.X0, caja.Y1, anchoContenido, altoContenido, rotacion),
            PuntoAVisual(caja.X1, caja.Y1, anchoContenido, altoContenido, rotacion)
        };

        return new CajaDibujo(
            esquinas.Min(p => p.X),
            esquinas.Min(p => p.Y),
            esquinas.Max(p => p.X),
            esquinas.Max(p => p.Y));
    }

    public static CajaDibujo ContenidoADibujo(CajaContenido caja, double altoContenido) =>
        new(caja.X0, altoContenido - caja.Y1, caja.X1, altoContenido - caja.Y0);

    private static (double X, double Y) PuntoAVisual(
        double x,
        double y,
        double anchoContenido,
        double altoContenido,
        int rotacion) =>
        NormalizarRotacion(rotacion) switch
        {
            90 => (y, x),
            180 => (anchoContenido - x, y),
            270 => (altoContenido - y, anchoContenido - x),
            _ => (x, altoContenido - y)
        };

    private static int NormalizarRotacion(int rotacion)
    {
        var normalizada = rotacion % 360;
        if (normalizada < 0)
        {
            normalizada += 360;
        }

        return normalizada switch
        {
            >= 45 and < 135 => 90,
            >= 135 and < 225 => 180,
            >= 225 and < 315 => 270,
            _ => 0
        };
    }
}
