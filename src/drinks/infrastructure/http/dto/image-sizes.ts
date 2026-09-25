/** Side in px of each size: the ones TheCocktailDB serves. */
const SIZES = { small: 200, medium: 350, large: 500 } as const;
type Size = keyof typeof SIZES;
const CLOUDINARY_UPLOAD = '/image/upload/';

/**
 * The drink picture in 3 sizes. Cloudinary derives them with a transformation in the URL
 * (and picks WebP/AVIF for the browser); TheCocktailDB serves them by appending a suffix.
 */
export function drinkImageSizes(
  image: string | null,
): Record<Size, string> | null {
  if (!image) return null;
  const sized = (size: Size) =>
    image.includes(CLOUDINARY_UPLOAD)
      ? image.replace(
          CLOUDINARY_UPLOAD,
          `${CLOUDINARY_UPLOAD}c_fill,w_${SIZES[size]},h_${SIZES[size]},f_auto,q_auto/`,
        )
      : `${image}/${size}`;
  return {
    small: sized('small'),
    medium: sized('medium'),
    large: sized('large'),
  };
}
