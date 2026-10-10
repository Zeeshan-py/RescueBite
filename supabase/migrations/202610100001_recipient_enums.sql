-- Commit enum additions before the next migration uses them. Keep legacy values
-- so historical rows and earlier migrations remain readable.
alter type public.app_role add value if not exists 'RECIPIENT';
alter type public.notification_type add value if not exists 'FOOD_REQUESTED';
alter type public.notification_type add value if not exists 'REQUEST_UPDATED';
alter type public.notification_type add value if not exists 'COLLECTION_ARRANGED';
