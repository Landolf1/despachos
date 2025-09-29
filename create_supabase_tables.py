import psycopg2
import uuid

# Supabase database connection string
# Format: postgresql://[user[:password]@][netloc][:port][/dbname][?param1=value1&...]
DATABASE_URL = "postgresql://postgres.zptfgrmjfnadngrqeakx:dGNFsGHJLWQF93NZ@aws-0-us-east-1.pooler.supabase.com:6543/postgres"

def create_tables_and_data():
    try:
        # Connect to database
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        
        # Create tables
        sql_commands = [
            # Messengers table
            '''
            CREATE TABLE IF NOT EXISTS messengers (
              id UUID PRIMARY KEY,
              name TEXT NOT NULL,
              contact_number TEXT NOT NULL,
              created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            ''',
            
            # Dispatches table
            '''
            CREATE TABLE IF NOT EXISTS dispatches (
              id UUID PRIMARY KEY,
              messenger_id UUID NOT NULL,
              messenger_name TEXT NOT NULL,
              total_cards INTEGER NOT NULL,
              created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
              date TEXT NOT NULL,
              FOREIGN KEY (messenger_id) REFERENCES messengers(id) ON DELETE CASCADE
            );
            ''',
            
            # Dispatch items table
            '''
            CREATE TABLE IF NOT EXISTS dispatch_items (
              id UUID PRIMARY KEY,
              dispatch_id UUID NOT NULL,
              card_number TEXT NOT NULL,
              client_name TEXT NOT NULL,
              FOREIGN KEY (dispatch_id) REFERENCES dispatches(id) ON DELETE CASCADE
            );
            ''',
            
            # Create indexes
            '''
            CREATE INDEX IF NOT EXISTS idx_dispatches_date ON dispatches(date);
            ''',
            '''
            CREATE INDEX IF NOT EXISTS idx_dispatches_messenger_id ON dispatches(messenger_id);
            ''',
            '''
            CREATE INDEX IF NOT EXISTS idx_dispatch_items_dispatch_id ON dispatch_items(dispatch_id);
            ''',
            
            # Enable RLS
            '''
            ALTER TABLE messengers ENABLE ROW LEVEL SECURITY;
            ''',
            '''
            ALTER TABLE dispatches ENABLE ROW LEVEL SECURITY;
            ''',
            '''
            ALTER TABLE dispatch_items ENABLE ROW LEVEL SECURITY;
            ''',
        ]
        
        # Execute table creation
        for cmd in sql_commands:
            try:
                cur.execute(cmd)
                print(f"Executed: {cmd.strip()[:50]}...")
            except Exception as e:
                print(f"Warning executing command: {str(e)}")
        
        # Create policies
        policy_commands = [
            "DROP POLICY IF EXISTS \"Allow all operations on messengers\" ON messengers;",
            "CREATE POLICY \"Allow all operations on messengers\" ON messengers FOR ALL USING (true);",
            "DROP POLICY IF EXISTS \"Allow all operations on dispatches\" ON dispatches;", 
            "CREATE POLICY \"Allow all operations on dispatches\" ON dispatches FOR ALL USING (true);",
            "DROP POLICY IF EXISTS \"Allow all operations on dispatch_items\" ON dispatch_items;",
            "CREATE POLICY \"Allow all operations on dispatch_items\" ON dispatch_items FOR ALL USING (true);",
        ]
        
        for cmd in policy_commands:
            try:
                cur.execute(cmd)
                print(f"Policy executed: {cmd[:40]}...")
            except Exception as e:
                print(f"Warning with policy: {str(e)}")
        
        # Insert sample data
        sample_messengers = [
            ('550e8400-e29b-41d4-a716-446655440001', 'Carlos Rodriguez', '+58 412 123 4567'),
            ('550e8400-e29b-41d4-a716-446655440002', 'Maria Gonzalez', '+58 424 987 6543'),
            ('550e8400-e29b-41d4-a716-446655440003', 'Luis Perez', '+58 414 555 1234'),
        ]
        
        for messenger in sample_messengers:
            try:
                cur.execute(
                    "INSERT INTO messengers (id, name, contact_number) VALUES (%s, %s, %s) ON CONFLICT (id) DO NOTHING",
                    messenger
                )\n                print(f"Inserted sample messenger: {messenger[1]}")
            except Exception as e:
                print(f"Error inserting messenger {messenger[1]}: {str(e)}")
        
        # Commit changes
        conn.commit()
        
        # Verify data
        cur.execute("SELECT COUNT(*) FROM messengers")
        count = cur.fetchone()[0]
        print(f"\nTotal messengers in database: {count}")
        
        cur.execute("SELECT name, contact_number FROM messengers")
        messengers = cur.fetchall()
        for messenger in messengers:
            print(f"- {messenger[0]} ({messenger[1]})")
        
        cur.close()
        conn.close()
        
        print("\nDatabase setup completed successfully!")
        return True
        
    except Exception as e:
        print(f"Error setting up database: {str(e)}")
        return False

if __name__ == "__main__":
    create_tables_and_data()