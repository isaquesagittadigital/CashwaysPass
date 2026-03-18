import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ImageCompressionService {

  constructor() { }

  /**
   * Compacta uma imagem usando Canvas.
   * @param file O arquivo de imagem original.
   * @param maxWidth Largura máxima permitida (default 1200px).
   * @param maxHeight Altura máxima permitida (default 1200px).
   * @param quality Qualidade da compressão (0.1 a 1.0, default 0.7).
   * @returns Uma Promise que resolve para o novo arquivo compactado (Blob/File).
   */
  async compressImage(file: File, maxWidth: number = 1200, maxHeight: number = 1200, quality: number = 0.7): Promise<File> {
    // Se o arquivo for pequeno (< 200KB), não precisa compactar
    if (file.size < 200 * 1024) {
      return file;
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          let width = img.width;
          let height = img.height;

          // Redimensionamento proporcional
          if (width > height) {
            if (width > maxWidth) {
              height *= maxWidth / width;
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width *= maxHeight / height;
              height = maxHeight;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(file); // Fallback caso canvas não funcione
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (blob) {
                // Ajusta a extensão do nome se estivermos convertendo para jpeg
                let fileName = file.name;
                const lastDotIndex = fileName.lastIndexOf('.');
                if (lastDotIndex !== -1) {
                  fileName = fileName.substring(0, lastDotIndex) + '.jpg';
                } else {
                  fileName = fileName + '.jpg';
                }

                const compressedFile = new File([blob], fileName, {
                  type: 'image/jpeg',
                  lastModified: Date.now(),
                });
                resolve(compressedFile);
              } else {
                resolve(file);
              }
            },
            'image/jpeg',
            quality
          );
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  }
}
