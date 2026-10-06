#!/usr/bin/env python3
"""
PDF Signature Replacer - Reemplaza texto con imagen de firma en PDFs

Uso:
    python pdf_signature_replacer.py [parametros]

Parámetros opcionales (formato: clave=valor):
    id_pdf=GUID-DEL-DOCUMENTO (obtiene el PDF desde la BD)
    db_name=nombre_base_datos (por defecto: ASOKAM)
    image_path=ruta/a/firma.png
    output_path=ruta/salida.pdf (opcional, si no se especifica actualiza la BD)
    search_text=texto_a_buscar
    scan_only=1/0 (1=solo escanear, 0=proceso completo)
    signature_width=150
    signature_height=50
    offset_x=0
    offset_y=-15
    cover_padding=3
    update_db=true/false (si es true, actualiza PDFBinarioAutorizado en la BD)
    allow_print=true/false (permite restringir la impresión; por defecto true)
    flatten_pdf=true/false (convierte cada página a imagen para evitar ediciones; por defecto true)
    flatten_dpi=144 (resolución usada al aplanar)

Ejemplo:
    python pdf_signature_replacer.py id_pdf=22D976C3-2B13-41A8-8729-EFD929C081B0 signature_width=200
    python pdf_signature_replacer.py id_pdf=22D976C3-2B13-41A8-8729-EFD929C081B0 scan_only=1
"""

import pathlib
import sys
import fitz  # PyMuPDF
from pathlib import Path
import pyodbc
from io import BytesIO
from datetime import datetime
import secrets

# ============================================================================
# CONFIGURACIÓN POR DEFECTO - Se usarán si no se pasan parámetros
# ============================================================================

# Configuración de la base de datos
DB_SERVER = "192.168.4.2"
DB_USER = "poweru"
DB_PASSWORD = "cGuzman$$001#"
DB_NAME = "Asokam"  # Ajustar según el nombre de tu base de datos

# Obtener el directorio donde reside este script, no el CWD
SCRIPT_DIR = pathlib.Path(__file__).parent.resolve()

# Rutas de archivos
DEFAULT_ID_PDF = None  # Si no se especifica, usa modo archivo
DEFAULT_IMAGE_PATH = SCRIPT_DIR / "assets" / "firma.png"
DEFAULT_OUTPUT_PATH = None  # Si es None y hay id_pdf, actualiza la BD
DEFAULT_SEARCH_TEXT = "#firmad"
DEFAULT_UPDATE_DB = True  # Por defecto actualiza la BD si se usa id_pdf

# Configuración de la firma
DEFAULT_SIGNATURE_WIDTH = 150       # Ancho de la firma
DEFAULT_SIGNATURE_HEIGHT = 50       # Alto de la firma
DEFAULT_OFFSET_X = 0                # Desplazamiento horizontal desde el inicio del texto
DEFAULT_OFFSET_Y = -15              # Desplazamiento vertical desde el texto (negativo = arriba)
DEFAULT_COVER_PADDING = 3           # Padding para los rectángulos de cobertura
DEFAULT_SCAN_ONLY = False           # Por defecto no es solo escaneo
DEFAULT_OWNER_PASSWORD = "SignerLock2025!"  # Contraseña fija para proteger PDFs
DEFAULT_ALLOW_PRINT = True          # Permitir impresión por defecto
DEFAULT_FLATTEN_PDF = False          # Aplanar páginas a imágenes para evitar edición
DEFAULT_FLATTEN_DPI = 110          # DPI al aplanar (144 ≈ 2x de 72)
DEFAULT_STORAGE_DIR = Path(r"D:\InepubPruebas\Documentos")  # Carpeta para respaldos locales

# ============================================================================

def parse_args(args):
    """
    Convierte los argumentos de línea de comandos (key=value) en un diccionario.
    """
    params = {}
    # Ignoramos args[0], que es el nombre del script.
    for arg in args[1:]:
        if '=' in arg:
            # Dividimos solo en el primer '=' para manejar valores que contienen '='
            key, value = arg.split('=', 1)
            params[key] = value
    return params

