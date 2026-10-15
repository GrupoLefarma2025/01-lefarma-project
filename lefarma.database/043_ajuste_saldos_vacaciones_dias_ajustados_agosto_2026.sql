-- ============================================================================
-- 043 — dias_ajustados = SALDO del Excel "Vacaciones México agosto 2026"
-- Un UPDATE por usuario (id_usuario resuelto por correo en Asokam; 184 usuarios).
-- Se agrega AND anio/activo para no tocar saldos de otros años.
-- NOTA: dias_ajustados queda = SALDO directo; pendientes resultará =
-- generados + compensados + SALDO - vencidos - tomados.
-- Casos excluidos al final como comentarios (ambiguos, sin usuario, sin correo).
-- ORDEN: correr Paso 0 (lectura), luego los UPDATE, luego Paso 2.
-- ============================================================================

DECLARE @Anio INT = 2026;

-- ----------------------------------------------------------------------------
-- PASO 0 (solo lectura): ids del Excel SIN fila activa en el año (esos UPDATE
-- no harán nada; hay que crearles el saldo con cargar/sincronizar primero)
-- ----------------------------------------------------------------------------
SELECT v.id_usuario AS sin_fila_en_anio
FROM (VALUES 75, 32, 77, 68, 78, 79, 80, 82, 29, 83, 74, 85, 86, 87, 88, 89, 33, 23, 91, 92, 24, 28, 93, 94, 95, 96, 130, 97, 25, 98, 22, 27, 38, 99, 135, 136, 137, 138, 139, 100, 55, 46, 45, 102, 103, 140, 141, 142, 143, 144, 145, 146, 147, 104, 148, 149, 150, 151, 152, 105, 153, 131, 154, 155, 30, 156, 106, 157, 158, 159, 161, 162, 163, 70, 107, 108, 48, 109, 110, 111, 164, 51, 112, 113, 114, 115, 116, 44, 117, 165, 118, 47, 166, 167, 119, 168, 132, 169, 170, 171, 172, 120, 173, 121, 122, 36, 123, 124, 174, 175, 176, 125, 126, 177, 178, 179, 180, 181, 133, 182, 183, 184, 185, 186, 187, 188, 190, 191, 193, 194, 195, 34, 63, 56, 54, 73, 127, 53, 197, 198, 199, 200, 201, 202, 203, 204, 205, 128, 207, 206, 208, 209, 211, 212, 213, 214, 215, 216, 210, 129, 43, 21, 62, 71, 40, 64, 217, 218, 219, 220, 221, 222, 223, 224, 225, 226, 227, 72, 230, 231, 234, 235, 57, 236) AS v(id_usuario)
LEFT JOIN rh.saldos_vacaciones_anuales AS s
    ON s.id_usuario = v.id_usuario AND s.anio = @Anio AND s.activo = 1
WHERE s.id_saldo IS NULL;

