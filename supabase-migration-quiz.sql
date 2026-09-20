-- Migración: campos del quiz en la tabla `contactos`
-- Ejecutar UNA vez en Supabase → SQL Editor, en el proyecto de Método Calma / Reto 21 Días.
-- Es seguro correrla más de una vez (IF NOT EXISTS) y no toca los contactos que ya existen.

ALTER TABLE contactos
  ADD COLUMN IF NOT EXISTS nombre_hijo     TEXT,   -- nombre del niño/a (lo pide el quiz)
  ADD COLUMN IF NOT EXISTS edad_hijo       TEXT,   -- rango: 2-4, 5-7, 8-10 o 11+ años
  ADD COLUMN IF NOT EXISTS resultado_quiz  TEXT,   -- L (límites), A (aburrimiento) o C (conexión)
  ADD COLUMN IF NOT EXISTS respuestas_quiz JSONB;  -- todas las respuestas, para segmentar seguimientos

-- Verificación: debe listar las 4 columnas nuevas
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'contactos'
  AND column_name IN ('nombre_hijo', 'edad_hijo', 'resultado_quiz', 'respuestas_quiz');
