# City rule sources (Teardown)

Every rule in cities.json carries its quote, URL and basis: `stated` (the item is named), `nearest` (closest named item; shown as such in the app), `bonded` (a layer that can't be separated at home and goes with its host part), `not_stated` (shown as a grey "?" bin).

| City | Source | Checked |
|---|---|---|
| Seoul | Ministry of Environment, 재활용품 분리배출 가이드라인 (copy hosted by Korea University) | 2026-11-01 (Bunri data) |
| Berlin | Berlin.de, Bezirk Neukölln "Null Restmüll" sorting poster (PDF) | 2026-11-15 |
| San Francisco | Recology San Francisco "What Goes Where"; SF Environment trilingual recycling/compost/landfill posters | 2026-11-15 |
| Tokyo (Shinjuku) | Shinjuku City 燃やすごみの出し方 (updated 2026-04-03); 資源・ごみの分け方と出し方 (PDF) | 2026-11-15 |

Added 2026-11-15 for the bottle, pizza box and phone:

| City | Extra sources | Checked |
|---|---|---|
| Seoul | Seoul Metropolitan Government, 2024-11-08 (clear PET rule) https://news.seoul.go.kr/env/archives/560708 ; MoE guide p.12, p.14, p.30, p.33, p.34 | 2026-11-15 |
| Berlin | BSR Abfall-ABC item pages (bsr.de, read 17:35 KST; raw notes kept privately); Bezirksamt Mitte "Fit in Sachen Müll"; Bezirksamt Charlottenburg-Wilmersdorf Abfall page (deposit text dates from 2003) | 2026-11-15 |
| San Francisco | Recology "Universal & Electronic Waste"; SF Environment "Household battery recycling" | 2026-11-15 |
| Tokyo (Shinjuku) | 使用済小型電子機器等の出し方 (updated 2019-04-01) | 2026-11-15 |

How a rule is tagged: `stated` = the source names the item or its exact category; `nearest` = the item is not named and we use the closest listed item (the panel says which); `bonded` = the part cannot be separated at home, or the source says to leave it on, so it goes with its host; `not_stated` = nothing found, shown as a grey "?" bin.

Review fixes (2026-11-15, independent review v1): Berlin deposit bottle now cites Verbraucherzentrale NRW (Stand 2026-04-21) instead of a 2003 district text; Berlin label and cap stay with the deposit bottle (logo/barcode needed for return; EU Directive 2019/904 Art. 6 tethered caps); Seoul label, pizza lid and pizza base downgraded to `nearest` with the exact page text; SF battery quote from SFRecycles battery-embedded-products; Berlin phone battery cites BSR's Smartphone page (BSR is silent on built-in batteries).

Berlin deposit bottle, legal basis: VerpackG § 31 was replaced on 11.08.2026 by the VerpackDG; its § 46(2) (lxgesetze.de/verpackdg/46, "Vom 13.7.2026") keeps the take-back duty by material type, limited to brands for shops under 200 m². The EU tethered-cap quote was checked against EUR-Lex CELEX 32019L0904 (Art. 6(1), applies from 3 July 2024).

Seoul PET cap: Seoul's 2024 page says close the cap on the crushed bottle; the MoE guide's FAQ (p.23) says remove labels and caps where possible. The sources differ; Teardown follows the newer Seoul page.

Open gaps: Tokyo cup sleeve and stirrer; San Francisco bottle label; Berlin greasy pizza base (BSR says "not the paper bin" but names no bin; we show Restabfall as nearest). Berlin deposit bottles: BSR only lists bottles without a deposit for the Wertstofftonne; the shop return comes from Verbraucherzentrale NRW.

Bin classes (added 2026-11-15, v2): each bin has a `fate` taken from its own name and purpose: `recycle` (a material recycling stream), `organic` (food waste, compost, Biogut), `return` (deposit return, e-waste take-back), `residual` (whatever is not collected separately: Seoul's pay-as-you-throw bag, Berlin's Restmüll, San Francisco's Landfill cart, Shinjuku's Burnable). Teardown uses these only to say which kind of stream a part enters. It makes no claim about how much of a stream is finally recycled. Each bin also has a `stream` (paper, plastic, packaging, mixed, pet, film, organic, residual, deposit, takeback) used to work out which habits change between two cities.

Caps (v2): Seoul's 2024 page ("뚜껑을 닫아") and Recology ("leave caps on") say the cap stays on the bottle, so those two rules carry `keep_on` and the cap travels with the bottle in the animation.

Review fixes (2026-11-15, independent review v2):

- Seoul paper cup re-checked against the MoE guide itself (read in a browser on 2026-11-15 20:40 KST; notes kept privately). On p.15 the cup (종이컵) is an item under paper (종이류 (고지류)), with one line: "내용물을 비우고 물로 헹구는 등 이물질을 제거하여 배출". The carton table on p.13 lists paper cups as not belonging there ("종이류 수거함으로 배출"), and the FAQ on p.21 says: best collected on their own and put out with paper; cartons only if paper is not possible. The rule stays Paper.
- Seoul PET cap: the same guide's FAQ (p.23) reads "페트병 라벨, 뚜껑은 가급적 분리해서 별도 배출합니다." Seoul's 2024 page says to close the cap. The rule keeps Seoul's page as its answer and lists Plastic under `also`, so both count in practice.
- A guide's silence is no longer counted as a different answer (the bottle: at least three ways). Finding 2 now counts the 44 pieces that can be separated by hand, not all 64 part rules.

Map data (added 2026-11-15, v3):

| What | Source | Note |
|---|---|---|
| Coastlines, lakes, rivers, built-up areas, main roads, railways, town names | Natural Earth vector data, naturalearthdata.com (public domain), GeoJSON copies from github.com/nvkelso/natural-earth-vector, downloaded 2026-11-15 | Files: ne_50m_land, ne_50m_lakes, ne_50m_urban_areas, ne_10m_land, ne_10m_urban_areas, ne_10m_rivers_lake_centerlines, ne_10m_roads, ne_10m_railroads, ne_10m_populated_places_simple. Clipped, simplified and rounded by `tools/build_geo.py` into `data/geo.json` |
| City pins (`lat`, `lon` in cities.json) | Entered by hand | Approximate city-centre points, used only to place the pin and to work out the great-circle distance shown on a route |
| Neighbouring towns named on the close-up | Natural Earth populated places | A hand-picked list: Incheon, Suwon, Goyang; Potsdam; Oakland, San Jose, Berkeley; Yokohama, Kawasaki |

Not drawn: country borders and sea names. The map shows where the four cities are and nothing about their sorting results. Every number on a city card or a route is computed from the rule table (`src/logic.js`), except the city's own published figure at the foot of the card (see "City figures" below). Distances are great-circle distances between the two pins, rounded.

Practice feedback (v3): "At the kerb" classifies a wrong first try from the two bins in the rule table. `contaminates` = the chosen bin is a collection stream (recycle, organic, return) other than the one the rule names. `lost` = the chosen bin is residual waste although the rule names a collection stream. For a `nearest` rule the sentence says the guide does not name the part. It is not a measurement of contamination.

City figures (added 2026-11-16, v4). Each city's `figure` in cities.json is one number from the city's own publication. All pages were read on 2026-11-16 between 01:50 and 02:50 KST. The four numbers count different things and are not comparable; the app shows each with its year and what it counts and does not rank them.

| City | Figure and period | Sentence or row it comes from | Source |
|---|---|---|---|
| Seoul | 64 %, 2020 (2,033,960 of 3,177,620 t of household waste generated) | "생활폐기물은 총 발생량 3,177,620톤 중 재활용률은 64%에 불과한 2,033,960톤" | Seoul Metropolitan Government, 기후환경본부 생활환경과, notice dated 2023-11-02, https://news.seoul.go.kr/env/archives/518415 |
| Berlin | 30.7 %, 2021 (436,426 of 1,419,994 Mg from households and small businesses; energy and other recovery 64.1 %, disposal 0.5 %, water loss 4.6 %) | "Dies entspricht einer Recyclingquote von rund 30,7 %." (p.10; Table 1, p.8). The quota counts material recycling only (p.3) | Abfallbilanz des Landes Berlin 2021, Stand 10/2022, https://www.Berlin.de/sen/uvk/_assets/umwelt/kreislaufwirtschaft/abfallbehoerde/abfallbilanzen/abfallbilanz_2021.pdf |
| San Francisco | 35.4 %, 2025 (Recology recovery rate; 392,385 tons to landfill in rate year 2025) | Slide "Recology Recovery Rate, 2015 - 2025": "2025 35.4%". Refuse Rates Administrator's slide: "Landfill Disposal (Target -50%) 389,559 392,385 0.7%" and "Methodology for calculating recovery rate has changed over time." | Refuse Rate Board hearing packet, 13 March 2026, Office of the Controller, https://media.api.sf.gov/documents/Refuse_Rate_Board_Hearing_March_13_2026_RRA__Stakeholder_Presentation.pdf |
| Tokyo (Shinjuku) | 503 g per resident per day, fiscal 2024 (64,703 t collected by the ward; 19,882 t of resources recovered) | "区民一人１日当たりのごみ量＝区収集ごみ量の計÷１月１日の人口÷365日" and the 令和6年度 column of the table | Shinjuku City, 新宿区が収集するごみの処理量・資源の回収量, https://www.city.shinjuku.lg.jp/content/000342053.pdf |

Notes on the figures:

- Seoul: the notice gives no further definition of 재활용률. Seoul's open-data portal lists newer tables (for example OA-22880 and OA-22882), but their pages showed no numbers when read, so the 2020 figure from the city's own notice is used. A 2025 city page gives "생활폐기물 3,052톤/일('22년 기준)" with about 850 t a day landfilled (https://news.seoul.go.kr/env/archives/560803); it is not used because it does not match the scope of the 2020 total.
- Berlin: the balance is published every two years. No edition newer than 2021 was found. BSR's own 2024 management report gives a different quota for BSR alone ("Die Recyclingquote ... der BSR betrug im Jahr 2024 18%"), which is one more sign that the base decides the number.
- San Francisco: the city's own scorecard measure (share of residential and small-business refuse recovered, target 55 %; https://www.sf.gov/data/recovery-rate) publishes its values only as an interactive chart that could not be read, so the printed Recology series from the rate hearing is used. The slide does not say whether its years are calendar or rate years. Tons are US tons.
- Shinjuku: the ward's current plan sets its targets in grams per resident per day (444 g by fiscal 2027) and in total tonnes. A recycling rate (資源化率 = 資源回収量 ÷ (区収集ごみ量 + 資源回収量)) appears in the 2013 plan (21.1 % for fiscal 2011) but is not printed for recent years. The city card keeps the ward's own figure (503 g). For the street only, Teardown applies that formula to the fiscal 2024 table (see "City streets" below).

The phone's way onward (added 2026-11-16, v4). `after.smartphone` in cities.json. Pages read on 2026-11-16 between 01:50 and 02:50 KST.

| City | What the app says | Source |
|---|---|---|
| Seoul | No reuse channel named. Collection boxes at subway ticket gates, community service centres, large public buildings and post offices; 25 district offices empty them weekly. Phones go to the SR Center (서울도시금속회수센터), are shredded whole and mined for metals; part of the proceeds is donated. 1.938 million phones collected from 2009 to February 2026 | 폐금속자원 재활용 참여, page dated 2023-10-31, https://news.seoul.go.kr/env/archives/1709 ; 폐금속자원재활용 사업이란?, page dated 2026-03-09, https://news.seoul.go.kr/env/archives/135 |
| Berlin | Working devices should be passed on (Verschenkmarkt, NochMall; re-use drop-off at Gradestraße 73, Lengeder Straße 6–18, Hegauer Weg 17). Finished devices: 14 Recyclinghöfe, up to 20 devices free; shops over 400 m² take devices back. Data: not mentioned | BSR leaflet "Elektroaltgeräte", Stand August 2022, https://www.bsr.de/assets/downloads/BSR_Mini-Leporello_Elektrogeraete_web.pdf ; Senate page https://www.berlin.de/sen/uvk/umwelt/kreislaufwirtschaft/service/privathaushalte/elektroaltgeraete/ |
| San Francisco | Working: Goodwill takes electronics "working or broken" and says it destroys the data. Finished: eight Redwood Materials battery bins (four Cole Hardware stores, three Sports Basement stores, Four Embarcadero Center), Best Buy at 1717 Harrison St, Recology transfer station at 501 Tunnel Ave | https://www.sfenvironment.org/donate-unwanted-items ; https://sfgoodwill.org/donate/donate-electronics/ ; https://www.sfenvironment.org/press/san-francisco-becomes-first-nation-offer-public-drop-bins-battery-embedded-product-recycling ; https://www.sfenvironment.org/sfrecycles/item/cell-phones-non-working ; https://www.sfenvironment.org/bulky-items |
| Tokyo (Shinjuku) | No reuse channel named. 12 collection boxes (ward office, 10 branch offices, Eco Gallery Shinjuku), 7 staffed counters, carrier shops. Collected devices go to nationally certified operators. The person handing a device in must erase personal data. 268 t of used small electronics collected in fiscal 2024 | 使用済小型電子機器等の出し方 (updated 2019-04-01), https://www.city.shinjuku.lg.jp/seikatsu/file09_01_00004.html ; 資源回収ボックス設置場所 (updated 2025-04-01), https://www.city.shinjuku.lg.jp/seikatsu/file09_01_00018.html ; collection table, https://www.city.shinjuku.lg.jp/content/000342053.pdf |

Limits of the phone data: Seoul's drop-off page carries a 2023 date but parts of its text are older (it cites figures up to March 2015), so the box locations are given as the page states them. "No reuse channel named" means none was found in the city pages read; private trade-in and resale exist in every city and are outside this table. The Seoul rule already quoted from the Ministry of Environment guide adds "우체국 보상판매 이용 가능" (a post-office trade-in). Addresses are shown as text and are not placed on the map, because no verified coordinates were available. Opening hours and acceptance were not checked on site.

City streets (added 2026-11-25, v5). `figure.street` in cities.json holds the shares each city's street is drawn from. `src/logic.js` turns them into 20 kerb bays (5 % each, largest remainders, so the bays always add up to 20). No new page was read for this: the numbers are the ones in "City figures" above, read on 2026-11-16.

| City | Planted bays | Amber bags | Red bags | Where the shares come from |
|---|---|---|---|---|
| Seoul | 64 % recycled = 13 | none | 36 % = 7 | 2,033,960 of 3,177,620 t, the city's notice |
| Berlin | 30.7 % material recycling = 6 | 64.1 % energy and other recovery = 13 | 0.5 % disposal + 4.6 % water loss = 1 | Table 1 of the Abfallbilanz 2021 |
| San Francisco | 35.4 % recovered = 7 | none | 64.6 % = 13 | Recology recovery rate for 2025 |
| Tokyo (Shinjuku) | 23.5 % collected as resources = 5 | none | 76.5 % = 15 | Computed, see below |

Notes on the streets:

- Shinjuku's 23.5 % is not printed by the ward. It is 19,882 t ÷ (64,703 t + 19,882 t) = 0.2351, the two fiscal 2024 totals from the ward's collection table put into the ward's own formula from its 2013 plan. The plan's 資源回収量 may be bounded differently from the table's total (for example group collection), so the result is labelled "worked out" everywhere it is shown and is not presented as the ward's figure.
- Only Berlin's balance prints energy recovery apart, so only Berlin's street has amber bags. In the other three cities the red bags are simply "the rest of that city's count" and say nothing about landfill or incineration.
- Seoul's and San Francisco's red share is 100 % minus the published rate. Neither source says what happens to it.
- The house shapes (roofs, bay windows, signs, wires) are illustration and carry no data. The lit windows follow the planted share.
- The animal in the practice step reacts to the visitor's own first tries. Why each animal: see the next section.

## Practice animals (added 2026-11-25, v7)

Read on 2026-11-25 around 21:45 KST. Quotes are copied word for word into src/friends.js.

| City | Animal | Source | Date shown | Grade |
|---|---|---|---|---|
| Seoul | Sea turtle | The Better Future (더나은미래), "韓 연안 바다거북 10마리 중 8마리는 플라스틱 먹는다", reporting KIOST's South Sea Research Institute, https://futurechosun.com/archives/66145 | 2022-06-30 | [press] reporting a research institute; sampling years not stated in the article |
| Tokyo | Japanese anchovy | Tanaka, K. and Takada, H. (2016), "Microplastic fragments and microbeads in digestive tracts of planktivorous fish from urban coastal waters", Scientific Reports 6:34351, https://doi.org/10.1038/srep34351 | 2016-09-30 | [paper] |
| San Francisco | Bay fish | San Francisco Estuary Institute, "Holistic Assessment of Microplastics and Other Anthropogenic Microdebris in an Urban Bay Sheds Light on Their Sources and Fate", SFEI Contribution No. 1060, https://sfei.org/node/7688 (abstract page) | 2021 | [official] regional institute; the abstract names no fish species and gives no share |
| Berlin | Northern fulmar | Umweltbundesamt, "Indikator: Kunststoffmüll in der Nordsee", https://www.umweltbundesamt.de/indikator-plastikmuell-in-der-nordsee | updated 2025-07-28 | [official] |

What the sources say about where the plastic comes from: Korea, single-use packaging washed in from land and fishing waste; Tokyo Bay, "river water, sewage, industrial wastewater and surface runoff from the city", sources of the fragments not identified; San Francisco Bay, stormwater as a major pathway; North Sea, sea- and land-based sources in general. None of them ties the plastic to household sorting mistakes, so Teardown does not either.

