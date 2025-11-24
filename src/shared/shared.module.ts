import { Module, Global } from '@nestjs/common';
import { HttpClientService } from './services/http-client.service';
import { CryptoService } from './services/crypto.service';
import { HtmlRendererService } from './services/html-renderer.service';

/**
 * Módulo compartido con servicios utilitarios
 * @Global permite que esté disponible en toda la aplicación sin importar
 */
@Global()
@Module({
    providers: [
        HttpClientService,
        CryptoService,
        HtmlRendererService,
    ],
    exports: [
        HttpClientService,
        CryptoService,
        HtmlRendererService,
    ],
})
export class SharedModule { }
