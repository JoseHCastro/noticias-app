import { IsNotEmpty, IsString, IsEnum, IsOptional } from 'class-validator';

export enum SocialPlatform {
  INSTAGRAM = 'instagram',
  FACEBOOK = 'facebook',
  TIKTOK = 'tiktok',
  LINKEDIN = 'linkedin',
}

export class GeneratePostDto {
  @IsString()
  @IsNotEmpty()
  prompt: string;

  @IsEnum(SocialPlatform)
  @IsNotEmpty()
  platform: SocialPlatform;

  @IsString()
  @IsOptional()
  additionalContext?: string;
}
