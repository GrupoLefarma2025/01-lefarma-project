import requests
import json

BASE_URL = "http://localhost:5174"
MASTER_PASSWORD = "tt01tt"

def crear_orden_anonima(
    id_empresa: int,
    id_sucursal: int,
    id_area: int,
    id_tipo_gasto: int,
    fecha_limite_pago: str,
    id_moneda: int,
    tipo_cambio: float,
    id_proveedor: int,
    sin_datos_fiscales: bool,
    requiere_pago_anticipado: bool,
    nota_forma_pago: str,
    notas_generales: str,
    ids_cuentas_bancarias: list[int],
    ids_forma_pago: list[int],
    numero_mensualidades: int,
    partidas: list[dict],
) -> requests.Response:
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

    headers = {
        "X-Master-Password": MASTER_PASSWORD,
        "Content-Type": "application/json",
    }

    return requests.post(f"{BASE_URL}/api/ordenes/interface", headers=headers, json=payload)


def partida(
    descripcion: str,
    cantidad: int,
    id_unidad_medida: int,
    precio_unitario: float,
    descuento: float,
    porcentaje_iva: float,
    total_retenciones: float,
    otros_impuestos: float,
    requiere_factura: bool,
    deducible: bool,
    id_proveedor: int | None = None,
    id_cuenta_bancaria: int | None = None,
) -> dict:
    return {
        "descripcion": descripcion,
        "cantidad": cantidad,
        "idUnidadMedida": id_unidad_medida,
        "precioUnitario": precio_unitario,
        "descuento": descuento,
        "porcentajeIva": porcentaje_iva,
        "totalRetenciones": total_retenciones,
        "otrosImpuestos": otros_impuestos,
        "requiereFactura": requiere_factura,
        "deducible": deducible,
        "idProveedor": id_proveedor,
        "idCuentaBancaria": id_cuenta_bancaria,
    }


if __name__ == "__main__":
    resp = crear_orden_anonima(
        id_empresa=7,
        id_sucursal=6,
        id_area=11,
        id_tipo_gasto=2,
        fecha_limite_pago="2026-05-20",
        id_moneda=1,
        tipo_cambio=1,
        id_proveedor=12,
        sin_datos_fiscales=False,
        requiere_pago_anticipado=True,
        nota_forma_pago="ir a ventanilla y pagar con billullos",
        notas_generales="observaciones comentario",
        ids_cuentas_bancarias=[98],
        ids_forma_pago=[6],
        numero_mensualidades=1,
        partidas=[
            partida(
                descripcion="WD - Disco Duro Externo de computadora de 12 TB",
                cantidad=2,
                id_unidad_medida=36,
                precio_unitario=3000,
                descuento=100,
                porcentaje_iva=16,
                total_retenciones=100,
                otros_impuestos=9,
                requiere_factura=True,
                deducible=False,
            ),
            partida(
                descripcion="Mouse",
                cantidad=1,
                id_unidad_medida=36,
                precio_unitario=200,
                descuento=10,
                porcentaje_iva=0,
                total_retenciones=2,
                otros_impuestos=2,
                requiere_factura=False,
                deducible=False,
            ),
        ],
    )

    print(f"Status: {resp.status_code}")
    print(json.dumps(resp.json(), indent=2, ensure_ascii=False))
