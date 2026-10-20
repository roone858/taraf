import { describe, expect, it } from "vitest";
import {
  clip,
  extractVerification,
  fullTitle,
  normalizeOrigin,
  pageHead,
  parseSeo,
  seoIssues,
} from "@/lib/seo";

const seo = parseSeo({ siteUrl: "taraf.sa/", titleTemplate: "{title} | {store}" });

describe("seo helpers", () => {
  it("normalises the site URL to an origin", () => {
    expect(seo.siteUrl).toBe("https://taraf.sa");
    expect(normalizeOrigin("http://shop.example.com/path?x=1")).toBe("http://shop.example.com");
    expect(normalizeOrigin("  ")).toBe("");
  });

  it("accepts the whole Search Console meta tag or just the token", () => {
    expect(extractVerification('<meta name="google-site-verification" content="abc123" />')).toBe(
      "abc123",
    );
    expect(extractVerification("abc123")).toBe("abc123");
  });

  it("applies the title template, but not to the bare store name", () => {
    expect(fullTitle(seo, "طرف", "كنبة")).toBe("كنبة | طرف");
    expect(fullTitle(seo, "طرف", "طرف")).toBe("طرف");
  });

  it("clips long descriptions at a word boundary", () => {
    const text = "كلمة ".repeat(60);
    const out = clip(text, 50);
    expect(out.length).toBeLessThanOrEqual(50);
    expect(out.endsWith("…")).toBe(true);
    expect(clip("  قصير   جداً ")).toBe("قصير جداً");
  });

  it("builds absolute canonical and share-image URLs, and drops canonical on noindex", () => {
    const head = pageHead({
      seo,
      store: "طرف",
      title: "كنبة",
      path: "/product/sofa",
      image: "/a.jpg",
    });
    expect(head.links).toEqual([{ rel: "canonical", href: "https://taraf.sa/product/sofa" }]);
    expect(head.meta).toContainEqual({ property: "og:image", content: "https://taraf.sa/a.jpg" });
    const hidden = pageHead({ seo, store: "طرف", title: "x", path: "/shop", noindex: true });
    expect(hidden.links).toEqual([]);
    expect(hidden.meta).toContainEqual({ name: "robots", content: "noindex, follow" });
  });

  it("escapes < inside JSON-LD so page text can't close the script tag", () => {
    const head = pageHead({ seo, store: "طرف", jsonLd: [{ name: "</script><b>" }] });
    expect(head.scripts[0]?.children).not.toContain("</script>");
  });

  it("flags products without images or descriptions first", () => {
    const issues = seoIssues(
      [
        {
          id: "1",
          name: "أ",
          description: "وصف كافٍ وطويل بما يكفي ليتجاوز خمسين حرفاً في هذا الاختبار البسيط",
          images: ["x"],
          seo_title: null,
          seo_description: null,
        },
        {
          id: "2",
          name: "ب",
          description: null,
          images: [],
          seo_title: null,
          seo_description: null,
        },
      ],
      [],
    );
    expect(issues.map((i) => i.id)).toEqual(["2", "2"]);
    expect(issues.every((i) => i.severity === "high")).toBe(true);
  });
});
