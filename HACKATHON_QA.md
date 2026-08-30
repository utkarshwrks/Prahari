# PRAHARI — Hackathon Q&A Battle Card (140+ Questions)

**How to use this:** Skim the ⭐ one-liners first, then the section that matches the question.
Every answer is short, honest, and confident. The golden rule: **"We geofence what criminals
*say* — we do not deanonymize Tor."** Repeat that whenever you're unsure.

---

## ⭐ SECTION 0 — One-liners you must know by heart

1. **What is PRAHARI in one line?**
   A dark-web threat-intelligence control room that geofences the locations criminals *state* in
   their own listings — turning openly-published dark-web crime into local, actionable leads for
   the Jabalpur Cyber Cell.

2. **The 6-word version?**
   "See the threats that hide."

3. **The honest thesis (say this a lot)?**
   We don't unmask Tor. We read what criminals publish and geofence the cities they name.

4. **Why will it win?**
   It's the only tool built for the *last mile* — one district, honest, free, and demo-proof (a
   guaranteed Jabalpur breach in under 20 seconds).

5. **What does प्रहरी mean?**
   "The sentinel" — the guard who never sleeps.

6. **Who is it for?**
   The Madhya Pradesh Police Cyber Cell, piloted in Jabalpur.

7. **What does it cost?**
   ₹0. Free and open-source tools only.

8. **The tagline for the judges?**
   "Content-based geospatial intelligence, not network deanonymization."

---

## SECTION 1 — The Core Concept

9. **What problem does it solve?**
   Criminals sell drugs, weapons, stolen IDs and fake currency on the dark web and openly name
   Indian cities as delivery points — but local police have no tool watching for it. PRAHARI is
   that tool.

10. **What's the big insight?**
    A marketplace *must* advertise where it ships. So the location leaks in the text itself. We
    just read it and map it.

11. **Why is this novel?**
    Everyone else tries (and fails) to deanonymize Tor. We flip the problem: ignore the network,
    read the content. Honest, legal, and it actually works.

12. **Is this surveillance of citizens?**
    No. We read *public criminal adverts*, not private people's messages.

13. **What makes a "breach"?**
    When a listing names a city inside the Jabalpur geofence (Jabalpur, Katni, or Narsinghpur).

14. **Why Jabalpur specifically?**
    It's the pilot district. The whole system is config-driven, so any district is a one-line
    change.

15. **What's the "sentinel" idea?**
    Like a guard tower that never sleeps — always watching the feed, always ready to sound the
    alarm.

16. **In one sentence, the value?**
    We convert noise on the dark web into a named, mapped, exportable lead an officer can act on.

---

## SECTION 2 — "How does it fetch data from the dark web?" (the tough one)

17. **How does it get data from the dark web?**
    In this demo it uses a **synthetic (fake) data engine** we built, which produces realistic
    marketplace-style listings. We deliberately do **not** connect to the real dark web.

18. **Why fake data and not real?**
    Three reasons: (1) **legal & safe** — no touching real illegal content; (2) **reliable** — the
    demo can't break on stage; (3) **reproducible** — it behaves the same every run.

19. **So it doesn't really work on real data?**
    It's built to. Everything *after* the data comes in — extraction, geofencing, alerts,
    analytics — is production-identical. Going live is a **single source swap**: replace the mock
    generator with a real ingestion feed.

20. **How would the real version fetch data?**
    Through a legal ingestion layer: dark-web *content* feeds from threat-intel providers, honeypot
    marketplaces, and OSINT crawlers that collect *public* listing text (not private data). That
    text flows into the exact same pipeline.

21. **Would you crawl Tor yourself?**
    Not required — and we don't in the demo. In production you'd use vetted content feeds or an
    authorised crawler that only reads public marketplace pages. No hacking, no interception.

22. **Isn't crawling the dark web illegal?**
    Reading *public* criminal-market pages for law-enforcement intelligence is a recognised OSINT
    practice. We never break encryption, intercept private messages, or deanonymize users.

