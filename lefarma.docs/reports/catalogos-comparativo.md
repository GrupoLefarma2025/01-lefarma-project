# Tabla Comparativa de Catálogos - Sistema Cuentas por Pagar

**Fecha:** 2026-03-23
**Fuente:** specs.md v2.0, código actual backend/frontend

---

## Resumen Ejecutivo

| Categoría | Implementados | Faltantes | Total |
|-----------|--------------|-----------|-------|
| **Catálogos Core del Specs** | 5 | 5 | 10 |
| **Catálogos Adicionales** | 3 | - | 3 |
| **TOTAL** | 8 | 5 | 13 |

**Porcentaje de cumplimiento:** 50% (5/10 catálogos core)

---

## 1. Catálogos REQUERIDOS según Specs (Secciones 9-14)

| # | Catálogo | Sección Specs | Backend | Frontend | Estado |
|---|----------|---------------|---------|----------|--------|
| 1 | **Empresas** | Sección 2 | ✅ `Empresas/` | ✅ `EmpresasList.tsx` | ✅ **COMPLETO** |
| 2 | **Sucursales** | Sección 2 | ✅ `Sucursales/` | ✅ `SucursalesList.tsx` | ✅ **COMPLETO** |
| 3 | **Áreas** | Sección 12 | ✅ `Areas/` | ✅ `AreasList.tsx` | ✅ **COMPLETO** |
| 4 | **Tipos de Gasto** | Sección 11 | ✅ `Gastos/` | ✅ `GastosList.tsx` | ✅ **COMPLETO** |
| 5 | **Unidades de Medida** | Sección 14 | ✅ `UnidadesMedida/` | ❌ No encontrado | ⚠️ **PARCIAL** (solo backend) |
| 6 | **Centros de Costo** | Sección 9 | ❌ FALTA | ❌ FALTA | ❌ **FALTA** |
| 7 | **Catálogo Contable** | Sección 10 | ❌ FALTA | ❌ FALTA | ❌ **FALTA** |
| 8 | **Estatus de Orden** | Sección 13 | ❌ FALTA | ❌ FALTA | ❌ **FALTA** |
| 9 | **Régimen Fiscal (SAT)** | Sección 4.2 | ❌ FALTA | ❌ FALTA | ❌ **FALTA** |
| 10 | **Proveedores*** | Sección 4.2 | ❌ FALTA | ❌ FALTA | ❌ **FALTA** |

*Nota: Proveedores se menciona como "solo se registra en el catálogo si CxP autoriza"

---

## 2. Catálogos ADICIONALES (No en Specs, pero Implementados)

| # | Catálogo | Backend | Frontend | Observación |
|---|----------|---------|----------|-------------|
| 1 | **Bancos** | ✅ `Bancos/` | ❌ No encontrado | Posiblemente para módulo de Tesorería |
| 2 | **Formas de Pago** | ✅ `FormasPago/` | ✅ `FormasPagoList.tsx` | Mencionado en Sección 4.4 pero sin detalle de catálogo |
| 3 | **Medios de Pago** | ✅ `MediosPago/` | ❌ No encontrado | Relacionado con Tesorería |
| 4 | **Medidas** | ✅ `Medidas/` | ✅ `MedidasList.tsx` | ¿Duplicado con Unidades de Medida? |

---

## 3. Detalle de Catálogos Faltantes

### 3.1 Centros de Costo (Prioridad: ALTA)
**Sección 9 - Specs**

```
ID | Centro de Costo | Descripción
---|-----------------|-------------
101| Operaciones     | Producción, Logística, Almacén
102| Administrativo  | Recursos Humanos, Contabilidad, Tesorería
103| Comercial       | Ventas, Marketing, TLMK
104| Gerencia        | Dirección, Calidad, Administración
```

**Por qué es crítico:**
- Firma 3 (CxP - Polo) debe asignarlo **obligatoriamente**
- Es parte del formato completo de cuenta contable: `ATC-103-101-601-001`

