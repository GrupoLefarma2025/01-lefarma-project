# Especificaciones del Sistema de Ordenes de Compra
## Grupo Lefarma - Cuentas por Pagar

**Version:** 2.0  
**Fecha:** Marzo 2026  
**Documentos base:** requerimientos.docx, LEF-AYF-DDP-002, LEF-AYF-MGP-002, Catalogo Contable Corporativo.xlsx

---

## 1. Resumen del Sistema

Sistema web para la gestion del proceso de ordenes de compra y cuentas por pagar de Grupo Lefarma, incluyendo:
- Flujo de autorizaciones multinivel (5 firmas)
- Comprobacion de gastos (XML/PDF y no deducibles)
- Conciliacion de pagos
- Integracion con sistema contable

---

## 2. Empresas del Grupo

| # | Empresa | Prefijo | Sucursales |
|---|---------|---------|------------|
| 1 | Asokam | ASK | Antonio Maura (101), Cedis (103), Guadalajara (102) |
| 2 | Lefarma | LEF | Planta (101), Mancera (102) |
| 3 | Artricenter | ATC | Viaducto (101), La Raza (102), Atizapan (103) |
| 4 | Construmedika | CON | Unica |
| 5 | GrupoLefarma (Corporativo) | GRP | Oficinas centrales |

---

## 3. Flujo de Autorizaciones

```
+-----------------+     +-----------------+     +------------------+
|   CAPTURISTA    |---->|    FIRMA 2      |---->|     FIRMA 3      |
|   (Solicitante) |     | Gerente General |     |   CxP (Polo)     |
|   Crea orden    |     | x Sucursal      |     | Asigna cuentas   |
+-----------------+     +--------+--------+     +--------+---------+
                                 |                       |
                        Autoriza |                       | Autoriza
                                 v                       v
                        +-----------------+     +------------------+
                        |    FIRMA 4      |---->|     FIRMA 5      |
                        | Gerente Admon/  |     |   Direccion      |
                        | Finanzas        |     | Corporativa      |
                        +--------+--------+     +--------+---------+
                                 |                       |
                        Autoriza |                       | Autoriza
                                 v                       v
                        +-----------------+     +------------------+
                        |    TESORERIA    |---->|  COMPROBACION    |
                        | Realiza pago    |     | Usuario sube     |
                        | Sube comprobante|     | XML/PDF          |
                        +-----------------+     +--------+---------+
                                                         |
                                                 Valida CxP
                                                         v
                                                +------------------+
                                                |   CICLO CERRADO  |
                                                +------------------+
```

---

## 4. Modulo: Captura de Orden de Compra

### 4.1 Datos Generales

| Campo | Tipo | Requerido | Descripcion |
|-------|------|-----------|-------------|
| Empresa | Select | Si | Asokam, Lefarma, Artricenter, Construmedika, GrupoLefarma |
| Sucursal | Select | Si | Segun empresa seleccionada |
| Area | Select | Si | Ver Catalogo de Areas (Seccion 9) |
| Tipo de gasto | Select | Si | Fijo, Variable, Extraordinario |
| Fecha limite de pago | Date | Si | - |
| Fecha de solicitud | Date | Auto | La toma el sistema |
| Elaborado por | Text | Auto | Usuario logueado |

### 4.2 Datos del Proveedor

| Campo | Tipo | Requerido | Notas |
|-------|------|-----------|-------|
| Sin datos fiscales | Check | No | Si marcado, desactiva RFC, CP, Regimen |
| Razon social / Nombre | Text | Si | - |
| RFC | Text | Condicional | 12/13 caracteres |
| Codigo postal | Text | Condicional | 5 digitos |
| Regimen fiscal | Select | Condicional | SAT catalogo |
| Persona de contacto | Text | No | Nombre, telefono, email |
| Nota forma de pago | Text | No | Ej: "50% anticipo" |
| Notas generales | Text | No | - |

**Nota:** El proveedor solo se registra en el catalogo si CxP autoriza.

### 4.3 Partidas (Detalle de Compra)

| Campo | Tipo | Requerido | Default |
|-------|------|-----------|---------|
| Descripcion del producto | Text | Si | - |
| Cantidad | Decimal(2) | Si | - |
| Unidad de medida | Select | Si | Piezas, Servicio, Kilos, Litros, Metros |
| Precio unitario | Decimal(2) | Si | - |
| Descuento total | Decimal(2) | No | 0 |
| % IVA | Decimal(2) | No | 16 |
| Retenciones totales | Decimal(2) | No | 0 |
| Otros impuestos totales | Decimal(2) | No | 0 |
| Deducible | Check | No | Si (entregan factura) |