23. **What data fields do you extract from each listing?**
    Four: **locations, contraband type, crypto wallets, and @handles (usernames).**

24. **How fast is ingestion?**
    Real-time. In demo mode a new intercept arrives roughly every 1.2 seconds; normally every 2–4
    seconds.

25. **What if the real feed is messy or inconsistent?**
    That's exactly what the NER (AI) layer is for — it reads messy free text and pulls out clean,
    structured entities.

26. **Do you store the criminals' data?**
    We store the *public listing content* and the extracted entities as an auditable lead — the
    same evidence a human analyst would note down.

---

## SECTION 3 — How It Works (the 5-stage pipeline)

27. **Explain how it works in 5 steps.**
    **Ingest** (get listings) → **Extract** (pull out entities) → **Geofence** (check the city
    against Jabalpur) → **Alert** (siren + notify on an in-zone hit) → **Report** (correlate and
    export a lead).

28. **What happens the moment a listing arrives?**
    It appears in the Live Feed, runs an ANALYZING→EXTRACTED animation, and its entities light up
    as chips.

29. **What happens on a Jabalpur match?**
    The map sirens red, the threat level jumps to CRITICAL, a breach alert fires, the counter ticks
    up, and it's saved to the Alert Log and Notification Center.

30. **How does the threat level work?**
    Three levels: **NOMINAL** (calm) → **ELEVATED** (any MP city mentioned) → **CRITICAL** (a
    Jabalpur-zone breach). It cools back down after ~30 seconds of calm.

31. **What's "threat-heat"?**
    If the same city is named again and again, its marker glows brighter — repeat mentions mean
    rising risk.

32. **How does one listing become a "lead"?**
    Its wallet and username are matched against past listings; repeats link separate sellers into
    one operation, and the whole thing exports as a JSON or printable report.

33. **Walk me through a real example.**
    Listing: *"MDMA & LSD, delivery across Jabalpur and Katni, @nightowl_mp, BTC bc1q7x…"* →
    entities extracted → Jabalpur & Katni are in-zone → map sirens, CRITICAL alert → wallet logged
    for correlation → officer exports the lead.

34. **Is any of this manual?**
    No — the pipeline is fully automatic. The officer only steps in to *manage* alerts (status,
    assign, notes).

---

## SECTION 4 — NER, AI & the Analyzer

35. **What is NER? (full form)**
    **Named Entity Recognition** — AI that reads free text and pulls out named things: places,
    people, items, etc.

36. **How do you use NER?**
    To read a messy listing and extract the location, contraband, wallet and handle automatically.

37. **Which AI model?**
    **Groq running Llama-3.3-70B** (a fast, free-tier large language model) for live analysis.

38. **What if there's no AI key or the internet is down?**
    It falls back to a built-in **local engine** (pattern-matching + a city/keyword dictionary).
    The analyzer **always** returns a result. We even show a small "via Groq / via local engine"
    tag to stay honest.

39. **Is the AI expensive?**
    No — Groq has a free tier, and the local fallback is free forever. Total cost: ₹0.

40. **Can I test the AI live?**
    Yes — that's the Live NER Analyzer. Type any sentence, hit Analyze, and watch it extract
    entities and drop pins on the map. Great judge-magnet.

41. **Does the feed itself use AI?**
    No — the feed's entities are pre-tagged deterministically, so it's instant and never depends on
    a model. The AI is for the *interactive* analyzer, where free text is unpredictable.

42. **Why keep the AI key server-side?**
    Security — the key never reaches the browser. The analyzer runs through a server route
    (`/api/analyze`).

43. **What's a "gazetteer"?**
    A built-in dictionary of place names (and keywords). The local engine uses it to spot MP cities
    without any AI.

---

## SECTION 5 — Geofencing

