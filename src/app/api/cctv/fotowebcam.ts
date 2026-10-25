import { stealthFetch } from '@/lib/stealthFetch';
import type { CctvCamera } from './types';

/**
 * OSIRIS — foto-webcam.eu
 * Source: https://www.foto-webcam.eu — a non-profit network of high-resolution
 * still webcams across the Alps and southern Germany (~400 cameras: Austria,
 * Bavaria, South Tyrol, Switzerland). NO API KEY NEEDED.
 *
 * Germany has almost no public traffic cameras — the Autobahn API's webcam
 * service returns nothing — so this is most of what the map can show between
 * Munich and the Alps. Every camera is a still refreshed every few minutes,
 * not video, so it is served as a snapshot.
 *
 * The site's own metadata feed lists every camera with its coordinates and the
 * current image. Offline and hidden cameras are dropped.
 */

export const FOTOWEBCAM_METADATA_URL = 'https://www.foto-webcam.eu/webcam/include/metadata.php';

/** One camera from metadata.php (only the fields we consume). */
export interface FotoWebcamRecord {
  id?: string;
  name?: string;
  title?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  imgurl?: string;
  link?: string;
  offline?: boolean;
  hidden?: boolean;
}

const COUNTRY_NAMES: Record<string, string> = {
  at: 'Austria',
  de: 'Germany',
  it: 'Italy',
  ch: 'Switzerland',
  li: 'Liechtenstein',
  cz: 'Czechia',
  si: 'Slovenia',
};

/**
 * The feed points at the 400px image. The same folder holds an 816px one,
 * which is still small (~200 KB) and far more legible in a camera tile.
 */
function largerImage(url: string): string {
  return url.replace(/\/400\.jpg$/, '/816.jpg');
}

export function mapRecord(cam: FotoWebcamRecord): CctvCamera | null {
  if (!cam.id || !cam.imgurl || cam.offline || cam.hidden) return null;
  const lat = Number(cam.latitude);
  const lng = Number(cam.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return null;

  const name = cam.name || cam.id;
  return {
    id: `fotowebcam-${cam.id}`,
    lat,
    lng,
    name,
    city: name,
    country: COUNTRY_NAMES[cam.country ?? ''] ?? (cam.country ?? '').toUpperCase(),
    feed_url: largerImage(cam.imgurl),
    external_url: cam.link,
    source: 'foto-webcam.eu',
  };
}

export async function fetchFotoWebcamCameras(): Promise<CctvCamera[]> {
  try {
    const res = await stealthFetch(FOTOWEBCAM_METADATA_URL, {
      signal: AbortSignal.timeout(12000),
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const cams: FotoWebcamRecord[] = Array.isArray(data?.cams) ? data.cams : [];
    return cams.map(mapRecord).filter((cam): cam is CctvCamera => cam !== null);
  } catch {
    return [];
  }
}
