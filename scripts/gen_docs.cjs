/* eslint-disable */
/**
 * Generates the PRAHARI v2 document pack as real vector PDFs into
 * ~/Downloads/prahariv2docs/. Run:  node scripts/gen_docs.cjs
 */
const { jsPDF } = require("jspdf");
const fs = require("fs");
const os = require("os");
const path = require("path");

const OUT = path.join(os.homedir(), "Downloads", "prahariv2docs");
fs.mkdirSync(OUT, { recursive: true });

// ---- palette ---------------------------------------------------------------
const INK = [22, 24, 30], MUTED = [96, 102, 114], FAINT = [150, 156, 166];
const ACCENT = [225, 74, 52], ACC2 = [193, 138, 43], PANEL = [245, 246, 249], LINE = [223, 226, 231];
const W = 595.28, H = 841.89, M = 52, MAXW = W - 2 * M;

// ---- doc builder -----------------------------------------------------------
function makeDoc(title, subtitle, tag) {
  const d = new jsPDF({ unit: "pt", format: "a4" });
  let y = 0, page = 0;

  const setColor = (c) => d.setTextColor(c[0], c[1], c[2]);
  const setFill = (c) => d.setFillColor(c[0], c[1], c[2]);
  const setDraw = (c) => d.setDrawColor(c[0], c[1], c[2]);

  function footer() {
    setDraw(LINE); d.setLineWidth(0.5); d.line(M, H - 34, W - M, H - 34);
    d.setFont("helvetica", "normal"); d.setFontSize(7); setColor(FAINT);
    d.text("PRAHARI · SIH 2026 · PS 26151 · Team Vasiliades", M, H - 22);
    d.text(String(page), W - M, H - 22, { align: "right" });
    d.text(tag, W / 2, H - 22, { align: "center" });
  }

  function newPage(first) {
    if (!first) footer();
    d.addPage(); page++;
    // top hairline with title
    setFill(INK); d.rect(0, 0, W, 3, "F");
    d.setFont("helvetica", "bold"); d.setFontSize(7.5); setColor(FAINT);
    d.text("PRAHARI", M, 26);
    d.setFont("helvetica", "normal");
    d.text(tag.toUpperCase(), W - M, 26, { align: "right" });
    y = 52;
  }

  function ensure(h) { if (y + h > H - 48) newPage(false); }

  function cover() {
    page++;
    setFill(INK); d.rect(0, 0, W, 250, "F");
    setFill(ACCENT); d.rect(0, 250, W, 4, "F");
    d.setTextColor(255, 255, 255);
    d.setFont("helvetica", "bold"); d.setFontSize(30); d.text("PRAHARI", M, 92);
    d.setFont("helvetica", "normal"); d.setFontSize(10); d.setTextColor(190, 193, 200);
    d.text("Praharaa — the sentinel · dark-web threat-actor attribution", M, 112);
    d.setFont("helvetica", "bold"); d.setFontSize(19); d.setTextColor(255, 255, 255);
    d.splitTextToSize(title, MAXW).forEach((ln, i) => d.text(ln, M, 158 + i * 24));
    d.setFont("helvetica", "normal"); d.setFontSize(10.5); d.setTextColor(210, 213, 220);
    d.splitTextToSize(subtitle, MAXW).forEach((ln, i) => d.text(ln, M, 216 + i * 15));
    // meta block
    y = 300;
    setColor(MUTED); d.setFontSize(9);
    d.text("Smart India Hackathon 2026", M, y);
    d.text("Problem Statement 26151 · NTRO", M, y + 15);
    d.text("Team Vasiliades", M, y + 30);
    d.text("Cost to run: Rs 0 · Free & open source · runs on-premise", M, y + 45);
    y = 380;
  }

  function h1(t) {
    ensure(46); y += 12;
    setFill(ACCENT); d.rect(M, y - 9, 4, 18, "F");
    d.setFont("helvetica", "bold"); d.setFontSize(15); setColor(INK);
    d.text(t, M + 12, y + 5); y += 26;
    setDraw(LINE); d.setLineWidth(0.5); d.line(M, y, W - M, y); y += 14;
  }
  function h2(t) {
    ensure(30); y += 8;
    d.setFont("helvetica", "bold"); d.setFontSize(11); setColor(ACCENT);
    d.text(t, M, y); y += 16;
  }
  function para(t, opts = {}) {
    const size = opts.size || 9.5, lh = size * 1.45, indent = opts.indent || 0;
    d.setFont("helvetica", opts.bold ? "bold" : "normal"); d.setFontSize(size);
    setColor(opts.color || INK);
    const lines = d.splitTextToSize(t, MAXW - indent);
    for (const ln of lines) { ensure(lh); d.text(ln, M + indent, y); y += lh; }
    y += opts.gap == null ? 4 : opts.gap;
  }
  function bullet(t, opts = {}) {
    const size = opts.size || 9.5, lh = size * 1.4;
    d.setFont("helvetica", "normal"); d.setFontSize(size);
    const lines = d.splitTextToSize(t, MAXW - 16);
    ensure(lh); setColor(ACCENT); d.text("•", M + 3, y);
    setColor(opts.color || INK);
    lines.forEach((ln, i) => { if (i) ensure(lh); d.text(ln, M + 16, y); if (i < lines.length - 1) y += lh; });
    y += lh + 2;
  }
  function kv(k, v) {
    const size = 9.5, lh = size * 1.4;
    d.setFont("helvetica", "bold"); d.setFontSize(size); setColor(INK);
    ensure(lh); d.text(k, M, y);
    const kw = d.getTextWidth(k) + 8;
    d.setFont("helvetica", "normal"); setColor([60, 63, 71]);
    const lines = d.splitTextToSize(v, MAXW - kw);
    lines.forEach((ln, i) => { if (i) { ensure(lh); } d.text(ln, M + (i ? 16 : kw), y); if (i < lines.length - 1) y += lh; });
    y += lh + 2;
  }
  function qa(n, q, a) {
    const qs = 10, as = 9.5, lh = 13.2;
    // keep question + first lines together
    ensure(40);
    d.setFont("helvetica", "bold"); d.setFontSize(qs); setColor(INK);
    const ql = d.splitTextToSize(`Q${n}.  ${q}`, MAXW);
    for (const ln of ql) { ensure(lh); d.text(ln, M, y); y += lh; }
    y += 1;
    d.setFont("helvetica", "normal"); d.setFontSize(as); setColor([54, 57, 65]);
    const al = d.splitTextToSize(a, MAXW - 12);
    for (const ln of al) { ensure(lh); d.text(ln, M + 12, y); y += lh; }
    y += 8;
  }
  function callout(t) {
    d.setFont("helvetica", "normal"); d.setFontSize(9);
    const lines = d.splitTextToSize(t, MAXW - 24);
    const boxH = lines.length * 12.5 + 16;
    ensure(boxH + 6);
    setFill([253, 237, 234]); setDraw(ACCENT); d.setLineWidth(0.6);
    d.roundedRect(M, y, MAXW, boxH, 3, 3, "FD");
    setFill(ACCENT); d.rect(M, y, 3, boxH, "F");
    setColor([120, 40, 28]);
    let ty = y + 15; lines.forEach((ln) => { d.text(ln, M + 14, ty); ty += 12.5; });
    y += boxH + 10;
  }
  function space(n) { y += n || 6; }

  function save(file) { footer(); fs.writeFileSync(path.join(OUT, file), Buffer.from(d.output("arraybuffer"))); }

  return { cover, newPage, h1, h2, para, bullet, kv, qa, callout, space, save };
}

