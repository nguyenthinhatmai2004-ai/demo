import httpx
from bs4 import BeautifulSoup
import asyncio

async def debug_search_v3(ticker="FPT"):
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    url = f"https://cafef.vn/tim-kiem.chn?keywords={ticker}"
    async with httpx.AsyncClient(headers=headers, verify=False) as client:
        resp = await client.get(url)
        soup = BeautifulSoup(resp.text, 'html.parser')
        
        # Tìm các thẻ a nằm trong div có class chứa 'item'
        items = soup.find_all('div', class_=lambda x: x and 'item' in x)
        print(f"Found {len(items)} items")
        for it in items[:10]:
            a = it.find('a')
            if a:
                title = a.get('title') or a.text.strip()
                print(f"Found: {title}")

if __name__ == "__main__":
    asyncio.run(debug_search_v3("FPT"))