def get_config_from_params(params):
    """
    Obtiene la configuración desde los parámetros o usa valores por defecto.
    Convierte los valores numéricos de string a int/float.
    """
    update_db_str = params.get('update_db', str(DEFAULT_UPDATE_DB)).lower()
    update_db = update_db_str in ('true', '1', 'yes', 'si', 's')
    
    scan_only_str = params.get('scan_only', str(DEFAULT_SCAN_ONLY)).lower()
    scan_only = scan_only_str in ('true', '1', 'yes', 'si', 's')

    config = {
        'id_pdf': params.get('id_pdf', DEFAULT_ID_PDF),
        'db_name': params.get('db_name', DB_NAME),
        'image_path': params.get('image_path', DEFAULT_IMAGE_PATH),
        'output_path': params.get('output_path', DEFAULT_OUTPUT_PATH),
        'search_text': params.get('search_text', DEFAULT_SEARCH_TEXT),
        'update_db': update_db,
        'scan_only': scan_only,
        'signature_width': int(params.get('signature_width', DEFAULT_SIGNATURE_WIDTH)),
        'signature_height': int(params.get('signature_height', DEFAULT_SIGNATURE_HEIGHT)),
        'offset_x': float(params.get('offset_x', DEFAULT_OFFSET_X)),
        'offset_y': float(params.get('offset_y', DEFAULT_OFFSET_Y)),
        'cover_padding': int(params.get('cover_padding', DEFAULT_COVER_PADDING)),
        'allow_print': params.get('allow_print', str(DEFAULT_ALLOW_PRINT)).lower() in ('true', '1', 'yes', 'si', 's'),
        'flatten_pdf': params.get('flatten_pdf', str(DEFAULT_FLATTEN_PDF)).lower() in ('true', '1', 'yes', 'si', 's'),
        'flatten_dpi': int(params.get('flatten_dpi', DEFAULT_FLATTEN_DPI))
    }
    return config

def get_db_connection(db_name=None):
    """Establece conexión con SQL Server"""
    database = db_name if db_name else DB_NAME
    connection_string = (
        f"DRIVER={{ODBC Driver 17 for SQL Server}};"
        f"SERVER={DB_SERVER};"
        f"DATABASE={database};"
        f"UID={DB_USER};"
        f"PWD={DB_PASSWORD}"
    )
    return pyodbc.connect(connection_string)

def get_pdf_from_database(id_pdf, db_name=None):
    """Obtiene el PDF binario y la fecha de autorización desde la base de datos"""
    conn = get_db_connection(db_name)
    cursor = conn.cursor()

    query = "SELECT PDFBinario, FechaAutorizacion FROM app.Documentos WHERE Id = ?"
    cursor.execute(query, id_pdf)

    row = cursor.fetchone()
    cursor.close()
    conn.close()

    if row is None:
        raise Exception(f"No se encontró el documento con ID: {id_pdf}")

    if row[0] is None:
        raise Exception(f"El documento con ID {id_pdf} no tiene PDFBinario")

    # Retorna tanto el PDF como la fecha de autorización
    # Si no hay fecha aún, retorna None
    return row[0], row[1]

def update_pdf_in_database(id_pdf, pdf_bytes, db_name=None):
    """Actualiza el PDFBinarioAutorizado en la base de datos"""
    conn = get_db_connection(db_name)
    cursor = conn.cursor()

    query = "UPDATE app.Documentos SET Estatus = 2,FechaAutorizacion =GETDATE(), PDFBinarioAutorizado = ? WHERE Id = ?"
    cursor.execute(query, pdf_bytes, id_pdf)

    conn.commit()
    rows_affected = cursor.rowcount
    cursor.close()
    conn.close()

    if rows_affected == 0:
        raise Exception(f"No se pudo actualizar el documento con ID: {id_pdf}")

    return True

def update_document_inactive(id_pdf, db_name=None):
    """Marca el documento como inactivo en la base de datos"""
    conn = get_db_connection(db_name)
    cursor = conn.cursor()

    query = "UPDATE app.Documentos SET Activo = 0 WHERE Id = ?"
    cursor.execute(query, id_pdf)

    conn.commit()
    rows_affected = cursor.rowcount
    cursor.close()
    conn.close()

    return rows_affected > 0

def delete_document_from_database(id_pdf, db_name=None):
    """Elimina completamente el documento de la base de datos"""
    conn = get_db_connection(db_name)
    cursor = conn.cursor()

    query = "DELETE FROM app.Documentos WHERE Id = ?"
    cursor.execute(query, id_pdf)

    conn.commit()
    rows_affected = cursor.rowcount
    cursor.close()
    conn.close()

    return rows_affected > 0