// ===========================================================================
// DOC 1 — Simple Hinglish one-pager
// ===========================================================================
function doc1() {
  const d = makeDoc(
    "PRAHARI ko 5 minute me samjho",
    "Sabse simple Hinglish explanation — problem, solution, USP, aur baaki platforms se strong kyun.",
    "Simple Hinglish");
  d.cover();

  d.h1("Problem kya hai? (PS 26151)");
  d.para("Dark web par criminals chhupe hote hain — drugs, weapons, stolen data, ransomware sab wahin bikta hai. Woh Tor use karte hain, isliye unka asli IP ya naam nahi milta. Ek hi criminal aksar 4-5 alag naam (personas) se, alag-alag markets par kaam karta hai. Agencies ka sabse bada dard: 'ye 5 alag handle kya ek hi insaan hain? Aur kitne yakeen se keh sakte hain?' PS bolta hai: inhe de-anonymize karo, personas ko link karo, aur ek queryable actor-graph banao — legally, public data se.");

  d.h1("PRAHARI kya karta hai?");
  d.para("PRAHARI Tor ko TODTA NAHI. Ye ek simple baat par tika hai: criminal chahe kitna bhi chhupe, woh public jagahon par chhoti-chhoti galtiyan chhod deta hai. Wahi galtiyan hum jodte hain. Matlab hum wahi data use karte hain jo pehle se public indexes me pada hai — koi hacking nahi, koi live marketplace scraping nahi.");
  d.callout("Ek line me: PRAHARI alag-alag dark-web personas ke PUBLIC footprints ko jodta hai, unhe ek asli actor me resolve karta hai, aur batata hai ki kitna confident hai — ek published error-rate ke saath, aur ek aisa record ke saath jise koi chupke se edit nahi kar sakta.");

  d.h1("Kaise? — 5 tarah ke saboot (signals)");
  d.bullet("PGP key: do handle ek hi signing key use karte hain -> aksar ek hi banda (sabse strong saboot).");
  d.bullet("Wallet / paisa: ek hi crypto wallet cluster do markets par -> paisa real world tak jaata hai (KYC exchange, ya mixer).");
  d.bullet("Infrastructure: onion ka TLS certificate ek clearnet host ka naam de deta hai (certificate-transparency logs se, onion ko chhue bina).");
  d.bullet("Stylometry (likhne ka andaaz): shabd, punctuation, Hinglish aadatein — rebrand ke baad bhi haath nahi badalta.");
  d.bullet("Timing: kaun kab online/post karta hai. Aur ek LIVE Tor timing-correlation apne hi hidden service par — ye dikhata hai ki timing se hi visitor aur service ko jodna theoretically possible hai, bina kuch decrypt kiye.");

  d.h1("USP — asli jaadu (kyun jeetta hai)");
  d.para("Koi bhi tool ek number de sakta hai. Sawaal ye hai: jab woh number GALAT ho tab kya hota hai? Yahi PRAHARI ka core hai.", { bold: true });
  d.bullet("Honest confidence: 5 signals ko naive tarike se multiply karo to 0.999 aata hai — jhoothi certainty. PRAHARI har signal ko likelihood-ratio banata hai, ek jaisi wajah waale signals ko 'collapse' karta hai (taaki ek fact do baar na gine), aur har ek ko uski reliability se kam karta hai. Wahi saboot ab 0.84 deta hai — jo court me tik sakta hai. 0.999 case ko udwa deta hai.");
  d.bullet("Published error-rate: conformal prediction se false-merge rate ko ek risk-budget par bound karte hain. Alpha 0.05 par measured 3.1%. Ye umeed nahi, guarantee hai.");
  d.bullet("Tamper-evident record: har analyst action ko keccak-hash karke chain me jodte hain, Ed25519 se sign karte hain, aur case ka Merkle root blockchain par anchor karte hain (Polygon Amoy, zero-gas) — sirf 32-byte hash, koi PII nahi.");
  d.bullet("Rs 0 cost: pura demo bina kisi paid API key ke chalta hai. On-premise, open source.");

  d.h1("Baaki platforms se alag / strong kyun?");
  d.kv("Purane tools:", "ek 'match score' de dete hain, black-box. Correlated saboot ko independent maan lete hain -> overconfident, court me weak.");
  d.kv("PRAHARI:", "arithmetic DIKHATA hai (evidence trail), root-cause collapse karta hai, reliability se dampen karta hai, aur error-rate publish karta hai. Har number reproducible hai (python -m engine.fusion.eval).");
  d.kv("Privacy/legality:", "hum Tor nahi todte aur target hosts ko probe nahi karte — ye ek network-layer test se enforce hota hai, sirf promise nahi.");
  d.kv("Counter-deception:", "agar koi jaan-boojh kar dusre ki nakal kare (mimicry) ya LLM se style badle, PRAHARI use flag karta hai aur score ko cap karta hai — blindly merge nahi karta.");
  d.kv("Trust:", "kaam ek tamper-evident, on-chain-anchored ledger me hai. Ek record ko prove kar sakte ho bina baaki case dikhaye.");

  d.callout("Bottom line: doosre tools 'kitna match karta hai' batate hain. PRAHARI batata hai 'kitna YAKEEN karein, aur galat hone par kya' — calibrated confidence, published error-rate, aur ek record jise koi chupke se badal na sake. Yahi difference court aur real investigation me sab kuch hai.");

  d.save("1_PRAHARI_simple_hinglish.pdf");
  console.log("wrote 1_PRAHARI_simple_hinglish.pdf");
}

