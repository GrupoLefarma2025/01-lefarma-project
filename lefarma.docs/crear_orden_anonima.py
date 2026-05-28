"""
================================================================================
SCRIPT DE ORDENES DE COMPRA - LEFARMA API EXTERNA
================================================================================

Este script permite interactuar con el backend de Lefarma (.NET) para realizar
operaciones de órdenes de compra, firmas y comprobantes sin usar la interfaz web.

Se ejecuta desde Stored Procedures SQL u otros sistemas externos.
AUTENTICACIÓN:
  - Se usa API Key (X-API-Key) + User ID (X-User-Id) en headers.
  - La API Key es general para todos los clientes externos.
  - El User ID identifica al usuario real que opera (para trazabilidad).

ACCIONES DISPONIBLES:
  1. CREAR          → Crea una nueva orden de compra.
  2. EDITAR         → Edita una orden existente (reemplaza todas las partidas).
  3. FIRMAR         → Ejecuta una acción de firma/avance en el workflow.
                      Opcionalmente puede subir comprobantes antes de firmar.
  4. SUBIR_COMPROBANTE → Sube un comprobante (gasto/pago) y opcionalmente
                          asigna partidas, sin firmar la orden.
  5. SUBIR_ADJUNTO  → Sube un archivo adjunto genérico a una orden de compra
                      (similar al botón "Adjuntar" en el tab Archivos).

CONFIGURACIÓN:
  - Editá las constantes de este archivo para valores por defecto.
  - Si una constante está en None, el script fallará con error.

================================================================================
"""

import requests
import json
import sys
import os

# ============================================================
# CONFIGURACIÓN GLOBAL
# ============================================================

BASE_URL = "http://200.94.77.190:5074/cxP"  # URL del backend Lefarma
API_KEY = "lefarma-api-key-2026"  # API Key general (misma para todos)
ANONYMOUS_USER_ID = 25  # ID del usuario que opera (trazabilidad)

# ============================================================
# SELECCIÓN DE ACCIÓN
# ============================================================
# ACCIÓN: 'CREAR' | 'EDITAR' | 'FIRMAR' | 'SUBIR_COMPROBANTE' | 'SUBIR_ADJUNTO'
ACCION_SCRIPT = "EDITAR"

# ============================================================
# 1. VARIABLES PARA CREAR ORDEN
# ============================================================
# Se usan también en EDITAR (se reutilizan todas excepto ID_ORDEN).

ID_EMPRESA = 7  # REQUERIDO. Tabla: catalogos.empresas
ID_SUCURSAL = 6  # REQUERIDO. Tabla: catalogos.sucursales
ID_AREA = 11  # REQUERIDO. Tabla: catalogos.areas
ID_TIPO_GASTO = 1  # REQUERIDO. Tabla: catalogos.tipos_gasto
FECHA_LIMITE_PAGO = "2026-06-20"  # REQUERIDO. Formato: YYYY-MM-DD
ID_MONEDA = 1  # REQUERIDO. 1=MXN. Tabla: catalogos.monedas
TIPO_CAMBIO = 1.0  # OPCIONAL. 1.0 para MXN
ID_PROVEEDOR = 14  # REQUERIDO. Tabla: catalogos.proveedores
SIN_DATOS_FISCALES = False  # OPCIONAL. True = no requiere factura
REQUIERE_PAGO_ANTICIPADO = False  # OPCIONAL. True = requiere pago anticipado
NOTA_FORMA_PAGO = ""  # OPCIONAL. Nota sobre forma de pago
NOTAS_GENERALES = ""  # OPCIONAL. Notas generales visibles
IDS_CUENTAS_BANCARIAS = [98]  # REQUERIDO. Tabla: catalogos.proveedor_forma_pago_cuentas
IDS_FORMA_PAGO = [6]  # REQUERIDO. Tabla: catalogos.formas_pago
NUMERO_MENSUALIDADES = 1  # OPCIONAL. 1 = pago único

