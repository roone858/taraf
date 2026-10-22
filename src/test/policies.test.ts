import { describe, expect, it } from "vitest";
import { htmlToText, isSafeHref, sanitizeHtml } from "@/lib/sanitize";
import {
  formatPolicyDate,
  isValidPolicySlug,
  normalizePolicySlug,
  policyPath,
  policyTabLabel,
  withSectionAnchors,
} from "@/lib/policies";

describe("sanitizeHtml", () => {
  it("keeps the allowed formatting tags", () => {
    const html = "<h2>العنوان</h2><p>نص <strong>مهم</strong></p><ul><li>بند</li></ul>";
    expect(sanitizeHtml(html)).toBe(html);
  });

  it("removes scripts and other dangerous elements", () => {
    const html =
      '<p>آمن</p><script>alert(1)</script><style>body{display:none}</style><iframe src="x"></iframe>';
    expect(sanitizeHtml(html)).toBe("<p>آمن</p>");
  });

  it("strips event handlers and unknown attributes", () => {
    const html = '<p onclick="alert(1)" style="color:red">نص</p><img src=x onerror="alert(1)">';
    expect(sanitizeHtml(html)).toBe("<p>نص</p>");
  });

  it("rejects javascript: links and keeps safe ones with rel attributes", () => {
    expect(sanitizeHtml('<a href="javascript:alert(1)">x</a>')).toBe("x</a>");
    expect(sanitizeHtml('<a href="/privacy-policy" class="x">سياسة</a>')).toBe(
      '<a href="/privacy-policy" target="_blank" rel="noopener noreferrer nofollow">سياسة</a>',
    );
  });

  it("accepts external, email and telephone links only", () => {
    expect(isSafeHref("https://example.com")).toBe(true);
    expect(isSafeHref("mailto:hello@example.com")).toBe(true);
    expect(isSafeHref("tel:+201000000000")).toBe(true);
    expect(isSafeHref("/return-policy")).toBe(true);
    expect(isSafeHref("//evil.example")).toBe(false);
    expect(isSafeHref("data:text/html,<script>")).toBe(false);
  });
});

describe("htmlToText", () => {
  it("turns policy HTML into a single readable line", () => {
    expect(htmlToText("<h2>عنوان</h2><p>فقرة&nbsp;أولى</p><ul><li>بند</li></ul>")).toBe(
      "عنوان فقرة أولى بند",
    );
  });
});

describe("policy helpers", () => {
  it("validates URL slugs", () => {
    expect(isValidPolicySlug("privacy-policy")).toBe(true);
    expect(isValidPolicySlug("returns-2026")).toBe(true);
    expect(isValidPolicySlug("سياسة")).toBe(false);
    expect(isValidPolicySlug("Bad Slug")).toBe(false);
    expect(isValidPolicySlug("-bad-")).toBe(false);
  });

  it("normalizes arbitrary input into a slug", () => {
    expect(normalizePolicySlug("  Privacy Policy!  ")).toBe("privacy-policy");
    expect(normalizePolicySlug("terms___and---conditions")).toBe("terms-and-conditions");
  });

  it("builds localized paths", () => {
    expect(policyPath("privacy-policy", "ar")).toBe("/privacy-policy");
    expect(policyPath("privacy-policy", "en")).toBe("/en/privacy-policy");
  });

  it("formats last-updated dates for each language", () => {
    expect(formatPolicyDate("2026-10-22", "en")).toBe("22 October 2026");
    expect(formatPolicyDate("2026-10-22", "ar")).not.toBe("");
  });

  it("rejects slugs owned by other routes", () => {
    expect(isValidPolicySlug("policies")).toBe(false);
    expect(isValidPolicySlug("shop")).toBe(false);
  });

  it("uses short tab labels for known kinds and the title otherwise", () => {
    expect(policyTabLabel({ kind: "returns", title: "سياسة الاستبدال والاسترجاع" }, "ar")).toBe(
      "الاستبدال والاسترجاع",
    );
    expect(policyTabLabel({ kind: "privacy", title: "Privacy Policy" }, "en")).toBe("Privacy");
    expect(policyTabLabel({ kind: null, title: "Warranty" }, "en")).toBe("Warranty");
  });

  it("anchors h2 sections and lists them", () => {
    const { html, sections } = withSectionAnchors(
      "<h2>أولاً <strong>عام</strong></h2><p>x</p><h2>ثانياً</h2>",
    );
    expect(html).toBe(
      '<h2 id="section-1">أولاً <strong>عام</strong></h2><p>x</p><h2 id="section-2">ثانياً</h2>',
    );
    expect(sections).toEqual([
      { id: "section-1", title: "أولاً عام" },
      { id: "section-2", title: "ثانياً" },
    ]);
  });
});
