import httpx
from bs4 import BeautifulSoup
import asyncio
from urllib.parse import quote

async def test_business_news():
    keywords = ["kế hoạch kinh doanh", "lợi nhuận", "kết quả kinh doanh"]
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
    
    async with httpx.AsyncClient(headers=headers, verify=False, timeout=15.0) as client:
        for kw in keywords:
            print(f"\n--- Searching for: {kw} ---")
            url = f"https://cafef.vn/tim-kiem.chn?keywords={quote(kw)}"
            resp = await client.get(url)
            soup = BeautifulSoup(resp.text, 'html.parser')
            items = soup.select('li.et-item') or soup.select('div.knswli-left')
            for i, item in enumerate(items[:3]):
                title = item.text.strip().replace('\n', ' ')
                print(f"{i+1}. {title[:80]}...")

if __name__ == "__main__":
    asyncio.run(test_business_news())
