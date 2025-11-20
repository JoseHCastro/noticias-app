import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PublishFacebookService } from './services/publish-facebook.service';
import { PublishInstagramService } from './services/publish-instagram.service';
import { PublishLinkedinService } from './services/publish-linkedin.service';
import { PublishWhatsappService } from './services/publish-whatsapp.service';
import { PublishTiktokService } from './services/publish-tiktok.service';
import { PublishTiktokAuthController } from './controllers/publish-tiktok-auth.controller';

@Module({
  imports: [
    ConfigModule,
  ],
  controllers: [PublishTiktokAuthController],
  providers: [
    PublishFacebookService,
    PublishInstagramService,
    PublishLinkedinService,
    PublishWhatsappService,
    PublishTiktokService,
  ],
  exports: [
    PublishFacebookService,
    PublishInstagramService,
    PublishLinkedinService,
    PublishWhatsappService,
    PublishTiktokService,
  ],
})
export class PublishModule {}
