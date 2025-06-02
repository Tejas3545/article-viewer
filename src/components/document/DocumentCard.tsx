"use client";
import React from 'react';
import Link from 'next/link';
import { useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  FileText,
  CalendarDays,
  ArrowRight,
  Trash2,
  Download,
  UserCircle,
  Building,
  Layers,
} from "lucide-react";
import type { DocumentMetadata, DocumentFile } from "@/lib/types";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { OptimizedImage } from '@/components/ui/optimized-image';

interface DocumentCardProps {
  doc: DocumentMetadata;
  onDelete: (id: string) => void;
}

const dataURIToBlob = (dataURI: string): Blob => {
  const splitDataURI = dataURI.split(",");
  const byteString =
    splitDataURI[0].indexOf("base64") >= 0
      ? atob(splitDataURI[1])
      : decodeURI(splitDataURI[1]);
  const mimeString = splitDataURI[0].split(":")[1].split(";")[0];

  const ia = new Uint8Array(byteString.length);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ia], { type: mimeString });
};

export function DocumentCard({ doc, onDelete }: DocumentCardProps) {
  const { toast } = useToast();

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return 'N/A';
      }
      return format(date, "MMM d, yyyy");
    } catch (error) {
      console.warn(`Invalid date: ${dateString}`);
      return 'N/A';
    }
  };

  const handleDownload = useCallback(() => {
    if (typeof window !== "undefined") {
      try {
        const item = localStorage.getItem(`docuview-doc-${doc.id}`);
        if (item) {
          const fullDoc = JSON.parse(item) as DocumentFile;

          let filename = fullDoc.name;
          const nameParts = fullDoc.name.split(".");
          const hasExtension =
            nameParts.length > 1 &&
            nameParts[nameParts.length - 1].length > 0 &&
            nameParts[nameParts.length - 1].length < 5;

          if (!hasExtension) {
            if (fullDoc.type === "text/plain" && !filename.endsWith(".txt")) {
              filename += ".txt";
            } else if (
              fullDoc.type === "application/pdf" &&
              !filename.endsWith(".pdf")
            ) {
              filename += ".pdf";
            } else if (
              (fullDoc.type === "application/msword" ||
                fullDoc.type ===
                  "application/vnd.openxmlformats-officedocument.wordprocessingml.document") &&
              !filename.endsWith(".docx")
            ) {
              filename += ".docx";
            }
          }

          let blob: Blob;
          if (fullDoc.fileDataUri) {
            blob = dataURIToBlob(fullDoc.fileDataUri);
            toast({
              title: "Download Started",
              description: `${filename} (original file) is downloading.`,
            });
          } else if (fullDoc.textContent) {
            blob = new Blob([fullDoc.textContent], {
              type: fullDoc.type || "application/octet-stream",
            });
            toast({
              title: "Download Started (Text Fallback)",
              description: `${filename} (text representation) is downloading. Original file data not found.`,
              variant: "default",
            });
          } else {
            toast({
              title: "Error",
              description: "No content found for this document.",
              variant: "destructive",
            });
            return;
          }

          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        } else {
          toast({
            title: "Error",
            description: "Document content not found for download.",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("Error preparing document for download:", error);
        toast({
          title: "Download Error",
          description: "Could not prepare the document for download.",
          variant: "destructive",
        });
      }
    }
  }, [doc, toast]);

  const displaySource = doc.source && doc.source.toLowerCase() !== "file upload";

  return (
    <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 rounded-lg border border-primary/30 overflow-hidden">
      <CardHeader className="pb-3">
        <OptimizedImage
          src={doc.coverImageDataUri}
          alt={doc.coverImageDataUri ? `Cover for ${doc.name}` : "Abstract document representation"}
          width={600}
          height={300}
          className="w-full h-48 object-cover rounded-t-md"
          priority={false}
        />
        <CardTitle className="text-lg font-semibold leading-tight mt-4 truncate" title={doc.name}>
          {doc.name}
        </CardTitle>
        <div className="text-xs text-muted-foreground space-y-1 pt-1">
          <div className="flex items-center gap-1">
            <CalendarDays className="w-3 h-3" />
            Uploaded: {formatDate(doc.uploadedAt)}
          </div>
          {doc.author && (
            <div className="flex items-center gap-1 truncate" title={`Author: ${doc.author}`}>
              <UserCircle className="w-3 h-3" />
              Author: {doc.author}
            </div>
          )}
          {displaySource && doc.source && (
            <div className="flex items-center gap-1 truncate" title={`Source: ${doc.source}`}>
              <Building className="w-3 h-3" />
              Source: {doc.source}
            </div>
          )}
          {doc.edition && (
            <div className="flex items-center gap-1 truncate" title={`Edition: ${doc.edition}`}>
              <Layers className="w-3 h-3" />
              Edition: {doc.edition}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground line-clamp-2">
          {doc.summary ? doc.summary : `Type: ${doc.type || "document"}`}
        </p>
        <div className="flex justify-between items-center mt-4">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Trash2 className="w-4 h-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Document</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete &quot;{doc.name}&quot;? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => onDelete(doc.id)} className="bg-destructive hover:bg-destructive/90">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Link href={`/documents/${doc.id}`}>
            <Button size="sm">
              View <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
