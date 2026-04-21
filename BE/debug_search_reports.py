import httpx
from bs4 import BeautifulSoup
import asyncio

async def debug_search_reports(ticker="FPT"):
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    # Tìm kiếm với từ khóa "Báo cáo phân tích [Ticker]"
    url = f"https://cafef.vn/tim-kiem.chn?keywords=b%C3%A1o+c%C3%A1o+ph%C3%A2n+t%C3%ADch+{ticker}"
    async with httpx.AsyncClient(headers=headers, verify=False) as client:
        resp = await client.get(url)
        soup = BeautifulSoup(resp.text, 'html.parser')
        
        print(f"Status: {resp.status_code}")
        items = soup.select('.item-content') or soup.select('.box-item')
        print(f"Found {len(items)} potential items")
        
        for item in items[:10]:
            a = item.find('a')
            if a:
                title = a.get('title') or a.text.strip()
                if "báo cáo phân tích" in title.lower() or ticker.lower() in title.lower():
                    print(f"Match: {title}")
                    # Trích xuất tên công ty chứng khoán từ title (nếu có dạng SSI, VND, v.v.)
                    firms = ["SSI", "VNDIRECT", "VCSC", "ACBS", "HSC", "BẢO VIỆT", "BVSC", "MBS", "RONGVIET", "TPS"]
                    found_firm = "Research"
                    for f in firms:
                        if f.lower() in title.lower():
                            found_firm = f
                            break
                    print(f"Firm guess: {found_firm}")
                    print("-" * 10)

if __name__ == "__main__":
    asyncio.run(debug_search_reports("FPT"))
