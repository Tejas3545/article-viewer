"use client";
import React from "react";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { DocumentUpload } from "@/components/document/DocumentUpload";
import { DocumentCard } from "@/components/document/DocumentCard";
import type { DocumentFile, DocumentMetadata } from "@/lib/types";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  BookOpenText,
  Inbox,
  FileText,
  ArrowRight,
  CalendarDays,
  UserCircle,
  Building,
  Layers,
  ChevronLeft,
  ChevronRight,
  Search,
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  generateCoverImage,
  type GenerateCoverImageInput,
} from "@/ai/flows/generate-cover-image";
import {
  extractDocumentDetails,
  type ExtractDocumentDetailsInput,
  type ExtractDocumentDetailsOutput,
} from "@/ai/flows/extract-document-details-flow";
import { cn } from "@/lib/utils";
import { db } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp, collection, onSnapshot, deleteDoc, query, orderBy, limit, startAfter, getDocs } from "firebase/firestore";

const MAX_SLIDESHOW_ITEMS = 5;
const SLIDESHOW_INTERVAL = 3000;
const DOCS_PER_PAGE = 12; // Number of documents to load per page

const getCloudinaryEnv = () => {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
  if (!cloudName || !uploadPreset) {
    console.warn(
      "Cloudinary environment variables (NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME, NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET) are not set. File uploads will not go to Cloudinary."
    );
    return null;
  }
  return { cloudName, uploadPreset };
};

const isTextPlaceholder = (
  text: string | undefined,
  docName: string | undefined,
  docType: string | undefined
): boolean => {
  if (!text || !docName) return true;

  const lowerText = text.toLowerCase();
  const lowerDocName = docName.toLowerCase();
  const lowerDocType = docType?.toLowerCase() || "";

  if (lowerText.startsWith(`could not extract text from ${lowerDocName}`))
    return true;
  if (lowerText.startsWith(`pdf content for ${lowerDocName}`)) return true;
  if (
    lowerText.startsWith(`docx content for ${lowerDocName}`) &&
    lowerText.includes(
      "(this is a placeholder text. the original file can be downloaded.)"
    )
  )
    return true;
  if (
    lowerText.startsWith(`content of ${lowerDocName}`) &&
    lowerText.includes("full parsing requires specific libraries")
  )
    return true;

  const genericPlaceholderPhrases = [
    "(this is a placeholder text. the original file can be downloaded.)",
    "full parsing requires specific libraries.",
  ];
  if (genericPlaceholderPhrases.some((phrase) => lowerText.includes(phrase))) {
    if (
      lowerText.startsWith(`could not extract text from ${lowerDocName}`) ||
      lowerText.startsWith(`pdf content for ${lowerDocName}`) ||
      lowerText.startsWith(`docx content for ${lowerDocName}`) ||
      lowerText.startsWith(`content of ${lowerDocName}`)
    ) {
      return true;
    }
  }
  if (
    lowerDocType &&
    ![
      "text/plain",
      "text/html",
      "application/json",
      "application/xml",
      "text/csv",
    ].includes(lowerDocType) &&
    lowerText.includes("placeholder text")
  ) {
    return true;
  }
  return false;
};

