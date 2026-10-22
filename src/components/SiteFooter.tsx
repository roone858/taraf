import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Facebook, Instagram, Twitter, Phone, Mail, MapPin } from "lucide-react";
import { Logo } from "./Logo";
import { SnapchatIcon, TiktokIcon, WhatsappIcon } from "./BrandIcons";
import { useCart } from "@/lib/cart";
import { categoriesQuery, settingsQuery } from "@/lib/data";
import { normalizeWhatsappNumber } from "@/lib/whatsapp";

const link =
  "inline-block py-1 transition-colors hover:text-gold focus-visible:text-gold focus-visible:outline-none";

export function SiteFooter() {
  const { data: s } = useQuery(settingsQuery);
  const { data: cats } = useQuery(categoriesQuery);
  const { setOpen } = useCart();
  const wa = normalizeWhatsappNumber(s?.whatsapp_number);
  const waUrl = wa ? `https://wa.me/${wa}` : null;
  // Always shown; until a profile link is set in admin settings, each icon falls back to the platform itself.
  const socials = [
    { url: waUrl ?? "https://www.whatsapp.com", Icon: WhatsappIcon, label: "WhatsApp" },
    { url: s?.facebook_url || "https://www.facebook.com", Icon: Facebook, label: "Facebook" },
    { url: s?.snapchat_url || "https://www.snapchat.com", Icon: SnapchatIcon, label: "Snapchat" },
    { url: s?.tiktok_url || "https://www.tiktok.com", Icon: TiktokIcon, label: "TikTok" },
    { url: s?.instagram_url || "https://www.instagram.com", Icon: Instagram, label: "Instagram" },
    { url: s?.twitter_url || "https://x.com", Icon: Twitter, label: "X" },
  ];
  const hasContact = !!(s?.contact_phone || s?.contact_email || s?.address);

  return (
    <footer className="bg-silk text-cream/80" aria-labelledby="footer-title">
      <h2 id="footer-title" className="sr-only">
        تذييل الموقع
      </h2>
      <div className="mx-auto grid max-w-7xl gap-12 px-5 pt-16 pb-12 md:pt-20 lg:grid-cols-12 lg:gap-10 lg:px-10">
        {/* Brand, short promise, and the ways to reach us */}
        <div className="lg:col-span-4">
          <Logo variant="stacked" />
          <p className="mt-6 max-w-sm leading-relaxed text-cream/75">
            أثاث فاخر بتفاصيل منحوتة، لمن يرى في كل قطعة عملاً فنياً.
          </p>
          <ul className="mt-6 flex flex-wrap gap-2.5" aria-label="حساباتنا">
            {socials.map(({ url, Icon, label }) => (
              <li key={label}>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  title={label}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-gold/40 text-gold transition-colors hover:border-gold hover:bg-gold hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
                >
                  <Icon className="h-[1.15rem] w-[1.15rem]" />
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* Two short link lists sit side by side even on phones */}
        <div className="grid grid-cols-2 gap-8 lg:col-span-5 lg:gap-10">
          <FooterNav title="روابط">
            <li>
              <Link to="/" className={link}>
                الرئيسية
              </Link>
            </li>
            <li>
              <Link to="/shop" className={link}>
                المتجر
              </Link>
            </li>
            <li>
              <button type="button" onClick={() => setOpen(true)} className={link}>
                سلة التسوق
              </button>
            </li>
            <li>
              <Link to="/checkout" className={link}>
                إتمام الطلب
              </Link>
            </li>
          </FooterNav>
          {cats && cats.length > 0 && (
            <FooterNav title="المجموعات">
              {cats.map((c) => (
                <li key={c.id}>
                  <Link to="/shop" search={{ cat: c.slug }} className={link}>
                    {c.name}
                  </Link>
                </li>
              ))}
            </FooterNav>
          )}
        </div>

        <div className="lg:col-span-3">
          <ColumnTitle>تواصل</ColumnTitle>
          {hasContact && (
            <ul className="space-y-3">
              {s?.contact_phone && (
                <li className="flex items-center gap-3">
                  <Phone className="h-4 w-4 shrink-0 text-gold" aria-hidden />
                  <a href={`tel:${s.contact_phone}`} dir="ltr" className={link}>
                    {s.contact_phone}
                  </a>
                </li>
              )}
              {s?.contact_email && (
                <li className="flex min-w-0 items-center gap-3">
                  <Mail className="h-4 w-4 shrink-0 text-gold" aria-hidden />
                  <a href={`mailto:${s.contact_email}`} className={`${link} min-w-0 break-all`}>
                    {s.contact_email}
                  </a>
                </li>
              )}
              {s?.address && (
                <li className="flex items-start gap-3">
                  <MapPin className="mt-1 h-4 w-4 shrink-0 text-gold" aria-hidden />
                  <span className="leading-relaxed">{s.address}</span>
                </li>
              )}
            </ul>
          )}
          {waUrl && (
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex h-11 items-center gap-2 border border-gold/50 px-5 text-sm text-gold transition-colors hover:border-gold hover:bg-gold hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
            >
              <WhatsappIcon className="h-4 w-4" /> راسلنا على واتساب
            </a>
          )}
        </div>
      </div>

      <div className="border-t border-cream/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-5 py-6 text-center text-xs text-cream/60 md:flex-row md:text-start lg:px-10">
          <span>
            © {new Date().getFullYear()} {s?.store_name ?? "TARAF FURNITURE"} — جميع الحقوق محفوظة
          </span>
          <span className="font-display text-sm text-gold/80">
            حينما تكتمل التفاصيل… يبدأ الترف
          </span>
        </div>
      </div>
    </footer>
  );
}

function ColumnTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-4 font-sans text-base text-cream">{children}</h3>;
}

function FooterNav({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <nav aria-label={title}>
      <ColumnTitle>{title}</ColumnTitle>
      <ul className="space-y-1.5 text-cream/75">{children}</ul>
    </nav>
  );
}