**Formula de Total:**
```
Total = ((Precio unitario * Cantidad) - Descuento) * (1 + IVA/100) - Retenciones + OtrosImpuestos
```

**Reglas:**
- Minimo 1 partida obligatoria
- Se pueden agregar N partidas

### 4.4 Forma de Pago

| Opcion | Descripcion |
|--------|-------------|
| Pago a contado | Pago total al momento |
| Pago a credito | Pago diferido segun acuerdo con proveedor |
| Pago parcial | Anticipo + saldo pendiente |

### 4.5 Documentos Adjuntos

- Hasta 4 cotizaciones (PDF, Excel, Word)
- Opcionales

### 4.6 Al Guardar

- Generar folio automatico consecutivo irrepetible
- Formato sugerido: `OC-YYYY-NNNNN` (Ej: OC-2026-00001)

---

## 5. Modulo: Autorizaciones

### 5.1 Firma 2 - Gerente General de Empresa

**Asignacion por sucursal:**
| Empresa | Sucursal | Responsable |
|---------|----------|-------------|
| Lefarma | Guadalajara | Martha Anaya |
| Lefarma | CDMX | Alfredo Corona |
| Artricenter | Viaducto | Por definir |
| Artricenter | La Raza | Por definir |
| Artricenter | Atizapan | Por definir |
| Asokam | Antonio Maura | Por definir |
| Asokam | Guadalajara | Por definir |
| Asokam | Cedis | Por definir |

**Acciones:**
| Accion | Resultado |
|--------|-----------|
| Autoriza | Pasa a Firma 3 |
| Rechaza | Avisa al usuario (motivo obligatorio) |

### 5.2 Firma 3 - CxP (Polo)

**Responsable:** CP. Marco Polo Narvaez Oropeza

**Responsabilidades:**
- Revisar formato de la orden
- Verificar soportes documentales
- Verificar tiempos calendario
- **Asignar centro de costo** (obligatorio) - Ver Seccion 9
- **Asignar cuenta contable** (obligatorio) - Ver Seccion 10

**Acciones:**
| Accion | Resultado |
|--------|-----------|
| Autoriza | Pasa a Firma 4 |
| Rechaza | Avisa a usuario + jefe (motivo obligatorio) |

### 5.3 Firma 4 - Gerente Admon y Finanzas

**Responsable:** CP. Diego Angel Villaseñor Garduño

**Checks adicionales:**
| Check | Default | Descripcion |
|-------|---------|-------------|
| Requiere comprobacion de pago | Marcado | El usuario debe comprobar el pago |
| Requiere comprobacion de gasto | Marcado | El usuario debe comprobar el gasto |

**Acciones:**
| Accion | Resultado |
|--------|-----------|
| Autoriza | Pasa a Firma 5 |
| Rechaza | Avisa a los 3 anteriores (motivo obligatorio) |

### 5.4 Firma 5 - Direccion Corporativa

**Responsable:** Lic. Hector Velez Rivera

**Acciones:**
| Accion | Resultado |
|--------|-----------|
| Autoriza | Avisa a usuario + gerente + persona que paga |
| Rechaza | Avisa a los 4 anteriores (motivo obligatorio) |

---

## 6. Modulo: Tesoreria (Pagos)

### 6.1 Notificaciones

- Correo diario con pagos pendientes autorizados por Direccion
- Solo si tiene marcado "Requiere comprobacion de pago"
- Reporte consultable bajo demanda

### 6.2 Proceso de Pago

1. Recibir orden autorizada
2. Programar pago segun acuerdo con proveedor
3. Realizar pago (transferencia, cheque, efectivo)
4. Subir comprobante de deposito (imagen/PDF)
5. Capturar importe pagado
6. Avisar al usuario que genero el gasto

**Reglas:**
- Puede hacer multiples pagos hasta completar
- Cada pago notifica al usuario

---

## 7. Modulo: Comprobacion de Gastos

### 7.1 Tipos de Comprobante

| Tipo | Descripcion | Importe |
|------|-------------|---------|
| XML/PDF (CFDI) | Factura electronica SAT | Se extrae automatico del XML |
| No deducible | Tickets, recibos, taxis | Se captura manual + imagen |
| Deposito bancario | Ficha de deposito | Se captura manual |

### 7.2 Reglas de Comprobacion

