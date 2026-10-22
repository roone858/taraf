import { useEffect, useRef } from "react";
import {
  Bold,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Underline,
  Undo2,
  Unlink,
} from "lucide-react";
import { sanitizeHtml } from "@/lib/sanitize";
import { isSafeHref } from "@/lib/sanitize";
import { cn } from "@/lib/utils";

/**
 * Small dependency-free rich-text editor over `contentEditable`. It only emits the formatting the
 * site knows how to render; `sanitizeHtml` runs on save and again on render, so pasted markup can
 * never introduce scripts or event handlers.
 */
export function RichTextEditor({
  value,
  onChange,
  dir = "rtl",
  placeholder,
}: {
  value: string;
  onChange: (html: string) => void;
  dir?: "rtl" | "ltr";
  placeholder?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el && value !== el.innerHTML) el.innerHTML = value;
  }, [value]);

  const sync = () => onChange(ref.current?.innerHTML ?? "");

  const run = (command: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(command, false, arg);
    sync();
  };

  const addLink = () => {
    const url = window.prompt("رابط https:// أو mailto: أو /مسار داخلي", "https://");
    if (!url) return;
    const href = url.trim();
    if (!isSafeHref(href)) {
      window.alert("الرابط غير صالح. استخدم https:// أو mailto: أو مسارًا داخليًا يبدأ بـ /");
      return;
    }
    run("createLink", href);
  };

  const onPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
    sync();
  };

  return (
    <div className="overflow-hidden rounded-lg border border-navy/15 bg-cream focus-within:border-gold focus-within:ring-2 focus-within:ring-gold/25">
      <div
        role="toolbar"
        aria-label="أدوات تنسيق المحتوى"
        dir="ltr"
        className="flex flex-wrap items-center gap-0.5 border-b border-navy/10 bg-ivory px-1.5 py-1"
      >
        <Tool label="عنوان رئيسي" onClick={() => run("formatBlock", "h2")}>
          <Heading2 className="h-4 w-4" />
        </Tool>
        <Tool label="عنوان فرعي" onClick={() => run("formatBlock", "h3")}>
          <Heading3 className="h-4 w-4" />
        </Tool>
        <Tool label="نص عادي" onClick={() => run("formatBlock", "p")}>
          <span className="text-[0.7rem] font-medium">P</span>
        </Tool>
        <Separator />
        <Tool label="غامق" onClick={() => run("bold")}>
          <Bold className="h-4 w-4" />
        </Tool>
        <Tool label="مائل" onClick={() => run("italic")}>
          <Italic className="h-4 w-4" />
        </Tool>
        <Tool label="تسطير" onClick={() => run("underline")}>
          <Underline className="h-4 w-4" />
        </Tool>
        <Separator />
        <Tool label="قائمة نقطية" onClick={() => run("insertUnorderedList")}>
          <List className="h-4 w-4" />
        </Tool>
        <Tool label="قائمة مرقمة" onClick={() => run("insertOrderedList")}>
          <ListOrdered className="h-4 w-4" />
        </Tool>
        <Tool label="اقتباس" onClick={() => run("formatBlock", "blockquote")}>
          <Quote className="h-4 w-4" />
        </Tool>
        <Separator />
        <Tool label="إضافة رابط" onClick={addLink}>
          <Link2 className="h-4 w-4" />
        </Tool>
        <Tool label="إزالة الرابط" onClick={() => run("unlink")}>
          <Unlink className="h-4 w-4" />
        </Tool>
        <Separator />
        <Tool label="تراجع" onClick={() => run("undo")}>
          <Undo2 className="h-4 w-4" />
        </Tool>
        <Tool label="إعادة" onClick={() => run("redo")}>
          <Redo2 className="h-4 w-4" />
        </Tool>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={placeholder ?? "محتوى الصفحة"}
        dir={dir}
        onInput={sync}
        onBlur={() => onChange(sanitizeHtml(ref.current?.innerHTML ?? ""))}
        onPaste={onPaste}
        data-placeholder={placeholder ?? "اكتب محتوى الصفحة القانونية…"}
        className="policy-content policy-editor min-h-56 px-4 py-3 text-sm leading-relaxed text-navy outline-none"
      />
    </div>
  );
}

function Tool({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded text-navy/75 transition-colors",
        "hover:bg-gold/20 hover:text-navy focus-visible:outline-2 focus-visible:outline-gold",
      )}
    >
      {children}
    </button>
  );
}

function Separator() {
  return <span aria-hidden className="mx-1 h-5 w-px bg-navy/15" />;
}
