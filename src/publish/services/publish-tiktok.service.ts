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
      console.log(' Publicando en TikTok...');

      if (!this.tiktokToken) {
        return {
          success: false,
          platform: 'tiktok',
          error: 'Token no configurado',
        };
      }

      // Validar que la imagen esté públicamente accesible
      if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
        return {
          success: false,
          platform: 'tiktok',
          error: 'La imagen debe ser una URL pública (http:// o https://)',
        };
      }

      // Payload para publicar foto en TikTok
      const payload = {
        post_info: {
          title: caption.substring(0, 90), // Máximo 90 caracteres para título
          description: caption.substring(0, 4000), // Máximo 4000 caracteres
          privacy_level: 'PUBLIC_TO_EVERYONE',
          disable_comment: false,
          auto_add_music: true,
        },
        source_info: {
          source: 'PULL_FROM_URL',
          photo_cover_index: 0,
          photo_images: [imageUrl], // Array de URLs de imágenes (máximo 35)
        },
        post_mode: 'DIRECT_POST', // Publicar directamente (requiere scope video.publish)
        media_type: 'PHOTO',
      };

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.tiktokToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      // Verificar errores de la API de TikTok
      if (data.error && data.error.code !== 'ok') {
        console.error(' Error de TikTok API:', data.error.message);
        return {
          success: false,
          platform: 'tiktok',
          error: `${data.error.code}: ${data.error.message}`,
        };
      }

      if (!response.ok || !data.data?.publish_id) {
        console.error(' Error al publicar en TikTok:', data);
        return {
          success: false,
          platform: 'tiktok',
          error: data.error?.message || 'Error desconocido',
        };
      }

      console.log(' Publicado en TikTok exitosamente');
      console.log(` Publish ID: ${data.data.publish_id}`);

      return {
        success: true,
        platform: 'tiktok',
        postId: data.data.publish_id,
      };
    } catch (error) {
      console.error(' Error al publicar en TikTok:', error.message);
      return {
        success: false,
        platform: 'tiktok',
        error: error.message,
      };
    }
  }
}
