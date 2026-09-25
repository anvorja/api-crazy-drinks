-- Demo accounts and their data, for the academic evaluation (synthetic data).
-- Password of every demo account: ApiDrinks2026 (Andrés Borja's: ##AndresB1).
-- Nothing is overwritten: existing emails or ids are skipped, and the rest of the data only
-- goes in for the demo users that this migration created.
INSERT INTO "users" ("id", "email", "name", "password_hash", "role", "birth_date", "created_at") VALUES
  ('5eed0000-0000-4000-8000-000000000001', 'admin.demo@api-drinks.local', 'Admin Demo', 'scrypt$32768$8$1$HkVGQAm+uDD3zieehUSEyA==$DoPabWdAsBs4hyLZpm7y/nBCLHY0V6X7MVhM6j5MX3NieWhMvSMJx93/ChEi60Ylf6qd8dJJxXsaGw04Vaq00Q==', 'admin', '1988-04-12', '2026-09-25T12:00:00Z'),
  ('5eed0000-0000-4000-8000-000000000002', 'premium@api-drinks.local', 'Laura Premium', 'scrypt$32768$8$1$OuiB8Uh3VXj44D7eQYv+PQ==$2RwHxl4zT/t/FyVaXDDKpctzxTSEwWDDIbxbWjqRfKKmVJqJamt2UWPymWKA+/ZOoZZ4zt0ruK85H1DpLbighA==', 'premium', '1995-07-21', '2026-09-25T12:00:00Z'),
  ('5eed0000-0000-4000-8000-000000000003', 'bar@api-drinks.local', 'Carlos Dueño de Bar', 'scrypt$32768$8$1$KZDCJpE5Lce2+qyaXLSh8Q==$fP+GPJt1sZn9+TrTGh3kK87NRWoaORSl3Hqekaez5Wbj6dWDn6Iqj+EupvN9VW4TenTIyyp/W0Ab89JxuNrOYQ==', 'venue_owner', '1985-11-03', '2026-09-25T12:00:00Z'),
  ('5eed0000-0000-4000-8000-000000000004', 'bartender@api-drinks.local', 'Sofía Bartender', 'scrypt$32768$8$1$SInT9ZvcXIxPXnNVSJ5LFg==$ooDmF2seLoXF0XpizrwRF/j9QLflQ8r2PTy7V81PD5lBkEtCmNAwehCeAS9NQZzQdhm5k+qI8elEp8zu4i/7wQ==', 'bartender', '1998-02-14', '2026-09-25T12:00:00Z'),
  ('5eed0000-0000-4000-8000-000000000005', 'basico@api-drinks.local', 'Mateo Básico', 'scrypt$32768$8$1$3dAJJrJg1dm+4S8wBNMcSQ==$lUcf1ThjHj/ppwRV3H6ju5+rFWP1JOSLSpphIBDmU5ka3Ln82Z1XwUJlPu/V6X5LV/+qreuvU7Nu8oMZD1jGVQ==', 'user', '2000-09-09', '2026-09-25T12:00:00Z'),
  ('5eed0000-0000-4000-8000-000000000006', 'menor@api-drinks.local', 'Valentina Menor', 'scrypt$32768$8$1$JzLs1/6CeQ0OPQB6e5gx/w==$xM46XutzDT7UEKIIKtgmZN8oIiLNwgRed7adq1yqCR7ca+HWzAHcP1DujjWYfusryDmvft3+v8fM/sNST7zq5Q==', 'user', '2010-05-20', '2026-09-25T12:00:00Z'),
  ('5eed0000-0000-4000-8000-000000000007', 'andres.vorja.vorja@gmail.com', 'Andrés Borja', 'scrypt$32768$8$1$a1vuLGOTgqlcp5mcFJjZuw==$Mio9KRTbb1u74J2m4vX+j+Wy0YacA+//iENNAtc4rouObjEKJZUMnrbzziCxbbfGVUiM3mR2V9+LMDLELbzU2A==', 'user', '1995-01-01', '2026-09-25T12:00:00Z')
ON CONFLICT DO NOTHING;
--> statement-breakpoint
-- Laura Premium: a citrus lover, so her taste DNA and recommendations show up right away.
INSERT INTO "favorites" ("user_id", "drink_id", "created_at")
SELECT u."id", v."drink_id", '2026-09-25T12:00:00Z'
FROM (VALUES ('11000'), ('11007'), ('11202'), ('11006'), ('11004'), ('17253')) AS v("drink_id")
JOIN "users" u ON u."id" = '5eed0000-0000-4000-8000-000000000002' AND u."email" = 'premium@api-drinks.local'
JOIN "drinks" d ON d."id" = v."drink_id"
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "drink_reactions" ("user_id", "drink_id", "kind", "created_at")
SELECT u."id", v."drink_id", v."kind"::"reaction_kind", '2026-09-25T12:00:00Z'
FROM (VALUES
  ('11000', 'superlike'),
  ('11007', 'superlike'),
  ('13214', 'like'),
  ('12402', 'like'),
  ('17255', 'like'),
  ('17196', 'like'),
  ('12528', 'dislike'),
  ('17200', 'dislike'),
  ('13971', 'dislike')
) AS v("drink_id", "kind")
JOIN "users" u ON u."id" = '5eed0000-0000-4000-8000-000000000002' AND u."email" = 'premium@api-drinks.local'
JOIN "drinks" d ON d."id" = v."drink_id"
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "user_pantries" ("user_id", "ingredients", "updated_at")
SELECT u."id", '{"Light rum","Lime","Sugar","Mint","Soda water","Tequila","Triple sec","Salt","Cachaca"}'::text[], '2026-09-25T12:00:00Z'
FROM "users" u WHERE u."id" = '5eed0000-0000-4000-8000-000000000002' AND u."email" = 'premium@api-drinks.local'
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "taste_shares" ("user_id", "slug", "display_name", "created_at")
SELECT u."id", 'laura-demo-adn', 'Laura', '2026-09-25T12:00:00Z'
FROM "users" u WHERE u."id" = '5eed0000-0000-4000-8000-000000000002' AND u."email" = 'premium@api-drinks.local'
ON CONFLICT DO NOTHING;
--> statement-breakpoint
-- Cocktle history with the real answers of those days (2026-09-21 classic: Daiquiri; 2026-09-22 classic: Vodka Lemon; 2026-09-23 classic: Jitterbug; 2026-09-24 classic: Casa Blanca; 2026-09-24 zero: Hot Chocolate to Die for).
INSERT INTO "cocktle_games" ("user_id", "day", "mode", "guesses", "solved")
SELECT u."id", v."day"::date, v."mode"::"cocktle_mode", v."guesses"::text[], v."solved"
FROM (VALUES
  ('2026-09-21', 'classic', '{11382,12101,11006}', true),
  ('2026-09-22', 'classic', '{178363}', true),
  ('2026-09-23', 'classic', '{12452,13070,14978,17177,17828,11002}', false),
  ('2026-09-24', 'classic', '{12798,11222}', true),
  ('2026-09-24', 'zero', '{12694,12784,12696,12738}', true)
) AS v("day", "mode", "guesses", "solved")
JOIN "users" u ON u."id" = '5eed0000-0000-4000-8000-000000000002' AND u."email" = 'premium@api-drinks.local'
ON CONFLICT DO NOTHING;
--> statement-breakpoint
-- Carlos: a bar in Cali with its inventory and an active Pro plan (smart menu with prices).
INSERT INTO "venues" ("id", "owner_id", "name", "city", "currency", "target_pour_cost", "created_at")
SELECT '5eed0000-0000-4000-8000-0000000000b1', u."id", 'La Barra Demo', 'Cali', 'COP', 0.22, '2026-09-25T12:00:00Z'
FROM "users" u WHERE u."id" = '5eed0000-0000-4000-8000-000000000003' AND u."email" = 'bar@api-drinks.local'
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "venue_inventory" ("venue_id", "ingredient_key", "ingredient", "bottle_size_ml", "bottle_cost", "cost_per_serving", "in_stock")
SELECT v."id", i."ingredient_key", i."ingredient", i."bottle_size_ml", i."bottle_cost", i."cost_per_serving", i."in_stock"
FROM (VALUES
  ('light rum', 'Light rum', 750::double precision, 65000::numeric, NULL::numeric, true),
  ('tequila', 'Tequila', 750::double precision, 120000::numeric, NULL::numeric, true),
  ('triple sec', 'Triple sec', 700::double precision, 70000::numeric, NULL::numeric, true),
  ('vodka', 'Vodka', 750::double precision, 60000::numeric, NULL::numeric, true),
  ('gin', 'Gin', 750::double precision, 90000::numeric, NULL::numeric, true),
  ('cachaca', 'Cachaca', 700::double precision, 80000::numeric, NULL::numeric, true),
  ('coffee liqueur', 'Coffee liqueur', 700::double precision, 75000::numeric, NULL::numeric, true),
  ('angostura bitters', 'Angostura bitters', 200::double precision, 45000::numeric, NULL::numeric, false),
  ('lime', 'Lime', NULL::double precision, NULL::numeric, 800::numeric, true),
  ('lime juice', 'Lime juice', NULL::double precision, NULL::numeric, 600::numeric, true),
  ('lemon juice', 'Lemon juice', NULL::double precision, NULL::numeric, 600::numeric, true),
  ('sugar', 'Sugar', NULL::double precision, NULL::numeric, 100::numeric, true),
  ('sugar syrup', 'Sugar syrup', NULL::double precision, NULL::numeric, 300::numeric, true),
  ('mint', 'Mint', NULL::double precision, NULL::numeric, 400::numeric, true),
  ('soda water', 'Soda water', NULL::double precision, NULL::numeric, 500::numeric, true),
  ('salt', 'Salt', NULL::double precision, NULL::numeric, 50::numeric, true),
  ('coca-cola', 'Coca-Cola', NULL::double precision, NULL::numeric, 1500::numeric, true),
  ('ginger ale', 'Ginger ale', NULL::double precision, NULL::numeric, 1500::numeric, true)
) AS i("ingredient_key", "ingredient", "bottle_size_ml", "bottle_cost", "cost_per_serving", "in_stock")
JOIN "venues" v ON v."id" = '5eed0000-0000-4000-8000-0000000000b1' AND v."owner_id" = '5eed0000-0000-4000-8000-000000000003'
ON CONFLICT DO NOTHING;
--> statement-breakpoint
-- The plan runs for a year from when this migration is applied.
INSERT INTO "subscriptions" ("user_id", "plan_id", "status", "current_period_end", "updated_at")
SELECT u."id", 'pro', 'active', now() + interval '365 days', now()
FROM "users" u WHERE u."id" = '5eed0000-0000-4000-8000-000000000003' AND u."email" = 'bar@api-drinks.local'
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "payments" ("id", "reference", "user_id", "plan_id", "amount_in_cents", "currency", "status", "transaction_id", "created_at", "updated_at")
SELECT '5eed0000-0000-4000-8000-0000000000c1', 'drinks-demo-pro-0001', u."id", 'pro', 8900000, 'COP', 'approved', 'demo-transaction-0001', '2026-09-25T12:00:00Z', '2026-09-25T12:00:00Z'
FROM "users" u WHERE u."id" = '5eed0000-0000-4000-8000-000000000003' AND u."email" = 'bar@api-drinks.local'
ON CONFLICT DO NOTHING;
