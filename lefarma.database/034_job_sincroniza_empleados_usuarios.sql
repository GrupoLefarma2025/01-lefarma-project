/* ============================================================================
   034_job_sincroniza_empleados_usuarios.sql
   Grupo Lefarma — Job diario de SQL Agent para la sincronización de usuarios

   QUÉ HACE
   --------
   Crea el job de SQL Agent que ejecuta
       EXEC Asokam.app.sp_sincroniza_empleados_usuarios;
   de LUNES a VIERNES a las 07:50 AM (hora del servidor 192.168.4.2).

   El SP a su vez envía (solo si hay filas) los correos de acciones,
   nombres corregidos, nombres por revisar y pendientes sin AD
   a 6@grupolefarma.com.mx.

   CONVENCIONES (mismas que los jobs existentes del servidor)
   ----------------------------------------------------------
   - Nombre:  SP_Jobs_SincronizaEmpleadosUsuarios
   - Owner:   poweru
   - Reintento: 1 intento extra a los 10 min (por si el linked server
     [ESFR-DOCTS] a 192.168.1.5 falla transitoriamente a primera hora).

   HORARIO
   -------
   freq_type = 8 (semanal), freq_interval = 62
   (lunes 2 + martes 4 + miércoles 8 + jueves 16 + viernes 32),
   freq_recurrence_factor = 1 (cada semana),
   active_start_time = 075000 (07:50:00).

   DÓNDE EJECUTAR
   --------------
   Servidor 192.168.4.2 (SSMS). Requiere permisos de agent (SQLAgentOperatorRole
   o sysadmin). El script es RE-EJECUTABLE: si el job ya existe, lo elimina y
   lo vuelve a crear idéntico.

   PROBAR SIN ESPERAR AL LUNES
   ---------------------------
   EXEC msdb.dbo.sp_start_job @job_name = 'SP_Jobs_SincronizaEmpleadosUsuarios';
   -- y ~1 min después:
   SELECT TOP (5) h.run_date, h.run_time, h.run_status, h.message
   FROM msdb.dbo.sysjobhistory h
   JOIN msdb.dbo.sysjobs j ON j.job_id = h.job_id
   WHERE j.name = 'SP_Jobs_SincronizaEmpleadosUsuarios'
   ORDER BY h.instance_id DESC;
   ============================================================================ */

USE msdb;
GO

/* --- Si ya existe, se elimina para recrearlo idéntico --------------------- */
IF EXISTS (SELECT 1 FROM msdb.dbo.sysjobs WHERE name = N'SP_Jobs_SincronizaEmpleadosUsuarios')
    EXEC msdb.dbo.sp_delete_job @job_name = N'SP_Jobs_SincronizaEmpleadosUsuarios', @delete_unused_schedule = 1;

/* --- 1) Crear el job ------------------------------------------------------ */
DECLARE @job_id UNIQUEIDENTIFIER;

EXEC msdb.dbo.sp_add_job
     @job_name           = N'SP_Jobs_SincronizaEmpleadosUsuarios',
     @enabled            = 1,
     @description        = N'Sincroniza app.usuarios y config.usuario_detalle con RH (vwEmpleados) y AD (vwDirectorioActivo). L-V 07:50. Envía correos de acciones/nombres/pendientes a 6@grupolefarma.com.mx.',
     @owner_login_name   = N'poweru',
     @notify_level_eventlog = 2,
     @job_id             = @job_id OUTPUT;

/* --- 2) Paso del job: ejecutar el SP -------------------------------------- */
EXEC msdb.dbo.sp_add_jobstep
     @job_id      = @job_id,
     @step_name   = N'1 - Sincroniza usuarios',
     @subsystem   = N'TSQL',
     @command     = N'EXEC Asokam.app.sp_sincroniza_empleados_usuarios;',
     @database_name = N'Asokam',
     @retry_attempts = 1,
     @retry_interval = 10,
     @on_success_action = 1,   -- quit with success
     @on_fail_action  = 2;     -- quit with failure

/* --- 3) Horario: lunes a viernes 07:50 ------------------------------------ */
EXEC msdb.dbo.sp_add_jobschedule
     @job_id                = @job_id,
     @name                  = N'LunVie_0750',
     @enabled               = 1,
     @freq_type             = 8,      -- weekly
     @freq_interval         = 62,     -- lunes..viernes
     @freq_subday_type      = 1,      -- a hora fija
     @freq_recurrence_factor = 1,     -- cada 1 semana
     @active_start_time     = 75000;  -- 07:50:00

/* --- 4) Asignar al servidor local ------------------------------------------ */
EXEC msdb.dbo.sp_add_jobserver
     @job_id   = @job_id,
     @server_name = N'(local)';
GO

/* --- Verificación (opcional): el job y su horario --------------------------
SELECT j.name, j.enabled, s.name AS schedule_name, s.freq_type, s.freq_interval,
       s.freq_recurrence_factor, s.active_start_time
FROM msdb.dbo.sysjobs AS j
JOIN msdb.dbo.sysjobschedules AS js ON js.job_id = j.job_id
JOIN msdb.dbo.sysschedules    AS s  ON s.schedule_id = js.schedule_id
WHERE j.name = N'SP_Jobs_SincronizaEmpleadosUsuarios';
--------------------------------------------------------------------------- */