# REQUERIDO — Partidas (líneas) de la orden. Al menos una.
# Campos de cada partida:
#   descripcion      — REQUERIDO. Descripción del concepto
#   cantidad         — REQUERIDO. Cantidad solicitada
#   idUnidadMedida   — REQUERIDO. Tabla: catalogos.unidades_medida
#   precioUnitario   — REQUERIDO. Precio por unidad (sin IVA)
#   descuento        — OPCIONAL. Monto de descuento (default 0)
#   porcentajeIva    — REQUERIDO. % IVA (ej: 16.0). Tabla: catalogos.tipos_impuesto
#   totalRetenciones — OPCIONAL. Monto de retenciones (default 0)
#   otrosImpuestos   — OPCIONAL. Otros impuestos IEPS etc. (default 0)
#   requiereFactura  — OPCIONAL. True = requiere comprobante (default True)
#   deducible        — OPCIONAL. True = deducible de impuestos (default True)
#   idProveedor      — OPCIONAL. None = usa ID_PROVEEDOR de cabecera
#   idCuentaBancaria — OPCIONAL. None = usa IDS_CUENTAS_BANCARIAS
PARTIDAS = [
    {
        "descripcion": "Producto de pruebasss",
        "cantidad": 2,
        "idUnidadMedida": 1,
        "precioUnitario": 100.0,
        "descuento": 0.0,
        "porcentajeIva": 16.0,
        "totalRetenciones": 0.0,
        "otrosImpuestos": 0.0,
        "requiereFactura": True,
        "deducible": True,
        "idProveedor": None,
        "idCuentaBancaria": None,
    }
]

# ============================================================
# 2. VARIABLES PARA EDITAR / FIRMAR / SUBIR_ARCHIVO
# ============================================================
# REQUERIDO — ID de la orden.
# Tabla: operaciones.ordenes_compra
# Se usa en: EDITAR, FIRMAR y SUBIR_ADJUNTO y SUBIR_COMPROBANTE (para relacionar comprobante con orden).
ID_ORDEN = 136

# ============================================================
# 3. VARIABLES PARA FIRMAR ORDEN
# ============================================================
# NOTA: Se usa la misma variable ID_ORDEN de la sección EDITAR.

# REQUERIDO — ID de la acción de firma. Tabla: config.workflow_acciones
# Ejemplo: 1=Enviar, 20=Autorizar, 21=Rechazar, etc.
ID_ACCION_FIRMAR = 22

# OPCIONAL — Comentario de la firma.
# REQUERIDO si la acción es RECHAZAR o DEVOLVER.
COMENTARIO_FIRMAR = "primer comentario sistemas"

# OPCIONAL — Datos adicionales según los handlers configurados en la acción.
# Los handlers se configuran por acción en el workflow y pueden variar.
# Consulta los handlers de la acción para saber qué datos requiere.
#
# Ejemplos de handlers comunes:
#   Field (campo) → {"nombre_campo": "valor"} (ej: {"centro_costo": "5"})
#   Document → No requiere datos adicionales (valida comprobantes subidos)
#   ProviderAuthorization → No requiere datos adicionales (valida proveedor)
#   Alerta → No requiere datos adicionales (solo muestra mensaje)
#
# NOTA: Los campos requeridos dependen de la configuración del handler
# en la base de datos (Tabla: config.workflow_accion_handlers).
DATOS_ADICIONALES_FIRMAR = {}

# ============================================================
# 4. VARIABLES PARA SUBIR COMPROBANTE
# ============================================================
# Se usan en FIRMAR (opcional) y en SUBIR_COMPROBANTE (acción independiente).

# REQUERIDO — Categoría del comprobante: 'gasto' o 'pago'
CATEGORIA_COMPROBANTE = "pago"

# REQUERIDO — Tipo de comprobante: 'cfdi','ticket','nota','recibo','manual','spei','cheque','transferencia'
TIPO_COMPROBANTE = "ticket"

# OPCIONAL — Archivo del comprobante (XML para CFDI, PDF/imagen para otros). Vacío = no subir.
ARCHIVO_COMPROBANTE = "C:/Users/brand/OneDrive/Desktop/workspaces/trabajo-lefarma/develop/sistema_de_firmado/IdentityProvider/gaato.jpg"  # Ej: "./facturas/mi_comprobante.pdf"

