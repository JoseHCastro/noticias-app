import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PublishResult } from '../interfaces/publish-result.interface';

@Injectable()
export class PublishTiktokService {
  private readonly tiktokToken: string | undefined;

  constructor(private configService: ConfigService) {
    this.tiktokToken = this.configService.get<string>('TIKTOK_TOKEN');

    if (!this.tiktokToken) {
      console.warn('⚠️ TIKTOK_TOKEN no configurado en .env');
    }
  }

  async publish(caption: string, imageUrl: string): Promise<PublishResult> {
    try {
      console.log('🎵 Publicando en TikTok...');

      if (!this.tiktokToken) {
        return {
          success: false,
          platform: 'tiktok',
          error: 'Token no configurado',
        };
      }

      // TODO: Implementar lógica de publicación en TikTok
      // Referencia: https://developers.tiktok.com/doc/content-posting-api-get-started

      console.warn('⚠️ Publicación en TikTok no implementada aún');
      return {
        success: false,
        platform: 'tiktok',
        error: 'Funcionalidad no implementada',
      };
    } catch (error) {
      console.error('❌ Error al publicar en TikTok:', error.message);
      return {
        success: false,
        platform: 'tiktok',
        error: error.message,
      };
    }
  }
}
