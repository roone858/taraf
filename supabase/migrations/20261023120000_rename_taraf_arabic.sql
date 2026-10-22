-- The Arabic brand name is «ترف», not «طرف». Fixes the policy texts seeded by 20261023090000
-- (and any admin edits that kept the old spelling). «الطرف الثالث» (third party) is left as is.
update public.policy_pages
set
  title = replace(title, 'طرف للأثاث', 'ترف للأثاث'),
  content = replace(content, 'طرف للأثاث', 'ترف للأثاث'),
  seo_title = replace(seo_title, 'طرف للأثاث', 'ترف للأثاث'),
  seo_description = replace(seo_description, 'طرف للأثاث', 'ترف للأثاث'),
  updated_at = now()
where language = 'ar'
  and (title || content || coalesce(seo_title, '') || coalesce(seo_description, '')) like '%طرف للأثاث%';
