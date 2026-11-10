/* ============================================================
   0002 — Tabla de alcance por empresa para la bandeja de órdenes
   BD destino: Lefarma

   CONTEXTO
   --------
   ADR 00001 (lefarma.docs/ordenes-compra/decisiones/00001_alcance-visibilidad-ordenes-compra.md).
   El alcance «ver por empresa» necesita saber qué empresas puede ver cada
   usuario. No se usa config.usuario_detalle.id_empresa porque ese dato se
   autogeneró con la primera empresa del catálogo y no es confiable.

   DESCRIPCIÓN
   -----------
   config.usuario_alcance_empresa asocia un usuario (IdUsuario de Asokam,
   sin FK porque vive en otra base) con una o varias empresas del catálogo
   local. La baja es lógica (activo = 0) para conservar historial.

   SEMÁNTICA
   ---------
   - Sin filas activas: el permiso orden_compra.puede_ver_por_empresa no
     amplía la visibilidad (fail-closed).
   - La aplicación filtra siempre por alcance antes de aplicar los filtros
     de la UI.

   Es idempotente: re-ejecutar no duplica la tabla ni el índice.

   ROLLBACK
   --------
   DROP TABLE IF EXISTS config.usuario_alcance_empresa;
   ============================================================ */
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF OBJECT_ID(N'config.usuario_alcance_empresa', N'U') IS NULL
BEGIN
    CREATE TABLE config.usuario_alcance_empresa
    (
        id_usuario          INT           NOT NULL,
        id_empresa          INT           NOT NULL,
        activo              BIT           NOT NULL
            CONSTRAINT DF_usuario_alcance_empresa_activo DEFAULT (1),
        fecha_creacion      DATETIME2(0)  NOT NULL
            CONSTRAINT DF_usuario_alcance_empresa_fecha_creacion DEFAULT (GETDATE()),
        fecha_modificacion  DATETIME2(0)  NULL,

        CONSTRAINT PK_usuario_alcance_empresa PRIMARY KEY (id_usuario, id_empresa),
        CONSTRAINT FK_usuario_alcance_empresa_empresa
            FOREIGN KEY (id_empresa) REFERENCES catalogos.empresas (id_empresa)
    );

    PRINT 'Tabla config.usuario_alcance_empresa creada.';
END
ELSE
BEGIN
    PRINT 'Tabla config.usuario_alcance_empresa ya existe. Sin cambios.';
END

/* ------------------------------------------------------------
   Verificación
   ------------------------------------------------------------ */
SELECT c.name AS columna, t.name AS tipo, c.max_length, c.is_nullable
FROM sys.columns c
INNER JOIN sys.types t ON t.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID(N'config.usuario_alcance_empresa')
ORDER BY c.column_id;

/* ------------------------------------------------------------
   Ejemplo de asignación (NO se ejecuta automáticamente)
   ------------------------------------------------------------
   -- Victor (1a130) puede ver las órdenes de su empresa (Lefarma = 8)
   INSERT INTO config.usuario_alcance_empresa (id_usuario, id_empresa, activo, fecha_creacion)
   SELECT u.IdUsuario, e.id_empresa, 1, GETDATE()
   FROM Asokam.app.Usuarios u
   INNER JOIN catalogos.empresas e ON e.clave = N'LEF'
   WHERE u.SamAccountName = N'1a130'
     AND NOT EXISTS (
         SELECT 1 FROM config.usuario_alcance_empresa a
         WHERE a.id_usuario = u.IdUsuario AND a.id_empresa = e.id_empresa);

   -- Baja lógica
   UPDATE config.usuario_alcance_empresa
   SET activo = 0, fecha_modificacion = GETDATE()
   WHERE id_usuario = 98 AND id_empresa = 7;
   ------------------------------------------------------------ */
