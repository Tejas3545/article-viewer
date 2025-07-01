export async function compressImage(dataUri: string, maxSizeInBytes: number = 900000): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let width = img.width;
      let height = img.height;
      let quality = 0.7;
      
      // Start with original dimensions
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      // Function to try compression with current settings
      const tryCompression = () => {
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        
        const compressedDataUri = canvas.toDataURL('image/jpeg', quality);
        
        // Check if the size is within limits
        const base64str = compressedDataUri.split(',')[1];
        const byteSize = Math.ceil((base64str.length * 3) / 4);
        
        if (byteSize <= maxSizeInBytes) {
          resolve(compressedDataUri);
        } else {
          // If still too large, reduce dimensions or quality
          if (quality > 0.2) {
            // First try reducing quality
            quality -= 0.1;
          } else {
            // If quality is already low, reduce dimensions
            width = Math.floor(width * 0.8);
            height = Math.floor(height * 0.8);
            quality = 0.7; // Reset quality for the new dimensions
          }
          
          // If dimensions are still reasonable, try again
          if (width > 100 && height > 100) {
            tryCompression();
          } else {
            // If we can't reduce further, return the last attempt
            resolve(compressedDataUri);
          }
        }
      };

      tryCompression();
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    img.src = dataUri;
  });
} 