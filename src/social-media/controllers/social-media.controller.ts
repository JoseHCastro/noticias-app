import {
    Controller,
    Post,
    UploadedFile,
    UseInterceptors,
    Body,
    HttpException,
    HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { UploadPostDto } from '../dto/upload-post.dto';
import { SocialMediaFacadeService } from '../services/social-media-facade.service';

/**
 * Controller para publicación manual en redes sociales
 * Responsabilidad: Solo routing y validación de DTOs
 * Delega toda la lógica al SocialMediaFacadeService
 */
@Controller('social-media')
export class SocialMediaController {
    constructor(private socialMediaFacade: SocialMediaFacadeService) { }

    /**
     * Endpoint para subir y publicar imagen en redes sociales
     * POST /social-media/upload
     */
    @Post('upload')
    @UseInterceptors(
        FileInterceptor('image', {
            storage: diskStorage({
                destination: './uploads',
                filename: (req, file, callback) => {
                    const platform = req.body.platform || 'unknown';
                    const timestamp = Date.now();
                    const randomNum = Math.round(Math.random() * 1e9);
                    const ext = extname(file.originalname);
                    callback(null, `${platform}-${timestamp}-${randomNum}${ext}`);
                },
            }),
            fileFilter: (req, file, callback) => {
                const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
                if (allowedMimes.includes(file.mimetype)) {
                    callback(null, true);
                } else {
                    callback(
                        new HttpException('Solo se aceptan imágenes', HttpStatus.BAD_REQUEST),
                        false,
                    );
                }
            },
            limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
        }),
    )
    async uploadPost(
        @UploadedFile() file: Express.Multer.File,
        @Body() dto: UploadPostDto,
    ) {
        // Delegar toda la lógica al facade
        const result = await this.socialMediaFacade.publishPost(file, dto);

        if (!result.success) {
            throw new HttpException(
                {
                    success: false,
                    message: `Error al publicar en ${dto.platform}`,
                    error: result.error,
                },
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }

        return {
            success: true,
            message: `Publicado exitosamente en ${dto.platform}`,
            data: {
                platform: dto.platform,
                postId: result.postId,
                caption: dto.caption,
                imageUrl: result.imageUrl,
                filename: result.filename,
            },
        };
    }
}
