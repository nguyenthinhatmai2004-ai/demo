import httpx
from bs4 import BeautifulSoup
import asyncio

async def test_cafef_analysis(ticker):
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
    url = f"https://s.cafef.vn/Ajax/BaoCaoPhanTich.aspx?Symbol={ticker}"
    async with httpx.AsyncClient(follow_redirects=True) as client:
        r = await client.get(url, headers=headers)
        print("CafeF Status:", r.status_code)
        if r.status_code == 200:
            soup = BeautifulSoup(r.text, 'html.parser')
            for li in soup.select('li')[:2]:
                print(li.text.strip()[:100])

async def test_vietnambiz(ticker):
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
    url = f"https://vietnambiz.vn/tim-kiem.htm?keyword={ticker}"
    async with httpx.AsyncClient(follow_redirects=True) as client:
        r = await client.get(url, headers=headers)
        print("Vietnambiz Status:", r.status_code)
        soup = BeautifulSoup(r.text, 'html.parser')
        print("Vietnambiz List:", [a.text.strip() for a in soup.select('.news-list h3 a')[:2] or soup.select('h3 a')[:2]])

async def test_nguoiquansat(ticker):
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
    url = f"https://nguoiquansat.vn/tags/{ticker}.html"
    async with httpx.AsyncClient(follow_redirects=True) as client:
        r = await client.get(url, headers=headers)
        print("Nguoiquansat Status:", r.status_code)
        soup = BeautifulSoup(r.text, 'html.parser')
        print("Nguoiquansat List:", [a.text.strip() for a in soup.select('h3 a')[:2]])

async def main():
    await test_cafef_analysis("VCB")
    await test_vietnambiz("VCB")
    await test_nguoiquansat("VCB")

asyncio.run(main())
