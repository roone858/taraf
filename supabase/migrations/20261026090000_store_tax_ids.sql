-- Business identifiers shown on invoices and in the site footer, edited in Admin → الإعدادات.
-- vat_number: VAT registration number (الرقم الضريبي, 15 digits in Saudi Arabia).
-- cr_number: commercial registration (السجل التجاري, 10 digits).
-- Both optional; the admin form checks the exact lengths, the database only that they are digits.

alter table public.store_settings
  add column if not exists vat_number text check (vat_number is null or vat_number ~ '^[0-9]{5,20}$'),
  add column if not exists cr_number text check (cr_number is null or cr_number ~ '^[0-9]{5,20}$');
