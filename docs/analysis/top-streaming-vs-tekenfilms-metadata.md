# Metadata Comparison: TOP Streaming vs Tekenfilms

Generated: 2026-05-26 00:03 

Note: this dump captures the pre-enrichment Tekenfilms output used to identify gaps. The follow-up implementation now uses IMDb IDs where available, adds IMDb ratings/runtime/links to catalog items, and serves TOP Posters images from the Tekenfilms host.

## Sources

| Source | URL / Path | Catalog | Items | Meta fetched |
|---|---|---:|---:|---:|
| TOP Streaming | `https://top-streaming.stream/6b1f0a1e-59cd-4159-95a0-c566aaf10b31/manifest.json` | `netflix-movies-australia` | 11 | 10/11 |
| Tekenfilms | `/homeassistant/tekenfilms/data/catalog.json` + `/homeassistant/tekenfilms/data/meta/*.json` | `tekenfilms_nl` | 75 | 75 |

TOP Streaming exposes rich catalog items directly. Its meta endpoint returned full meta for most items, but at least one catalog id returned 404 during this dump. Tekenfilms exposes a lighter catalog item and puts richer fields in per-item `meta` JSON.

## Manifest Comparison

| Field | TOP Streaming | Tekenfilms |
|---|---|---|
| `id` | `uuid.6b1f0a1e.topstreaming.flixpatrol` | `org.nexio.tekenfilms` |
| `name` | `TOP Streaming 🌍` | `Tekenfilms` |
| `resources` | `catalog, meta` | `catalog`, `meta`, `stream` |
| `types` | `movie, series` | `movie` |
| `catalogs` | `movie/netflix-movies-australia` | `movie/tekenfilms_nl` |
| `idPrefixes` | `tt, tmdb:, mal:` | `tekenfilms:` |
| Addon `logo` / `background` | yes / yes | not currently set in manifest |

## Field Coverage

| Field | TOP catalog | TOP meta | Tekenfilms catalog | Tekenfilms meta | Notes |
|---|---:|---:|---:|---:|---|
| `accessTracking` | 11/11 | 10/10 | 0/75 | 0/75 | TOP-specific telemetry/cache metadata; probably not useful for Tekenfilms. |
| `background` | 11/11 | 10/10 | 75/75 | 75/75 |  |
| `behaviorHints` | 11/11 | 10/10 | 0/75 | 75/75 | TOP meta includes `hasScheduledVideos`; Tekenfilms meta includes `defaultVideoId` only. |
| `cast` | 0/11 | 0/10 | 0/75 | 75/75 |  |
| `description` | 11/11 | 10/10 | 75/75 | 75/75 |  |
| `director` | 0/11 | 0/10 | 0/75 | 75/75 |  |
| `genres` | 0/11 | 0/10 | 0/75 | 75/75 |  |
| `id` | 11/11 | 10/10 | 75/75 | 75/75 | TOP uses IMDb ids (`tt...`); Tekenfilms uses local ids (`tekenfilms:...`). |
| `imdbId` | 0/11 | 0/10 | 0/75 | 75/75 | Tekenfilms uses camelCase `imdbId`; TOP uses IMDb id as primary `id` and `imdbRating`. |
| `imdbRating` | 11/11 | 10/10 | 0/75 | 0/75 | TOP emits this in catalog and meta. Tekenfilms stores IMDb id, not rating. |
| `links` | 11/11 | 10/10 | 0/75 | 0/75 | TOP uses Stremio links for IMDb, share, genres, and cast. Tekenfilms does not currently emit links. |
| `logo` | 11/11 | 10/10 | 74/75 | 74/75 | Catalog logo support was recently added to Tekenfilms; regenerate data after pulling. |
| `name` | 11/11 | 10/10 | 75/75 | 75/75 |  |
| `originalName` | 0/11 | 0/10 | 0/75 | 75/75 |  |
| `poster` | 11/11 | 10/10 | 75/75 | 75/75 |  |
| `releaseInfo` | 11/11 | 10/10 | 75/75 | 75/75 |  |
| `released` | 0/11 | 0/10 | 0/75 | 75/75 |  |
| `runtime` | 11/11 | 10/10 | 0/75 | 75/75 | TOP catalog includes runtime. Tekenfilms meta includes runtime, catalog does not. |
| `tmdbId` | 0/11 | 0/10 | 0/75 | 75/75 | Tekenfilms keeps TMDB id for traceability. |
| `trend` | 11/11 | 10/10 | 0/75 | 0/75 | TOP-specific ranking metadata. |
| `type` | 11/11 | 10/10 | 75/75 | 75/75 |  |
| `videoFilename` | 0/11 | 0/10 | 0/75 | 75/75 | Tekenfilms internal runtime field used for stream URL building. |

