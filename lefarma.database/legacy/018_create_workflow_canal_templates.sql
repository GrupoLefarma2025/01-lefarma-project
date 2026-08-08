-- =============================================================================
-- 018. CREAR/MIGRAR TABLA config.workflow_canal_templates
-- =============================================================================
-- Objetivo: Asegurar que la tabla de plantillas de canal exista con el esquema
--           correcto (global por canal, sin id_workflow).
-- =============================================================================

IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'config')
BEGIN
    EXEC('CREATE SCHEMA config');
    PRINT 'Esquema [config] creado';
END
GO

-- ---------------------------------------------------------------------------
-- Caso 1: La tabla NO existe -> Crearla con el esquema final
-- ---------------------------------------------------------------------------
IF NOT EXISTS (SELECT * FROM sys.tables WHERE object_id = OBJECT_ID('[config].[workflow_canal_templates]'))
BEGIN
    CREATE TABLE config.workflow_canal_templates (
        id_template INT IDENTITY(1,1) PRIMARY KEY,
        codigo_canal VARCHAR(50) NOT NULL,
        nombre VARCHAR(100) NOT NULL,
        layout_html NVARCHAR(MAX) NOT NULL,
        activo BIT NOT NULL DEFAULT 1,
        fecha_modificacion DATETIME2 NOT NULL DEFAULT GETUTCDATE(),

        CONSTRAINT UX_workflow_canal_templates_canal UNIQUE (codigo_canal)
    );
    PRINT 'Tabla [config].[workflow_canal_templates] creada (esquema final)';
END
GO

-- ---------------------------------------------------------------------------
-- Caso 2: La tabla existe con el esquema antiguo (con id_workflow)
-- ---------------------------------------------------------------------------
IF EXISTS (SELECT * FROM sys.tables WHERE object_id = OBJECT_ID('[config].[workflow_canal_templates]'))
   AND EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('[config].[workflow_canal_templates]') AND name = 'id_workflow')
BEGIN
    -- Eliminar FK si existe
    IF EXISTS (SELECT * FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID('[config].[workflow_canal_templates]') AND name = 'FK_workflow_canal_templates_workflow')
    BEGIN
        ALTER TABLE config.workflow_canal_templates DROP CONSTRAINT FK_workflow_canal_templates_workflow;
        PRINT 'FK [FK_workflow_canal_templates_workflow] eliminada';
    END

    -- Eliminar unique constraint antiguo si existe
    IF EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID('[config].[workflow_canal_templates]') AND name = 'UX_workflow_canal_templates_workflow_canal')
    BEGIN
        ALTER TABLE config.workflow_canal_templates DROP CONSTRAINT UX_workflow_canal_templates_workflow_canal;
        PRINT 'Constraint [UX_workflow_canal_templates_workflow_canal] eliminada';
    END

    -- Eliminar columna id_workflow
    ALTER TABLE config.workflow_canal_templates DROP COLUMN id_workflow;
    PRINT 'Columna [id_workflow] eliminada';

    -- Agregar unique constraint nuevo si no existe
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID('[config].[workflow_canal_templates]') AND name = 'UX_workflow_canal_templates_canal')
    BEGIN
        ALTER TABLE config.workflow_canal_templates ADD CONSTRAINT UX_workflow_canal_templates_canal UNIQUE (codigo_canal);
        PRINT 'Constraint [UX_workflow_canal_templates_canal] agregada';
    END

    PRINT 'Tabla [config].[workflow_canal_templates] migrada a esquema final';
END
GO

-- ---------------------------------------------------------------------------
-- Seed inicial (plantillas por defecto) - solo si estan vacias
-- ---------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM config.workflow_canal_templates)
BEGIN
    SET IDENTITY_INSERT config.workflow_canal_templates ON;

    INSERT INTO config.workflow_canal_templates
        (id_template, codigo_canal, nombre, layout_html, activo, fecha_modificacion)
    VALUES
    (1, 'email', 'Email - Orden de Compra',
    N'<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{{Asunto}}</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f2f5;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
         style="background-color:#f0f2f5;padding:40px 16px">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" role="presentation"
               style="max-width:600px;width:100%;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.10)">
          <tr>
            <td style="background-color:{{ColorTema}};padding:28px 36px">
              <p style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.3px">
                {{Icono}} Grupo Lefarma
              </p>
              <p style="margin:4px 0 0;color:rgba(255,255,255,0.75);font-size:13px;font-weight:400">
                Sistema de Autorizaciones de Ordenes de Compra
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#ffffff;padding:0 0 0 4px;border-left:4px solid {{ColorTema}}">
              <div style="padding:36px 36px 28px;color:#1f2937;font-size:15px;line-height:1.7">
                {{Contenido}}
              </div>
            </td>
          </tr>
          <tr>
            <td style="background-color:#ffffff;padding:0 36px 36px">
              <a href="{{UrlOrden}}"
                 style="display:inline-block;background-color:{{ColorTema}};color:#ffffff;text-decoration:none;
                        padding:13px 28px;border-radius:7px;font-size:14px;font-weight:600;
                        letter-spacing:0.2px;border:none">
                Ver Orden en el Sistema &rarr;
              </a>
            </td>
          </tr>
          <tr>
            <td style="background-color:#ffffff;padding:0 36px">
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:0">
            </td>
          </tr>
          <tr>
            <td style="background-color:#f8f9fa;padding:20px 36px;border-radius:0 0 10px 10px">
              <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.5;text-align:center">
                Este mensaje fue generado automaticamente. Por favor no responda a este correo.<br>
                &copy; Grupo Lefarma - Sistema de Autorizaciones
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>',
    1, GETUTCDATE()),

    (2, 'in_app', 'In-App - Orden de Compra',
    N'{{Contenido}}',
    1, GETUTCDATE());

    SET IDENTITY_INSERT config.workflow_canal_templates OFF;
    PRINT 'Seed inicial insertado en [config].[workflow_canal_templates]';
END
GO
