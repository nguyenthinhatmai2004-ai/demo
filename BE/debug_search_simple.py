import httpx
from bs4 import BeautifulSoup
import asyncio

async def debug_search_simple(ticker="FPT"):
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    # Tìm kiếm đơn giản mã cổ phiếu
    url = f"https://cafef.vn/tim-kiem.chn?keywords={ticker}"
    async with httpx.AsyncClient(headers=headers, verify=False) as client:
        resp = await client.get(url)
        soup = BeautifulSoup(resp.text, 'html.parser')
        
        print(f"Status: {resp.status_code}")
        # Xem tất cả các div/li có class chứa "item" hoặc "content"
        items = soup.find_all(class_=lambda x: x and ("item" in x or "content" in x))
        print(f"Found {len(items)} items with matching classes")
        for it in items[:5]:
            print(f"Tag: {it.name}, Classes: {it.get('class')}")

if __name__ == "__main__":
    asyncio.run(debug_search_simple("FPT"))
