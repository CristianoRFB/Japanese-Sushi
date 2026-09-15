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
        className={`${dimension} shrink-0 rounded-full object-cover ring-1 ring-[#d9b66f]/35`}
        loading="eager"
      />
      {showName && (
        <span className="min-w-0">
          <strong className="block truncate text-base font-black tracking-[-.03em] text-[#fff7ea]">
            Teiko Sushi
          </strong>
          <small className="hidden text-xs text-[#d9c4cf] sm:block">
            Santa Fé do Sul
          </small>
        </span>
      )}
    </span>
  );
}