# OPCIONAL — Archivo XML por separado (solo para CFDI). Vacío = no subir.
ARCHIVO_XML_CFDI = ""  # Ej: "./facturas/mi_cfdi.xml"

# OPCIONAL — Total manual. REQUERIDO si TIPO_COMPROBANTE no es 'cfdi'.
TOTAL_MANUAL_COMPROBANTE = 128.76

# OPCIONAL — Notas del comprobante
NOTAS_COMPROBANTE = ""

# SOLO PARA PAGO (CATEGORIA_COMPROBANTE = 'pago'):
# OPCIONAL — Referencia del pago
REFERENCIA_PAGO = ""
# OPCIONAL — Fecha del pago en YYYY-MM-DD
FECHA_PAGO = ""
# OPCIONAL — Monto del pago
MONTO_PAGO = 128.76
# OPCIONAL — Medio de pago. Tabla: catalogos.medios_pago
ID_MEDIO_PAGO = 7

# OPCIONAL — Asignación de partidas al comprobante recién subido.
# Tabla: operaciones.comprobantes_partidas
# Si está vacía, no se asigna automáticamente.
# ASIGNACIONES_PARTIDAS = [
#     {"idPartida": 1, "cantidadAsignada": 2, "importeAsignado": 128.76, "notas": "completa"},
# ]
ASIGNACIONES_PARTIDAS = [
    {
        "idPartida": 149,
        "cantidadAsignada": 2,
        "importeAsignado": 128.76,
        "notas": "completa",
    },
]

# ============================================================
# 5. VARIABLES PARA SUBIR ARCHIVO ADJUNTO
# ============================================================
# Se usa en la acción SUBIR_ADJUNTO para adjuntar archivos genéricos
# a una orden de compra (similar al botón "Adjuntar" en el tab Archivos).

# REQUERIDO — Ruta del archivo a adjuntar
ARCHIVO_ADJUNTO = "./documentos/documento.pdf"

# REQUERIDO — Carpeta donde se guardará el archivo
# Valores comunes: "ordenes-compra", "comprobantes"
# SIEMPRE ordenes-compra para adjuntos de ordenes, aunque sea un comprobante relacionado.
CARPETA_ADJUNTO = "ordenes-compra"

# REQUERIDO — Comentarios u observaciones del archivo adjunto
# Se usa como "observaciones" en la metadata del archivo.
COMENTARIOS_ADJUNTO = "Documento de soporte"

# NOTA: La metadata se arma automáticamente con la siguiente estructura:
# {
#   "modulo": "ordenes_compra",      # SIEMPRE "ordenes_compra"
#   "origen": "workflow",            # SIEMPRE "workflow"
#   "tipo": "adjunto_libre",         # "adjunto_libre" para archivos, "comprobante_gasto" o "comprobante_pago" para comprobantes
#   "paso": null,                    # SIEMPRE null (no se usa en script)
#   "nombrePaso": "",                # SIEMPRE vacío (no se usa en script)
#   "nombreAccion": "",              # SIEMPRE vacío (no se usa en script)
#   "observaciones": COMENTARIOS_ADJUNTO o NOTAS_COMPROBANTE
# }

# ============================================================
# FIN DE CONFIGURACIÓN
# ============================================================
# No modificar nada debajo de esta línea a menos que sepas lo que haces.
# ============================================================


def _headers(
    api_key: str, user_id: int | None = None, content_type: str = "application/json"
) -> dict:
    headers = {
        "X-API-Key": api_key,
        "Content-Type": content_type,
    }
    if user_id is not None:
        headers["X-User-Id"] = str(user_id)
    return headers


def crear_orden_anonima(
    payload: dict, api_key: str, user_id: int | None = None
) -> requests.Response:
    """POST /api/ordenes/externo — Crear orden desde sistema externo."""
    return requests.post(
        f"{BASE_URL}/api/ordenes/externo",
        headers=_headers(api_key, user_id),
        json=payload,
    )