- Se pueden subir multiples comprobantes hasta llegar al importe
- Se permite exceder el importe de la solicitud original
- **No se permite** capturar menos del importe

**Formula del Gran Total:**
```
Gran Total = Suma(XMLs) + Suma(No deducibles) + Deposito bancario
```

### 7.3 Validacion CxP

| Accion | Resultado |
|--------|-----------|
| Valida | Ciclo cerrado |
| Rechaza | Notifica usuario para corregir |

---

## 8. Reportes

### 8.1 Comprobaciones Pendientes

Filtros:
- De pago
- De comprobar
- Por usuario
- Por antiguedad

### 8.2 Comprobaciones Liberadas

Filtros:
- Empresa
- Sucursal
- Fechas
- Usuario
- Tipo de gasto
- Cuenta contable
- Centro de costo

### 8.3 Reportes Contables

- Gastos por cuenta contable
- Presupuesto vs Real
- Antiguedad de saldos de proveedores

---

## 9. Catalogo de Centros de Costo

| ID | Centro de Costo | Descripcion |
|----|-----------------|-------------|
| 101 | Operaciones | Produccion, Logistica, Almacen |
| 102 | Administrativo | Recursos Humanos, Contabilidad, Tesoreria |
| 103 | Comercial | Ventas, Marketing, TLMK |
| 104 | Gerencia | Direccion, Calidad, Administracion |

---

## 10. Catalogo Contable Completo

### 10.1 Estructura de Cuentas

**Formato:** `AAA-BBB-CCC-DD`

| Componente | Descripcion |
|------------|-------------|
| AAA | Cuenta mayor (600-604) |
| BBB | Sub-cuenta |
| CCC | Analitica |
| DD | Auxiliar |

### 10.2 Prefijos por Empresa y Sucursal

| Prefijo | Empresa | Sucursal |
|---------|---------|----------|
| ATC-103 | Artricenter | Atizapan |
| ATC-102 | Artricenter | La Raza |
| ATC-101 | Artricenter | Viaducto |
| ASK-102 | Asokam | Guadalajara |
| ASK-101 | Asokam | Antonio Maura |
| ASK-103 | Asokam | Cedis |
| LEF-101 | Lefarma | Planta |
| LEF-102 | Lefarma | Mancera |
| CON-101 | Construmedika | Unica |
| GRP-101 | Grupo Lefarma | Corporativo |

### 10.3 Cuentas de Primer Nivel

| Cuenta | Descripcion |
|--------|-------------|
| 600 | Gastos |
| 601 | Gastos Administrativos |
| 602 | Gastos Financieros |
| 603 | Gastos de Produccion |
| 604 | Gastos Administrativos (Operativos) |

### 10.4 Catalogo Detallado - Gastos Administrativos (601)

#### 601-001 - Gastos de Nomina (Percepciones)

| Cuenta | Descripcion | Ejemplo Artricenter | Ejemplo Asokam |
|--------|-------------|--------------------| ---------------|
| 601-001-001-01 | Sueldos y salarios | ATC-103-101-601-001 | ASK-102-101-601-001 |
| 601-001-002-01 | Premios de asistencia | ATC-103-101-601-001 | ASK-102-101-601-001 |
| 601-001-003-01 | Premios de puntualidad | ATC-103-101-601-001 | ASK-102-101-601-001 |
| 601-001-004-01 | Vacaciones | ATC-103-101-601-001 | ASK-102-101-601-001 |
| 601-001-005-01 | Prima vacacional | ATC-103-101-601-001 | ASK-102-101-601-001 |
| 601-001-006-01 | Prima dominical | ATC-103-101-601-001 | ASK-102-101-601-001 |
| 601-001-007-01 | Gratificaciones | ATC-103-101-601-001 | ASK-102-101-601-001 |
| 601-001-008-01 | Primas de antiguedad | ATC-103-101-601-001 | ASK-102-101-601-001 |
| 601-001-009-01 | Aguinaldo | ATC-103-101-601-001 | ASK-102-101-601-001 |
| 601-001-010-01 | Transporte | ATC-103-101-601-001 | ASK-102-101-601-001 |
| 601-001-011-01 | PTU | ATC-103-101-601-001 | ASK-102-101-601-001 |
| 601-001-012-01 | Aportaciones | ATC-103-101-601-001 | ASK-102-101-601-001 |
| 601-001-013-01 | Prevision social | ATC-103-101-601-001 | ASK-102-101-601-001 |
| 601-001-014-01 | Aportaciones plan de jubilacion | ATC-103-101-601-001 | ASK-102-101-601-001 |
| 601-001-015-01 | Apoyo Automovil | ATC-103-101-601-001 | ASK-102-101-601-001 |
| 601-001-016-01 | Apoyo de Gasolina | ATC-103-101-601-001 | ASK-102-101-601-001 |
| 601-001-017-01 | Apoyo Productividad | ATC-103-101-601-001 | ASK-102-101-601-001 |
| 601-001-018-01 | Bono | ATC-103-101-601-001 | ASK-102-101-601-001 |
| 601-001-019-01 | Apoyo Mantenimiento de auto | ATC-103-101-601-001 | ASK-102-101-601-001 |
| 601-001-020-01 | Apoyo de Tramites Vehiculares | ATC-103-101-601-001 | ASK-102-101-601-001 |
| 601-001-021-01 | Apoyo de Estacionamiento | ATC-103-101-601-001 | ASK-102-101-601-001 |
| 601-001-022-01 | Uniformes | ATC-103-101-601-001 | ASK-102-101-601-001 |

