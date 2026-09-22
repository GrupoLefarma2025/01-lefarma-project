/* ============================================================================
   SCRIPT: sync_lefarmadev_a_lefarma.sql
   PROPOSITO: Sincronizar LEFARMADEV -> LEFARMA (solo "de mas", nada se borra)
   ALCANCE: RH + workflows + config de usuarios + staging. educacion_medica EXCLUIDO.
   - Agrega columnas que Dev tiene y Prod no (workflow_bitacora, workflow_canal_templates)
   - Inserta en Prod los registros que existen en Dev y no en Prod (20 tablas),
     conservando los IDs de Dev (IDENTITY_INSERT) para preservar integridad FK
   EXCLUIDOS (acordado): ordenes de compra, logs.audit/error, app.SchemaVersions,
   archivos.Archivos, operaciones.comprobantes(+partidas), dbo.pruebaeliminar
   Todo corre en UNA transaccion (XACT_ABORT ON): si algo falla, se revierte.
   Los GO separan lotes: SQL Server enlaza cada lote por separado, asi las
   columnas nuevas (ALTER) son visibles para los INSERT posteriores.
   ============================================================================ */

SET NOCOUNT ON;
SET XACT_ABORT ON;
BEGIN TRANSACTION;
GO

    /* ==========================================================================
       SECCION 1 — ALTER TABLE ADD COLUMN (columnas que Dev tiene y Prod no)
       ========================================================================== */

    IF @@TRANCOUNT = 0 THROW 50000, 'Transaccion abortada; el script se detiene.', 1;

    IF COL_LENGTH('Lefarma.config.workflow_bitacora', 'tipo_entidad') IS NULL
        ALTER TABLE Lefarma.config.workflow_bitacora ADD tipo_entidad VARCHAR(30) NULL;
    IF COL_LENGTH('Lefarma.config.workflow_bitacora', 'id_entidad') IS NULL
        ALTER TABLE Lefarma.config.workflow_bitacora ADD id_entidad INT NULL;

    IF COL_LENGTH('Lefarma.config.workflow_canal_templates', 'codigo_proceso') IS NULL
        ALTER TABLE Lefarma.config.workflow_canal_templates ADD codigo_proceso VARCHAR(50) NULL;
    IF COL_LENGTH('Lefarma.config.workflow_canal_templates', 'url_button') IS NULL
        ALTER TABLE Lefarma.config.workflow_canal_templates ADD url_button VARCHAR(200) NULL;

    /* --- Alinear UNIQUE con Dev: en Dev es (codigo_canal, codigo_proceso); en Prod era (codigo_canal) --- */
    IF EXISTS (SELECT 1 FROM Lefarma.sys.key_constraints WHERE name = 'UX_workflow_canal_templates_canal'
               AND parent_object_id = OBJECT_ID('Lefarma.config.workflow_canal_templates'))
        ALTER TABLE Lefarma.config.workflow_canal_templates DROP CONSTRAINT UX_workflow_canal_templates_canal;

GO

    /* Lote aparte: el UPDATE/CREATE INDEX referencian codigo_proceso, que el ALTER del lote
       anterior acaba de crear. Si vivieran en el mismo lote, SQL Server los enlazaria antes
       de ejecutar el ALTER y fallaria con Msg 207 (Invalid column name). */
    IF @@TRANCOUNT = 0 THROW 50000, 'Transaccion abortada; el script se detiene.', 1;

    /* --- Backfill: rellenar codigo_proceso/url_button en las 2 filas existentes con los valores de Dev --- */
    UPDATE p SET p.codigo_proceso = d.codigo_proceso, p.url_button = d.url_button
    FROM Lefarma.config.workflow_canal_templates p
    INNER JOIN LefarmaDev.config.workflow_canal_templates d ON d.id_template = p.id_template
    WHERE p.codigo_proceso IS NULL AND d.codigo_proceso IS NOT NULL;

    IF NOT EXISTS (SELECT 1 FROM Lefarma.sys.indexes WHERE name = 'UX_workflow_canal_templates_canal_proceso'
                   AND object_id = OBJECT_ID('Lefarma.config.workflow_canal_templates'))
        CREATE UNIQUE INDEX UX_workflow_canal_templates_canal_proceso
            ON Lefarma.config.workflow_canal_templates (codigo_canal, codigo_proceso);
