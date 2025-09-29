import os
from supabase import create_client

# Supabase configuration
SUPABASE_URL = "https://zptfgrmjfnadngrqeakx.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpwdGZncm1qZm5hZG5ncnFlYWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkxNjg3NDYsImV4cCI6MjA3NDc0NDc0Nn0.wpB93p-_MR7pCAwFVUbeCt8a0uyZmdrBwwvjr8YTP5Q"

# Initialize Supabase client
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def setup_database():
    try:
        # Insert sample messengers if not exists
        sample_messengers = [
            {
                "id": "550e8400-e29b-41d4-a716-446655440001",
                "name": "Carlos Rodriguez",
                "contact_number": "+58 412 123 4567"
            },
            {
                "id": "550e8400-e29b-41d4-a716-446655440002", 
                "name": "Maria Gonzalez",
                "contact_number": "+58 424 987 6543"
            }
        ]
        
        for messenger in sample_messengers:
            # Check if messenger exists
            existing = supabase.table('messengers').select('id').eq('id', messenger['id']).execute()
            
            if not existing.data:
                # Insert messenger
                result = supabase.table('messengers').insert(messenger).execute()
                print(f"Inserted messenger: {messenger['name']}")
            else:
                print(f"Messenger already exists: {messenger['name']}")
        
        # Test connection and list messengers
        messengers = supabase.table('messengers').select('*').execute()
        print(f"Total messengers in database: {len(messengers.data)}")
        
        for messenger in messengers.data:
            print(f"- {messenger['name']} ({messenger['contact_number']})")
            
        return True
        
    except Exception as e:
        print(f"Error setting up database: {str(e)}")
        return False

if __name__ == "__main__":
    setup_database()