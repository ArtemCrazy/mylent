import urllib.request
from datetime import datetime
import time

url = "https://ics.fixtur.es/v2/league/premier-league.ics"
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req) as resp:
        text = resp.read().decode('utf-8')
        lines = text.splitlines()
        
        matches = 0
        now = datetime.utcnow()
        for line in lines:
            if line.startswith("DTSTART"):
                val = line.split(":")[-1].replace("Z", "")
                try:
                    dt_obj = datetime.strptime(val, "%Y%m%dT%H%M%S")
                    if dt_obj.year == 2024 or dt_obj.year == 2025 or dt_obj.year == 2026:
                        delta = dt_obj - now
                        if -2 <= delta.days <= 14:
                            matches += 1
                except Exception as e:
                    pass
        print(f"Total lines: {len(lines)}. Found recent matches: {matches}")
except Exception as e:
    print("Error:", e)
