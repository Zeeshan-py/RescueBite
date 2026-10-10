# Google sign-in deployment

The login and registration pages use Supabase OAuth. Google credentials belong
in the Supabase provider settings, never in frontend environment variables or Git.
The Supabase SDK restores the returned session; the existing AuthProvider loads
the authoritative application profile. New Google users choose DONOR, NGO, or
RECIPIENT on the callback page. NGO users then complete their existing NGO setup.
Existing users keep their database role; ADMIN is never offered for registration.

## Google Cloud

Use the existing Web application client in project `rescuebite-510517`.
Do not create a duplicate client simply because the frontend now supports OAuth.

Configure Google Auth Platform branding with app name RescueBite and the owner's
support and developer contact emails. Use an External audience for public users.
Request only `openid`, `userinfo.email`, and `userinfo.profile` scopes. If the
app remains in Testing, add the intended Google test accounts. Publish for public
availability when Google's consent configuration and any required verification
are complete.

Authorized JavaScript origins:

- https://rescuebitee.netlify.app
- http://localhost:5173
- http://127.0.0.1:5173

Authorized redirect URI (Google returns to Supabase, not directly to the app):

- https://yqzuddkeycrvkzqcchmv.supabase.co/auth/v1/callback

The downloaded client currently contains app callback URLs and HTTPS localhost;
those must be corrected in Google Cloud, not merely edited in the downloaded JSON.

## Supabase

Authentication > Sign In / Providers > Google:

1. Enter the existing Google Web client ID and its client secret.
2. Enable Google sign-in and save.
3. Keep nonce verification and the requirement for an email enabled.

Authentication > URL Configuration:

- Site URL: https://rescuebitee.netlify.app
- Redirect URLs:
  - https://rescuebitee.netlify.app/auth/google/callback
  - http://localhost:5173/auth/google/callback
  - http://127.0.0.1:5173/auth/google/callback

Preserve any other existing redirect URLs that are still needed. Netlify's
`public/_redirects` rewrite ensures direct callback visits load the React app.
No Google secret or Google client ID is needed in Netlify's frontend build.

## Verify after deployment

Test Google sign-in on localhost and production with a permitted account. Check
new-user role selection, NGO organization setup, existing-user role preservation,
logout, and cancellation of Google consent. Also verify existing email/password
login still works. A successful local build does not prove the external provider
or consent screen has been configured.

References:

- https://supabase.com/docs/guides/auth/social-login/auth-google
- https://supabase.com/docs/guides/auth/redirect-urls
