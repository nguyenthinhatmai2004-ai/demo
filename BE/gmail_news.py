import asyncio
import email
import imaplib
import os
import re
import unicodedata
from datetime import datetime, timedelta
from email.header import decode_header, make_header
from email.message import Message
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Dict, List, Optional
from zoneinfo import ZoneInfo

from bs4 import BeautifulSoup
from dotenv import load_dotenv


URL_RE = re.compile(r"https?://[^\s<>\"]+")
ITEM_RE = re.compile(r"^###\s+\d+\.\s+(.+)$")
FIELD_RE = re.compile(r"^-\s*([^:]+):\s*(.+)$")
TICKER_RE = re.compile(r"\b[A-Z]{2,5}\b")

MARKET_KEYWORDS = {
    "thi truong",
    "thi truong chung",
    "vn-index",
    "vnindex",
    "hose",
    "hnx",
    "upcom",
}
MACRO_KEYWORDS = {
    "vi mo",
    "lai suat",
    "ty gia",
    "lam phat",
    "fed",
    "usd",
    "dxy",
    "gdp",
    "cpi",
    "chinh sach",
    "dau tu cong",
    "tin dung",
}
INTERNATIONAL_KEYWORDS = {
    "quoc te",
    "my",
    "trung quoc",
    "chau a",
    "chau au",
    "dow jones",
    "nasdaq",
    "s&p",
    "hang seng",
    "nikkei",
    "oil",
    "gold",
    "brent",
}
CORPORATE_KEYWORDS = {
    "doanh nghiep",
    "loi nhuan",
    "doanh thu",
    "co tuc",
    "kqkd",
    "dhcd",
    "hop dong",
    "phat hanh",
    "m&a",
    "mua ban",
    "thoai von",
}


def _decode(value: Optional[str]) -> str:
    if not value:
        return ""
    try:
        return _fix_encoding(str(make_header(decode_header(value))).strip())
    except Exception:
        return _fix_encoding(value.strip())


def _fix_encoding(value: str) -> str:
    if not value:
        return ""
    mojibake_markers = ("Ã", "Ä", "áº", "á»", "Æ", "ð", "â")
    if not any(marker in value for marker in mojibake_markers):
        return value
    try:
        repaired = value.encode("latin1").decode("utf-8")
        if repaired.count("�") <= value.count("�"):
            return repaired
    except Exception:
        pass
    return value


def _clean_text(value: str, limit: int = 420) -> str:
    text = re.sub(r"\s+", " ", value or "").strip()
    if len(text) <= limit:
        return text
    return f"{text[:limit].rsplit(' ', 1)[0]}..."


def _fold(value: str) -> str:
    value = _fix_encoding(value)
    normalized = unicodedata.normalize("NFD", value)
    without_marks = "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")
    without_marks = without_marks.replace("đ", "d").replace("Đ", "D")
    replacements = {
        "đ": "d",
        "Đ": "D",
        "á": "a", "à": "a", "ả": "a", "ã": "a", "ạ": "a",
        "ă": "a", "ắ": "a", "ằ": "a", "ẳ": "a", "ẵ": "a", "ặ": "a",
        "â": "a", "ấ": "a", "ầ": "a", "ẩ": "a", "ẫ": "a", "ậ": "a",
        "é": "e", "è": "e", "ẻ": "e", "ẽ": "e", "ẹ": "e",
        "ê": "e", "ế": "e", "ề": "e", "ể": "e", "ễ": "e", "ệ": "e",
        "í": "i", "ì": "i", "ỉ": "i", "ĩ": "i", "ị": "i",
        "ó": "o", "ò": "o", "ỏ": "o", "õ": "o", "ọ": "o",
        "ô": "o", "ố": "o", "ồ": "o", "ổ": "o", "ỗ": "o", "ộ": "o",
        "ơ": "o", "ớ": "o", "ờ": "o", "ở": "o", "ỡ": "o", "ợ": "o",
        "ú": "u", "ù": "u", "ủ": "u", "ũ": "u", "ụ": "u",
        "ư": "u", "ứ": "u", "ừ": "u", "ử": "u", "ữ": "u", "ự": "u",
        "ý": "y", "ỳ": "y", "ỷ": "y", "ỹ": "y", "ỵ": "y",
    }
    return "".join(replacements.get(ch, ch) for ch in without_marks).lower()


