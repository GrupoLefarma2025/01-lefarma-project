"""
================================================================================
SCRIPT DE ORDENES DE COMPRA
================================================================================

Este script permite interactuar con el backend de Lefarma (.NET) para realizar
operaciones de órdenes de compra, firmas y comprobantes.

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
  5. SUBIR_ARCHIVO  → Sube un archivo adjunto genérico a una orden de compra
                      (similar al botón "Adjuntar" en el tab Archivos).

CONFIGURACIÓN:
  - Editá las constantes de este archivo para valores por defecto.
  - O pasá los valores por línea de comandos (CLI).
  - Si una constante está en None, el script espera el argumento CLI.

EJEMPLOS DE USO:

  # Crear orden (por constantes)
  ACCION_SCRIPT = "CREAR"
  → python crear_orden_anonima.py

  # Crear orden (por CLI)
  → python crear_orden_anonima.py --accion CREAR --id-empresa 7 --id-sucursal 6 ...

  # Editar orden
  → python crear_orden_anonima.py --accion EDITAR --id-orden-editar 136

  # Firmar orden (consulta acciones disponibles primero)
  → python crear_orden_anonima.py --accion FIRMAR --id-orden 136

  # Firmar orden con acción específica y comprobante
  → python crear_orden_anonima.py --accion FIRMAR --id-orden 136 --id-accion 20 \
      --subir-comprobante --archivo-comprobante "./ticket.pdf"

  # Subir comprobante sin firmar
  → python crear_orden_anonima.py --accion SUBIR_COMPROBANTE --id-orden 136 \
      --archivo-comprobante "./factura.pdf" --categoria-comprobante gasto

  # Subir archivo adjunto
  → python crear_orden_anonima.py --accion SUBIR_ARCHIVO --id-orden 136 \
      --archivo-adjunto "./documento.pdf" --carpeta "ordenes-compra"

================================================================================
"""

import requests
import json
import argparse
import sys
import os

# ============================================================
# CONFIGURACIÓN GLOBAL
# ============================================================
# Reemplazá los None por valores para omitir los argumentos CLI.

BASE_URL = "http://200.94.77.190:5074/cxP"  # URL del backend Lefarma
API_KEY = "lefarma-api-key-2026"  # API Key general (misma para todos)
ANONYMOUS_USER_ID = 25  # ID del usuario que opera (trazabilidad)

# ============================================================
# SELECCIÓN DE ACCIÓN
# ============================================================
# ACCIÓN: 'CREAR' | 'EDITAR' | 'FIRMAR' | 'SUBIR_COMPROBANTE' | 'SUBIR_ADJUTNO'
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
# 2. VARIABLES PARA EDITAR / FIRMAR / SUBIR_ADJUNTO
# ============================================================
# REQUERIDO — ID de la orden.
# Tabla: operaciones.ordenes_compra
# Se usa en: EDITAR, FIRMAR y SUBIR_ADJUNTO
ID_ORDEN = 136
# NOTA: Los demás campos se reutilizan de la sección CREAR.

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
# Se usa en la acción SUBIR_ADJUNTO para adjuntar archivos a una orden de compra (similar al botón "Adjuntar" en el tab Archivos).

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
#   "paso": null,                    # SIEMPRE null 
#   "nombrePaso": "",                # SIEMPRE vacío 
#   "nombreAccion": "",              # SIEMPRE vacío
#   "observaciones": COMENTARIOS_ADJUNTO o NOTAS_COMPROBANTE
# }

