import { describe, expect, it } from 'vitest';

import { optimizedImageUrl } from '../lib/media';

describe('imagens da experiência Teiko', () => {
  it('migra referências locais legadas para WebP', () => {
    expect(optimizedImageUrl('/menu/combinado-teiko.png')).toBe('/menu/combinado-teiko.webp');
    expect(optimizedImageUrl('/brand/teiko-sushi-atmosphere.png')).toBe('/brand/teiko-sushi-atmosphere.webp');
  });

  it('preserva URLs externas cadastradas pela unidade', () => {
    expect(optimizedImageUrl('https://cdn.example.com/sushi.jpg', '/menu/agua.webp')).toBe('https://cdn.example.com/sushi.jpg');
    expect(optimizedImageUrl(undefined, '/menu/agua.webp')).toBe('/menu/agua.webp');
  });
});
