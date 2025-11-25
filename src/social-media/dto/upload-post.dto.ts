import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';

import { SocialMediaPlatform } from '../enums/social-media-platform.enum';

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
