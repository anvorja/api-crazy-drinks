-- Initial plan catalog. Limits are data: change them with a new migration, not in code.
INSERT INTO "plans" ("id", "name", "monthly_price", "currency", "max_venues", "max_inventory_items", "menu_pricing", "max_api_keys", "api_daily_requests") VALUES
  ('free',     'Free',     0,      'COP', 1,    30,   false, 1,  100),
  ('pro',      'Pro',      89000,  'COP', 3,    300,  true,  3,  10000),
  ('business', 'Business', 249000, 'COP', NULL, NULL, true,  10, 100000)
ON CONFLICT ("id") DO NOTHING;