def find_text_instances(page, search_text):
    """Encuentra todas las instancias de un texto en la página"""
    text_instances = page.search_for(search_text)
    return text_instances

def scan_for_text(pdf_source, search_text):
    """
    Escanea el PDF solo para verificar si contiene el texto buscado
    
    Args:
        pdf_source: Puede ser una ruta de archivo (str) o bytes del PDF
        search_text: Texto a buscar
    
    Returns:
        tuple: (None, bool indicando si se encontró el texto)
    """
    # Abrir el PDF (desde archivo o desde bytes)
    if isinstance(pdf_source, bytes):
        pdf_document = fitz.open(stream=pdf_source, filetype="pdf")
    else:
        pdf_document = fitz.open(pdf_source)

    found = False

    # Buscar el texto en todas las páginas
    for page_num in range(len(pdf_document)):
        page = pdf_document[page_num]
        text_instances = find_text_instances(page, search_text)
        
        if text_instances:
            found = True
            break  # Ya encontramos el texto, no necesitamos seguir buscando

    pdf_document.close()
    return None, found
def replace_text_with_image(pdf_source, image_path, search_text, config, id_pdf=None, fecha_autorizacion=None):
    """
    Reemplaza el texto con una imagen en el PDF y agrega UUID y fecha debajo.
    Elimina definitivamente el texto (#firmad) del contenido PDF.
    """

    # Abrir el PDF (desde archivo o bytes)
    pdf_document = fitz.open(stream=pdf_source, filetype="pdf") if isinstance(pdf_source, bytes) else fitz.open(pdf_source)

    found = False

    for page_num in range(len(pdf_document)):
        page = pdf_document[page_num]
        text_instances = find_text_instances(page, search_text)
        rotation = page.rotation
        # print(f"Página {page.number}: rotación = {rotation}")
        if not text_instances:
            continue

        found = True

        # 🔹 Eliminar el texto "#firmad" físicamente sin cubrirlo con color visible
        for inst in text_instances:
            x0, y0, x1, y1 = inst
            padding = config['cover_padding']
            erase_rect = fitz.Rect(x0 - padding, y0 - padding, x1 + padding, y1 + padding)
            # Agrega anotación de redacción transparente (sin color)
            # 🔹 Crea redacción sin color visible (None = completamente transparente)
            page.add_redact_annot(erase_rect, fill=None)
            # 🔸 Aplica y elimina físicamente el texto sin dibujar rectángulo
            page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE)
        # Aplica la redacción (borra el texto físicamente)
        page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE)

        # 🔸 Coloca la firma encima
        for inst in text_instances:
            x0, y0, x1, y1 = inst
            text_width = x1 - x0
            text_center_x = x0 + text_width / 2

            firma_center_offset = config['signature_width'] / 2
            firma_x0 = text_center_x - firma_center_offset + config['offset_x']
            firma_y0 = y0 + config['offset_y']
            firma_x1 = firma_x0 + config['signature_width']
            firma_y1 = firma_y0 + config['signature_height']

            image_rect = fitz.Rect(firma_x0, firma_y0, firma_x1, firma_y1)
            page.insert_image(
                image_rect,
                filename=image_path,
                keep_proportion=True,
                overlay=True,
                rotate=rotation
            )

            # Agregar UUID y fecha debajo
            # === Agregar UUID y fecha ===
            if rotation == 90:
                if id_pdf or fecha_autorizacion:
                    font_size = 8
                    text_offset_x = config['signature_height'] + 44
                    text_offset_y = config['signature_width'] / 2 

                    if id_pdf:
                        page.insert_text(
                            (firma_x0 + text_offset_x, firma_y0 + text_offset_y),
                            f"Id: {id_pdf}",
                            fontsize=font_size,
                            color=(0, 0, 0),
                            fontname="helv",
                            rotate=rotation
                        )

                    if fecha_autorizacion:
                        fecha_str = (
                            fecha_autorizacion.strftime("%d/%m/%Y %H:%M:%S")
                            if isinstance(fecha_autorizacion, datetime)
                            else str(fecha_autorizacion)
                        )
                        # movemos un poco más hacia la derecha la segunda línea
                        page.insert_text(
                            (firma_x0 + text_offset_x + font_size + 2, firma_y0 + text_offset_y),
                            f"Fecha: {fecha_str}",
                            fontsize=font_size,
                            color=(0, 0, 0),
                            fontname="helv",
                            rotate=rotation
                        )
            else:
                # Agregar UUID y fecha debajo
                if id_pdf or fecha_autorizacion:
                    font_size = 8
                    y_text = firma_y1 + 2
                    if id_pdf:
                        page.insert_text(
                            (firma_x0, y_text),
                            f"Id: {id_pdf}",
                            fontsize=font_size,
                            color=(0, 0, 0),
                            fontname="helv"
                        )
                        y_text += font_size + 2
                    if fecha_autorizacion:
                        fecha_str = fecha_autorizacion.strftime("%d/%m/%Y %H:%M:%S") if isinstance(fecha_autorizacion, datetime) else str(fecha_autorizacion)
                        page.insert_text(
                            (firma_x0, y_text),
                            f"Fecha: {fecha_str}",
                            fontsize=font_size,
                            color=(0, 0, 0),
                            fontname="helv"
                        )


    # Si no se encontró el texto, salir
    if not found:
        pdf_document.close()
        return None, False

    # 🔹 Guardar y limpiar todo rastro del texto eliminado
    pdf_bytes = pdf_document.write(garbage=4, deflate=True, incremental=False)
    pdf_document.close()

    return pdf_bytes, True


