-- Phase 9: notification categories required by the existing workflow.
-- Enum values live in their own migration because PostgreSQL cannot reliably
-- use a newly-added enum value until the adding transaction is committed.

alter type public.notification_type add value if not exists 'DONATION_CREATED';
alter type public.notification_type add value if not exists 'PICKUP_AVAILABLE';
alter type public.notification_type add value if not exists 'RECEIPT_CONFIRMED';
alter type public.notification_type add value if not exists 'DONATION_REJECTED';
alter type public.notification_type add value if not exists 'DONATION_EXCEPTION';