GO

    /* ==========================================================================
       SECCION 2 — INSERT ... SELECT (registros en Dev que no existen en Prod)
       Orden por dependencias FK. Se conservan los IDs de Dev (IDENTITY_INSERT).
       ========================================================================== */

    IF @@TRANCOUNT = 0 THROW 50000, 'Transaccion abortada; el script se detiene.', 1;

    /* ------------------------------------------------------------------
       Limpieza de IDENTITY_INSERT: SQL Server permite tener la opcion ON para
       UNA SOLA tabla por sesion. Si una corrida anterior aborto en medio de un
       bloque, el SET ... ON pudo quedar activo y la siguiente corrida fallaria
       con Msg 8107 al intentar encender otra tabla. Estos SET ... OFF son
       no-op cuando la tabla ya esta apagada; garantizan re-ejecucion segura.
       ------------------------------------------------------------------ */
    SET IDENTITY_INSERT Lefarma.config.workflows OFF;
    SET IDENTITY_INSERT Lefarma.config.workflow_tipos_accion OFF;
    SET IDENTITY_INSERT Lefarma.config.workflow_pasos OFF;
    SET IDENTITY_INSERT Lefarma.config.workflow_acciones OFF;
    SET IDENTITY_INSERT Lefarma.config.workflow_participantes OFF;
    SET IDENTITY_INSERT Lefarma.config.workflow_scope_types OFF;
    SET IDENTITY_INSERT Lefarma.config.workflow_mappings OFF;
    SET IDENTITY_INSERT Lefarma.config.workflow_canal_templates OFF;
    SET IDENTITY_INSERT Lefarma.config.workflow_jefes_excluidos OFF;
    SET IDENTITY_INSERT Lefarma.config.empleado_jefes_config OFF;
    SET IDENTITY_INSERT Lefarma.config.empleado_jefes_override OFF;
    SET IDENTITY_INSERT Lefarma.rh.tipo_solicitud OFF;
    SET IDENTITY_INSERT Lefarma.rh.dias_habiles OFF;
    SET IDENTITY_INSERT Lefarma.rh.saldos_vacaciones_anuales OFF;
    SET IDENTITY_INSERT Lefarma.rh.incidencias_checado_notificaciones_historial OFF;
    SET IDENTITY_INSERT Lefarma.rh.solicitudes_personal OFF;
    SET IDENTITY_INSERT Lefarma.rh.solicitudes_personal_detalle OFF;
    SET IDENTITY_INSERT Lefarma.staging.proveedores OFF;
    SET IDENTITY_INSERT Lefarma.staging.proveedor_forma_pago_cuentas OFF;

    /* ---- config.usuario_detalle (PK int, NO identity) ---- */
    INSERT INTO Lefarma.config.usuario_detalle
        (id_usuario, id_empresa, id_sucursal, id_area, id_centro_costo, puesto, numero_empleado, firma_digital,
         telefono_oficina, extension, celular, telegram_chat, notificar_email, notificar_app, notificar_whatsapp,
         notificar_sms, notificar_telegram, notificar_solo_urgentes, notificar_resumen_diario, notificar_rechazos,
         notificar_vencimientos, id_usuario_delegado, delegacion_hasta, avatar_url, tema_interfaz, dashboard_inicio,
         activo, fecha_creacion, fecha_modificacion, firma_path, firma_documento, destinatarios_incidencias_default)
    SELECT d.id_usuario, d.id_empresa, d.id_sucursal, d.id_area, d.id_centro_costo, d.puesto, d.numero_empleado, d.firma_digital,
           d.telefono_oficina, d.extension, d.celular, d.telegram_chat, d.notificar_email, d.notificar_app, d.notificar_whatsapp,
           d.notificar_sms, d.notificar_telegram, d.notificar_solo_urgentes, d.notificar_resumen_diario, d.notificar_rechazos,
           d.notificar_vencimientos, d.id_usuario_delegado, d.delegacion_hasta, d.avatar_url, d.tema_interfaz, d.dashboard_inicio,
           d.activo, d.fecha_creacion, d.fecha_modificacion, d.firma_path, d.firma_documento, d.destinatarios_incidencias_default
    FROM LefarmaDev.config.usuario_detalle d
    WHERE NOT EXISTS (SELECT 1 FROM Lefarma.config.usuario_detalle p WHERE p.id_usuario = d.id_usuario);

    /* ---- config.workflows ---- */
    SET IDENTITY_INSERT Lefarma.config.workflows ON;
    INSERT INTO Lefarma.config.workflows (id_workflow, nombre, descripcion, codigo_proceso, version, activo, fecha_creacion)
    SELECT d.id_workflow, d.nombre, d.descripcion, d.codigo_proceso, d.version, d.activo, d.fecha_creacion
    FROM LefarmaDev.config.workflows d
    WHERE NOT EXISTS (SELECT 1 FROM Lefarma.config.workflows p WHERE p.id_workflow = d.id_workflow);
    SET IDENTITY_INSERT Lefarma.config.workflows OFF;

    /* ---- config.workflow_tipos_accion ---- */
    SET IDENTITY_INSERT Lefarma.config.workflow_tipos_accion ON;
    INSERT INTO Lefarma.config.workflow_tipos_accion (id_tipo_accion, codigo, nombre, descripcion, cambia_estado, activo)
    SELECT d.id_tipo_accion, d.codigo, d.nombre, d.descripcion, d.cambia_estado, d.activo
    FROM LefarmaDev.config.workflow_tipos_accion d
    WHERE NOT EXISTS (SELECT 1 FROM Lefarma.config.workflow_tipos_accion p WHERE p.id_tipo_accion = d.id_tipo_accion);
    SET IDENTITY_INSERT Lefarma.config.workflow_tipos_accion OFF;

    /* ---- config.workflow_pasos ---- */
    SET IDENTITY_INSERT Lefarma.config.workflow_pasos ON;
    INSERT INTO Lefarma.config.workflow_pasos
        (id_paso, id_workflow, orden, nombre_paso, id_estado, descripcion_ayuda, handler_key,
         es_inicio, es_final, requiere_firma, requiere_comentario, requiere_adjunto, activo, permite_adjunto)
    SELECT d.id_paso, d.id_workflow, d.orden, d.nombre_paso, d.id_estado, d.descripcion_ayuda, d.handler_key,
           d.es_inicio, d.es_final, d.requiere_firma, d.requiere_comentario, d.requiere_adjunto, d.activo, d.permite_adjunto
    FROM LefarmaDev.config.workflow_pasos d
    WHERE NOT EXISTS (SELECT 1 FROM Lefarma.config.workflow_pasos p WHERE p.id_paso = d.id_paso);
    SET IDENTITY_INSERT Lefarma.config.workflow_pasos OFF;

    /* ---- config.workflow_acciones ---- */
    SET IDENTITY_INSERT Lefarma.config.workflow_acciones ON;
    INSERT INTO Lefarma.config.workflow_acciones (id_accion, id_paso_origen, id_paso_destino, id_tipo_accion, activo, envia_concentrado)
    SELECT d.id_accion, d.id_paso_origen, d.id_paso_destino, d.id_tipo_accion, d.activo, d.envia_concentrado
    FROM LefarmaDev.config.workflow_acciones d
    WHERE NOT EXISTS (SELECT 1 FROM Lefarma.config.workflow_acciones p WHERE p.id_accion = d.id_accion);
    SET IDENTITY_INSERT Lefarma.config.workflow_acciones OFF;

    /* ---- config.workflow_participantes ---- */
    SET IDENTITY_INSERT Lefarma.config.workflow_participantes ON;
    INSERT INTO Lefarma.config.workflow_participantes
        (id_participante, id_paso, id_rol, id_usuario, activo, nivel_jefe, requiere_jefe_inmediato)
    SELECT d.id_participante, d.id_paso, d.id_rol, d.id_usuario, d.activo, d.nivel_jefe, d.requiere_jefe_inmediato
    FROM LefarmaDev.config.workflow_participantes d
    WHERE NOT EXISTS (SELECT 1 FROM Lefarma.config.workflow_participantes p WHERE p.id_participante = d.id_participante);
    SET IDENTITY_INSERT Lefarma.config.workflow_participantes OFF;

    /* ---- config.workflow_scope_types (catalogo padre de workflow_mappings.id_scope_type;
            sin el, el INSERT de mappings falla con Msg 547 FK_workflow_mappings_scope_type) ---- */
    SET IDENTITY_INSERT Lefarma.config.workflow_scope_types ON;
    INSERT INTO Lefarma.config.workflow_scope_types
        (id_scope_type, codigo, nombre, nivel_prioridad, descripcion, activo, fecha_creacion)
    SELECT d.id_scope_type, d.codigo, d.nombre, d.nivel_prioridad, d.descripcion, d.activo, d.fecha_creacion
    FROM LefarmaDev.config.workflow_scope_types d
    WHERE NOT EXISTS (SELECT 1 FROM Lefarma.config.workflow_scope_types p WHERE p.id_scope_type = d.id_scope_type);
    SET IDENTITY_INSERT Lefarma.config.workflow_scope_types OFF;

    /* ---- config.workflow_mappings ---- */
    SET IDENTITY_INSERT Lefarma.config.workflow_mappings ON;
    INSERT INTO Lefarma.config.workflow_mappings
        (id_mapping, codigo_proceso, id_scope_type, scope_id, id_workflow, prioridad_manual, activo,
         observaciones, fecha_creacion, creado_por, fecha_actualizacion)
    SELECT d.id_mapping, d.codigo_proceso, d.id_scope_type, d.scope_id, d.id_workflow, d.prioridad_manual, d.activo,
           d.observaciones, d.fecha_creacion, d.creado_por, d.fecha_actualizacion
    FROM LefarmaDev.config.workflow_mappings d
    WHERE NOT EXISTS (SELECT 1 FROM Lefarma.config.workflow_mappings p WHERE p.id_mapping = d.id_mapping);
    SET IDENTITY_INSERT Lefarma.config.workflow_mappings OFF;

    /* ---- config.workflow_canal_templates ---- */
    SET IDENTITY_INSERT Lefarma.config.workflow_canal_templates ON;
    INSERT INTO Lefarma.config.workflow_canal_templates
        (id_template, codigo_canal, nombre, layout_html, activo, fecha_modificacion, codigo_proceso, url_button)
    SELECT d.id_template, d.codigo_canal, d.nombre, d.layout_html, d.activo, d.fecha_modificacion, d.codigo_proceso, d.url_button
    FROM LefarmaDev.config.workflow_canal_templates d
    WHERE NOT EXISTS (SELECT 1 FROM Lefarma.config.workflow_canal_templates p WHERE p.id_template = d.id_template);
    SET IDENTITY_INSERT Lefarma.config.workflow_canal_templates OFF;

    /* ---- config.workflow_jefes_excluidos ---- */
    SET IDENTITY_INSERT Lefarma.config.workflow_jefes_excluidos ON;
    INSERT INTO Lefarma.config.workflow_jefes_excluidos
        (id_exclusion, id_workflow, id_usuario_jefe, activo, fecha_creacion, fecha_modificacion)
    SELECT d.id_exclusion, d.id_workflow, d.id_usuario_jefe, d.activo, d.fecha_creacion, d.fecha_modificacion
    FROM LefarmaDev.config.workflow_jefes_excluidos d
    WHERE NOT EXISTS (SELECT 1 FROM Lefarma.config.workflow_jefes_excluidos p WHERE p.id_exclusion = d.id_exclusion);
    SET IDENTITY_INSERT Lefarma.config.workflow_jefes_excluidos OFF;

    /* ---- config.empleado_jefes_config ---- */
    SET IDENTITY_INSERT Lefarma.config.empleado_jefes_config ON;
    INSERT INTO Lefarma.config.empleado_jefes_config
        (id_config, id_usuario, nivel, aplica, activo, fecha_creacion, fecha_modificacion)
    SELECT d.id_config, d.id_usuario, d.nivel, d.aplica, d.activo, d.fecha_creacion, d.fecha_modificacion
    FROM LefarmaDev.config.empleado_jefes_config d
    WHERE NOT EXISTS (SELECT 1 FROM Lefarma.config.empleado_jefes_config p WHERE p.id_config = d.id_config);
    SET IDENTITY_INSERT Lefarma.config.empleado_jefes_config OFF;

    /* ---- config.empleado_jefes_override ---- */
    SET IDENTITY_INSERT Lefarma.config.empleado_jefes_override ON;
    INSERT INTO Lefarma.config.empleado_jefes_override
        (id_override, id_usuario, nivel, id_usuario_jefe, activo, fecha_creacion, fecha_modificacion)
    SELECT d.id_override, d.id_usuario, d.nivel, d.id_usuario_jefe, d.activo, d.fecha_creacion, d.fecha_modificacion
    FROM LefarmaDev.config.empleado_jefes_override d
    WHERE NOT EXISTS (SELECT 1 FROM Lefarma.config.empleado_jefes_override p WHERE p.id_override = d.id_override);
    SET IDENTITY_INSERT Lefarma.config.empleado_jefes_override OFF;

    /* ---- rh.tipo_solicitud ---- */
    SET IDENTITY_INSERT Lefarma.rh.tipo_solicitud ON;
    INSERT INTO Lefarma.rh.tipo_solicitud
        (id_tipo_solicitud, nombre, nombre_normalizado, descripcion, descripcion_normalizada, clave, categoria,
         requiere_reposicion_tiempo, requiere_fecha_fin, requiere_fecha_regreso, requiere_lugar_comision,
         descuenta_nomina, descuenta_vacaciones, requiere_documentacion, activo, fecha_creacion, fecha_modificacion,
         limite_por_periodo, periodo_limite, total_para_descuento, permite_fechas_pasadas, permite_fechas_futuras,
         toma_en_cuenta_checado, requiere_incidencias_existentes, pide_dias_solicitados)
    SELECT d.id_tipo_solicitud, d.nombre, d.nombre_normalizado, d.descripcion, d.descripcion_normalizada, d.clave, d.categoria,
           d.requiere_reposicion_tiempo, d.requiere_fecha_fin, d.requiere_fecha_regreso, d.requiere_lugar_comision,
           d.descuenta_nomina, d.descuenta_vacaciones, d.requiere_documentacion, d.activo, d.fecha_creacion, d.fecha_modificacion,
           d.limite_por_periodo, d.periodo_limite, d.total_para_descuento, d.permite_fechas_pasadas, d.permite_fechas_futuras,
           d.toma_en_cuenta_checado, d.requiere_incidencias_existentes, d.pide_dias_solicitados
    FROM LefarmaDev.rh.tipo_solicitud d
    WHERE NOT EXISTS (SELECT 1 FROM Lefarma.rh.tipo_solicitud p WHERE p.id_tipo_solicitud = d.id_tipo_solicitud);
    SET IDENTITY_INSERT Lefarma.rh.tipo_solicitud OFF;

    /* ---- rh.dias_habiles ---- */
    SET IDENTITY_INSERT Lefarma.rh.dias_habiles ON;
    INSERT INTO Lefarma.rh.dias_habiles
        (id_dia_habil, id_empresa, id_sucursal, anio, mes, dia, fecha, descripcion, activo,
         fecha_creacion, consume_saldo, permite_saldo_negativo, es_dia_laboral)
    SELECT d.id_dia_habil, d.id_empresa, d.id_sucursal, d.anio, d.mes, d.dia, d.fecha, d.descripcion, d.activo,
           d.fecha_creacion, d.consume_saldo, d.permite_saldo_negativo, d.es_dia_laboral
    FROM LefarmaDev.rh.dias_habiles d
    WHERE NOT EXISTS (SELECT 1 FROM Lefarma.rh.dias_habiles p WHERE p.id_dia_habil = d.id_dia_habil);
    SET IDENTITY_INSERT Lefarma.rh.dias_habiles OFF;

    /* ---- rh.saldos_vacaciones_anuales ---- */
    SET IDENTITY_INSERT Lefarma.rh.saldos_vacaciones_anuales ON;
    INSERT INTO Lefarma.rh.saldos_vacaciones_anuales
        (id_saldo, id_usuario, id_empresa, anio, dias_generados, dias_vencidos, dias_compensados,
         dias_ajustados, dias_tomados, activo, fecha_creacion, fecha_modificacion)
    SELECT d.id_saldo, d.id_usuario, d.id_empresa, d.anio, d.dias_generados, d.dias_vencidos, d.dias_compensados,
           d.dias_ajustados, d.dias_tomados, d.activo, d.fecha_creacion, d.fecha_modificacion
    FROM LefarmaDev.rh.saldos_vacaciones_anuales d
    WHERE NOT EXISTS (SELECT 1 FROM Lefarma.rh.saldos_vacaciones_anuales p WHERE p.id_saldo = d.id_saldo);
    SET IDENTITY_INSERT Lefarma.rh.saldos_vacaciones_anuales OFF;

    /* ---- rh.incidencias_checado_notificaciones_historial ---- */
    SET IDENTITY_INSERT Lefarma.rh.incidencias_checado_notificaciones_historial ON;
    INSERT INTO Lefarma.rh.incidencias_checado_notificaciones_historial
        (id, notification_id, nomina, nombre, periodo, fecha_inicio, fecha_fin, asunto, mensaje, canales,
         exitoso, error, enviado_por, fecha_envio)
    SELECT d.id, d.notification_id, d.nomina, d.nombre, d.periodo, d.fecha_inicio, d.fecha_fin, d.asunto, d.mensaje, d.canales,
           d.exitoso, d.error, d.enviado_por, d.fecha_envio
    FROM LefarmaDev.rh.incidencias_checado_notificaciones_historial d
    WHERE NOT EXISTS (SELECT 1 FROM Lefarma.rh.incidencias_checado_notificaciones_historial p WHERE p.id = d.id);
    SET IDENTITY_INSERT Lefarma.rh.incidencias_checado_notificaciones_historial OFF;

    /* ---- rh.solicitudes_personal ---- */
    SET IDENTITY_INSERT Lefarma.rh.solicitudes_personal ON;
    INSERT INTO Lefarma.rh.solicitudes_personal
        (id_solicitud, folio, id_empresa, id_sucursal, id_area, id_usuario_solicitante, id_estado, id_workflow,
         id_paso_actual, id_tipo_solicitud, lugar_comision, motivo, id_usuario_creador, fecha_envio,
         fecha_inicio, fecha_fin, fecha_reposicion, dias_solicitados, fecha_regreso, fecha_creacion, fecha_modificacion)
    SELECT d.id_solicitud, d.folio, d.id_empresa, d.id_sucursal, d.id_area, d.id_usuario_solicitante, d.id_estado, d.id_workflow,
           d.id_paso_actual, d.id_tipo_solicitud, d.lugar_comision, d.motivo, d.id_usuario_creador, d.fecha_envio,
           d.fecha_inicio, d.fecha_fin, d.fecha_reposicion, d.dias_solicitados, d.fecha_regreso, d.fecha_creacion, d.fecha_modificacion
    FROM LefarmaDev.rh.solicitudes_personal d
    WHERE NOT EXISTS (SELECT 1 FROM Lefarma.rh.solicitudes_personal p WHERE p.id_solicitud = d.id_solicitud);
    SET IDENTITY_INSERT Lefarma.rh.solicitudes_personal OFF;

    /* ---- rh.solicitudes_personal_detalle ---- */
    SET IDENTITY_INSERT Lefarma.rh.solicitudes_personal_detalle ON;
    INSERT INTO Lefarma.rh.solicitudes_personal_detalle (id_detalle, id_solicitud, fecha, comentario, fecha_creacion)
    SELECT d.id_detalle, d.id_solicitud, d.fecha, d.comentario, d.fecha_creacion
    FROM LefarmaDev.rh.solicitudes_personal_detalle d
    WHERE NOT EXISTS (SELECT 1 FROM Lefarma.rh.solicitudes_personal_detalle p WHERE p.id_detalle = d.id_detalle);
    SET IDENTITY_INSERT Lefarma.rh.solicitudes_personal_detalle OFF;

    /* ---- staging.proveedores ---- */
    SET IDENTITY_INSERT Lefarma.staging.proveedores ON;
    INSERT INTO Lefarma.staging.proveedores
        (id_staging, id_proveedor, razon_social, razon_social_normalizada, rfc, codigo_postal, regimen_fiscal_id,
         uso_cfdi, sin_datos_fiscales, estatus, cambio_estatus_por, fecha_registro, fecha_modificacion,
         fecha_staging, editado_por)
    SELECT d.id_staging, d.id_proveedor, d.razon_social, d.razon_social_normalizada, d.rfc, d.codigo_postal, d.regimen_fiscal_id,
           d.uso_cfdi, d.sin_datos_fiscales, d.estatus, d.cambio_estatus_por, d.fecha_registro, d.fecha_modificacion,
           d.fecha_staging, d.editado_por
    FROM LefarmaDev.staging.proveedores d
    WHERE NOT EXISTS (SELECT 1 FROM Lefarma.staging.proveedores p WHERE p.id_staging = d.id_staging);
    SET IDENTITY_INSERT Lefarma.staging.proveedores OFF;

    /* ---- staging.proveedor_forma_pago_cuentas ---- */
    SET IDENTITY_INSERT Lefarma.staging.proveedor_forma_pago_cuentas ON;
    INSERT INTO Lefarma.staging.proveedor_forma_pago_cuentas
        (id_staging_cuenta, id_staging, id_forma_pago, id_banco, numero_cuenta, clabe, numero_tarjeta,
         beneficiario, correo_notificacion, activo, id_cuen, caratula_path)
    SELECT d.id_staging_cuenta, d.id_staging, d.id_forma_pago, d.id_banco, d.numero_cuenta, d.clabe, d.numero_tarjeta,
           d.beneficiario, d.correo_notificacion, d.activo, d.id_cuen, d.caratula_path
    FROM LefarmaDev.staging.proveedor_forma_pago_cuentas d
    WHERE NOT EXISTS (SELECT 1 FROM Lefarma.staging.proveedor_forma_pago_cuentas p WHERE p.id_staging_cuenta = d.id_staging_cuenta);
    SET IDENTITY_INSERT Lefarma.staging.proveedor_forma_pago_cuentas OFF;

