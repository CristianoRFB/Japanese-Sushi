export function BrandMark({
  size = 'md',
  showName = true,
}: {
  size?: 'sm' | 'md';
  showName?: boolean;
}) {
  const dimension = size === 'sm' ? 'size-9' : 'size-11';
  return (
    <span className="flex items-center gap-3">
      <img
        src="/brand/teiko-logo.jpg"
        alt="Logo Teiko Sushi"
        className={`${dimension} shrink-0 rounded-full object-cover ring-1 ring-[#c7a773]/35`}
        loading="eager"
      />
      {showName && (
        <span className="min-w-0">
          <strong className="block truncate text-base font-black tracking-[-.03em] text-[#f3f0e8]">
            Teiko Sushi
          </strong>
          <small className="hidden text-xs text-[#c1cdc3] sm:block">
            Santa Fé do Sul
          </small>
        </span>
      )}
    </span>
  );
}