-- ----------------------------------------------------------------------------
-- PASO 1: UPDATEs (correr solo después de revisar el Paso 0)
-- ----------------------------------------------------------------------------
-- BEGIN TRANSACTION;
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 3,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 75 AND anio = 2026 AND activo = 1; -- Juan Carlos Alonso Hernandez
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 49,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 32 AND anio = 2026 AND activo = 1; -- 11 Gina Reyes Rosales
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = -9,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 77 AND anio = 2026 AND activo = 1; -- Ireri Bernal Francisco
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 27,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 68 AND anio = 2026 AND activo = 1; -- Fernando Morales Alegre
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 6,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 78 AND anio = 2026 AND activo = 1; -- Joshua Anuar Jaimes Aguirre
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 1,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 79 AND anio = 2026 AND activo = 1; -- Berenice Jimenez Gil
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 2,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 80 AND anio = 2026 AND activo = 1; -- Gerardo Moisen Bravo
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = -4,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 82 AND anio = 2026 AND activo = 1; -- Jose Ricardo Huerta Garcia
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 52,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 29 AND anio = 2026 AND activo = 1; -- Roberto Torija Nieto
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = -1,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 83 AND anio = 2026 AND activo = 1; -- Cesar Martin Garcia Alonso
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 4,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 74 AND anio = 2026 AND activo = 1; -- Victor Manuel Gonzalez Betanzos
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 3,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 85 AND anio = 2026 AND activo = 1; -- Alberto Israel Aguilar Soto
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 20,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 86 AND anio = 2026 AND activo = 1; -- Alma Yelli Yañez Moreno
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 1,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 87 AND anio = 2026 AND activo = 1; -- Alfredo Alejandro Agiss Velazquez
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 0,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 88 AND anio = 2026 AND activo = 1; -- Maria del Carmen Hernandez Gonzalez
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = -9,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 89 AND anio = 2026 AND activo = 1; -- Alexander Pozos Asencio
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 4,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 33 AND anio = 2026 AND activo = 1; -- Daniel Michell Padilla Ramos
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 14,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 23 AND anio = 2026 AND activo = 1; -- Luis Antonio Pozo Urquizo
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 19,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 91 AND anio = 2026 AND activo = 1; -- Francisco Jairzinhio Zamora Nuñez
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 0,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 92 AND anio = 2026 AND activo = 1; -- Jose Luis Miranda Sosa
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = -13,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 24 AND anio = 2026 AND activo = 1; -- Lesly Isamar Zendejas Araiza
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 6,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 28 AND anio = 2026 AND activo = 1; -- Yanet Cazares Gonzalez
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = -11,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 93 AND anio = 2026 AND activo = 1; -- Juan Pablo Peña Portillo
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = -8,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 94 AND anio = 2026 AND activo = 1; -- Hilda Hernandez Canales
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = -2,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 95 AND anio = 2026 AND activo = 1; -- Jorge Adrian Soto Evaristo
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = -3,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 96 AND anio = 2026 AND activo = 1; -- Victor Manuel Flores Sanchez
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 0,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 130 AND anio = 2026 AND activo = 1; -- Roberto Cruz Guerrero
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 8,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 97 AND anio = 2026 AND activo = 1; -- Carlos Alberto Rodriguez Santana
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 1,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 25 AND anio = 2026 AND activo = 1; -- Adriana Arredondo Ortiz
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 2,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 98 AND anio = 2026 AND activo = 1; -- Emmanuel Lopez Perez
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = -2,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 22 AND anio = 2026 AND activo = 1; -- Jorge Mauricio Diaz Saavedra
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 2,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 27 AND anio = 2026 AND activo = 1; -- Maximiliano Mascorro Alpide
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 8,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 38 AND anio = 2026 AND activo = 1; -- Obed Arana Fragoso
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = -9,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 99 AND anio = 2026 AND activo = 1; -- Santiago Garcia Gutierrez
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 14,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 135 AND anio = 2026 AND activo = 1; -- Olga Rojas Guerra
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 0,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 136 AND anio = 2026 AND activo = 1; -- Jose De Jesus Ballesteros Zamora
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = -7,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 137 AND anio = 2026 AND activo = 1; -- German Eduardo Bautista Martinez
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = -2,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 138 AND anio = 2026 AND activo = 1; -- Blanca Rosa Lopez Perez
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = -1,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 139 AND anio = 2026 AND activo = 1; -- Adrian Hidalgo Ayanegui
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 10,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 100 AND anio = 2026 AND activo = 1; -- Erick Tranquilino Martinez
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 12,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 55 AND anio = 2026 AND activo = 1; -- Sandra Luz Delgado Trujillo
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 89,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 46 AND anio = 2026 AND activo = 1; -- Juan Alejandro Lopez Lopez
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 0,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 45 AND anio = 2026 AND activo = 1; -- Hansel Oliver Rojas Figueroa
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 1,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 102 AND anio = 2026 AND activo = 1; -- Juan Diego Agueda Altuzar
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 12,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 103 AND anio = 2026 AND activo = 1; -- Juan Carlos Velazquez Narvaez
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 0,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 140 AND anio = 2026 AND activo = 1; -- Alexis Raul Carmona Mendoza
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 136,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 141 AND anio = 2026 AND activo = 1; -- Ediberto Rojas Galindo
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 134,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 142 AND anio = 2026 AND activo = 1; -- Francisco Javier Mendez Rojas
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 42,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 143 AND anio = 2026 AND activo = 1; -- Jose Bernardo Villalpando Marin
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 10,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 144 AND anio = 2026 AND activo = 1; -- Jose Eloy Flores Climaco
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 27,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 145 AND anio = 2026 AND activo = 1; -- Edgar Romero Hernandez
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 0,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 146 AND anio = 2026 AND activo = 1; -- Monica Guadalupe Diaz Martinez
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = -3,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 147 AND anio = 2026 AND activo = 1; -- Mariela Lopez Perez
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 3,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 104 AND anio = 2026 AND activo = 1; -- Erika Berenice Lama Delgadillo
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 53,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 148 AND anio = 2026 AND activo = 1; -- Ludwin Samuel Perez Valdez
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = -3,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 149 AND anio = 2026 AND activo = 1; -- Ana Joselyne Garcia Garcia
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 0,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 150 AND anio = 2026 AND activo = 1; -- Jessica Nallely Gonzalez Flores
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 0,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 151 AND anio = 2026 AND activo = 1; -- Marcos Nahu Ibarra Esquivel
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 54,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 152 AND anio = 2026 AND activo = 1; -- Cruz Francisco Hernandez Hernandez
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 1,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 105 AND anio = 2026 AND activo = 1; -- Marina Varela Araujo
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 0,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 153 AND anio = 2026 AND activo = 1; -- Alfonso Israel Hernandez Cruz
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = -9,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 131 AND anio = 2026 AND activo = 1; -- Areli Delgado Reyes
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 28,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 154 AND anio = 2026 AND activo = 1; -- Moises Morales Mandujano
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = -9,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 155 AND anio = 2026 AND activo = 1; -- Carolina Yvette Lima Molina
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 9,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 30 AND anio = 2026 AND activo = 1; -- Dayami Dunia Parra Parra
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 47,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 156 AND anio = 2026 AND activo = 1; -- Jacqueline Gonzalez Vega
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = -2,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 106 AND anio = 2026 AND activo = 1; -- Andres Eduardo Perez Sanchez
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 14,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 157 AND anio = 2026 AND activo = 1; -- Edith Magaly Rodriguez Boza
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 0,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 158 AND anio = 2026 AND activo = 1; -- Daniela Peñaloza Vargas
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 38,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 159 AND anio = 2026 AND activo = 1; -- Claudia Arzate Ramirez
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = -12,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 161 AND anio = 2026 AND activo = 1; -- Eunice Altagracia Ramirez Beristain
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 2,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 162 AND anio = 2026 AND activo = 1; -- Gloria Matias Alvarez
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 10,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 163 AND anio = 2026 AND activo = 1; -- Patricia Ramirez Ramirez
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 28,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 70 AND anio = 2026 AND activo = 1; -- 21 Benjamin Beltran Sanchez
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 27,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 107 AND anio = 2026 AND activo = 1; -- Gerardo Cruz Briseño
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 4,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 108 AND anio = 2026 AND activo = 1; -- Giselle Liberato Diaz Olivia
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = -5,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 48 AND anio = 2026 AND activo = 1; -- Adan Chavarria Flores
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 40,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 109 AND anio = 2026 AND activo = 1; -- Daniel Wilfrido Velazquez Villegas
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 13,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 110 AND anio = 2026 AND activo = 1; -- Eleazar Perez Esparza
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = -4,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 111 AND anio = 2026 AND activo = 1; -- Gabriela Chavez Cervantes
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 0,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 164 AND anio = 2026 AND activo = 1; -- Ali Clay Jurado Castro
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = -10,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 51 AND anio = 2026 AND activo = 1; -- Alfredo Corona Cruz
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 23,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 112 AND anio = 2026 AND activo = 1; -- Cinthia Castorena Angeles
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 1,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 113 AND anio = 2026 AND activo = 1; -- Alejandro Gomez Esquivel
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 1,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 114 AND anio = 2026 AND activo = 1; -- Paulina Duperou Luna
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = -3,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 115 AND anio = 2026 AND activo = 1; -- Royker Jose Estrada Sanchez
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 0,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 116 AND anio = 2026 AND activo = 1; -- Ana Alejandra Albarran Cruz
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 109,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 44 AND anio = 2026 AND activo = 1; -- Angelica Santillan Baez
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 63,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 117 AND anio = 2026 AND activo = 1; -- Octavio Atilano Vazquez Mellado
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 129,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 165 AND anio = 2026 AND activo = 1; -- Ricardo Francisco Carmona Garcia
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 30,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 118 AND anio = 2026 AND activo = 1; -- Carlos Enrique Aguilar Aguilar
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 19,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 47 AND anio = 2026 AND activo = 1; -- Daniel Alejandro Angeles Maqueda
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 10,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 166 AND anio = 2026 AND activo = 1; -- Gisela Bonilla Lopez
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 8,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 167 AND anio = 2026 AND activo = 1; -- Susana Hipolito Osorio
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 136,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 119 AND anio = 2026 AND activo = 1; -- Miguel Alberto Del Valle Rudiño
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 21,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 168 AND anio = 2026 AND activo = 1; -- Daniela Corona Justo
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 40,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 132 AND anio = 2026 AND activo = 1; -- Alexander Fernandez Portelles
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 0,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 169 AND anio = 2026 AND activo = 1; -- Brandon Gutierrez Segundo
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = -3,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 170 AND anio = 2026 AND activo = 1; -- Evan Migdalia Perozo Pineda
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 10,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 171 AND anio = 2026 AND activo = 1; -- Fernando Jose De La Cruz
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 32,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 172 AND anio = 2026 AND activo = 1; -- Pedro Ernesto Martinez Fortunato
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 23,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 120 AND anio = 2026 AND activo = 1; -- Jonathan Jimenez Jimenez
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 37,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 173 AND anio = 2026 AND activo = 1; -- Manuel Reyes Chavez
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 36,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 121 AND anio = 2026 AND activo = 1; -- Felipe David Ramirez Velasco
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = -9,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 122 AND anio = 2026 AND activo = 1; -- Erika Gabriela Martinez Vazquez
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 49,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 36 AND anio = 2026 AND activo = 1; -- 33 Erik Santana Alcantara
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 8,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 123 AND anio = 2026 AND activo = 1; -- Hector Adrian Mendez Saldaña
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = -3,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 124 AND anio = 2026 AND activo = 1; -- Maria Isabel Ramirez Cruz
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 0,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 174 AND anio = 2026 AND activo = 1; -- Javier Vazquez Martinez
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 5,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 175 AND anio = 2026 AND activo = 1; -- Rocio Anaya Partida
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 31,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 176 AND anio = 2026 AND activo = 1; -- Hugo Alejandro Gutierrez Vega
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 13,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 125 AND anio = 2026 AND activo = 1; -- Aurora Rodriguez Villaseñor
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 6,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 126 AND anio = 2026 AND activo = 1; -- Violeta Chavez Arzate
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 7,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 177 AND anio = 2026 AND activo = 1; -- Jose Isabel Pedroza Quevedo
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 8,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 178 AND anio = 2026 AND activo = 1; -- Viridiana Godoy Ramirez
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 0,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 179 AND anio = 2026 AND activo = 1; -- Juan Antonio Jimenez Romero
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 7,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 180 AND anio = 2026 AND activo = 1; -- Dulce Guadalupe Ruiz Garcia
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = -9,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 181 AND anio = 2026 AND activo = 1; -- Alondra Lizbeth Escalante Rodriguez
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 4,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 133 AND anio = 2026 AND activo = 1; -- Oscar Jesus Zarco Dominguez
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = -11,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 182 AND anio = 2026 AND activo = 1; -- Ricardo Colin Perez
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = -4,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 183 AND anio = 2026 AND activo = 1; -- Irving Israel Quiroga Espinoza
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 1,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 184 AND anio = 2026 AND activo = 1; -- Luis Eduardo Delgado Rangel
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 4,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 185 AND anio = 2026 AND activo = 1; -- Dulce Carolina Torres Perez
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = -3,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 186 AND anio = 2026 AND activo = 1; -- Ana Laura Fonticoba Foyo
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = -3,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 187 AND anio = 2026 AND activo = 1; -- Fabiola Rocio Campos Hernandez
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 3,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 188 AND anio = 2026 AND activo = 1; -- Cira Cibeles Calzadilla Columbie
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 40,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 190 AND anio = 2026 AND activo = 1; -- Oscar Horacio Macias Diaz
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 46,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 191 AND anio = 2026 AND activo = 1; -- Ma Lucia Alvarez Guevara
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 0,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 193 AND anio = 2026 AND activo = 1; -- Denisse Areidy Zamora Salas
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 5,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 194 AND anio = 2026 AND activo = 1; -- Maria De Lourdes Hernandez Perez
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 0,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 195 AND anio = 2026 AND activo = 1; -- Erika Yazmin Cruz Naranjo
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 13,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 34 AND anio = 2026 AND activo = 1; -- Daniel Gasca Hinojosa
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = -10,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 63 AND anio = 2026 AND activo = 1; -- Diego Angel Villaseñor Garduño
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 11,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 56 AND anio = 2026 AND activo = 1; -- Erick Israel Aguilera Diaz
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 6,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 54 AND anio = 2026 AND activo = 1; -- Adriana Gutierrez Espinosa
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = -10,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 73 AND anio = 2026 AND activo = 1; -- Marco Polo Narvaez Oropeza
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = -2,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 127 AND anio = 2026 AND activo = 1; -- Pedro Mauricio Rodriguez Garcia
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 46,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 53 AND anio = 2026 AND activo = 1; -- Heriberto Flores Torres
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 5,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 197 AND anio = 2026 AND activo = 1; -- Catalina Mares Garcia
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = -3,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 198 AND anio = 2026 AND activo = 1; -- Justo Enrique Mendez Rodriguez
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 57,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 199 AND anio = 2026 AND activo = 1; -- Maria Guadalupe Sanchez Hernandez
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 3,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 200 AND anio = 2026 AND activo = 1; -- Manuel Eduardo Robles Romero
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 0,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 201 AND anio = 2026 AND activo = 1; -- Ilse Wendy Carreon Ciriaco
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 4,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 202 AND anio = 2026 AND activo = 1; -- Karen Munguia Aguilar
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 6,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 203 AND anio = 2026 AND activo = 1; -- Alejandra Moreno Miranda
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 27,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 204 AND anio = 2026 AND activo = 1; -- Daria Elena Ramirez Ramirez
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = -9,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 205 AND anio = 2026 AND activo = 1; -- Esmeralda Velazquez Esquipula
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = -5,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 128 AND anio = 2026 AND activo = 1; -- Leticia Reyes Aragon
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = -11,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 207 AND anio = 2026 AND activo = 1; -- Luis Eduardo Villegas Martinez
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 0,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 206 AND anio = 2026 AND activo = 1; -- Gerardo Artemio Hernandez Chamaro
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 0,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 208 AND anio = 2026 AND activo = 1; -- Angelica Rivas Ladinos
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = -11,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 209 AND anio = 2026 AND activo = 1; -- Marilyn Vanessa Hernandez Sanchez
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = -3,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 211 AND anio = 2026 AND activo = 1; -- Karla Morales Pineda
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 1,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 212 AND anio = 2026 AND activo = 1; -- Margarito Sanchez Hernandez
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 17,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 213 AND anio = 2026 AND activo = 1; -- Yanet Hernandez Aguilar
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 7,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 214 AND anio = 2026 AND activo = 1; -- Eva Bello Lopez
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 10,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 215 AND anio = 2026 AND activo = 1; -- Juana Espino Martinez
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = -10,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 216 AND anio = 2026 AND activo = 1; -- Iliana Isabel Paredes Flores
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 71,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 210 AND anio = 2026 AND activo = 1; -- Benjamin Ramirez Castillo
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = -2,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 129 AND anio = 2026 AND activo = 1; -- Berenice Maldonado Esquivel
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 14,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 43 AND anio = 2026 AND activo = 1; -- Oscar Emir Cruz Illescas
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 8,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 21 AND anio = 2026 AND activo = 1; -- 54 Carlos Guzmán TI
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 139,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 62 AND anio = 2026 AND activo = 1; -- Maria De Los Angeles Hernandez Rosales
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 3,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 71 AND anio = 2026 AND activo = 1; -- Brandom Rafael Ledezma Muñoz
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 26,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 40 AND anio = 2026 AND activo = 1; -- 7 Noe Cortes
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 36,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 64 AND anio = 2026 AND activo = 1; -- Eduardo Marquez Montaño
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = -2,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 217 AND anio = 2026 AND activo = 1; -- Brisa Granados Angeles
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = -1,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 218 AND anio = 2026 AND activo = 1; -- Mariana Beltran Vargas
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = -12,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 219 AND anio = 2026 AND activo = 1; -- Saudi Elizabeth Gomez Garcia
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = -12,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 220 AND anio = 2026 AND activo = 1; -- Maria Imelda Ortiz Arellano
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 17,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 221 AND anio = 2026 AND activo = 1; -- Jessica Arely Flores Escogido
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = -3,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 222 AND anio = 2026 AND activo = 1; -- Angel Abisai Aguilar Castellanos
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 22,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 223 AND anio = 2026 AND activo = 1; -- Eileen Sarai Martinez Aldaran
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = -6,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 224 AND anio = 2026 AND activo = 1; -- Sarai Rivas Najera
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = -3,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 225 AND anio = 2026 AND activo = 1; -- Marisol Rangel Hernandez
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = -5,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 226 AND anio = 2026 AND activo = 1; -- Ana Yareddy Tello Lopez
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 2,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 227 AND anio = 2026 AND activo = 1; -- Martha Alejandra Guerrero Velazquez
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 31,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 72 AND anio = 2026 AND activo = 1; -- Marcial Fidel De La Concha Romero
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 2,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 230 AND anio = 2026 AND activo = 1; -- Yesenia Arteaga Islas
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 16,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 231 AND anio = 2026 AND activo = 1; -- Gabriel Gutierrez Flores
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 39,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 234 AND anio = 2026 AND activo = 1; -- Hugo Enrique Mejia Sanchez
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 0,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 235 AND anio = 2026 AND activo = 1; -- Elizabeth Martiñon Arriaga
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 65,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 57 AND anio = 2026 AND activo = 1; -- Jesus Enrique Friol Gonzalez
UPDATE rh.saldos_vacaciones_anuales
SET dias_ajustados = 0,
    fecha_modificacion = GETDATE()
