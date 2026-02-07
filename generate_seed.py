import csv
import uuid
import os

# --- 設定 ---
CSV_FILE = 'meal-menu.csv'
OUTPUT_FILE = 'seed_menu.sql'

# 列番号 (CSVヘッダーに基づく)
# SKU,カテゴリ,部門,名前,バリエーション,価格,税,バーコード...
COL_SKU   = 0
COL_CAT   = 1
COL_DEPT  = 2
COL_NAME  = 3   # 名前
COL_VAR   = 4
COL_PRICE = 5   # 価格
COL_TAX   = 6
COL_JAN   = 0   # SKU列に正しいJANが入っている (Index 0)

# Updated Category IDs (Based on New Schema)
CAT_BENTO   = 1 # 弁当・丼
CAT_DRINK   = 2 # 飲料
CAT_SNACK   = 3 # お菓子
CAT_DESSERT = 4 # デザート
CAT_UNKNOWN = 5 # 不明 (Default)
CAT_DELI    = 6 # 惣菜
CAT_NOODLE  = 7 # 麺類・汁物
CAT_ONIGIRI = 8 # おにぎり

# 自動仕分けキーワード
KEYWORDS = {
    CAT_BENTO:   ['ライス', '丼', 'カレー', '弁当', 'オム', '炒飯', 'ランチ', 'カツ重', '牛丼', 'ビビンバ'],
    CAT_ONIGIRI: ['おにぎり', 'いなり', 'むすび', '手巻', '寿司', '中巻', '納豆巻', 'おむすび'],
    CAT_NOODLE:  ['うどん', 'ラーメン', 'そば', 'パスタ', '麺', 'スパゲッティ', '味噌汁', 'スープ', '豚汁', '春雨', 'フォー', 'タンタン'],
    CAT_DELI:    ['サラダ', '小鉢', '冷奴', '和え', '煮', 'コロッケ', '唐揚', 'チキン', 'ハンバーグ', '鯖', '鮭', 'フライ', 'フランク', 'たこ焼き', 'ドレッシング', '納豆', '豆腐'],
    CAT_DESSERT: ['プリン', 'ケーキ', 'ヨーグルト', 'シュー', 'アイス', 'ゼリー', 'チョコ', 'ポテト', 'グミ', 'クッキー', 'タルト', 'ワッフル'],
    CAT_DRINK:   ['茶', 'コーヒー', 'コーラ', '水', 'ジュース', 'ラテ', 'ミルク', 'ココア', 'ソーダ']
}

def get_category(name):
    """商品名からカテゴリIDを推測"""
    for cat_id, words in KEYWORDS.items():
        for word in words:
            if word in name:
                return cat_id
    return None

def main():
    if not os.path.exists(CSV_FILE):
        print(f"Error: {CSV_FILE} が見つかりません。")
        return

    sql_statements = []
    sql_statements.append("-- Generated Seed Data (Recommended-First Logic Compatible)")

    try:
        with open(CSV_FILE, 'r', encoding='utf-8-sig') as f:
            reader = csv.reader(f)
            headers = next(reader, None) # Skip Header

            print(f"Loading {CSV_FILE}...")
            count_ok = 0
            count_skip = 0

            for i, row in enumerate(reader):
                if len(row) <= 7: continue
                
                # JANコード取得
                jan = row[COL_JAN].strip()
                
                # Filter: Must start with '4'
                if not jan.startswith('4'):
                    count_skip += 1
                    continue

                name = row[COL_NAME].strip()
                
                # Price Parsing
                try:
                    price_str = row[COL_PRICE].replace(',', '').replace('円', '').strip()
                    if not price_str: continue
                    price = int(price_str)
                except ValueError:
                    continue

                # Category Inference
                cat_id = get_category(name)
                
                # Data Preparation
                product_id = str(uuid.uuid4())
                is_active = 'true'
                
                # is_verified: カテゴリ判定できればTrue
                if cat_id:
                    is_verified = 'true'
                    cat_val = cat_id
                else:
                    is_verified = 'false'
                    cat_val = 'null' # DB insert時はnull

                # is_recommended: 仮ロジック（生協などの特定キーワードがあればTrueにするなど）
                # 今回はランダムではなく「手動設定」前提だが、Seedでは一旦Falseにするか、
                # テスト用に一部をTrueにする。
                # 例: '弁当' や 'おにぎり' の一部をRecommendedにしてみる（デモ用）
                is_recommended = 'false'
                if cat_id in [CAT_BENTO, CAT_ONIGIRI] and i % 5 == 0:
                     is_recommended = 'true'

                # SQL Generation
                # Note: category_id is nullable. If null, use NULL keyword.
                cat_sql_val = str(cat_val) if cat_val != 'null' else "NULL"

                # 1. Products
                sql = f"INSERT INTO public.products (id, name, price, category_id, is_active, is_verified, is_recommended) VALUES ('{product_id}', '{name}', {price}, {cat_sql_val}, {is_active}, {is_verified}, {is_recommended}) ON CONFLICT (id) DO NOTHING;"
                sql_statements.append(sql)

                # 2. Barcodes
                sql_barcode = f"INSERT INTO public.product_barcodes (jan_code, product_id) VALUES ('{jan}', '{product_id}') ON CONFLICT (jan_code) DO NOTHING;"
                sql_statements.append(sql_barcode)
                
                count_ok += 1

        # Chunking Logic
        CHUNK_SIZE = 3000
        total_chunks = (len(sql_statements) // CHUNK_SIZE) + 1
        
        print(f"Total statements: {len(sql_statements)}")
        print(f"Splitting into {total_chunks} parts (Max {CHUNK_SIZE} lines/file)...")

        for i in range(total_chunks):
            start = i * CHUNK_SIZE
            end = start + CHUNK_SIZE
            chunk = sql_statements[start:end]
            
            if not chunk: continue
            
            filename = f"seed_menu_part_{i+1}.sql"
            with open(filename, 'w', encoding='utf-8') as f:
                f.write('\n'.join(chunk))
            print(f"  -> Generated: {filename} ({len(chunk)} lines)")

        print(f"完了！")
        print(f"- 生成: {count_ok} 件")
        print(f"- 除外: {count_skip} 件")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == '__main__':
    main()
