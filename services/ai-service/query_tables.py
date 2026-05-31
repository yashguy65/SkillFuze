import os
from dotenv import load_dotenv
import psycopg2

# Load root-level .env
load_dotenv(dotenv_path='../../.env')

url = os.environ.get("SPRING_DATASOURCE_URL")
# Convert jdbc:postgresql:// to postgresql://
if url and url.startswith("jdbc:"):
    url = url[5:]

try:
    print(f"Connecting to database url: {url.split('@')[-1] if '@' in url else url}")
    conn = psycopg2.connect(url)
    cur = conn.cursor()
    
    # List public tables
    cur.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name;
    """)
    tables = cur.fetchall()
    print("Tables in public schema:")
    for t in tables:
        print(f" - {t[0]}")
        
    # Check messages columns if table exists
    for t in ['messages', 'chat_group_messages', 'chat_groups', 'chat_group_members']:
        try:
            cur.execute(f"SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '{t}';")
            cols = cur.fetchall()
            if cols:
                print(f"\nColumns in {t}:")
                for col in cols:
                    print(f"  * {col[0]} ({col[1]})")
            else:
                print(f"\nTable {t} does not exist.")
        except Exception as e:
            print(f"Error checking table {t}: {e}")
            
    cur.close()
    conn.close()
except Exception as e:
    print("Error:", e)
