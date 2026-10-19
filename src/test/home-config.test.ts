import { describe, it, expect } from "vitest";
import { DEFAULT_HOME, parseHomeConfig } from "@/lib/home-config";

describe("home config", () => {
  it("falls back to the current site copy when nothing is stored", () => {
    expect(parseHomeConfig({})).toEqual(DEFAULT_HOME);
    expect(parseHomeConfig(null)).toEqual(DEFAULT_HOME);
  });

  it("keeps stored order and edits, appends missing sections, drops unknown ones", () => {
    const cfg = parseHomeConfig({
      sections: [
        { id: "faq", visible: false, eyebrow: "أسئلة", title: "عندك سؤال؟" },
        { id: "nope", visible: true },
        { id: "faq", visible: true },
        { id: "offers" },
      ],
    });
    expect(cfg.sections.slice(0, 2)).toEqual([
      { id: "faq", visible: false, eyebrow: "أسئلة", title: "عندك سؤال؟" },
      { id: "offers", visible: true, eyebrow: "عروض وتخفيضات", title: "خصومات على قطع مختارة" },
    ]);
    expect(cfg.sections).toHaveLength(DEFAULT_HOME.sections.length);
    expect(cfg.sections.map((s) => s.id)).not.toContain("nope");
  });

  it("validates image lists and caps their length", () => {
    const cfg = parseHomeConfig({ gallery: ["a.jpg", 3, "", "b.jpg"], storyImages: "bad" });
    expect(cfg.gallery).toEqual(["a.jpg", "b.jpg"]);
    expect(cfg.storyImages).toEqual(DEFAULT_HOME.storyImages);
  });
});