WHERE id_usuario = 236 AND anio = 2026 AND activo = 1; -- Dante David Tellez Saucedo
-- COMMIT TRANSACTION;  -- descomentar el BEGIN/COMMIT para aplicar atómico
-- ROLLBACK TRANSACTION;

-- ----------------------------------------------------------------------------
-- PASO 2 (solo lectura): verificación — debe regresar 0 filas
-- ----------------------------------------------------------------------------
SELECT s.id_usuario, s.dias_ajustados, v.esperado
FROM (VALUES
    (75, 3),
    (32, 49),
    (77, -9),
    (68, 27),
    (78, 6),
    (79, 1),
    (80, 2),
    (82, -4),
    (29, 52),
    (83, -1),
    (74, 4),
    (85, 3),
    (86, 20),
    (87, 1),
    (88, 0),
    (89, -9),
    (33, 4),
    (23, 14),
    (91, 19),
    (92, 0),
    (24, -13),
    (28, 6),
    (93, -11),
    (94, -8),
    (95, -2),
    (96, -3),
    (130, 0),
    (97, 8),
    (25, 1),
    (98, 2),
    (22, -2),
    (27, 2),
    (38, 8),
    (99, -9),
    (135, 14),
    (136, 0),
    (137, -7),
    (138, -2),
    (139, -1),
    (100, 10),
    (55, 12),
    (46, 89),
    (45, 0),
    (102, 1),
    (103, 12),
    (140, 0),
    (141, 136),
    (142, 134),
    (143, 42),
    (144, 10),
    (145, 27),
    (146, 0),
    (147, -3),
    (104, 3),
    (148, 53),
    (149, -3),
    (150, 0),
    (151, 0),
    (152, 54),
    (105, 1),
    (153, 0),
    (131, -9),
    (154, 28),
    (155, -9),
    (30, 9),
    (156, 47),
    (106, -2),
    (157, 14),
    (158, 0),
    (159, 38),
    (161, -12),
    (162, 2),
    (163, 10),
    (70, 28),
    (107, 27),
    (108, 4),
    (48, -5),
    (109, 40),
    (110, 13),
    (111, -4),
    (164, 0),
    (51, -10),
    (112, 23),
    (113, 1),
    (114, 1),
    (115, -3),
    (116, 0),
    (44, 109),
    (117, 63),
    (165, 129),
    (118, 30),
    (47, 19),
    (166, 10),
    (167, 8),
    (119, 136),
    (168, 21),
    (132, 40),
    (169, 0),
    (170, -3),
    (171, 10),
    (172, 32),
    (120, 23),
    (173, 37),
    (121, 36),
    (122, -9),
    (36, 49),
    (123, 8),
    (124, -3),
    (174, 0),
    (175, 5),
    (176, 31),
    (125, 13),
    (126, 6),
    (177, 7),
    (178, 8),
    (179, 0),
    (180, 7),
    (181, -9),
    (133, 4),
    (182, -11),
    (183, -4),
    (184, 1),
    (185, 4),
    (186, -3),
    (187, -3),
    (188, 3),
    (190, 40),
    (191, 46),
    (193, 0),
    (194, 5),
    (195, 0),
    (34, 13),
    (63, -10),
    (56, 11),
    (54, 6),
    (73, -10),
    (127, -2),
    (53, 46),
    (197, 5),
    (198, -3),
    (199, 57),
    (200, 3),
    (201, 0),
    (202, 4),
    (203, 6),
    (204, 27),
    (205, -9),
    (128, -5),
    (207, -11),
    (206, 0),
    (208, 0),
    (209, -11),
    (211, -3),
    (212, 1),
    (213, 17),
    (214, 7),
    (215, 10),
    (216, -10),
    (210, 71),
    (129, -2),
    (43, 14),
    (21, 8),
    (62, 139),
    (71, 3),
    (40, 26),
    (64, 36),
    (217, -2),
    (218, -1),
    (219, -12),
    (220, -12),
    (221, 17),
    (222, -3),
    (223, 22),
    (224, -6),
    (225, -3),
    (226, -5),
    (227, 2),
    (72, 31),
    (230, 2),
    (231, 16),
    (234, 39),
    (235, 0),
    (57, 65),
    (236, 0)
) AS v(id_usuario, esperado)
JOIN rh.saldos_vacaciones_anuales AS s
    ON s.id_usuario = v.id_usuario AND s.anio = @Anio AND s.activo = 1
