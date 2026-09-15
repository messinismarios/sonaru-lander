---
title: Privacy Policy
eyebrow: Legal
lede: This policy covers the Sonaru iOS app, the Sonaru Android app, and this website. It explains exactly what we hold, why we hold it, and how to get rid of it.
effective: '2026-09-07'
order: 1
---

## What we collect in the app

- **Account data** - your email address, a username, and any profile information you provide.
- **Connected-service tokens** - if you connect Spotify or Apple Music, we store the
  tokens needed to read your library and add tracks to your playlists. They are encrypted
  at rest with AES-256-GCM, and they are never logged or stored in plain text.
- **Listening activity** - the songs you like and the streams you start inside Sonaru,
  which is what your feed and your recommendations are built from.
- **Social data** - the artists and people you follow, the comments and reactions you
  post, and - only if you switch it on - your public profile's display name, follower
  count, followed artists and recently liked songs.
- **Push notification tokens** - a device token registered with Firebase Cloud Messaging,
  so we can tell you a record is out.
- **Diagnostic data** - crash reports (exception, stack trace, app and OS version, device
  model) and standard request logs (route, status, latency, IP), correlated by request id
  so a crash can be traced back to the request that caused it.

## What we collect on this website

Almost nothing, and none of it is shared with the app.

- **The waitlist form** stores the email address you type into it, and nothing else about
  you. We use it once - to tell you Sonaru has launched.
- **A hashed IP address.** To stop the form being abused we need to know that a hundred
  submissions came from one place, so we store a **salted SHA-256 hash** of the submitting
  IP address rather than the address itself. It cannot be read back into an IP.
- **A bot check.** The form is protected by Cloudflare Turnstile.
- **No cookies.** This site sets none. We use Cloudflare Web Analytics, which
  are cookieless and do not follow you anywhere.

## How we use it

To run the things you came for: your feed, search, follows, likes, auto-add, and
notifications. To find out why something crashed and fix it. To process a Pro subscription
and check the entitlement with Apple. To email you once when the app launches, if you
asked us to.

**We do not sell your personal data, and we do not use your listening history for
advertising.**

## Third parties

Each of these is governed by its own privacy policy as well as this one.

- **Spotify** and **Apple Music** - library, playlist and playback access that you grant
  explicitly, and can revoke at any time.
- **MusicBrainz** - public release and artist metadata. Sonaru queries its own mirror of
  MusicBrainz's open data; your personal data is never sent there.
- **Firebase Cloud Messaging** - delivers push notifications to your device.
- **The Apple App Store** - processes Pro subscription payments. Sonaru never sees your
  card details, only the resulting receipt.
- **Cloudflare** - serves this website, runs the waitlist form's bot check, and provides
  the cookieless analytics described above.

## Keeping it, and deleting it

You can delete your account at any time from inside the app. Deleting it deletes your
data and stops all ingest and notifications immediately, and your connected-service tokens
are discarded. If you want everything purged sooner than our standard retention schedule,
email us and we will do it.

To be taken off the website's waitlist, email us and say so.

## Your choices

- Disconnect Spotify or Apple Music at any time, from Settings.
- Choose whether your followed artists and liked songs appear on your public profile.
- Mute notifications per artist, or turn them off entirely.
- Block or report another user; someone you have blocked cannot see your activity.

## Security

Connected-service tokens are encrypted at rest. Everything between the app and the API
travels over TLS. Access to production data is limited to the people who operate the
service.

## Children

Sonaru is not directed at children under 13, and we do not knowingly collect personal
information from them.

## Changes

If this policy changes materially we will move the effective date at the top of this page
and, where it matters, tell you in the app or via email.

## Contact

Questions about this policy, or about your data: [support@sonaru.app](mailto:support@sonaru.app).
