import httpx
from bs4 import BeautifulSoup
import asyncio

async def scrape_telegram():
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    url = "https://t.me/s/nhatlongtc"
    async with httpx.AsyncClient(headers=headers, follow_redirects=True) as client:
        resp = await client.get(url)
        soup = BeautifulSoup(resp.text, 'html.parser')
        
        print("--- RECENT POSTS FROM NHAT LONG TC ---")
        messages = soup.find_all(class_='tgme_widget_message_text')
        for i, msg in enumerate(messages[:10]):
            print(f"\nPost {i+1}:")
            print(msg.get_text(separator='\n').strip())
            print("-" * 30)

if __name__ == "__main__":
    asyncio.run(scrape_telegram())