def _has_any(text: str, keywords: set[str]) -> bool:
    folded = _fold(text)
    return any(keyword in folded for keyword in keywords)


def _message_text(message: Message) -> str:
    parts: List[str] = []
    html_parts: List[str] = []
    if message.is_multipart():
        for part in message.walk():
            content_type = part.get_content_type()
            if content_type not in {"text/plain", "text/html"}:
                continue
            payload = part.get_payload(decode=True)
            if not payload:
                continue
            text = _fix_encoding(payload.decode(part.get_content_charset() or "utf-8", errors="replace"))
            if content_type == "text/plain":
                parts.append(text)
            else:
                html_parts.append(BeautifulSoup(text, "html.parser").get_text("\n"))
    else:
        payload = message.get_payload(decode=True)
        if payload:
            text = _fix_encoding(payload.decode(message.get_content_charset() or "utf-8", errors="replace"))
            if message.get_content_type() == "text/html":
                html_parts.append(BeautifulSoup(text, "html.parser").get_text("\n"))
            else:
                parts.append(text)
    return "\n".join(parts or html_parts)


def _date_iso(value: Optional[str]) -> str:
    if not value:
        return datetime.utcnow().isoformat()
    try:
        parsed = parsedate_to_datetime(value)
        return parsed.isoformat()
    except Exception:
        return datetime.utcnow().isoformat()


