import requests
import json
import argparse
import sys

# ============================================================
# CONFIGURACIÓN — Reemplazá los None por valores para omitir
# los argumentos CLI correspondientes.
# ============================================================

BASE_URL = "http://localhost:5174"
MASTER_PASSWORD = "tt01tt"
ANONYMOUS_USER_ID = 25

ID_EMPRESA = 1
ID_SUCURSAL = 1
ID_AREA = 1
ID_TIPO_GASTO = 1
FECHA_LIMITE_PAGO = "2026-06-18"
ID_MONEDA = 1
TIPO_CAMBIO = 1.0
ID_PROVEEDOR = 1
SIN_DATOS_FISCALES = False
REQUIERE_PAGO_ANTICIPADO = False
NOTA_FORMA_PAGO = ""
NOTAS_GENERALES = ""
IDS_CUENTAS_BANCARIAS = [98]
IDS_FORMA_PAGO = [6]
NUMERO_MENSUALIDADES = 1

PARTIDAS = [
    {
        "descripcion": "Producto de prueba",
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


def crear_orden_anonima(payload: dict, master_password: str) -> requests.Response:
    headers = {
        "X-Master-Password": master_password,
        "Content-Type": "application/json",
    }
    return requests.post(f"{BASE_URL}/api/ordenes/interface", headers=headers, json=payload)


def parse_bool(v: str) -> bool:
    return v.lower() in ("true", "1", "yes", "si")


def parse_nullable_int(v: str) -> int | None:
    return int(v) if v.lower() not in ("null", "none", "") else None


if __name__ == "__main__":
    p = argparse.ArgumentParser(description="Crear orden anónima via API")

    p.add_argument("--master-password", type=str, default=None)
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
    p.add_argument("--ids-cuentas-bancarias", type=int, nargs="+", default=None, help="Ej: 98 99")
    p.add_argument("--ids-forma-pago", type=int, nargs="+", default=None, help="Ej: 6 7")
    p.add_argument("--numero-mensualidades", type=int, default=None)

    p.add_argument(
        "--partida",
        action="append",
        nargs=11,
        metavar=(
            "DESC", "CANT", "UNIDAD", "PRECIO", "DESCUENTO",
            "IVA", "RETENCIONES", "OTROS_IMP", "FACTURA", "DEDUCIBLE",
            "ID_PROVEEDOR",
        ),
        default=None,
    )

    args = p.parse_args()

    resolved_password = MASTER_PASSWORD or args.master_password or "tt01tt"

    id_empresa = ID_EMPRESA if ID_EMPRESA is not None else args.id_empresa
    id_sucursal = ID_SUCURSAL if ID_SUCURSAL is not None else args.id_sucursal
    id_area = ID_AREA if ID_AREA is not None else args.id_area
    id_tipo_gasto = ID_TIPO_GASTO if ID_TIPO_GASTO is not None else args.id_tipo_gasto
    fecha_limite_pago = FECHA_LIMITE_PAGO if FECHA_LIMITE_PAGO is not None else args.fecha_limite_pago
    id_moneda = ID_MONEDA if ID_MONEDA is not None else args.id_moneda
    tipo_cambio = TIPO_CAMBIO if TIPO_CAMBIO is not None else (args.tipo_cambio or 1.0)
    id_proveedor = ID_PROVEEDOR if ID_PROVEEDOR is not None else args.id_proveedor
    sin_datos_fiscales = SIN_DATOS_FISCALES if SIN_DATOS_FISCALES is not None else args.sin_datos_fiscales
    requiere_pago_anticipado = REQUIERE_PAGO_ANTICIPADO if REQUIERE_PAGO_ANTICIPADO is not None else args.requiere_pago_anticipado
    nota_forma_pago = NOTA_FORMA_PAGO if NOTA_FORMA_PAGO is not None else (args.nota_forma_pago or "")
    notas_generales = NOTAS_GENERALES if NOTAS_GENERALES is not None else (args.notas_generales or "")
    ids_cuentas_bancarias = IDS_CUENTAS_BANCARIAS if IDS_CUENTAS_BANCARIAS is not None else args.ids_cuentas_bancarias
    ids_forma_pago = IDS_FORMA_PAGO if IDS_FORMA_PAGO is not None else args.ids_forma_pago
    numero_mensualidades = NUMERO_MENSUALIDADES if NUMERO_MENSUALIDADES is not None else (args.numero_mensualidades or 1)

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
        print("Faltan campos requeridos. Definilos como constantes o pasalos por CLI:\n")
        for m in missing:
            print(f"  - {m}")
        sys.exit(1)

    if PARTIDAS is not None:
        partidas = PARTIDAS
    elif args.partida is not None:
        partidas = []
        for p_args in args.partida:
            partidas.append({
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
            })
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

    print(f"MasterPassword: {resolved_password}")
    if ANONYMOUS_USER_ID is not None:
        print(f"AnonymousUserId (ref servidor): {ANONYMOUS_USER_ID}")
    print()
    print("Enviando payload:")
    print(json.dumps(payload, indent=2, ensure_ascii=False))
    print()

    resp = crear_orden_anonima(payload, resolved_password)
    print(f"Status: {resp.status_code}")
    print(json.dumps(resp.json(), indent=2, ensure_ascii=False))
