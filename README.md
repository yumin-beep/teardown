# Teardown

**See what it is made of. Sort it where you are.**

Which bin a thing goes in depends on where you are standing, and on layers you cannot see. Teardown takes an everyday object apart in 3D, shows how four cities' official rules sort each part, turns your own city's rules into exact moves, and then lets you practise until every part lands right.

Built for Arbiter Hacks V1, Theme track: Rethinking Waste.

## The claim

**Sorting fails at the seams.** The numbers below are computed in the page from `data/cities.json` (see `src/logic.js`), so they cannot drift from the rule table.

| What four objects in four cities show | Number |
|---|---|
| Where you stand decides the bin | 3 of 4 objects are sorted differently from city to city (coffee cup 4 ways, bottle at least 3 ways, pizza box 3 ways). For those three objects, 33 of the 36 possible moves between two cities change at least one habit |
| Guides go quiet where an object comes apart | Of the 44 pieces you can separate by hand (11 pieces, in each of four cities), 16 have no rule of their own in the official guide: 13 use the nearest listed item, 3 have no rule. 14 of the 16 are in the coffee cup and the pizza box |
| Objects that go back whole work everywhere | The smartphone has one answer in all four cities and no unnamed piece. Berlin's deposit bottle is one move too |

Two cities give "the same answer" when they make the same piles and each pile meets the same kind of stream (recycling, organics, take-back, residual waste). A guide's silence is not counted as a different answer: San Francisco's guide does not name the bottle label, so its answer may match Seoul's, and the bottle is counted as "at least three ways". The other 20 of the 64 part rules are layers bonded to another part (the cup's lining, the bottle's tamper ring, a phone's glass, board and battery): they go wherever their host goes, and 16 of those 20 are Teardown's own note, not a sentence from a guide.

## Five steps

1. **Look inside.** A cross-section shows the hidden layer: the plastic film bonded inside a paper cup, the battery glued under a phone's glass.
2. **Take it apart.** The parts separate, each labelled with its material. Parts that cannot be separated at home peel out to show they exist, then settle back.
3. **Four cities.** The four places first appear on a globe. Then Seoul, Berlin, San Francisco and Tokyo (Shinjuku) sort the same object side by side. Each view lists every part, the bins needed, how many parts are left for residual waste and how many the guide does not name. Behind the bins stands that city's street, drawn from the recycling figure the city publishes about itself (see "The street"). Click any part for the city's own sentence, in the original language, with a link.
4. **Your city.** For the phone, the card first asks whether it still works (see "A phone that still works"). Pick where you sort. The view flies down to that city on the map, and the rules become moves: how many, which parts go together, what stays attached. Learned to sort somewhere else? Set "learned in" (top right): the move is drawn on the globe and the card lists only the habits that change. Parts one of the two guides is silent on are listed as not compared.
5. **Your turn.** Every bin your city has, one part at a time. Only the first try is scored, and a wrong answer is corrected with the city's own rule and a sentence on what that choice would do at the kerb. One animal sits beside the bins, a different one in each city: a right first try makes it hop, a wrong one makes it droop (see "The animal beside the bins"). Each run is logged in the browser and can be exported as CSV.

**Guess first.** The first screen of every object has a "Guess first" button: sort the object before the page has shown you any rule. That run is marked as the baseline. Steps 3 and 4 show the rules, so any run after them is marked "after".

**What we found** (button, top right) puts the whole table together and says what each reader can do with it: a resident, someone running a building or a class, the people who write the guide (gap list export), and the people who design the object.

## The map

The four cities are places, not labels. A globe shows where each one is, with a route from each of the other three into the city you sort in. Each route carries the number of habits that change for the object on screen. From there the view flies down to the city: coastline, rivers, built-up area, main roads and railways. The city card gives the coordinates, who writes the rules and when they were read, the city's streams, and how the object on screen and all four objects fare there. The round picture in every city header opens the same map, and so does the Map button. The map can be dragged and zoomed.

Everything written on the map is computed from the rule table by `src/logic.js`, with one exception: the city card ends with the number that city publishes about itself (see "What the cities count"). Shapes come from Natural Earth (public domain). No country borders and no sea names are drawn.

