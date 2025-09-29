-- Create tables for the Card Dispatch System

-- Messengers table
CREATE TABLE IF NOT EXISTS messengers (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  contact_number TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Dispatches table
CREATE TABLE IF NOT EXISTS dispatches (
  id UUID PRIMARY KEY,
  messenger_id UUID NOT NULL,
  messenger_name TEXT NOT NULL,
  total_cards INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  date TEXT NOT NULL,
  FOREIGN KEY (messenger_id) REFERENCES messengers(id) ON DELETE CASCADE
);

-- Dispatch items table
CREATE TABLE IF NOT EXISTS dispatch_items (
  id UUID PRIMARY KEY,
  dispatch_id UUID NOT NULL,
  card_number TEXT NOT NULL,
  client_name TEXT NOT NULL,
  FOREIGN KEY (dispatch_id) REFERENCES dispatches(id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_dispatches_date ON dispatches(date);
CREATE INDEX IF NOT EXISTS idx_dispatches_messenger_id ON dispatches(messenger_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_items_dispatch_id ON dispatch_items(dispatch_id);

-- Enable Row Level Security (RLS)
ALTER TABLE messengers ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatches ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_items ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (since this is an internal system)
CREATE POLICY "Allow all operations on messengers" ON messengers FOR ALL USING (true);
CREATE POLICY "Allow all operations on dispatches" ON dispatches FOR ALL USING (true);
CREATE POLICY "Allow all operations on dispatch_items" ON dispatch_items FOR ALL USING (true);

-- Insert sample data for testing (optional)
INSERT INTO messengers (id, name, contact_number) VALUES 
  ('550e8400-e29b-41d4-a716-446655440001', 'Carlos Rodriguez', '+58 412 123 4567'),
  ('550e8400-e29b-41d4-a716-446655440002', 'Maria Gonzalez', '+58 424 987 6543')
ON CONFLICT (id) DO NOTHING;