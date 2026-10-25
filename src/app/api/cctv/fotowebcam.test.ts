import { describe, it, expect, vi, afterEach } from 'vitest';
import { mapRecord, fetchFotoWebcamCameras, type FotoWebcamRecord } from './fotowebcam';

/** A representative camera from metadata.php. */
const sample: FotoWebcamRecord = {
  id: 'tum-olympiapark',
  name: 'TUM Olympiapark',
  title: 'TUM Campus im Olympiapark München',
  country: 'de',
  latitude: 48.1727,
  longitude: 11.5513,
  imgurl: 'https://www.foto-webcam.eu/webcam/tum-olympiapark/current/400.jpg',
  link: 'https://www.foto-webcam.eu/webcam/tum-olympiapark/',
  offline: false,
  hidden: false,
};

describe('mapRecord', () => {
  it('maps a camera to a snapshot tile with the larger image', () => {
    expect(mapRecord(sample)).toEqual({
      id: 'fotowebcam-tum-olympiapark',
      lat: 48.1727,
      lng: 11.5513,
      name: 'TUM Olympiapark',
      city: 'TUM Olympiapark',
      country: 'Germany',
      feed_url: 'https://www.foto-webcam.eu/webcam/tum-olympiapark/current/816.jpg',
      external_url: 'https://www.foto-webcam.eu/webcam/tum-olympiapark/',
      source: 'foto-webcam.eu',
    });
  });

  it('upsizes partner cameras hosted elsewhere too', () => {
    const cam = mapRecord({ ...sample, imgurl: 'https://terra-hd.com/deutschesmuseum/img/current/400.jpg' });
    expect(cam?.feed_url).toBe('https://terra-hd.com/deutschesmuseum/img/current/816.jpg');
  });

  it('keeps an image URL it does not recognise as it is', () => {
    const cam = mapRecord({ ...sample, imgurl: 'https://example.org/cam/latest.jpg' });
    expect(cam?.feed_url).toBe('https://example.org/cam/latest.jpg');
  });

  it('drops offline, hidden and imageless cameras', () => {
    expect(mapRecord({ ...sample, offline: true })).toBeNull();
    expect(mapRecord({ ...sample, hidden: true })).toBeNull();
    expect(mapRecord({ ...sample, imgurl: undefined })).toBeNull();
    expect(mapRecord({ ...sample, id: undefined })).toBeNull();
  });

  it('drops cameras without usable coordinates', () => {
    expect(mapRecord({ ...sample, latitude: undefined })).toBeNull();
    expect(mapRecord({ ...sample, latitude: 0, longitude: 0 })).toBeNull();
  });

  it('names the country, falling back to the raw code', () => {
    expect(mapRecord({ ...sample, country: 'at' })?.country).toBe('Austria');
    expect(mapRecord({ ...sample, country: 'gl' })?.country).toBe('GL');
  });

  it('names a camera by its id when it has no name', () => {
    expect(mapRecord({ ...sample, name: undefined })?.name).toBe('tum-olympiapark');
  });
});

vi.mock('@/lib/stealthFetch', () => ({ stealthFetch: vi.fn() }));

describe('fetchFotoWebcamCameras', () => {
  afterEach(() => vi.clearAllMocks());

  it('maps every listed camera and drops the unusable ones', async () => {
    const { stealthFetch } = await import('@/lib/stealthFetch');
    vi.mocked(stealthFetch).mockResolvedValue(
      new Response(JSON.stringify({ cams: [sample, { ...sample, id: 'gone', offline: true }] })),
    );
    const cams = await fetchFotoWebcamCameras();
    expect(cams.map(c => c.id)).toEqual(['fotowebcam-tum-olympiapark']);
  });

  it('returns nothing when the feed fails', async () => {
    const { stealthFetch } = await import('@/lib/stealthFetch');
    vi.mocked(stealthFetch).mockResolvedValue(new Response('nope', { status: 503 }));
    expect(await fetchFotoWebcamCameras()).toEqual([]);
    vi.mocked(stealthFetch).mockRejectedValue(new Error('network down'));
    expect(await fetchFotoWebcamCameras()).toEqual([]);
  });
});