def flatten_pdf_content(pdf_bytes, dpi=DEFAULT_FLATTEN_DPI):
    """
    Convierte cada página en una imagen embebida para evitar futuras ediciones.

    Args:
        pdf_bytes: Bytes del PDF listo para aplanar.
        dpi: Resolución usada al rasterizar.

    Returns:
        bytes: PDF con todo el contenido aplanado.
    """
    source_doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    flattened_doc = fitz.open()

    zoom = max(dpi, 72) / 72  # Garantiza un factor mínimo de 1
    matrix = fitz.Matrix(zoom, zoom)

    for page_index in range(len(source_doc)):
        page = source_doc[page_index]
        pix = page.get_pixmap(matrix=matrix, alpha=False)

        new_page = flattened_doc.new_page(width=page.rect.width, height=page.rect.height)

        # Usar pil_tobytes con formato PNG explícito para mejor compatibilidad
        img_bytes = pix.pil_tobytes(format="PNG")

        new_page.insert_image(
            new_page.rect,
            stream=img_bytes,
            keep_proportion=False,
            overlay=False
        )

    # Copiar metadatos básicos para mantener contexto del documento
    flattened_doc.set_metadata(source_doc.metadata)

    flattened_bytes = flattened_doc.write()
    source_doc.close()
    flattened_doc.close()

    return flattened_bytes

def save_document_copy(id_pdf, data_bytes, suffix=""):
    """
    Guarda una copia del PDF en la ruta configurada usando el ID del documento.

    Args:
        id_pdf: Identificador del documento.
        data_bytes: Contenido binario a guardar.
        suffix: Sufijo opcional para el nombre del archivo (ej. "_autorizado").
    """
    if not id_pdf:
        return
    try:
        DEFAULT_STORAGE_DIR.mkdir(parents=True, exist_ok=True)
        filename = f"{id_pdf}{suffix}.pdf"
        target_path = DEFAULT_STORAGE_DIR / filename
        with open(target_path, "wb") as file:
            file.write(bytes(data_bytes))
    except Exception as exc:
        print(
            f"ADVERTENCIA: No se pudo guardar '{filename}' en '{DEFAULT_STORAGE_DIR}': {exc}"
        )

def lock_pdf_against_edits(pdf_bytes, owner_password=None, allow_print=True):
    """
    Aplica cifrado y restringe modificaciones al PDF resultante.

    Args:
        pdf_bytes: Bytes del PDF sin protección.
        owner_password: Contraseña de propietario para futuras modificaciones.
        allow_print: Permitir o no la impresión del PDF.

    Returns:
        tuple: (bytes protegidos, contraseña utilizada)
    """
    document = fitz.open(stream=pdf_bytes, filetype="pdf")
    permissions = fitz.PDF_PERM_ACCESSIBILITY
    if allow_print:
        permissions |= fitz.PDF_PERM_PRINT

    password_to_use = owner_password or secrets.token_urlsafe(16)
    protected_bytes = document.write(
        encryption=fitz.PDF_ENCRYPT_AES_256,
        owner_pw=password_to_use,
        user_pw="",
        permissions=permissions
    )
    document.close()
    return protected_bytes, password_to_use

