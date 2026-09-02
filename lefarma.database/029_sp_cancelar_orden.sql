-- ============================================================
-- 029 - Stored procedure: Cancelar cualquier orden de compra
-- ============================================================
-- Descripcion:
--   Cancela una orden de compra desde CUALQUIER estado del workflow
--   (incluido TESORERIA), replicando exactamente lo que hace la app
--   cuando una accion CANCELACION se ejecuta via FirmarAsync:
--     1. operaciones.ordenes_compra: id_estado -> CANCELADA,
--        id_paso_actual -> paso destino de la accion (o NULL),
--        fecha_cancelacion y fecha_modificacion.
--     2. config.workflow_bitacora: registro inmutable de la transicion
--        con snapshot JSON (igual que WorkflowEngine.EjecutarAccionAsync).
--
--   NO hace (igual que la app al cancelar):
--     - No envia notificaciones (eso es codigo de aplicacion).
--     - No toca facturas ni comprobantes (solo DEVOLVER hace reset).
--
-- Base de datos: Lefarma (DefaultConnection)
-- ============================================================

IF OBJECT_ID('[config].[sp_CancelarOrden]', 'P') IS NOT NULL
    DROP PROCEDURE config.sp_CancelarOrden;
GO

CREATE PROCEDURE config.sp_CancelarOrden
    @id_orden   INT,                    -- Requerido: orden a cancelar
    @id_usuario INT,                    -- Requerido: usuario que cancela (bitacora)
    @comentario VARCHAR(500) = NULL,    -- Opcional: motivo de cancelacion
    @id_accion  INT = NULL              -- Opcional: accion CANCELACION; se auto-resuelve
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        -- ------------------------------------------------------------
        -- 1. Cargar orden con bloqueo (evita carreras con la app)
        -- ------------------------------------------------------------
        DECLARE @id_workflow INT, @id_estado_actual INT, @id_paso_actual INT, @folio VARCHAR(50);

        SELECT  @id_workflow      = id_workflow,
                @id_estado_actual = id_estado,
                @id_paso_actual   = id_paso_actual,
                @folio            = folio
        FROM operaciones.ordenes_compra WITH (UPDLOCK, ROWLOCK)
        WHERE id_orden = @id_orden;

        IF @id_workflow IS NULL
        BEGIN
            ROLLBACK TRANSACTION;
            THROW 50001, 'La orden de compra no existe.', 1;
        END

        -- ------------------------------------------------------------
        -- 2. Resolver estados por CODIGO (los IDs varian por ambiente)
        -- ------------------------------------------------------------
        DECLARE @id_estado_cancelada INT, @id_estado_cerrada INT;

        SELECT  @id_estado_cancelada = MAX(CASE WHEN codigo = 'CANCELADA' THEN id_estado END),
                @id_estado_cerrada   = MAX(CASE WHEN codigo = 'CERRADA'   THEN id_estado END)
        FROM config.workflow_estados
        WHERE codigo IN ('CANCELADA', 'CERRADA');

        IF @id_estado_cancelada IS NULL
        BEGIN
            ROLLBACK TRANSACTION;
            THROW 50002, 'No existe el estado CANCELADA en config.workflow_estados.', 1;
        END

        -- ------------------------------------------------------------
        -- 3. Reglas de negocio (mismas que FirmasService.FirmarAsync):
        --    una orden CERRADA o ya CANCELADA no se puede cancelar
        -- ------------------------------------------------------------
        IF @id_estado_actual = @id_estado_cancelada
        BEGIN
            ROLLBACK TRANSACTION;
            THROW 50003, 'La orden ya esta cancelada.', 1;
        END

        IF @id_estado_actual = @id_estado_cerrada
        BEGIN
            ROLLBACK TRANSACTION;
            THROW 50004, 'La orden ya esta cerrada; no se puede cancelar.', 1;
        END

        -- ------------------------------------------------------------
        -- 4. Resolver id_paso para la bitacora:
        --    paso actual de la orden, o cualquier paso activo del workflow
        -- ------------------------------------------------------------
        DECLARE @id_paso_bitacora INT;

        IF @id_paso_actual IS NOT NULL
            SELECT @id_paso_bitacora = id_paso
            FROM config.workflow_pasos
            WHERE id_paso = @id_paso_actual AND activo = 1;

        IF @id_paso_bitacora IS NULL
            SELECT TOP (1) @id_paso_bitacora = id_paso
            FROM config.workflow_pasos
            WHERE id_workflow = @id_workflow AND activo = 1
            ORDER BY id_paso;

        -- ------------------------------------------------------------
        -- 5. Resolver id_accion (prioridad):
        --    a) parametro explicito
        --    b) accion del paso actual cuyo paso destino tenga estado CANCELADA
        --    c) cualquier accion del workflow cuyo destino sea CANCELADA
        --    d) cualquier accion activa del paso actual
        --    e) cualquier accion activa del workflow (ultima instancia;
        --       se marca en comentario porque no es una CANCELACION real)
        -- ------------------------------------------------------------
        DECLARE @id_accion_usada INT, @id_paso_nuevo INT, @origen_accion VARCHAR(20) = NULL;

        IF @id_accion IS NOT NULL AND EXISTS (SELECT 1 FROM config.workflow_acciones WHERE id_accion = @id_accion)
            SELECT @id_accion_usada = @id_accion, @origen_accion = 'parametro';

        IF @id_accion_usada IS NULL AND @id_paso_actual IS NOT NULL
        BEGIN
            SELECT TOP (1) @id_accion_usada = a.id_accion, @id_paso_nuevo = a.id_paso_destino
            FROM config.workflow_acciones a
            JOIN config.workflow_pasos pd ON pd.id_paso = a.id_paso_destino
            WHERE a.id_paso_origen = @id_paso_actual AND a.activo = 1 AND pd.id_estado = @id_estado_cancelada
            ORDER BY a.id_accion;

            IF @id_accion_usada IS NOT NULL SET @origen_accion = 'paso_actual';
        END

        IF @id_accion_usada IS NULL
        BEGIN
            SELECT TOP (1) @id_accion_usada = a.id_accion, @id_paso_nuevo = a.id_paso_destino
            FROM config.workflow_acciones a
            JOIN config.workflow_pasos po ON po.id_paso = a.id_paso_origen
            JOIN config.workflow_pasos pd ON pd.id_paso = a.id_paso_destino
            WHERE po.id_workflow = @id_workflow AND a.activo = 1 AND pd.id_estado = @id_estado_cancelada
            ORDER BY a.id_accion;

            IF @id_accion_usada IS NOT NULL SET @origen_accion = 'workflow';
        END

        IF @id_accion_usada IS NULL AND @id_paso_actual IS NOT NULL
        BEGIN
            SELECT TOP (1) @id_accion_usada = id_accion
            FROM config.workflow_acciones
            WHERE id_paso_origen = @id_paso_actual AND activo = 1
            ORDER BY id_accion;

            IF @id_accion_usada IS NOT NULL SET @origen_accion = 'fallback_paso';
        END

        IF @id_accion_usada IS NULL
        BEGIN
            SELECT TOP (1) @id_accion_usada = a.id_accion
            FROM config.workflow_acciones a
            JOIN config.workflow_pasos po ON po.id_paso = a.id_paso_origen
            WHERE po.id_workflow = @id_workflow AND a.activo = 1
            ORDER BY a.id_accion;

            IF @id_accion_usada IS NOT NULL SET @origen_accion = 'fallback_workflow';
        END

        -- Si el paso destino resuelto NO lleva a CANCELADA, no reutilizarlo
        -- como paso nuevo de la orden (la orden queda terminal).
        DECLARE @destino_es_cancelacion BIT = 0;
        IF @id_paso_nuevo IS NOT NULL
            SELECT @destino_es_cancelacion = 1
            FROM config.workflow_pasos
            WHERE id_paso = @id_paso_nuevo AND id_estado = @id_estado_cancelada;

        IF @destino_es_cancelacion = 0
            SET @id_paso_nuevo = NULL;

        -- ------------------------------------------------------------
        -- 6. Cancelar la orden
        -- ------------------------------------------------------------
        UPDATE operaciones.ordenes_compra
        SET id_estado         = @id_estado_cancelada,
            id_paso_actual    = @id_paso_nuevo,        -- paso de cancelacion o NULL (terminal)
            fecha_cancelacion = SYSUTCDATETIME(),
            fecha_modificacion= SYSUTCDATETIME()
        WHERE id_orden = @id_orden;

        -- ------------------------------------------------------------
        -- 7. Bitacora inmutable (solo si hay paso y accion validos para
        --    satisfacer las FKs; replica el snapshot del WorkflowEngine)
        -- ------------------------------------------------------------
        DECLARE @bitacora_escrita BIT = 0;

        IF @id_paso_bitacora IS NOT NULL AND @id_accion_usada IS NOT NULL
        BEGIN
            INSERT INTO config.workflow_bitacora
                (id_orden, id_workflow, id_paso, id_accion, id_usuario, comentario, datos_snapshot, fecha_evento)
            VALUES
                (@id_orden, @id_workflow, @id_paso_bitacora, @id_accion_usada, @id_usuario,
                 COALESCE(@comentario, 'Cancelacion via sp_CancelarOrden'),
                 JSON_MODIFY(JSON_MODIFY(JSON_MODIFY(JSON_MODIFY(
                     N'{}',
                     N'$.idWorkflow',      CAST(@id_workflow AS NVARCHAR(10))),
                     N'$.idPasoAnterior',  COALESCE(CAST(@id_paso_actual AS NVARCHAR(10)), N'null')),
                     N'$.idPasoNuevo',     COALESCE(CAST(@id_paso_nuevo  AS NVARCHAR(10)), N'null')),
                     N'$.idEstadoNuevo',   CAST(@id_estado_cancelada AS NVARCHAR(10))),
                 SYSUTCDATETIME());

            SET @bitacora_escrita = 1;
        END

        COMMIT TRANSACTION;

        -- ------------------------------------------------------------
        -- 8. Resumen de la operacion
        -- ------------------------------------------------------------
        SELECT
            @id_orden                        AS id_orden,
            @folio                           AS folio,
            @id_estado_actual                AS id_estado_anterior,
            @id_estado_cancelada             AS id_estado_nuevo,
            'CANCELADA'                      AS estado_nuevo,
            @id_paso_nuevo                   AS id_paso_nuevo,
            @id_accion_usada                 AS id_accion_usada,
            @origen_accion                   AS origen_accion,
            @bitacora_escrita                AS bitacora_escrita;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END
GO

PRINT 'Procedure [config].[sp_CancelarOrden] creado';
GO

-- ============================================================
-- USO
-- ============================================================
-- Cancelar orden simple:
--   EXEC config.sp_CancelarOrden @id_orden = 123, @id_usuario = 45;
--
-- Con motivo:
--   EXEC config.sp_CancelarOrden
--        @id_orden   = 123,
--        @id_usuario = 45,
--        @comentario = N'Orden duplicada';
--
-- Forzando una accion de cancelacion especifica (si el workflow
-- la tiene configurada):
--   EXEC config.sp_CancelarOrden
--        @id_orden   = 123,
--        @id_usuario = 45,
--        @id_accion  = 2;   -- accion tipo CANCELACION del workflow
-- ============================================================
