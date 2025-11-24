import { PublishResult } from './publish-result.interface';

/**
 * Interfaz común para servicios de publicación en redes sociales
 * Implementa el principio de Inversión de Dependencias (DIP)
 */
export interface ISocialMediaPublisher {
    /**
     * Publica contenido con imagen en la red social
     * @param caption - Texto del post
     * @param imageUrl - URL pública de la imagen
     * @returns Resultado de la publicación
     */
    publish(caption: string, imageUrl: string): Promise<PublishResult>;
}