def main():
    # 1. Parsear los argumentos pasados por línea de comandos
    params = parse_args(sys.argv)

    # 2. Obtener configuración desde parámetros o usar valores por defecto
    config = get_config_from_params(params)

    # 3. Extraer las rutas y parámetros principales
    id_pdf = config['id_pdf']
    db_name = config['db_name']
    image_path = config['image_path']
    output_path = config['output_path']
    search_text = config['search_text']
    update_db = config['update_db']
    scan_only = config['scan_only']
    allow_print = config['allow_print']
    flatten_pdf = config['flatten_pdf']
    flatten_dpi = config['flatten_dpi']
    owner_password = DEFAULT_OWNER_PASSWORD  # Usamos la constante interna siempre

    # # 4. Mostrar configuración actual
    # print("=== Configuración ===")
    # if id_pdf:
    #     print(f"ID PDF: {id_pdf}")
    #     print(f"Base de datos: {db_name}")
    #     print(f"Actualizar BD: {update_db}")
    # print(f"Imagen: {image_path}")
    # if output_path:
    #     print(f"Salida: {output_path}")
    # print(f"Buscar texto: {search_text}")
    # print(f"Tamaño firma: {config['signature_width']}x{config['signature_height']}")
    # print(f"Offset: x={config['offset_x']}, y={config['offset_y']}")
    # print(f"Padding: {config['cover_padding']}")
    # print("=" * 20 + "\n")

    # 5. Verificar que la imagen existe (solo si no es scan_only)
    if not scan_only and not Path(image_path).exists():
        print(f"Error: El archivo de imagen no existe: {image_path}")
        sys.exit(1)

    try:
        # 6. Obtener el PDF (desde BD o archivo)
        fecha_autorizacion = None
        if id_pdf:
            # print(f"Modo: Base de datos (ID: {id_pdf})")
            pdf_bytes, fecha_autorizacion = get_pdf_from_database(id_pdf, db_name)
            pdf_source = pdf_bytes
            save_document_copy(id_pdf, pdf_bytes, suffix="")
        else:
            print(f"Error: Debes especificar id_pdf")
            sys.exit(1)

        # 7. Procesar el PDF
        if scan_only:
            # Modo escaneo: solo verificar si existe el texto
            modified_pdf_bytes, text_found = scan_for_text(pdf_source, search_text)
        else:
            # Modo normal: reemplazar texto con imagen
            # Si no hay fecha de autorización aún, usar la fecha actual
            if fecha_autorizacion is None:
                fecha_autorizacion = datetime.now()

            modified_pdf_bytes, text_found = replace_text_with_image(
                pdf_source, image_path, search_text, config,
                id_pdf=id_pdf, fecha_autorizacion=fecha_autorizacion
            )

        # 8. Verificar si se encontró el texto
        if not text_found:
            # Si es scan_only, eliminar el documento completamente
            if scan_only:
                delete_document_from_database(id_pdf, db_name)
            else:
                # Si no es scan_only, marcar documento como inactivo
                update_document_inactive(id_pdf, db_name)
            print("ERROR_KEYWORD_NOT_FOUND")
            return

        # 9. Si es scan_only, solo retornar que se encontró
        if scan_only:
            print("KEYWORD_FOUND")
            return

        # 9.1 Proteger el PDF contra modificaciones antes de guardarlo
        # Primero aplanar (convertir a imágenes) si está habilitado
        if flatten_pdf:
            modified_pdf_bytes = flatten_pdf_content(modified_pdf_bytes, dpi=flatten_dpi)

        # Luego aplicar encriptación y restricciones
        protected_pdf_bytes, _ = lock_pdf_against_edits(
            modified_pdf_bytes,
            owner_password=owner_password,
            allow_print=allow_print
        )
        modified_pdf_bytes = protected_pdf_bytes
        save_document_copy(id_pdf, modified_pdf_bytes, suffix="_autorizado")

        # 10. Guardar el resultado si se encontró el texto (solo en modo normal)
        if update_db and id_pdf:
            # Actualizar en la base de datos
            update_pdf_in_database(id_pdf, modified_pdf_bytes, db_name)

        if output_path:
            # Guardar también como archivo
            with open(output_path, 'wb') as f:
                f.write(modified_pdf_bytes)
    except Exception as e:
        print(f"\n✗ Error al procesar el PDF: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
    print("Proceso completado exitosamente.")
