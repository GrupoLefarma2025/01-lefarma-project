/* =============================================================================
   SP: config.sp_ClonarWorkflow
   Clona un workflow COMPLETO (deep copy) remapeando todos los IDs internos,
   con sustitucion opcional de roles / usuarios en los participantes.

   Tablas clonadas (en orden de dependencia):
     config.workflows
     config.workflow_pasos
     config.workflow_participantes      <- aplica sustitucion rol/usuario
     config.workflow_acciones           <- remapea id_paso_origen / id_paso_destino
     config.workflow_accion_handlers
     config.workflow_condiciones        <- remapea id_paso_si_cumple
     config.workflow_notificaciones     <- remapea id_paso_destino
     config.workflow_notificacion_canal
     config.workflow_recordatorio       <- remapea id_paso
     config.workflow_recordatorio_canal

   NO se clonan (catalogo global / historico):
     config.workflow_campos      (global; los handlers reusan el mismo id_workflow_campo)
     config.workflow_estados / workflow_tipos_accion / workflow_tipo_notificacion (catalogos)
     workflow_bitacora / workflow_recordatorio_log (historico de ejecucion)
     config.workflow_mapping     (decision de negocio: a que proceso aplica; se crea aparte)

   Parametros:
     @SourceIdWorkflow   id del workflow a clonar
     @NuevoNombre        nombre del clon
     @NuevoCodigoProceso codigo_proceso del clon (UNIQUE -> no puede repetir)
     @Sustituciones      JSON opcional. Ej:
         [
           { "tipo": "rol",      "de": 5,  "a": 8  },
           { "tipo": "usuario",  "de": 12, "a": 30 }
         ]
     @NuevoIdWorkflow    OUTPUT: id del workflow recien creado

   Notas:
     - Clona TODAS las filas (activas e inactivas) para ser copia fiel.
     - El clon hereda 'version' y 'activo' del original; togglealo despues si querés.
     - Todo corre en UNA transaccion: o se clona entero, o no se clona nada.
   ============================================================================= */

IF OBJECT_ID('config.sp_ClonarWorkflow', 'P') IS NOT NULL
    DROP PROCEDURE config.sp_ClonarWorkflow;
GO