## The street

Every city view has that city's street behind the bins, and the street is a picture of one number: the recycling figure the city publishes about itself. The kerb has 20 bays, one for every 5 %.

| Kerb bay | Meaning |
|---|---|
| Planted (bushes, trees) | The share the city counts as recycled, recovered or collected as resources |
| Amber bags | The share burned for energy or recovered in other ways (Berlin only, because only Berlin's balance prints it apart) |
| Red bags | The rest |

The windows of the houses are lit up to the same share. The houses differ by city (flat roofs with water tanks in Seoul, mansard roofs in Berlin, gabled houses with bay windows in San Francisco, signs and overhead wires in Shinjuku), so a street is recognised before its name is read.

| City | Street figure | Bays (planted / amber / red) | What it counts |
|---|---|---|---|
| Seoul | 64 %, 2020 | 13 / 0 / 7 | Household waste recycled, as the city's notice counts it |
| Berlin | 30.7 %, 2021 | 6 / 13 / 1 | Material recycling 30.7 %, energy and other recovery 64.1 %, disposal 0.5 %, water loss 4.6 % (Table 1 of the waste balance) |
| San Francisco | 35.4 %, 2025 | 7 / 0 / 13 | Recology's recovery rate |
| Tokyo (Shinjuku) | 23.5 %, fiscal 2024 | 5 / 0 / 15 | **Worked out by Teardown**: 19,882 t of resources ÷ (64,703 t of waste + 19,882 t of resources), the ward's own formula for 資源化率 from its 2013 plan. The ward prints no rate for fiscal 2024 |

The street appears in the four-cities view (with a bar and the figure under each city's list), in "Your city" (with a legend card), in "Your turn", on the map's city card and in "What we found". Wherever it appears it carries its figure, its year and what the figure counts. The four cities count four different things, so the streets are four pictures of four counts and not a ranking. Bays are rounded by largest remainder, so each street always adds up to 20.

## The animal beside the bins

In step 5 one animal sits beside the bins, a different one in each city. A right first try makes it hop and smile; a wrong one makes it droop; a run with no wrong first try ends with a spin. The same animal appears next to the written feedback, so the reward is also there on a small screen. It is drawn like the bins and the street, each in its own natural colours.

Each animal was picked because a study found plastic inside that kind of animal in the city's own waters. The result panel gives the finding in the source's words, with the link.

| City | Animal | Finding, word for word |
|---|---|---|
| Seoul | Sea turtle, Korea's coast | KIOST, reported 2022: "국내 연안에서 발견된 바다거북 폐사체 34마리 중 28마리(약 82.3%)에서 총 1280개(118g) 플라스틱 쓰레기가 발견됐다." |
| Tokyo (Shinjuku) | Japanese anchovy, Tokyo Bay | Tanaka & Takada 2016: "Plastic was detected in 49 out of 64 fish (77%), with 2.3 pieces on average and up to 15 pieces per individual." |
| San Francisco | Fish of San Francisco Bay | San Francisco Estuary Institute 2021: "We found microplastics and other anthropogenic microdebris ("microdebris") in all sample types." Fish were one of the sample types. |
| Berlin | Northern fulmar, Germany's North Sea coast | Umweltbundesamt 2025: "Im aktuellen 5-Jahres-Zeitraum (2019–2023) hatten 89 % der 93 untersuchten Eissturmvögel in Deutschland Plastik im Magen" |

What the animal does not say: that a wrong bin reaches it. In these four cities a wrongly sorted part goes to burning, landfill or a contaminated stream, not to the sea. The sources name litter and packaging washed in from land, drains and stormwater, and fishing gear. The panel says so next to the quote. Berlin is not on the coast; its animal is from the nearest German sea with a published indicator.

After a wrong answer the feedback says what that choice would do: the part lands in a collection stream that does not take it, or a part the city collects goes to residual waste. This is read from the two bins in the rule table. It is a classification, not a measurement, and where the guide does not name the part the sentence says so.

The animal shows the visitor's own run. The street shows the city's own figure. Neither is a measurement by Teardown of how well a city sorts.

## What the cities count

Each city card carries one figure from the city's own publication, with its year, what it counts and a link to the page. The four figures count four different things, so Teardown never ranks them: each is shown with its own year and definition, and the streets drawn from them say "four different counts, not a ranking" wherever they stand side by side.

| City | Figure | Year | What it counts | Read on |
|---|---|---|---|---|
| Seoul | 64 % | 2020 | Recycled share of all household waste generated (2,033,960 of 3,177,620 t) | Seoul Metropolitan Government, notice of 2 Nov 2023 |
| Berlin | 30.7 % | 2021 | Material recycling only, of waste from households and small businesses (436,426 of 1,419,994 t). Burning for energy and other recovery are counted apart: 64.1 % | Land Berlin, Abfallbilanz 2021 |
| San Francisco | 35.4 % | 2025 | Recovery rate reported by Recology, the city's collection company. The city's rates office notes that the method has changed over time | Refuse Rate Board hearing, 13 Mar 2026 |
| Tokyo (Shinjuku) | 503 g | fiscal 2024 | Waste collected by the ward per resident per day (ward-collected waste ÷ residents on 1 January ÷ 365) | Shinjuku City, waste and resource collection table |

Seoul counts everything sent to recycling, Berlin leaves out what is burned for energy, San Francisco reports its hauler's rate, and Shinjuku sets its targets in grams per resident. For Shinjuku's street, Teardown applies the ward's own older formula to the ward's fiscal 2024 tonnages and labels the result as worked out. That is why the practice log, not these figures, is Teardown's measure: whether a part lands in the bin the local rule names is the one thing that means the same in all four cities.

## A phone that still works

The four cities agree on a finished phone: keep it whole and hand it in. They do not agree on a phone that still works. "Your city" asks first whether the phone still works and then shows the way the city's own pages name, stop by stop, with the places and the sentence.

| City | Still works | Finished | Who erases the data |
|---|---|---|---|
| Seoul | No reuse channel named. "Donating" a phone means donating its metal: it is shredded and part of the proceeds goes to charity | Phone collection boxes at subway ticket gates, community service centres, large public buildings and post offices | The city's plant shreds every phone |
| Berlin | Pass it on: BSR's online Verschenkmarkt, or NochMall (re-use drop-off at 3 of the 14 Recyclinghöfe) | Any of the 14 Recyclinghöfe, free; larger shops take devices back | Not mentioned in the pages read |
| San Francisco | Donate it: Goodwill, 121 Wisconsin St, takes phones working or not | Eight Redwood Materials battery bins, Best Buy, or the Recology transfer station. Never in a bin | Goodwill says it destroys the data; the city pages do not mention it |
| Tokyo (Shinjuku) | No reuse channel named; the ward describes collection only | 12 collection boxes, 7 staffed counters, carrier shops | The person handing it in |

In a city that names a way to pass a working phone on, the 3D view keeps the phone whole and shows no bin until the visitor says it is finished. Addresses are given as text. They are not pinned on the map, because no verified coordinates were available for them.

## How it would be measured

The measure is first-try accuracy per part: a baseline run started from "Guess first", before the page has shown that city's rules for the object, against runs after the rules were shown. The log stays in the browser (`localStorage`), one row per answer: time, run, `seen_rules` (0 = baseline, 1 = after), city, object, part, choice, right answer, correct, `basis`, and `effect` (for a wrong first try: `contaminates:<bin>` or `lost:<bin>`).

Three things keep the score honest:

- A part the guide does not name is scored against the nearest listed item, says so in the feedback, and is reported on its own line ("Rules the guide states: 2 of 2 · nearest listed item (≈): 1 of 3"). The `basis` column lets a pilot count stated rules only.
- Where two official sources disagree, both answers count. Seoul's 2024 page says to close the cap on a clear PET bottle; the Ministry of Environment guide's FAQ (p.23) says to take caps off where possible.
- From the second run on, the order of the parts is shuffled.

No pilot has been run yet, so this README reports no result.

## What Teardown does not claim

- It shows which stream a part enters under the city's written rule. It does not measure how much of that stream is finally recycled.
- Counts are parts, not weight.
- Four objects in four cities are a sample, not a survey.
- "Residual waste" is the bin for whatever is not collected separately (pay-as-you-throw bag, Restmüll, Landfill cart, Burnable).
- The animal and the "At the kerb" sentence show one visitor's answers against the written rules. Teardown measures no city-level recycling or contamination rate. The figure on each city card is the city's own published number, quoted with its year and what it counts; the four are not comparable and are not ranked. Each street is a drawing of that figure, not a photograph or a survey of real streets, and Shinjuku's 23.5 % is Teardown's arithmetic on the ward's published tonnages.
- The phone's way onward repeats what each city's pages say on the day they were read. Opening hours, stock and acceptance at each place were not checked on site.
- Where a guide does not name a part, Teardown says so: `≈` marks a rule borrowed from the nearest listed item, and a part with no rule is set down on a marked empty spot, never guessed into a bin.

## Data

Every rule in `data/cities.json` carries the quote, an English gloss, the URL, the source name and a basis tag (`stated`, `nearest`, `bonded`, `not_stated`). 64 part rules: 28 stated, 20 attached parts that go with their host, 13 nearest listed item, 3 no rule found. A rule may list another accepted bin under `also` when official sources differ. Bins carry a `fate` (recycle, organic, return, residual) and a `stream` used to compare habits between cities. Sources, reading dates and open gaps are in [data/SOURCES.md](data/SOURCES.md). English glosses are my translations, not official text.

Each city also has a `figure` (the number it publishes about itself: value, period, what it counts, source) and an `after` block for the phone (the way onward if it still works, if it is finished, what happens next, and who erases the data). Both are quoted from the pages listed in `data/SOURCES.md`. `figure.street` holds the shares the street is drawn from; they are the same published numbers, except Shinjuku's, which is computed and says so in its `computed` field.

Adding a city is one more block in that file: its bins, and one rule per part.

The map shapes are in `data/geo.json` (632 KB, about 240 KB gzipped), built by `tools/build_geo.py` from Natural Earth vector data: coastlines, lakes, rivers, built-up areas, main roads, railways and a few neighbouring town names, at three levels of detail (world, a region around each city, the metro area). Each city's `lat` and `lon` in `cities.json` is an approximate city-centre point entered by hand, used only to place the pin.

## How it is built

- Plain HTML and ES modules, no build step, no server. [three.js](https://threejs.org) r170 (MIT) is vendored in `vendor/`.
- All four models are generated in code (`src/models.js`): lathe profiles with real wall thickness, corrugation flutes, a petaloid bottle base, a knurled cap, a rounded phone frame with a camera bump. No downloaded meshes.
- X-ray look: translucent physical material with a fresnel rim, edge lines and bloom. Each city view has its own renderer; one shared camera keeps them in sync. The cross-section is a clipping plane swept through the object.
- The map (`src/globe.js`) is a 2D canvas with its own perspective camera: no map service, no tiles, no API key. Shapes are projected from latitude and longitude whenever the camera moves, clipped at the horizon, and the still picture is cached. Flights follow the great circle between two cities. With "reduce motion" set in the system, the automatic flights are skipped.
- The streets and the animals are built in code too (`src/street.js`, `src/friends.js`): merged box, gable and mansard geometry for the houses, lathe-turned sacks, and animals made of a few faceted spheres and cones with edge lines. No downloaded meshes or textures.
- `src/logic.js` holds everything that is concluded from the data (answers per object, piles per city, habits that change, moves between cities, practice scoring, what a wrong answer does at the kerb, the kerb bays of each street, the baseline flag, the log). It has no rendering code.

## Run it

```
python3 -m http.server 8000
# open http://localhost:8000/?o=coffee_cup&c=sf     objects: coffee_cup, pet_bottle, pizza_box, smartphone
#                                                   cities: seoul, berlin, sf, tokyo   modes: &m=city, &m=practice
```

## Licence

Code: MIT. three.js: MIT (see `vendor/three.LICENSE`). Map shapes: made with Natural Earth, free vector map data at naturalearthdata.com (public domain). Quoted rule text belongs to the cited authorities and is quoted for reference.
