import os
from supabase import create_client, Client

_supabase_client: Client | None = None

def get_supabase() -> Client:
    global _supabase_client
    if _supabase_client is None:
        url = os.environ.get("SUPABASE_URL")
        key = os.environ.get("SUPABASE_KEY")
        try:
            _supabase_client = create_client(url, key)
        except Exception as e:
            raise ValueError(f"Failed to initialize Supabase client: {str(e)}. Make sure your SUPABASE_KEY is a valid JWT starting with 'eyJ'.")
    return _supabase_client
