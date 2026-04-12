import httpx
from bs4 import BeautifulSoup

def main():
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
    with httpx.Client(headers=headers) as client:
        r = client.get("https://smart-lab.ru/q/bonds/")
        soup = BeautifulSoup(r.text, 'html.parser')
        table = soup.find('table')
        if not table:
            return
        
        for tr in table.find_all('tr')[:50]:
            print([td.text.strip() for td in tr.find_all('td')])

if __name__ == '__main__':
    main()
