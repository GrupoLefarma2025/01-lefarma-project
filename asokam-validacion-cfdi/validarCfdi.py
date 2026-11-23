from zeep import Client
from zeep.transports import Transport
from weasyprint import HTML, CSS
import xmltodict
import json
import pyodbc
import subprocess
import requests
from datetime import datetime
import argparse
import sys
import os
import glob
import re
import chardet

# --- CONFIGURACIÓN ---
SERVER = "192.168.4.2"
DATABASE = "Asokam"
USERNAME = "poweru"
PASSWORD = "cGuzman$$001#"

# Rutas y URLs
RUTA_RED_ASOKAM = r'\\192.168.5.12\Asokam'
USUARIO_RED = 'robot.odoo'
PASSWORD_RED = 'R0b0t@Od00#24'
URL_SAT_CONSULTA = 'https://consultaqr.facturaelectronica.sat.gob.mx/ConsultaCFDIService.svc'
URL_SAT_VERIFICACION = 'https://verificacfdi.facturaelectronica.sat.gob.mx'
RUTA_FACTURAS = RUTA_RED_ASOKAM + r'\Facturas'
RUTA_LOGO = 'C:/Sistemas/Script/img/Logo.jpg'
RUTA_FONT_YOUNG_SERIF = 'C:/Sistemas/Script/img/YoungSerif-Bold.ttf'
RUTA_SALIDA_PDF = RUTA_FACTURAS + r'\DocumentosSalida\validacionCFDi'

try:
    sys.stdout.reconfigure(encoding='utf-8')
except AttributeError:
    pass


def salida(data):
    """Imprime el JSON en ASCII puro.

    xp_cmdshell lee los bytes de salida con la codificación del servidor, así
    que con ensure_ascii=False los acentos llegaban rotos ("aceptaci├│n").
    Con \\uXXXX SQL Server los interpreta bien y JSON_VALUE devuelve el texto
    correcto.
    """
    print(json.dumps(data, ensure_ascii=True))


def txt(valor):
    """Convierte a texto sin dejar pasar el literal 'None'."""
    if valor is None or str(valor) == 'None':
        return ''
    return str(valor)


def nombre_seguro(texto):
    """Quita de un nombre de archivo los caracteres que Windows no acepta."""
    return re.sub(r'[<>:"/\\|?*]', '_', texto).strip()


def conectar_recurso():
    """Deja lista la sesión de red hacia el share, sin depender de una letra.

    xp_cmdshell corre en la sesión del servicio de SQL Server, que no ve la
    unidad Y: mapeada en el escritorio. Autenticamos el UNC directamente para
    que las rutas \\\\192.168.5.12\\Asokam\\... funcionen.
    """
    try:
        subprocess.run(['net', 'use', RUTA_RED_ASOKAM, '/delete', '/y'],
                       capture_output=True, text=True, timeout=30)
        r = subprocess.run(['net', 'use', RUTA_RED_ASOKAM,
                            f'/user:{USUARIO_RED}', PASSWORD_RED],
                           capture_output=True, text=True, timeout=30)
        if r.returncode != 0:
            detalle = (r.stderr or r.stdout or '').strip()
            print(f'[aviso] no se pudo autenticar el share: {detalle}')
    except Exception as e:
        print(f'[aviso] net use: {e}')