## Catalog Item Shape Examples

### TOP Streaming Catalog Item

```json
{
  "id": "tt34611082",
  "type": "movie",
  "name": "Ladies First",
  "description": "An arrogant but charismatic ladies' man finds his life of money, power and casual flings upended when he wakes up in a parallel world dominated by women.",
  "imdbRating": "5.8",
  "poster": "https://image.tmdb.org/t/p/w500/kjR56Yv17pbjTVBTMjqepvcus4f.jpg",
  "logo": "https://image.tmdb.org/t/p/w300/6W0bD4osfNwMUdSsNh7gYhCnOWJ.png",
  "background": "https://image.tmdb.org/t/p/w1280/bOy625BjpCskOWnx3tD09MsKVCb.jpg",
  "releaseInfo": "2026",
  "runtime": "1h34min",
  "links": [
    {
      "name": "5.8",
      "category": "imdb",
      "url": "https://imdb.com/title/tt34611082"
    },
    {
      "name": "Ladies First",
      "category": "share",
      "url": "https://www.strem.io/s/movie/ladies-first"
    },
    {
      "name": "Comedy",
      "category": "Genres",
      "url": "stremio:///search?search=Comedy"
    },
    {
      "name": "Sacha Baron Cohen",
      "category": "Cast",
      "url": "stremio:///search?search=Sacha%20Baron%20Cohen"
    },
    {
      "name": "Rosamund Pike",
      "category": "Cast",
      "url": "stremio:///search?search=Rosamund%20Pike"
    },
    {
      "name": "Tom Davis",
      "category": "Cast",
      "url": "stremio:///search?search=Tom%20Davis"
    },
    {
      "name": "Emily Mortimer",
      "category": "Cast",
      "url": "stremio:///search?search=Emily%20Mortimer"
    },
    {
      "name": "Weruche Opia",
      "category": "Cast",
      "url": "stremio:///search?search=Weruche%20Opia"
    },
    {
      "name": "Charles Dance",
      "category": "Cast",
      "url": "stremio:///search?search=Charles%20Dance"
    },
    {
      "name": "Fiona Shaw",
      "category": "Cast",
      "url": "stremio:///search?search=Fiona%20Shaw"
    },
    {
      "name": "Richard E. Grant",
      "category": "Cast",
      "url": "stremio:///search?search=Richard%20E.%20Grant"
    },
    {
      "name": "Red Tennant",
      "category": "Cast",
      "url": "stremio:///search?search=Red%20Tennant"
    },
    {
      "name": "Kathryn Hunter",
      "category": "Cast",
      "url": "stremio:///search?search=Kathryn%20Hunter"
    }
  ],
  "behaviorHints": {
    "defaultVideoId": "tt34611082",
    "hasScheduledVideos": false
  },
  "trend": {
    "type": "stable",
    "value": 0,
    "display": "—",
    "bgColor": "yellow"
  },
  "accessTracking": {
    "lastAccessed": 1779733072318,
    "accessCount": 360,
    "firstAccessed": 1779638935879
  }
}
```

