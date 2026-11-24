PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS products (
 id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, title_en TEXT NOT NULL, title_zh TEXT NOT NULL,
 description_en TEXT NOT NULL DEFAULT '', description_zh TEXT NOT NULL DEFAULT '',
 price_cents INTEGER CHECK(price_cents >= 0), currency TEXT NOT NULL DEFAULT 'USD',
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','archived')),
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS articles (
 id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL, body TEXT NOT NULL,
 locale TEXT NOT NULL DEFAULT 'en', status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','archived')),
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS inquiries (
 id TEXT PRIMARY KEY, product_id TEXT REFERENCES products(id), email TEXT NOT NULL,
 brief TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','reviewing','closed')),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS orders (
 id TEXT PRIMARY KEY, inquiry_id TEXT REFERENCES inquiries(id), amount_cents INTEGER NOT NULL CHECK(amount_cents >= 0),
 currency TEXT NOT NULL DEFAULT 'USD', status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','quoted','accepted','paid','cancelled')),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS inquiries_status_idx ON inquiries(status,created_at);
CREATE INDEX IF NOT EXISTS products_status_idx ON products(status);
