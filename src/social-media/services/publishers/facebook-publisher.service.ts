import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PublishResult } from '../../interfaces/publish-result.interface';
import { ISocialMediaPublisher } from '../../interfaces/publisher.interface';

/**
 * Servicio para publicar en Facebook
 * Implementa ISocialMediaPublisher para cumplir con DIP
 */
@Injectable()
export class FacebookPublisherService implements ISocialMediaPublisher {
  private readonly facebookToken: string | undefined;
  private readonly facebookPageId: string | undefined;

  constructor(private configService: ConfigService) {
    this.facebookToken = this.configService.get<string>('FACEBOOK_TOKEN');
    this.facebookPageId = this.configService.get<string>('FACEBOOK_PAGE_ID');

    if (!this.facebookToken) {
      console.warn('[Facebook] FACEBOOK_TOKEN no configurado en .env');
    }
    if (!this.facebookPageId) {
      console.warn('[Facebook] FACEBOOK_PAGE_ID no configurado en .env');
    }
  }

  async publish(caption: string, imageUrl: string): Promise<PublishResult> {
    try {
      console.log('[Facebook] Publicando...');

      if (!this.facebookToken || !this.facebookPageId) {
        return {
          success: false,
          platform: 'facebook',
          error: 'Token o Page ID no configurado',
        };
      }

      const formData = new URLSearchParams();
      formData.append('caption', caption);
      formData.append('access_token', this.facebookToken);
      formData.append('url', imageUrl);

      const response = await fetch(
        `https://graph.facebook.com/v24.0/${this.facebookPageId}/photos`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formData.toString(),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        console.error('[Facebook] Error:', data);
        return {
          success: false,
          platform: 'facebook',
          error: data.error?.message || 'Error desconocido',
        };
      }

      console.log('[Facebook] ✅ Publicado:', data.id || data.post_id);
      return {
        success: true,
        platform: 'facebook',
        postId: data.id || data.post_id,
      };
    } catch (error) {
      console.error('[Facebook] Exception:', error.message);
      return {
        success: false,
        platform: 'facebook',
        error: error.message,
      };
    }
  }
}
