import { Link } from "@tanstack/react-router";
import { LayoutDashboard, LogIn, LogOut, User } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) toast.error("تعذر تسجيل الخروج. حاول مرة أخرى.");
  else toast.success("تم تسجيل الخروج");
}

// There is no separate login route: /admin shows the sign-in form to signed-out visitors.
const iconButton =
  "relative flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold";

/** Header account icon: sign-in link when signed out, a menu with dashboard / sign-out when signed in. */
export function AccountMenu() {
  const { user, ready } = useAuthUser();

  if (!ready || !user)
    return (
      <Link to="/admin" aria-label="تسجيل الدخول" title="تسجيل الدخول" className={iconButton}>
        <User className="h-5 w-5" />
      </Link>
    );

  return (
    <DropdownMenu dir="rtl">
      <DropdownMenuTrigger aria-label="حسابي" title={user.email} className={iconButton}>
        <User className="h-5 w-5" />
        {/* Signed-in marker */}
        <span aria-hidden className="absolute top-1 end-1 h-2 w-2 rounded-full bg-gold" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={10} className="min-w-56 rounded-none bg-ivory">
        <DropdownMenuLabel className="font-normal">
          <span className="block text-xs text-muted-foreground">مسجّل الدخول باسم</span>
          <bdi className="mt-0.5 block truncate text-sm text-navy">{user.email}</bdi>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="gap-2 py-2.5">
          <Link to="/admin">
            <LayoutDashboard className="h-4 w-4 text-gold" /> لوحة التحكم
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void signOut()} className="gap-2 py-2.5 text-destructive">
          <LogOut className="h-4 w-4" /> تسجيل الخروج
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Account block for the mobile menu drawer. */
export function AccountMenuSection({ onNavigate }: { onNavigate: () => void }) {
  const { user, ready } = useAuthUser();
  const row =
    "flex h-12 items-center justify-center gap-2 border text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold";

  if (!ready || !user)
    return (
      <Link
        to="/admin"
        onClick={onNavigate}
        className={cn(
          row,
          "w-full border-cream/15 text-cream/85 hover:border-gold hover:text-gold",
        )}
      >
        <LogIn className="h-4 w-4" /> تسجيل الدخول
      </Link>
    );

  return (
    <div>
      <p className="mb-2 flex items-center gap-2 text-xs text-cream/60">
        <User className="h-3.5 w-3.5 text-gold" />
        <bdi className="truncate">{user.email}</bdi>
      </p>
      <div className="grid grid-cols-2 gap-2.5">
        <Link
          to="/admin"
          onClick={onNavigate}
          className={cn(row, "border-cream/15 text-cream hover:border-gold hover:text-gold")}
        >
          <LayoutDashboard className="h-4 w-4" /> لوحة التحكم
        </Link>
        <button
          type="button"
          onClick={() => {
            onNavigate();
            void signOut();
          }}
          className={cn(
            row,
            "border-cream/15 text-cream/75 hover:border-destructive hover:text-cream",
          )}
        >
          <LogOut className="h-4 w-4" /> تسجيل الخروج
        </button>
      </div>
    </div>
  );
}
