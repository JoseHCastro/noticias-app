import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PublishResult } from '../interfaces/publish-result.interface';

@Injectable()
export class PublishTiktokService {
  private readonly tiktokToken: string | undefined;
  private readonly apiUrl = 'https://open.tiktokapis.com/v2/post/publish/content/init/';

  constructor(private configService: ConfigService) {
    this.tiktokToken = this.configService.get<string>('TIKTOK_TOKEN');

    if (!this.tiktokToken) {
      console.warn(' TIKTOK_TOKEN no configurado en .env');
    }
  }

  async publish(caption: string, imageUrl: string): Promise<PublishResult> {
    try {
      console.log('[TIKTOK] Iniciando publicacion en TikTok');
      console.log('[TIKTOK] Token configurado:', this.tiktokToken ? 'SI' : 'NO');
      console.log('[TIKTOK] Token (primeros 20 chars):', this.tiktokToken?.substring(0, 20));
      console.log('[TIKTOK] Caption length:', caption.length);
      console.log('[TIKTOK] ImageUrl (ignorada - usando video):', imageUrl);

      if (!this.tiktokToken) {
        console.error('[TIKTOK] ERROR: Token no configurado');
        return {
          success: false,
          platform: 'tiktok',
          error: 'Token no configurado',
        };
      }
      
      console.log('[TIKTOK] Validaciones pasadas OK');

      // URL del video fijo que siempre se usará
      const videoUrl = `${this.configService.get<string>('APP_URL')}/uploads/video.mp4`;
      console.log('[TIKTOK] Video URL:', videoUrl);

      // Payload para publicar video en TikTok
      const payload = {
        post_info: {
          title: caption.substring(0, 150), // Máximo 150 caracteres para título en videos
          privacy_level: 'SELF_ONLY', // Apps no auditadas SOLO pueden usar SELF_ONLY con DIRECT_POST
          disable_comment: false,
          disable_duet: false,
          disable_stitch: false,
          video_cover_timestamp_ms: 1000, // Thumbnail del video en 1 segundo
        },
        source_info: {
          source: 'PULL_FROM_URL',
          video_url: videoUrl,
        },
        post_mode: 'DIRECT_POST', // Publicación automática - solo funciona con SELF_ONLY en sandbox
        media_type: 'VIDEO',
      };

      console.log('[TIKTOK] Payload preparado:', JSON.stringify(payload, null, 2));
      console.log('[TIKTOK] Enviando request a:', this.apiUrl);

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.tiktokToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
        },
        body: JSON.stringify(payload),
      });

      console.log('[TIKTOK] Response status:', response.status);
      console.log('[TIKTOK] Response statusText:', response.statusText);
      console.log('[TIKTOK] Response ok:', response.ok);

      const data = await response.json();
      console.log('[TIKTOK] Response data completo:', JSON.stringify(data, null, 2));

      // Verificar errores de la API de TikTok
      if (data.error && data.error.code !== 'ok') {
        console.error('[TIKTOK] ERROR de API - Code:', data.error.code);
        console.error('[TIKTOK] ERROR de API - Message:', data.error.message);
        console.error('[TIKTOK] ERROR de API - Log ID:', data.error.log_id);
        return {
          success: false,
          platform: 'tiktok',
          error: `${data.error.code}: ${data.error.message}`,
        };
      }

      if (!response.ok || !data.data?.publish_id) {
        console.error('[TIKTOK] ERROR - Response no OK o sin publish_id');
        console.error('[TIKTOK] ERROR - Data completo:', JSON.stringify(data));
        return {
          success: false,
          platform: 'tiktok',
          error: data.error?.message || 'Error desconocido',
        };
      }

      console.log('[TIKTOK] EXITO - Publicado en TikTok exitosamente');
      console.log('[TIKTOK] EXITO - Publish ID:', data.data.publish_id);

      return {
        success: true,
        platform: 'tiktok',
        postId: data.data.publish_id,
      };
    } catch (error) {
      console.error('[TIKTOK] EXCEPTION - Error al publicar:', error.message);
      console.error('[TIKTOK] EXCEPTION - Stack:', error.stack);
      return {
        success: false,
        platform: 'tiktok',
        error: error.message,
      };
    }
  }
}