// ===========================================================================
// DOC 2 — Tech stack & technical deep-dive
// ===========================================================================
function doc2() {
  const d = makeDoc(
    "Tech Stack & Technical Deep-Dive",
    "Full stack, architecture, the fusion mathematics, calibration, and the technical questions a judge or engineer will ask.",
    "Tech & Architecture");
  d.cover();

  d.h1("Architecture at a glance");
  d.para("PRAHARI is a monorepo (npm workspaces) with three parts: a Next.js web app, a FastAPI 'engine', and an Anchor/Solidity contract. The browser NEVER talks to the engine directly — every call goes through a server-side proxy route (/api/engine/[...path]) with a strict allowlist, so the engine URL and any key never reach the client. The engine is source-independent: signal computations take data in and produce scores out, so the same maths runs on synthetic ground-truth or on live public feeds.");
  d.kv("Data flow:", "browser -> Next.js proxy (allowlist) -> FastAPI engine -> signal engines / graph / audit -> JSON back.");
  d.kv("Autonomy:", "APScheduler runs collection jobs; the header shows whether autonomous mode is actually running, read from the engine, not hard-coded.");

  d.h1("Frontend stack");
  d.bullet("Next.js 14 (App Router), TypeScript strict.");
  d.bullet("React Three Fiber + drei + three.js — the 3D relationship graph and the hero globe; d3-force for the 3D force layout.");
  d.bullet("A generative design system: six hand-tuned 'skins' picked before first paint (data-skin on <html>), all colour/shape/type as CSS tokens, so the app reskins itself each load without touching logic.");
  d.bullet("NextAuth (credentials) with middleware-protected /workbench; hard-navigation login to defeat a session-cookie race.");
  d.bullet("jsPDF for the one-page vector attribution report; recharts/leaflet available; framer-motion for motion.");

  d.h1("Engine (backend) stack");
  d.bullet("FastAPI on Python 3.12 (pinned via uv; never 3.14). Async endpoints; APScheduler for autonomous collection.");
  d.bullet("Neo4j GDS for the identity graph and community/centrality; Splink for probabilistic record linkage.");
  d.bullet("Stylometry: character n-grams, function words, punctuation and Hinglish markers, posting-rhythm features.");
  d.bullet("Evidence fusion: likelihood ratios, root-cause collapse, reliability dampening, split-conformal risk control.");

  d.h1("Networking — the live Tor testbed");
  d.para("PRAHARI stands up its OWN ephemeral Tor hidden service and its OWN client (via the 'stem' library), fires requests on a precise schedule, timestamps both ends, and cross-correlates the two timing streams. Because both endpoints are ours, this is legal and reproducible — a genuine network-layer result, not a mock. If Tor cannot bootstrap it falls back to a controlled replay over the SAME correlation engine, clearly badged 'simulated'.");
  d.kv("Correlation:", "primary signal is delay-invariant interval correlation (gaps between events survive RTT jitter); a binned cross-correlation corroborates and yields the circuit RTT (peak lag).");

  d.h1("Blockchain flow & audit stack");
  d.bullet("Wallet clustering: union-find over common-input (multi-input) transactions + conservative change-address heuristic; real data from mempool.space (no API key).");
  d.bullet("Off-ramp tagging: clusters matched to public exchange/mixer tag lists; a mixer in the path DROPS the financial signal (a mixer output is shared by thousands).");
  d.bullet("Tamper-evident ledger: canonical serialisation -> keccak hash -> hash chain -> Ed25519 signature; a Merkle root per case.");
  d.bullet("On-chain anchor: the Merkle root is written to Polygon Amoy (chainId 80002, zero-gas testnet; Sepolia secondary) — 32-byte hashes only, never PII. Foundry/Solidity contract; explorer link via amoy.polygonscan.com.");

  d.h1("The fusion mathematics (why 0.84, not 0.999)");
  d.para("Each signal family is converted to a likelihood ratio LR = P(evidence | same actor) / P(evidence | different actors). Independent LRs would multiply — but our signals are correlated, so naive multiplication saturates to false certainty.");
  d.bullet("Root-cause collapse: signals sharing one underlying cause (e.g. a wallet and the infra it paid for) are grouped so one fact is counted once, not several times.");
  d.bullet("Reliability dampening: each root's LR is raised to a reliability exponent r in (0,1]. A signing key (r high) counts far more than writing style (r half). Contribution = LR^r.");
  d.bullet("Posterior: prior odds x product(LR^r) = posterior odds -> calibrated probability. The worked example: naive 0.999, PRAHARI 0.840.");
  d.bullet("Counter-deception: negatives (mimicry_suspected, llm_rewrite_suspected) act as a CAP on the score, not a subtraction — they bound how sure we may be.");

  d.h1("Calibration & the published error rate");
  d.para("Calibration means 0.84 actually behaves like 84%. We report Expected Calibration Error (ECE ~0.005). For the accept/reject decision we use split-conformal prediction: choose a risk budget alpha, derive a threshold tau on held-out data, and the false-merge rate among ACCEPTED links is bounded — distribution-free and finite-sample. At alpha=0.05 we measure 3.1%, and the guarantee holds.");

  d.h1("Reproducibility & cost");
  d.kv("Every metric:", "reproducible with python -m engine.fusion.eval; figures trace to docs/METRICS.md.");
  d.kv("Cost:", "Rs 0 — the full demo needs no paid API key; Amoy is a zero-gas testnet; sources are public indexes.");
  d.kv("Tests:", "256 engine tests, 12 Solidity tests, web tests; strict typechecks.");

  d.h1("Technical Q&A (rapid-fire)");
  const tq = [
    ["Why not just multiply the signal probabilities?", "Because the signals are correlated. Multiplying assumes independence and saturates to ~0.999 — false certainty that collapses under cross-examination. Root-collapse + reliability dampening give an honest 0.84."],
    ["Do you break Tor or exploit anything?", "No. We correlate public footprints (certificate-transparency logs, public marketplace archives, public chain data). The live Tor timing demo runs entirely on our OWN hidden service and client, so it is legal and reproducible."],
    ["What makes the confidence 'calibrated'?", "We measure Expected Calibration Error (~0.005) and use split-conformal prediction to bound the false-merge rate at a chosen risk budget (3.1% at alpha=0.05). It is a probability with a measured error rate, not a black-box score."],
    ["Why Polygon Amoy for anchoring?", "It is a zero-gas public testnet (chainId 80002), so anchoring the case Merkle root costs nothing yet is publicly verifiable on amoy.polygonscan.com. Only 32-byte hashes are written — never PII. Sepolia is the secondary chain."],
    ["How do you avoid merging two different people who share, say, an email?", "Only HARD identifiers (reused PGP key, common wallet cluster) form an actor. Soft co-occurrences (a shared inbox, a co-mention) never merge on their own. Negatives can cap the score."],
    ["What is the single strongest signal?", "A reused PGP signing key. Highest reliability exponent. Writing style is deliberately the weakest, weighted at about half a key's reliability."],
    ["How is the audit trail tamper-evident?", "Each action is canonically serialised, keccak-hashed, chained to the previous hash, and Ed25519-signed. The per-case Merkle root is anchored on-chain. Any edit breaks the chain and the root no longer matches."],
    ["Can you prove one record without revealing the whole case?", "Yes — a Merkle proof verifies a single leaf against the anchored root without disclosing the other records."],
    ["What if Tor cannot bootstrap during a demo?", "It falls back to a controlled replay through the SAME correlation engine, badged 'simulated'. The maths is identical; only the transport differs, and the badge never lets a viewer be misled."],
    ["Why FastAPI + Next.js instead of one framework?", "Separation of concerns: heavy Python data/graph/ML in the engine; a fast typed UI in Next.js. The proxy keeps the engine private and the browser thin."],
  ];
  tq.forEach((x, i) => d.qa(i + 1, x[0], x[1]));

  d.save("2_PRAHARI_techstack_and_technical.pdf");
  console.log("wrote 2_PRAHARI_techstack_and_technical.pdf");
}

