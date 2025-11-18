import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ChatbotService } from './chatbot.service';
import { PostsService } from './posts.service';
import { SocialMediaPublisherService } from './social-media-publisher.service';
import { ChatbotController } from './chatbot.controller';
import { Post } from './entities/post.entity';
import { Chat } from './entities/chat.entity';
import { ChatMessage } from './entities/chat-message.entity';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Post, Chat, ChatMessage]),
  ],
  controllers: [ChatbotController],
  providers: [ChatbotService, PostsService, SocialMediaPublisherService],
  exports: [ChatbotService, PostsService, SocialMediaPublisherService],
})
export class ChatbotModule {}
