import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Post } from './entities/post.entity';
import { Chat } from './entities/chat.entity';
import { ChatMessage, MessageRole } from './entities/chat-message.entity';
import { PostsService } from './posts.service';
import { SocialMediaFacadeService } from '../social-media/services/social-media-facade.service';
import { UploadPostDto } from '../social-media/dto/upload-post.dto';
import { SocialMediaPlatform } from '../social-media/enums/social-media-platform.enum';

/**
 * ChatbotService - Servicio principal del chatbot
 * 
 * Responsabilidades:
 * - Gestión de chats y mensajes
 * - Orquestación del flujo de validación y generación de posts
 * - Publicación automática en redes sociales
 */
@Injectable()
export class ChatbotService {
  private readonly logger = new Logger(ChatbotService.name);

  constructor(
    private postsService: PostsService,
    private socialMediaFacade: SocialMediaFacadeService,
    @InjectRepository(Post)
    private postsRepository: Repository<Post>,
    @InjectRepository(Chat)
    private chatsRepository: Repository<Chat>,
    @InjectRepository(ChatMessage)
    private chatMessagesRepository: Repository<ChatMessage>,
  ) { }

  // GESTIÓN DE CHATS
  async createChat(userId: string, title: string): Promise<Chat> {
    const chat = this.chatsRepository.create({
      userId,
      title,
    });
    return this.chatsRepository.save(chat);
  }

  async getUserChats(userId: string): Promise<Chat[]> {
    return this.chatsRepository.find({
      where: { userId },
      order: { lastMessageAt: 'DESC' },
      relations: ['messages'],
    });
  }

  async getChatById(chatId: string, userId: string): Promise<Chat | null> {
    const chat = await this.chatsRepository.findOne({
      where: { id: chatId, userId },
      relations: ['messages'],
    });

    // Ordenar mensajes manualmente si el chat existe
    if (chat && chat.messages) {
      chat.messages.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    }

    return chat;
  }

  async deleteChat(chatId: string, userId: string): Promise<boolean> {
    const result = await this.chatsRepository.delete({ id: chatId, userId });
    return (result.affected ?? 0) > 0;
  }

  // ENVIAR MENSAJE Y PROCESAR (ASÍNCRONO PARA EVITAR TIMEOUT)
  async sendMessage(userId: string, message: string, chatId?: string): Promise<any> {
    let chat: Chat;

    // Si no hay chatId, crear uno nuevo
    if (!chatId) {
      const title = message.substring(0, 50) + (message.length > 50 ? '...' : '');
      chat = await this.createChat(userId, title);
    } else {
      const foundChat = await this.getChatById(chatId, userId);
      if (!foundChat) {
        throw new BadRequestException('Chat no encontrado');
      }
      chat = foundChat;
    }

    // Guardar mensaje del usuario
    const userMessage = await this.chatMessagesRepository.save({
      chatId: chat.id,
      role: MessageRole.USER,
      content: message,
    });

    // Actualizar marca de tiempo del usuario
    await this.chatMessagesRepository.update(userMessage.id, {
      isNewsValidated: true,
    });

    // 1. VALIDACIÓN Y GENERACIÓN DE TEXTOS (Rápido: ~5-10s)
    const validation = await this.postsService.validateAndGenerateTexts(message);

    if (!validation.isValid) {
      // Respuesta negativa inmediata
      const assistantMessage = await this.chatMessagesRepository.save({
        chatId: chat.id,
        role: MessageRole.ASSISTANT,
        content: ` ${validation.reason}\n\nPor favor, proporciona una noticia, evento o información relacionada con la UAGRM o la Facultad de Ciencias de la Computación y Telecomunicaciones.`,
        isNewsValidated: false,
      });

      await this.chatsRepository.update(chat.id, { lastMessageAt: new Date() });

      return {
        chatId: chat.id,
        messageId: userMessage.id,
        assistantMessageId: assistantMessage.id,
        isValid: false,
        reason: validation.reason,
        message: assistantMessage.content,
        posts: [],
      };
    }

    // 2. RESPUESTA INMEDIATA AL USUARIO (Para evitar Timeout)
    const processingMessage = await this.chatMessagesRepository.save({
      chatId: chat.id,
      role: MessageRole.ASSISTANT,
      content: `✅ Noticia validada. He generado los borradores de texto.\n\n⏳ **Iniciando generación de multimedia (Imagen + Video IA)...**\n\nEsto puede tomar unos minutos (especialmente el video). Te notificaré aquí cuando termine y publicaré automáticamente.`,
      isNewsValidated: true,
      postsGenerated: false, // Aún no están listos los posts finales con media
    });

    // 3. LANZAR PROCESO PESADO EN BACKGROUND (Fire and Forget)
    // No usamos 'await' aquí para liberar la respuesta HTTP
    this.processAsyncContent(
      message,
      userId,
      userMessage.id,
      validation.posts || [],
      chat.id
    ).catch(err => this.logger.error('Error en proceso asíncrono:', err));

    return {
      chatId: chat.id,
      messageId: userMessage.id,
      assistantMessageId: processingMessage.id,
      validationResult: {
        isValid: true,
        reason: validation.reason,
      },
      message: 'Procesamiento iniciado. Recibirás una notificación cuando termine.',
      status: 'processing_background'
    };
  }

