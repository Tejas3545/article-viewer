import { DocumentView } from '@/components/document/DocumentView';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import type { DocumentFile } from '@/lib/types';

interface DocumentPageProps {
  params: {
    id: string;
  };
}

async function getDocument(id: string): Promise<DocumentFile | null> {
  try {
    const docRef = doc(db, "articles", id); // "articles" is the collection name
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const firestoreData = docSnap.data();
      // Construct the DocumentFile object based on Firestore data.
      // textContent and fileDataUri will be missing if not in Firestore.
      // This is expected as we are moving away from localStorage as the source of truth.
      return {
        id: docSnap.id,
        name: firestoreData.name || "Unnamed Document",
        type: firestoreData.type || "application/octet-stream",
        uploadedAt: firestoreData.uploadedAt || new Date().toISOString(),
        source: firestoreData.source || "Unknown Source",
        summary: firestoreData.summary || "",
        coverImageDataUri: firestoreData.coverImageDataUri || undefined,
        author: firestoreData.author || undefined,
        edition: firestoreData.edition || undefined,
        fileUrl: firestoreData.fileUrl || undefined, // Essential: from Firestore
        cloudinaryPublicId: firestoreData.cloudinaryPublicId || undefined,
        textContent: firestoreData.textContent || `Text content for ${firestoreData.name || 'document'} is not stored directly in Firestore. Please use the file URL to access the content.`, // Add textContent if you decide to store it in Firestore
        // fileDataUri is intentionally omitted as it shouldn't be relied upon from Firestore directly.
      } as DocumentFile;
    } else {
      console.log("No such document in Firestore with id:", id);
      return null;
    }
  } catch (error) {
    console.error("Error fetching document from Firestore:", error);
    return null;
  }
}

export default async function DocumentPage({ params }: DocumentPageProps) {
  const document = await getDocument(params.id);

  if (!document) {
    return (
      <div className="container mx-auto p-4 text-center">
        <h1 className="text-2xl font-bold mt-10">Document Not Found</h1>
        <p className="text-muted-foreground">
          The document you are looking for does not exist or there was an error loading it.
        </p>
        <a href="/" className="mt-4 inline-block bg-primary text-primary-foreground px-4 py-2 rounded hover:bg-primary/90">
          Back to Library
        </a>
      </div>
    );
  }
  return <DocumentView document={document} />;
}
