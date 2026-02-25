type BrandLogoProps = {
  className?: string;
};

export default function BrandLogo({ className }: BrandLogoProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <svg
        aria-hidden="true"
        viewBox="0 0 72 72"
        width="30"
        height="30"
        className="shrink-0"
        fill="none"
      >
        <rect x="0" y="0" width="72" height="72" rx="14" fill="#1A6B4A" />
        <line x1="16" y1="32" x2="56" y2="32" stroke="white" strokeWidth="3" strokeLinecap="round" />
        <path d="M18 32 Q18 56 36 58 Q54 56 54 32" stroke="white" strokeWidth="3" strokeLinecap="round" fill="none" />
        <line x1="12" y1="23" x2="60" y2="40" stroke="white" strokeWidth="2.5" strokeLinecap="round" opacity="0.85" />
        <path d="M12 23 L16 18 L17.5 23" fill="white" opacity="0.85" />
        <rect x="58" y="38" width="6" height="4" rx="2" fill="white" opacity="0.65" />
      </svg>
      <span className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">
        Mise en Place
      </span>
    </span>
  );
}
