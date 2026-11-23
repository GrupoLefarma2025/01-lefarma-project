---
fecha_creacion: 2026-11-20
fecha_modificacion: 2026-11-20
resumen: Sustituye la ejecución del script Python de firma de PDF por un motor nativo en C# (PdfPig + PDFsharp + PDFtoImage) con el mismo resultado observable, activable por configuración y reversible con un interruptor.
---

# 00002 — Motor de firma de PDF en C#

## Status

Accepted

> Decisión tomada el 2026-11-20 para que la firma de documentos de SIGMA deje de depender de un
> proceso Python con PyMuPDF y pase a ejecutarse dentro de la API, conservando el mismo resultado
> que produce hoy el script `scripts/pdf_signature_replacer.py`.

## Índice

- [Status](#status)
- [Contexto](#contexto)
- [Decisión](#decisión)
  - [AD-1 — El motor vive en la API y conserva el contrato del runner](#ad-1--el-motor-vive-en-la-api-y-conserva-el-contrato-del-runner)
  - [AD-2 — Mismo resultado observable, no mismos bytes](#ad-2--mismo-resultado-observable-no-mismos-bytes)
  - [AD-3 — Rasterizado para el camino de producción; vectorial sólo sin aplanar](#ad-3--rasterizado-para-el-camino-de-producción-vectorial-sólo-sin-aplanar)
  - [AD-4 — Librerías libres: PdfPig, PDFsharp 6.2.4 y PDFtoImage](#ad-4--librerías-libres-pdfpig-pdfsharp-624-y-pdftoimage)
  - [AD-5 — Interruptor de configuración para revertir sin tocar código](#ad-5--interruptor-de-configuración-para-revertir-sin-tocar-código)
  - [AD-6 — La base de datos y los archivos se mueven igual que antes](#ad-6--la-base-de-datos-y-los-archivos-se-mueven-igual-que-antes)
- [Paridad medida](#paridad-medida)
- [Implementación](#implementación)
- [Validación](#validación)
- [Consecuencias](#consecuencias)
- [Anexo: fuentes](#anexo-fuentes)

## Contexto

El flujo de documentos de SIGMA firma los PDFs aprobados estampando una imagen de firma sobre la
marca `#firmad`, tapa el texto original con un rectángulo blanco, aplana el documento a 250 dpi y
lo protege contra edición con contraseña de propietario. Todo eso lo hace hoy
`lefarma.backend/src/Lefarma.API/scripts/pdf_signature_replacer.py` (664 líneas), que la API lanza
como **proceso externo** con `python` y credenciales por variables de entorno
(`SIGMA_PDF_DB_SERVER`, `SIGMA_PDF_DB_USER`, `SIGMA_PDF_DB_PASSWORD`, `SIGMA_PDF_DB_NAME`).

Ese diseño obliga a tener Python, PyMuPDF y pyodbc instalados en cada servidor donde se publica la
API, deja la lógica crítica fuera del proyecto (sin pruebas, sin tipos y sin revisión de
compilación) y produce PDFs de entre 18 y 36 MB por el PNG sin compresión a 250 dpi. La API ya
tiene Dapper, acceso a `AsokamConnection` y un runner que conoce el contrato de entrada y salida
(`SigmaPdfSignatureRunner`), de modo que el motor puede vivir dentro de la aplicación.

La migración debe resolver cuatro tensiones:

1. **Resultado**: el documento firmado debe verse y comportarse igual (misma posición de la firma,
   mismo aplanado, mismos permisos, misma contraseña de propietario).
2. **Operación**: no puede romper la firma en producción mientras se despliega.
3. **Licencias**: no se puede introducir una licencia copyleft fuerte en un sistema privado.
4. **Base de datos**: las sentencias, las copias de respaldo en disco y los marcadores de error
   forman parte del comportamiento que ya consumen los controladores.

## Decisión

La firma de PDF se ejecuta dentro de la API con un motor en C#, seleccionable por configuración,
que reproduce el comportamiento del script. La ejecución en Python se conserva como respaldo
mientras el motor nuevo se valida en producción.

### AD-1 — El motor vive en la API y conserva el contrato del runner

`SigmaPdfSignatureRunner` sigue siendo el único punto de entrada:
`Task<SigmaPdfSignatureResult> EjecutarAsync(Guid idDocumento, bool soloEscanear, CancellationToken)`.
El runner elige el motor (`csharp` por defecto, `python` como respaldo), aplica el tiempo máximo de
`Sigma:PdfSignature:TimeoutSeconds`, convierte la cancelación en `TimeoutException` y devuelve el
mismo `SigmaPdfSignatureResult(bool PalabraClaveAusente, string Salida)` que ya usan
`PdfSignatureController` al subir, autorizar, rechazar y eliminar documentos. Ningún controlador,
ruta ni componente del frontend cambia.

### AD-2 — Mismo resultado observable, no mismos bytes

El motor reproduce el orden y las reglas del script: buscar `#firmad` en la primera página,
imprimir todos los rectángulos blancos, dibujar la imagen ajustada a la caja de 150 × 50 pt con
desplazamiento (0, −15), escribir `Id: <guid>` y `Fecha: dd/MM/yyyy HH:mm:ss` debajo de la caja,
aplanar a 250 dpi, cifrar y guardar. No se promete identidad byte a byte: el rasterizado, el
antialiasing del texto y el diccionario de cifrado cambian entre PyMuPDF y las librerías de .NET.
La paridad se mide con los criterios del plan aprobado (≤ 2 % de diferencia visual media y caja de
firma ±2 pt) y queda documentada abajo.

### AD-3 — Rasterizado para el camino de producción; vectorial sólo sin aplanar

El backend siempre firma con `flatten_pdf=true`, así que el camino de producción rasteriza las
páginas con PDFtoImage a 250 dpi y dibuja sobre el mapa de bits con SkiaSharp; después arma el PDF
con PDFsharp. El camino vectorial (PDFsharp en modo modificación con `XGraphics`) sólo se usa si
alguna vez se configura `flatten_pdf=false`, porque en ese caso el texto debe seguir siendo
seleccionable.

### AD-4 — Librerías libres: PdfPig, PDFsharp 6.2.4 y PDFtoImage

- **PdfPig 0.1.16** (Apache-2.0) localiza el marcador y da los rectángulos de las letras con la
  línea base, que es lo que MuPDF usa para ubicar la firma.
- **PDFsharp 6.2.4** (MIT) arma el PDF aplanado y aplica AES-256 con permisos.
- **PDFtoImage 5.4.0 + SkiaSharp** (MIT, PDFium) rasteriza a 250 dpi.

Se descartaron **iText 7** (AGPL) y **MuPDF.NET** (comercial). PDFsharp 6.5.0 también se descartó:
su paquete cambió a AGPL-3.0-only y exige registrar una licencia, así que la versión fijada es la
última MIT (6.2.4).

### AD-5 — Interruptor de configuración para revertir sin tocar código

`Sigma:PdfSignature:Motor` acepta `csharp` (por defecto) o `python`. La reversión es cambiar el
valor en `appsettings.json` y reiniciar la API; no hay migración de datos ni cambio de esquema. El
código del motor Python se conserva íntegro en `PythonPdfSignatureEngine`, con los mismos
argumentos, variables de entorno, tiempo máximo y marcadores.

### AD-6 — La base de datos y los archivos se mueven igual que antes

`PdfDocumentStore` ejecuta exactamente las cuatro sentencias del script:
`SELECT PDFBinario, FechaAutorizacion FROM app.Documentos WHERE Id = @Id`,
`UPDATE ... SET Estatus = 2, FechaAutorizacion = GETDATE(), PDFBinarioAutorizado = @Pdf WHERE Id = @Id`,
`UPDATE ... SET Activo = 0 WHERE Id = @Id` y `DELETE FROM app.Documentos WHERE Id = @Id`. Las
copias `<id>.pdf` y `<id>_autorizado.pdf` se escriben en el almacén configurado antes de actualizar
la base, y si el `UPDATE` afecta cero filas se lanza la misma excepción que antes.

### AD-7 — El aplanado dibuja también las anotaciones del PDF

El script usaba `page.get_pixmap` de MuPDF, que dibuja las anotaciones de la página por defecto;
PDFium sólo las dibuja si se le pide. Como los usuarios dejan notas en el PDF (anotaciones
`FreeText` junto a la firma, por ejemplo), `RasterStampRenderer` activa `WithAnnotations = true` y
`WithFormFill = true`. Así la nota sigue viéndose después de autorizar, igual que con el script. El
trazado de la leyenda `Id:`/`Fecha:` no cambia: cae debajo de la firma y, si el documento tiene una
nota justo en esa franja, la leyenda la cruza, que es el mismo resultado que daba el script.

## Paridad medida

Fixtures:

- (a) PDF A4 de dos páginas generado con Arial incrustada, con «Nombre y firma: #firmad» en
  (60, 240) y una segunda página sin marcador.
- (b) El documento real de SIGMA `fbf1ff22-05de-4900-9c13-f3e7e9e6b777.pdf` (1 página apaisada,
  productor jsPDF 4.2.1, fuentes estándar Helvetica, Times, Courier, Symbol y ZapfDingbats sin
  incrustar, marca `#firmad` en Helvetica 7,5 pt).
- (c) El documento real `e870e903-03c5-46d2-b9fa-83e36aeba29f.pdf` (2 páginas carta, Word 2016) con
  dos anotaciones `FreeText` en la página 2, «Nota:» y «Solicitar reunion con Luis…», junto a la
  marca `#firmad`.

Misma imagen `scripts/assets/firma.png` y misma fecha de autorización en ambos motores.

| Comprobación | Sintético | Documento real |
| --- | --- | --- |
| Páginas | 2 / 2 | 1 / 1 |
| Abre sin contraseña | sí | sí |
| Permisos `/P` | −3388 | −3388 |
| Texto extraíble | no (aplanado) | no (aplanado) |
| Diferencia media de píxeles | 0,25 / 255 | 1,61 / 255 |
| Píxeles con diferencia > 24 | 0,33 % | 2,22 % |
| Caja de tinta de firma y leyendas | ±0 pt | ±0 pt (idéntica al píxel, recorte a 3×) |

En el documento real la diferencia de píxeles no viene de la posición de la firma sino del tamaño
del raster: PyMuPDF redondea la página a 2924 × 2067 px y PDFium a 2923 × 2066, así que al comparar
los dos PDFs completos cada borde de texto se remuestrea con un desplazamiento subpíxel. Al recortar
la zona de la firma y las leyendas y renderizarla a 3× con el mismo motor, las cajas de tinta
coinciden exactamente (Δ 0,00 pt en los cuatro bordes).

Las fuentes estándar sin incrustar (base 14) se miden con la tabla `AscensosBase14` de
`PdfTextLocator` (catorce valores medidos contra PyMuPDF 1.27.1), porque MuPDF no usa el rectángulo
del glifo sino sus propias métricas. Con eso la caja cae donde cae con el script también en los
documentos jsPDF que hoy usa Lefarma.

En (c), firmado con los dos motores y recortado el mismo trozo, la nota azul aparece en ambos y la
página 2 queda sin texto extraíble; la leyenda `Id:`/`Fecha:` cruza la nota en los dos casos porque
el documento la coloca justo debajo de la firma. La diferencia media medida en esa página (muestreo
del raster a 200 dpi) es 0,45/255, del mismo orden que el remuestreo de los otros casos.

## Implementación

Carpeta `lefarma.backend/src/Lefarma.API/Features/Sigma/Services/PdfSignature/`:

- `PdfSignatureSettings.cs` — constantes del estampado (150 × 50, márgenes, 250 dpi, contraseña).
- `StampGeometry.cs` — cálculo puro de la caja, ajuste de la imagen, conversión de coordenadas y
  rotaciones 0/90/180/270.
- `PdfTextLocator.cs` — búsqueda del marcador con PdfPig y armado de la caja de texto.
- `IPdfStampRenderer.cs` — contrato de estampado.
- `RasterStampRenderer.cs` — camino de producción (PDFtoImage + SkiaSharp + PDFsharp).
- `VectorStampRenderer.cs` — camino sin aplanar (PDFsharp en modo modificación).
- `PdfProtector.cs` — AES-256 V5 y permisos.
- `IPdfDocumentStore.cs` / `PdfDocumentStore.cs` — las cuatro sentencias y las copias en disco.
- `CSharpPdfSignatureEngine.cs` — orquesta la firma y devuelve los marcadores del script.
- `PdfSignatureMessages.cs` — `ERROR_KEYWORD_NOT_FOUND`, `KEYWORD_FOUND` y «Proceso completado
  exitosamente.».
- `PythonPdfSignatureEngine.cs` — el motor anterior, movido sin cambios.

Se modifican `SigmaPdfSignatureRunner.cs` (fachada), `SigmaPdfSignatureOptions.cs` (`Motor`),
`Program.cs` (registros de DI), `appsettings.json` (`Motor`) y el `.csproj` (tres paquetes).

## Validación

- `dotnet build` de la API: 0 errores.
- `dotnet test --filter "FullyQualifiedName~PdfSignature"`: 26 pruebas correctas (geometría,
  localizador —incluida la medición de fuentes estándar— y motor completo con almacén falso:
  firmado, escaneo, marcador ausente, documento inexistente, cifrado y ausencia de texto
  extraíble).
- Paridad con el script real: la tabla de arriba.
- Notas del PDF: con el documento (c) se renderiza la página 2 con y sin `WithAnnotations`; sin la
  opción la nota desaparece y con ella aparece, y el resultado firmado coincide con el del script.
- Humo en desarrollo: subir, autorizar, descargar y abrir el PDF con el motor C# (documento
  sintético, 16 s de extremo a extremo y ~1,5 s de firma real).
- Publicación `win-x64`: `pdfium.dll` y `libSkiaSharp.dll` quedan junto al ejecutable y no se copian
  binarios de otras plataformas.

## Consecuencias

- **Positivas**: la firma deja de depender de Python, PyMuPDF y pyodbc en los servidores; la lógica
  entra al proyecto con tipos, compilación y pruebas; el fixture de dos páginas firma en menos de un
  segundo y el PDF resultante pesa menos (146 KB frente a 36 MB). El documento real de 18,1 MB se
  firma en ~1,5 s y el resultado pesa 243 KB (el script guardaba el raster sin comprimir), muy lejos
  del límite de 120 s; en la base de datos el blob firmado se reduce en la misma proporción.
- **Negativas**: se agregan tres dependencias NuGet y binarios nativos de PDFium que hay que
  verificar en cada publicación; el PDF no es idéntico byte a byte al que producía el script, así
  que la comparación periódica debe hacerse con la métrica de la tabla. El publicador actual
  (`dotnet publish -c Release --self-contained false`, sin RID) copia los binarios nativos de
  Windows, Linux y macOS; conviene añadir `-r win-x64` al comando de publicación para no arrastrar
  ~200 MB de librerías de otras plataformas (los scripts de despliegue tendrían que apuntar a la
  nueva subcarpeta).
- **Neutras**: la contraseña de propietario, la marca `#firmad`, el tamaño de la firma, los dpi y
  las rutas de almacenamiento no cambian; los documentos ya firmados no se tocan.
- **Riesgos y mitigación**: si el localizador no encuentra el marcador, el comportamiento es el del
  script (borrar en escaneo, desactivar en firma); si un PDF protegido o rotado se comporta distinto,
  la reversión es `Motor=python`.

## Anexo: fuentes

- `lefarma.backend/src/Lefarma.API/scripts/pdf_signature_replacer.py` (script vigente, 664 líneas).
- `lefarma.backend/src/Lefarma.API/Features/Sigma/Services/SigmaPdfSignatureRunner.cs` (contrato
  actual del proceso externo).
- `lefarma.backend/src/Lefarma.API/Features/Sigma/Controllers/PdfSignatureController.cs`
  (subida, autorización, rechazo y validación pública).
- Documentación de paquetes: PdfPig 0.1.16 (`Letter.GlyphRectangleLoose`, `StartBaseLine`),
  PDFsharp 6.2.4 (`SecurityHandler.SetEncryption`, `PdfDefaultEncryption.V5`), PDFtoImage 5.4.0
  (`Conversion.ToImages`, `RenderOptions.Dpi`).
- Prueba de paridad reproducible: PDF sintético con Arial incrustada, ejecución del script real por
  `importlib` y comparación de píxeles a 72 y 110 dpi (procedimiento descrito en esta decisión).
