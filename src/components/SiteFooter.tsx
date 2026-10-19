import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Facebook, Instagram, Twitter, Phone, Mail, MapPin } from "lucide-react";
import { Logo } from "./Logo";
import { categoriesQuery, settingsQuery } from "@/lib/data";

export function SiteFooter() {
  const { data: s } = useQuery(settingsQuery);
  const { data: cats } = useQuery(categoriesQuery);
  const socials = [
    { url: s?.instagram_url, Icon: Instagram, label: "Instagram" },
    { url: s?.facebook_url, Icon: Facebook, label: "Facebook" },
    { url: s?.twitter_url, Icon: Twitter, label: "X" },
  ].filter((x) => x.url);

  return (
    <footer className="bg-silk text-cream/80">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 md:grid-cols-4 lg:px-10">
        <div className="md:col-span-2">
          <Logo />
          <p className="mt-6 max-w-sm text-sm leading-loose">أثاث فاخر بتفاصيل منحوتة، لمن يرى في كل قطعة عملاً فنياً.</p>
          {socials.length > 0 && (
            <div className="mt-6 flex gap-3">
              {socials.map(({ url, Icon, label }) => (
                <a
                  key={label}
                  href={url!}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="flex h-10 w-10 items-center justify-center border hairline text-gold hover:bg-gold hover:text-ink"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          )}
        </div>
        <div>
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
        <div>
          <h4 className="eyebrow mb-5">تواصل</h4>
          <ul className="space-y-3 text-sm">
            {s?.contact_phone && (
              <li className="flex items-center gap-2"><Phone className="h-4 w-4 text-gold" /><span dir="ltr">{s.contact_phone}</span></li>
            )}
            {s?.contact_email && (
              <li className="flex items-center gap-2"><Mail className="h-4 w-4 text-gold" />{s.contact_email}</li>
            )}
            {s?.address && (
              <li className="flex items-start gap-2"><MapPin className="mt-1 h-4 w-4 text-gold" />{s.address}</li>
            )}
          </ul>
        </div>
      </div>
      <div className="border-t hairline py-6 text-center text-xs text-cream/50">
        © {new Date().getFullYear()} {s?.store_name ?? "TARAF FURNITURE"}
      </div>
    </footer>
  );
}
