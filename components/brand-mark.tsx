export function BrandMark({
  size = 'md',
  showName = true,
  tone = 'dark',
}: {
  size?: 'sm' | 'md';
  showName?: boolean;
  tone?: 'dark' | 'light';
}) {
  const dimension = size === 'sm' ? 'size-9' : 'size-11';
  const nameTone = tone === 'light' ? 'text-teiko-ink' : 'text-teiko-paper';
  const cityTone = tone === 'light' ? 'text-teiko-muted' : 'text-teiko-cloud';
  return (
    <span className="flex items-center gap-3">
      <img
        src="/brand/teiko-logo.jpg"
        alt="Logo Teiko Sushi"
        className={`${dimension} shrink-0 rounded-full object-cover ring-1 ring-teiko-gold/35`}
        loading="eager"
      />
      {showName && (
        <span className="min-w-0">
          <strong className={`block truncate text-base font-black tracking-[-.03em] ${nameTone}`}>
            Teiko Sushi
          </strong>
          <small className={`hidden text-xs sm:block ${cityTone}`}>
            Santa Fé do Sul
          </small>
        </span>
      )}
    </span>
  );
}
