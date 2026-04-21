import httpx
from bs4 import BeautifulSoup
import asyncio

async def debug_reports():
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    # Thử cào trang báo cáo phân tích chung của CafeF
    url = "https://cafef.vn/thi-truong-chung-khoan/bao-cao-phan-tich.chn"
    async with httpx.AsyncClient(headers=headers, verify=False) as client:
        resp = await client.get(url)
        soup = BeautifulSoup(resp.text, 'html.parser')
        
        print(f"Status: {resp.status_code}")
        # Tìm các mục báo cáo (thường nằm trong các thẻ li hoặc div cụ thể)
        items = soup.select('.tl-item') or soup.select('.knswli')
        print(f"Found {len(items)} potential report items")
        
        for item in items[:5]:
            a = item.find('a')
            if a:
                title = a.get('title') or a.text.strip()
                print(f"Report: {title}")
                # Thử tìm tên công ty chứng khoán (thường trong title hoặc thẻ span)
                print(f"Link: {a['href']}")
                print("-" * 10)

if __name__ == "__main__":
    asyncio.run(debug_reports())