def firmar_orden_anonima(
    id_orden: int, payload: dict, api_key: str, user_id: int | None = None
) -> requests.Response:
    """POST /api/ordenes/externo/{id}/firmar — Firmar orden desde sistema externo."""
    return requests.post(
        f"{BASE_URL}/api/ordenes/externo/{id_orden}/firmar",
        headers=_headers(api_key, user_id),
        json=payload,
    )


def editar_orden_anonima(
    id_orden: int, payload: dict, api_key: str, user_id: int | None = None
) -> requests.Response:
    """PUT /api/ordenes/externo/{id} — Editar orden desde sistema externo."""
    return requests.put(
        f"{BASE_URL}/api/ordenes/externo/{id_orden}",
        headers=_headers(api_key, user_id),
        json=payload,
    )


def obtener_acciones(
    id_orden: int, api_key: str, user_id: int | None = None
) -> requests.Response:
    """GET /api/ordenes/externo/{id}/acciones — Ver acciones disponibles desde sistema externo."""
    return requests.get(
        f"{BASE_URL}/api/ordenes/externo/{id_orden}/acciones",
        headers=_headers(api_key, user_id),
    )


def obtener_historial(
    id_orden: int, api_key: str, user_id: int | None = None
) -> requests.Response:
    """GET /api/ordenes/externo/{id}/historial-workflow — Ver historial desde sistema externo."""
    return requests.get(
        f"{BASE_URL}/api/ordenes/externo/{id_orden}/historial-workflow",
        headers=_headers(api_key, user_id),
    )


def subir_comprobante(
    api_key: str,
    id_empresa: int,
    id_orden: int,
    categoria: str,
    tipo_comprobante: str,
    archivo_path: str,
    xml_path: str = "",
    total_manual: float | None = None,
    notas: str = "",
    referencia_pago: str = "",
    fecha_pago: str = "",
    monto_pago: float | None = None,
    id_medio_pago: int | None = None,
    user_id: int | None = None,
) -> requests.Response:
    """POST /api/facturas/externo — Subir comprobante desde sistema externo."""
    data = {
        "IdEmpresa": id_empresa,
        "IdUsuario": user_id or ANONYMOUS_USER_ID,
        "IdOrden": id_orden,
        "IdPasoWorkflow": None,
        "TipoComprobante": tipo_comprobante,
        "Categoria": categoria,
        "TotalManual": total_manual,
        "Notas": notas or None,
        "NombrePaso": None,
        "NombreAccion": None,
        "ReferenciaPago": referencia_pago or None,
        "FechaPago": fecha_pago or None,
        "MontoPago": monto_pago,
        "IdMedioPago": id_medio_pago,
    }

    files = {}
    if xml_path and os.path.isfile(xml_path):
        files["xmlFile"] = (
            os.path.basename(xml_path),
            open(xml_path, "rb"),
            "application/xml",
        )
    if archivo_path and os.path.isfile(archivo_path):
        mime = (
            "application/pdf" if archivo_path.lower().endswith(".pdf") else "image/png"
        )
        files["archivo"] = (
            os.path.basename(archivo_path),
            open(archivo_path, "rb"),
            mime,
        )

    return requests.post(
        f"{BASE_URL}/api/facturas/externo",
        headers={"X-API-Key": api_key, "X-User-Id": str(user_id or ANONYMOUS_USER_ID)},
        data=data,
        files=files,
    )


def asignar_partidas(
    id_comprobante: int,
    asignaciones: list[dict],
    api_key: str,
    user_id: int | None = None,
) -> requests.Response:
    """POST /api/facturas/externo/{id}/asignar-partidas — Asignar conceptos desde sistema externo."""
    payload = {
        "asignaciones": [
            {
                "idPartida": a["idPartida"],
                "cantidadAsignada": a["cantidadAsignada"],
                "importeAsignado": a["importeAsignado"],
                "notas": a.get("notas"),
            }
            for a in asignaciones
        ]
    }
    return requests.post(
        f"{BASE_URL}/api/facturas/externo/{id_comprobante}/asignar-partidas",
        headers=_headers(api_key, user_id),
        json=payload,
    )


