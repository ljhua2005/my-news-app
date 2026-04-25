import json
import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
import email.utils
import os
from http.server import SimpleHTTPRequestHandler, HTTPServer

os.chdir(os.path.dirname(os.path.abspath(__file__)))

PORT = int(os.environ.get("PORT", 6601))
# 初始快取資料，確保第一次打開也不會是空的
stock_cache = [
    {'name': '輝達', 'symbol': 'NVDA', 'price': 'loading...', 'change': '0.00%', 'isPositive': True},
    {'name': 'Dell', 'symbol': 'DELL', 'price': 'loading...', 'change': '0.00%', 'isPositive': True},
    {'name': 'HP', 'symbol': 'HPQ', 'price': 'loading...', 'change': '0.00%', 'isPositive': True},
    {'name': 'AMD', 'symbol': 'AMD', 'price': 'loading...', 'change': '0.00%', 'isPositive': True},
    {'name': '高通', 'symbol': 'QCOM', 'price': 'loading...', 'change': '0.00%', 'isPositive': True},
    {'name': 'Intel', 'symbol': 'INTC', 'price': 'loading...', 'change': '0.00%', 'isPositive': True}
]

class NewsRequestHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith('/api/news?'):
            self.handle_news_api()
        elif self.path.startswith('/api/stocks'):
            self.handle_stock_api()
        else:
            super().do_GET()
            
    def handle_news_api(self):
        query_string = urllib.parse.urlparse(self.path).query
        params = urllib.parse.parse_qs(query_string)
        topic = params.get('topic', [''])[0]
        if not topic:
            self.send_response(400); self.end_headers(); return
            
        try:
            encoded_topic = urllib.parse.quote(topic)
            rss_url = f"https://news.google.com/rss/search?q={encoded_topic}%20when:7d&hl=zh-TW&gl=TW&ceid=TW:zh-Hant"
            req = urllib.request.Request(rss_url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=10) as response:
                xml_data = response.read()
            root = ET.fromstring(xml_data)
            items = root.findall('.//item')
            news_list = []
            for item in items:
                pub_date = item.findtext('pubDate')
                date_obj = None
                if pub_date:
                    try:
                        date_obj = email.utils.parsedate_to_datetime(pub_date)
                    except: pass

                news_list.append({
                    'title': item.findtext('title'),
                    'link': item.findtext('link'),
                    'pubDate': pub_date,
                    'source': item.findtext('source'),
                    '_timestamp': date_obj.timestamp() if date_obj else 0
                })
            
            # 依照時間戳記由大到小 (新到舊) 排序
            news_list.sort(key=lambda x: x['_timestamp'], reverse=True)
            
            # 取出前 10 名並移除內部暫存欄位
            final_news = []
            for item in news_list[:10]:
                item.pop('_timestamp')
                final_news.append(item)

            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'news': final_news}, ensure_ascii=False).encode('utf-8'))
        except Exception as e:
            self.send_response(500); self.end_headers()

    def handle_stock_api(self):
        global stock_cache
        tickers = {
            'NVDA': '輝達', 
            'DELL': 'Dell', 
            'HPQ': 'HP',
            'AMD': 'AMD', 
            'QCOM': '高通',
            'INTC': 'Intel'
        }
        new_results = []
        
        # 逐一抓取，確保穩定性
        for symbol, name in tickers.items():
            try:
                url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?interval=1m&range=1d"
                req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(req, timeout=5) as response:
                    data = json.load(response)
                    meta = data['chart']['result'][0]['meta']
                    price = meta.get('regularMarketPrice')
                    prev_close = meta.get('previousClose')
                    if price and prev_close:
                        change_pct = ((price - prev_close) / prev_close) * 100
                        new_results.append({
                            'name': name, 'symbol': symbol,
                            'price': f"{price:.2f}", 'change': f"{change_pct:+.2f}%",
                            'isPositive': change_pct >= 0
                        })
            except:
                # 失敗則嘗試從舊快取找資料
                for old in stock_cache:
                    if old['symbol'] == symbol:
                        new_results.append(old)
                        break
        
        if new_results:
            # 依照股價 (High to Low) 重新排序
            try:
                new_results.sort(key=lambda x: float(x.get('price', 0)) if str(x.get('price')).replace('.','').replace('-','').replace('loading...', '0').replace('+', '').strip().isdigit() or '.' in str(x.get('price')) else 0, reverse=True)
            except:
                pass
            stock_cache = new_results
            
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({'stocks': stock_cache}, ensure_ascii=False).encode('utf-8'))

if __name__ == '__main__':
    server = HTTPServer(('0.0.0.0', PORT), NewsRequestHandler)
    print(f"Server started on port {PORT}")
    server.serve_forever()
