import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PublishResult } from '../interfaces/publish-result.interface';

@Injectable()
export class PublishWhatsappService {
  private readonly whatsappToken: string | undefined;
  private readonly whatsappPhoneId: string | undefined;

  constructor(private configService: ConfigService) {
    this.whatsappToken = this.configService.get<string>('WHATSAPP_TOKEN');
    this.whatsappPhoneId = this.configService.get<string>('WHATSAPP_PHONE_ID');

    if (!this.whatsappToken) {
      console.warn('⚠️ WHATSAPP_TOKEN no configurado en .env');
    }
    if (!this.whatsappPhoneId) {
      console.warn('⚠️ WHATSAPP_PHONE_ID no configurado en .env');
    }
  }

  async publish(caption: string, imageUrl: string): Promise<PublishResult> {
    try {
      console.log('💬 Publicando en WhatsApp...');

      if (!this.whatsappToken || !this.whatsappPhoneId) {
        return {
          success: false,
          platform: 'whatsapp',
          error: 'Token o Phone ID no configurado',
        };
      }

      // TODO: Implementar lógica de publicación en WhatsApp Business API
      // Referencia: https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages

      console.warn('⚠️ Publicación en WhatsApp no implementada aún');
      return {
        success: false,
        platform: 'whatsapp',
        error: 'Funcionalidad no implementada',
      };
    } catch (error) {
      console.error('❌ Error al publicar en WhatsApp:', error.message);
      return {
        success: false,
        platform: 'whatsapp',
        error: error.message,
      };
    }
  }
}
