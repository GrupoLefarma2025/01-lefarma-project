-- ---------------------------------------------------------------------------
-- Migration 010: Add limite_presupuesto to catalogos.centros_costo
-- ---------------------------------------------------------------------------
IF NOT EXISTS (
    SELECT 1
    FROM sys.columns
    WHERE object_id = OBJECT_ID('[catalogos].[centros_costo]')
      AND name = 'limite_presupuesto'
)
BEGIN
    ALTER TABLE catalogos.centros_costo
        ADD limite_presupuesto DECIMAL(18, 2) NULL;

    PRINT 'Columna [limite_presupuesto] agregada a [catalogos].[centros_costo]';
END
ELSE
BEGIN
    PRINT 'Columna [limite_presupuesto] ya existe en [catalogos].[centros_costo] — se omite';
END
GO
