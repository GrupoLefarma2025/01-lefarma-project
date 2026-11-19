# SIGMA — referencia de base de datos

El módulo de documentos migrado desde SIGMA **no vive en la base de datos de negocio de
Lefarma**: usa la base **Asokam**, que Lefarma ya alcanza con la cadena de conexión
`AsokamConnection` y el `AsokamDbContext`.

## Contenido

- `referencia/00001_stored_procedures_documentos.sql`: definición real de los 20
  procedimientos almacenados `app.sp_*` del módulo, extraída en solo lectura de
  `AsokamDev` el 2026-11-19 (misma máquina y mismas huellas SHA256 que `Asokam`
  en producción; no hay divergencia entre ambientes).

## Reglas

1. **Este archivo no se aplica solo.** No forma parte del migrador de la base
   Lefarma ni de los despliegues. Su objetivo es versionar y auditar lo que ya
   existe en Asokam.
2. Si algún día hay que cambiar un SP, se hace con una revisión humana explícita
   sobre la base Asokam (dev primero, producción después). El archivo se
   regenera después del cambio.
3. Las tablas del módulo (`app.Documentos`, `app.DocumentosConFlujo`,
   `app.PasosFlujo`, `app.GruposDocumentos`, `app.DocumentosHistorial`,
   `app.LogNotificacionDocumento`, `app.Usuarios`, `app.Permisos`…) tampoco se
   crean desde el repo: son parte del esquema Asokam existente.