export default function HomePage() {
  const [documents, setDocuments] = useState<DocumentMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [slideDirection, setSlideDirection] = useState<"next" | "prev">("next");
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const { toast } = useToast();
  const slideshowIntervalRef = React.useRef<NodeJS.Timeout | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Load initial documents from Firestore
  useEffect(() => {
    setLoading(true);
    try {
      const q = query(
        collection(db, "articles"),
        orderBy("createdAt", "desc"),
        limit(DOCS_PER_PAGE)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetchedDocs = snapshot.docs.map((doc) => {
          const data = doc.data();
          
          // Handle uploadedAt timestamp properly
          let uploadedAtISO;
          try {
            if (data.uploadedAt?.toDate) {
              // Handle Firestore Timestamp
              uploadedAtISO = data.uploadedAt.toDate().toISOString();
            } else if (data.uploadedAt) {
              // Handle string or number date
              uploadedAtISO = new Date(data.uploadedAt).toISOString();
            } else {
              // Fallback to current time if no valid date
              uploadedAtISO = new Date().toISOString();
            }
          } catch (error) {
            console.warn(`Invalid date for document ${doc.id}, using current date`);
            uploadedAtISO = new Date().toISOString();
          }

          return {
            id: doc.id,
            name: data.name || "",
            type: data.type || "document",
            uploadedAt: uploadedAtISO,
            summary: data.summary || null,
            coverImageDataUri: data.coverImageDataUri || null,
            author: data.author || null,
            source: data.source || null,
            edition: data.edition || null,
            fileUrl: data.fileUrl || null,
            cloudinaryPublicId: data.cloudinaryPublicId || null,
          } as DocumentMetadata;
        });

        setDocuments(fetchedDocs);
        setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
        setHasMore(snapshot.docs.length === DOCS_PER_PAGE);
        setLoading(false);
        setError(null);
      }, (err) => {
        console.error("Error loading documents:", err);
        setError("Failed to load documents. Please try refreshing the page.");
        setLoading(false);
        toast({
          title: "Error Loading Documents",
          description: "There was a problem loading your documents. Please try again.",
          variant: "destructive",
        });
      });

      return () => {
        unsubscribe();
      };
    } catch (err) {
      console.error("Error setting up Firestore listener:", err);
      setError("Failed to connect to the database. Please check your internet connection.");
      setLoading(false);
    }
  }, [toast]);

  // Load more documents function
  const loadMoreDocuments = async () => {
    if (!hasMore || loadingMore || !lastDoc) return;

    setLoadingMore(true);
    try {
      const q = query(
        collection(db, "articles"),
        orderBy("createdAt", "desc"),
        startAfter(lastDoc),
        limit(DOCS_PER_PAGE)
      );

      const snapshot = await getDocs(q);
      const newDocs = snapshot.docs.map((doc) => {
        const data = doc.data();
        
        // Handle uploadedAt timestamp properly
        let uploadedAtISO;
        try {
          if (data.uploadedAt?.toDate) {
            // Handle Firestore Timestamp
            uploadedAtISO = data.uploadedAt.toDate().toISOString();
          } else if (data.uploadedAt) {
            // Handle string or number date
            uploadedAtISO = new Date(data.uploadedAt).toISOString();
          } else {
            // Fallback to current time if no valid date
            uploadedAtISO = new Date().toISOString();
          }
        } catch (error) {
          console.warn(`Invalid date for document ${doc.id}, using current date`);
          uploadedAtISO = new Date().toISOString();
        }

        return {
          id: doc.id,
          name: data.name || "",
          type: data.type || "document",
          uploadedAt: uploadedAtISO,
          summary: data.summary || null,
          coverImageDataUri: data.coverImageDataUri || null,
          author: data.author || null,
          source: data.source || null,
          edition: data.edition || null,
          fileUrl: data.fileUrl || null,
          cloudinaryPublicId: data.cloudinaryPublicId || null,
        } as DocumentMetadata;
      });

      setDocuments(prev => [...prev, ...newDocs]);
      setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
      setHasMore(snapshot.docs.length === DOCS_PER_PAGE);
    } catch (error) {
      console.error("Error loading more documents:", error);
      toast({
        title: "Error Loading More",
        description: "Failed to load more documents. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingMore(false);
    }
  };

  const slideshowDocuments = documents.slice(0, MAX_SLIDESHOW_ITEMS);

  const resetSlideshowInterval = useCallback(() => {
    if (slideshowIntervalRef.current) {
      clearInterval(slideshowIntervalRef.current);
    }
    if (slideshowDocuments.length > 1) {
      slideshowIntervalRef.current = setInterval(() => {
        setSlideDirection("next");
        setCurrentSlideIndex(
          (prevIndex) => (prevIndex + 1) % slideshowDocuments.length
        );
      }, SLIDESHOW_INTERVAL);
    }
  }, [slideshowDocuments.length]);

  useEffect(() => {
    resetSlideshowInterval();
    return () => {
      if (slideshowIntervalRef.current) {
        clearInterval(slideshowIntervalRef.current);
      }
    };
  }, [resetSlideshowInterval]);

  const handleFileUpload = useCallback(
    async (uploadedFile: DocumentFile & { originalFile?: File }) => {
      if (loading) return; // Don't allow uploads while loading

      let currentDocumentState: DocumentFile = { ...uploadedFile };
      let storedDocumentVersion: DocumentFile | null = null;
      let finalCoverImageDataUri: string | undefined = undefined;
      let finalAuthor: string | undefined = undefined;
      let finalSource: string = uploadedFile.source;
      let finalEdition: string | undefined = undefined;
      let docSuccessfullyStoredInLocalStorage = false;
      let cloudinaryUrl: string | undefined = undefined;
      let cloudinaryPublicId: string | undefined = undefined;

      const cloudinaryEnv = getCloudinaryEnv();

      if (uploadedFile.originalFile && cloudinaryEnv) {
        const formData = new FormData();
        formData.append("file", uploadedFile.originalFile);
        formData.append("upload_preset", cloudinaryEnv.uploadPreset);

        try {
          const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudinaryEnv.cloudName}/auto/upload`, {
            method: "POST",
            body: formData,
          });
          const data = await response.json();

          if (data.secure_url && data.public_id) {
            cloudinaryUrl = data.secure_url;
            cloudinaryPublicId = data.public_id;
            currentDocumentState.fileUrl = cloudinaryUrl;
            currentDocumentState.cloudinaryPublicId = cloudinaryPublicId;
            currentDocumentState.fileDataUri = undefined;

            toast({
              title: "File Uploaded to Cloud",
              description: `${currentDocumentState.name} successfully uploaded.`,
              duration: 3000,
            });
          } else {
            console.error(
              "Cloudinary upload response missing secure_url or public_id:",
              data
            );
            throw new Error(
              data.error?.message ||
                "Cloudinary upload failed: No secure_url or public_id returned"
            );
          }
        } catch (uploadError: any) {
          console.error("Cloudinary upload error:", uploadError);
          toast({
            title: "Cloud Upload Failed",
            description: `Could not upload ${currentDocumentState.name} to cloud storage. Will attempt to save locally. ${uploadError.message}`,
            variant: "destructive",
            duration: 5000,
          });
        }
      } else if (uploadedFile.originalFile && !cloudinaryEnv) {
        toast({
          title: "Cloudinary Not Configured",
          description:
            "Cloudinary details not found. Saving file locally. Check .env.local settings.",
          variant: "default",
          duration: 5000,
        });
      }

      try {
        localStorage.setItem(
          `docuview-doc-${currentDocumentState.id}`,
          JSON.stringify(currentDocumentState)
        );
        storedDocumentVersion = { ...currentDocumentState };
        docSuccessfullyStoredInLocalStorage = true;
        toast({
          title: "Document Processed",
          description: `${currentDocumentState.name} metadata saved.`,
          duration: 3000,
        });
      } catch (error: any) {
        let isQuotaError =
          error.name === "QuotaExceededError" ||
          (error.message && error.message.toLowerCase().includes("quota")) ||
          (error.code && (error.code === 22 || error.code === 1014));

        if (isQuotaError) {
          toast({
            title: "Storage Full: Trying Simplified Save",
            description:
              "The original file is too large for browser storage. Attempting to save essential text content only.",
            variant: "destructive",
            duration: 5000,
          });
          const docToStoreMinimal: DocumentFile = {
            ...currentDocumentState,
            fileDataUri: undefined,
            coverImageDataUri: undefined,
          };
          try {
            localStorage.setItem(
              `docuview-doc-${currentDocumentState.id}`,
              JSON.stringify(docToStoreMinimal)
            );
            storedDocumentVersion = { ...docToStoreMinimal };
            docSuccessfullyStoredInLocalStorage = true;
            toast({
              title: "Document Saved (Text Content Only)",
              description: `Text content for ${docToStoreMinimal.name} saved. Original file was too large to store for direct download. Some features like original file download may be unavailable.`,
              variant: "default",
              duration: 7000,
            });
          } catch (minimalSaveError: any) {
            console.error(
              "Error saving minimal document to localStorage:",
              minimalSaveError
            );
            toast({
              title: "Storage Error: Save Failed",
              description: `Could not save document ${currentDocumentState.name}. Even essential text content is too large for browser storage, or another storage error occurred. The document will not be added to your library.`,
              variant: "destructive",
              duration: 7000,
            });
            return;
          }
        } else {
          console.error(
            "Error saving full document to localStorage (non-quota):",
            error
          );
          toast({
            title: "Storage Error: Unexpected Issue",
            description: `Could not save document ${currentDocumentState.name} due to an unexpected storage issue. The document will not be added to your library.`,
            variant: "destructive",
            duration: 7000,
          });
          return;
        }
      }

      if (!docSuccessfullyStoredInLocalStorage || !storedDocumentVersion) {
        console.error(
          "Critical: Document was not stored in localStorage, skipping AI processing and library update."
        );
        return;
      }

      const textIsEffectivelyPlaceholder = isTextPlaceholder(
        storedDocumentVersion.textContent,
        storedDocumentVersion.name,
        storedDocumentVersion.type
      );
      const hasSufficientText =
        storedDocumentVersion.textContent &&
        storedDocumentVersion.textContent.trim().length > 10;

      if (hasSufficientText && !textIsEffectivelyPlaceholder) {
        try {
          const detailsInput: ExtractDocumentDetailsInput = {
            textContent: storedDocumentVersion.textContent,
          };
          const detailsResult: ExtractDocumentDetailsOutput =
            await extractDocumentDetails(detailsInput);

          finalAuthor = detailsResult.author;
          if (detailsResult.source) finalSource = detailsResult.source;
          finalEdition = detailsResult.edition;

          storedDocumentVersion = {
            ...storedDocumentVersion,
            author: finalAuthor,
            source: finalSource,
            edition: finalEdition,
          };
          localStorage.setItem(
            `docuview-doc-${currentDocumentState.id}`,
            JSON.stringify(storedDocumentVersion)
          );

          if (finalAuthor)
            toast({
              title: "Author Extracted",
              description: `Identified: ${finalAuthor}`,
              duration: 2000,
            });
          if (
            detailsResult.source &&
            detailsResult.source !== uploadedFile.source
          )
            toast({
              title: "Source Extracted",
              description: `Identified: ${finalSource}`,
              duration: 2000,
            });
          if (finalEdition)
            toast({
              title: "Edition Extracted",
              description: `Identified: ${finalEdition}`,
              duration: 2000,
            });
        } catch (detailsError) {
          console.error("Error extracting document details:", detailsError);
          toast({
            title: "Details Extraction Failed",
            description: "Could not extract author/source/edition.",
            variant: "destructive",
            duration: 3000,
          });
        }

        try {
          const imageInput: GenerateCoverImageInput = {
            textContent: storedDocumentVersion.textContent,
          };
          const imageResult = await generateCoverImage(imageInput);

          if (imageResult.imageDataUri) {
            const docWithCoverAttempt: DocumentFile = {
              ...storedDocumentVersion,
              coverImageDataUri: imageResult.imageDataUri,
            };
            try {
              localStorage.setItem(
                `docuview-doc-${currentDocumentState.id}`,
                JSON.stringify(docWithCoverAttempt)
              );
              finalCoverImageDataUri = imageResult.imageDataUri;
              storedDocumentVersion = docWithCoverAttempt;
              toast({
                title: "Cover Image Generated & Stored",
                description: "AI cover image created and saved.",
                duration: 3000,
              });
            } catch (errorWithCover: any) {
              let isQuotaError =
                errorWithCover.name === "QuotaExceededError" ||
                (errorWithCover.message &&
                  errorWithCover.message.toLowerCase().includes("quota"));
              if (isQuotaError) {
                toast({
                  title: "Cover Image Too Large",
                  description:
                    "Document saved, but AI cover image couldn't be stored due to size. Using placeholder.",
                  variant: "default",
                });
              } else {
                toast({
                  title: "Cover Image Storage Error",
                  description:
                    "Document saved, but AI cover image couldn't be stored due to an unexpected error.",
                  variant: "default",
                });
              }
              finalCoverImageDataUri = undefined;

              localStorage.setItem(
                `docuview-doc-${currentDocumentState.id}`,
                JSON.stringify(storedDocumentVersion)
              );
            }
          }
        } catch (genError) {
          console.error("Error generating cover image:", genError);
          toast({
            title: "Cover Image Generation Failed",
            description: `Could not generate AI cover. ${
              genError instanceof Error ? genError.message : ""
            }`,
            variant: "default",
          });
          finalCoverImageDataUri = undefined;
        }
      } else {
        if (!hasSufficientText) {
          toast({
            title: "AI Processing Skipped",
            description:
              "Text content too short for AI analysis (details, cover).",
            duration: 3000,
          });
        } else if (textIsEffectivelyPlaceholder) {
          toast({
            title: "AI Processing Skipped",
            description: "Text content is a placeholder; skipping AI analysis.",
            duration: 3000,
          });
        }
      }

      const finalMetadata: DocumentMetadata = {
        id: storedDocumentVersion.id,
        name: storedDocumentVersion.name,
        type: storedDocumentVersion.type,
        uploadedAt: storedDocumentVersion.uploadedAt,
        summary: storedDocumentVersion.summary,
        coverImageDataUri: finalCoverImageDataUri,
        author: storedDocumentVersion.author,
        source: storedDocumentVersion.source,
        edition: storedDocumentVersion.edition,
        fileUrl: storedDocumentVersion.fileUrl,
        cloudinaryPublicId: storedDocumentVersion.cloudinaryPublicId,
      };

      // Save metadata to Firestore
      try {
        const articleRef = doc(db, "articles", finalMetadata.id);
        
        // Prepare the data, converting undefined to null and handling dates
        const firestoreData = {
          id: finalMetadata.id,
          name: finalMetadata.name || null,
          type: finalMetadata.type || "document",
          uploadedAt: serverTimestamp(), // Always use serverTimestamp for the upload time
          summary: finalMetadata.summary || null,
          coverImageDataUri: finalCoverImageDataUri || null,
          author: finalMetadata.author || null,
          source: finalMetadata.source || null,
          edition: finalMetadata.edition || null,
          fileUrl: finalMetadata.fileUrl || null,
          cloudinaryPublicId: finalMetadata.cloudinaryPublicId || null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          textContent: currentDocumentState.textContent || null,
        } as const;

        const cleanedData = Object.fromEntries(
          Object.entries(firestoreData).map(([key, value]) => [key, value === undefined ? null : value])
        );

        await setDoc(articleRef, cleanedData);
        
        toast({
          title: "Document Saved",
          description: `${finalMetadata.name} saved and available to all users.`,
          duration: 3000,
        });
      } catch (error: any) {
        console.error("Error saving to Firestore:", error);
        toast({
          title: "Save Failed",
          description: `Could not save ${finalMetadata.name}. Error: ${error?.message || String(error)}`,
          variant: "destructive",
          duration: 5000,
        });
        return;
      }

      // Update local state
      setDocuments((prevDocs) => {
        const existingDocIndex = prevDocs.findIndex(
          (d) => d.id === finalMetadata.id
        );
        if (existingDocIndex > -1) {
          const updatedDocs = [...prevDocs];
          updatedDocs[existingDocIndex] = finalMetadata;
          return updatedDocs;
        }
        return [finalMetadata, ...prevDocs];
      });

      if (documents.length === 0 && slideshowDocuments.length === 0) {
        setCurrentSlideIndex(0);
      }
      resetSlideshowInterval();
    },
    [setDocuments, toast, documents.length, slideshowDocuments.length, resetSlideshowInterval, loading]
  );

  const handleDeleteDocument = useCallback(
    async (id: string) => {
      const docToDelete = documents.find((doc) => doc.id === id);

      // Delete from Firestore first
      try {
        await deleteDoc(doc(db, "articles", id));
        toast({
          title: "Document Deleted",
          description: "The document has been removed for all users.",
        });
      } catch (error: any) {
        console.error("Error deleting from Firestore:", error);
        toast({
          title: "Delete Failed",
          description: `Could not delete document. Error: ${error?.message || String(error)}`,
          variant: "destructive",
          duration: 5000,
        });
        return;
      }

      // Handle Cloudinary deletion if needed
      if (docToDelete?.fileUrl && docToDelete?.cloudinaryPublicId) {
        let resourceTypeForDelete = docToDelete.type.startsWith("image/")
          ? "image"
          : docToDelete.type.startsWith("video/")
          ? "video"
          : "raw";

        if (docToDelete.fileUrl.includes("/image/upload/")) {
          resourceTypeForDelete = "image";
        }

        try {
          const response = await fetch("/api/delete-file", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              publicId: docToDelete.cloudinaryPublicId,
              resourceType: resourceTypeForDelete,
            }),
          });
          const result = await response.json();
          if (!response.ok) {
            throw new Error(
              result.message || "Failed to delete from Cloudinary"
            );
          }
          toast({
            title: "Cloud Asset Deleted",
            description: `${docToDelete.name} removed from cloud storage.`,
            duration: 3000,
          });
        } catch (error: any) {
          console.error("Error deleting from Cloudinary:", error);
          toast({
            title: "Cloud Deletion Failed",
            description: `Could not remove ${docToDelete.name} from cloud. It will be removed from your local library. ${error.message}`,
            variant: "destructive",
            duration: 5000,
          });
        }
      }

      // Update local state
      setDocuments((prevDocs) => {
        const updatedDocs = prevDocs.filter((doc) => doc.id !== id);
        const newSlideshowLength = Math.min(
          MAX_SLIDESHOW_ITEMS,
          updatedDocs.length
        );

        if (currentSlideIndex >= newSlideshowLength && newSlideshowLength > 0) {
          setCurrentSlideIndex(newSlideshowLength - 1);
        } else if (newSlideshowLength === 0) {
          setCurrentSlideIndex(0);
        }
        return updatedDocs;
      });
      localStorage.removeItem(`docuview-doc-${id}`);
      toast({
        title: "Document Deleted",
        description: "The document has been removed from your library.",
      });
      resetSlideshowInterval();
    },
    [setDocuments, toast, currentSlideIndex, resetSlideshowInterval]
  );

  const handlePrevSlide = () => {
    if (slideshowDocuments.length > 1) {
      setSlideDirection("prev");
      setCurrentSlideIndex(
        (prevIndex) =>
          (prevIndex - 1 + slideshowDocuments.length) %
          slideshowDocuments.length
      );
      resetSlideshowInterval();
    }
  };

  const handleNextSlide = () => {
    if (slideshowDocuments.length > 1) {
      setSlideDirection("next");
      setCurrentSlideIndex(
        (prevIndex) => (prevIndex + 1) % slideshowDocuments.length
      );
      resetSlideshowInterval();
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4 md:p-8 space-y-10">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8 animate-pulse">
          <div className="md:col-span-3 h-96 bg-muted rounded-lg shadow-md"></div>
          <div className="md:col-span-2 h-96 bg-muted rounded-lg shadow-md"></div>
        </div>
        <Separator className="my-8" />
        <div>
          <div className="h-8 w-1/2 bg-muted rounded mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-72 bg-muted rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-4 md:p-8">
        <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded-lg">
          <h2 className="text-lg font-semibold">Error Loading Documents</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  const currentSlideDoc =
    slideshowDocuments.length > 0
      ? slideshowDocuments[currentSlideIndex]
      : null;
  const displaySourceSlide =
    currentSlideDoc?.source &&
    currentSlideDoc.source.toLowerCase() !== "file upload";

  const filteredDocuments = documents.filter((doc) => {
    const term = searchTerm.toLowerCase();
    if (!term) return true;
    const nameMatch = doc.name.toLowerCase().includes(term);
    const authorMatch = doc.author?.toLowerCase().includes(term) || false;
    const sourceMatch =
      doc.source && doc.source.toLowerCase() !== "file upload"
        ? doc.source.toLowerCase().includes(term)
        : false;
    const editionMatch = doc.edition?.toLowerCase().includes(term) || false;
    return nameMatch || authorMatch || sourceMatch || editionMatch;
  });

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-10">
      <section
        aria-labelledby="dashboard-top-section"
        className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        <div className="lg:col-span-3 relative overflow-hidden">
          <h2
            id="featured-document-title"
            className="text-2xl font-bold mb-4 text-primary-foreground bg-primary px-4 py-2 rounded-lg shadow-md inline-flex items-center gap-3">
            <BookOpenText className="w-7 h-7" /> Featured Documents
          </h2>
          {slideshowDocuments.length > 1 && (
            <>
              <Button
                variant="outline"
                size="icon"
                onClick={handlePrevSlide}
                className="absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-background/70 hover:bg-background/90"
                aria-label="Previous slide">
                <ChevronLeft className="w-6 h-6" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={handleNextSlide}
                className="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-background/70 hover:bg-background/90"
                aria-label="Next slide">
                <ChevronRight className="w-6 h-6" />
              </Button>
            </>
          )}
          {currentSlideDoc ? (
            <Card
              key={currentSlideDoc.id + slideDirection}
              className={cn(
                "shadow-xl hover:shadow-2xl transition-shadow duration-300 rounded-lg border border-primary/30 overflow-hidden min-h-[400px] flex flex-col",
                "animate-in duration-500 ease-out",
                slideDirection === "prev"
                  ? "slide-in-from-left"
                  : "slide-in-from-right"
              )}>
              <CardHeader className="pb-3">
                <Image
                  src={currentSlideDoc.coverImageDataUri || ""}
                  alt={
                    currentSlideDoc.coverImageDataUri
                      ? `Cover for ${currentSlideDoc.name}`
                      : "Abstract document representation"
                  }
                  width={600}
                  height={300}
                  className="w-full h-48 object-cover rounded-t-md bg-muted"
                  data-ai-hint="document abstract"
                  priority={slideshowDocuments.indexOf(currentSlideDoc) === 0}
                  unoptimized={!!currentSlideDoc.coverImageDataUri}
                />
                <CardTitle
                  className="text-xl font-semibold leading-tight mt-4 truncate"
                  title={currentSlideDoc.name}>
                  {currentSlideDoc.name}
                </CardTitle>
                <div className="text-xs text-muted-foreground space-y-1 pt-1">
                  <div className="flex items-center gap-1">
                    <CalendarDays className="w-3 h-3" />
                    Uploaded:{" "}
                    {currentSlideDoc.uploadedAt
                      ? format(
                          new Date(currentSlideDoc.uploadedAt),
                          "MMM d, yyyy"
                        )
                      : "N/A"}
                  </div>
                  {currentSlideDoc.author && (
                    <div
                      className="flex items-center gap-1 truncate"
                      title={`Author: ${currentSlideDoc.author}`}>
                      <UserCircle className="w-3 h-3" />
                      Author: {currentSlideDoc.author}
                    </div>
                  )}
                  {displaySourceSlide && (
                    <div
                      className="flex items-center gap-1 truncate"
                      title={`Source: ${currentSlideDoc.source}`}>
                      <Building className="w-3 h-3" />
                      Source: {currentSlideDoc.source}
                    </div>
                  )}
                  {currentSlideDoc.edition && (
                    <div
                      className="flex items-center gap-1 truncate"
                      title={`Edition: ${currentSlideDoc.edition}`}>
                      <Layers className="w-3 h-3" />
                      Edition: {currentSlideDoc.edition}
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex-grow">
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {currentSlideDoc.summary
                    ? currentSlideDoc.summary
                    : `Type: ${currentSlideDoc.type || "document"}`}
                </p>
              </CardContent>
              <div className="p-4 pt-2">
                <Link href={`/documents/${currentSlideDoc.id}`}>
                  <Button className="w-full bg-primary hover:bg-primary/90">
                    <ArrowRight className="mr-2 h-4 w-4" /> View Document
                  </Button>
                </Link>
              </div>
            </Card>
          ) : (
            <Card className="shadow-lg rounded-lg border border-dashed border-border min-h-[400px] flex flex-col items-center justify-center text-center p-6">
              <Inbox className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <p className="text-xl font-medium text-muted-foreground">
                No documents to feature yet.
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Upload some documents to see them here!
              </p>
            </Card>
          )}
        </div>

        <div className="lg:col-span-2">
          <h2
            id="upload-section-title"
            className="text-2xl font-bold mb-4 text-primary-foreground bg-primary px-4 py-2 rounded-lg shadow-md inline-flex items-center gap-3 lg:mt-0 mt-6">
            <FileText className="w-7 h-7" /> Upload New
          </h2>
          <DocumentUpload onFileUpload={handleFileUpload} />
        </div>
      </section>

      <Separator className="my-8 !bg-accent h-0.5 shadow-md rounded-sm" />

      <section aria-labelledby="library-section-title">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
          <h2
            id="library-section-title"
            className="text-3xl font-bold text-primary-foreground bg-primary px-4 py-2 rounded-lg shadow-md inline-flex items-center gap-3">
            <BookOpenText className="w-8 h-8" /> My Document Library
          </h2>
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              type="search"
              placeholder="Search library..."
              className="pl-10 w-full sm:w-64 md:w-80 shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Search document library"
            />
          </div>
        </div>

        {documents.length === 0 ? (
          <div className="text-center py-12 bg-card border border-dashed border-border rounded-lg">
            <Inbox className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <p className="text-xl font-medium text-muted-foreground">
              Your library is empty.
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Upload some documents to get started!
            </p>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="text-center py-12 bg-card border border-dashed border-border rounded-lg">
            <Search className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <p className="text-xl font-medium text-muted-foreground">
              No documents found matching "{searchTerm}".
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Try a different search term.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredDocuments.map((doc) => (
              <DocumentCard
                key={doc.id}
                doc={doc}
                onDelete={handleDeleteDocument}
              />
            ))}
          </div>
        )}
        
        {hasMore && !searchTerm && (
          <div className="mt-8 text-center">
            <Button
              onClick={loadMoreDocuments}
              disabled={loadingMore}
              variant="outline"
              className="min-w-[200px]"
            >
              {loadingMore ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                'Load More'
              )}
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
