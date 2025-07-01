export interface DocumentMetadata {
  id: string;
  name: string;
  type: string; 
  uploadedAt: string; 
  source: string; 
  summary?: string; 
  coverImageDataUri?: string; 
  author?: string;
  edition?: string;
  fileUrl?: string;
  cloudinaryPublicId?: string;
}

export interface DocumentFile extends DocumentMetadata {
  textContent: string; 
  fileDataUri?: string; 
  originalFile?: File; 
  cloudinaryPublicId?: string;
}