#### 601-002 - Deducciones

| Cuenta | Descripcion | Ejemplo Artricenter | Ejemplo Asokam |
|--------|-------------|--------------------| ---------------|
| 601-002-001-01 | Cuotas al IMSS | ATC-103-101-601-002 | ASK-102-101-601-002 |
| 601-002-002-01 | Aportaciones al INFONAVIT | ATC-103-101-601-002 | ASK-102-101-601-002 |
| 601-002-003-01 | Aportaciones al SAR | ATC-103-101-601-002 | ASK-102-101-601-002 |
| 601-002-004-01 | Otras aportaciones | ATC-103-101-601-002 | ASK-102-101-601-002 |
| 601-002-005-01 | ISR Retenido | ATC-103-101-601-002 | ASK-102-101-601-002 |
| 601-002-006-01 | ISN | ATC-103-101-601-002 | ASK-102-101-601-002 |
| 601-002-007-01 | FONACOT | ATC-103-101-601-002 | ASK-102-101-601-002 |
| 601-002-008-01 | Prestamos | ATC-103-101-601-002 | ASK-102-101-601-002 |
| 601-002-009-01 | Otras Retenciones | ATC-103-101-601-002 | ASK-102-101-601-002 |

#### 601-003 - Indemnizaciones

| Cuenta | Descripcion | Ejemplo Artricenter | Ejemplo Asokam |
|--------|-------------|--------------------| ---------------|
| 601-003-001-01 | Indemnizaciones | ATC-103-101-601-003 | ASK-102-101-601-003 |

#### 601-004 - Marketing

| Cuenta | Descripcion | Ejemplo Artricenter | Ejemplo Asokam |
|--------|-------------|--------------------| ---------------|
| 601-004-001-01 | Cursos y Capacitaciones | ATC-103-101-601-004 | ASK-102-101-601-004 |
| 601-004-002-01 | Beneficios IMSS | ATC-103-101-601-004 | ASK-102-101-601-004 |
| 601-004-003-01 | Cafeteria | ATC-103-101-601-004 | ASK-102-101-601-004 |
| 601-004-004-01 | Donativos | ATC-103-101-601-004 | ASK-102-101-601-004 |

### 10.5 Catalogo Detallado - Todas las Cuentas