### Tekenfilms Catalog Item

```json
{
  "id": "tekenfilms:101-echte-dalmatiers-1996",
  "type": "movie",
  "name": "101 Echte Dalmatiërs",
  "poster": "https://image.tmdb.org/t/p/w500/gQ9W8qd8hbsIKuuz9Xa6x4IKhoP.jpg",
  "logo": "https://image.tmdb.org/t/p/w500/ft7g3jh3htanBxC3jMs5eLyNveS.png",
  "background": "https://image.tmdb.org/t/p/original/yqh3mb9jd3GTTs09ZlnW4mxS95z.jpg",
  "description": "De gemene Cruella de Vil is een mode-gigante met een gevaarlijke liefde voor bont. Cruella's mode-ontwerpster Anita en haar echtgenoot Roger zijn dolblij als hun dalmatiërs Pongo en Perdita de trotse ouders worden van een nest schattige puppies. Als Cruella hier van hoort, zet ze alles op alles om de vachtjes van de Dalmatiërs pups te pakken te krijgen voor haar nieuwe kledinglijn.",
  "releaseInfo": "1996"
}
```

## Meta Item Shape Examples

### TOP Streaming Meta Item

```json
{
  "id": "tt40792117",
  "type": "movie",
  "name": "The Crash",
  "description": "A teen slams her car into a building, killing her boyfriend and his friend. What seems like a tragic accident becomes a murder case.",
  "imdbRating": "6.6",
  "poster": "https://image.tmdb.org/t/p/w500/veskdPx4YUTmkrFrTs6zRJ8VV4E.jpg",
  "logo": "https://image.tmdb.org/t/p/w300/d5JOqqEYntVgRX3S8eMMqyEJuUo.png",
  "background": "https://image.tmdb.org/t/p/w1280/2iqLoDsatVBwAvHTEzI71p3qBe9.jpg",
  "releaseInfo": "2026",
  "runtime": "1h35min",
  "links": [
    {
      "name": "6.6",
      "category": "imdb",
      "url": "https://imdb.com/title/tt40792117"
    },
    {
      "name": "The Crash",
      "category": "share",
      "url": "https://www.strem.io/s/movie/the-crash"
    },
    {
      "name": "Documentary",
      "category": "Genres",
      "url": "stremio:///search?search=Documentary"
    },
    {
      "name": "Crime",
      "category": "Genres",
      "url": "stremio:///search?search=Crime"
    },
    {
      "name": "Mackenzie Shirilla",
      "category": "Cast",
      "url": "stremio:///search?search=Mackenzie%20Shirilla"
    },
    {
      "name": "Dominic Russo",
      "category": "Cast",
      "url": "stremio:///search?search=Dominic%20Russo"
    },
    {
      "name": "Davion Flanagan",
      "category": "Cast",
      "url": "stremio:///search?search=Davion%20Flanagan"
    },
    {
      "name": "Rosie Graham",
      "category": "Cast",
      "url": "stremio:///search?search=Rosie%20Graham"
    },
    {
      "name": "Bubba Turner",
      "category": "Cast",
      "url": "stremio:///search?search=Bubba%20Turner"
    },
    {
      "name": "Natalie Shirilla",
      "category": "Cast",
      "url": "stremio:///search?search=Natalie%20Shirilla"
    },
    {
      "name": "Steve Shirilla",
      "category": "Cast",
      "url": "stremio:///search?search=Steve%20Shirilla"
    },
    {
      "name": "Frank Russo",
      "category": "Cast",
      "url": "stremio:///search?search=Frank%20Russo"
    },
    {
      "name": "Christine Russo",
      "category": "Cast",
      "url": "stremio:///search?search=Christine%20Russo"
    },
    {
      "name": "Davyne Flanagan",
      "category": "Cast",
      "url": "stremio:///search?search=Davyne%20Flanagan"
    }
  ],
  "behaviorHints": {
    "defaultVideoId": "tt40792117",
    "hasScheduledVideos": false
  },
  "trend": {
    "type": "stable",
    "value": 0,
    "display": "—",
    "bgColor": "yellow"
  },
  "accessTracking": {
    "lastAccessed": 1779746524874,
    "accessCount": 2087,
    "firstAccessed": 1779654965719
  }
}
```

