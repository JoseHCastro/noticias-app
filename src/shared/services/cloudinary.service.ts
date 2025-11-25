import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';

@Injectable()
export class CloudinaryService {
    private readonly logger = new Logger(CloudinaryService.name);

    constructor(private configService: ConfigService) {
        const cloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME');
        const apiKey = this.configService.get<string>('CLOUDINARY_API_KEY');
        const apiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET');

        if (!cloudName || !apiKey || !apiSecret) {
            this.logger.warn('Cloudinary credentials not found in .env');
        }

        cloudinary.config({
            cloud_name: cloudName,
            api_key: apiKey,
            api_secret: apiSecret,
            secure: true, // Usar HTTPS siempre
        });
    }

    /**
     * Sube un archivo a Cloudinary desde un buffer
     */
    async uploadFile(file: Express.Multer.File, folder: string = 'noticias-app'): Promise<any> {
        return new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder: folder,
                    resource_type: 'auto', // Detecta si es imagen o video automáticamente
                },
                (error, result) => {
                    if (error) {
                        this.logger.error('Cloudinary upload failed:', error);
                        return reject(error);
                    }
                    resolve(result);
                },
            );

            // Convertir buffer a stream
            const stream = new Readable();
            stream.push(file.buffer);
            stream.push(null);
            stream.pipe(uploadStream);
        });
    }

    /**
     * Elimina un archivo de Cloudinary por su Public ID
     */
    async deleteFile(publicId: string, resourceType: string = 'image'): Promise<any> {
        try {
            return await cloudinary.uploader.destroy(publicId, {
                resource_type: resourceType,
            });
        } catch (error) {
            this.logger.error(`Failed to delete file ${publicId}:`, error);
            throw error;
        }
    }

    /**
     * Sube una imagen a Cloudinary directamente desde una URL externa (ej: DALL-E)
     */
    async uploadImageFromUrl(imageUrl: string, folder: string = 'noticias-app'): Promise<string> {
        try {
            const result = await cloudinary.uploader.upload(imageUrl, {
                folder: folder,
                resource_type: 'image',
            });
            return result.secure_url;
        } catch (error) {
            this.logger.error(`Failed to upload image from URL: ${imageUrl}`, error);
            throw error;
        }
    }

    /**
     * Sube un video a Cloudinary directamente desde una URL externa (ej: HeyGen)
     */
    async uploadVideoFromUrl(videoUrl: string, folder: string = 'noticias-app'): Promise<string> {
        try {
            const result = await cloudinary.uploader.upload(videoUrl, {
                folder: folder,
                resource_type: 'video',
            });
            return result.secure_url;
        } catch (error) {
            this.logger.error(`Failed to upload video from URL: ${videoUrl}`, error);
            throw error;
        }
    }

    /**
     * Extrae el Public ID de una URL de Cloudinary
     */
    getPublicIdFromUrl(url: string): string | null {
        try {
            // Ejemplo: https://res.cloudinary.com/demo/image/upload/v1234567890/folder/my_image.jpg
            const parts = url.split('/');
            const filename = parts[parts.length - 1];
            const folder = parts[parts.length - 2]; // Asumiendo estructura simple folder/file
            const publicId = `${folder}/${filename.split('.')[0]}`;
            return publicId;
        } catch (error) {
            return null;
        }
    }
}