44. **What is a geofence?**
    A virtual boundary on a map. If something happens inside it, you get alerted.

45. **What's PRAHARI's geofence?**
    Two rings around Jabalpur: a solid **60 km core** ("Jabalpur Jurisdiction") and a dashed **~95
    km neighbour ring** covering Katni and Narsinghpur.

46. **Why two rings?**
    Jabalpur city is the core; Katni (~83 km) and Narsinghpur (~85 km) are neighbour towns just
    outside 60 km. The neighbour ring includes them so all three trigger correctly.

47. **How do you decide if a city is "in-zone"?**
    Real distance maths (the **haversine formula**) — if the city is within 95 km of Jabalpur, it's
    in-zone.

48. **You said 60 km but the neighbours are 85 km — contradiction?**
    Good catch — that's why we use *two* rings. The 60 km core is the city; the 95 km ring is the
    neighbour watch. Both are shown clearly on the map.

49. **What are the 10 cities on the map?**
    Jabalpur, Katni, Narsinghpur (in-zone) + Bhopal, Indore, Gwalior, Ujjain, Sagar, Rewa, Satna
    (watched at lower severity).

50. **What if a criminal names a city you don't know?**
    The AI still extracts it; you add it to the gazetteer in seconds — it's config, not code.

51. **Can the geofence move to another district?**
    Yes — change the centre coordinate and radius. That's the whole change.

---

## SECTION 6 — Full Forms & Glossary (judges love these)

52. **NER** — Named Entity Recognition.
53. **Tor** — The Onion Router (the anonymous network the dark web runs on).
54. **OSINT** — Open-Source Intelligence (intelligence from public sources).
55. **BTC / ETH** — Bitcoin / Ethereum (cryptocurrencies).
56. **KYC** — Know Your Customer (identity records).
57. **PAN** — Permanent Account Number (Indian tax ID).
58. **Aadhaar** — India's 12-digit national identity number.
59. **OTP** — One-Time Password.
60. **CCTNS** — Crime and Criminal Tracking Network & Systems (India's police IT backbone; PRAHARI
    is designed to integrate with it).
61. **HUD** — Heads-Up Display (the threat-level gauge in the header).
62. **API** — Application Programming Interface (how software talks to software).
63. **UI / UX** — User Interface / User Experience.
64. **IP address** — the network address you'd need to physically locate someone (which Tor hides).
65. **JSON** — a standard data file format (we export leads as JSON).
66. **LLM** — Large Language Model (the type of AI we use for NER).
67. **SI / HC** — Sub-Inspector / Head Constable (officer ranks in the assign-officer tool).
68. **Geofence** — a virtual boundary on a map that triggers alerts.
69. **Gazetteer** — a dictionary of place names.
70. **Haversine** — the formula for distance between two points on a globe.
71. **Contraband** — illegal goods (drugs, weapons, etc.).
72. **Intercept** — one captured dark-web listing in our feed.

---

## SECTION 7 — Features (know each one)

73. **List the main features.**
    Live Intel Feed, Geospatial Command (map + geofence), Threat Analytics, Jabalpur Zone Monitor,
    Live NER Analyzer, Wallet Cluster Tracker, Alert Log, Notification Center, Case Management, and
    a first-use Guided Tutorial.

74. **Live Intel Feed?**
    A live stream of listings, newest first, each auto-tagged with its entities.

75. **Geospatial Command?**
    The MP map with the Jabalpur geofence, siren pulses on mentions, and threat-heat glow.

76. **Threat Analytics?**
    Live counters (intercepts, breaches, wallets, handles), a contraband breakdown chart, and an
    activity graph with spike detection.

77. **Jabalpur Zone Monitor?**
    A focused panel: zone threat level, in-zone hit count, neighbour-ring status, latest breaches,
    and a handle watchlist.

78. **Live NER Analyzer?**
    Paste any text → extract entities → plot cities live. The interactive star of the demo.

