import { Injectable, Logger } from '@nestjs/common';
import { UploadPostDto } from '../dto/upload-post.dto';
import { PublishResult } from '../interfaces/publish-result.interface';
import { FileUploadService } from './upload/file-upload.service';
import { PublisherFactoryService } from './publishers/publisher-factory.service';

/**
 * Facade Service para orquestar la publicación en redes sociales
 * Implementa Facade Pattern para simplificar la interacción con múltiples servicios
 * 
 * Responsabilidades:
 * - Coordinar el flujo de publicación
 * - Gestionar archivos
 * - Delegar a publishers específicos
 * - Manejar limpieza en caso de error
 */
@Injectable()
export class SocialMediaFacadeService {
    private readonly logger = new Logger(SocialMediaFacadeService.name);

    constructor(
        private fileUploadService: FileUploadService,
        private publisherFactory: PublisherFactoryService,
    ) { }

    /**
     * Publica un post con imagen en la red social especificada
     * 
     * @param file - Archivo de imagen subido
     * @param dto - DTO con platform y caption
     * @returns Resultado de la publicación
     */
    async publishPost(
        file: Express.Multer.File,
        dto: UploadPostDto,
    ): Promise<PublishResult & { imageUrl?: string; videoUrl?: string; filename?: string }> {
        this.logger.log(`Publishing to ${dto.platform}`);

        try {
            const isVideo = file.mimetype.startsWith('video/');

            // Si es video y es para TikTok, usar flujo de video
            if (isVideo && dto.platform === 'tiktok') {
                // Pasamos file.path para que TikTok pueda leer el archivo físico
                return this.publishVideo(file, dto.caption);
            }

            // 1. Validar y guardar archivo
            // Nota: saveImage ahora debería ser capaz de manejar videos también o tener un método genérico saveFile
            // Por simplicidad, usaremos saveImage que retorna la URL pública
            const mediaUrl = await this.fileUploadService.saveImage(file, dto.platform);
            this.logger.log(`Media saved: ${mediaUrl}`);

            // 2. Obtener publisher correspondiente (Factory Pattern)
            const publisher = this.publisherFactory.getPublisher(dto.platform);

            // 3. Publicar en la plataforma
            const result = await publisher.publish(dto.caption, mediaUrl);

            // 4. Si falló, limpiar archivo
            if (!result.success) {
                this.logger.error(`Publication failed for ${dto.platform}: ${result.error}`);
                await this.fileUploadService.deleteFile(mediaUrl);
                return result;
            }

            // 5. Retornar resultado exitoso con información adicional
            this.logger.log(`Successfully published to ${dto.platform}: ${result.postId}`);
            return {
                ...result,
                [isVideo ? 'videoUrl' : 'imageUrl']: mediaUrl,
                filename: file.filename,
            };
        } catch (error) {
            this.logger.error(`Error publishing to ${dto.platform}:`, error);

            // Limpiar archivo si existe
            if (file?.path) {
                await this.fileUploadService.deleteFile(file.path);
            }

            return {
                success: false,
                platform: dto.platform,
                error: error.message,
            };
        }
    }

    /**
     * Publica un video en TikTok
     * 
     * @param file - Archivo de video subido
     * @param caption - Texto del post
     * @returns Resultado de la publicación
     */
    async publishVideo(
        file: Express.Multer.File,
        caption: string,
    ): Promise<PublishResult & { videoUrl?: string; filename?: string }> {
        this.logger.log('Publishing video to TikTok');

        try {
            // 1. Guardar video (solo para tener referencia y URL pública si se necesita)
            const videoUrl = await this.fileUploadService.saveImage(file, 'tiktok');
            this.logger.log(`Video saved: ${videoUrl}`);

            // 2. Obtener publisher de TikTok
            const publisher = this.publisherFactory.getTiktokPublisher();

            // 3. Publicar usando la RUTA FÍSICA (file.path)
            // TikTok necesita leer el archivo del disco para subirlo
            const result = await publisher.publish(caption, file.path);

            // 4. Si falló, limpiar
            if (!result.success) {
                this.logger.error(`Publication failed for tiktok: ${result.error}`);
                await this.fileUploadService.deleteFile(videoUrl);
                return result;
            }

            return {
                ...result,
                videoUrl,
                filename: file.filename,
            };
        } catch (error) {
            this.logger.error('Error publishing video to TikTok:', error);

            if (file?.path) {
                await this.fileUploadService.deleteFile(file.path);
            }

            return {
                success: false,
                platform: 'tiktok',
                error: error.message,
            };
        }
    }
    /**
     * Publica contenido directamente usando una URL de imagen existente
     * Útil para el Chatbot que genera imágenes con DALL-E y las sube a Cloudinary
     */
    async publishContent(
        platform: string,
        caption: string,
        mediaUrl: string,
    ): Promise<PublishResult> {
        this.logger.log(`Publishing content to ${platform} with media: ${mediaUrl}`);
        try {
            const publisher = this.publisherFactory.getPublisher(platform as any);
            return await publisher.publish(caption, mediaUrl);
        } catch (error) {
            this.logger.error(`Error publishing content to ${platform}:`, error);
            return {
                success: false,
                platform,
                error: error.message,
            };
        }
    }
}