| Cuenta Catalogo | Descripcion |
|-----------------|-------------|
| 600-000-000-00 | Gastos |
| 601-000-000-00 | Gastos Administrativos |
| 601-001-000-00 | Gastos de Nomina (Percepciones) |
| 601-002-000-00 | Deducciones |
| 601-003-000-00 | Indemnizaciones |
| 601-004-000-00 | Marketing |
| 601-005-000-00 | Inversiones |
| 601-006-000-00 | Activo Intangible |
| 601-007-000-00 | Oficina |
| 601-008-000-00 | Impuestos |
| 601-009-000-00 | Insumos |
| 601-010-000-00 | Licencias y Permisos |
| 601-011-000-00 | Mantenimiento |
| 601-012-000-00 | Reembolsos |
| 601-013-000-00 | Seguros |
| 601-014-000-00 | Servicios |
| 601-017-000-00 | Logistica y Transporte |
| 601-019-000-00 | Otros |
| 602-001-000-00 | Gastos de Nomina (Financieros) |
| 602-002-000-00 | Deducciones (Financieros) |
| 602-003-000-00 | Indemnizaciones (Financieros) |
| 602-004-000-00 | Marketing (Financieros) |
| 602-019-000-00 | Otros (Financieros) |
| 603-001-000-00 | Gastos de Nomina (Produccion) |
| 603-002-000-00 | Deducciones (Produccion) |
| 603-003-000-00 | Indemnizaciones (Produccion) |
| 603-005-000-00 | Inversiones (Produccion) |
| 603-014-000-00 | Servicios (Mano de Obra) |
| 603-019-000-00 | Otros (Produccion) |
| 603-020-000-00 | Materia Prima |
| 603-021-000-00 | Cargos Indirectos |
| 604-001-000-00 | Gastos de Nomina (Administrativo) |
| 604-002-000-00 | Deducciones (Administrativo) |
| 604-003-000-00 | Indemnizaciones (Administrativo) |
| 604-005-000-00 | Inversiones (Administrativo) |
| 604-019-000-00 | Otros (Administrativo) |
| 604-020-000-00 | Materia Prima (Administrativo) |
| 604-021-000-00 | Gastos Indirectos |
| 604-022-000-00 | Investigacion y Desarrollo |

### 10.6 Ejemplo de Cuenta Completa

**Cuenta:** `ATC-103-101-601-001`

| Componente | Valor | Significado |
|------------|-------|-------------|
| ATC | Artricenter | Empresa |
| 103 | Atizapan | Sucursal |
| 101 | Operaciones | Centro de Costo |
| 601-001 | Gastos de Nomina | Cuenta Contable |

---

## 11. Catalogo de Tipos de Gasto

| ID | Tipo de Gasto | Descripcion |
|----|---------------|-------------|
| 1 | Fijo | Gastos recurrentes (renta, nomina, servicios) |
| 2 | Variable | Gastos segun operacion (materiales, insumos) |
| 3 | Extraordinario | Gastos no planeados o one-time |

---

## 12. Catalogo de Areas

| ID | Area | Responsable |
|----|------|-------------|
| 1 | Recursos Humanos | Solicitar a RH |
| 2 | Contabilidad | Por definir |
| 3 | Tesoreria | Por definir |
| 4 | Compras | Por definir |
| 5 | Almacen | Por definir |
| 6 | Produccion | Por definir |
| 7 | Ventas | Por definir |
| 8 | Marketing | Por definir |
| 9 | Tecnologia | Por definir |
| 10 | Calidad | Por definir |

---

## 13. Catalogo de Estatus de Orden

| Estatus | Descripcion | Siguiente Accion |
|---------|-------------|------------------|
| 1 | Capturada | Pendiente Firma 2 |
| 2 | Pendiente Firma 2 | Esperar autorizacion |
| 3 | Autorizada Firma 2 | Pendiente Firma 3 |
| 4 | Pendiente Firma 3 | Esperar asignacion de cuentas |
| 5 | Autorizada Firma 3 | Pendiente Firma 4 |
| 6 | Pendiente Firma 4 | Esperar autorizacion |
| 7 | Autorizada Firma 4 | Pendiente Firma 5 |
| 8 | Pendiente Firma 5 | Esperar autorizacion final |
| 9 | Autorizada Firma 5 | Pendiente de Pago |
| 10 | Pendiente de Pago | Tesoreria programa pago |
| 11 | Pagado (parcial) | Pendiente de comprobacion |
| 12 | Pagado (total) | Pendiente de comprobacion |
| 13 | Pendiente de Comprobacion | Usuario sube comprobantes |
| 14 | Comprobado | Pendiente validacion CxP |
| 15 | Validado CxP | Cerrado |
| 16 | Cerrado | - |
| 99 | Rechazada | - |

---

## 14. Catalogo de Unidades de Medida

| ID | Unidad | Descripcion |
|----|--------|-------------|
| 1 | Piezas | Unidades individuales |
| 2 | Servicio | Servicios prestados |
| 3 | Kilos | Peso en kilogramos |
| 4 | Litros | Volumen en litros |
| 5 | Metros | Longitud en metros |
| 6 | Horas | Tiempo en horas |
| 7 | Cajas | Cajas/empaques |
| 8 | Kilowatts | Energia |

---

## 15. Alertas y Notificaciones

### 15.1 Alertas por Correo

