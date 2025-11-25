import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PublishResult } from '../../interfaces/publish-result.interface';
import { ISocialMediaPublisher } from '../../interfaces/publisher.interface';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Servicio para publicar videos en TikTok
 * Implementa ISocialMediaPublisher para cumplir con DIP
 * Nota: TikTok usa videos, no imágenes, pero mantiene la misma interfaz
 */
@Injectable()
export class TiktokPublisherService implements ISocialMediaPublisher {
    private readonly clientKey: string;
    private readonly clientSecret: string;
    private readonly accessToken: string | undefined;
    private readonly apiUrl = 'https://open.tiktokapis.com/v2/post/publish/video/init/';

    constructor(private configService: ConfigService) {
        this.clientKey = this.configService.get<string>('TIKTOK_CLIENT_KEY') || '';
        this.clientSecret = this.configService.get<string>('TIKTOK_CLIENT_SECRET') || '';
        this.accessToken = this.configService.get<string>('TIKTOK_TOKEN');

        if (!this.accessToken) {
            console.warn('[TikTok] TIKTOK_TOKEN no configurado en .env');
        }
    }

    /**
     * Publica un video en TikTok
     * Nota: imageUrl en este caso debe ser la ruta a un archivo de video
     */
    async publish(caption: string, videoPath: string): Promise<PublishResult> {
        try {
            console.log('[TikTok] Iniciando publicación con FILE_UPLOAD');

            if (!this.accessToken) {
                return {
                    success: false,
                    platform: 'tiktok',
                    error: 'Token no configurado',
                };
            }

            let absolutePath = videoPath;
            let isTempFile = false;

            // Si es una URL, descargar primero
            if (videoPath.startsWith('http')) {
                console.log('[TikTok] Detectada URL remota, descargando video temporal...');
                const tempFileName = `temp_tiktok_${Date.now()}.mp4`;
                absolutePath = path.resolve(tempFileName);

                const response = await fetch(videoPath);
                if (!response.ok) throw new Error(`Error descargando video: ${response.statusText}`);

                const buffer = await response.arrayBuffer();
                fs.writeFileSync(absolutePath, Buffer.from(buffer));
                isTempFile = true;
                console.log('[TikTok] Video descargado en:', absolutePath);
            } else {
                absolutePath = path.resolve(videoPath);
            }

            // Verificar que el archivo existe
            if (!fs.existsSync(absolutePath)) {
                console.error('[TikTok] Archivo no encontrado:', absolutePath);
                return {
                    success: false,
                    platform: 'tiktok',
                    error: 'Archivo de video no encontrado',
                };
            }

            const fileStats = fs.statSync(absolutePath);
            const videoSize = fileStats.size;
            const chunkSize = videoSize;
            const totalChunkCount = 1;

            console.log('[TikTok] Tamaño del archivo:', videoSize, 'bytes');

            // PASO 1: Obtener upload_url
            console.log('[TikTok] PASO 1: Obteniendo upload_url...');

            const step1Payload = {
                post_info: {
                    title: caption.substring(0, 150),
                    privacy_level: 'SELF_ONLY',
                    disable_comment: false,
                    disable_duet: false,
                    disable_stitch: false,
                },
                source_info: {
                    source: 'FILE_UPLOAD',
                    video_size: videoSize,
                    chunk_size: chunkSize,
                    total_chunk_count: totalChunkCount,
                },
            };

            const step1Response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json; charset=UTF-8',
                },
                body: JSON.stringify(step1Payload),
            });

            const step1Data = await step1Response.json();

            if (step1Data.error && step1Data.error.code !== 'ok') {
                console.error('[TikTok] Error en paso 1:', step1Data.error);
                return {
                    success: false,
                    platform: 'tiktok',
                    error: `${step1Data.error.code}: ${step1Data.error.message}`,
                };
            }

            if (!step1Data.data?.upload_url) {
                return {
                    success: false,
                    platform: 'tiktok',
                    error: 'No se recibió upload_url de TikTok',
                };
            }

            const uploadUrl = step1Data.data.upload_url;
            const publishId = step1Data.data.publish_id;
            console.log('[TikTok] Upload URL obtenida');
            console.log('[TikTok] Publish ID:', publishId);

            // PASO 2: Subir el archivo
            console.log('[TikTok] PASO 2: Subiendo archivo...');

            const videoBuffer = fs.readFileSync(absolutePath);
            const mimeType = this.getMimeType(absolutePath);

            const step2Response = await fetch(uploadUrl, {
                method: 'PUT',
                headers: {
                    'Content-Type': mimeType,
                    'Content-Range': `bytes 0-${videoBuffer.length - 1}/${videoBuffer.length}`,
                },
                body: videoBuffer,
            });

            if (!step2Response.ok) {
                console.error('[TikTok] Error en paso 2:', step2Response.status);
                return {
                    success: false,
                    platform: 'tiktok',
                    error: `Error al subir archivo: ${step2Response.status}`,
                };
            }

            console.log('[TikTok]  Video subido exitosamente');
            console.log('[TikTok]  Publish ID:', publishId);

            return {
                success: true,
                platform: 'tiktok',
                postId: publishId,
            };
        } catch (error) {
            console.error('[TikTok] Exception:', error.message);
            return {
                success: false,
                platform: 'tiktok',
                error: error.message,
            };
        }
    }

    private getMimeType(filePath: string): string {
        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes: { [key: string]: string } = {
            '.mp4': 'video/mp4',
            '.mov': 'video/quicktime',
            '.avi': 'video/x-msvideo',
            '.webm': 'video/webm',
        };
        return mimeTypes[ext] || 'video/mp4';
    }
}