# ============================================================
# EJEMPLOS DE CONFIGURACIÓN POR ACCIÓN
# ============================================================
#
# --- EJEMPLO 1: CREAR ORDEN ---
# ACCION_SCRIPT = "CREAR"
# ID_EMPRESA = 7
# ID_SUCURSAL = 6
# ID_AREA = 11
# ID_TIPO_GASTO = 1
# FECHA_LIMITE_PAGO = "2026-06-20"
# ID_MONEDA = 1
# ID_PROVEEDOR = 14
# IDS_CUENTAS_BANCARIAS = [98]
# IDS_FORMA_PAGO = [6]
# PARTIDAS = [
#     {
#         "descripcion": "Producto de prueba",
#         "cantidad": 2,
#         "idUnidadMedida": 1,
#         "precioUnitario": 100.0,
#         "descuento": 0.0,
#         "porcentajeIva": 16.0,
#         "totalRetenciones": 0.0,
#         "otrosImpuestos": 0.0,
#         "requiereFactura": True,
#         "deducible": True,
#         "idProveedor": None,
#         "idCuentaBancaria": None,
#     }
# ]
#
# --- EJEMPLO 2: EDITAR ORDEN ---
# ACCION_SCRIPT = "EDITAR"
# ID_ORDEN = 136
# (Los demás campos se reutilizan de CREAR)
#
# --- EJEMPLO 3: FIRMAR ORDEN ---
# ACCION_SCRIPT = "FIRMAR"
# ID_ORDEN = 136
# ID_ACCION_FIRMAR = 20
# COMENTARIO_FIRMAR = "Autorizado"
#
# --- EJEMPLO 4: SUBIR COMPROBANTE DE GASTO ---
# ACCION_SCRIPT = "SUBIR_COMPROBANTE"
# ID_ORDEN = 136
# CATEGORIA_COMPROBANTE = "gasto"
# TIPO_COMPROBANTE = "ticket"
# ARCHIVO_COMPROBANTE = "./comprobantes/ticket_001.pdf"
# TOTAL_MANUAL_COMPROBANTE = 128.76
# ASIGNACIONES_PARTIDAS = [
#     {"idPartida": 1, "cantidadAsignada": 2, "importeAsignado": 128.76, "notas": "completa"},
# ]
#
# --- EJEMPLO 5: SUBIR COMPROBANTE DE PAGO ---
# ACCION_SCRIPT = "SUBIR_COMPROBANTE"
# ID_ORDEN = 136
# CATEGORIA_COMPROBANTE = "pago"
# TIPO_COMPROBANTE = "spei"
# ARCHIVO_COMPROBANTE = "./comprobantes/spei_001.pdf"
# TOTAL_MANUAL_COMPROBANTE = 232.00
# REFERENCIA_PAGO = "REF-SPEI-2026-001"
# FECHA_PAGO = "2026-06-20"
# MONTO_PAGO = 232.00
# ID_MEDIO_PAGO = 1  # 1=SPEI, ver tabla catalogos.medios_pago
# NOTAS_COMPROBANTE = "Pago de orden de compra"
# ASIGNACIONES_PARTIDAS = [
#     {"idPartida": 1, "cantidadAsignada": 2, "importeAsignado": 232.00, "notas": "pago completo"},
# ]
#
# --- EJEMPLO 6: SUBIR ARCHIVO ADJUNTO ---
# ACCION_SCRIPT = "SUBIR_ADJUNTO"
# ID_ORDEN = 136
# ARCHIVO_ADJUNTO = "./documentos/contrato.pdf"
# CARPETA_ADJUNTO = "ordenes-compra"
# COMENTARIOS_ADJUNTO = "Documento de soporte"

