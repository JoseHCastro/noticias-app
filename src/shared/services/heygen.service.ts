import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class HeyGenService {
    private readonly logger = new Logger(HeyGenService.name);
    private readonly apiKey: string;
    private readonly apiUrl = 'https://api.heygen.com';

    // Avatar ID: "Anna_public_20240108" (Solicitado por usuario)
    // Voice ID: "5fbecc8a2585441aab29ca46a5cd9356" (Sofía - Español México Neural)
    private readonly defaultAvatarId = 'Anna_public_20240108';
    private readonly defaultVoiceId = '5fbecc8a2585441aab29ca46a5cd9356';

    constructor(private configService: ConfigService) {
        this.apiKey = this.configService.get<string>('HEYGEN_API_KEY') || '';
        if (!this.apiKey) {
            this.logger.warn('HEYGEN_API_KEY no está configurada. La generación de video fallará.');
        }
    }

    /**
     * Genera un video en HeyGen y espera a que esté listo
     * @param text Texto del guion (script)
     * @returns URL del video generado o undefined si falla
     */
    async generateVideo(text: string): Promise<string | undefined> {
        if (!this.apiKey) return undefined;

        try {
            this.logger.log('Iniciando generación de video en HeyGen...');

            // 1. Solicitar generación
            const videoId = await this.requestVideoGeneration(text);
            if (!videoId) return undefined;

            this.logger.log(`Video solicitado. ID: ${videoId}. Esperando procesamiento...`);

            // 2. Esperar a que se complete (Polling)
            const videoUrl = await this.waitForVideoCompletion(videoId);

            if (videoUrl) {
                this.logger.log(`Video generado exitosamente: ${videoUrl}`);
            } else {
                this.logger.error('El video no se completó exitosamente o expiró el tiempo de espera.');
            }

            return videoUrl;
        } catch (error) {
            this.logger.error('Error en el flujo de HeyGen:', error);
            return undefined;
        }
    }

    private async requestVideoGeneration(text: string): Promise<string | undefined> {
        try {
            const payload = {
                video_inputs: [
                    {
                        character: {
                            type: 'avatar',
                            avatar_id: this.defaultAvatarId,
                            avatar_style: 'normal',
                        },
                        voice: {
                            type: 'text',
                            input_text: text,
                            voice_id: this.defaultVoiceId,
                        },
                        background: {
                            type: 'image',
                            url: 'https://res.cloudinary.com/dxicjichu/image/upload/v1764053804/navxnfukfilodlyhcowy.png', // Imagen de fondo UAGRM
                        },
                    },
                ],
                dimension: {
                    width: 720,
                    height: 1280, // 9:16 Portrait (720p compatible con Free Tier)
                },
                test: false, // Set to true for testing without credit consumption (watermarked)
                caption: true, // Enable automatic captions
            };

            const response = await axios.post(`${this.apiUrl}/v2/video/generate`, payload, {
                headers: {
                    'X-Api-Key': this.apiKey,
                    'Content-Type': 'application/json',
                },
            });

            return response.data?.data?.video_id;
        } catch (error) {
            this.logger.error('Error solicitando video a HeyGen:', error.response?.data || error.message);
            return undefined;
        }
    }

    private async waitForVideoCompletion(videoId: string): Promise<string | undefined> {
        const maxAttempts = 120; // 120 intentos * 5 seg = 10 minutos máx
        const intervalMs = 5000; // 5 segundos entre intentos

        for (let i = 0; i < maxAttempts; i++) {
            try {
                const response = await axios.get(`${this.apiUrl}/v1/video_status.get`, {
                    params: { video_id: videoId },
                    headers: {
                        'X-Api-Key': this.apiKey,
                    },
                });

                const status = response.data?.data?.status;
                const videoUrl = response.data?.data?.video_url;
                const error = response.data?.data?.error;

                this.logger.debug(`Estado del video (${i + 1}/${maxAttempts}): ${status}`);

                if (status === 'completed') {
                    return videoUrl;
                } else if (status === 'failed') {
                    this.logger.error(`Generación de video falló: ${JSON.stringify(error)}`);
                    return undefined;
                }

                // Esperar antes del siguiente intento
                await new Promise(resolve => setTimeout(resolve, intervalMs));
            } catch (error) {
                this.logger.error('Error consultando estado del video:', error.message);
                // No abortamos inmediatamente por un error de red transitorio
                await new Promise(resolve => setTimeout(resolve, intervalMs));
            }
        }

        this.logger.warn('Tiempo de espera agotado para la generación del video.');
        return undefined;
    }
}