def main():
    try:
        connectionString = f"DRIVER={{SQL Server}};SERVER={SERVER};DATABASE={DATABASE};UID={USERNAME};PWD={PASSWORD}"
        connection = pyodbc.connect(connectionString)
        cursor = connection.cursor()

        parser = argparse.ArgumentParser(description="Programa que recibe valores desde la terminal")
        parser.add_argument("documento", help="No documento")
        args = parser.parse_args()

        queryCFDI = ("select codigoDocumento, fechaFactura, folioDocumento, nombreCliente, estatusSAT "
                     "from cfdiDocumentos "
                     "where validacionCFDIDescargada = 0 and descargado = 1 and folioDocumento = ?")
        cursor.execute(queryCFDI, (args.documento,))
        cfdi = cursor.fetchall()

        conectar_recurso()

        if len(cfdi) > 0:
            os.makedirs(RUTA_SALIDA_PDF, exist_ok=True)
            resultados = [procesar_factura(c, cursor) for c in cfdi]
            errores = [r for r in resultados if r.get('Error')]
            if errores:
                salida(errores[0])
            else:
                data = resultados[-1]
                data['Procesados'] = len(resultados)
                salida(data)
        else:
            # El WHERE no devolvió filas. En vez de devolver "...", se consulta
            # qué hay con ese folio en ESTA base y se dice el motivo exacto.
            cursor.execute("select codigoDocumento, descargado, validacionCFDIDescargada "
                           "from cfdiDocumentos where folioDocumento = ? "
                           "order by codigoDocumento", (args.documento,))
            filas = cursor.fetchall()

            if not filas:
                salida({"CodigoEstatus": "NO_ENCONTRADO",
                        "Error": f"El folio '{args.documento}' no existe en {DATABASE} "
                                 f"({SERVER}). Verifica que estés pasando el folioDocumento "
                                 f"y no el codigoDocumento, y que sea el servidor correcto."})
            else:
                detalle = '; '.join(
                    f"codigoDocumento={f[0]} descargado={f[1]} validacionCFDIDescargada={f[2]}"
                    for f in filas)
                if all(f[2] == 1 for f in filas):
                    salida({"CodigoEstatus": "YA_VALIDADO",
                            "Error": f"El folio {args.documento} ya se validó antes: {detalle}. "
                                     f"Para repetirlo pon validacionCFDIDescargada = 0."})
                else:
                    salida({"CodigoEstatus": "NO_ELEGIBLE",
                            "Error": f"El folio {args.documento} existe pero no cumple el filtro: "
                                     f"{detalle}. Se necesitan descargado = 1 y "
                                     f"validacionCFDIDescargada = 0."})

    except Exception as e:
        salida({"CodigoEstatus": "ERROR", "Error": str(e)})


