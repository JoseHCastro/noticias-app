import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

// Controllers
import { SocialMediaController } from './controllers/social-media.controller';
import { TiktokAuthController } from './controllers/tiktok-auth.controller';

// Services - Facade
import { SocialMediaFacadeService } from './services/social-media-facade.service';

// Services - Publishers
import { FacebookPublisherService } from './services/publishers/facebook-publisher.service';
import { InstagramPublisherService } from './services/publishers/instagram-publisher.service';
import { LinkedinPublisherService } from './services/publishers/linkedin-publisher.service';
import { TiktokPublisherService } from './services/publishers/tiktok-publisher.service';
import { PublisherFactoryService } from './services/publishers/publisher-factory.service';

// Services - Upload
import { FileUploadService } from './services/upload/file-upload.service';

// Shared
import { SharedModule } from '../shared/shared.module';

/**
 * Módulo unificado de redes sociales
 * Soporta Facebook, Instagram, LinkedIn y TikTok
 */
@Module({
    imports: [ConfigModule, SharedModule],
    controllers: [SocialMediaController, TiktokAuthController],
    providers: [
        // Facade
        SocialMediaFacadeService,

        // Factory
        PublisherFactoryService,

        // Publishers
        FacebookPublisherService,
        InstagramPublisherService,
        LinkedinPublisherService,
        TiktokPublisherService,

        // Upload
        FileUploadService,
    ],
    exports: [
        // Exportar facade para uso en otros módulos (ej: chatbot)
        SocialMediaFacadeService,

        // Exportar publishers individuales por compatibilidad
        FacebookPublisherService,
        InstagramPublisherService,
        LinkedinPublisherService,
        TiktokPublisherService,
    ],
})
export class SocialMediaModule { }
