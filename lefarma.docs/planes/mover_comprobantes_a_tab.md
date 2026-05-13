# Plan: Mover comprobantes y adjuntos del modal de firma a los tabs

## Objetivo
Los comprobantes (gasto/pago) y adjuntos se cargan desde los tabs, no desde el modal de firma. El usuario puede subirlos en cualquier momento. La validacion al firmar solo verifica que existan.

---

## Cambios

### 1. Tab Comprobantes — agregar 2 botones

```tsx
<div className="flex gap-2 mt-2">
  <Button size="sm" variant="outline" onClick={() => setIsSubirComprobanteOpen(true)}>
    + Gasto
  </Button>
  <Button size="sm" variant="outline" onClick={() => setIsSubirComprobantePagoOpen('pago')}>
    + Pago
  </Button>
</div>
```

### 2. Tab Archivos — agregar boton + FileUploader

```tsx
<div className="mt-3">
  <FileUploader
    inline open multiple cantidadMaxima={5}
    entidadTipo="OrdenCompra" entidadId={selectedOrden.idOrden}
    carpeta="ordenes-compra"
    metadata={{
      modulo: 'ordenes_compra', origen: 'workflow',
      tipo: 'adjunto_libre',
      paso: selectedOrden.idPasoActual ?? undefined,
    }}
    tiposPermitidos={['.pdf', '.xml', '.jpg', '.jpeg', '.png', '.doc', '.docx', '.xls', '.xlsx']}
    descripcion="Arrastra o selecciona documentos de soporte"
    onUploadComplete={(nuevos) => fetchArchivosOrden(selectedOrden.idOrden)}
    onClose={() => {}}
  />
</div>
```

### 3. Remover los botones del modal de firma

Quitar de `camposParaAccion`:
- Boton `+ Comprobante gasto` (linea ~2470)
- Boton `+ Comprobante pago` (linea ~2513)  
- Seccion `FileUploader` de adjuntos libres (linea ~2620)

### 4. Mantener la validacion al firmar

```tsx
// Comprobantes
const tieneComprobante = (comprobantesWorkflow[inputKey]?.length ?? 0) > 0;
// Adjuntos
if (accionSeleccionada.requiereAdjunto && adjuntosLibres.length === 0) {
  toast.error('Debes adjuntar documentos de soporte');
}
```

Pero ahora `comprobantesWorkflow` y `adjuntosLibres` se llenan desde la API al abrir los tabs, no desde los callbacks del modal de firma.

### 5. Cargar datos al abrir tabs

Al abrir el tab "Comprobantes": fetch de comprobantes existentes.
Al abrir el tab "Archivos": ya se hace `fetchArchivosOrden`.

### 6. Ajustar `onComprobanteSubido`

Los callbacks solo refrescan la UI del tab.

---

## Archivos a modificar: 1

| Cambio | Lineas |
|--------|--------|
| +2 Botones en tab Comprobantes | +10 |
| +1 FileUploader en tab Archivos | +15 |
| -2 Botones del modal de firma | -20 |
| -FileUploader adjuntos del modal | -15 |
| Ajustar callbacks | -5 |

**Neto: ~15 lineas menos.**
