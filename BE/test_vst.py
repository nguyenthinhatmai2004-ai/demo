import httpx
import re
from bs4 import BeautifulSoup

client = httpx.Client(headers={'User-Agent': 'Mozilla/5.0'})
r1 = client.get('https://finance.vietstock.vn/bao-cao-phan-tich')
soup = BeautifulSoup(r1.text, 'html.parser')
token = soup.select_one('input[name=__RequestVerificationToken]')['value']

payload = {
    'stockCode': 'VCB',
    '__RequestVerificationToken': token
}

r2 = client.post('https://finance.vietstock.vn/data/corporateanalysis', data=payload, headers={'x-requested-with': 'XMLHttpRequest'})
if r2.status_code == 404:
    r2 = client.post('https://finance.vietstock.vn/bao-cao-phan-tich', data=payload, headers={'x-requested-with': 'XMLHttpRequest'})
print(r2.status_code)
print(r2.text[:200])