def subir_archivo_adjunto(
    api_key: str,
    archivo,
    nombre_archivo: str,
    entidad_tipo: str = "OrdenCompra",
    entidad_id: int | None = None,
    carpeta: str = "ordenes-compra",
    tipo: str = "adjunto_libre",
    observaciones: str = "",
    user_id: int | None = None,
) -> requests.Response:
    """POST /api/archivos/externo/upload — Subir archivo adjunto desde sistema externo.

    Args:
        api_key: API Key para autenticación
        archivo: Objeto archivo abierto (ej: open("file.pdf", "rb"))
        nombre_archivo: Nombre del archivo con extensión
        entidad_tipo: Tipo de entidad (default: "OrdenCompra")
        entidad_id: ID de la entidad
        carpeta: Carpeta destino
        tipo: Tipo de archivo ("adjunto_libre", "comprobante_gasto", "comprobante_pago")
        observaciones: Comentarios u observaciones
        user_id: ID del usuario que sube el archivo
    """
    # Armar metadata automáticamente
    metadata = json.dumps(
        {
            "modulo": "ordenes_compra",
            "origen": "workflow",
            "tipo": tipo,
            "paso": None,
            "nombrePaso": "",
            "nombreAccion": "",
            "observaciones": observaciones or "",
        }
    )

    data = {
        "entidadTipo": entidad_tipo,
        "entidadId": entidad_id or ID_ORDEN,
        "carpeta": carpeta,
        "metadata": metadata,
    }

    files = {}
    if archivo:
        mime = (
            "application/pdf"
            if nombre_archivo.lower().endswith(".pdf")
            else "image/png"
            if nombre_archivo.lower().endswith((".png", ".jpg", ".jpeg"))
            else "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            if nombre_archivo.lower().endswith(".xlsx")
            else "application/vnd.ms-excel"
            if nombre_archivo.lower().endswith(".xls")
            else "application/octet-stream"
        )
        files["file"] = (
            nombre_archivo,
            archivo,
            mime,
        )

    return requests.post(
        f"{BASE_URL}/api/archivos/externo/upload",
        headers={"X-API-Key": api_key, "X-User-Id": str(user_id or ANONYMOUS_USER_ID)},
        data=data,
        files=files,
    )


def obtener_partidas_pendientes(
    id_orden: int,
    categoria: str,
    api_key: str,
    user_id: int | None = None,
) -> requests.Response:
    """GET /api/facturas/externo/partidas-pendientes — Ver partidas pendientes desde sistema externo."""
    return requests.get(
        f"{BASE_URL}/api/facturas/externo/partidas-pendientes",
        headers=_headers(api_key, user_id),
        params={"idOrden": id_orden, "categoria": categoria},
    )


def print_response(resp: requests.Response, label: str = ""):
    """Pretty-print API response."""
    if label:
        print(f"\n{'=' * 60}")
        print(f"  {label}")
        print(f"{'=' * 60}")
    print(f"Status: {resp.status_code}")
    try:
        print(json.dumps(resp.json(), indent=2, ensure_ascii=False))
    except Exception:
        print(resp.text[:500])


# ============================================================
# MAIN
# ============================================================

