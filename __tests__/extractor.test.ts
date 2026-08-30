import { describe, it, expect, afterEach } from "vitest";
import { localExtract, analyze } from "@/lib/extractor";

// INV-3: analyze() must never throw. The extractor is the only place in v1
// where a network call sits on a user-facing path, so its fallback is tested
// explicitly rather than assumed.

const originalKey = process.env.GROQ_API_KEY;
afterEach(() => {
  if (originalKey === undefined) delete process.env.GROQ_API_KEY;
  else process.env.GROQ_API_KEY = originalKey;
});

describe("localExtract — wallets", () => {
  it("extracts an ETH address", () => {
    const eth = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e";
    expect(localExtract(`send to ${eth} today`).crypto_wallets).toContain(eth);
  });

  it("extracts a bech32 BTC address", () => {
    const btc = "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq";
    expect(localExtract(`escrow ${btc}`).crypto_wallets).toContain(btc);
  });

  it("extracts a legacy P2PKH BTC address", () => {
    const btc = "1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2";
    expect(localExtract(`wallet ${btc}`).crypto_wallets).toContain(btc);
  });

  it("does not treat a short hex string as an ETH address", () => {
    expect(localExtract("colour 0xFF3B30 in the palette").crypto_wallets).toEqual([]);
  });

  it("rejects an ETH address of the wrong length", () => {
    expect(localExtract("0x742d35Cc6634C0532925a3b8").crypto_wallets).toEqual([]);
  });

  it("excludes ambiguous base58 characters from legacy BTC matches", () => {
    // 0, O, I and l are not valid base58 — a string containing them is not an address.
    expect(localExtract("1OOOOOOOOOOOOOOOOOOOOOOOOO").crypto_wallets).toEqual([]);
  });

  it("deduplicates a repeated address", () => {
    const eth = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e";
    expect(localExtract(`${eth} and again ${eth}`).crypto_wallets).toEqual([eth]);
  });

  it("finds both a BTC and an ETH address in one string", () => {
    const out = localExtract(
      "btc bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq eth 0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
    );
    expect(out.crypto_wallets).toHaveLength(2);
  });
});

describe("localExtract — contraband substring suppression", () => {
  // The taxonomy contains overlapping terms. When the longer, more specific
  // term is present, the shorter substring must not also be reported.
  it("keeps 'pistol parts' and suppresses bare 'pistol'", () => {
    const out = localExtract("selling pistol parts, discreet shipping");
    expect(out.contraband).toContain("pistol parts");
    expect(out.contraband).not.toContain("pistol");
  });

  it("keeps 'aadhaar records' and suppresses bare 'aadhaar'", () => {
    const out = localExtract("aadhaar records for sale");
    expect(out.contraband).toContain("aadhaar records");
    expect(out.contraband).not.toContain("aadhaar");
  });

  it("keeps 'counterfeit currency' and suppresses bare 'counterfeit'", () => {
    const out = localExtract("counterfeit currency, cash on meet");
    expect(out.contraband).toContain("counterfeit currency");
    expect(out.contraband).not.toContain("counterfeit");
  });

  it("still reports the short term when the long one is absent", () => {
    expect(localExtract("air pistol available").contraband).toContain("air pistol");
    expect(localExtract("aadhaar leak").contraband).toContain("aadhaar");
  });

  it("returns no duplicates", () => {
    const out = localExtract("MDMA and more mdma, plus MDMA");
    expect(new Set(out.contraband).size).toBe(out.contraband.length);
  });
});

describe("localExtract — locations", () => {
  it("matches an MP gazetteer city case-insensitively", () => {
    expect(localExtract("delivery across JABALPUR").locations).toContain("Jabalpur");
  });

  it("finds several cities in one string", () => {
    const out = localExtract("routes via Jabalpur, Katni and Bhopal");
    expect(out.locations).toEqual(expect.arrayContaining(["Jabalpur", "Katni", "Bhopal"]));
  });

  it("does not match a city name inside a longer word", () => {
    // Word-boundary anchored — "Katni" must not fire on "Katnipur".
    expect(localExtract("shipping to Katnipur").locations).not.toContain("Katni");
  });

  it("returns an empty array when no city is named", () => {
    expect(localExtract("nationwide delivery").locations).toEqual([]);
  });
});

describe("localExtract — handles", () => {
  it("extracts an @handle", () => {
    expect(localExtract("contact @nightowl_mp today").handles).toContain("@nightowl_mp");
  });

  it("ignores a bare @ with nothing after it", () => {
    expect(localExtract("email me @ the usual").handles).toEqual([]);
  });

  it("deduplicates repeated handles", () => {
    expect(localExtract("@a_b and @a_b").handles).toEqual(["@a_b"]);
  });
});

describe("localExtract — total function", () => {
  it("handles empty and whitespace input", () => {
    for (const s of ["", "   ", "\n\t"]) {
      const out = localExtract(s);
      expect(out).toEqual({ locations: [], contraband: [], crypto_wallets: [], handles: [] });
    }
  });

  it("survives regex-hostile input", () => {
    expect(() => localExtract("(((***[[[ \\ ^$.|?+ ")).not.toThrow();
  });

  it("survives a long string", () => {
    expect(() => localExtract("Jabalpur ".repeat(5000))).not.toThrow();
  });

  it("always returns all four keys as arrays", () => {
    const out = localExtract("nothing of interest here");
    for (const k of ["locations", "contraband", "crypto_wallets", "handles"] as const) {
      expect(Array.isArray(out[k])).toBe(true);
    }
  });
});

describe("analyze — INV-3, never throws and reports its engine honestly", () => {
  it("uses the local engine when no key is set", async () => {
    delete process.env.GROQ_API_KEY;
    const r = await analyze("MDMA in Jabalpur, contact @nightowl_mp");
    expect(r.source).toBe("local");
    expect(r.entities.locations).toContain("Jabalpur");
  });

  it("treats a blank key as absent", async () => {
    process.env.GROQ_API_KEY = "   ";
    const r = await analyze("LSD in Katni");
    expect(r.source).toBe("local");
  });

  it("falls back to local when the Groq call fails, and still says 'local'", async () => {
    // An invalid key makes the fetch reject or return non-2xx. Either way the
    // badge must report the engine that ACTUALLY ran, never the one we hoped for.
    process.env.GROQ_API_KEY = "invalid-key-for-test";
    const r = await analyze("ganja in Narsinghpur");
    expect(r.source).toBe("local");
    expect(r.entities.locations).toContain("Narsinghpur");
  }, 20_000);

  it("never throws on hostile input", async () => {
    delete process.env.GROQ_API_KEY;
    for (const s of ["", "\\x00", "(((", "a".repeat(10_000)]) {
      await expect(analyze(s)).resolves.toBeDefined();
    }
  });
});