CREATE PROCEDURE config.sp_ClonarWorkflow
    @SourceIdWorkflow   INT,
    @NuevoNombre        NVARCHAR(100),
    @NuevoCodigoProceso NVARCHAR(50),
    @Sustituciones      NVARCHAR(MAX) = NULL,
    @NuevoIdWorkflow    INT = NULL OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;   -- cualquier error aborta la transaccion entera

    -- ---- Validaciones de entrada -------------------------------------------
    IF NOT EXISTS (SELECT 1 FROM config.workflows WHERE id_workflow = @SourceIdWorkflow)
    BEGIN
        RAISERROR('El workflow origen %d no existe.', 16, 1, @SourceIdWorkflow);
        RETURN;
    END

    IF EXISTS (SELECT 1 FROM config.workflows WHERE codigo_proceso = @NuevoCodigoProceso)
    BEGIN
        RAISERROR('Ya existe un workflow con codigo_proceso = %s.', 16, 1, @NuevoCodigoProceso);
        RETURN;
    END

    -- ---- Parse de sustituciones (JSON -> tablas) ---------------------------
    DECLARE @sub_rol     TABLE (de INT PRIMARY KEY, a INT);
    DECLARE @sub_usuario TABLE (de INT PRIMARY KEY, a INT);

    IF @Sustituciones IS NOT NULL AND LEN(@Sustituciones) > 0
    BEGIN
        INSERT INTO @sub_rol (de, a)
        SELECT j.de, j.a
        FROM OPENJSON(@Sustituciones)
            WITH (tipo NVARCHAR(20) '$.tipo', de INT '$.de', a INT '$.a') j
        WHERE j.tipo = 'rol' AND j.de IS NOT NULL AND j.a IS NOT NULL;

        INSERT INTO @sub_usuario (de, a)
        SELECT j.de, j.a
        FROM OPENJSON(@Sustituciones)
            WITH (tipo NVARCHAR(20) '$.tipo', de INT '$.de', a INT '$.a') j
        WHERE j.tipo = 'usuario' AND j.de IS NOT NULL AND j.a IS NOT NULL;
    END

    -- ---- Tablas de mapeo viejo -> nuevo ------------------------------------
    DECLARE @map_paso         TABLE (old_id INT PRIMARY KEY, new_id INT);
    DECLARE @map_accion       TABLE (old_id INT PRIMARY KEY, new_id INT);
    DECLARE @map_notif        TABLE (old_id INT PRIMARY KEY, new_id INT);
    DECLARE @map_recordatorio TABLE (old_id INT PRIMARY KEY, new_id INT);

    BEGIN TRY
        BEGIN TRANSACTION;

        -- 1) WORKFLOW raiz ---------------------------------------------------
        INSERT INTO config.workflows (nombre, descripcion, codigo_proceso, version, activo, fecha_creacion)
        SELECT @NuevoNombre, descripcion, @NuevoCodigoProceso, version, activo, GETDATE()
        FROM config.workflows
        WHERE id_workflow = @SourceIdWorkflow;

        SET @NuevoIdWorkflow = SCOPE_IDENTITY();

        -- 2) PASOS  (MERGE para capturar old_id -> new_id) -------------------
        MERGE INTO config.workflow_pasos AS tgt
        USING (
            SELECT id_paso, orden, nombre_paso, id_estado, descripcion_ayuda,
                   es_inicio, es_final, activo, requiere_firma, requiere_comentario,
                   requiere_adjunto, permite_adjunto
            FROM config.workflow_pasos
            WHERE id_workflow = @SourceIdWorkflow
        ) AS src
        ON 1 = 0   -- nunca matchea -> siempre INSERT
        WHEN NOT MATCHED THEN
            INSERT (id_workflow, orden, nombre_paso, id_estado, descripcion_ayuda,
                    es_inicio, es_final, activo, requiere_firma, requiere_comentario,
                    requiere_adjunto, permite_adjunto)
            VALUES (@NuevoIdWorkflow, src.orden, src.nombre_paso, src.id_estado, src.descripcion_ayuda,
                    src.es_inicio, src.es_final, src.activo, src.requiere_firma, src.requiere_comentario,
                    src.requiere_adjunto, src.permite_adjunto)
        OUTPUT src.id_paso, inserted.id_paso INTO @map_paso (old_id, new_id);

        -- 3) PARTICIPANTES  (aplica sustitucion rol/usuario) -----------------
        INSERT INTO config.workflow_participantes (id_paso, id_rol, id_usuario, activo)
        SELECT mp.new_id,
               COALESCE(sr.a, p.id_rol),       -- si hay sustitucion de rol, usala
               COALESCE(su.a, p.id_usuario),   -- si hay sustitucion de usuario, usala
               p.activo
        FROM config.workflow_participantes p
        JOIN @map_paso mp        ON mp.old_id = p.id_paso
        LEFT JOIN @sub_rol sr     ON sr.de = p.id_rol
        LEFT JOIN @sub_usuario su ON su.de = p.id_usuario;

        -- 4) ACCIONES  (remapea paso origen y paso destino) ------------------
        MERGE INTO config.workflow_acciones AS tgt
        USING (
            SELECT a.id_accion,
                   mo.new_id AS new_origen,
                   md.new_id AS new_destino,   -- NULL si la accion finaliza el flujo
                   a.id_tipo_accion, a.envia_concentrado, a.activo
            FROM config.workflow_acciones a
            JOIN @map_paso mo      ON mo.old_id = a.id_paso_origen
            LEFT JOIN @map_paso md ON md.old_id = a.id_paso_destino
        ) AS src
        ON 1 = 0
        WHEN NOT MATCHED THEN
            INSERT (id_paso_origen, id_paso_destino, id_tipo_accion, envia_concentrado, activo)
            VALUES (src.new_origen, src.new_destino, src.id_tipo_accion, src.envia_concentrado, src.activo)
        OUTPUT src.id_accion, inserted.id_accion INTO @map_accion (old_id, new_id);

        -- 5) HANDLERS  (id_workflow_campo es catalogo global -> se reusa) ----
        INSERT INTO config.workflow_accion_handlers
            (id_accion, handler_key, requerido, configuracion_json, orden_ejecucion, activo, id_workflow_campo)
        SELECT ma.new_id, h.handler_key, h.requerido, h.configuracion_json,
               h.orden_ejecucion, h.activo, h.id_workflow_campo
        FROM config.workflow_accion_handlers h
        JOIN @map_accion ma ON ma.old_id = h.id_accion;

        -- 6) CONDICIONES  (remapea id_paso_si_cumple) ------------------------
        INSERT INTO config.workflow_condiciones
            (id_accion, campo_evaluacion, operador, valor_comparacion, id_paso_si_cumple, activo)
        SELECT ma.new_id, c.campo_evaluacion, c.operador, c.valor_comparacion, mp.new_id, c.activo
        FROM config.workflow_condiciones c
        JOIN @map_accion ma ON ma.old_id = c.id_accion
        JOIN @map_paso mp   ON mp.old_id = c.id_paso_si_cumple;

        -- 7) NOTIFICACIONES  (remapea id_paso_destino; MERGE para mapear) ----
        MERGE INTO config.workflow_notificaciones AS tgt
        USING (
            SELECT n.id_notificacion,
                   ma.new_id AS new_accion,
                   mp.new_id AS new_destino,   -- NULL permitido
                   n.enviar_email, n.enviar_whatsapp, n.enviar_telegram,
                   n.avisar_al_creador, n.avisar_al_siguiente, n.avisar_al_anterior,
                   n.avisar_a_autorizadores_previos, n.incluir_partidas, n.activo,
                   n.id_tipo_notificacion
            FROM config.workflow_notificaciones n
            JOIN @map_accion ma   ON ma.old_id = n.id_accion
            LEFT JOIN @map_paso mp ON mp.old_id = n.id_paso_destino
        ) AS src
        ON 1 = 0
        WHEN NOT MATCHED THEN
            INSERT (id_accion, id_paso_destino, enviar_email, enviar_whatsapp, enviar_telegram,
                    avisar_al_creador, avisar_al_siguiente, avisar_al_anterior,
                    avisar_a_autorizadores_previos, incluir_partidas, activo, id_tipo_notificacion)
            VALUES (src.new_accion, src.new_destino, src.enviar_email, src.enviar_whatsapp, src.enviar_telegram,
                    src.avisar_al_creador, src.avisar_al_siguiente, src.avisar_al_anterior,
                    src.avisar_a_autorizadores_previos, src.incluir_partidas, src.activo, src.id_tipo_notificacion)
        OUTPUT src.id_notificacion, inserted.id_notificacion INTO @map_notif (old_id, new_id);

        -- 8) CANALES DE NOTIFICACION ----------------------------------------
        INSERT INTO config.workflow_notificacion_canal
            (id_notificacion, codigo_canal, asunto_template, cuerpo_template, listado_row_html, activo)
        SELECT mn.new_id, nc.codigo_canal, nc.asunto_template, nc.cuerpo_template, nc.listado_row_html, nc.activo
        FROM config.workflow_notificacion_canal nc
        JOIN @map_notif mn ON mn.old_id = nc.id_notificacion;

        -- 9) RECORDATORIOS  (remapea id_paso; MERGE para mapear) -------------
        MERGE INTO config.workflow_recordatorio AS tgt
        USING (
            SELECT r.id_recordatorio,
                   mp.new_id AS new_paso,   -- NULL permitido (recordatorio a nivel workflow)
                   r.nombre, r.activo, r.tipo_trigger, r.hora_envio, r.dias_semana,
                   r.intervalo_horas, r.fecha_especifica, r.min_ordenes_pendientes,
                   r.min_dias_en_paso, r.monto_minimo, r.monto_maximo, r.escalar_a_jerarquia,
                   r.dias_para_escalar, r.enviar_al_responsable, r.enviar_email,
                   r.enviar_whatsapp, r.enviar_telegram
            FROM config.workflow_recordatorio r
            LEFT JOIN @map_paso mp ON mp.old_id = r.id_paso
            WHERE r.id_workflow = @SourceIdWorkflow
        ) AS src
        ON 1 = 0
        WHEN NOT MATCHED THEN
            INSERT (id_workflow, id_paso, nombre, activo, tipo_trigger, hora_envio, dias_semana,
                    intervalo_horas, fecha_especifica, min_ordenes_pendientes, min_dias_en_paso,
                    monto_minimo, monto_maximo, escalar_a_jerarquia, dias_para_escalar,
                    enviar_al_responsable, enviar_email, enviar_whatsapp, enviar_telegram, fecha_creacion)
            VALUES (@NuevoIdWorkflow, src.new_paso, src.nombre, src.activo, src.tipo_trigger, src.hora_envio, src.dias_semana,
                    src.intervalo_horas, src.fecha_especifica, src.min_ordenes_pendientes, src.min_dias_en_paso,
                    src.monto_minimo, src.monto_maximo, src.escalar_a_jerarquia, src.dias_para_escalar,
                    src.enviar_al_responsable, src.enviar_email, src.enviar_whatsapp, src.enviar_telegram, GETDATE())
        OUTPUT src.id_recordatorio, inserted.id_recordatorio INTO @map_recordatorio (old_id, new_id);

        -- 10) CANALES DE RECORDATORIO ---------------------------------------
        INSERT INTO config.workflow_recordatorio_canal
            (id_recordatorio, codigo_canal, asunto_template, cuerpo_template, listado_row_html, activo)
        SELECT mr.new_id, rc.codigo_canal, rc.asunto_template, rc.cuerpo_template, rc.listado_row_html, rc.activo
        FROM config.workflow_recordatorio_canal rc
        JOIN @map_recordatorio mr ON mr.old_id = rc.id_recordatorio;

        COMMIT TRANSACTION;

        -- Devuelve el id nuevo tambien como resultset (comodo desde el front)
        SELECT @NuevoIdWorkflow AS idWorkflow;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
        THROW;   -- re-lanza el error original al caller
    END CATCH
