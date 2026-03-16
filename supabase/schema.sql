-- Silber Gestión — Esquema Supabase para persistencia en producción
-- Ejecutar en el SQL Editor del proyecto Supabase si las tablas no existen.

-- activity_log (registro de actividad con integridad)
CREATE TABLE IF NOT EXISTS activity_log (
  id BIGSERIAL PRIMARY KEY,
  timestamp TEXT,
  "user" TEXT,
  role TEXT,
  action TEXT,
  details TEXT,
  hash TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- cash_closings (cierres de caja)
CREATE TABLE IF NOT EXISTS cash_closings (
  id BIGSERIAL PRIMARY KEY,
  date TEXT,
  total_income NUMERIC,
  total_expenses NUMERIC,
  expected_cash NUMERIC,
  actual_cash NUMERIC,
  actual_card NUMERIC,
  difference NUMERIC,
  closed_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- daily_activity_summary (resumen diario)
CREATE TABLE IF NOT EXISTS daily_activity_summary (
  id BIGSERIAL PRIMARY KEY,
  date TEXT UNIQUE,
  total_transactions INTEGER,
  deleted_count INTEGER,
  edited_count INTEGER,
  suspicious_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- worker_locations (ubicación de trabajadores)
CREATE TABLE IF NOT EXISTS worker_locations (
  id BIGSERIAL PRIMARY KEY,
  "user" TEXT,
  role TEXT,
  lat NUMERIC,
  lng NUMERIC,
  timestamp TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- clients (sincronización de clientes; opcional)
CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  nombre TEXT,
  whatsapp TEXT,
  limite NUMERIC,
  dia_pago INTEGER,
  producto TEXT,
  deuda NUMERIC DEFAULT 0,
  lat NUMERIC,
  lng NUMERIC,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- transacciones (sincronización con app)
CREATE TABLE IF NOT EXISTS transacciones (
  id BIGSERIAL PRIMARY KEY,
  tipo TEXT,
  categoria TEXT,
  monto NUMERIC,
  cuenta TEXT,
  gramos NUMERIC,
  nota TEXT,
  registrado_por TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- productos (sincronización con app)
CREATE TABLE IF NOT EXISTS productos (
  id BIGINT PRIMARY KEY,
  nombre TEXT,
  precio_por_gramo NUMERIC,
  stock_gramos NUMERIC,
  stock_minimo NUMERIC,
  activo BOOLEAN DEFAULT true,
  created_at TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- stock_movements (movimientos de stock)
CREATE TABLE IF NOT EXISTS stock_movements (
  id BIGSERIAL PRIMARY KEY,
  producto TEXT,
  tipo TEXT,
  cantidad_gramos NUMERIC,
  usuario TEXT,
  timestamp TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS y políticas básicas (ajustar según necesidad)
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_closings ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_activity_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE transacciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for anon" ON activity_log FOR ALL USING (true);
CREATE POLICY "Allow all for anon" ON cash_closings FOR ALL USING (true);
CREATE POLICY "Allow all for anon" ON daily_activity_summary FOR ALL USING (true);
CREATE POLICY "Allow all for anon" ON worker_locations FOR ALL USING (true);
CREATE POLICY "Allow all for anon" ON clients FOR ALL USING (true);
CREATE POLICY "Allow all for anon" ON transacciones FOR ALL USING (true);
CREATE POLICY "Allow all for anon" ON productos FOR ALL USING (true);
CREATE POLICY "Allow all for anon" ON stock_movements FOR ALL USING (true);