79. **Wallet Cluster Tracker?**
    Ranks repeated crypto wallets — reuse links separate sellers into one network.

80. **Alert Log?**
    Every breach in one list, exportable as JSON or a printable report.

81. **Notification Center?**
    A bell with an unread badge → an inbox of all alerts you can filter and open.

82. **Case Management tools?**
    On each alert: set status (New/Acknowledged/Investigating/Closed), assign an officer, add a
    note, and re-ping it on the map. Built for real police workflow.

83. **Guided Tutorial?**
    A first-use walkthrough of every feature with Next/Skip — any officer, tech or not, is ready in
    minutes. Replayable anytime.

84. **Demo Mode?**
    Speeds up the feed and *guarantees* a Jabalpur breach within 20 seconds — perfect for a pitch.

85. **Do alerts overlap or clutter the screen?**
    No — toasts are capped and stacked (bottom-right), and everything also lands in the
    Notification Center and Alert Log, so nothing is lost.

86. **Can non-technical officers use it?**
    Yes — that's the point. Plain-language docs, a guided tutorial, and one-click actions.

---

## SECTION 8 — Tech Stack (all free)

87. **What's it built with?**
    Next.js 14 + TypeScript (app), Tailwind CSS (design), NextAuth (login), React-Leaflet + free
    CartoDB tiles (map), Sonner (alerts), Zustand (state), Recharts (charts), Framer Motion
    (animation), and Groq (optional AI).

88. **Why Next.js?**
    One framework for the website, the login, and the live dashboard — fast to build, easy to
    deploy.

89. **Is the map free?**
    Yes — free CartoDB dark tiles, no API key needed.

90. **How does login work offline?**
    NextAuth with a local user file (passwords hashed with bcrypt) and a seeded demo officer
    account. No external service, no cost.

91. **Where's the data stored?**
    Locally — new signups in a JSON file; intercepts live in memory. No database bill.

92. **Is it secure?**
    Passwords are hashed; the AI key stays server-side; the dashboard is protected by middleware
    (login required).

93. **Can it be deployed?**
    Yes — it's a standard Next.js production build; runs anywhere, including a police intranet.

94. **How big is the codebase / is it maintainable?**
    Clean, typed, modular (separate files for cities, generator, extractor, analytics, store, UI).
    Easy to extend.

---

## SECTION 9 — Legality, Ethics & Privacy

95. **Is this legal?**
    Yes. We read public criminal-market content, not private citizens. No interception, no
    deanonymization.

96. **Could it be misused?**
    It only surfaces public criminal adverts and produces auditable leads — every alert traces back
    to its public source, so it supports due process, not shortcuts.

97. **What about false positives?**
    Alerts are *leads*, not verdicts. Officers verify before acting; the case-management tools exist
    exactly for that review step.

98. **Do you profile innocent people?**
    No — we track criminal listings, wallets and seller handles, not citizens.

99. **Is the AI biased?**
    The core geofencing is deterministic maths, not AI. The AI only helps read text, and there's a
    transparent fallback — we always show which engine ran.

---

## SECTION 10 — USP & Differentiation

100. **What's your USP in one line?**
     The last-mile threat console for Indian district policing — honest, local, free, and
     demo-proof.

101. **How are you different from Recorded Future / global tools?**
     They serve nations and never zoom into a district. We're built for one cyber cell — Indian
     cities, Indian slang, CCTNS-shaped, officer-first.

102. **Why can't a big company just copy this?**
     They can copy features, but our edge is the *focus*: district geofencing + Indian context +
     zero cost + day-one officer UX. That's a positioning, not just code.

103. **What are your top differentiators?**
     Honest by design, district-first for Jabalpur, real-time breach in <20s, correlation not just
     detection, ₹0 to run, works fully offline.

104. **What's genuinely hard here that you solved?**
     Making anonymous-network crime *actionable* without pretending to break Tor — plus a demo that
     never fails on stage.

