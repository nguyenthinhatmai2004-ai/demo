import httpx
from bs4 import BeautifulSoup

def test_scrape():
    url = "https://cafef.vn/tim-kiem.chn?keywords=tho%C3%A1i+v%E1%BB%91n"
    headers = {"User-Agent": "Mozilla/5.0"}
    resp = httpx.get(url, headers=headers, follow_redirects=True)
    print(f"Status: {resp.status_code}")
    soup = BeautifulSoup(resp.text, 'html.parser')
    
    # CafeF search results usually are in <h3> or <a> tags inside a specific div
    articles = soup.select('li.et-item') or soup.select('div.knswli-left') or soup.find_all('a', href=True)
    found = 0
    for a in articles:
        text = a.text.strip()
        if "thoái vốn" in text.lower():
            print(f"Found: {text[:50]}...")
            found += 1
            if found > 5: break
    
    if found == 0:
        print("No articles found with generic parser. Checking raw HTML snippets...")
        print(resp.text[:1000])

if __name__ == "__main__":
    test_scrape()
