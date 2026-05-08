import crypto from 'crypto';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, getDoc, deleteDoc } from 'firebase/firestore';

const firebaseConfig = {
  projectId: 'gen-lang-client-0791558691',
  appId: '1:671021797730:web:ba158167e16386e3a01c3b',
  apiKey: 'AIzaSyCX52NLcwl57CnpNnN_5SdnERCuEJPz_jY',
  authDomain: 'gen-lang-client-0791558691.firebaseapp.com',
  storageBucket: 'gen-lang-client-0791558691.firebasestorage.app',
  messagingSenderId: '671021797730',
};
const DB_ID = 'ai-studio-00d52f2c-1bad-4538-971c-e963f0ca9abb';

const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(firebaseApp, DB_ID);

const CLOUDINARY_CLOUD = process.env.CLOUDINARY_CLOUD_NAME || '';
const CLOUDINARY_KEY = process.env.CLOUDINARY_API_KEY || '';
const CLOUDINARY_SECRET = process.env.CLOUDINARY_API_SECRET || '';

function extractPublicId(url: string): string | null {
  try {
    // https://res.cloudinary.com/{cloud}/{type}/upload/v{ver}/{public_id}.{ext}
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)\.[a-z0-9]+$/i);
    return match?.[1] ?? null;
  } catch { return null; }
}

async function deleteCloudinaryAsset(publicId: string, resourceType: 'image' | 'video' = 'image') {
  if (!CLOUDINARY_CLOUD || !CLOUDINARY_KEY || !CLOUDINARY_SECRET) return;
  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const sigString = `public_id=${publicId}&timestamp=${timestamp}${CLOUDINARY_SECRET}`;
    const signature = crypto.createHash('sha1').update(sigString).digest('hex');
    const body = new URLSearchParams({
      public_id: publicId,
      api_key: CLOUDINARY_KEY,
      timestamp: String(timestamp),
      signature,
    });
    await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/${resourceType}/destroy`,
      { method: 'POST', body }
    );
  } catch (err) {
    console.error('Cloudinary delete error:', publicId, err);
  }
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });

  const vehicleId = req.query?.id as string;
  if (!vehicleId) return res.status(400).json({ error: 'Missing vehicle id' });

  try {
    // Fetch vehicle to get media URLs
    const vehicleRef = doc(db, 'vehicles', vehicleId);
    const snap = await getDoc(vehicleRef);
    if (!snap.exists()) return res.status(404).json({ error: 'Vehicle not found' });

    const vehicle = snap.data() as any;

    // Collect all Cloudinary URLs (image + gallery + video if hosted on Cloudinary)
    const allUrls: { url: string; type: 'image' | 'video' }[] = [];

    if (vehicle.imageUrl?.includes('cloudinary.com')) {
      allUrls.push({ url: vehicle.imageUrl, type: 'image' });
    }
    if (Array.isArray(vehicle.gallery)) {
      for (const url of vehicle.gallery) {
        if (url?.includes('cloudinary.com')) allUrls.push({ url, type: 'image' });
      }
    }
    if (vehicle.videoUrl?.includes('cloudinary.com')) {
      allUrls.push({ url: vehicle.videoUrl, type: 'video' });
    }
    // Support explicit cloudinaryIds stored by the bot
    if (Array.isArray(vehicle.cloudinaryImageIds)) {
      for (const id of vehicle.cloudinaryImageIds) {
        if (!allUrls.some(u => extractPublicId(u.url) === id)) {
          await deleteCloudinaryAsset(id, 'image');
        }
      }
    }
    if (Array.isArray(vehicle.cloudinaryVideoIds)) {
      for (const id of vehicle.cloudinaryVideoIds) {
        await deleteCloudinaryAsset(id, 'video');
      }
    }

    // Delete extracted from URLs
    await Promise.all(
      allUrls.map(({ url, type }) => {
        const pid = extractPublicId(url);
        return pid ? deleteCloudinaryAsset(pid, type) : Promise.resolve();
      })
    );

    // Delete from Firestore
    await deleteDoc(vehicleRef);

    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error('delete-vehicle error:', err);
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
}