---

## SECTION 11 — Business Model & Scale

105. **What's the business model?**
     A public-good deployment model: the core is free/open-source and stood up on existing
     government IT budgets. Value grows through **per-district rollout**, a **state-level control
     room**, and optional **support, training, and integration** services.

106. **How would it make money / sustain itself?**
     Government/grant funding for deployment and maintenance; a paid managed "state control room"
     tier; and paid integration with real threat-intel feeds and CCTNS. The pilot is free to prove
     value.

107. **How does it scale technically?**
     The geofence and city list are configuration. A new district = a data change. The state runs
     the MP-wide view; each cell runs its own local geofence.

108. **Scale to all of India?**
     Yes — same architecture, per-state and per-district config. Indian-context awareness is the
     moat.

109. **What's the go-to-market?**
     Pilot with the Jabalpur Cyber Cell → prove leads → expand district by district across MP →
     state control room → other states.

110. **Who pays and why?**
     State police IT budgets — because it turns invisible dark-web crime into concrete leads at
     near-zero cost.

111. **What's the total cost of ownership?**
     Effectively hosting only — no per-seat licences, no paid APIs required for the core.

---

## SECTION 12 — Impact for MP Police

112. **What's the real-world impact?**
     Faster detection of contraband targeting MP cities, correlated seller networks, and
     ready-to-action leads for beat officers — work that's invisible today.

113. **How does it fit existing police systems?**
     It's designed to be CCTNS-shaped — leads can be exported and fed into official case systems.

114. **Does it replace officers?**
     No — it's a force multiplier. It surfaces and organises; officers investigate and decide.

115. **What's the day-one value?**
     A Jabalpur officer opens it and immediately sees named, mapped threats and can export a lead —
     no training marathon needed.

---

## SECTION 13 — Tough / Trick Questions (stay calm)

116. **"This is just fake data — it's not real."**
     Correct, on purpose — for a safe, legal, reliable demo. The engine is production-identical;
     going live is one source swap. Every downstream feature is real.

117. **"You can't geolocate Tor, so this is fake security."**
     We never geolocate Tor. We geofence the locations criminals *write down themselves* — a
     different, honest technique that actually works.

118. **"What if criminals stop naming cities?"**
     A marketplace must advertise delivery areas or lose buyers, so location leakage is intrinsic.
     We also catch pincodes, landmark slang, and known local handles.

119. **"Isn't this just a fancy dashboard?"**
     No — it's a working pipeline (ingest → NER → geofence → alert → correlate → export) with real
     case-management tools, wrapped in a control-room UI.

120. **"How accurate is it?"**
     Geofencing is exact maths. Extraction is AI-assisted with a deterministic fallback and a
     visible source tag — and every alert is a reviewable lead, not an automatic action.

121. **"What's your biggest weakness?"**
     We depend on a good ingestion feed for real data — which is a partnership/procurement step, not
     a technical unknown. Everything after ingestion already works.

122. **"Why should we fund this over X?"**
     Because it's the only entry built for the district last mile, it runs at ₹0 to prove itself,
     and it's honest — no legal or ethical landmines.

---

## SECTION 14 — Roadmap (show vision)

123. **What's next after the hackathon?**
     Connect a real (legal) ingestion feed, add more MP districts, and pilot with the Jabalpur
     Cyber Cell.

124. **Future features?**
     CCTNS export integration, multi-lingual slang detection (Hindi/regional), image/QR analysis,
     officer mobile app, and a state-level control room view.

125. **How long to production?**
     The app is production-ready today; the timeline is mostly the data-feed partnership and
     security review, not new engineering.

---

## SECTION 15 — Live data & the newest features (v2 — memorize these)

126. **Is the data actually live, or just fake?**
     Both, by design. **DEMO mode** = a synthetic engine that guarantees a Jabalpur breach in
     under 20s (unbreakable for a pitch). Turn **DEMO off** and it switches to **LIVE OSINT** —
     real, current cyber-threat news pulled live from the internet through the same pipeline.