WHERE s.dias_ajustados <> v.esperado;

-- ----------------------------------------------------------------------------
-- EXCLUIDOS (resolver manual)
-- ----------------------------------------------------------------------------
-- CORREO AMBIGUO (1cm2@construmedika.com, saldo 188): IdUsuario 101, 237 (Oswaldo Rojas Galindo; Oswaldo Rojas Galindo). Resolver manual.
-- SIN CORREO (BRAVO QUIJANO MARIO GONZALO, saldo 0): empatar manual por nombre/nómina.
-- SIN CORREO (GIRON MORALES ALEJANDRO, saldo 0): empatar manual por nombre/nómina.
-- SIN CORREO (HERNANDEZ BRAVO RACIEL, saldo 0): empatar manual por nombre/nómina.
-- SIN CORREO (HERNANDEZ MELEZA ELIZABETH, saldo 0): empatar manual por nombre/nómina.
-- SIN CORREO (LUCIO CISNEROS ANGEL ALBERTO, saldo 0): empatar manual por nombre/nómina.
-- SIN CORREO (LUNA MONDRAGON ALDO JESUS, saldo -2): empatar manual por nombre/nómina.
-- SIN CORREO (MENDOZA SANCHEZ YETLANEZI, saldo 0): empatar manual por nombre/nómina.
-- SIN CORREO (MONTERREY RAMOS ELIZABETH ESTEFANI, saldo 0): empatar manual por nombre/nómina.
-- SIN CORREO (PEREZ VARGAS OSCAR, saldo 0): empatar manual por nombre/nómina.
-- SIN CORREO (RODRIGUEZ MUÑOZ KAREN sinahi, saldo 11): empatar manual por nombre/nómina.
-- SIN CORREO (SALAZAR GUZMAN MANUEL OCTAVIO, saldo 5): empatar manual por nombre/nómina.
-- SIN CORREO (SANCHEZ REYES ANAHI, saldo 0): empatar manual por nombre/nómina.
-- SIN CORREO (SILVA REAL MONICA, saldo 0): empatar manual por nombre/nómina.
-- SIN CORREO (VARGAS ARTEAGA JABNIA ZARET, saldo -9): empatar manual por nombre/nómina.
-- SIN CORREO (ZAMORA LOERA JUAN MANUEL, saldo 2): empatar manual por nombre/nómina.
