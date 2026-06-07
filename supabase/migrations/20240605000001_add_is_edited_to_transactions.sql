-- Add is_edited flag column to transactions table
ALTER TABLE transactions ADD COLUMN is_edited BOOLEAN DEFAULT FALSE;