127. **Where does the LIVE data come from? (exact sources)**
     Three FREE, no-key public APIs: **Hacker News** (Algolia API), **Google News India** (RSS),
     and **Reddit** security feeds (best-effort). It fetches every ~10 seconds through a server
     route (`/api/live-intel`), so real headlines stream in continuously.

128. **Show me proof it's real.**
     Live cards are badged LIVE with the channel (e.g. "Hacker News", "Google News"). Click any live
     card → **"Open Source Article"** opens the exact real article (e.g. a BBC or news report). We
     saw real items like *"ShinyHunters has leaked the data of multiple companies"* and *"Delhi
     Police arrest two in ₹80 lakh online fraud."*

129. **But this is still not the *dark web*.**
     Correct — and we're honest about it. Scraping Tor is illegal and unsafe, so we never do it.
     LIVE mode proves the pipeline runs on **real** internet threat data (OSINT). In production you
     swap in a *licensed* dark-web content feed at the ingestion layer — nothing downstream changes.

130. **Does LIVE mode raise alerts in real time?**
     Yes. When a real OSINT item names a monitored MP city, it fires a realtime alert — **in-zone
     cities (Jabalpur/Katni/Narsinghpur) = critical breach**, other MP cities = **regional watch**.
     Any Indian city it names is plotted live on the map.

131. **What is OSINT?**
     Open-Source Intelligence — intelligence gathered from public sources (news, forums, posts).
     It's a standard, legal law-enforcement discipline.

132. **Can I see where a threat is on the map?**
     Yes — click **"Locate on Map"** on any alert (or any feed card) and the map flies to that
     city, drops a labelled marker, and pulses it. Every active city shows its name on the map.

133. **What map views are there?**
     Four, switchable live on the map: **Dark, Light, Streets, Satellite** — all free, no API key.

134. **Can officers manage cases, not just see alerts?**
     Yes. The **Records & Reports** module (folder icon) is a full case system: **create, edit,
     delete, search and filter** case records; set status (Open → In Progress → Escalated →
     Closed); assign an officer; add notes. You can spin a case straight from an alert or intercept.

135. **What analytics/graphs does it show?**
     Live counters, a contraband breakdown, an activity graph — plus a full **Analytics** tab with
     an intercept-severity donut, source breakdown, top-mentioned-cities, and case-status charts.

136. **How do I export a report?**
     From the Alert Log or the Records module: **Export JSON** or a **printable case report** for
     hand-off to a senior officer or CCTNS entry.

137. **What's the Notification Center?**
     A header bell with an unread badge → an alert inbox you can filter by severity/status. Open any
     alert for full detail: city, distance from Jabalpur, coordinates, source, the exact source
     article link, and case tools.

138. **Is there onboarding for a new officer?**
     Yes — a first-use **guided tutorial** spotlights every feature with Next/Skip, replayable
     anytime from the user menu. Any officer, technical or not, is productive in minutes.

139. **Can I silence the alerts during a briefing?**
     Yes — separate header toggles **stop the alert pop-ups** and **mute the alert sound**
     independently. Alerts still land in the log and notification center.

140. **What tech makes the live feed work without a paid plan?**
     Free public APIs (Hacker News, Google News RSS, Reddit) + a Next.js server route that keeps
     any keys server-side. Optional Groq (free tier) upgrades the NER analyzer. Total cost: ₹0.

---

## Closing lines (end strong)

- "PRAHARI is the sentinel for the last mile of Indian policing — honest, local, and free."
- "We don't unmask Tor. We geofence what criminals say. And in the next 20 seconds, you'll watch
  Jabalpur light up."
- "Everything you saw runs at ₹0, fully offline, and going live is a single source swap."

*Say the golden rule if cornered: "Content-based geospatial intelligence — not network
deanonymization."*
