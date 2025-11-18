import { IsNotEmpty, IsString, IsOptional, IsUUID } from 'class-validator';

export class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  message: string;

  @IsUUID()
  @IsOptional()
  chatId?: string;
}

export class CreateChatDto {
  @IsString()
  @IsNotEmpty()
  title: string;
}
