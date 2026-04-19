import DOMPurify from "dompurify";

interface SafeHtmlProps {
  html: string | null;
  className?: string;
}

export function SafeHtml({ html, className }: SafeHtmlProps) {
  if (!html) return null;
  const clean = DOMPurify.sanitize(html);
  return <div className={className} dangerouslySetInnerHTML={{ __html: clean }} />;
}
