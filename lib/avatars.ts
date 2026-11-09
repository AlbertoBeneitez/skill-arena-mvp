/**
 * Built-in avatar portraits (v159). The URL carries a version: portraits are cached for a day (and revalidated for
 * a week), so replacing the images under the same name left phones showing the old face. Bump AVATAR_VERSION
 * whenever the files change. Each portrait has three crops: the square (big circle) and "-s" (192 px, small spots)
 * show the head and the shoulders (v162: the chosen avatar shows part of the body); "-t" (2:1, the picker sheet)
 * stays centred on the face.
 */
export const AVATAR_VERSION = 162;
export const PORTRAIT_COUNT = 16;
export type PortraitCrop = "" | "-s" | "-t";
const pad = (n: number) => String(n).padStart(2, "0");
export const portraitSrc = (n: number, crop: PortraitCrop = "") => `/avatars/portrait-${pad(n)}${crop}.webp?v=${AVATAR_VERSION}`;
const BUILT_IN = /^\/avatars\/portrait-(\d\d)(?:-[st])?\.webp(?:\?v=\d+)?$/;
/** The same built-in portrait at another crop and the current version; other sources (photos) pass through. */
export function portraitCrop(src: string, crop: PortraitCrop) {
  const m = BUILT_IN.exec(src);
  return m ? portraitSrc(Number(m[1]), crop) : src;
}
