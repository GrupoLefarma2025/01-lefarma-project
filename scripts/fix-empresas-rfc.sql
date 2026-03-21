-- Script para actualizar RFCs de empresas existentes y crear las faltantes
-- Ejecutar en la base de datos Lefarma

-- Actualizar Lefarma con RFC único
UPDATE catalogos.empresas
SET rfc = 'LEF010101ABC'
WHERE id_empresa = 8 AND nombre = 'Lefarma';

-- Insertar Construmedika con RFC único
INSERT INTO catalogos.empresas (nombre, descripcion, clave, rfc, activo, fecha_creacion)
VALUES ('Construmedika', 'Construmedika S.A. de C.V.', 'CON', 'CON020202DEF', 1, GETDATE());

-- Insertar GrupoLefarma con RFC único
INSERT INTO catalogos.empresas (nombre, descripcion, clave, rfc, activo, fecha_creacion)
VALUES ('GrupoLefarma', 'Grupo Lefarma Corporativo', 'GRP', 'GRP030303GHI', 1, GETDATE());

-- Verificar empresas
SELECT id_empresa, nombre, clave, rfc, descripcion
FROM catalogos.empresas
ORDER BY id_empresa;
