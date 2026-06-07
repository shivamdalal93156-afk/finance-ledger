-- Create salary_payments table
CREATE TABLE salary_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  month INT NOT NULL,
  year INT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  paid_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(staff_id, month, year)
);

ALTER TABLE salary_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own salary payments" ON salary_payments FOR ALL USING (auth.uid() = user_id);