if __name__ == "__main__":
    accion = ACCION_SCRIPT
    resolved_password = API_KEY

    print(f"Acción: {accion}")
    print(f"Base URL: {BASE_URL}")
    print(f"API Key: {resolved_password}")
    if ANONYMOUS_USER_ID is not None:
        print(f"User ID: {ANONYMOUS_USER_ID}")
    print()

    # ============================================================
    # CREAR ORDEN
    # ============================================================
    if accion == "CREAR":
        payload = {
            "idEmpresa": ID_EMPRESA,
            "idSucursal": ID_SUCURSAL,
            "idArea": ID_AREA,
            "idTipoGasto": ID_TIPO_GASTO,
            "fechaLimitePago": FECHA_LIMITE_PAGO,
            "idMoneda": ID_MONEDA,
            "tipoCambioAplicado": TIPO_CAMBIO,
            "idProveedor": ID_PROVEEDOR,
            "sinDatosFiscales": SIN_DATOS_FISCALES,
            "requierePagoAnticipado": REQUIERE_PAGO_ANTICIPADO,
            "notaFormaPago": NOTA_FORMA_PAGO,
            "notasGenerales": NOTAS_GENERALES,
            "idsCuentasBancarias": IDS_CUENTAS_BANCARIAS,
            "idsFormaPago": IDS_FORMA_PAGO,
            "numeroMensualidades": NUMERO_MENSUALIDADES,
            "partidas": PARTIDAS,
        }

        print("Enviando payload CREAR:")
        print(json.dumps(payload, indent=2, ensure_ascii=False))
        print()

        resp = crear_orden_anonima(payload, resolved_password, ANONYMOUS_USER_ID)
        print_response(resp, "CREAR ORDEN")

    # ============================================================
    # FIRMAR ORDEN
    # ============================================================
    elif accion == "FIRMAR":
        id_orden = ID_ORDEN
        id_accion = ID_ACCION_FIRMAR
        comentario = COMENTARIO_FIRMAR
        datos_adicionales = DATOS_ADICIONALES_FIRMAR

        if id_orden is None:
            print("Error: falta ID_ORDEN")
            sys.exit(1)

        # --- PASO 0: Consultar acciones disponibles ---
        print(f"Consultando acciones disponibles para orden {id_orden}...")
        resp_acciones = obtener_acciones(id_orden, resolved_password, ANONYMOUS_USER_ID)
        print_response(resp_acciones, "ACCIONES DISPONIBLES")

        if resp_acciones.status_code != 200:
            print(
                "No se pudieron obtener las acciones. Verificá que la orden exista y el paso sea válido."
            )
            sys.exit(1)

        acciones_data = resp_acciones.json()
        acciones_disponibles = acciones_data.get("data", [])

        # Si no se proporcionó id_accion, mostrar acciones y salir
        if id_accion is None:
            print("\n" + "=" * 60)
            print("ACCIONES DISPONIBLES PARA FIRMAR:")
            print("=" * 60)
            if not acciones_disponibles:
                print("No hay acciones disponibles para esta orden en este momento.")
            else:
                for a in acciones_disponibles:
                    print(
                        f"  id={a.get('idAccion')} | {a.get('tipoAccionNombre')} ({a.get('tipoAccionCodigo')})"
                    )
            print("\nDefiní ID_ACCION_FIRMAR en las constantes.")
            print("=" * 60)
            sys.exit(0)

        # Validar que la acción proporcionada exista
        accion_encontrada = next(
            (a for a in acciones_disponibles if a.get("idAccion") == id_accion), None
        )
        if not accion_encontrada:
            print(
                f"\nError: idAccion {id_accion} no encontrado entre las acciones disponibles."
            )
            print("Acciones disponibles:")
            for a in acciones_disponibles:
                print(
                    f"  id={a.get('idAccion')} | {a.get('tipoAccionNombre')} ({a.get('tipoAccionCodigo')})"
                )
            sys.exit(1)

        # --- PASO 1: Subir comprobante (opcional) ---
        subir_comp = ARCHIVO_COMPROBANTE != ""
        if subir_comp:
            print(f"\nSubiendo comprobante de {CATEGORIA_COMPROBANTE}...")
            resp_comp = subir_comprobante(
                api_key=resolved_password,
                id_empresa=ID_EMPRESA,
                id_orden=id_orden,
                categoria=CATEGORIA_COMPROBANTE,
                tipo_comprobante=TIPO_COMPROBANTE,
                archivo_path=ARCHIVO_COMPROBANTE,
                xml_path=ARCHIVO_XML_CFDI,
                total_manual=TOTAL_MANUAL_COMPROBANTE,
                notas=NOTAS_COMPROBANTE,
                referencia_pago=REFERENCIA_PAGO,
                fecha_pago=FECHA_PAGO,
                monto_pago=MONTO_PAGO,
                id_medio_pago=ID_MEDIO_PAGO,
                user_id=ANONYMOUS_USER_ID,
            )
            print_response(resp_comp, f"SUBIR COMPROBANTE ({CATEGORIA_COMPROBANTE})")

            if resp_comp.status_code not in (200, 201):
                print("Error al subir comprobante.")
                sys.exit(1)

            # Asignar partidas al comprobante
            id_comprobante_subido = (
                resp_comp.json().get("data", {}).get("idComprobante")
            )
            if id_comprobante_subido and ASIGNACIONES_PARTIDAS:
                print(
                    f"\nAsignando {len(ASIGNACIONES_PARTIDAS)} partida(s) al comprobante {id_comprobante_subido}..."
                )
                resp_asig = asignar_partidas(
                    id_comprobante_subido,
                    ASIGNACIONES_PARTIDAS,
                    resolved_password,
                    ANONYMOUS_USER_ID,
                )
                print_response(resp_asig, "ASIGNAR PARTIDAS")

        # --- PASO 2: Consultar partidas pendientes ---
        print("\nConsultando estado de partidas pendientes...")
        resp_gasto = obtener_partidas_pendientes(
            id_orden, "gasto", resolved_password, ANONYMOUS_USER_ID
        )
        resp_pago = obtener_partidas_pendientes(
            id_orden, "pago", resolved_password, ANONYMOUS_USER_ID
        )
        print_response(resp_gasto, "PARTIDAS PENDIENTES (GASTO)")
        print_response(resp_pago, "PARTIDAS PENDIENTES (PAGO)")

        # --- PASO 3: Ejecutar firma ---
        payload_firma = {
            "idAccion": id_accion,
            "comentario": comentario or None,
            "datosAdicionales": datos_adicionales,
        }

        print(f"\nFirmando orden {id_orden} con acción {id_accion}...")
        print(
            f"Payload firma: {json.dumps(payload_firma, indent=2, ensure_ascii=False)}"
        )

        resp_firma = firmar_orden_anonima(
            id_orden, payload_firma, resolved_password, ANONYMOUS_USER_ID
        )
        print_response(resp_firma, "FIRMAR ORDEN")

        # --- PASO 4: Ver historial actualizado ---
        if resp_firma.status_code in (200, 201):
            print("\nFirma exitosa. Consultando historial actualizado...")
            resp_hist = obtener_historial(
                id_orden, resolved_password, ANONYMOUS_USER_ID
            )
            print_response(resp_hist, "HISTORIAL ACTUALIZADO")

    # ============================================================
    # EDITAR ORDEN
    # ============================================================
    elif accion == "EDITAR":
        id_orden_editar = ID_ORDEN

        if id_orden_editar is None:
            print("Error: falta ID_ORDEN")
            sys.exit(1)

        payload = {
            "idEmpresa": ID_EMPRESA,
            "idSucursal": ID_SUCURSAL,
            "idArea": ID_AREA,
            "idTipoGasto": ID_TIPO_GASTO,
            "fechaLimitePago": FECHA_LIMITE_PAGO,
            "idMoneda": ID_MONEDA,
            "tipoCambioAplicado": TIPO_CAMBIO,
            "idProveedor": ID_PROVEEDOR,
            "sinDatosFiscales": SIN_DATOS_FISCALES,
            "requierePagoAnticipado": REQUIERE_PAGO_ANTICIPADO,
            "notaFormaPago": NOTA_FORMA_PAGO,
            "notasGenerales": NOTAS_GENERALES,
            "idsCuentasBancarias": IDS_CUENTAS_BANCARIAS,
            "idsFormaPago": IDS_FORMA_PAGO,
            "numeroMensualidades": NUMERO_MENSUALIDADES,
            "partidas": PARTIDAS,
        }

        print(f"Editando orden {id_orden_editar}...")
        print("Enviando payload EDITAR:")
        print(json.dumps(payload, indent=2, ensure_ascii=False))
        print()

        resp = editar_orden_anonima(
            id_orden_editar, payload, resolved_password, ANONYMOUS_USER_ID
        )
        print_response(resp, "EDITAR ORDEN")

    # ============================================================
    # SUBIR COMPROBANTE
    # ============================================================
    elif accion == "SUBIR_COMPROBANTE":
        id_orden = ID_ORDEN

        if id_orden is None:
            print("Error: falta ID_ORDEN")
            sys.exit(1)

        if not ARCHIVO_COMPROBANTE:
            print("Error: falta ARCHIVO_COMPROBANTE")
            sys.exit(1)

        print(f"\nSubiendo comprobante de {CATEGORIA_COMPROBANTE}...")
        resp_comp = subir_comprobante(
            api_key=resolved_password,
            id_empresa=ID_EMPRESA,
            id_orden=id_orden,
            categoria=CATEGORIA_COMPROBANTE,
            tipo_comprobante=TIPO_COMPROBANTE,
            archivo_path=ARCHIVO_COMPROBANTE,
            xml_path=ARCHIVO_XML_CFDI,
            total_manual=TOTAL_MANUAL_COMPROBANTE,
            notas=NOTAS_COMPROBANTE,
            referencia_pago=REFERENCIA_PAGO,
            fecha_pago=FECHA_PAGO,
            monto_pago=MONTO_PAGO,
            id_medio_pago=ID_MEDIO_PAGO,
            user_id=ANONYMOUS_USER_ID,
        )
        print_response(resp_comp, f"SUBIR COMPROBANTE ({CATEGORIA_COMPROBANTE})")

        if resp_comp.status_code not in (200, 201):
            print("Error al subir comprobante.")
            sys.exit(1)

        # Asignar partidas al comprobante
        id_comprobante_subido = resp_comp.json().get("data", {}).get("idComprobante")
        if id_comprobante_subido and ASIGNACIONES_PARTIDAS:
            print(
                f"\nAsignando {len(ASIGNACIONES_PARTIDAS)} partida(s) al comprobante {id_comprobante_subido}..."
            )
            resp_asig = asignar_partidas(
                id_comprobante_subido,
                ASIGNACIONES_PARTIDAS,
                resolved_password,
                ANONYMOUS_USER_ID,
            )
            print_response(resp_asig, "ASIGNAR PARTIDAS")

    # ============================================================
    # SUBIR ARCHIVO ADJUNTO
    # ============================================================
    elif accion == "SUBIR_ADJUNTO":
        id_orden = ID_ORDEN
        archivo_path = ARCHIVO_ADJUNTO
        carpeta = CARPETA_ADJUNTO
        comentarios = COMENTARIOS_ADJUNTO

        if id_orden is None:
            print("Error: falta ID_ORDEN")
            sys.exit(1)

        if not archivo_path:
            print("Error: falta la ruta del archivo a adjuntar (ARCHIVO_ADJUNTO)")
            sys.exit(1)

        if not os.path.isfile(archivo_path):
            print(f"Error: no se encontró el archivo: {archivo_path}")
            sys.exit(1)

        # Abrir archivo y subir
        with open(archivo_path, "rb") as archivo:
            print(f"\nSubiendo archivo adjunto a orden {id_orden}...")
            print(f"Archivo: {os.path.basename(archivo_path)}")
            print(f"Carpeta: {carpeta}")
            print(f"Comentarios: {comentarios}")

            resp_arch = subir_archivo_adjunto(
                api_key=resolved_password,
                archivo=archivo,
                nombre_archivo=os.path.basename(archivo_path),
                entidad_tipo="OrdenCompra",
                entidad_id=id_orden,
                carpeta=carpeta,
                tipo="adjunto_libre",
                observaciones=comentarios,
                user_id=ANONYMOUS_USER_ID,
            )
            print_response(resp_arch, "SUBIR ARCHIVO ADJUNTO")

        if resp_arch.status_code not in (200, 201):
            print("Error al subir archivo adjunto.")
            sys.exit(1)

        print("\nArchivo adjunto subido exitosamente.")