**Estructura sugerida:**
```csharp
public class CentroCosto
{
    public int Id { get; set; }          // 101, 102, 103, 104
    public string Nombre { get; set; }   // "Operaciones"
    public string Descripcion { get; set; }
    public bool Activo { get; set; }
}
```

---

### 3.2 Catálogo Contable (Prioridad: ALTA)
**Sección 10 - Specs**

**Estructura de cuenta:** `AAA-BBB-CCC-DD`
- AAA: Prefijo empresa-sucursal (ATC-103, ASK-102, etc.)
- BBB: Centro de costo (101-104)
- CCC-DD: Cuenta contable (601-001, 601-002, etc.)

**Cuentas de primer nivel:**
```
600 | Gastos
601 | Gastos Administrativos
602 | Gastos Financieros
603 | Gastos de Producción
604 | Gastos Administrativos (Operativos)
```

**Por qué es crítico:**
- Firma 3 (CxP) debe asignar cuenta contable **obligatoriamente**
- Necesario para integración con sistema contable
- Requerido para reportes contables (Sección 8.3)

**Estructura sugerida:**
```csharp
public class CuentaContable
{
    public int Id { get; set; }
    public string Cuenta { get; set; }           // "601-001-001-01"
    public string Descripcion { get; set; }      // "Sueldos y salarios"
    public string Nivel1 { get; set; }           // "601" (Gastos Administrativos)
    public string Nivel2 { get; set; }           // "601-001" (Gastos de Nómina)
    public string EmpresaPrefijo { get; set; }   // "ATC-103"
    public int? CentroCostoId { get; set; }      // FK a CentroCosto
    public bool Activo { get; set; }
}
```

**Consideraciones:**
- El archivo `2026.01.30 Catálogo Contable Corporativo.xlsx` tiene ~437 cuentas
- Puede requerir importador masivo desde Excel

---

### 3.3 Estatus de Orden (Prioridad: MEDIA)
**Sección 13 - Specs**

```
Estatus | Descripción                  | Siguiente Acción
--------|------------------------------|------------------
1       | Capturada                    | Pendiente Firma 2
2       | Pendiente Firma 2            | Esperar autorización
3       | Autorizada Firma 2           | Pendiente Firma 3
...     | ...                          | ...
99      | Rechazada                    | -
```

**Por qué es necesario:**
- Control del flujo de 5 firmas
- Sistema de notificaciones depende del estatus
- Reportes de comprobaciones pendientes

**Estructura sugerida:**
```csharp
public class EstatusOrden
{
    public int Id { get; set; }              // 1-99
    public string Nombre { get; set; }       // "Capturada"
    public string Descripcion { get; set; }
    public int? SiguienteEstatusId { get; set; }
    public bool RequiereAccion { get; set; }
}
```

---

### 3.4 Régimen Fiscal SAT (Prioridad: MEDIA)
**Mencionado en Sección 4.2**

**Por qué es necesario:**
- Campo obligatorio en datos del proveedor
- Requerido para facturación electrónica (CFDI)
- Catálogo oficial del SAT

**Consideraciones:**
- Puede usar catálogo oficial del SAT (c_FiscalRegimen del CFDI 4.0)
- ~30 regímenes fiscales comunes

**Estructura sugerida:**
```csharp
public class RegimenFiscal
{
    public string Clave { get; set; }        // "601", "603", "605", etc.
    public string Descripcion { get; set; }  // "General de Ley Personas Morales"
    public string TipoPersona { get; set; }  // "Moral", "Física"
    public bool Activo { get; set; }
}
```

---

### 3.5 Proveedores (Prioridad: ALTA)
**Mencionado en Sección 4.2**

**Campos principales:**
- Razón social / Nombre
- RFC (12/13 caracteres)
- Código postal (5 dígitos)
- Régimen fiscal
- Persona de contacto
- Nota forma de pago
- Notas generales