### Tekenfilms Meta Item

```json
{
  "id": "tekenfilms:101-echte-dalmatiers-1996",
  "type": "movie",
  "name": "101 Echte Dalmatiërs",
  "originalName": "101 Dalmatians",
  "videoFilename": "101 Echte Dalmatiërs.m4v",
  "releaseInfo": "1996",
  "released": "1996-11-27T00:00:00.000Z",
  "runtime": "103 min",
  "poster": "https://image.tmdb.org/t/p/w500/gQ9W8qd8hbsIKuuz9Xa6x4IKhoP.jpg",
  "logo": "https://image.tmdb.org/t/p/w500/ft7g3jh3htanBxC3jMs5eLyNveS.png",
  "background": "https://image.tmdb.org/t/p/original/yqh3mb9jd3GTTs09ZlnW4mxS95z.jpg",
  "description": "De gemene Cruella de Vil is een mode-gigante met een gevaarlijke liefde voor bont. Cruella's mode-ontwerpster Anita en haar echtgenoot Roger zijn dolblij als hun dalmatiërs Pongo en Perdita de trotse ouders worden van een nest schattige puppies. Als Cruella hier van hoort, zet ze alles op alles om de vachtjes van de Dalmatiërs pups te pakken te krijgen voor haar nieuwe kledinglijn.",
  "genres": [
    "Familie",
    "Komedie"
  ],
  "cast": [
    "Glenn Close",
    "Jeff Daniels",
    "Joely Richardson",
    "Joan Plowright",
    "Hugh Laurie",
    "Mark Williams",
    "John Shrapnel",
    "Tim McInnerny"
  ],
  "director": [
    "Stephen Herek"
  ],
  "tmdbId": 11674,
  "imdbId": "tt0115433",
  "behaviorHints": {
    "defaultVideoId": "tekenfilms:101-echte-dalmatiers-1996"
  }
}
```

## Side-by-Side Observations

| Concern | TOP Streaming behavior | Tekenfilms behavior | Analysis |
|---|---|---|---|
| Catalog richness | Catalog items include `imdbRating`, `runtime`, `links`, `logo`, and `background`. | Catalog items include `id`, `type`, `name`, `poster`, `logo`, `background`, `description`, `releaseInfo`. | If Stremio renders only catalog metadata in a rail, TOP has more display/search affordances before meta is opened. |
| Links | Emits IMDb, Stremio share, genre, and cast links. | No `links` in catalog or meta. | This is a likely difference if you notice missing clickable chips/metadata sections. |
| Ratings | Emits `imdbRating`. | Does not fetch or emit ratings. | Add rating fetch/enrichment if rating display matters. TMDB details may expose `vote_average`, but Stremio commonly recognizes `imdbRating`. |
| Runtime | Catalog and meta include compact runtime like `1h34min`. | Meta has runtime like `102 min`; catalog omits runtime. | Add runtime to catalog and optionally format closer to Stremio/Cinemeta style if rail cards/details need it. |
| IDs | IMDb IDs are primary. | Local ids are primary; IMDb/TMDB ids are secondary meta fields. | Local ids are fine for a private addon, but IMDb IDs improve compatibility with generic Stremio expectations and cross-addon metadata linking. |
| Logo image size | Uses TMDB `w300` for logos. | Uses TMDB `w500` for logos. | Both are valid URLs, but if Stremio expects smaller transparent logos, `w300` may be closer to common practice. |
| Addon manifest assets | Manifest has addon `logo` and `background`. | Manifest currently lacks addon-level `logo` / `background`. | This affects addon presentation, not movie items. |
| Stream support | Manifest has `catalog`, `meta` only. | Manifest has `catalog`, `meta`, `stream`. | Expected: TOP is discovery-only; Tekenfilms is playable. |