# ============================================================
# FIN DE CONFIGURACIÓN
# ============================================================
# No modificar nada debajo de esta línea a menos que sepas lo que haces.
# ============================================================
# HELPERS
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
    archivo_path: str,
    entidad_tipo: str = "OrdenCompra",
    entidad_id: int | None = None,
    carpeta: str = "ordenes-compra",
    tipo: str = "adjunto_libre",
    observaciones: str = "",
    user_id: int | None = None,
) -> requests.Response:
    """POST /api/archivos/externo/upload — Subir archivo adjunto desde sistema externo."""
    # Armar metadata automáticamente
    metadata = json.dumps({
        "modulo": "ordenes_compra",
        "origen": "workflow",
        "tipo": tipo,
        "paso": None,
        "nombrePaso": "",
        "nombreAccion": "",
        "observaciones": observaciones or "",
    })

    data = {
        "entidadTipo": entidad_tipo,
        "entidadId": entidad_id or ID_ORDEN,
        "carpeta": carpeta,
        "metadata": metadata,
    }

    files = {}
    if archivo_path and os.path.isfile(archivo_path):
        mime = (
            "application/pdf"
            if archivo_path.lower().endswith(".pdf")
            else "image/png"
            if archivo_path.lower().endswith((".png", ".jpg", ".jpeg"))
            else "application/octet-stream"
        )
        files["file"] = (
            os.path.basename(archivo_path),
            open(archivo_path, "rb"),
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


def parse_bool(v: str) -> bool:
    return v.lower() in ("true", "1", "yes", "si")


def parse_nullable_int(v: str) -> int | None:
    return int(v) if v.lower() not in ("null", "none", "") else None


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
    p = argparse.ArgumentParser(
        description="Script Lefarma: Crear / Firmar / Editar ordenes via API"
    )

    # Acción principal
    p.add_argument(
        "--accion",
        type=str,
        default=None,
        choices=["CREAR", "FIRMAR", "EDITAR", "SUBIR_COMPROBANTE", "SUBIR_ADJUNTO"],
        help="Acción a ejecutar (default: ACCION_SCRIPT)",
    )

    # Común
    p.add_argument(
        "--api-key", type=str, default=None, help="API Key para autenticación externa"
    )
    p.add_argument("--base-url", type=str, default=None)

    # --- CREAR ---
    p.add_argument("--id-empresa", type=int, default=None)
    p.add_argument("--id-sucursal", type=int, default=None)
    p.add_argument("--id-area", type=int, default=None)
    p.add_argument("--id-tipo-gasto", type=int, default=None)
    p.add_argument("--fecha-limite-pago", type=str, default=None, help="YYYY-MM-DD")
    p.add_argument("--id-moneda", type=int, default=None)
    p.add_argument("--tipo-cambio", type=float, default=None)
    p.add_argument("--id-proveedor", type=int, default=None)
    p.add_argument("--sin-datos-fiscales", action="store_true", default=False)
    p.add_argument("--requiere-pago-anticipado", action="store_true", default=False)
    p.add_argument("--nota-forma-pago", type=str, default=None)
    p.add_argument("--notas-generales", type=str, default=None)
    p.add_argument(
        "--ids-cuentas-bancarias", type=int, nargs="+", default=None, help="Ej: 98 99"
    )
    p.add_argument(
        "--ids-forma-pago", type=int, nargs="+", default=None, help="Ej: 6 7"
    )
    p.add_argument("--numero-mensualidades", type=int, default=None)

    p.add_argument(
        "--partida",
        action="append",
        nargs=11,
        metavar=(
            "DESC",
            "CANT",
            "UNIDAD",
            "PRECIO",
            "DESCUENTO",
            "IVA",
            "RETENCIONES",
            "OTROS_IMP",
            "FACTURA",
            "DEDUCIBLE",
            "ID_PROVEEDOR",
        ),
        default=None,
    )

    # --- FIRMAR ---
    p.add_argument("--id-orden", type=int, default=None, help="ID de la orden a firmar")
    p.add_argument(
        "--id-accion", type=int, default=None, help="ID de la acción de firma"
    )
    p.add_argument(
        "--comentario", type=str, default=None, help="Comentario de la firma"
    )
    p.add_argument(
        "--datos-adicionales",
        type=str,
        default=None,
        help='JSON con datos adicionales. Ej: \'{"centro_costo":"5"}\'',
    )

    # --- EDITAR ---
    p.add_argument(
        "--id-orden-editar",
        type=int,
        default=None,
        help="ID de la orden a editar",
    )

    # --- COMPROBANTES ---
    p.add_argument(
        "--subir-comprobante",
        action="store_true",
        default=False,
        help="Subir comprobante antes de firmar",
    )
    p.add_argument(
        "--categoria-comprobante", type=str, default=None, choices=["gasto", "pago"]
    )
    p.add_argument(
        "--tipo-comprobante",
        type=str,
        default=None,
        help="Tipo: cfdi,ticket,nota,recibo,manual,spei,cheque,transferencia",
    )
    p.add_argument(
        "--archivo-comprobante", type=str, default=None, help="Ruta al archivo"
    )
    p.add_argument("--archivo-xml", type=str, default=None, help="Ruta al XML (CFDI)")
    p.add_argument("--total-manual", type=float, default=None)
    p.add_argument(
        "--asignar-partidas",
        type=str,
        default=None,
        help='JSON con asignaciones. Ej: \'[{"idPartida":1,"cantidadAsignada":2,"importeAsignado":128.76}]\'',
    )

    # --- ARCHIVOS ADJUNTOS ---
    p.add_argument(
        "--archivo-adjunto",
        type=str,
        default=None,
        help="Ruta al archivo adjunto a subir",
    )
    p.add_argument(
        "--carpeta-adjunto",
        type=str,
        default=None,
        help="Carpeta donde guardar el archivo (ordenes-compra, comprobantes)",
    )
    p.add_argument(
        "--comentarios-adjunto",
        type=str,
        default=None,
        help="Comentarios u observaciones del archivo adjunto",
    )

    args = p.parse_args()

    # Resolver acción
    accion = args.accion or ACCION_SCRIPT
    resolved_password = API_KEY or args.api_key or "tt01tt"
    if args.base_url:
        BASE_URL = args.base_url

    print(f"Acción: {accion}")
    print(f"Base URL: {BASE_URL}")
    print(f"MasterPassword: {resolved_password}")
    if ANONYMOUS_USER_ID is not None:
        print(f"AnonymousUserId (ref servidor): {ANONYMOUS_USER_ID}")
    print()

    # ============================================================
    # CREAR ORDEN
    # ============================================================
    if accion == "CREAR":
        id_empresa = ID_EMPRESA if ID_EMPRESA is not None else args.id_empresa
        id_sucursal = ID_SUCURSAL if ID_SUCURSAL is not None else args.id_sucursal
        id_area = ID_AREA if ID_AREA is not None else args.id_area
        id_tipo_gasto = (
            ID_TIPO_GASTO if ID_TIPO_GASTO is not None else args.id_tipo_gasto
        )
        fecha_limite_pago = (
            FECHA_LIMITE_PAGO
            if FECHA_LIMITE_PAGO is not None
            else args.fecha_limite_pago
        )
        id_moneda = ID_MONEDA if ID_MONEDA is not None else args.id_moneda
        tipo_cambio = (
            TIPO_CAMBIO if TIPO_CAMBIO is not None else (args.tipo_cambio or 1.0)
        )
        id_proveedor = ID_PROVEEDOR if ID_PROVEEDOR is not None else args.id_proveedor
        sin_datos_fiscales = (
            SIN_DATOS_FISCALES
            if SIN_DATOS_FISCALES is not None
            else args.sin_datos_fiscales
        )
        requiere_pago_anticipado = (
            REQUIERE_PAGO_ANTICIPADO
            if REQUIERE_PAGO_ANTICIPADO is not None
            else args.requiere_pago_anticipado
        )
        nota_forma_pago = (
            NOTA_FORMA_PAGO
            if NOTA_FORMA_PAGO is not None
            else (args.nota_forma_pago or "")
        )
        notas_generales = (
            NOTAS_GENERALES
            if NOTAS_GENERALES is not None
            else (args.notas_generales or "")
        )
        ids_cuentas_bancarias = (
            IDS_CUENTAS_BANCARIAS
            if IDS_CUENTAS_BANCARIAS is not None
            else args.ids_cuentas_bancarias
        )
        ids_forma_pago = (
            IDS_FORMA_PAGO if IDS_FORMA_PAGO is not None else args.ids_forma_pago
        )
        numero_mensualidades = (
            NUMERO_MENSUALIDADES
            if NUMERO_MENSUALIDADES is not None
            else (args.numero_mensualidades or 1)
        )

        missing = []
        if id_empresa is None:
            missing.append("--id-empresa o ID_EMPRESA")
        if id_sucursal is None:
            missing.append("--id-sucursal o ID_SUCURSAL")
        if id_area is None:
            missing.append("--id-area o ID_AREA")
        if id_tipo_gasto is None:
            missing.append("--id-tipo-gasto o ID_TIPO_GASTO")
        if fecha_limite_pago is None:
            missing.append("--fecha-limite-pago o FECHA_LIMITE_PAGO")
        if id_moneda is None:
            missing.append("--id-moneda o ID_MONEDA")
        if id_proveedor is None:
            missing.append("--id-proveedor o ID_PROVEEDOR")
        if ids_cuentas_bancarias is None:
            missing.append("--ids-cuentas-bancarias o IDS_CUENTAS_BANCARIAS")
        if ids_forma_pago is None:
            missing.append("--ids-forma-pago o IDS_FORMA_PAGO")

        if missing:
            print(
                "Faltan campos requeridos. Definilos como constantes o pasalos por CLI:\n"
            )
            for m in missing:
                print(f"  - {m}")
            sys.exit(1)

        if PARTIDAS is not None:
            partidas = PARTIDAS
        elif args.partida is not None:
            partidas = []
            for p_args in args.partida:
                partidas.append(
                    {
                        "descripcion": p_args[0],
                        "cantidad": int(p_args[1]),
                        "idUnidadMedida": int(p_args[2]),
                        "precioUnitario": float(p_args[3]),
                        "descuento": float(p_args[4]),
                        "porcentajeIva": float(p_args[5]),
                        "totalRetenciones": float(p_args[6]),
                        "otrosImpuestos": float(p_args[7]),
                        "requiereFactura": parse_bool(p_args[8]),
                        "deducible": parse_bool(p_args[9]),
                        "idProveedor": parse_nullable_int(p_args[10]),
                        "idCuentaBancaria": None,
                    }
                )
        else:
            print("Falta --partida o PARTIDAS (lista de partidas)")
            sys.exit(1)

        payload = {
            "idEmpresa": id_empresa,
            "idSucursal": id_sucursal,
            "idArea": id_area,
            "idTipoGasto": id_tipo_gasto,
            "fechaLimitePago": fecha_limite_pago,
            "idMoneda": id_moneda,
            "tipoCambioAplicado": tipo_cambio,
            "idProveedor": id_proveedor,
            "sinDatosFiscales": sin_datos_fiscales,
            "requierePagoAnticipado": requiere_pago_anticipado,
            "notaFormaPago": nota_forma_pago,
            "notasGenerales": notas_generales,
            "idsCuentasBancarias": ids_cuentas_bancarias,
            "idsFormaPago": ids_forma_pago,
            "numeroMensualidades": numero_mensualidades,
            "partidas": partidas,
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
        id_orden = args.id_orden if args.id_orden is not None else ID_ORDEN
        id_accion = args.id_accion if args.id_accion is not None else ID_ACCION_FIRMAR
        comentario = (
            args.comentario if args.comentario is not None else COMENTARIO_FIRMAR
        )

        # Parsear datos adicionales
        if args.datos_adicionales:
            datos_adicionales = json.loads(args.datos_adicionales)
        elif DATOS_ADICIONALES_FIRMAR:
            datos_adicionales = DATOS_ADICIONALES_FIRMAR
        else:
            datos_adicionales = None

        if id_orden is None:
            print("Error: falta ID_ORDEN (definilo como constante o pasá --id-orden)")
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
            print("\nEjecuta de nuevo con: --id-accion <ID>")
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
        subir_comp = args.subir_comprobante or (ARCHIVO_COMPROBANTE != "")
        if subir_comp:
            categoria = args.categoria_comprobante or CATEGORIA_COMPROBANTE
            tipo_comp = args.tipo_comprobante or TIPO_COMPROBANTE
            archivo = args.archivo_comprobante or ARCHIVO_COMPROBANTE
            xml_file = args.archivo_xml or ARCHIVO_XML_CFDI
            total_manual = args.total_manual or TOTAL_MANUAL_COMPROBANTE
            notas_comp = NOTAS_COMPROBANTE

            print(f"\nSubiendo comprobante de {categoria}...")
            resp_comp = subir_comprobante(
                api_key=resolved_password,
                id_empresa=ID_EMPRESA,
                id_orden=id_orden,
                categoria=categoria,
                tipo_comprobante=tipo_comp,
                archivo_path=archivo,
                xml_path=xml_file,
                total_manual=total_manual,
                notas=notas_comp,
                referencia_pago=REFERENCIA_PAGO,
                fecha_pago=FECHA_PAGO,
                monto_pago=MONTO_PAGO,
                id_medio_pago=ID_MEDIO_PAGO,
            )
            print_response(resp_comp, f"SUBIR COMPROBANTE ({categoria})")

            if resp_comp.status_code not in (200, 201):
                print("Error al subir comprobante. Abortando.")
                sys.exit(1)

            # Asignar partidas al comprobante
            id_comprobante_subido = (
                resp_comp.json().get("data", {}).get("idComprobante")
            )
            asignaciones_raw = args.asignar_partidas
            asignaciones = (
                json.loads(asignaciones_raw)
                if asignaciones_raw
                else ASIGNACIONES_PARTIDAS
            )

            if id_comprobante_subido and asignaciones:
                print(
                    f"\nAsignando {len(asignaciones)} partida(s) al comprobante {id_comprobante_subido}..."
                )
                resp_asig = asignar_partidas(
                    id_comprobante_subido,
                    asignaciones,
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
        id_orden_editar = (
            args.id_orden_editar if args.id_orden_editar is not None else ID_ORDEN
        )

        # Reutilizar las mismas variables de CREAR para los datos de la orden
        id_empresa = ID_EMPRESA if ID_EMPRESA is not None else args.id_empresa
        id_sucursal = ID_SUCURSAL if ID_SUCURSAL is not None else args.id_sucursal
        id_area = ID_AREA if ID_AREA is not None else args.id_area
        id_tipo_gasto = (
            ID_TIPO_GASTO if ID_TIPO_GASTO is not None else args.id_tipo_gasto
        )
        fecha_limite_pago = (
            FECHA_LIMITE_PAGO
            if FECHA_LIMITE_PAGO is not None
            else args.fecha_limite_pago
        )
        id_moneda = ID_MONEDA if ID_MONEDA is not None else args.id_moneda
        tipo_cambio = (
            TIPO_CAMBIO if TIPO_CAMBIO is not None else (args.tipo_cambio or 1.0)
        )
        id_proveedor = ID_PROVEEDOR if ID_PROVEEDOR is not None else args.id_proveedor
        sin_datos_fiscales = (
            SIN_DATOS_FISCALES
            if SIN_DATOS_FISCALES is not None
            else args.sin_datos_fiscales
        )
        requiere_pago_anticipado = (
            REQUIERE_PAGO_ANTICIPADO
            if REQUIERE_PAGO_ANTICIPADO is not None
            else args.requiere_pago_anticipado
        )
        nota_forma_pago = (
            NOTA_FORMA_PAGO
            if NOTA_FORMA_PAGO is not None
            else (args.nota_forma_pago or "")
        )
        notas_generales = (
            NOTAS_GENERALES
            if NOTAS_GENERALES is not None
            else (args.notas_generales or "")
        )
        ids_cuentas_bancarias = (
            IDS_CUENTAS_BANCARIAS
            if IDS_CUENTAS_BANCARIAS is not None
            else args.ids_cuentas_bancarias
        )
        ids_forma_pago = (
            IDS_FORMA_PAGO if IDS_FORMA_PAGO is not None else args.ids_forma_pago
        )
        numero_mensualidades = (
            NUMERO_MENSUALIDADES
            if NUMERO_MENSUALIDADES is not None
            else (args.numero_mensualidades or 1)
        )

        if id_orden_editar is None:
            print(
                "Error: falta ID_ORDEN_EDITAR (definilo como constante o pasá --id-orden-editar)"
            )
            sys.exit(1)

        missing = []
        if id_empresa is None:
            missing.append("--id-empresa o ID_EMPRESA")
        if id_sucursal is None:
            missing.append("--id-sucursal o ID_SUCURSAL")
        if id_area is None:
            missing.append("--id-area o ID_AREA")
        if id_tipo_gasto is None:
            missing.append("--id-tipo-gasto o ID_TIPO_GASTO")
        if fecha_limite_pago is None:
            missing.append("--fecha-limite-pago o FECHA_LIMITE_PAGO")
        if id_moneda is None:
            missing.append("--id-moneda o ID_MONEDA")
        if id_proveedor is None:
            missing.append("--id-proveedor o ID_PROVEEDOR")
        if ids_cuentas_bancarias is None:
            missing.append("--ids-cuentas-bancarias o IDS_CUENTAS_BANCARIAS")
        if ids_forma_pago is None:
            missing.append("--ids-forma-pago o IDS_FORMA_PAGO")

        if missing:
            print(
                "Faltan campos requeridos. Definilos como constantes o pasalos por CLI:\n"
            )
            for m in missing:
                print(f"  - {m}")
            sys.exit(1)

        if PARTIDAS is not None:
            partidas = PARTIDAS
        elif args.partida is not None:
            partidas = []
            for p_args in args.partida:
                partidas.append(
                    {
                        "descripcion": p_args[0],
                        "cantidad": int(p_args[1]),
                        "idUnidadMedida": int(p_args[2]),
                        "precioUnitario": float(p_args[3]),
                        "descuento": float(p_args[4]),
                        "porcentajeIva": float(p_args[5]),
                        "totalRetenciones": float(p_args[6]),
                        "otrosImpuestos": float(p_args[7]),
                        "requiereFactura": parse_bool(p_args[8]),
                        "deducible": parse_bool(p_args[9]),
                        "idProveedor": parse_nullable_int(p_args[10]),
                        "idCuentaBancaria": None,
                    }
                )
        else:
            print("Falta --partida o PARTIDAS (lista de partidas)")
            sys.exit(1)

        payload = {
            "idEmpresa": id_empresa,
            "idSucursal": id_sucursal,
            "idArea": id_area,
            "idTipoGasto": id_tipo_gasto,
            "fechaLimitePago": fecha_limite_pago,
            "idMoneda": id_moneda,
            "tipoCambioAplicado": tipo_cambio,
            "idProveedor": id_proveedor,
            "sinDatosFiscales": sin_datos_fiscales,
            "requierePagoAnticipado": requiere_pago_anticipado,
            "notaFormaPago": nota_forma_pago,
            "notasGenerales": notas_generales,
            "idsCuentasBancarias": ids_cuentas_bancarias,
            "idsFormaPago": ids_forma_pago,
            "numeroMensualidades": numero_mensualidades,
            "partidas": partidas,
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
        id_orden = args.id_orden if args.id_orden is not None else ID_ORDEN

        if id_orden is None:
            print("Error: falta ID_ORDEN (definilo como constante o pasá --id-orden)")
            sys.exit(1)

        categoria = args.categoria_comprobante or CATEGORIA_COMPROBANTE
        tipo_comp = args.tipo_comprobante or TIPO_COMPROBANTE
        archivo = args.archivo_comprobante or ARCHIVO_COMPROBANTE
        xml_file = args.archivo_xml or ARCHIVO_XML_CFDI
        total_manual = args.total_manual or TOTAL_MANUAL_COMPROBANTE
        notas_comp = NOTAS_COMPROBANTE

        if not archivo:
            print(
                "Error: falta archivo del comprobante (definilo como constante o pasá --archivo-comprobante)"
            )
            sys.exit(1)

        print(f"\nSubiendo comprobante de {categoria}...")
        resp_comp = subir_comprobante(
            api_key=resolved_password,
            id_empresa=ID_EMPRESA,
            id_orden=id_orden,
            categoria=categoria,
            tipo_comprobante=tipo_comp,
            archivo_path=archivo,
            xml_path=xml_file,
            total_manual=total_manual,
            notas=notas_comp,
            referencia_pago=REFERENCIA_PAGO,
            fecha_pago=FECHA_PAGO,
            monto_pago=MONTO_PAGO,
            id_medio_pago=ID_MEDIO_PAGO,
            user_id=ANONYMOUS_USER_ID,
        )
        print_response(resp_comp, f"SUBIR COMPROBANTE ({categoria})")

        if resp_comp.status_code not in (200, 201):
            print("Error al subir comprobante.")
            sys.exit(1)

        # Asignar partidas al comprobante
        id_comprobante_subido = resp_comp.json().get("data", {}).get("idComprobante")
        asignaciones_raw = args.asignar_partidas
        asignaciones = (
            json.loads(asignaciones_raw) if asignaciones_raw else ASIGNACIONES_PARTIDAS
        )

        if id_comprobante_subido and asignaciones:
            print(
                f"\nAsignando {len(asignaciones)} partida(s) al comprobante {id_comprobante_subido}..."
            )
            resp_asig = asignar_partidas(
                id_comprobante_subido,
                asignaciones,
                resolved_password,
                ANONYMOUS_USER_ID,
            )
            print_response(resp_asig, "ASIGNAR PARTIDAS")

    # ============================================================
    # SUBIR ARCHIVO ADJUNTO
    # ============================================================
    elif accion == "SUBIR_ADJUNTO":
        id_orden = args.id_orden if args.id_orden is not None else ID_ORDEN
        archivo = args.archivo_adjunto or ARCHIVO_ADJUNTO
        carpeta = args.carpeta_adjunto or CARPETA_ADJUNTO
        comentarios = args.comentarios_adjunto or COMENTARIOS_ADJUNTO

        if id_orden is None:
            print("Error: falta ID_ORDEN")
            sys.exit(1)

        if not archivo:
            print(
                "Error: falta archivo adjunto"
            )
            sys.exit(1)

        # Armar metadata automáticamente
        metadata = json.dumps(
            {
                "modulo": "ordenes_compra",
                "origen": "workflow",
                "tipo": "adjunto_libre",
                "paso": ,
                "nombrePaso": "",
                "nombreAccion": "",
                "observaciones": comentarios or "",
            }
        )

        print(f"\nSubiendo archivo adjunto a orden {id_orden}...")
        print(f"Metadata: {metadata}")
        resp_arch = subir_archivo_adjunto(
            api_key=resolved_password,
            archivo_path=archivo,
            entidad_tipo="OrdenCompra",
            entidad_id=id_orden,
            carpeta=carpeta,
            metadata=metadata,
            user_id=ANONYMOUS_USER_ID,
        )
        print_response(resp_arch, "SUBIR ARCHIVO ADJUNTO")

        if resp_arch.status_code not in (200, 201):
            print("Error al subir archivo adjunto.")
            sys.exit(1)

        print("\nArchivo adjunto subido exitosamente.")
