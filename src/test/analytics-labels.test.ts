import { describe, it, expect } from "vitest";
import {
  flag,
  mergeByLabel,
  pageLabel,
  peopleWord,
  percentChange,
  sourceLabel,
} from "@/lib/analytics-labels";

describe("analytics labels", () => {
  it("names traffic sources", () => {
    expect(sourceLabel("l.instagram.com")).toBe("إنستجرام");
    expect(sourceLabel("www.google.com.sa")).toBe("جوجل");
    expect(sourceLabel("wa.me")).toBe("واتساب");
    expect(sourceLabel("—")).toBe("دخول مباشر");
    expect(sourceLabel("example.org")).toBe("example.org");
  });

  it("merges hosts of the same platform and keeps Others last", () => {
    const merged = mergeByLabel(
      [
        { label: "Others", pageviews: 50, visitors: 40 },
        { label: "instagram.com", pageviews: 10, visitors: 8 },
        { label: "l.instagram.com", pageviews: 5, visitors: 4 },
        { label: "google.com", pageviews: 30, visitors: 20 },
      ],
      sourceLabel,
    );
    expect(merged.map((m) => m.label)).toEqual(["جوجل", "إنستجرام", "أخرى"]);
    expect(merged[1]).toEqual({ label: "إنستجرام", pageviews: 15, visitors: 12 });
  });

  it("resolves product pages to names", () => {
    const names = new Map([["royal-carved-chair", "كرسي ملكي منحوت"]]);
    expect(pageLabel("/product/royal-carved-chair", names)).toBe("كرسي ملكي منحوت");
    expect(pageLabel("/", names)).toBe("الصفحة الرئيسية");
    expect(pageLabel("/product/unknown", names)).toBe("unknown");
  });

  it("formats flags, change and Arabic counts", () => {
    expect(flag("SA")).toBe("🇸🇦");
    expect(flag("—")).toBe("");
    expect(percentChange(120, 100)).toBe(20);
    expect(percentChange(5, 0)).toBeNull();
    expect(peopleWord(1)).toBe("شخص واحد");
    expect(peopleWord(7)).toBe("أشخاص");
    expect(peopleWord(342)).toBe("شخصاً");
  });
});