## External Catalog Items

| # | id | name | releaseInfo | runtime | imdbRating | has logo | links |
|---:|---|---|---:|---|---:|---:|---:|
| 1 | `tt34611082` | Ladies First | 2026 | 1h34min | 5.8 | yes | 13 |
| 2 | `tt40792117` | The Crash | 2026 | 1h35min | 6.6 | yes | 14 |
| 3 | `tt12299608` | Mickey 17 | 2025 | 2h17min | 6.7 | yes | 15 |
| 4 | `tt14147224` | Mindcage | 2022 | 1h37min | 4.6 | yes | 15 |
| 5 | `tt7178640` | Superintelligence | 2020 | 1h46min | 5.4 | yes | 15 |
| 6 | `tt29552248` | Swapped | 2026 | 1h42min | 7.3 | yes | 16 |
| 7 | `tt16431404` | Apex | 2026 | 1h36min | 6.1 | yes | 14 |
| 8 | `tt33100314` | Remarkably Bright Creatures | 2026 | 1h54min | 7.7 | yes | 14 |
| 9 | `tt0388125` | In Her Shoes | 2005 | 2h10min | 6.5 | yes | 15 |
| 10 | `tt0312528` | The Cat in the Hat | 2003 | 1h22min | 4.1 | yes | 16 |
| 11 | `tt40898187` | The Roast of Kevin Hart | 2026 | 2h52min | 6.2 | yes | 13 |

## Tekenfilms Catalog Items