**Por qué es crítico:**
- Core del proceso de cuentas por pagar
- "Nota: El proveedor solo se registra en el catálogo si CxP autoriza"
- Necesario para conciliación de pagos

**Estructura sugerida:**
```csharp
public class Proveedor
{
    public int Id { get; set; }
    public string RazonSocial { get; set; }
    public string RFC { get; set; }
    public string CodigoPostal { get; set; }
    public int? RegimenFiscalId { get; set; }
    public string PersonaContacto { get; set; }
    public string NotaFormaPago { get; set; }
    public string NotasGenerales { get; set; }
    public bool SinDatosFiscales { get; set; }
    public bool AutorizadoPorCxP { get; set; }
    public DateTime FechaRegistro { get; set; }
}
```

---

## 4. Matriz de Prioridades

| Prioridad | Catálogo | Razón |
|-----------|----------|-------|
| 🔴 **ALTA** | Centros de Costo | Firma 3 (CxP) debe asignarlo obligatoriamente |
| 🔴 **ALTA** | Catálogo Contable | Firma 3 (CxP) debe asignarlo obligatoriamente |
| 🔴 **ALTA** | Proveedores | Core del proceso de CxP |
| 🟡 **MEDIA** | Estatus de Orden | Necesario para flujo de autorizaciones |
| 🟡 **MEDIA** | Régimen Fiscal SAT | Campo obligatorio en proveedores |
| 🟢 **BAJA** | Unidades de Medida (Frontend) | Ya existe en backend |

---

## 5. Recomendaciones

### 5.1 Orden de Implementación Sugerido

1. **Fase 1 - Core para Firma 3 (CxP):**
   - Centros de Costo
   - Catálogo Contable
   - Proveedores

2. **Fase 2 - Flujo de Autorizaciones:**
   - Estatus de Orden

3. **Fase 3 - Complementos:**
   - Régimen Fiscal SAT
   - Frontend para Unidades de Medida

### 5.2 Consideraciones Técnicas

1. **Catálogo Contable:**
   - Considerar script de importación desde Excel existente
   - El catálogo tiene ~437 cuentas
   - Requiere relación con Empresas, Sucursales y Centros de Costo

2. **Régimen Fiscal SAT:**
   - Descargar catálogo oficial del SAT
   - Usar clave `c_FiscalRegimen` del CFDI 4.0
   - URL: https://www.sat.gob.mx/aplicacion/63027/descarga-catlogos-del-sat

3. **Estatus de Orden:**
   - Considerar que es un catálogo de solo lectura
   - No requiere CRUD completo
   - Puede ser un enum en lugar de tabla

### 5.3 Duplicados Detectados

**Medidas vs Unidades de Medida:**
- Existen dos catálogos similares: `Medidas/` y `UnidadesMedida/`
- Revisar si son funcionalidades distintas o duplicadas
- Specs solo menciona "Unidades de Medida" (Sección 14)

---

## 6. Datos de Referencia

### Catálogos en Specs.md v2.0

| Sección | Catálogo | Items |
|---------|----------|-------|
| Sección 2 | Empresas | 5 empresas (Asokam, Lefarma, Artricenter, Construmedika, GrupoLefarma) |
| Sección 2 | Sucursales | ~12 sucursales totales |
| Sección 9 | Centros de Costo | 4 centros (101-104) |
| Sección 10 | Catálogo Contable | ~437 cuentas |
| Sección 11 | Tipos de Gasto | 3 tipos (Fijo, Variable, Extraordinario) |
| Sección 12 | Áreas | 10 áreas |
| Sección 13 | Estatus de Orden | ~16 estatus (1-16 + 99) |
| Sección 14 | Unidades de Medida | 8 unidades |

---

**Documento generado:** 2026-03-23
**Versión Specs:** 2.0 (Marzo 2026)
