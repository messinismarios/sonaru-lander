# The showcase manifest

`releases.json` and `artists.json` are the **only** places the site's album artwork, artist
photography and release metadata are named. `design-system.md` §7 requires this: swapping
the entire showcase set - including to original or fictional art if a rights holder objects

- must be a change to one file, never a redesign. That is what keeps the accepted licensing
  risk cheap to reverse.

Two manifests, because an artist and a release are not the same fact on this site. Act
one's field names **eight artists** a visitor follows; act two's phone and act three's
playlist show **five releases**. Only one artist appears in both lists, so folding them
together would have made every chip need a release it does not have.

| File            | Assets live in                  | Shown by                                                 |
| --------------- | ------------------------------- | -------------------------------------------------------- |
| `releases.json` | `src/assets/showcase/releases/` | `FeedScreen.astro`, `Playlist.astro`, `LockScreen.astro` |
| `artists.json`  | `src/assets/showcase/artists/`  | `Problem.astro`'s chips                                  |

## Supplying real covers

1. Drop the image files into `src/assets/showcase/releases/`. Square, at least 640×640,
   `.jpg`, `.png`, `.webp` or `.avif`. Astro generates the AVIF/WebP derivatives and the
   `srcset` at build; do not pre-optimise them and do not commit resized copies.
2. Point each entry's `artwork` at its filename, and fill in `artist`, `title`, `kind`
   (`single` | `ep` | `album`), `releaseDate` (`YYYY-MM-DD`), `duration` in seconds, and
   `trackCount`.
3. Set `credit` to the rights holder if one should be named beyond the artist - otherwise
   leave it `null`. `artist` and `title` are always rendered next to the cover, which is
   `design-system.md` §7's attribution requirement and is natural here because the mockup
   is showing a music feed.
4. Run `npm run showcase`. It derives each cover's `tint` and writes it back into this
   file. **Do not set `tint` by hand** - it is generated, and a hand-set value will be
   overwritten on the next run.
5. Run `npm run verify`.

Adding or removing an entry changes how many releases the hero's feed advances through.
Three is what the hero's Gate C approved; a different count is a design change and needs
its own gate.

## Supplying artist photography

The same, minus the derived colour: drop the file into `src/assets/showcase/artists/`, add
an entry naming it, and run `npm run verify`. There is no `npm run showcase` step - an
artist photograph tints nothing, so nothing is derived from it.

An entry does two independent jobs and a flag decides each:

- **`field: true`** puts the artist in act one's scattered chips. There are **eight**
  places (`CHIP_POSITIONS` in `Problem.astro`) and the manifest must mark exactly eight,
  each with a photograph, or the build fails. Changing who is in the field is a design
  change to a section frozen behind its Gate C - it needs its own gate.
- **being named by a release's `artistId`** puts the artist's photograph on that release
  card's chip. No flag; the link is the release's.

Both, one, or neither is fine - `billie-eilish` is currently the only entry doing both.
`photo` may be `null` for an artist named by a release but not yet photographed; the card
falls back to the blank disc it has always had.

## Removing one artist on request

Delete that entry from whichever manifest names them, delete its file from
`src/assets/showcase/`, run `npm run showcase` if it was a cover, and ship. No other file
mentions it. This is the documented one-file takedown procedure `design-system.md` §7
requires, and the support page publishes the contact address that starts it.

## Why `tint` is a hex literal outside `tokens.css`

The repo's rule is that no colour is defined outside `src/styles/tokens.css`, because the
contrast validator parses that file and a colour defined anywhere else is a colour nothing
checks. `tint` is the documented exception, and it is the same exception the app makes:
`design-system.md` §7 states artwork is the only source of colour outside the tokens.

It is also not really a colour _decision_. In the iOS app the tint arrives from the API as
`releaseColor` on the feed payload - data attached to the release, not a design choice made
in the client. `scripts/build-showcase.mjs` is the web equivalent: it derives the value from
the artwork at build time so the browser never does colour work at runtime, exactly as
`design-system.md` §6 requires.

The tint is never used behind text. It sits behind the artwork inside the device screen,
which is `aria-hidden` decoration, so no contrast pairing depends on it.

## Current state - real artwork, real dates

The single `placeholder-cover.jpg` and the fictional artist and release names are **gone**
as of 2026-09-11 (owner supplied the files). Five real releases and twelve real artists,
and `credit` is `null` throughout because every entry names its artist beside its image.

**Every field is the release's own fact, `releaseDate` included** - 2020-09-25 through
2024-10-04, the dates these albums actually came out. **Only act one follows them**
(owner): the phone's feed is strictly reverse-chronological and nothing overrides it.
**Changing a date to reorder an act is the one edit to avoid here.** An earlier pass did
exactly that and it was reversed the same day: strict reverse-chronological order with
nothing reordered is the claim the whole page makes, and staged dates are that claim being
broken inside the mockup that exists to demonstrate it.

Which release the _back half_ of the page is about is therefore a separate fact, and it is
the `announced` flag - `ICYMI`. The notification announces it and the playlist receives it,
whatever the dates do, and `getFeedReleases` keeps it on the phone so the page's spine
stays one release end to end. **Exactly one entry may carry it**, enforced in
`showcase.ts`, because Zod validates entries one at a time and cannot see across them.

Three notes on the remaining fields:

- **`duration` is the album's total runtime**, not one track's. Every entry here is a
  multi-track album, so there is no single track length to state and the total is the one
  number that is checkable.
- **The artwork-driven tint is live.** It was deferred from 8.2 through 8.5 because one
  placeholder cover gave the colour nowhere to travel; five covers is the condition that
  deferral named. `npm run showcase` derives the values, `FeedScreen.astro` sets `--tint`
  per layer, and the crossfade between them is visible for the first time.
- **`artistId` links a release to its artist's photograph** for the card's chip. Four of
  the five release artists have no photograph yet and carry `photo: null`, so their chips
  render the blank disc the card has always had. Dropping a file into
  `src/assets/showcase/artists/` and naming it in `artists.json` is the whole fix; no
  component changes.
