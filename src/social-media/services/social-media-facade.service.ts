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
    ): Promise<PublishResult & { imageUrl?: string; filename?: string }> {
        this.logger.log(`Publishing to ${dto.platform}`);

        try {
            // 1. Validar y guardar archivo
            const imageUrl = await this.fileUploadService.saveImage(file, dto.platform);
            this.logger.log(`Image saved: ${imageUrl}`);

            // 2. Obtener publisher correspondiente (Factory Pattern)
            const publisher = this.publisherFactory.getPublisher(dto.platform);

            // 3. Publicar en la plataforma
            const result = await publisher.publish(dto.caption, imageUrl);

            // 4. Si falló, limpiar archivo
            if (!result.success) {
                this.logger.error(`Publication failed for ${dto.platform}: ${result.error}`);
                await this.fileUploadService.deleteFile(imageUrl);
                return result;
            }

            // 5. Retornar resultado exitoso con información adicional
            this.logger.log(`Successfully published to ${dto.platform}: ${result.postId}`);
            return {
                ...result,
                imageUrl,
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
            // TODO: Implementar lógica de video upload
            // Por ahora retornamos error
            throw new Error('Video upload not implemented yet');
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
}
