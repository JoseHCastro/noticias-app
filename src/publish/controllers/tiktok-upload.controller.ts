import {
    Controller,
    Post,
    UploadedFile,
    UseInterceptors,
    Body,
    BadRequestException,
    HttpException,
    HttpStatus
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { PublishTiktokService } from '../services/publish-tiktok.service';
import * as fs from 'fs';

/**
 * Controlador para subir videos a TikTok desde Postman
 * POST /tiktok/upload-video
 * 
 * Parámetros (multipart/form-data):
 * - video: archivo de video (mp4, mov, avi, webm)
 * - caption: texto del post (string)
 */
@Controller('tiktok')
export class TiktokUploadController {
    constructor(private publishTiktokService: PublishTiktokService) { }

    @Post('upload-video')
    @UseInterceptors(
        FileInterceptor('video', {
            storage: diskStorage({
                destination: './uploads',
                filename: (req, file, callback) => {
                    // Generar nombre único: timestamp + extensión original
                    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
                    const ext = extname(file.originalname);
                    const filename = `tiktok-${uniqueSuffix}${ext}`;
                    callback(null, filename);
                },
            }),
            fileFilter: (req, file, callback) => {
                // Validar que sea un archivo de video
                const allowedMimeTypes = [
                    'video/mp4',
                    'video/quicktime',
                    'video/x-msvideo',
                    'video/webm',
                    'video/x-matroska',
                ];

                if (allowedMimeTypes.includes(file.mimetype)) {
                    callback(null, true);
                } else {
                    callback(
                        new BadRequestException(
                            `Tipo de archivo no permitido. Solo se aceptan videos: ${allowedMimeTypes.join(', ')}`
                        ),
                        false,
                    );
                }
            },
            limits: {
                fileSize: 500 * 1024 * 1024, // 500MB máximo
            },
        }),
    )
    async uploadVideo(
        @UploadedFile() file: Express.Multer.File,
        @Body('caption') caption: string,
    ) {
        try {
            console.log('[UPLOAD-VIDEO] Iniciando subida de video a TikTok');
            console.log('[UPLOAD-VIDEO] Archivo recibido:', file?.originalname);
            console.log('[UPLOAD-VIDEO] Tamaño:', file?.size, 'bytes');
            console.log('[UPLOAD-VIDEO] Caption:', caption);

            // Validar que se haya subido un archivo
            if (!file) {
                throw new BadRequestException('No se recibió ningún archivo de video');
            }

            // Validar que se haya proporcionado un caption
            if (!caption || caption.trim() === '') {
                // Eliminar el archivo subido si no hay caption
                fs.unlinkSync(file.path);
                throw new BadRequestException('El campo "caption" es requerido');
            }

            // Validar longitud del caption (TikTok permite hasta 150 caracteres)
            if (caption.length > 2200) {
                fs.unlinkSync(file.path);
                throw new BadRequestException('El caption no puede exceder 2200 caracteres');
            }

            console.log('[UPLOAD-VIDEO] Archivo guardado en:', file.path);
            console.log('[UPLOAD-VIDEO] Publicando en TikTok...');

            // Publicar en TikTok usando el servicio
            const result = await this.publishTiktokService.publish(caption, file.path);

            console.log('[UPLOAD-VIDEO] Resultado:', result);

            // Si la publicación fue exitosa, retornar información
            if (result.success) {
                return {
                    success: true,
                    message: 'Video subido exitosamente a TikTok',
                    data: {
                        publishId: result.postId,
                        caption: caption,
                        filename: file.filename,
                        originalName: file.originalname,
                        size: file.size,
                        path: file.path,
                        mimeType: file.mimetype,
                    },
                    checkStatusUrl: `/auth/tiktok/check-status?publish_id=${result.postId}`,
                };
            } else {
                // Si falló, eliminar el archivo y retornar error
                fs.unlinkSync(file.path);
                throw new HttpException(
                    {
                        success: false,
                        message: 'Error al publicar en TikTok',
                        error: result.error,
                    },
                    HttpStatus.INTERNAL_SERVER_ERROR,
                );
            }
        } catch (error) {
            console.error('[UPLOAD-VIDEO] Error:', error);

            // Eliminar el archivo si existe y hubo un error
            if (file?.path && fs.existsSync(file.path)) {
                try {
                    fs.unlinkSync(file.path);
                    console.log('[UPLOAD-VIDEO] Archivo eliminado debido al error');
                } catch (unlinkError) {
                    console.error('[UPLOAD-VIDEO] Error al eliminar archivo:', unlinkError);
                }
            }

            // Si es una excepción HTTP, relanzarla
            if (error instanceof HttpException) {
                throw error;
            }

            // Cualquier otro error
            throw new HttpException(
                {
                    success: false,
                    message: 'Error al procesar la subida del video',
                    error: error.message,
                },
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }
}