  /**
   * Procesa la generación de multimedia y publicación en segundo plano
   */
  private async processAsyncContent(
    message: string,
    userId: string,
    userMessageId: string,
    preGeneratedTexts: any[],
    chatId: string
  ) {
    this.logger.log(`[Background] Iniciando generación de contenido para chat ${chatId}...`);

    try {
      // Generar los 5 posts con multimedia (Lento: Imagen + Video HeyGen)
      const posts = await this.postsService.generateAllPosts(message, userId, userMessageId, preGeneratedTexts);

      // Marcar el mensaje del usuario como completado
      await this.chatMessagesRepository.update(userMessageId, {
        postsGenerated: true,
      });

      // PUBLICAR AUTOMÁTICAMENTE
      const publishResults: any[] = [];
      const platformsToPublish = [
        { name: 'facebook', enum: SocialMediaPlatform.FACEBOOK },
        { name: 'instagram', enum: SocialMediaPlatform.INSTAGRAM },
        { name: 'linkedin', enum: SocialMediaPlatform.LINKEDIN },
        { name: 'tiktok', enum: SocialMediaPlatform.TIKTOK }
      ];

      for (const platform of platformsToPublish) {
        const post = posts.find(p => p.platform === platform.name);
        // Para TikTok usamos videoUrl, para los demás imageUrl
        const mediaUrl = platform.name === 'tiktok' ? post?.videoUrl : post?.imageUrl;

        if (post && mediaUrl) {
          const result = await this.socialMediaFacade.publishContent(
            platform.enum,
            post.content,
            mediaUrl
          );
          publishResults.push(result);
        }
      }

      // Contar resultados
      const successfulPublishes = publishResults.filter(r => r.success).length;
      const failedPublishes = publishResults.filter(r => !r.success);

      // Crear mensaje final de éxito
      let responseContent = `🎉 **¡Proceso completado!**\n\n` +
        `✅ Imagen generada\n` +
        `✅ Video generado (TikTok)\n` +
        `✅ Publicación automática:\n`;

      if (successfulPublishes > 0) {
        responseContent += `   • ${successfulPublishes} posts publicados (FB, IG, LI)\n`;
      }
      if (failedPublishes.length > 0) {
        responseContent += `   • ${failedPublishes.length} fallaron\n`;
      }

      // Agregar links o info de TikTok/WhatsApp
      const tiktokPost = posts.find(p => p.platform === 'tiktok');
      if (tiktokPost && tiktokPost.videoUrl) {
        responseContent += `\n📱 **TikTok**: Video generado exitosamente.\n🔗 [Ver Video](${tiktokPost.videoUrl})\n`;
      }

      const whatsappPost = posts.find(p => p.platform === 'whatsapp');
      if (whatsappPost) {
        responseContent += `💬 **WhatsApp**: Contenido listo para enviar.\n`;
      }

      // Guardar mensaje de notificación final
      await this.chatMessagesRepository.save({
        chatId: chatId,
        role: MessageRole.ASSISTANT,
        content: responseContent,
        isNewsValidated: true,
        postsGenerated: true,
      });

      await this.chatsRepository.update(chatId, { lastMessageAt: new Date() });
      this.logger.log(`[Background] Proceso finalizado para chat ${chatId}`);

    } catch (error) {
      this.logger.error(`[Background] Error procesando contenido: ${error.message}`, error.stack);

      // Notificar error al usuario
      await this.chatMessagesRepository.save({
        chatId: chatId,
        role: MessageRole.ASSISTANT,
        content: `❌ Ocurrió un error generando el contenido multimedia: ${error.message}`,
        isNewsValidated: true,
        postsGenerated: false,
      });
    }
  }

  // Obtener posts de un chat específico
  async getChatPosts(chatMessageId: string, userId: string): Promise<Post[]> {
    return this.postsService.getChatPosts(chatMessageId, userId);
  }

  // MÉTODOS LEGACY (mantener compatibilidad)
  async getPostHistory(userId: string, limit: number = 20): Promise<Post[]> {
    return this.postsService.getPostHistory(userId, limit);
  }

  async getPostById(id: string, userId: string): Promise<Post | null> {
    return this.postsService.getPostById(id, userId);
  }
}
