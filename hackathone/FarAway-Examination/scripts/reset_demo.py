"""
FortisExam — Demo Reset Script
================================

Wipes the local SQLite database and re-runs the seed script.
"""
import os
import sys

def main():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    db_path = os.path.join(base_dir, "server", "fortis.db")
    if os.path.exists(db_path):
        print(f"🗑️ Deleting {db_path}...")
        try:
            os.remove(db_path)
            print("✅ Database deleted.")
        except Exception as e:
            print(f"⚠️ Could not delete database: {e}")
            print("Ensure the server is not running.")
            return
    else:
        print(f"ℹ️ No database found at {db_path}.")
    
    print("\n🌱 Running seed_demo.py...")
    seed_script = os.path.join(base_dir, "scripts", "seed_demo.py")
    os.system(f'{sys.executable} "{seed_script}"')

if __name__ == "__main__":
    main()
