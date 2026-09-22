-- Cierra la tabla `contactos` a cualquiera que solo tenga la llave pública (anon).
-- Ejecutar en Supabase → SQL Editor, en el proyecto "Email Niños sin pantallas".
--
-- IMPORTANTE: antes de correr esto, agregá SUPABASE_SERVICE_ROLE_KEY en Vercel
-- y confirmá con Claude que el backend ya la está usando. Si corres esto primero,
-- el quiz y la landing dejan de poder guardar leads hasta que agregues esa variable.

-- Quita el permiso "cualquiera con la llave pública puede hacer cualquier cosa"
DROP POLICY IF EXISTS "Allow backend operations" ON contactos;

-- No se crea ninguna política nueva: con RLS activado (ya lo está) y cero políticas,
-- Supabase niega el acceso por defecto a quien entre con la llave pública (anon).
-- El backend sigue funcionando porque usa la llave de servicio, que ignora RLS.

-- Verificación 1: no debe quedar ninguna política sobre esta tabla
SELECT policyname FROM pg_policies WHERE tablename = 'contactos';

-- Verificación 2: confirma que RLS sigue activado
SELECT relrowsecurity FROM pg_class WHERE relname = 'contactos';