| # | id | name | releaseInfo | runtime in catalog | has logo | has background | meta runtime | meta IMDb/TMDB |
|---:|---|---|---:|---|---:|---:|---|---|
| 1 | `tekenfilms:101-echte-dalmatiers-1996` | 101 Echte Dalmatiërs | 1996 |  | yes | yes | 103 min | tt0115433, tmdb:11674 |
| 2 | `tekenfilms:aladdin-1992` | Aladdin | 1992 |  | yes | yes | 90 min | tt0103639, tmdb:812 |
| 3 | `tekenfilms:alice-in-wonderland-1951` | Alice in Wonderland | 1951 |  | yes | yes | 75 min | tt0043274, tmdb:12092 |
| 4 | `tekenfilms:assepoester-1950` | Assepoester | 1950 |  | yes | yes | 74 min | tt0042332, tmdb:11224 |
| 5 | `tekenfilms:atlantis-de-verzonken-stad-2001` | Atlantis: De Verzonken Stad | 2001 |  | yes | yes | 95 min | tt0230011, tmdb:10865 |
| 6 | `tekenfilms:bambi-1942` | Bambi | 1942 |  | yes | yes | 70 min | tt0034492, tmdb:3170 |
| 7 | `tekenfilms:belle-en-het-beest-1991` | Belle en het Beest | 1991 |  | yes | yes | 85 min | tt0101414, tmdb:10020 |
| 8 | `tekenfilms:bolt-2008` | Bolt | 2008 |  | yes | yes | 98 min | tt0397892, tmdb:13053 |
| 9 | `tekenfilms:brother-bear-2003` | Brother Bear | 2003 |  | yes | yes | 85 min | tt0328880, tmdb:10009 |
| 10 | `tekenfilms:cars-2006` | Cars | 2006 |  | yes | yes | 117 min | tt0317219, tmdb:920 |
| 11 | `tekenfilms:chicken-little-2005` | Chicken Little | 2005 |  | yes | yes | 81 min | tt0371606, tmdb:9982 |
| 12 | `tekenfilms:de-aristokatten-1970` | De Aristokatten | 1970 |  | yes | yes | 78 min | tt0065421, tmdb:10112 |
| 13 | `tekenfilms:de-avonturen-van-ichabod-en-meneer-pad-1949` | De Avonturen van Ichabod en Meneer Pad | 1949 |  | yes | yes | 68 min | tt0041094, tmdb:13465 |
| 14 | `tekenfilms:de-drie-caballeros-1944` | De Drie Caballeros | 1944 |  | yes | yes | 71 min | tt0038166, tmdb:15947 |
| 15 | `tekenfilms:de-kleine-zeemeermin-1989` | De kleine zeemeermin | 1989 |  | yes | yes | 82 min | tt0097757, tmdb:10144 |
| 16 | `tekenfilms:de-klokkenluider-van-de-notre-dame-1996` | De Klokkenluider van de Notre Dame | 1996 |  | yes | yes | 91 min | tt0116583, tmdb:10545 |
| 17 | `tekenfilms:de-prinses-en-de-kikker-2009` | De prinses en de kikker | 2009 |  | yes | yes | 98 min | tt0780521, tmdb:10198 |
| 18 | `tekenfilms:de-reddertjes-1977` | De Reddertjes | 1977 |  | yes | yes | 77 min | tt0076618, tmdb:11319 |
| 19 | `tekenfilms:de-reddertjes-in-kangoeroeland-1990` | De Reddertjes in Kangoeroeland | 1990 |  | yes | yes | 74 min | tt0100477, tmdb:11135 |
| 20 | `tekenfilms:de-speurneuzen-1986` | De Speurneuzen | 1986 |  | yes | yes | 74 min | tt0091149, tmdb:9994 |
| 21 | `tekenfilms:dinosaur-2000` | Dinosaur | 2000 |  | yes | yes | 82 min | tt0130623, tmdb:10567 |
| 22 | `tekenfilms:doornroosje-1959` | Doornroosje | 1959 |  | yes | yes | 75 min | tt0053285, tmdb:10882 |
| 23 | `tekenfilms:dombo-1941` | Dombo | 1941 |  | yes | yes | 64 min | tt0033563, tmdb:11360 |
| 24 | `tekenfilms:fantasia-1940` | Fantasia | 1940 |  | yes | yes | 119 min | tt0032455, tmdb:756 |
| 25 | `tekenfilms:frank-en-frey-1981` | Frank en Frey | 1981 |  | yes | yes | 82 min | tt0082406, tmdb:10948 |
| 26 | `tekenfilms:frozen-2013` | Frozen | 2013 |  | yes | yes | 102 min | tt2294629, tmdb:109445 |
| 27 | `tekenfilms:hercules-1997` | Hercules | 1997 |  | yes | yes | 93 min | tt0119282, tmdb:11970 |
| 28 | `tekenfilms:het-grote-verhaal-van-winnie-de-poeh-1977` | Het Grote Verhaal van Winnie de Poeh | 1977 |  | yes | yes | 74 min | tt0076363, tmdb:250480 |
| 29 | `tekenfilms:hoe-tem-je-een-draak-2-2014` | Hoe Tem Je Een Draak 2 | 2014 |  | yes | yes | 105 min | tt1646971, tmdb:82702 |
| 30 | `tekenfilms:ice-age-the-meltdown-2006` | Ice Age: The Meltdown | 2006 |  | yes | yes | 91 min | tt0438097, tmdb:950 |
| 31 | `tekenfilms:ice-age-2002` | Ice Age | 2002 |  | yes | yes | 81 min | tt0268380, tmdb:425 |
| 32 | `tekenfilms:ice-age-3-dawn-of-the-dinosaurs-2009` | Ice Age 3: Dawn of the Dinosaurs | 2009 |  | yes | yes | 94 min | tt1080016, tmdb:8355 |
| 33 | `tekenfilms:jungle-boek-1967` | Jungle Boek | 1967 |  | yes | yes | 78 min | tt0061852, tmdb:9325 |
| 34 | `tekenfilms:the-jungle-book-1994` | The Jungle Book | 1994 |  | yes | yes | 111 min | tt0110213, tmdb:10714 |
| 35 | `tekenfilms:keizer-kuzco-2000` | Keizer Kuzco | 2000 |  | yes | yes | 78 min | tt0120917, tmdb:11688 |
| 36 | `tekenfilms:lady-en-de-vagebond-1955` | Lady en de Vagebond | 1955 |  | yes | yes | 76 min | tt0048280, tmdb:10340 |
| 37 | `tekenfilms:lilo-stitch-2002` | Lilo & Stitch | 2002 |  | yes | yes | 85 min | tt0275847, tmdb:11544 |
| 38 | `tekenfilms:make-mine-music-1946` | Make Mine Music | 1946 |  | yes | yes | 75 min | tt0038718, tmdb:20343 |
| 39 | `tekenfilms:mary-poppins-1964` | Mary Poppins | 1964 |  | yes | yes | 139 min | tt0058331, tmdb:433 |
| 40 | `tekenfilms:meet-the-robinsons-2007` | Meet the Robinsons | 2007 |  | yes | yes | 91 min | tt0396555, tmdb:1267 |
| 41 | `tekenfilms:melody-time-1948` | Melody Time | 1948 |  | yes | yes | 75 min | tt0040580, tmdb:13757 |
| 42 | `tekenfilms:merlijn-de-tovenaar-1963` | Merlijn de Tovenaar | 1963 |  | yes | yes | 79 min | tt0057546, tmdb:9078 |
| 43 | `tekenfilms:monsters-en-co-2001` | Monsters en Co. | 2001 |  | yes | yes | 92 min | tt0198781, tmdb:585 |
| 44 | `tekenfilms:mulan-1998` | Mulan | 1998 |  | yes | yes | 88 min | tt0120762, tmdb:10674 |
| 45 | `tekenfilms:finding-nemo-2003` | Finding Nemo | 2003 |  | yes | yes | 100 min | tt0266543, tmdb:12 |
| 46 | `tekenfilms:oliver-co-1988` | Oliver & Co | 1988 |  | yes | yes | 74 min | tt0095776, tmdb:12233 |
| 47 | `tekenfilms:paniek-op-de-prairie-2004` | Paniek op de Prairie | 2004 |  | yes | yes | 76 min | tt0299172, tmdb:13700 |
| 48 | `tekenfilms:peter-pan-1953` | Peter Pan | 1953 |  | yes | yes | 76 min | tt0046183, tmdb:10693 |
| 49 | `tekenfilms:peter-en-de-draak-1977` | Peter en de Draak | 1977 |  | yes | yes | 128 min | tt0076538, tmdb:11114 |
| 50 | `tekenfilms:pinokkio-1940` | Pinokkio | 1940 |  | yes | yes | 88 min | tt0032910, tmdb:10895 |
| 51 | `tekenfilms:pocahontas-1995` | Pocahontas | 1995 |  | yes | yes | 81 min | tt0114148, tmdb:10530 |
| 52 | `tekenfilms:poehs-lollifanten-film-2005` | Poeh's Lollifanten Film | 2005 |  | yes | yes | 68 min | tt0407121, tmdb:13682 |
| 53 | `tekenfilms:rapunzel-2010` | Rapunzel | 2010 |  | yes | yes | 102 min | tt0398286, tmdb:38757 |
| 54 | `tekenfilms:robin-hood-1973` | Robin Hood | 1973 |  | yes | yes | 83 min | tt0070608, tmdb:11886 |
| 55 | `tekenfilms:saludos-amigos-1942` | Saludos Amigos | 1942 |  | yes | yes | 41 min | tt0036326, tmdb:14906 |
| 56 | `tekenfilms:shrek-2-2004` | Shrek 2 | 2004 |  | yes | yes | 93 min | tt0298148, tmdb:809 |
| 57 | `tekenfilms:shrek-2001` | Shrek | 2001 |  | yes | yes | 90 min | tt0126029, tmdb:808 |
| 58 | `tekenfilms:shrek-de-derde-2007` | Shrek de Derde | 2007 |  | yes | yes | 93 min | tt0413267, tmdb:810 |
| 59 | `tekenfilms:shrek-voor-eeuwig-en-altijd-2010` | Shrek voor Eeuwig en Altijd | 2010 |  | yes | yes | 93 min | tt0892791, tmdb:10192 |
| 60 | `tekenfilms:sneeuwwitje-en-de-zeven-dwergen-1938` | Sneeuwwitje en de Zeven Dwergen | 1938 |  | yes | yes | 83 min | tt0029583, tmdb:408 |
| 61 | `tekenfilms:suske-en-wiske-de-duistere-diamant-2004` | Suske en Wiske: De duistere diamant | 2004 |  | no | yes | 85 min | tt0289933, tmdb:56344 |
| 62 | `tekenfilms:tarzan-1999` | Tarzan | 1999 |  | yes | yes | 88 min | tt0120855, tmdb:37135 |
| 63 | `tekenfilms:the-incredibles-2004` | The Incredibles | 2004 |  | yes | yes | 115 min | tt0317705, tmdb:9806 |
| 64 | `tekenfilms:the-wild-2006` | The Wild | 2006 |  | yes | yes | 94 min | tt0405469, tmdb:9904 |
| 65 | `tekenfilms:de-leeuwenkoning-1994` | De Leeuwenkoning | 1994 |  | yes | yes | 89 min | tt0110357, tmdb:8587 |
| 66 | `tekenfilms:de-leeuwenkoning-2-simbas-trots-1998` | De Leeuwenkoning 2: Simba's Trots | 1998 |  | yes | yes | 81 min | tt0120131, tmdb:9732 |
| 67 | `tekenfilms:the-lion-king-3-hakuna-matata-2004` | The Lion King 3: Hakuna Matata | 2004 |  | yes | yes | 77 min | tt0318403, tmdb:11430 |
| 68 | `tekenfilms:teigetjes-film-2000` | Teigetjes Film | 2000 |  | yes | yes | 77 min | tt0220099, tmdb:15655 |
| 69 | `tekenfilms:tinkerbell-2008` | TinkerBell | 2008 |  | yes | yes | 78 min | tt0823671, tmdb:13179 |
| 70 | `tekenfilms:toy-story-1995` | Toy Story | 1995 |  | yes | yes | 81 min | tt0114709, tmdb:862 |
| 71 | `tekenfilms:toy-story-2-1999` | Toy Story 2 | 1999 |  | yes | yes | 92 min | tt0120363, tmdb:863 |
| 72 | `tekenfilms:toy-story-3-2010` | Toy Story 3 | 2010 |  | yes | yes | 103 min | tt0435761, tmdb:10193 |
| 73 | `tekenfilms:piratenplaneet-de-schat-van-kapitein-flint-2002` | Piratenplaneet: De Schat van Kapitein Flint | 2002 |  | yes | yes | 95 min | tt0133240, tmdb:9016 |
| 74 | `tekenfilms:verwisseld-2026` | Verwisseld | 2026 |  | yes | yes | 102 min | tt29552248, tmdb:1007757 |
| 75 | `tekenfilms:vrij-en-vrolijk-1947` | Vrij En Vrolijk | 1947 |  | yes | yes | 73 min | tt0039404, tmdb:46929 |

## Recommended Follow-Ups

1. Add `runtime` to Tekenfilms catalog metas, since it already exists in full meta.
2. Add `links` for genres, cast/director, and IMDb when `imdbId` is available.
3. Consider adding `imdbRating` or TMDB rating enrichment if rating display is desired.
4. Consider using IMDb ids as Stremio ids, or adding compatibility aliases, if cross-addon metadata behavior matters.
5. Add addon-level `logo` and `background` to the Tekenfilms manifest for better addon presentation.
