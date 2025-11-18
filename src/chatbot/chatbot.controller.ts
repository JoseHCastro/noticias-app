import { Body, Controller, Post, Get, Delete, Param, UseGuards, ValidationPipe, Request } from '@nestjs/common';
import { ChatbotService } from './chatbot.service';
import { SocialMediaPublisherService } from './social-media-publisher.service';
import { SendMessageDto, CreateChatDto } from './dto/chat.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('chatbot')
@UseGuards(JwtAuthGuard)
export class ChatbotController {
  constructor(
    private chatbotService: ChatbotService,
    private socialMediaPublisher: SocialMediaPublisherService,
  ) {}

  // ENVIAR MENSAJE AL CHAT (principal endpoint)
  @Post('send-message')
  async sendMessage(
    @Body(ValidationPipe) sendMessageDto: SendMessageDto,
    @Request() req: any,
  ) {
    return this.chatbotService.sendMessage(
      req.user.userId,
      sendMessageDto.message,
      sendMessageDto.chatId,
    );
  }

  // CREAR UN NUEVO CHAT
  @Post('create-chat')
  async createChat(
    @Body(ValidationPipe) createChatDto: CreateChatDto,
    @Request() req: any,
  ) {
    const chat = await this.chatbotService.createChat(
      req.user.userId,
      createChatDto.title,
    );
    return {
      chatId: chat.id,
      title: chat.title,
      createdAt: chat.createdAt,
    };
  }

  // VER TODOS MIS CHATS
  @Get('chats')
  async getChats(@Request() req: any) {
    const chats = await this.chatbotService.getUserChats(req.user.userId);
    return {
      count: chats.length,
      chats: chats.map(chat => ({
        id: chat.id,
        title: chat.title,
        lastMessageAt: chat.lastMessageAt,
        messageCount: chat.messages?.length || 0,
      })),
    };
  }

  // VER UN CHAT ESPECÍFICO CON TODOS SUS MENSAJES Y SUS POSTS
  @Get('chat/:id')
  async getChat(@Param('id') chatId: string, @Request() req: any) {
    const chat = await this.chatbotService.getChatById(chatId, req.user.userId);
    
    if (!chat) {
      return { error: 'Chat no encontrado' };
    }

    // Obtener los posts de cada mensaje que los tenga
    const messagesWithPosts = await Promise.all(
      chat.messages.map(async (msg) => {
        const posts = msg.postsGenerated 
          ? await this.chatbotService.getChatPosts(msg.id, req.user.userId)
          : [];

        return {
          id: msg.id,
          role: msg.role, // 'user' = mensaje del usuario, 'assistant' = respuesta del sistema, 'system' = mensaje interno
          sender: msg.role === 'user' ? 'user' : 'bot', // Campo adicional para facilitar identificación en el frontend
          content: msg.content,
          isNewsValidated: msg.isNewsValidated,
          postsGenerated: msg.postsGenerated,
          createdAt: msg.createdAt,
          // Incluir los posts si existen
          posts: posts.map(post => ({
            id: post.id,
            platform: post.platform,
            content: post.content,
            imageUrl: post.imageUrl,
            videoUrl: post.videoUrl,
            imagePrompt: post.imagePrompt,
            createdAt: post.createdAt,
          })),
        };
      })
    );

    return {
      id: chat.id,
      title: chat.title,
      createdAt: chat.createdAt,
      lastMessageAt: chat.lastMessageAt,
      messageCount: chat.messages?.length || 0,
      messages: messagesWithPosts,
    };
  }

  // ELIMINAR UN CHAT
  @Delete('chat/:id')
  async deleteChat(@Param('id') chatId: string, @Request() req: any) {
    const deleted = await this.chatbotService.deleteChat(chatId, req.user.userId);
    return {
      success: deleted,
      message: deleted ? 'Chat eliminado' : 'Chat no encontrado',
    };
  }

  // VER POSTS GENERADOS DE UN MENSAJE
  @Get('message/:messageId/posts')
  async getMessagePosts(
    @Param('messageId') messageId: string,
    @Request() req: any,
  ) {
    const posts = await this.chatbotService.getChatPosts(messageId, req.user.userId);
    return {
      count: posts.length,
      posts: posts.map(post => ({
        id: post.id,
        platform: post.platform,
        content: post.content,
        imageUrl: post.imageUrl,
        videoUrl: post.videoUrl,
        createdAt: post.createdAt,
      })),
    };
  }

  // VER HISTORIAL GENERAL DE POSTS
  @Get('history')
  async getHistory(@Request() req: any) {
    const posts = await this.chatbotService.getPostHistory(req.user.userId);
    return {
      count: posts.length,
      posts: posts.map(post => ({
        id: post.id,
        prompt: post.prompt,
        platform: post.platform,
        content: post.content,
        imageUrl: post.imageUrl,
        videoUrl: post.videoUrl,
        createdAt: post.createdAt,
      })),
    };
  }

  // VER POST ESPECÍFICO
  @Get('post/:id')
  async getPost(@Param('id') id: string, @Request() req: any) {
    const post = await this.chatbotService.getPostById(id, req.user.userId);
    
    if (!post) {
      return { error: 'Post no encontrado' };
    }

    return {
      id: post.id,
      prompt: post.prompt,
      platform: post.platform,
      content: post.content,
      imageUrl: post.imageUrl,
      videoUrl: post.videoUrl,
      imagePrompt: post.imagePrompt,
      additionalContext: post.additionalContext,
      createdAt: post.createdAt,
    };
  }

  // PUBLICAR POST EN REDES SOCIALES
  @Post('post/:id/publish')
  async publishPost(
    @Param('id') id: string,
    @Body() body: { platforms: string[] },
    @Request() req: any,
  ) {
    const post = await this.chatbotService.getPostById(id, req.user.userId);
    
    if (!post) {
      return { error: 'Post no encontrado' };
    }

    if (!post.imageUrl) {
      return { error: 'El post no tiene imagen para publicar' };
    }

    // Publicar en las plataformas especificadas
    const results = await this.socialMediaPublisher.publishToSocialMedia(
      body.platforms,
      post.content,
      post.imageUrl,
    );

    return {
      postId: post.id,
      platform: post.platform,
      publishResults: results,
    };
  }

  // PUBLICAR TODOS LOS POSTS DE UN MENSAJE EN FACEBOOK E INSTAGRAM
  @Post('message/:messageId/publish-all')
  async publishAllPosts(
    @Param('messageId') messageId: string,
    @Request() req: any,
  ) {
    const posts = await this.chatbotService.getChatPosts(messageId, req.user.userId);
    
    if (!posts || posts.length === 0) {
      return { error: 'No se encontraron posts para este mensaje' };
    }

    const results: any[] = [];

    // Publicar post de Facebook
    const facebookPost = posts.find(p => p.platform === 'facebook');
    if (facebookPost && facebookPost.imageUrl) {
      const fbResult = await this.socialMediaPublisher.publishToFacebook(
        facebookPost.content,
        facebookPost.imageUrl,
      );
      results.push({ post: 'facebook', ...fbResult });
    }

    // Publicar post de Instagram
    const instagramPost = posts.find(p => p.platform === 'instagram');
    if (instagramPost && instagramPost.imageUrl) {
      const igResult = await this.socialMediaPublisher.publishToInstagram(
        instagramPost.content,
        instagramPost.imageUrl,
      );
      results.push({ post: 'instagram', ...igResult });
    }

    return {
      messageId,
      totalPosts: posts.length,
      published: results.length,
      results,
    };
  }
}
