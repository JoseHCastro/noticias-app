import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ChatbotService } from './chatbot.service';
import { PostsService } from './posts.service';
import { ChatbotController } from './chatbot.controller';
import { Post } from './entities/post.entity';
import { Chat } from './entities/chat.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { SocialMediaModule } from '../social-media/social-media.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Post, Chat, ChatMessage]),
    SocialMediaModule,
    StorageModule,
  ],
  controllers: [ChatbotController],
  providers: [ChatbotService, PostsService],
  exports: [ChatbotService, PostsService],
})
export class ChatbotModule { }