| Evento | Destinatarios | Plantilla |
|--------|---------------|-----------|
| Nueva orden creada | Gerente de area (Firma 2) | notificacion_nueva_orden |
| Orden autorizada | Siguiente firmante | notificacion_autorizacion |
| Orden rechazada | Usuario + firmantes anteriores | notificacion_rechazo |
| Pago realizado | Usuario que genero el gasto | notificacion_pago |
| Pago pendiente (diario) | Persona que debe pagar | recordatorio_pago |
| Comprobacion subida | CxP | notificacion_comprobacion |
| Comprobacion validada | Usuario | notificacion_validacion |
| Comprobacion rechazada | Usuario | notificacion_rechazo_comprobacion |

### 15.2 Sistema de Alertas

- Considerar alertas para la persona que debe pagar
- Excepto si esta marcado "No requiere comprobacion de pago"
- Alertas configurables por usuario

---

## 16. Reglas de Negocio Futuras

### 16.1 Bloqueo de Captura (Fase 2)

- Bloquear nuevas solicitudes si:
  - Usuario tiene mas de X comprobaciones pendientes
  - Usuario tiene al menos 1 comprobacion con mas de Y dias sin comprobar

---

## 17. Roles del Sistema

| Rol | Descripcion | Permisos |
|-----|-------------|----------|
| Capturista/Solicitante | Crea ordenes de compra | Crear, Editar (propia), Ver (propia), Subir comprobantes |
| Gerente de Area | Firma 2 - Autorizacion inicial | Ver (area), Autorizar/Rechazar Firma 2 |
| CxP (Polo) | Firma 3 - Revision y asignacion contable | Ver (todas), Autorizar/Rechazar Firma 3, Asignar cuentas |
| Gerente Admon/Finanzas | Firma 4 - Revision financiera | Ver (todas), Autorizar/Rechazar Firma 4, Reportes |
| Direccion Corporativa | Firma 5 - Autorizacion final | Ver (todas), Autorizar/Rechazar Firma 5, Reportes ejecutivos |
| Tesoreria | Realiza pagos | Ver (autorizadas), Registrar pagos, Subir comprobantes |
| Auxiliar de pagos | Apoyo en conciliaciones | Ver, Conciliar |
| Administrador | Gestion de catalogos y usuarios | CRUD catalogos, CRUD usuarios, Configuracion |

---

## 18. Integracion con Sistemas

### 18.1 Diagrama de Integracion

```
+-----------------+    +-----------------+    +-----------------+
|   Sistema CxP   |--->|  Sistema Contable|--->|  Conciliacion   |
|  (Ordenes)      |    |  (Polizas)       |    |  (Bancos)       |
+-----------------+    +-----------------+    +-----------------+
```

### 18.2 Interfaces Requeridas

1. **Exportacion a Sistema Contable**:
   - Generacion de polizas automaticas
   - Formato: CSV, XML

2. **Conciliacion Bancaria**:
   - Importacion de estados de cuenta
   - Formato: Layout bancario

3. **Reportes a Direccion**:
   - Dashboard de gastos
   - Alertas de presupuesto

---

## 19. Responsables del Proceso

| Puesto | Nombre | Rol en el Sistema |
|--------|--------|-------------------|
| Analista de Metodos y Procedimientos | ING. Javier Vazquez Martinez | Documentacion |
| Analista de Cuentas por Pagar | CP. Marco Polo Narvaez Oropeza | CxP (Firma 3) |
| Gerente de Administracion y Finanzas | CP. Diego Angel Villaseñor Garduño | Firma 4 |
| Gerente de Calidad | QFB. Daniel Gasca | Revision |
| Director Corporativo | Lic. Hector Velez Rivera | Firma 5 |

---

## 20. Documentos de Referencia

| Codigo | Documento | Fecha |
|--------|-----------|-------|
| LEF-AYF-DDP-002 | Diagrama del proceso de cuentas por pagar | 08-01-2026 |
| LEF-AYF-MGP-002 | Mapa general del proceso de cuentas por pagar | 09-01-2026 |
| 2026.01.30 | Catalogo Contable Corporativo.xlsx | Enero 2026 |
| - | requerimientos.docx | Marzo 2026 |

---

## 21. Empresas del Proceso

1. Construmedika
2. Artricenter
3. Lefarma
4. Asokam
5. Corporativo
6. Consolidado

---

**Documento generado:** Marzo 2026  
**Version:** 2.0  
**Fuentes:**  
- requerimientos.docx  
- LEF-AYF-DDP-002 (Diagrama del proceso)  
- LEF-AYF-MGP-002 (Mapa general del proceso)  
- 2026.01.30 Catalogo Contable Corporativo.xlsx