// ===========================================================================
// DOC 3 — 150+ Q&A
// ===========================================================================
function doc3() {
  const d = makeDoc(
    "150+ Questions & Answers",
    "A comprehensive question bank covering the problem, approach, every signal, the maths, the ledger, ethics, deployment and the demo.",
    "Q&A Bank");
  d.cover();

  const groups = [
    ["The problem & the mission", [
      ["What is problem statement 26151?", "De-anonymisation and attribution of dark-web threat actors — linking the personas behind marketplace and forum activity into real actors, queryable across a timeline, using lawful means."],
      ["Who is the intended user?", "Cyber-crime investigators and intelligence analysts (e.g. NTRO context) who need defensible attribution, not just a lead."],
      ["What does 'attribution' mean here?", "Establishing that several online personas are operated by one actor, with a calibrated confidence — not identifying a legal name."],
      ["Why is dark-web attribution hard?", "Tor hides the network identity, actors rebrand often, and one person runs many handles across many markets. Signals are noisy and correlated."],
      ["Does PRAHARI claim to unmask any onion?", "No. It correlates footprints operators leaked into PUBLIC places, and demonstrates the timing principle on its own infrastructure."],
      ["What is the one-sentence pitch?", "PRAHARI links dark-web personas into one actor from public footprints and reports how confident it is — with a published error rate and a tamper-evident record."],
      ["Why the name PRAHARI?", "Praharaa means 'the sentinel'. It watches and attributes; it does not surveil private individuals."],
      ["Is this offensive or defensive security?", "Defensive / investigative. Passive correlation of public data, with legality enforced by design."],
      ["What is out of scope?", "Breaking Tor, scraping live marketplaces, probing target hosts, and identifying legal identities of private individuals."],
      ["What does 'queryable across a timeline' mean?", "Each actor's activity is bucketed over time so an analyst can see when personas appeared, went quiet, or a rebrand happened."],
    ]],
    ["The approach & signals", [
      ["What signal families does PRAHARI use?", "Identity keys (PGP), financial (wallets), infrastructure (onion->clearnet), linguistic (stylometry), and temporal (timing)."],
      ["Which signal is strongest?", "A reused PGP signing key — the highest reliability. Two personas signing with one key are almost certainly one actor."],
      ["Which signal is weakest?", "Stylometry (writing style), deliberately weighted at about half a signing key's reliability."],
      ["How does the wallet signal work?", "Union-find clustering over common-input transactions groups addresses one entity controls; a shared cluster across markets links personas."],
      ["What is the change-address heuristic?", "A fresh output receiving a spend's change is usually the same controller; applied conservatively because a wrong merge is a wrong attribution."],
      ["How does infrastructure pivoting work?", "An onion's TLS certificate (from certificate-transparency logs) can name a clearnet host; favicon hashes and exposed vhosts corroborate — all without touching the hidden service."],
      ["What features does stylometry use?", "Character n-grams, function-word frequencies, punctuation habits, Hinglish markers, and posting rhythm."],
      ["How is a rebrand detected?", "One persona going quiet as another appears with the same writing hand and timing signature is the shape of a rebrand."],
      ["What is the temporal signal?", "When an actor is active — posting rhythm and online windows — plus the live Tor timing-correlation demonstration."],
      ["Why combine many weak signals?", "No single public footprint is conclusive, but correlated across families they yield a defensible, calibrated attribution."],
      ["Can one signal alone create an actor?", "Only a hard identifier (PGP key, wallet cluster) can. Soft signals adjust confidence but never merge on their own."],
      ["What is a 'persona' vs an 'actor'?", "A persona is one handle on one market. An actor is the resolved real operator behind one or more personas."],
      ["How are identifiers marked as 'shared'?", "If the same identifier (key/wallet) appears across multiple personas, it is flagged shared — the strongest evidence for a link."],
      ["What is an infrastructure indicator's 'strength'?", "A 0-1 score from the pivot rules (certificate match, favicon hash, vhost) with the supporting evidence listed."],
      ["Do you scrape marketplaces live?", "No. We ingest public archives and public indexes; passivity is enforced by a network-layer test."],
    ]],
    ["The fusion mathematics", [
      ["What is a likelihood ratio (LR)?", "LR = P(evidence | same actor) / P(evidence | different actors). LR>1 supports a link; the size says how strongly."],
      ["Why not multiply LRs directly?", "Because signals are correlated. Independent multiplication saturates the score to false certainty."],
      ["What is root-cause collapse?", "Grouping signals that share one underlying cause so a single fact is counted once, not several times."],
      ["Give an example of collapse.", "A wallet and the infrastructure it paid for often share one cause; collapsed, they contribute as one root, not two."],
      ["What is reliability dampening?", "Each root's LR is raised to an exponent r in (0,1]. Contribution = LR^r, so unreliable signals count less."],
      ["What reliability does a PGP key get?", "A high exponent (near 0.9 in the worked example) — it is very reliable."],
      ["What reliability does stylometry get?", "About 0.5 — half a signing key — because style can be imitated or drift."],
      ["How is the final probability computed?", "prior odds x product(LR^r) = posterior odds, converted to a calibrated probability."],
      ["What is the worked example result?", "Naive independent stacking gives 0.999; PRAHARI's root-collapsed, reliability-dampened score is 0.840."],
      ["Why is 0.84 better than 0.999?", "0.84 survives cross-examination; 0.999 is false certainty that gets a case thrown out."],
      ["What are 'negatives'?", "Evidence against a link (mimicry_suspected, llm_rewrite_suspected). They cap the score rather than subtracting from it."],
      ["Why cap instead of subtract?", "A capping bounds how sure we may be given deception risk, without arbitrarily deleting genuine evidence."],
      ["What does the evidence trail show?", "The per-root s, LR, r and LR^r, the collapses applied, the prior/posterior odds, and that the trail recomputes the score exactly."],
      ["What does 'trail recomputes score: exact' mean?", "The displayed arithmetic reproduces the final probability; a score whose trail cannot recompute it is not trustworthy."],
      ["What is 'prior odds'?", "The base rate before evidence — e.g. 1:10 for a blocked candidate — updated by the LRs into posterior odds."],
    ]],
    ["Calibration & error rates", [
      ["What is calibration?", "That a stated probability matches reality — 0.84 should be right about 84% of the time."],
      ["What is ECE?", "Expected Calibration Error — the average gap between confidence and accuracy. PRAHARI's is ~0.005."],
      ["What is split-conformal prediction?", "A distribution-free method to bound the error rate among accepted decisions at a chosen risk budget, using held-out data."],
      ["What is the false-merge rate?", "The fraction of ACCEPTED links that are wrong. Bounded at 3.1% for alpha=0.05."],
      ["What is alpha?", "The risk budget you choose. Lower alpha = stricter threshold = fewer, safer accepts."],
      ["What is tau?", "The score threshold derived from alpha on held-out data; links above tau are accepted."],
      ["Does the guarantee actually hold?", "Yes — measured on evaluation data the empirical false-merge rate stays within the bound."],
      ["Is the guarantee distribution-free?", "Yes, and finite-sample — it does not assume a data distribution or need asymptotics."],
      ["Why does behavioural analysis use synthetic ground truth?", "The public marketplace archive we ingest carries no reliable timestamps/labels, so behaviour is validated on labelled synthetic data — stated openly."],
      ["How do I reproduce the metrics?", "Run python -m engine.fusion.eval; every figure traces to docs/METRICS.md."],
    ]],
    ["The ledger & blockchain", [
      ["Why a tamper-evident ledger?", "Attribution evidence must be defensible; the record of analyst actions must be provably unaltered."],
      ["How is the ledger built?", "Each action is canonically serialised, keccak-hashed, chained to the previous hash, and Ed25519-signed."],
      ["What is the Merkle root?", "A single hash summarising all records in a case; anchoring it fixes the whole case in time."],
      ["What is anchored on-chain?", "Only the 32-byte Merkle root — never any personal or case content."],
      ["Which chain and why?", "Polygon Amoy (chainId 80002), a zero-gas public testnet, so anchoring is free yet publicly verifiable. Sepolia is secondary."],
      ["How do I verify an anchor?", "Via the explorer link (amoy.polygonscan.com) to the transaction that recorded the root."],
      ["Can a single record be proven?", "Yes — a Merkle proof checks one leaf against the anchored root without revealing the others."],
      ["What signs the records?", "An Ed25519 key held by the engine; signatures accompany each record."],
      ["What breaks if someone edits a record?", "The hash chain breaks and the recomputed Merkle root no longer matches the anchored one — tampering is evident."],
      ["Does anchoring cost money?", "No — Amoy is zero-gas. That keeps the whole system at Rs 0 to run."],
      ["What is wallet clustering used for?", "To follow money to a real-world off-ramp (a KYC exchange) or to detect laundering through a mixer."],
      ["What happens if funds pass through a mixer?", "The financial signal is DROPPED for attribution — a mixer output is shared by thousands, so it is not evidence of a common controller."],
      ["Where does chain data come from?", "mempool.space public API (no key) for Bitcoin; tag lists mark known exchanges/mixers."],
      ["What are co-spent edges?", "Address pairs proven to share a controller by appearing as inputs of one transaction; they build the identity graph."],
      ["Is the contract audited/tested?", "It ships with Solidity tests (12) via Foundry; anchoring writes only hashes."],
    ]],
    ["The live Tor timing demo", [
      ["What does the Tor demo prove?", "That traffic-timing alone can link a visitor to a hidden service without decrypting anything — the real principle behind onion de-anonymisation."],
      ["Is it legal?", "Yes — both the hidden service and the client are ours, so observing and correlating their timing is legal and reproducible."],
      ["How long does a run take?", "About 30-40 seconds — a real Tor circuit must bootstrap and then probe the service."],
      ["What is interval correlation?", "Correlating the gaps between consecutive events at each end; gaps survive variable network delay, so it is delay-invariant."],
      ["What is the peak lag?", "The offset at which the two streams align best — effectively the circuit round-trip time."],
      ["What confidence does a good run give?", "Around 0.6-0.7 with a strong interval correlation (e.g. r~0.8) over ~20 matched events."],
      ["What if the correlation is low?", "Small samples are noisy; wider request gaps prevent response reordering and keep the interval correlation sharp."],
      ["What is the 'simulated' badge?", "When Tor cannot bootstrap, a controlled replay runs through the same maths, clearly labelled so nothing is misrepresented."],
      ["Does the demo touch anyone else's service?", "No — only our own ephemeral hidden service and client."],
      ["Why does this matter for attribution?", "It shows that network-layer timing is a real signal an operator with a lawful vantage point could use — honestly scoped."],
    ]],
    ["Tech stack & architecture", [
      ["What is the frontend?", "Next.js 14 App Router, TypeScript, React Three Fiber for 3D, a generative CSS-token skin system, NextAuth for access."],
      ["What is the backend?", "A FastAPI 'engine' on Python 3.12, with APScheduler, Neo4j GDS, Splink, and the fusion/audit modules."],
      ["How does the browser reach the engine?", "Only through a Next.js proxy route with a strict allowlist; the engine URL/key never reach the client."],
      ["What renders the 3D graph?", "React Three Fiber + three.js with a d3-force 3D layout, normalised so the graph always frames itself."],
      ["What is the skin system?", "Six hand-tuned palettes chosen before first paint; all colour/shape/type are CSS tokens, so the app reskins each load without touching logic."],
      ["Why pin Python 3.12?", "Stability of the data/ML stack; 3.14 is explicitly avoided. Managed via uv."],
      ["What database backs the graph?", "Neo4j with the Graph Data Science library for community and centrality."],
      ["What does Splink do?", "Probabilistic record linkage — scalable candidate matching feeding the fusion layer."],
      ["Is there autonomous collection?", "Yes — APScheduler jobs; the UI shows whether autonomous mode is actually running, read from the engine."],
      ["How is login secured?", "NextAuth credentials with middleware-protected /workbench and a hard-navigation login that avoids a session-cookie race."],
      ["What generates the PDF report?", "jsPDF — a one-page vector report, crisp and tiny, on a fixed professional palette."],
      ["How many tests are there?", "256 engine tests, 12 Solidity tests, plus web tests and strict typechecks."],
      ["Is it a monorepo?", "Yes — npm workspaces for web/, engine/, and the anchor/contract."],
      ["What 3D powers the hero?", "A point-cloud globe (R3F) that reads the live skin accent, with threat arcs — the hero's 3D component."],
      ["How is cost kept at zero?", "Public data sources with no key, a zero-gas testnet, and open-source libraries throughout."],
    ]],
    ["Ethics, privacy & legality", [
      ["Does PRAHARI surveil private individuals?", "No. It attributes threat-actor personas from public footprints; it is not mass surveillance."],
      ["What data does it use?", "Public indexes and archives, certificate-transparency logs, public chain data — nothing that requires intrusion."],
      ["Is PII written on-chain?", "Never — only 32-byte hashes are anchored."],
      ["How is passivity enforced?", "By a network-layer test, not merely a policy statement."],
      ["What about wrong attributions?", "The whole design is about bounding that risk: calibrated confidence, a published false-merge rate, and honest caps for deception."],
      ["Can the evidence be challenged in court?", "Yes — the arithmetic is shown and reproducible, and the record is tamper-evident and anchored."],
      ["Does it respect the problem statement's legal framing?", "Yes — lawful, public-source correlation; no Tor exploitation."],
      ["What are the stated limits?", "It does not break Tor, does not scrape live markets, uses synthetic ground truth for behaviour, and treats stylometry as the weakest signal."],
      ["Why publish limitations?", "A system that states its limits can be checked — that is the point of the design."],
      ["Could it be misused?", "It is scoped to public data and investigative use; the tamper-evident, auditable trail discourages misuse."],
    ]],
    ["Competitors & differentiation", [
      ["How is PRAHARI different from a black-box match score?", "It shows the arithmetic, collapses correlated evidence, dampens by reliability, and publishes an error rate."],
      ["Why not use an existing chain-analysis tool alone?", "Those follow money but do not fuse it with stylometry, infra and timing into a calibrated cross-market actor identity."],
      ["Why not an OSINT graph tool alone?", "Graph tools show links; they do not quantify how sure a link is, nor bound the false-merge rate."],
      ["What is PRAHARI's core USP?", "Honest, calibrated confidence with a published error rate, plus a tamper-evident, on-chain-anchored record."],
      ["Why does calibration win engagements?", "Because a defensible number that survives cross-examination is worth more than an impressive but brittle 0.999."],
      ["What stops false merges that hurt competitors?", "Root-collapse, reliability dampening, hard-identifier-only merging, and deception caps."],
      ["Why is the on-chain anchor a differentiator?", "It makes the evidence chain publicly verifiable and tamper-evident at zero cost."],
      ["Is the live Tor demo unique?", "It concretely demonstrates the timing principle on legal, own infrastructure — a rare, honest touch."],
      ["Why does 'reproducible metrics' matter competitively?", "Judges and courts can re-run the numbers; nothing is asserted without proof."],
      ["What is the deployment advantage?", "Runs fully on-premise at Rs 0, no paid keys — important for sensitive agencies."],
    ]],
    ["Demo & product", [
      ["What is the workbench?", "The analyst cockpit: an actor list, the 3D relationship graph, the full actor profile, and tabbed proof panels (evidence, Tor timing, chain flow, ledger)."],
      ["How do I read the relationship graph?", "Node colour = entity type (legend), size = importance, edge thickness = evidence strength; shared identifiers pull personas together, a decoy drifts to the rim. Hover any node for its name."],
      ["What is the maximise/holo mode?", "The graph goes fullscreen with a '4D holo space' backdrop (deep space, nebula, holographic grid, starfield); Esc restores it."],
      ["What is the evidence trail panel?", "The per-root LR arithmetic and the PRAHARI-vs-naive comparison — the argument, shown."],
      ["What is the actor profile Preview?", "A one-page attribution report preview; the Download button writes a real PDF."],
      ["How does the app 'regenerate' each load?", "A random skin (palette, type, shape, rail side) is applied before paint; a control lets you reshuffle or lock it."],
      ["Can I export an actor?", "Yes — JSON, CSV, and the one-page PDF report."],
      ["What does the header tell me?", "Whether autonomous collection is running and the live false-merge rate and ECE, read from the engine."],
      ["What are the confidence bands in the list?", "Actors grouped as Strong case / Worth a look / Weak-unresolved, each collapsible, so the list reads as structure."],
      ["Is the demo fully offline?", "Yes for the core; chain and Tor demos use public endpoints but need no keys."],
    ]],
    ["Limitations & future", [
      ["What is the biggest limitation?", "Behavioural ground truth is synthetic because the ingested archive lacks timestamps; this is stated openly."],
      ["Is stylometry reliable alone?", "No — it is the weakest signal and weighted accordingly; it supports but never decides."],
      ["Can actors defeat the system?", "They can try (mimicry, LLM rewrites); PRAHARI flags and caps for these, and leans on hard identifiers."],
      ["What would production add?", "Live public-feed connectors, more tag lists, mainnet anchoring, and broader stylometry corpora."],
      ["Does it scale?", "The engine is source-independent and graph-backed (Neo4j GDS, Splink) for scalable linkage."],
      ["How current is the data?", "The header shows source freshness and 24h intake; autonomous jobs refresh the graph."],
      ["What is the false-merge target in production?", "A chosen alpha sets it; lower alpha trades recall for fewer wrong merges."],
      ["Could other chains be supported?", "Yes — the anchor is chain-agnostic; Amoy and Sepolia are wired, mainnet is a config change."],
      ["What about non-English actors?", "Stylometry includes Hinglish markers; more language models can be added."],
      ["What is the north-star?", "Attribution you can defend: calibrated, reproducible, tamper-evident, and honest about what it cannot do."],
    ]],
    ["Investigator workflow", [
      ["How does an analyst start a case?", "Open the workbench, pick a strong-case actor from the banded list, and read its profile and relationship graph."],
      ["How do I check why two personas are linked?", "Click the linkage (or a persona-pair edge in the graph) to open the evidence trail for that pair."],
      ["How do I follow the money?", "Open the Chain flow tab, or click a wallet identifier's 'trace on chain' action to see its cluster and off-ramps."],
      ["How do I demonstrate the timing attack?", "Open the Tor timing tab and press Run; a real circuit bootstraps and the confidence appears in ~30-40s."],
      ["How do I produce a shareable report?", "Click Preview in the actor profile, then Download to save a one-page PDF."],
      ["How do I prove the record is intact?", "Open the Ledger tab; it verifies the hash chain and shows the anchored Merkle root and explorer link."],
      ["Can I search by a wallet or key?", "Yes — the actor search matches handle, PGP, wallet or actor id."],
      ["How do I filter to only strong cases?", "Use the confidence filter (>=0.90) or the Strong-case band at the top of the list."],
      ["What if the engine is offline?", "Panels show an 'engine offline' message instead of failing silently; the UI degrades gracefully."],
      ["How do I reset the graph view?", "Use the reset control in the graph header; maximise gives a fullscreen holo view, Esc restores."],
      ["Can two analysts get the same result?", "Yes — scores are deterministic and reproducible, and the ledger records who did what."],
      ["How do I read the timeline?", "The profile timeline buckets each persona's activity over time so appearances, gaps and rebrands are visible."],
    ]],
    ["Data, sources & operations", [
      ["Where do PGP keys and handles come from?", "Public marketplace/forum archives and public key material operators posted themselves."],
      ["Where does infrastructure evidence come from?", "Certificate-transparency logs, public scan data, favicon hashes — never by probing the hidden service."],
      ["Where does financial data come from?", "Public blockchain data via mempool.space (no key), plus public exchange/mixer tag lists."],
      ["Is any data collected intrusively?", "No — every source is a public index or archive that already holds the data."],
      ["How fresh is the data?", "The header reports per-source freshness and 24-hour intake; autonomous jobs refresh the graph on a schedule."],
      ["What happens to stale sources?", "They are shown as stale in the header so the analyst knows the intake state."],
      ["Can new sources be added?", "Yes — the engine is source-independent; a connector feeds the same signal engines."],
      ["Is the data stored on-premise?", "Yes — the whole system runs on-premise; nothing is sent to third-party clouds by default."],
      ["What is the actor 'provenance' block?", "Markets, categories, active range, last-scan time and sources — the chain of custody for each actor."],
      ["How large can the graph get?", "Neo4j GDS and Splink handle scalable linkage; the UI graph focuses on one actor's neighbourhood for readability."],
      ["Does it need internet to run?", "The core runs offline; the chain and Tor demonstrations use public endpoints when available."],
      ["Is there rate limiting?", "Yes — API routes are rate-limited to keep the service stable."],
    ]],
  ];

  let n = 1;
  for (const [title, items] of groups) {
    d.h1(title);
    for (const [q, a] of items) d.qa(n++, q, a);
  }
  d.callout("Total: " + (n - 1) + " questions. Every technical claim is reproducible with python -m engine.fusion.eval and traces to docs/METRICS.md.");

  d.save("3_PRAHARI_150_questions_and_answers.pdf");
  console.log("wrote 3_PRAHARI_150_questions_and_answers.pdf (" + (n - 1) + " Q&A)");
}

