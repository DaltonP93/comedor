-- Defensa en profundidad: CHECK constraints para los estados (enums como String).
-- Prisma 5 no declara CHECK en el schema, por eso se aplican por SQL.
-- Ejecutar una vez contra la base (idempotente con guards):
--   psql "$DATABASE_URL" -f packages/database/sql/constraints.sql
--
-- Los estados también se validan en la capa de aplicación; estos constraints
-- son una red de seguridad a nivel de base de datos.

DO $$
BEGIN
  -- Venta.estado
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_ventas_estado') THEN
    ALTER TABLE ventas ADD CONSTRAINT chk_ventas_estado
      CHECK (estado IN ('PENDIENTE', 'COMPLETADA', 'ANULADA'));
  END IF;

  -- Libreta.estado
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_libretas_estado') THEN
    ALTER TABLE libretas ADD CONSTRAINT chk_libretas_estado
      CHECK (estado IN ('ACTIVA', 'SUSPENDIDA', 'BLOQUEADA'));
  END IF;

  -- Menu.estado
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_menus_estado') THEN
    ALTER TABLE menus ADD CONSTRAINT chk_menus_estado
      CHECK (estado IN ('BORRADOR', 'PUBLICADO', 'CERRADO', 'AGOTADO', 'CANCELADO'));
  END IF;

  -- Caja.estado
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_cajas_estado') THEN
    ALTER TABLE cajas ADD CONSTRAINT chk_cajas_estado
      CHECK (estado IN ('ABIERTA', 'CERRADA'));
  END IF;

  -- Pago.estado
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_pagos_estado') THEN
    ALTER TABLE pagos ADD CONSTRAINT chk_pagos_estado
      CHECK (estado IN ('PENDIENTE', 'CONFIRMADO', 'RECHAZADO', 'ANULADO'));
  END IF;

  -- Montos no negativos (dinero en Guaraníes)
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_ventas_total_no_negativo') THEN
    ALTER TABLE ventas ADD CONSTRAINT chk_ventas_total_no_negativo CHECK (total >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_libretas_limite_no_negativo') THEN
    ALTER TABLE libretas ADD CONSTRAINT chk_libretas_limite_no_negativo CHECK (limite_credito >= 0);
  END IF;
END $$;
