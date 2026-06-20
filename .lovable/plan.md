
## Scope

Extend the existing platform — do not rebuild auth, profiles, teams, tournaments, registrations, matches, or RLS. Only the gaps below are missing.

## 1. Role model

Keep the existing `app_role` enum (`super_admin`, `tournament_admin`, `finance_admin`, `moderator`, `player`) and map it to the requested 3-tier view:

- **SUPER_ADMIN** = `super_admin`
- **ADMIN** = any of `tournament_admin` / `finance_admin` / `moderator` (already what `is_admin()` returns)
- **USER** = `player` (default on signup, already wired in `handle_new_user`)

Rationale: existing RLS, server functions, and admin UI already key off `is_admin()` and `has_role()`. Collapsing to a brand-new 3-value enum would force a rewrite of every policy. The 3-tier mental model is preserved at the UI level.

Add columns to `user_roles`:
- `status` (`active` | `suspended`, default `active`)
- `granted_by uuid` (who promoted)
- `granted_at timestamptz`

Update `has_role` / `is_admin` to ignore `status='suspended'` rows.

Add `profiles.must_change_password boolean default false` and `profiles.last_login_at timestamptz` (set via a server fn called from the auth listener).

## 2. Default platform owner

Cannot be created in a SQL migration (auth.users is managed). Provide a one-time idempotent server function `bootstrapPlatformOwner` (no input, no auth required, but **no-op if a super_admin already exists** so the endpoint can't be abused):

1. If any `super_admin` row exists in `user_roles` → return `{ alreadyExists: true }`.
2. Else call `supabaseAdmin.auth.admin.createUser({ email: 'adxhub.tourni@gmail.com', password: 'adxhub.tourni', email_confirm: true })`.
3. Insert `super_admin` into `user_roles` for that uid, set `profiles.must_change_password = true`.

I will flag to the user that `adxhub.tourni` is below recommended strength and that they should rotate it immediately after first login (the forced-change flow does exactly that).

## 3. Admin management

New server functions in `src/lib/admins.functions.ts` (all guarded by `has_role(... 'super_admin')`):

- `listAdmins` — joins `user_roles` + `profiles` for any non-player role.
- `promoteUser({ userId, role })` — role ∈ tournament_admin / finance_admin / moderator.
- `demoteAdmin({ userId })` — deletes admin roles, leaves `player`.
- `suspendAdmin({ userId })` / `activateAdmin({ userId })` — toggles `status`.
- `deleteAdmin({ userId })` — removes admin roles + writes audit log (does **not** delete the auth user; safer).

New page `src/routes/_authenticated/admin/admins.tsx` rendered only when current user has `super_admin`. Table with name / email / role / status / created / last login + action buttons. Linked from the admin nav.

All actions write to `audit_logs` (already exists) via the existing `log_audit` helper.

## 4. Force password change

- `profiles.must_change_password` checked client-side after sign-in; if true, route to `/change-password` (new page) and block other navigation.
- Server fn `completePasswordChange({ newPassword })` calls `supabase.auth.updateUser` (as the user) and clears the flag.

## 5. Match credentials gating (tighten existing)

Current `get_match_credentials` releases creds when registration is `approved | confirmed | checked_in` after `credentials_release_at`. Spec requires **checked_in only**. Change:

- Modify `get_match_credentials` so non-admin participants must have registration `status = 'checked_in'`. Approved/confirmed without check-in stays locked.
- Add an "after check-in" notification inside `checkin_self()`:
  > "Check-In Successful. Match credentials are now available."
  with link to the tournament page.

Admin credential management already exists on `/_authenticated/admin/matches.tsx`. Add a "regenerate" button that updates `matches.room_id` / `room_password` via a new `regenerateMatchCredentials` server fn (admin-only, audit-logged).

The participant match page (`/_authenticated/matches/$id`) already renders credentials when `get_match_credentials` returns rows. Verify the locked-state copy matches the spec: "🔒 Match Credentials Locked — Complete tournament check-in to unlock room details."

## 6. Audit logging

Already implemented via `audit_logs` + `log_audit`. Add explicit calls in the new admin/credential functions:
- `admin.created`, `admin.suspended`, `admin.activated`, `admin.deleted`, `user.promoted`, `user.demoted`
- `match.credentials_created`, `match.credentials_updated`, `match.credentials_regenerated`, `match.credentials_viewed` (logged inside `get_match_credentials` on a successful read)

## Files

**Migration**
- `user_roles` columns: `status`, `granted_by`, `granted_at`
- `profiles` columns: `must_change_password`, `last_login_at`
- Update `has_role` / `is_admin` to filter `status='active'`
- Replace `get_match_credentials` to require `checked_in` for non-admins and log a `credentials_viewed` audit row
- Extend `checkin_self` to insert the credentials-ready notification
- Add `regenerate_match_credentials(_match_id, _room_id, _room_password)` SECURITY DEFINER (admin-only)

**Server fns**
- `src/lib/admins.functions.ts` (new)
- `src/lib/owner.functions.ts` (new — `bootstrapPlatformOwner`)
- `src/lib/account.functions.ts` (new — `completePasswordChange`, `recordLogin`)
- `src/lib/credentials.functions.ts` (new — `regenerateMatchCredentials`)

**UI**
- `src/routes/_authenticated/admin/admins.tsx` (new, super_admin only)
- `src/routes/_authenticated/change-password.tsx` (new)
- Add nav entry + super_admin gate
- Confirm locked-state copy on existing match page

## Out of scope (will not touch)

Existing auth flow, sign-up, Google OAuth, tournament CRUD, registration, payments, leaderboards, dispute resolution, storage policies.

## Security notes to surface after build

- `adxhub.tourni` is a weak default; the forced password change covers it but a stronger seed is recommended.
- `bootstrapPlatformOwner` is safe because it self-disables after the first super_admin exists; it should be invoked once from a one-off admin action and can be removed afterward.
