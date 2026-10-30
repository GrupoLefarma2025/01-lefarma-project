-- ============================================================================
-- 044 — Corte de los retardos de entrada en 20 minutos
-- Base: Lefarma / LefarmaDev / LefarmaDev2
-- Fecha: 2026-10-26
-- ----------------------------------------------------------------------------
-- QUÉ CAMBIA (pedido de RH)
--   Antes:
--     id 1 -> "Retardo de entrada menor a 20 min"       minutos 1..20   (3 al mes)
--     id 2 -> "Retardo de entrada mayor o igual a 20 min" minutos 20..∞  (1 al mes)
--   Después:
--     id 1 -> "Retardo de entrada igual o menor a 20 min" minutos 1..20   (3 al mes)
--     id 2 -> "Retardo de entrada mayor a 20 min"         minutos 21..∞   (1 al mes)
--
-- POR QUÉ
--   Las dos reglas se traslapaban en el minuto 20. MinutosEnRango y el SP
--   rh.incidencias_checado_resumen comparan con >= min y <= max, así que un
--   retardo de exactamente 20 minutos disparaba AMBAS reglas y generaba dos
--   incidencias: una acumulable (1..20) y otra con descuento inmediato (20..∞).
--   Con 1..20 y 21..∞ cada retardo cae en una sola regla, sin hueco ni traslape.
--
-- ALCANCE
--   Solo datos de configuración (rh.incidencias_checado_config). No toca esquema
--   ni código: el motor lee minutos_min / minutos_max en cada cálculo, por lo que
--   el cambio aplica también a los periodos ya capturados al recalcular.
--
-- ORDEN DE EJECUCIÓN
--   Paso 0 (lectura) -> Paso 1 (UPDATEs) -> Paso 2 (verificación).
--   Idempotente: se puede volver a correr sin efecto adicional.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- PASO 0 (solo lectura): así están las reglas antes del cambio
-- ----------------------------------------------------------------------------
SELECT id_config,
       nombre,
       minutos_min,
       minutos_max,
       cantidad_acumulada,
       periodo
FROM   rh.incidencias_checado_config
WHERE  id_config IN (1, 2)
ORDER  BY id_config;
GO

-- ----------------------------------------------------------------------------
-- PASO 1: UPDATE (una sola sentencia para que sea un único cambio aprobado)
--   id 1 -> "igual o menor a 20 min", rango 1..20, 3 acumuladas al mes
--   id 2 -> "mayor a 20 min",        rango 21..∞, 1 al mes
-- ----------------------------------------------------------------------------
UPDATE rh.incidencias_checado_config
SET    nombre                   = CASE id_config WHEN 1 THEN N'Retardo de entrada igual o menor a 20 min'
                                                       ELSE N'Retardo de entrada mayor a 20 min' END,
       nombre_normalizado       = CASE id_config WHEN 1 THEN N'Retardo de entrada igual o menor a 20 min'
                                                       ELSE N'Retardo de entrada mayor a 20 min' END,
       descripcion              = CASE id_config WHEN 1 THEN N'Cada 3 retardos de entrada de 20 minutos o menos en el mes generan 1 descuento.'
                                                       ELSE N'Un retardo de entrada de más de 20 minutos en el mes genera descuento.' END,
       descripcion_normalizada  = CASE id_config WHEN 1 THEN N'Cada 3 retardos de entrada de 20 minutos o menos en el mes generan 1 descuento.'
                                                       ELSE N'Un retardo de entrada de más de 20 minutos en el mes genera descuento.' END,
       minutos_min              = CASE id_config WHEN 1 THEN 1  ELSE 21   END,
       minutos_max              = CASE id_config WHEN 1 THEN 20 ELSE NULL END,
       cantidad_acumulada       = CASE id_config WHEN 1 THEN 3  ELSE 1    END,
       periodo                  = 'mes',
       fecha_modificacion       = GETDATE()
WHERE  id_config IN (1, 2)
  AND  tipo_incidencia = 'TARDANZA_ENTRADA';
GO

-- ----------------------------------------------------------------------------
-- PASO 2: verificación (debe mostrar 1..20 y 21..NULL)
-- ----------------------------------------------------------------------------
SELECT id_config,
       nombre,
       minutos_min,
       minutos_max,
       cantidad_acumulada,
       periodo
FROM   rh.incidencias_checado_config
WHERE  id_config IN (1, 2)
ORDER  BY id_config;
GO
