-- ============================================================================
-- SUPABASE MIGRATION PATCH: ADD PAYMENT VERIFICATION & REPORT FIELDS
-- Run this script in your Supabase SQL Editor.
-- ============================================================================

ALTER TABLE sales_transactions 
ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS "nozzleId" TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS "shift" TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS "discount" NUMERIC DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS "vat" NUMERIC DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS "netAmount" NUMERIC DEFAULT NULL;

COMMENT ON COLUMN sales_transactions."paymentMethod" IS 'The verified payment type for this completed transaction';
COMMENT ON COLUMN sales_transactions."nozzleId" IS 'Specific dual-dispenser nozzle index';
COMMENT ON COLUMN sales_transactions."shift" IS 'Assigned cashier or terminal operational shift';
COMMENT ON COLUMN sales_transactions."discount" IS 'Applied promotion deduction value in SAR';
COMMENT ON COLUMN sales_transactions."vat" IS 'Calculated VAT tax value in SAR (15% by default in KSA)';
COMMENT ON COLUMN sales_transactions."netAmount" IS 'Calculated base sale amount excluding VAT and deductions';
