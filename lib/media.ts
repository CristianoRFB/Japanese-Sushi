const OPTIMIZED_LOCAL_IMAGES: Record<string, string> = {
  '/menu/agua.png': '/menu/agua.webp',
  '/menu/combinado-teiko.png': '/menu/combinado-teiko.webp',
  '/menu/sashimi-salmao.png': '/menu/sashimi-salmao.webp',
  '/menu/sushi-atum.png': '/menu/sushi-atum.webp',
  '/menu/sushi-salmao.png': '/menu/sushi-salmao.webp',
  '/menu/temaki-salmao.png': '/menu/temaki-salmao.webp',
  '/brand/teiko-sushi-atmosphere.png': '/brand/teiko-sushi-atmosphere.webp',
};

export function optimizedImageUrl(url?: string, fallback?: string): string | undefined {
  const source = url || fallback;
  return source ? OPTIMIZED_LOCAL_IMAGES[source] || source : undefined;
}
