import urllib.request
urls = [
    "https://ics.fixtur.es/v2/league/premier-league.ics",
    "https://ics.fixtur.es/v2/league/russian-premier-league.ics",
    "https://ics.fixtur.es/v2/russian-premier-league.ics"
]

for url in urls:
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as resp:
            data = resp.read()
            print(f"SUCCESS: {url} - {len(data)} bytes")
            print(data[:200].decode('utf-8'))
    except Exception as e:
        print(f"ERROR: {url} - {e}")
