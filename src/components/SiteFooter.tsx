import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Facebook, Instagram, Twitter, Phone, Mail, MapPin } from "lucide-react";
import { Logo } from "./Logo";
import { SnapchatIcon, WhatsappIcon } from "./BrandIcons";
import { useCart } from "@/lib/cart";
import { categoriesQuery, settingsQuery } from "@/lib/data";
import { normalizeWhatsappNumber } from "@/lib/whatsapp";

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
    { url: s?.instagram_url || "https://www.instagram.com", Icon: Instagram, label: "Instagram" },
    { url: s?.twitter_url || "https://x.com", Icon: Twitter, label: "X" },
  ];

  return (
    <footer className="bg-silk text-cream/80">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 md:grid-cols-2 lg:grid-cols-12 lg:px-10">
        <div className="lg:col-span-4">
          <Logo variant="stacked" />
          <p className="mt-6 max-w-sm text-sm leading-loose">
            أثاث فاخر بتفاصيل منحوتة، لمن يرى في كل قطعة عملاً فنياً.
          </p>
        </div>
        <div className="lg:col-span-2">
          <h4 className="eyebrow mb-5">روابط</h4>
          <ul className="space-y-2 text-sm">
            <li>
              <Link to="/" className="hover:text-gold">
                الرئيسية
              </Link>
            </li>
            <li>
              <Link to="/shop" className="hover:text-gold">
                المتجر
              </Link>
            </li>
            <li>
              <button type="button" onClick={() => setOpen(true)} className="hover:text-gold">
                سلة التسوق
              </button>
            </li>
            <li>
              <Link to="/checkout" className="hover:text-gold">
                إتمام الطلب
              </Link>
            </li>
          </ul>
        </div>
        <div className="lg:col-span-3">
          <h4 className="eyebrow mb-5">المجموعات</h4>
          <ul className="space-y-2 text-sm">
            {cats?.map((c) => (
              <li key={c.id}>
                <Link to="/shop" search={{ cat: c.slug }} className="hover:text-gold">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="lg:col-span-3">
          <h4 className="eyebrow mb-5">تواصل</h4>
          <ul className="space-y-3 text-sm">
            {s?.contact_phone && (
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-gold" />
                <a href={`tel:${s.contact_phone}`} dir="ltr" className="hover:text-gold">
                  {s.contact_phone}
                </a>
              </li>
            )}
            {s?.contact_email && (
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-gold" />
                <a href={`mailto:${s.contact_email}`} className="hover:text-gold">
                  {s.contact_email}
                </a>
              </li>
            )}
            {s?.address && (
              <li className="flex items-start gap-2">
                <MapPin className="mt-1 h-4 w-4 text-gold" />
                {s.address}
              </li>
            )}
          </ul>
          <div className="mt-6 flex flex-wrap gap-3">
            {socials.map(({ url, Icon, label }) => (
              <a
                key={label}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                title={label}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-gold/50 text-gold transition-colors hover:bg-gold hover:text-ink"
              >
                <Icon className="h-5 w-5" />
              </a>
            ))}
          </div>
        </div>
      </div>
      <div className="border-t hairline">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-5 py-6 text-xs text-cream/50 md:flex-row lg:px-10">
          <span>
            © {new Date().getFullYear()} {s?.store_name ?? "TARAF FURNITURE"} — جميع الحقوق محفوظة
          </span>
          <span>حينما تكتمل التفاصيل… يبدأ الترف</span>
        </div>
      </div>
    </footer>
  );
}
