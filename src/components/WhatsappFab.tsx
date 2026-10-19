import { useQuery } from "@tanstack/react-query";
import { WhatsappIcon } from "./BrandIcons";
import { settingsQuery } from "@/lib/data";
import { normalizeWhatsappNumber } from "@/lib/whatsapp";

/**
 * Floating click-to-chat button; `end-*` places it bottom-left in RTL, bottom-right in LTR.
 * Desktop only — below lg the mobile bottom bar carries the WhatsApp action.
 */
export function WhatsappFab() {
  const { data: s } = useQuery(settingsQuery);
  const wa = normalizeWhatsappNumber(s?.whatsapp_number);
  const href = wa ? `https://wa.me/${wa}` : "https://www.whatsapp.com";

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="تواصل عبر واتساب"
      title="تواصل عبر واتساب"
      className="fixed end-5 bottom-[calc(1.25rem+env(safe-area-inset-bottom,0px))] z-30 hidden h-14 w-14 lg:flex items-center justify-center rounded-full border border-gold/60 bg-navy text-gold shadow-lg shadow-ink/40 transition-colors hover:bg-gold hover:text-ink"
    >
      <WhatsappIcon className="h-7 w-7" />
    </a>
  );
}
