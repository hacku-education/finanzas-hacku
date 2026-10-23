-- Migration 050: Datos fiscales de clientes + vínculo con Alegra
--
-- Al crear un cliente de hackÜ SAS desde la app se crea automáticamente el
-- contacto en Alegra. Para eso se necesitan los datos fiscales que exige la
-- facturación electrónica (DIAN): identificación, tipo de persona, régimen,
-- dirección/departamento/ciudad y email (ya existen `email` y `ciudad`).
--
-- alegra_contact_id: id del contacto en Alegra una vez creado/enlazado.
-- alegra_sync_error: último error devuelto por Alegra (NULL si ok / no aplica),
--                    para mostrarlo en la UI y permitir reintentar.
--
-- Columnas aditivas y nullable: los clientes existentes no cambian.
-- Idempotente (DO $$ IF NOT EXISTS $$).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'tipo_identificacion') THEN
    ALTER TABLE public.customers ADD COLUMN tipo_identificacion text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'numero_identificacion') THEN
    ALTER TABLE public.customers ADD COLUMN numero_identificacion text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'dv') THEN
    ALTER TABLE public.customers ADD COLUMN dv text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'tipo_persona') THEN
    ALTER TABLE public.customers ADD COLUMN tipo_persona text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'regimen') THEN
    ALTER TABLE public.customers ADD COLUMN regimen text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'direccion') THEN
    ALTER TABLE public.customers ADD COLUMN direccion text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'departamento') THEN
    ALTER TABLE public.customers ADD COLUMN departamento text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'alegra_contact_id') THEN
    ALTER TABLE public.customers ADD COLUMN alegra_contact_id text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'alegra_sync_error') THEN
    ALTER TABLE public.customers ADD COLUMN alegra_sync_error text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_customers_numero_identificacion
  ON public.customers (numero_identificacion);
