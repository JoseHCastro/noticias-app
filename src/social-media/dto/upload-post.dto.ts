import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * Enum de plataformas soportadas para publicación manual
 */
export enum SocialMediaPlatform {
    FACEBOOK = 'facebook',
    INSTAGRAM = 'instagram',
    LINKEDIN = 'linkedin',
    TIKTOK = 'tiktok',
}

/**
 * DTO para validar datos de publicación manual
 */
export class UploadPostDto {
    @IsEnum(SocialMediaPlatform, {
        message: 'Platform debe ser: facebook, instagram o linkedin',
    })
    @IsNotEmpty({ message: 'Platform es requerido' })
    platform: SocialMediaPlatform;

    @IsString({ message: 'Caption debe ser un texto' })
    @IsNotEmpty({ message: 'Caption es requerido' })
    @MaxLength(3000, { message: 'Caption no puede exceder 3000 caracteres' })
    caption: string;
}
