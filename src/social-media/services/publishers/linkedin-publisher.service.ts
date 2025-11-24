import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PublishResult } from '../../interfaces/publish-result.interface';
import { ISocialMediaPublisher } from '../../interfaces/publisher.interface';

/**
 * Servicio para publicar en LinkedIn
 * Implementa ISocialMediaPublisher para cumplir con DIP
 * Proceso de 4 pasos según LinkedIn API v2
 */
@Injectable()
export class LinkedinPublisherService implements ISocialMediaPublisher {
    private readonly linkedinToken: string | undefined;
    private readonly linkedinApiUrl = 'https://api.linkedin.com/v2';

    constructor(private configService: ConfigService) {
        this.linkedinToken = this.configService.get<string>('LINKEDIN_TOKEN');

        if (!this.linkedinToken) {
            console.warn('[LinkedIn] LINKEDIN_TOKEN no configurado en .env');
        }
    }

    async publish(caption: string, imageUrl: string): Promise<PublishResult> {
        try {
            console.log('[LinkedIn] Publicando...');

            if (!this.linkedinToken) {
                return {
                    success: false,
                    platform: 'linkedin',
                    error: 'Token no configurado',
                };
            }

            // PASO 1: Obtener el Person URN del usuario autenticado
            console.log('[LinkedIn] Paso 1/4: Obteniendo información del usuario...');
            const personUrn = await this.getUserInfo();
            if (!personUrn) {
                return {
                    success: false,
                    platform: 'linkedin',
                    error: 'No se pudo obtener la información del usuario',
                };
            }

            // PASO 2: Registrar la imagen para obtener upload URL
            console.log('[LinkedIn] Paso 2/4: Registrando imagen...');
            const uploadInfo = await this.registerImageUpload(personUrn);
            if (!uploadInfo) {
                return {
                    success: false,
                    platform: 'linkedin',
                    error: 'No se pudo registrar la imagen',
                };
            }

            // PASO 3: Descargar imagen desde URL y subirla a LinkedIn
            console.log('[LinkedIn] Paso 3/4: Subiendo imagen...');
            const uploadSuccess = await this.uploadImage(imageUrl, uploadInfo.uploadUrl);
            if (!uploadSuccess) {
                return {
                    success: false,
                    platform: 'linkedin',
                    error: 'No se pudo subir la imagen',
                };
            }

            // PASO 4: Crear el post con la imagen
            console.log('[LinkedIn] Paso 4/4: Creando post...');
            const postId = await this.createPost(personUrn, caption, uploadInfo.asset);
            if (!postId) {
                return {
                    success: false,
                    platform: 'linkedin',
                    error: 'No se pudo crear el post',
                };
            }

            console.log('[LinkedIn] ✅ Publicado:', postId);
            return {
                success: true,
                platform: 'linkedin',
                postId: postId,
            };
        } catch (error) {
            console.error('[LinkedIn] Exception:', error.message);
            return {
                success: false,
                platform: 'linkedin',
                error: error.message,
            };
        }
    }

    private async getUserInfo(): Promise<string | null> {
        try {
            const response = await fetch(`${this.linkedinApiUrl}/userinfo`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.linkedinToken}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                const error = await response.json();
                console.error('[LinkedIn] Error al obtener usuario:', error);
                return null;
            }

            const data = await response.json();
            const personUrn = `urn:li:person:${data.sub}`;
            console.log('[LinkedIn] Usuario obtenido:', personUrn);
            return personUrn;
        } catch (error) {
            console.error('[LinkedIn] Error en getUserInfo:', error.message);
            return null;
        }
    }

    private async registerImageUpload(
        personUrn: string,
    ): Promise<{ uploadUrl: string; asset: string } | null> {
        try {
            const registerPayload = {
                registerUploadRequest: {
                    recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
                    owner: personUrn,
                    serviceRelationships: [
                        {
                            relationshipType: 'OWNER',
                            identifier: 'urn:li:userGeneratedContent',
                        },
                    ],
                },
            };

            const response = await fetch(
                `${this.linkedinApiUrl}/assets?action=registerUpload`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.linkedinToken}`,
                        'Content-Type': 'application/json',
                        'X-Restli-Protocol-Version': '2.0.0',
                    },
                    body: JSON.stringify(registerPayload),
                },
            );

            if (!response.ok) {
                const error = await response.json();
                console.error('[LinkedIn] Error al registrar imagen:', error);
                return null;
            }

            const data = await response.json();
            const uploadUrl =
                data.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest']
                    .uploadUrl;
            const asset = data.value.asset;

            console.log('[LinkedIn] Imagen registrada:', asset);
            return { uploadUrl, asset };
        } catch (error) {
            console.error('[LinkedIn] Error en registerImageUpload:', error.message);
            return null;
        }
    }

    private async uploadImage(imageUrl: string, uploadUrl: string): Promise<boolean> {
        try {
            console.log('[LinkedIn] Descargando imagen desde:', imageUrl.substring(0, 80) + '...');
            const imageResponse = await fetch(imageUrl);
            if (!imageResponse.ok) {
                console.error('[LinkedIn] Error al descargar imagen');
                return false;
            }

            const imageBuffer = await imageResponse.arrayBuffer();
            console.log('[LinkedIn] Imagen descargada:', imageBuffer.byteLength, 'bytes');

            const uploadResponse = await fetch(uploadUrl, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.linkedinToken}`,
                    'Content-Type': 'image/png',
                },
                body: imageBuffer,
            });

            if (!uploadResponse.ok) {
                console.error('[LinkedIn] Error al subir imagen');
                return false;
            }

            console.log('[LinkedIn] Imagen subida exitosamente');
            return true;
        } catch (error) {
            console.error('[LinkedIn] Error en uploadImage:', error.message);
            return false;
        }
    }

    private async createPost(
        personUrn: string,
        caption: string,
        assetUrn: string,
    ): Promise<string | null> {
        try {
            const postPayload = {
                author: personUrn,
                lifecycleState: 'PUBLISHED',
                specificContent: {
                    'com.linkedin.ugc.ShareContent': {
                        shareCommentary: {
                            text: caption,
                        },
                        shareMediaCategory: 'IMAGE',
                        media: [
                            {
                                status: 'READY',
                                description: {
                                    text: 'Publicación de la UAGRM - FCCT',
                                },
                                media: assetUrn,
                                title: {
                                    text: 'UAGRM',
                                },
                            },
                        ],
                    },
                },
                visibility: {
                    'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
                },
            };

            const response = await fetch(`${this.linkedinApiUrl}/ugcPosts`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.linkedinToken}`,
                    'Content-Type': 'application/json',
                    'X-Restli-Protocol-Version': '2.0.0',
                },
                body: JSON.stringify(postPayload),
            });

            if (!response.ok) {
                const error = await response.json();
                console.error('[LinkedIn] Error al crear post:', error);
                return null;
            }

            const data = await response.json();
            const postId = data.id;
            console.log('[LinkedIn] Post creado:', postId);
            return postId;
        } catch (error) {
            console.error('[LinkedIn] Error en createPost:', error.message);
            return null;
        }
    }
}