GO

    /* ==========================================================================
       SECCION 3 — Verificacion: conteos en Lefarma despues de la sincronizacion
       ========================================================================== */

    IF @@TRANCOUNT = 0 THROW 50000, 'Transaccion abortada; el script se detiene.', 1;

    SELECT 'config.workflows' AS tabla, COUNT(*) AS filas FROM Lefarma.config.workflows
    UNION ALL SELECT 'config.workflow_tipos_accion', COUNT(*) FROM Lefarma.config.workflow_tipos_accion
    UNION ALL SELECT 'config.workflow_pasos', COUNT(*) FROM Lefarma.config.workflow_pasos
    UNION ALL SELECT 'config.workflow_acciones', COUNT(*) FROM Lefarma.config.workflow_acciones
    UNION ALL SELECT 'config.workflow_participantes', COUNT(*) FROM Lefarma.config.workflow_participantes
    UNION ALL SELECT 'config.workflow_scope_types', COUNT(*) FROM Lefarma.config.workflow_scope_types
    UNION ALL SELECT 'config.workflow_mappings', COUNT(*) FROM Lefarma.config.workflow_mappings
    UNION ALL SELECT 'config.workflow_canal_templates', COUNT(*) FROM Lefarma.config.workflow_canal_templates
    UNION ALL SELECT 'config.workflow_jefes_excluidos', COUNT(*) FROM Lefarma.config.workflow_jefes_excluidos
    UNION ALL SELECT 'config.empleado_jefes_config', COUNT(*) FROM Lefarma.config.empleado_jefes_config
    UNION ALL SELECT 'config.empleado_jefes_override', COUNT(*) FROM Lefarma.config.empleado_jefes_override
    UNION ALL SELECT 'config.usuario_detalle', COUNT(*) FROM Lefarma.config.usuario_detalle
    UNION ALL SELECT 'rh.dias_habiles', COUNT(*) FROM Lefarma.rh.dias_habiles
    UNION ALL SELECT 'rh.saldos_vacaciones_anuales', COUNT(*) FROM Lefarma.rh.saldos_vacaciones_anuales
    UNION ALL SELECT 'rh.incidencias_checado_notificaciones_historial', COUNT(*) FROM Lefarma.rh.incidencias_checado_notificaciones_historial
    UNION ALL SELECT 'rh.solicitudes_personal', COUNT(*) FROM Lefarma.rh.solicitudes_personal
    UNION ALL SELECT 'rh.solicitudes_personal_detalle', COUNT(*) FROM Lefarma.rh.solicitudes_personal_detalle
    UNION ALL SELECT 'rh.tipo_solicitud', COUNT(*) FROM Lefarma.rh.tipo_solicitud
    UNION ALL SELECT 'staging.proveedores', COUNT(*) FROM Lefarma.staging.proveedores
    UNION ALL SELECT 'staging.proveedor_forma_pago_cuentas', COUNT(*) FROM Lefarma.staging.proveedor_forma_pago_cuentas;
GO

IF @@TRANCOUNT > 0
BEGIN
    COMMIT TRANSACTION;
    PRINT 'SINCRONIZACION COMPLETADA CORRECTAMENTE (commit aplicado).';
END
ELSE
    PRINT 'NO SE APLICO NADA: la transaccion fue abortada por errores anteriores. Revisar mensajes previos.';
GO
