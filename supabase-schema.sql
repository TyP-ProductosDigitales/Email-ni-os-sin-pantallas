-- Crear tabla de contactos para email marketing
CREATE TABLE contactos (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  email TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  enviada_guia BOOLEAN DEFAULT FALSE,
  enviada_seguimiento_1 BOOLEAN DEFAULT FALSE,
  enviada_seguimiento_2 BOOLEAN DEFAULT FALSE,
  fuente TEXT DEFAULT 'landing' -- De dónde vino (landing, Meta, etc)
);

-- Índices para optimizar búsquedas
CREATE INDEX idx_contactos_email ON contactos(email);
CREATE INDEX idx_contactos_enviada_guia ON contactos(enviada_guia);
CREATE INDEX idx_contactos_created_at ON contactos(created_at);

-- Política de seguridad RLS (Row Level Security) - Permitir solo lecturas/escrituras del backend
ALTER TABLE contactos ENABLE ROW LEVEL SECURITY;

-- Política permisiva para el backend (Vercel)
CREATE POLICY "Allow backend operations" ON contactos
  FOR ALL
  USING (true)
  WITH CHECK (true);
