import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PublishResult } from '../../interfaces/publish-result.interface';
import { ISocialMediaPublisher } from '../../interfaces/publisher.interface';

/**
 * Servicio para publicar en Instagram
 * Implementa ISocialMediaPublisher para cumplir con DIP
 */
@Injectable()
export class InstagramPublisherService implements ISocialMediaPublisher {
    private readonly facebookToken: string | undefined;
    private readonly instagramAccountId: string | undefined;

    constructor(private configService: ConfigService) {
        this.facebookToken = this.configService.get<string>('FACEBOOK_TOKEN');
        this.instagramAccountId = this.configService.get<string>('INSTAGRAM_ACCOUNT_ID');

        if (!this.facebookToken) {
            console.warn('[Instagram] FACEBOOK_TOKEN no configurado en .env');
        }
        if (!this.instagramAccountId) {
            console.warn('[Instagram] INSTAGRAM_ACCOUNT_ID no configurado en .env');
        }
    }

    async publish(caption: string, imageUrl: string): Promise<PublishResult> {
        try {
            console.log('[Instagram] Publicando (Paso 1/2)...');

            if (!this.facebookToken || !this.instagramAccountId) {
                return {
                    success: false,
                    platform: 'instagram',
                    error: 'Token o Account ID no configurado',
                };
            }

            // PASO 1: Crear el contenedor de medios
            const formData1 = new URLSearchParams();
            formData1.append('caption', caption);
            formData1.append('access_token', this.facebookToken);
            formData1.append('image_url', imageUrl);

            const response1 = await fetch(
                `https://graph.facebook.com/v24.0/${this.instagramAccountId}/media`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: formData1.toString(),
                },
            );

            const data1 = await response1.json();

            if (!response1.ok) {
                console.error('[Instagram] Error en paso 1:', data1);
                return {
                    success: false,
                    platform: 'instagram',
                    error: data1.error?.message || 'Error en paso 1',
                };
            }

            const creationId = data1.id;
            console.log('[Instagram] Media container creado:', creationId);

            // Esperar 10 segundos para que Instagram procese la imagen
            await new Promise(resolve => setTimeout(resolve, 10000));

            // PASO 2: Publicar el contenedor
            console.log('[Instagram] Publicando (Paso 2/2)...');

            const formData2 = new URLSearchParams();
            formData2.append('access_token', this.facebookToken);
            formData2.append('creation_id', creationId);

            const response2 = await fetch(
                `https://graph.facebook.com/v24.0/${this.instagramAccountId}/media_publish`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: formData2.toString(),
                },
            );

            const data2 = await response2.json();

            if (!response2.ok) {
                console.error('[Instagram] Error en paso 2:', data2);
                return {
                    success: false,
                    platform: 'instagram',
                    error: data2.error?.message || 'Error en paso 2',
                };
            }

            console.log('[Instagram] ✅ Publicado:', data2.id);
            return {
                success: true,
                platform: 'instagram',
                postId: data2.id,
            };
        } catch (error) {
            console.error('[Instagram] Exception:', error.message);
            return {
                success: false,
                platform: 'instagram',
                error: error.message,
            };
        }
    }
}
