
# FoodShare — MVP Plan

A web platform connecting food donors with NGOs to reduce waste. Roles: Donor, NGO, Admin. Includes Google Maps for nearby matching and in-app realtime notifications.

## Tech Stack

- Frontend: React + TanStack Start, Tailwind, shadcn/ui
- Backend: Lovable Cloud (Postgres, Auth, Realtime, Storage)
- Maps: Google Maps Platform connector (Maps JS API + Geocoding)
- Notifications: Lovable Cloud Realtime (in-app toast + notifications panel)

## User Roles & Flows

```text
Donor                 NGO                  Admin
  ↓                    ↓                     ↓
Post donation     Browse nearby         Verify NGOs
(food, qty,       donations             Manage users
photo, pickup     Accept donation       View all donations
address,          Mark picked up        Reports
expiry)           Mark delivered
  ↓                    ↓
Track status      Track pickups
```

## Screens

Public
- `/` Landing (mission, CTA, stats)
- `/auth` Sign in / Sign up (role selection: Donor or NGO; Admin assigned manually)

Authenticated (`/_authenticated/`)
- `/dashboard` Role-aware dashboard
- `/donations/new` Donor: post donation form
- `/donations` List view (Donor sees own; NGO sees nearby available; Admin sees all)
- `/donations/$id` Detail + status timeline + map
- `/notifications` Notifications history
- `/profile` Edit profile / NGO details
- `/admin` Admin: verify NGOs, manage users, basic stats

## Database (Lovable Cloud)

- `profiles` (id→auth.users, full_name, phone, role, address, lat, lng, ngo_verified, ngo_name)
- `user_roles` (id, user_id, role enum: donor|ngo|admin) — separate table per security best practice
- `donations` (id, donor_id, food_name, description, quantity, image_url, pickup_address, lat, lng, expiry_time, status enum: pending|accepted|picked_up|delivered|cancelled, accepted_by_ngo_id, created_at)
- `notifications` (id, user_id, type, title, body, donation_id, read, created_at)
- Storage bucket: `donation-images` (public read)
- `has_role(user_id, role)` security-definer function for RLS
- Realtime enabled on `donations` and `notifications`

RLS summary: donors manage their own donations; NGOs (verified) read pending donations + accept; both parties read accepted donation; admins read all. Notifications scoped to recipient.

## Matching Logic (v1 — simple)

When a donation is created, an NGO browsing the donations list sees all `pending` donations sorted by Haversine distance from their profile location. A trigger inserts a notification row for every verified NGO within 25 km — Realtime delivers it instantly.

## Google Maps Integration

- Address autocomplete on donor donation form and NGO profile (Places API New via gateway)
- Map view on donation detail showing pickup pin
- Distance shown in NGO donation list (computed client-side via Haversine from profile coords)
- Connector: `google_maps` (will prompt to connect when implementing)

## Notifications

- Realtime subscription on `notifications` table per signed-in user
- Toast (sonner) on new notification + bell icon with unread count in header
- Triggers: new donation in radius → NGOs; donation accepted → donor; status updated → donor

## Build Order

1. Enable Lovable Cloud; auth (email/password + Google), profiles, user_roles, role-aware `_authenticated` layout
2. Landing page, auth pages with role selection
3. Donations schema + RLS + storage bucket
4. Donor: post donation form (image upload, address) + "My donations" list
5. Google Maps connector + address autocomplete + geocoding
6. NGO dashboard: nearby donations list with distance, accept flow
7. Pickup status tracking (accepted → picked_up → delivered) on detail page with timeline + map
8. Notifications table + triggers + realtime subscription + bell UI
9. Admin panel: verify NGOs, user list, donation overview, basic stats (totals)
10. Polish + responsive

## Out of Scope (v1)

Volunteer role, route directions, AI freshness detection, demand prediction, charts/reports beyond simple totals, SMS/push (Firebase), payments. Can be added later.

## Notes

- I'll prompt you to connect Google Maps when we reach step 5 (no setup needed — Lovable-managed key works on preview)
- Admin role assigned via a SQL migration after you create your account; I'll do this when we reach the admin panel
- NGO accounts are unverified by default; admin must verify before they can accept donations