def procesar_factura(c, cursor):
    try:
        # 1. Datos
        folio_doc = (c[2] or '').strip()
        folio_seguro = '*' if '/' in folio_doc else folio_doc
        nombreClienteseguro = c[3]
        # fechaFactura es tipo date: pyodbc entrega datetime.date, no str.
        fechaFacturaObj = datetime.strptime(str(c[1])[:10], "%Y-%m-%d")

        ruta = fechaFacturaObj.strftime("%Y/%m")
        fechaFacturaStr = fechaFacturaObj.strftime("%Y-%m-%d")

        name_xml = r"{}-{}-{}.xml".format(fechaFacturaStr, folio_seguro, nombreClienteseguro)
        names = r"{}-{}-{}".format(c[1], folio_seguro, nombreClienteseguro)
        print("======================================")
        print(name_xml)
        print("======================================")

        urlFile = os.path.join(RUTA_FACTURAS, ruta, name_xml)
        urlServices = URL_SAT_CONSULTA

        # 2. XML
        try:
            if '/' in folio_doc:
                dir_path = os.path.join(RUTA_FACTURAS, ruta)
                pattern = f"{fechaFacturaStr}-*-{nombreClienteseguro}.xml"
                candidatos = glob.glob(os.path.join(dir_path, pattern))
                if not candidatos:
                    raise FileNotFoundError("XML no encontrado")
                urlFile = candidatos[0]
                names = os.path.basename(os.path.splitext(urlFile)[0])
                with open(urlFile, 'r', encoding='utf-8', errors='ignore') as f:
                    data_xml = f.read()
            else:
                with open(urlFile, 'rb') as file:
                    raw = file.read()
                    enc = chardet.detect(raw)['encoding'] or 'utf-8'
                with open(urlFile, 'r', encoding=enc) as file:
                    data_xml = file.read()

            data_dict = xmltodict.parse(data_xml)
            comp = data_dict["cfdi:Comprobante"]
        except Exception as e:
            raise Exception(f"Error XML: {e}")

        # 3. Extracción
        rfc_emisor = comp["cfdi:Emisor"]["@Rfc"]
        rfc_receptor = comp["cfdi:Receptor"]["@Rfc"]
        total_raw = comp["@Total"]
        uuid = comp["cfdi:Complemento"]["tfd:TimbreFiscalDigital"]["@UUID"]
        razonSocial = comp["cfdi:Emisor"]["@Nombre"]
        razonSocialReceptor = comp["cfdi:Receptor"]["@Nombre"]
        fechaExpedicion = comp["@Fecha"]
        fechaCerticado = comp["cfdi:Complemento"]["tfd:TimbreFiscalDigital"]["@FechaTimbrado"]
        PACCertificado = comp["cfdi:Complemento"]["tfd:TimbreFiscalDigital"]["@RfcProvCertif"]
        tipo_comp = comp["@TipoDeComprobante"]
        valueComprobante = "Ingreso" if tipo_comp == "I" else "Egreso"
        total_str = f"${float(total_raw):,.2f}"

        # --- CORRECCIÓN UUID Y FECHAS ---
        uuid_safe = uuid.replace('-', '- ')

        # Insertar salto de línea en fechas para igualar formato visual: 2025-12- <br> 26T09:40:39
        def format_date_wrap(date_str):
            # Asumiendo formato ISO YYYY-MM-DDTHH:MM:SS
            # Queremos romper después del segundo guion (YYYY-MM-)
            parts = date_str.split('-')
            if len(parts) >= 3:
                # parts[0] = YYYY, parts[1] = MM, parts[2] = DDTHH:MM:SS
                return f"{parts[0]}-{parts[1]}-<br/>{parts[2]}"
            return date_str

        fechaExpedicion = format_date_wrap(fechaExpedicion)
        fechaCerticado = format_date_wrap(fechaCerticado)

        # 4. SAT
        expresion = f"?re={rfc_emisor}&rr={rfc_receptor}&tt={total_raw}&id={uuid}"
        client = Client(urlServices, transport=Transport(session=requests.Session()))
        response = client.service.Consulta(expresionImpresa=expresion)

        # Variables SAT
        estado_cfdi = txt(getattr(response, 'Estado', None))
        estatus_cancelacion = txt(getattr(response, 'EstatusCancelacion', None))
        if not estatus_cancelacion:
            estatus_cancelacion = 'Cancelable con aceptación'

        # 5. PDF
        now = datetime.now()
        am_pm = "a.m." if now.hour < 12 else "p.m."
        hora_12 = now.strftime("%I").lstrip('0')
        # Formato tipo: 6/1/26, 10:01 a.m.
        fecha_impresion = f"{now.day}/{now.month}/{now.strftime('%y')}, {hora_12}:{now.strftime('%M')} {am_pm}"

        html_content = f"""
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <style>
        @font-face {{
            font-family: 'Young Serif';
            src: url('file:///{RUTA_FONT_YOUNG_SERIF.replace(chr(92), '/')}');
        }}
        
        @page {{
            size: letter;
            margin-top: 3.5cm;
            margin-bottom: 2.0cm;
            margin-left: 1.5cm;
            margin-right: 1.5cm;

            @top-left {{
                content: '{fecha_impresion}';
                font-family: 'Arial MT', Arial, sans-serif;
                font-size: 11px;
                color: #444;
            }}

            @top-center {{
                content: 'Verificación de Comprobantes Fiscales Digitales por Internet';
                font-family: 'Arial MT', Arial, sans-serif;
                font-size: 11px;
                color: #444;
            }}

            @bottom-left {{
                content: '{URL_SAT_VERIFICACION}';
                font-family: 'Arial MT', Arial, sans-serif;
                font-size: 11px;
                color: #444;
            }}

            @bottom-right {{
                content: '1/1';
               font-family: 'Arial MT', Arial, sans-serif;
                font-size: 11px;
                color: #444;
            }}
        }}
        
        body {{
            font-family: Helvetica, sans-serif;
            font-size: 16px;
            color: #333;
            line-height: 1.4;
        }}

        .main-table {{
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
            font-family: Helvetica, sans-serif;
        }}

        .main-table th {{
            text-align: left;
            font-weight: bold;
            font-size: 16px;
            padding: 10px 12px 5px 12px;
            color: #000;
            vertical-align: top;
            width: 25%;
            border-bottom: 1px solid #d3d3d3;
            line-height: 1.3;
        }}

        .main-table td {{
            text-align: left;
            font-size: 16px;
            vertical-align: top;
            padding: 5px 12px 10px 12px;
            color: #666;
            width: 25%;
            line-height: 1.4;
            border-bottom: 1px solid #d3d3d3;
        }}

        h1 {{
            font-family: 'Young Serif', Georgia, serif;
            font-size: 24px;
            font-weight: 900;
            margin-bottom: 20px;
            margin-top: 25px;
            color: #000;
            line-height: 1.3;
        }}
    </style>
</head>
<body>
    <img src="file:///{RUTA_LOGO.replace(chr(92), '/')}" style="height: 45px; margin-bottom: 40px; margin-top: 35px;" alt="SAT">

    <h1 style="margin-top: 40px;">Verificación de comprobantes fiscales digitales por<br/>internet</h1>

    <table class="main-table">
        <tr>
            <th>RFC del emisor</th>
            <th>Nombre o<br/>razón social del<br/>emisor</th>
            <th>RFC del<br/>receptor</th>
            <th>Nombre o razón<br/>social del receptor</th>
        </tr>
        <tr>
            <td>{rfc_emisor}</td>
            <td>{razonSocial}</td>
            <td>{rfc_receptor}</td>
            <td>{razonSocialReceptor}</td>
        </tr>

        <tr>
            <th>Folio fiscal</th>
            <th>Fecha de<br/>expedición</th>
            <th>Fecha<br/>certificación<br/>SAT</th>
            <th style="white-space: nowrap;">PAC que certificó</th>
        </tr>
        <tr>
            <td>{uuid_safe}</td>
            <td>{fechaExpedicion}</td>
            <td>{fechaCerticado}</td>
            <td>{PACCertificado}</td>
        </tr>

        <tr>
            <th>Total del CFDI</th>
            <th>Efecto del<br/>comprobante</th>
            <th>Estado CFDI</th>
            <th>Estatus de<br/>cancelación</th>
        </tr>
        <tr>
            <td>{total_str}</td>
            <td>{valueComprobante}</td>
            <td>{estado_cfdi}</td>
            <td>{estatus_cancelacion}</td>
        </tr>
    </table>
</body>
</html>
"""

        path_pdf = os.path.join(RUTA_SALIDA_PDF, nombre_seguro(names) + '.pdf')

        # USAR WEASYPRINT EN LUGAR DE xhtml2pdf
        HTML(string=html_content).write_pdf(path_pdf)

        # Se marca por codigoDocumento, no por folio: un folio puede tener
        # varias filas y así no se dan por validadas las que fallaron.
        cursor.execute("update cfdiDocumentos set validacionCFDIDescargada = 1 "
                       "where codigoDocumento = ?", (c[0],))
        cursor.commit()

        return {
            "CodigoEstatus": txt(getattr(response, "CodigoEstatus", None)),
            "EsCancelable": txt(getattr(response, "EsCancelable", None)),
            "Estado": estado_cfdi,
            "EstatusCancelacion": estatus_cancelacion,
            "ValidacionEFOS": txt(getattr(response, "ValidacionEFOS", None)),
            "Error": ""
        }

    except Exception as e:
        return {"CodigoEstatus": "ERROR", "Error": str(e)}


if __name__ == "__main__":
    main()