END
GO

/* =============================================================================
   SMOKE TEST (correr a mano; no es parte del SP)
   Clona y verifica que cada tabla tenga el MISMO conteo que el origen.
   ============================================================================= */
/*
DECLARE @src INT = 1;            -- <-- id del workflow a clonar
DECLARE @nuevo INT;

EXEC config.sp_ClonarWorkflow
     @SourceIdWorkflow   = @src,
     @NuevoNombre        = N'PRUEBA CLON',
     @NuevoCodigoProceso = N'PRUEBA_CLON_001',
     @Sustituciones      = N'[{"tipo":"rol","de":5,"a":8}]',
     @NuevoIdWorkflow    = @nuevo OUTPUT;

SELECT tabla, origen, clon,
       CASE WHEN origen = clon THEN 'OK' ELSE 'MISMATCH' END AS estado
FROM (
    SELECT 'pasos' tabla,
           (SELECT COUNT(*) FROM config.workflow_pasos WHERE id_workflow=@src) origen,
           (SELECT COUNT(*) FROM config.workflow_pasos WHERE id_workflow=@nuevo) clon
    UNION ALL SELECT 'acciones',
           (SELECT COUNT(*) FROM config.workflow_acciones a JOIN config.workflow_pasos p ON p.id_paso=a.id_paso_origen WHERE p.id_workflow=@src),
           (SELECT COUNT(*) FROM config.workflow_acciones a JOIN config.workflow_pasos p ON p.id_paso=a.id_paso_origen WHERE p.id_workflow=@nuevo)
    UNION ALL SELECT 'participantes',
           (SELECT COUNT(*) FROM config.workflow_participantes pa JOIN config.workflow_pasos p ON p.id_paso=pa.id_paso WHERE p.id_workflow=@src),
           (SELECT COUNT(*) FROM config.workflow_participantes pa JOIN config.workflow_pasos p ON p.id_paso=pa.id_paso WHERE p.id_workflow=@nuevo)
    UNION ALL SELECT 'recordatorios',
           (SELECT COUNT(*) FROM config.workflow_recordatorio WHERE id_workflow=@src),
           (SELECT COUNT(*) FROM config.workflow_recordatorio WHERE id_workflow=@nuevo)
) t;

-- limpieza del clon de prueba (cascada borra pasos/acciones/etc.)
-- DELETE FROM config.workflows WHERE id_workflow=@nuevo;
*/



--DECLARE @nuevo INT;

--EXEC config.sp_ClonarWorkflow
--     @SourceIdWorkflow   = 1,
--     @NuevoNombre        = N'Workflow Lefarma javier',
--     @NuevoCodigoProceso = N'Workflow Lefarma javier',
--     @Sustituciones      = NULL,
--     @NuevoIdWorkflow    = @nuevo OUTPUT;

--SELECT @nuevo AS nuevoId;


--update   [config].[workflows]
--set codigo_proceso = 'ORDEN_COMPRA'
--where id_workflow  =7