namespace Lefarma.API.Features.Sigma.Services.PdfSignature;

/// <summary>
/// Rectángulo en coordenadas de dibujo (origen arriba a la izquierda, y hacia abajo),
/// que es el sistema que usan tanto el lienzo rasterizado como PDFsharp.
/// </summary>
public readonly record struct CajaDibujo(double X0, double Y0, double X1, double Y1)
{
    public double Ancho => X1 - X0;

    public double Alto => Y1 - Y0;

    public double CentroX => X0 + (Ancho / 2);

    public bool EsValida => Ancho > 0 && Alto > 0;
}

/// <summary>Rectángulo en coordenadas del contenido del PDF (origen abajo a la izquierda).</summary>
public readonly record struct CajaContenido(double X0, double Y0, double X1, double Y1)
{
    public double Ancho => X1 - X0;

    public double Alto => Y1 - Y0;

    public bool EsValida => Ancho > 0 && Alto > 0;
}

/// <summary>Caja de la firma y línea base de cada línea de texto, en coordenadas de dibujo.</summary>
public readonly record struct EstampaFirma(CajaDibujo CajaFirma, IReadOnlyList<double> LineasBase);

/// <summary>
/// Geometría del estampado. Es pura a propósito: las pruebas comparan los números
/// contra el cálculo del script de Python sin abrir un PDF.
/// </summary>
public static class StampGeometry
{
    /// <summary>
    /// Calcula la caja de la firma y las líneas base del texto con las mismas reglas
    /// que <c>pdf_signature_replacer.py</c>: centro horizontal del texto, borde
    /// superior del texto más el desplazamiento, y texto debajo de la firma.
    /// </summary>
    /// <param name="cajaTexto">Caja del texto encontrado, en coordenadas de dibujo.</param>
    /// <param name="ajustes">Medidas del estampado.</param>
    /// <param name="cantidadLineas">Líneas de texto que se dibujan debajo de la firma.</param>
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

    /// <summary>
    /// Ajusta la imagen dentro de la caja conservando su proporción y centrándola,
    /// igual que <c>insert_image(..., keep_proportion=True)</c> de PyMuPDF.
    /// </summary>
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

    /// <summary>
    /// Dimensiones visibles de una página según su rotación. PyMuPDF entrega la página
    /// ya rotada; PdfPig entrega el tamaño sin rotar.
    /// </summary>
    public static (double Ancho, double Alto) DimensionesVisuales(double anchoContenido, double altoContenido, int rotacion)
    {
        var normalizada = NormalizarRotacion(rotacion);
        return normalizada is 90 or 270
            ? (altoContenido, anchoContenido)
            : (anchoContenido, altoContenido);
    }

    /// <summary>
    /// Convierte una caja del contenido del PDF (y hacia arriba) a coordenadas visibles
    /// (y hacia abajo), aplicando la rotación de la página como lo hace el visor.
    /// </summary>
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

    /// <summary>
    /// Convierte una caja del contenido a coordenadas de dibujo sobre la página sin rotar
    /// (camino vectorial): sólo invierte el eje vertical.
    /// </summary>
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
