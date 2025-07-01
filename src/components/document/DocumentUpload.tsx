"use client";
import { ChangeEvent, DragEvent, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { UploadCloud, FileText } from "lucide-react";
import type { DocumentFile } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import * as mammoth from "mammoth";

interface DocumentUploadProps {
  onFileUpload: (document: DocumentFile) => void;
}

const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer.slice(0));
  let binary = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
};

export function DocumentUpload({ onFileUpload }: DocumentUploadProps) {
  const [dragging, setDragging] = useState(false);
  const { toast } = useToast();

  const processFile = useCallback(
    async (file: File) => {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        toast({
          title: "File Too Large",
          description: `Please upload files smaller than ${MAX_FILE_SIZE_MB}MB.`,
          variant: "destructive",
        });
        return;
      }

      let textContent = `Content of ${file.name} (type: ${file.type}). Full parsing requires specific libraries.`;
      const arrayBuffer = await file.arrayBuffer();

      const arrayBufferCopy = arrayBuffer.slice(0);

      if (file.type === "text/plain" || file.name.endsWith(".txt")) {
        textContent = await file.text();
      } else if (
        file.type === "application/pdf" ||
        file.name.endsWith(".pdf")
      ) {
        if (typeof window === "undefined") {
          textContent = `PDF processing is only available in the browser. Please try again.`;
          toast({
            title: "PDF Processing Error",
            description: "PDF processing is only available in the browser.",
            variant: "default",
          });
        } else {
          try {
            const pdfjsLib = await import("pdfjs-dist");

            pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.js";

            const pdf = await pdfjsLib.getDocument({
              data: new Uint8Array(arrayBuffer),
            }).promise;
            const numPages = pdf.numPages;
            let fullText = "";
            for (let i = 1; i <= numPages; i++) {
              const page = await pdf.getPage(i);
              const textContentPage = await page.getTextContent();
              fullText +=
                textContentPage.items.map((item: any) => item.str).join(" ") +
                "\n";
            }
            textContent = fullText.trim();
            if (!textContent) {
              textContent = `No text could be extracted from ${file.name}. It might be an image-only PDF.`;
            }
            toast({
              title: "PDF Processed",
              description: `Text extracted from ${file.name}.`,
              variant: "default",
            });
          } catch (pdfError: any) {
            console.error("Error extracting text from PDF:", pdfError);
            textContent = `Could not extract text from PDF ${
              file.name
            }. Error: ${pdfError.message || "Unknown PDF processing error"}`;
            toast({
              title: "PDF Parsing Error",
              description:
                "Could not extract text content from the PDF file. A placeholder will be used.",
              variant: "default",
            });
          }
        }
      } else if (
        file.type ===
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        file.name.endsWith(".docx")
      ) {
        try {
          const result = await mammoth.extractRawText({
            arrayBuffer: arrayBuffer,
          });
          textContent = result.value;
          if (result.messages && result.messages.length > 0) {
            console.warn(
              "Mammoth messages during DOCX parsing:",
              result.messages
            );
            toast({
              title: "DOCX Parsing Notice",
              description:
                "Text extracted from DOCX, but there might be some formatting issues or warnings.",
              variant: "default",
            });
          }
        } catch (docxError) {
          console.error("Error extracting text from DOCX:", docxError);
          textContent = `Could not extract text from ${file.name}. (This is a placeholder text. The original file can be downloaded.)`;
          toast({
            title: "DOCX Parsing Error",
            description:
              "Could not extract text content from the DOCX file. A placeholder will be used.",
            variant: "default",
          });
        }
      }

      let fileDataUri: string | undefined = undefined;
      try {
        const base64String = arrayBufferToBase64(arrayBufferCopy);
        fileDataUri = `data:${
          file.type || "application/octet-stream"
        };base64,${base64String}`;
      } catch (error) {
        console.error("Error processing file to Data URI:", error);
        toast({
          title: "File Processing Error",
          description:
            "Could not read the file content for download. Text preview may still be available.",
          variant: "default",
        });
      }

      const newDocument: DocumentFile = {
        id: crypto.randomUUID(),
        name: file.name,
        type: file.type || "application/octet-stream",
        uploadedAt: new Date().toISOString(),
        source: "File Upload",
        textContent: textContent,
        fileDataUri: fileDataUri,
        originalFile: file,
      };
      onFileUpload(newDocument);
      toast({
        title: "File Uploaded",
        description: `${file.name} has been successfully processed.`,
      });
    },
    [onFileUpload, toast]
  );

  const handleFileChange = useCallback(
    async (files: FileList | null) => {
      if (files && files.length > 0) {
        await processFile(files[0]);
      }
    },
    [processFile]
  );

  const handleDragEvent = (
    e: DragEvent<HTMLDivElement>,
    isEntering: boolean
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(isEntering);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!dragging) setDragging(true);
  };

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setDragging(false);
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        processFile(e.dataTransfer.files[0]);
      }
    },
    [processFile]
  );

  const onFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    handleFileChange(e.target.files);
    if (e.target) {
      e.target.value = "";
    }
  };

  return (
    <Card className="w-full max-w-xl mx-auto shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <FileText className="w-6 h-6 text-primary" /> Upload New Document
        </CardTitle>
        <CardDescription>
          Drag & drop your file or click to select. Max file size: $
          {MAX_FILE_SIZE_MB}MB.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          onDragEnter={(e) => handleDragEvent(e, true)}
          onDragLeave={(e) => handleDragEvent(e, false)}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className={`flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg cursor-pointer transition-colors duration-200 ease-in-out
            ${
              dragging
                ? "border-primary bg-primary/10 shadow-inner"
                : "border-border hover:border-primary/50 hover:bg-muted/30"
            }`}
          onClick={() => document.getElementById("file-upload-input")?.click()}
          role="button"
          tabIndex={0}
          aria-label="File upload area">
          <UploadCloud
            className={`w-12 h-12 mb-4 transition-transform duration-200 ease-in-out ${
              dragging ? "text-primary scale-110" : "text-muted-foreground"
            }`}
          />
          <p
            className={`mb-2 text-sm font-medium ${
              dragging ? "text-primary" : "text-foreground"
            }`}>
            <span className="font-semibold">Click to upload</span> or drag and
            drop
          </p>
          <p className="text-xs text-muted-foreground">
            Supports PDF, DOCX, TXT, etc.
          </p>
          <Input
            id="file-upload-input"
            type="file"
            className="hidden"
            onChange={onFileInputChange}
            accept=".pdf,.doc,.docx,.txt,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
          />
        </div>
        <Button
          variant="outline"
          className="w-full mt-6"
          onClick={() => document.getElementById("file-upload-input")?.click()}>
          Or Select File Manually
        </Button>
      </CardContent>
    </Card>
  );
}
