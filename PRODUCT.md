# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Shoppers in Saudi Arabia (the showroom is in Riyadh, حراج بن قاسم) furnishing homes with premium furniture. Most of them browse on their phones in Arabic. They either buy catalogue pieces or ask for a piece made to their own size and taste.

## Product Purpose
TARAF FURNITURE (ترف) is an Arabic-first storefront. Visitors browse collections, order catalogue pieces, and request furniture made to order. Orders are recorded on the site and then followed up personally over WhatsApp and by phone. Success means a confirmed order or a qualified custom request that the team can quote.

## Positioning
A Riyadh furniture house that offers sculpted, finely finished catalogue pieces and also makes pieces to order. The customer brings the idea, and TARAF handles the details: materials, finishing, production, and delivery.

## Operating Context
- Orders go through `place_order` and get an order number, then hand off to WhatsApp so the team can confirm by phone.
- The admin manages products, categories, FAQs, testimonials, home layout, SEO and settings.
- Currency is SAR (Saudi riyal sign). Delivery fee comes from store settings.
- The project syncs with Lovable. Database changes are applied as SQL in Supabase.

## Capabilities and Constraints
- Catalogue pieces can be in stock or made to order ("حسب الطلب"). Production time varies by piece and the team states it when confirming.
- There are no published policies for custom-order pricing, deposits, production lead times, delivery areas or warranty. Never state figures or guarantees; say the team confirms them per request.
- Store policies text (`store_settings.policies`) may be empty.

## Brand Commitments
- Name: TARAF FURNITURE / ترف. Brand assets live in `public/assets/brand/` (logos, emblem, background texture).
- Voice: calm, refined Arabic. The brand is about craft, detail, and furniture that lasts for years.
- Custom-order line: «أنت تختار الفكرة، ونحن نهتم بالتفاصيل.»

## Evidence on Hand
- Category images and the hero/story/gallery images are managed in admin.
- No completed custom-project portfolio exists yet. That section shows only projects the admin adds, and is never filled with stock or invented work.
- No published testimonials specifically about custom orders.

## Product Principles
1. Every promise is one the team actually keeps: no invented prices, timelines or warranties.
2. Requests are recorded on the site first, then WhatsApp speeds up the conversation.
3. Arabic-first and phone-first. Desktop is the enhancement.
4. The admin can manage everything shown on the storefront without a code change.
