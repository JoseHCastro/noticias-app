import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpClientService } from './services/http-client.service';
import { CryptoService } from './services/crypto.service';
import { HtmlRendererService } from './services/html-renderer.service';
import { CloudinaryService } from './services/cloudinary.service';
import { HeyGenService } from './services/heygen.service';

/**
 * Módulo compartido con servicios utilitarios
 * @Global permite que esté disponible en toda la aplicación sin importar
 */
@Global()
@Module({
    imports: [ConfigModule],
    providers: [
        HttpClientService,
        CryptoService,
        HtmlRendererService,
        CloudinaryService,
        HeyGenService,
    ],
    exports: [
        HttpClientService,
        CryptoService,
        HtmlRendererService,
        CloudinaryService,
        HeyGenService,
    ],
})
export class SharedModule { }
