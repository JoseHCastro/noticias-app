import { Injectable } from '@nestjs/common';
import { SocialMediaPlatform } from '../../dto/upload-post.dto';
import { ISocialMediaPublisher } from '../../interfaces/publisher.interface';
import { FacebookPublisherService } from './facebook-publisher.service';
import { InstagramPublisherService } from './instagram-publisher.service';
import { LinkedinPublisherService } from './linkedin-publisher.service';
import { TiktokPublisherService } from './tiktok-publisher.service';

/**
 * Factory Service para obtener el publisher correcto según la plataforma
 * Implementa Factory Pattern
 */
@Injectable()
export class PublisherFactoryService {
    constructor(
        private facebookPublisher: FacebookPublisherService,
        private instagramPublisher: InstagramPublisherService,
        private linkedinPublisher: LinkedinPublisherService,
        private tiktokPublisher: TiktokPublisherService,
    ) { }

    /**
     * Obtiene el publisher correspondiente a la plataforma
     * @param platform - Plataforma de red social
     * @returns Publisher service
     */
    getPublisher(platform: SocialMediaPlatform): ISocialMediaPublisher {
        switch (platform) {
            case SocialMediaPlatform.FACEBOOK:
                return this.facebookPublisher;
            case SocialMediaPlatform.INSTAGRAM:
                return this.instagramPublisher;
            case SocialMediaPlatform.LINKEDIN:
                return this.linkedinPublisher;
            default:
                throw new Error(`Plataforma no soportada: ${platform}`);
        }
    }

    /**
     * Obtiene el publisher de TikTok (separado porque usa videos)
     */
    getTiktokPublisher(): TiktokPublisherService {
        return this.tiktokPublisher;
    }
}
