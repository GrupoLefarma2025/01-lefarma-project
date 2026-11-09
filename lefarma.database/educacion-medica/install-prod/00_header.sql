/* =============================================================================
   INSTALACIÓN DE EDUCACIÓN MÉDICA EN PRODUCCIÓN (Lefarma)
   Generado: 2026-11-09
   -----------------------------------------------------------------------------
   QUÉ HACE
     Instala el módulo completo de Educación Médica en una base Lefarma que ya
     tiene la plataforma (config/app) pero NO el módulo:
       1) 0016  esquema completo (tablas, índices, FKs, checks, descripciones)
       2) reconciliación de las 4 tablas que ya existían en producción
          (hospital_extension, parametros_anestesias, programas_anuales,
          tipo_gerencia): agrega las columnas que 0016 no puede agregar porque
          la tabla ya existía.
       3) 0030  catálogos base y backfills (hospitales desde Asokam)
       4) 0035  catálogos de calendario (tipo_visita, tema_taller) y parámetros
       5) 0018  workflows de selección, rutas y matriz
       6) 0040  reparación de mappings y matrices huérfanas
       7) 0041  columnas de depuración de hospitales (mostrar_educacion_medica,
                motivo_clasificacion, requiere_revision, clasificacion_manual)
       8) 0042  clasificación de datos de hospitales
       9) 0043  verificación de la depuración (solo SELECT)

   REQUISITOS
     - Base destino: Lefarma (producción), servidor 192.168.4.2.
     - Acceso READ a Asokam para 0030 y 0042 (backfill de hospitales).
     - Ejecutar con sqlcmd (los scripts usan GO y lotes):
         sqlcmd -S 192.168.4.2 -d Lefarma -C -f 65001 -i 0001_install_educacion_medica_prod.sql
     - El visor del panel divide por ";", NO uses el panel para este archivo.

   SEGURIDAD / ROLLBACK
     - Es idempotente: guards IF NOT EXISTS / COL_LENGTH en todo el esquema.
     - No borra datos de producción: 0030 y 0042 solo insertan/actualizan
       hospital_extension y catálogos del módulo.
     - 0041 crea un respaldo: educacion_medica.hospital_extension_backup_20261107.
     - Rollback completo (solo si se decide desinstalar):
         DROP SCHEMA educacion_medica (previo respaldo); no lo ejecutes sin
         revisar dependencias de config.workflow_* creadas por 0018.

   ADVERTENCIA
     - 0018 modifica config.workflow_* (crea workflows de EDUCACION_MEDICA y
       agrega config.workflow_pasos.permite_editar). Es idempotente.
     - Revisar el resultado de 0043 antes de habilitar el módulo a usuarios.
   ============================================================================= */

SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

PRINT '=== INSTALACION EDUCACION MEDICA: inicio ===';
GO