// ===========================================================================
// DOC 4 — All data features explained (simple, both audiences)
// ===========================================================================
function doc4() {
  const d = makeDoc(
    "Every Data Feature, Explained Simply",
    "What each piece of data and every panel means — in the simplest English, for technical and non-technical readers alike.",
    "Data Features");
  d.cover();

  const feat = (name, simple, deeper) => { d.h2(name); d.para("In simple words: " + simple); d.para("A little deeper: " + deeper, { color: [70, 74, 82] }); };

  d.h1("The big idea, in one breath");
  d.para("Think of a criminal who wears many masks online. Each mask (a 'persona') looks different, but the person behind them keeps making the same small habits — the same signature key, the same wallet, the same way of typing. PRAHARI collects those habits from public places and figures out which masks are the same person, and how sure we can be.");

  d.h1("The core things PRAHARI tracks");
  feat("Actor",
    "The real person behind the masks. This is what we are trying to identify.",
    "An 'actor' is the resolved identity that one or more personas roll up into, with an attribution confidence attached.");
  feat("Persona",
    "One mask — a single username on a single marketplace or forum.",
    "A persona has a handle, a market, a first/last-seen date, a post count and categories. Several personas can belong to one actor.");
  feat("Attribution confidence",
    "How sure we are, from 0 to 1. 0.84 means about 84% sure.",
    "A calibrated probability from the fusion engine, shown as a degree (not a yes/no), with a published error rate behind it.");
  feat("Identifier",
    "A hard clue tied to a persona — a signing key, a wallet, an email, an onion.",
    "Identifiers can be 'shared' across personas; a shared hard identifier (PGP/wallet) is the strongest reason to link two masks.");
  feat("Infrastructure indicator",
    "A clearnet (normal internet) address linked to a hidden onion site.",
    "Recovered from certificate-transparency logs, favicon hashes or exposed vhosts, each with a strength and the evidence behind it.");
  feat("Linkage",
    "A single 'these two masks are the same' claim, with its own confidence.",
    "A pair score between two personas; clicking it opens the full evidence trail for that pair.");
  feat("Flags (counter-deception)",
    "Warnings that someone might be faking it — copying another's style, or using AI to rewrite.",
    "mimicry_suspected / llm_rewrite_suspected act as a CAP on confidence, so we do not over-trust a link that could be a trap.");

  d.h1("The numbers on the screen");
  feat("PRAHARI score vs Naive stacking",
    "Two numbers side by side: our honest score, and the naive over-confident one.",
    "Naive multiplies signals as if independent (0.999); PRAHARI collapses shared causes and dampens by reliability (0.840).");
  feat("Likelihood ratio (LR) by root",
    "How strongly each type of clue points to 'same person'.",
    "Per root we show s (strength), LR, r (reliability), and LR^r (the reliability-adjusted contribution), each with a bar.");
  feat("Prior / posterior odds",
    "Where we started before the clues, and where we ended after them.",
    "prior odds x product(LR^r) = posterior odds, converted to the final calibrated probability."
  );
  feat("False-merge rate & alpha",
    "Out of the links we accept, how many are wrong — kept under a limit we choose.",
    "Split-conformal prediction bounds it (3.1% at alpha=0.05); the guarantee is distribution-free and finite-sample.");
  feat("ECE (calibration error)",
    "Whether our confidence tells the truth — does 0.84 really behave like 84%?",
    "Expected Calibration Error ~0.005 means the stated probabilities are trustworthy.");

  d.h1("The panels in the workbench");
  feat("Actor list",
    "The menu of suspects, grouped by how strong the case is.",
    "Banded into Strong case / Worth a look / Weak-unresolved, searchable by handle, PGP, wallet or id, with confidence filters.");
  feat("Relationship graph (3D)",
    "A picture of the masks and clues, joined by lines. Thicker line = stronger clue.",
    "R3F + d3-force. Colour = type (legend), size = importance; shared identifiers pull personas together, a decoy drifts to the rim. Hover for names; click for a detail card. Maximise for a fullscreen holo-space view.");
  feat("Actor profile",
    "Everything about one suspect on one page.",
    "Headline confidence, basis, flags, personas, identifiers (clickable — copy / trace on-chain), infrastructure, timeline, linkages and provenance. Preview -> one-page PDF report."
  );
  feat("Evidence trail",
    "The 'show your working' panel — why the number is what it is.",
    "The PRAHARI-vs-naive comparison, the per-root LR breakdown, collapses, negatives/caps, and a check that the trail recomputes the score exactly."
  );
  feat("Tor timing correlation",
    "A live little experiment proving timing can link a visitor to a hidden site.",
    "Runs our own hidden service + client through real Tor, lines up the timing at both ends, and shows a confidence with the circuit RTT."
  );
  feat("Chain flow",
    "Following the money to where it touches the real world.",
    "Wallet clustering (common-input + change), off-ramp tags (exchange/mixer); a mixer in the path drops the financial signal."
  );
  feat("Ledger (audit)",
    "The unbreakable logbook of everything analysts did.",
    "keccak-hashed, chained, Ed25519-signed records with a Merkle root anchored on Polygon Amoy; verify a single record without revealing the rest."
  );
  feat("Header status",
    "A quick trust check at the top: is collection running, and how good are we?",
    "Live autonomous status, false-merge rate at the current alpha, and ECE — all read from the engine, not hard-coded."
  );

  d.h1("Provenance — where every fact comes from");
  d.para("For each actor we record the markets, categories, active date range, last scan time, and the sources. This is the chain of custody: an analyst can always see WHEN a fact was collected and from WHERE, which is what makes the attribution auditable.");

  d.callout("Remember: PRAHARI never asks you to trust it blindly. Every number can be opened up (evidence trail), re-run (python -m engine.fusion.eval), and verified (on-chain anchor). That is the whole point — attribution you can check.");

  d.save("4_PRAHARI_data_features_explained.pdf");
  console.log("wrote 4_PRAHARI_data_features_explained.pdf");
}

doc1(); doc2(); doc3(); doc4();
console.log("\nAll docs written to: " + OUT);
