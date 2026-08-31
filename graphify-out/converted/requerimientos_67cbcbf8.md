<!-- converted from requerimientos.docx -->

Capturista inicial: Se loguea
Seleccionar empresa (Asokam, Lefarma, Artricenter, Constumedika, GrupoLefarma) (En el catálogo se le agregará la persona que realizará los pagos)
Seleccionar Sucursal (Diego me da las sucursales x empresa)
Por ejemplo, Asokam tiene “Antonio Maura, Cedis y Guadalajara”
Lefarma tiene: “Planta y Mancera”
Artricenter tiene “Viaducto, La raza, Atizapán”
Seleccionar área (Diego solicita a RH Las áreas)
Selecciono un tipo de gasto (Catálogo pendiente x definir)
Fecha límite de pago
Fecha de solicitud (La toma del sistema)
Capturar proveedor, pero sin no existe
Check sin datos fiscales
Razón social o nombre si es sin datos fiscales
RFC	(Desactivado si es sin datos fiscale)
Código postal (Desactivado si es sin datos fiscale)
Régimen fiscal   (Desactivado si es sin datos fiscale)
Persona de contacto (Nombre, teléfono, email)
El usuario captura pero solo si CxP autoriza se registra en el catálogo (Correo 44@grupolefarma.com.mx)
Captura nota de formas de pago (ej. 50% anticipo) Ocpional
Capturar notas generales de la Orden de Compra Opcional
Desglose de lo que se comprará (Tantas líneas como sea necesario)
- Descripción del producto
- Cantidad (Permitir decimales (2))
- Unidad de medida (Piezas, Servicio, Kilos, Litros, Metros)
- Precio unitario
- Descuento total (Default 0)
- % IVA (Default 16)
- Retenciones totales (Default 0)
- Otros impuestos totales (Default 0)
- Check de deducible/no deducible (Entregan factura?) (Default deducible)
- Total se calcula automáticamente ((Precio unitario * cantidad)-descuento) * (1+(IVA/100)) – retenciones +otros impuestos

Esto se puede repetir tanto como se desee (Las partidas). Forzoso tener al menos 1 partida
Forma de pago (Forzoso)
Al guardar se genera un folio automático y consecutivo irrepetible
Subir hasta 4 cotizaciones (PDF, Excel, Word) Opcionales
Autorizaciones
Quién lo elabora (Automático)

Firma 2: Gerente general de la empresa (Se toma x sucursal)
Para Lefarma se detecta por la ubicación si es CDMX o Gdl
En Guadalajara Lefarma Martha Anaya
Diego me dice los usuarios finales que harán el pago por empresa)
en CDMX Lefarma: Alfredo Corona
Si la firma 2 no se autoriza, se rechaza y se le avisa al usuario (Exigir capturar motivo)
Después de la firma2, se va a Firma3 (Polo de CxP)
Polo revisa la información (Formato, soportes documentales, tiempos calendario)
Si todo está bien, el asigna forzosamente el centro de costo y cuenta contable (Catálogo pendiente x definir)
Si lo rechaza, se le avisa al usuario original y al jefe con un motivo de forzoso de rechazo
Si se autorizó la firma3, le llega a Gerente de Admon y Finanzas
Si se autoriza, se va a dirección corporativa
Si no se autoriza, se rechaza y se le avisa a los 3 anteriores  (Se captura motivo forzoso)
El podrá capturar un check diciendo “Requiere comprobación de pago” o “Requiere comprobación de gasto” Por default ambas marcadas
En dirección general, se autoriza, se le avisa al usuario y gerente de área más la persona que va a realizar el pago
Si no se autoriza, se rechaza el gasto y se captura motivo de rechazo avisándole a los 4 anteriores
La persona que hace el pago podrá entrar al sistema y subir la comprobación del pago (Imagen) capturando el importe pagado Y se le avisa al usuario. Esto lo puede hacer tantas veces hasta completar el pago. En cada pago le debe avisar al usuario que generó el gasto de que ya se realizó.

Recibirá diariamente por correo un aviso de todos los pagos pendientes por realizar ya autorizados por dirección y que tengan marcados “Requiere comprobación de pago” más un reporte consultable cuando quiera.

Finalmente, el usuario que generó el gasto, me deberán subir tantos XML/PDF y/o comprobantes sin factura (Si se habilitó gasto no deducible) como sea necesario hasta llegar al importe señalado.
El importe se calcula automáticamente extrayéndolo del XML y para los no deducibles, me deberán capturar el importe y la imagen del comprobante.
Explicación del no deducible: También podrán subir comprobantes que no sean XML’s (Tickets de taxi con una firma del jefe) y capturarán su importe
Finalmente de forma opcional una ficha de depósito a un banco para completar el importe pagado y de igual forma deberán capturar el importe
Se permite capturar un excedente de la solicitud original pero nunca menos
El gran total es la suma de los xml’s más la suma de no deducibles más el importe depositado en banco.
Al subir una comprobación, le llega a CxP que ya subió su comprobación para que lo valide
Si el usuario de CxP valida hasta ahí se cierra el ciclo
Si el usuario de CxP rechaza, se le notifica al usuario para que corrija la comprobación
En un futuro, veremos si bloqueamos la captura de nuevas solicitudes si el usuario tiene más de X comprobaciones pendientes o tiene al menos una comprobación con más de Y días sin comprobar.
Se deberá crear un reporte con aquellas comprobaciones pendientes
- De Pago
- De comprobar
Se deberá crear un reporte con aquellas comprobaciones 100 liberadas filtrando por empresa, sucursal, fechas, usuario, tipo de gasto




El Abc de cuentas contables/centros de costos, lo hace Polo, pero lo debe autorizar Gerencia de Admon para que surta efecto
Considerar sistema de alertas para la persona que debe pagar a menos que esté marcado como “No requiere comprobación de pago”
Al momento de pagar, se debe subir el comprobante del depósito y con esto se asume que ya se pagó.