class GmailNewsClient:
    def __init__(self):
        load_dotenv(dotenv_path=Path(__file__).with_name(".env"), override=True)
        self.address = os.getenv("GMAIL_ADDRESS", "").strip()
        self.password = os.getenv("GMAIL_APP_PASSWORD", "").strip()
        self.mailbox = os.getenv("GMAIL_MAILBOX", "INBOX").strip() or "INBOX"
        self.default_query = os.getenv("GMAIL_NEWS_QUERY", "long.nt1608 newer_than:2d").strip()
        self.default_sender = os.getenv("GMAIL_NEWS_SENDER", "").strip()
        self.lookback_hours = self._env_int("GMAIL_NEWS_LOOKBACK_HOURS", 48)

    def is_configured(self) -> bool:
        return bool(self.address and self.password)

    def status(self) -> Dict:
        return {
            "configured": self.is_configured(),
            "address": self.address,
            "mailbox": self.mailbox,
            "query": self.default_query,
            "sender": self.default_sender,
            "lookbackHours": self.lookback_hours,
        }

    async def fetch_news(self, ticker: str = "", limit: int = 15) -> List[Dict]:
        return await asyncio.to_thread(self._fetch_news_sync, ticker.upper().strip(), max(1, min(limit, 50)))

    async def fetch_brief(self, ticker: str = "", limit: int = 20) -> Dict:
        return await asyncio.to_thread(self._fetch_brief_sync, ticker.upper().strip(), max(1, min(limit, 50)))

    def _fetch_news_sync(self, ticker: str, limit: int) -> List[Dict]:
        brief = self._fetch_brief_sync(ticker, limit)
        return brief.get("items", [])[:limit]

    def _fetch_brief_sync(self, ticker: str, limit: int) -> Dict:
        empty = self._empty_brief(ticker)
        if not self.is_configured():
            return empty

        imap = imaplib.IMAP4_SSL("imap.gmail.com")
        try:
            imap.login(self.address, self.password)
            imap.select(self.mailbox)
            ids = self._search_ids(imap)
            raw_items: List[Dict] = []
            source_email_count = 0
            for uid in reversed(ids[-10:]):
                status, data = imap.uid("fetch", uid, "(RFC822)")
                if status != "OK" or not data or not data[0]:
                    continue
                raw = data[0][1]
                message = email.message_from_bytes(raw)
                items = self._message_to_news_items(uid.decode(errors="ignore"), message, ticker="")
                if items:
                    source_email_count += 1
                    raw_items.extend(items)
                if len(raw_items) >= limit * 3:
                    break
            return self._build_brief(raw_items, ticker, limit, source_email_count)
        finally:
            try:
                imap.logout()
            except Exception:
                pass

    def _empty_brief(self, ticker: str) -> Dict:
        local_date = datetime.now(ZoneInfo("Asia/Ho_Chi_Minh")).date().isoformat()
        return {
            "ticker": ticker,
            "date": local_date,
            "source": "Gmail longnt.1608",
            "items": [],
            "groups": {
                "tickerSpecific": [],
                "macro": [],
                "international": [],
                "corporate": [],
                "market": [],
            },
            "counts": {
                "tickerSpecific": 0,
                "macro": 0,
                "international": 0,
                "corporate": 0,
                "market": 0,
            },
            "sourceEmailCount": 0,
        }

    def _search_ids(self, imap: imaplib.IMAP4_SSL) -> List[bytes]:
        raw_query = self.default_query
        quoted_query = '"' + raw_query.replace("\\", "\\\\").replace('"', '\\"') + '"'

        status, data = imap.uid("search", None, "X-GM-RAW", quoted_query)
        if status == "OK" and data and data[0]:
            return data[0].split()

        criteria: List[str] = []
        if self.default_sender:
            criteria.extend(["FROM", f'"{self.default_sender}"'])
        status, data = imap.uid("search", None, *(criteria or ["ALL"]))
        if status == "OK" and data and data[0]:
            return data[0].split()
        return []

    def _message_to_news_items(self, uid: str, message: Message, ticker: str) -> List[Dict]:
        subject = _decode(message.get("Subject"))
        sender = _decode(message.get("From"))
        body = _message_text(message)
        published_at = _date_iso(message.get("Date"))
        if not self._is_within_lookback(published_at):
            return []

        items = self._parse_bot_news(uid, subject, sender, body, published_at)
        if items:
            return self._filter_relevant_items(items, ticker) if ticker else items

        fallback = self._message_to_news(uid, message, ticker)
        fallback["category"] = self._category_for("Gmail", f"{fallback.get('title', '')} {fallback.get('summary', '')}")
        fallback["section"] = "Gmail"
        return self._filter_relevant_items([fallback], ticker) if ticker else [fallback]

    def _parse_bot_news(self, uid: str, subject: str, sender: str, body: str, published_at: str) -> List[Dict]:
        items: List[Dict] = []
        section = "Gmail"
        current: Optional[Dict] = None

        for raw_line in body.splitlines():
            line = raw_line.strip()
            if not line:
                continue
            if line.startswith("## "):
                section = re.sub(r"^#+\s*", "", line).strip(" -")
                continue

            item_match = ITEM_RE.match(line)
            if item_match:
                if current:
                    items.append(current)
                title = item_match.group(1).strip()
                current = {
                    "id": f"gmail-{uid}-{len(items) + 1}",
                    "title": title,
                    "summary": "",
                    "link": "",
                    "source": "Gmail longnt.1608",
                    "sender": sender,
                    "category": self._category_for(section, title),
                    "section": section,
                    "ticker": "",
                    "sentiment": "",
                    "time": published_at,
                    "publishedAt": published_at,
                    "priority": 50,
                }
                continue

            if not current:
                continue

            field_match = FIELD_RE.match(line)
            if field_match:
                key = _fold(field_match.group(1))
                value = field_match.group(2).strip()
                if "nguon" in key:
                    current["source"] = value
                elif "ma co phieu" in key:
                    current["ticker"] = value
                elif "danh gia" in key:
                    current["sentiment"] = value
                elif "tom tat" in key:
                    current["summary"] = value
                elif "link" in key or "url" in key:
                    links = URL_RE.findall(value)
                    current["link"] = links[0] if links else value
                continue

            if URL_RE.search(line) and not current.get("link"):
                current["link"] = URL_RE.search(line).group(0)
            elif current.get("summary"):
                current["summary"] = f"{current['summary']} {line}"

        if current:
            items.append(current)

        for item in items:
            if not item.get("link"):
                links = URL_RE.findall(f"{item.get('summary', '')} {item.get('title', '')}")
                item["link"] = links[0] if links else f"https://mail.google.com/mail/u/0/#search/{uid}"
            item["summary"] = _clean_text(item.get("summary", ""), 520)
            item["category"] = self._category_for(item.get("section", ""), f"{item.get('title', '')} {item.get('summary', '')}")
        return items

    def _filter_relevant_items(self, items: List[Dict], ticker: str) -> List[Dict]:
        return self._build_brief(items, ticker, limit=15, source_email_count=0).get("items", [])

    def _build_brief(self, items: List[Dict], ticker: str, limit: int, source_email_count: int) -> Dict:
        brief = self._empty_brief(ticker)
        brief["sourceEmailCount"] = source_email_count
        if not items:
            return brief

        seen: set[str] = set()
        groups = brief["groups"]

        for item in items:
            key = item.get("id") or f"{item.get('title', '')}|{item.get('link', '')}"
            if key in seen:
                continue
            seen.add(key)

            category = item.get("category", "MARKET")
            ticker_match = self._matches_ticker(item, ticker) if ticker else False

            if ticker_match:
                enriched = dict(item)
                enriched["category"] = f"{ticker} / {category}"
                enriched["group"] = "tickerSpecific"
                enriched["priority"] = 100
                groups["tickerSpecific"].append(enriched)
                continue

            if category == "MACRO":
                groups["macro"].append({**item, "group": "macro", "priority": 80})
            elif category == "INTERNATIONAL":
                groups["international"].append({**item, "group": "international", "priority": 78})
            elif category == "CORPORATE":
                groups["corporate"].append({**item, "group": "corporate", "priority": 65})
            elif category == "MARKET":
                groups["market"].append({**item, "group": "market", "priority": 60})

        group_limits = {
            "tickerSpecific": 6,
            "macro": 4,
            "international": 4,
            "corporate": 4,
            "market": 3,
        }
        flat: List[Dict] = []
        for name, group_items in groups.items():
            group_items.sort(key=lambda item: item.get("priority", 0), reverse=True)
            groups[name] = group_items[:group_limits[name]]
            flat.extend(groups[name])

        brief["groups"] = groups
        brief["items"] = flat[:limit]
        brief["counts"] = {name: len(group_items) for name, group_items in groups.items()}
        brief["hasTickerSpecific"] = len(groups["tickerSpecific"]) > 0
        return brief

    def _matches_ticker(self, item: Dict, ticker: str) -> bool:
        if not ticker:
            return False
        ticker_field = str(item.get("ticker", "")).upper()
        explicit_tickers = set(TICKER_RE.findall(ticker_field))
        haystack = f"{item.get('title', '')} {item.get('summary', '')}".upper()
        text_tickers = set(TICKER_RE.findall(haystack))
        return ticker in explicit_tickers or ticker in text_tickers

    def _category_for(self, section: str, text: str) -> str:
        combined = f"{section} {text}"
        if _has_any(combined, INTERNATIONAL_KEYWORDS):
            return "INTERNATIONAL"
        if _has_any(combined, MACRO_KEYWORDS):
            return "MACRO"
        if _has_any(combined, CORPORATE_KEYWORDS):
            return "CORPORATE"
        if _has_any(combined, MARKET_KEYWORDS):
            return "MARKET"
        return "MARKET"

    @staticmethod
    def _env_int(name: str, default: int) -> int:
        try:
            return max(1, int(os.getenv(name, str(default))))
        except ValueError:
            return default

    def _is_within_lookback(self, value: str) -> bool:
        try:
            parsed = datetime.fromisoformat(value)
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=ZoneInfo("UTC"))
            now = datetime.now(ZoneInfo("Asia/Ho_Chi_Minh"))
            cutoff = now - timedelta(hours=self.lookback_hours)
            return parsed.astimezone(ZoneInfo("Asia/Ho_Chi_Minh")) >= cutoff
        except Exception:
            return True

    def _message_to_news(self, uid: str, message: Message, ticker: str) -> Optional[Dict]:
        subject = _decode(message.get("Subject"))
        sender = _decode(message.get("From"))
        body = _message_text(message)
        links = URL_RE.findall(body)
        return {
            "id": f"gmail-{uid}",
            "title": subject or "(No subject)",
            "summary": _clean_text(body),
            "link": links[0] if links else f"https://mail.google.com/mail/u/0/#search/rfc822msgid:{message.get('Message-ID', uid)}",
            "source": "Gmail longnt.1608",
            "sender": sender,
            "category": "GMAIL_NEWS",
            "time": _date_iso(message.get("Date")),
            "publishedAt": _date_iso(message.get("Date")),
        }
