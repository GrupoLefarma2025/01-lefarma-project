-- ============================================================
-- 0012_20260904-0940_educacion-medica_create-config-ranking-v2-cobertura.lefarma.sql
-- Descripcion: Crea la version 2 de la configuracion de ranking 'General' con el
--              nuevo factor cobertura_taller (scoring-v1.1): penaliza hospitales
--              que ya recibieron un taller Realizado y prioriza la cobertura
--              pendiente (estuvo en seleccion sin taller) y los nunca seleccionados.
--              Pesos: anestesias 35, quirofanos 10, recencia 20,
--              agrupabilidad 20, cobertura_taller 15 (suma 100).
--              La version 1 queda intacta para el historico de ejecuciones
--              (config_ranking es inmutable una vez usada).
-- App: educacion-medica
-- Target (sufijo .lefarma): LefarmaDev y Lefarma (toda la familia lefarma).
-- Requiere: 0009 (config_ranking + config_ranking_factores) y 0003 (tabla
--   talleres, fuente de datos del factor: estado = 'Realizado' por id_hospital).
-- ============================================================

SET NOCOUNT ON;
GO

DECLARE @id_config INT;

IF NOT EXISTS (SELECT 1 FROM educacion_medica.config_ranking WHERE nombre = 'General' AND version = 2)
BEGIN
    -- Solo una configuracion activa (UX_config_ranking_activa): se desactiva la v1
    UPDATE educacion_medica.config_ranking
    SET activo = 0,
        fecha_modificacion = SYSUTCDATETIME()
    WHERE activo = 1;

    INSERT INTO educacion_medica.config_ranking (nombre, version, activo, fecha_vigencia_inicio, fecha_vigencia_fin,
        fecha_creacion, fecha_modificacion, id_usuario_creacion, id_usuario_modificacion)
    VALUES ('General', 2, 1, NULL, NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), NULL, NULL);

    SET @id_config = SCOPE_IDENTITY();

    INSERT INTO educacion_medica.config_ranking_factores
        (id_configuracion, clave, grupo, nombre, descripcion, peso, activo, tipo_normalizacion, parametros_json)
    VALUES
        (@id_config, 'anestesias_totales',      'Potencial',  'Total de anestesias',        'Suma anual de procedimientos de anestesia; mayor volumen indica mayor potencial de demanda.', 35.00, 1, 'percentil', '{}'),
        (@id_config, 'numero_quirofanos',        'Potencial',  'Numero de quirofanos',       'Capacidad operativa del hospital medida en numero de quirofanos disponibles.', 10.00, 1, 'percentil', '{}'),
        (@id_config, 'recencia_seleccion',       'Cobertura',  'Recencia de seleccion',      'Tiempo transcurrido desde la ultima seleccion del hospital; prioriza menor recencia para fomentar rotacion de cobertura.', 20.00, 1, 'tramos', '{"nunca":100,"reciente":10,"tramos":[{"meses_min":12,"score":90},{"meses_min":6,"score":70},{"meses_min":3,"score":40}]}'),
        (@id_config, 'agrupabilidad_geografica', 'Geografia',  'Agrupabilidad geografica',   'Proximidad a otros hospitales ya seleccionados dentro del radio configurado; premia concentracion logistica.', 20.00, 1, 'funcion', '{"radio_km": 50}'),
        (@id_config, 'cobertura_taller',         'Cobertura',  'Cobertura de taller',        'Estado de cobertura efectiva: nunca seleccionado (maximo), seleccionado con taller pendiente de impartir (alto) o con taller ya Realizado (minimo).', 15.00, 1, 'tramos', '{"nunca":100,"pendiente":90,"realizado":10}');

    PRINT 'Config General V2 (con cobertura_taller al 15% y parametros_json explicitos) insertada y activada.';
END
ELSE
BEGIN
    PRINT 'Config General V2 ya existe. Skip.';
END
GO

PRINT 'Script 0012 finalizado.';
GO
