import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PublishFacebookService } from './services/publish-facebook.service';
import { PublishInstagramService } from './services/publish-instagram.service';
import { PublishLinkedinService } from './services/publish-linkedin.service';
import { PublishTiktokService } from './services/publish-tiktok.service';
import { PublishTiktokAuthController } from './controllers/publish-tiktok-auth.controller';
import { TiktokTokenManualController } from './controllers/tiktok-token-manual.controller';
import { TiktokUploadController } from './controllers/tiktok-upload.controller';

@Module({
  imports: [
    ConfigModule,
  ],
  controllers: [PublishTiktokAuthController, TiktokTokenManualController, TiktokUploadController],
  providers: [
    PublishFacebookService,
    PublishInstagramService,
    PublishLinkedinService,
    PublishTiktokService,
  ],
  exports: [
    PublishFacebookService,
    PublishInstagramService,
    PublishLinkedinService,
    PublishTiktokService,
  ],
})
export class PublishModule { }
