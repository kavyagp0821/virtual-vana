// src/app/api/plants/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, addDoc, serverTimestamp, doc, setDoc, writeBatch, getDoc } from 'firebase/firestore';
import type { Plant } from '@/types';
import { initialPlants } from '@/lib/initial-plant-data';

// --- Seeding Logic ---
async function seedDatabase() {
    const batch = writeBatch(db);
    const plantsCollection = collection(db, 'plants');

    console.log(`Starting to seed ${initialPlants.length} plants...`);

    initialPlants.forEach((plant) => {
        const docRef = doc(db, 'plants', plant.id);
        const plantWithTimestamp = {
            ...plant,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        };
        batch.set(docRef, plantWithTimestamp);
    });

    // Add a flag to indicate seeding is complete
    const seededRef = doc(db, 'meta', 'seeded');
    batch.set(seededRef, { status: true, seededAt: serverTimestamp() });

    await batch.commit();
    console.log("Database seeded successfully!");
}

async function checkAndSeed() {
    if (!db.app) return false; // Don't try to seed if firebase isn't configured
    const seededRef = doc(db, 'meta', 'seeded');
    try {
        const seededSnap = await getDoc(seededRef);
        if (!seededSnap.exists()) {
            console.log("Seeding flag not found. Initializing database seeding.");
            await seedDatabase();
            return true; // Indicates seeding was performed
        }
    } catch (error) {
        console.error("Error checking for seeded flag. This might happen on first run.", error);
        console.log("Attempting to seed database anyway.");
        try {
           await seedDatabase();
           return true;
        } catch (seedError) {
           console.error("Database seeding failed.", seedError);
        }
    }

    console.log("Database has already been seeded.");
    return false; // Indicates seeding was not needed
}
// --- End of Seeding Logic ---


export async function GET() {
  if (!db.app) {
    return NextResponse.json({ message: 'Firebase is not configured correctly.', code: 'unconfigured' }, { status: 500 });
  }

  try {
    await checkAndSeed();
    
    const plantsCollection = collection(db, 'plants');
    const plantSnapshot = await getDocs(plantsCollection);
    const plantsList = plantSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Plant));
    
    // Sort plants alphabetically by common name
    plantsList.sort((a, b) => a.commonName.localeCompare(b.commonName));

    return NextResponse.json(plantsList);
  } catch (e: any) {
    const errorDetails = e instanceof Error ? e.message : String(e);
    console.error('Error fetching plants from Firestore:', errorDetails);
    return NextResponse.json({ 
        message: `Internal Server Error: Could not fetch plants from database. Details: ${errorDetails}`,
        code: e.code || 'unknown'
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
    if (!db.app) {
      return NextResponse.json({ message: 'Firebase is not configured correctly.', code: 'unconfigured' }, { status: 500 });
    }
    
    try {
        const plantData: Omit<Plant, 'id'> = await request.json();
        
        if (!plantData.commonName || !plantData.latinName) {
            return NextResponse.json({ message: 'Missing required fields: commonName and latinName are required.' }, { status: 400 });
        }
        
        const plantWithMetadata = {
            ...plantData,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        };

        const docRef = await addDoc(collection(db, 'plants'), plantWithMetadata);
        
        // Return the original data along with the new ID, but without non-serializable fields
        return NextResponse.json({
            id: docRef.id,
            ...plantData
        }, { status: 201 });

    } catch (e: any) {
        const errorDetails = e instanceof Error ? e.message : String(e);
        console.error('Error storing plant in Firestore:', e);
        return NextResponse.json({ 
            message: `Internal Server Error: Could not store plant in database. Details: ${errorDetails}`,
            code: e.code || 'unknown'
        }, { status: 500 });
    }
}
