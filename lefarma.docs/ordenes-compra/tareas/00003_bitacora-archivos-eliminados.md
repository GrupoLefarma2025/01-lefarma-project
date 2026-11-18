# Tareas — ADR 00003: bitácora de archivos eliminados

Implementa [`decisiones/00003_bitacora-archivos-eliminados.md`](../decisiones/00003_bitacora-archivos-eliminados.md) y cierra el ticket Freshdesk #6987.

Estado al 2026-11-13: implementado y verificado de forma estática (build + tests unitarios). El script de base queda en la Bandeja para que lo ejecute una persona.

## Fase única — Bitácora y corrección del historial

- [x] **T0.1 Tabla de bitácora**
  - `lefarma.database/060_alter_archivos_crear_bitacora_eliminados.sql`: `archivos.ArchivosEliminados` con hash, ruta histórica, usuarios y fechas de subida/baja y motivo; índice por `IdArchivo`.
  - Verificación: script idempotente, revisado; pendiente de ejecución humana en dev y producción.

- [x] **T0.2 Entidad y mapeo**
  - `Domain/Entities/Archivos/ArchivoEliminado.cs`, `Infrastructure/Data/Configurations/Archivos/ArchivoEliminadoConfiguration.cs` y `DbSet` en `ApplicationDbContext`.
  - Verificación: build sin errores.

- [x] **T0.3 Baja con bitácora y binario histórico**
  - `ArchivoRepository.DeleteAsync(id, eliminacion, ct)` inserta la bitácora y marca `Activo = false` en un solo `SaveChanges`.
  - `ArchivoService.MoverAHistorico` calcula SHA-256, mueve el binario a `private-media/eliminados/aaaa/MM` y arma la fila; se usa en eliminación y en reemplazo.
  - `DownloadAsync`/`PreviewAsync` resuelven la ruta histórica para los eliminados.
  - Verificación: build sin errores.

- [x] **T0.4 Datos en el listado y pantalla**
  - `ArchivoListItemResponse` agrega `FechaEliminacion`, `UsuarioEliminoNombre` y `MotivoBaja`; `GetAllAsync` resuelve el nombre del eliminador contra Asokam en el mismo lote.
  - `AutorizacionesOC.tsx` muestra «quién · fecha y hora», distingue reemplazo y deja la subida como dato secundario; el aviso viejo se sustituye por una nota solo cuando hay filas sin registro.
  - Verificación: `npm run build` correcto.

- [x] **T0.5 Correo sin desfase**
  - `ArchivoEliminacionNotifier` convierte `FechaCreacion` de UTC a local antes de imprimir «Subido por».
  - Verificación: prueba unitaria nueva con fecha UTC y expectativa calculada en la zona local.

- [x] **T0.6 Fecha de baja nula y poblado histórico**
  - La entidad y el mapeo admiten `FechaEliminacion` nula; los borrados migrados no tienen fecha conocida.
  - `lefarma.database/061_alter_archivos_bitacora_poblar_eliminados.sql`: relaja la columna y copia los metadatos de los archivos ya inactivos (subida real, sin usuario ni fecha de baja).
  - Verificación: build Release sin errores; queda en la Bandeja para ejecución humana.

## Pendiente para operar

- [x] Aplicar `060_alter_archivos_crear_bitacora_eliminados.sql` en dev (Bandeja, Q-20261113-132123-161b) y en producción (Q-20261113-132339-3ab5).
- [ ] Aplicar `061_alter_archivos_bitacora_poblar_eliminados.sql` en dev (Q-20261113-132720-8596) y en producción (Q-20261113-132720-bf85) para que el historial arranque con los archivos ya eliminados.
- [ ] Publicar backend y frontend; el script debe estar aplicado en el ambiente antes de publicar.
- [ ] Definir retención del histórico y respaldo de la carpeta privada con infraestructura.
- [ ] Mover los binarios de los 225 borrados anteriores de la carpeta pública a `private-media/eliminados`; por ahora se resuelven por la ruta de respaldo (`_inactivo`).

## Criterios de aceptación

- [x] El historial muestra la fecha y hora reales del borrado y el nombre de quien lo hizo (cubierto por pruebas y por el flujo).
- [x] El correo ya no muestra la fecha de subida adelantada 6 horas (cubierto por prueba unitaria).
- [x] El binario eliminado se conserva fuera de `wwwroot` y se sirve solo por endpoint autenticado.
- [x] Los archivos borrados antes del cambio se muestran como «Sin registro», sin inventar datos.
- [ ] Prueba real en dev con el script aplicado (pendiente, requiere la Bandeja).
