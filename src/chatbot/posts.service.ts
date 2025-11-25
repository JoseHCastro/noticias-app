import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { Post } from './entities/post.entity';
import { StorageService } from '../storage/storage.service';
import { CloudinaryService } from '../shared/services/cloudinary.service';
import { HeyGenService } from '../shared/services/heygen.service';

interface GeneratedPost {
  platform: string;
  content: string;
  imageUrl?: string;
  videoUrl?: string;
  imagePrompt?: string;
}

@Injectable()
export class PostsService {
  private openai: OpenAI;
  private readonly baseContext = `
Eres un asistente especializado en crear contenido para redes sociales para la Facultad de Ciencias de la Computación y Telecomunicaciones de la Universidad Autónoma Gabriel René Moreno (UAGRM).

Información de contexto:
- Universidad: Universidad Autónoma Gabriel René Moreno (UAGRM)
- Facultad: Ciencias de la Computación y Telecomunicaciones
- Ubicación: Santa Cruz de la Sierra, Bolivia
- Áreas académicas: Ingeniería de Sistemas, Ingeniería Informática, Ingeniería en Telecomunicaciones
- Enfoque: Educación superior en tecnología, innovación, desarrollo de software, redes, inteligencia artificial, ciberseguridad
`;

  constructor(
    private configService: ConfigService,
    private storageService: StorageService,
    private cloudinaryService: CloudinaryService,
    private heyGenService: HeyGenService,
    @InjectRepository(Post)
    private postsRepository: Repository<Post>,
  ) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');

    if (!apiKey) {
      throw new Error('OPENAI_API_KEY no está configurada en las variables de entorno');
    }

    this.openai = new OpenAI({
      apiKey: apiKey,
    });
  }

  // VALIDAR Y GENERAR TEXTOS EN 1 SOLA LLAMADA
  async validateAndGenerateTexts(message: string): Promise<{
    isValid: boolean;
    reason: string;
    posts?: Array<{ platform: string; content: string }>;
  }> {
    try {
      console.log(' [LLAMADA 1/2] Validando contenido y generando textos:', message);

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Eres un asistente especializado de la Universidad Autónoma Gabriel René Moreno (UAGRM) y la Facultad de Ciencias de la Computación y Telecomunicaciones.

TAREA:
1. VALIDAR si el mensaje es una noticia/evento/logro relacionado con UAGRM o FICCT (actividades académicas, eventos estudiantiles, tecnología, programación, innovación).
2. Si es VÁLIDO, generar 5 posts profesionales para Instagram, Facebook, TikTok, LinkedIn y WhatsApp.

INSTRUCCIONES POR PLATAFORMA:
- Instagram: 2200 caracteres máx, emojis, 5-10 hashtags (#UAGRM #Computación #Tecnología)
- Facebook: 500 palabras, tono informativo, 3-5 hashtags
- TikTok: Script 30-60 seg, hook fuerte, lenguaje juvenil, 3-4 hashtags
- LinkedIn: 150-300 palabras, profesional, bullets points, 3-5 hashtags
- WhatsApp: Breve, directo, tono cercano, emojis, ideal para difusión en grupos, sin hashtags excesivos.

Responde ÚNICAMENTE con este JSON:
{
  "isValid": true/false,
  "reason": "explicación breve",
  "posts": [
    {"platform": "instagram", "content": "texto completo del post"},
    {"platform": "facebook", "content": "texto completo del post"},
    {"platform": "tiktok", "content": "script completo"},
    {"platform": "linkedin", "content": "texto completo del post"},
    {"platform": "whatsapp", "content": "texto completo del post"}
  ]
}

Si NO es válido, devuelve solo isValid:false y reason, sin posts.`,
          },
          {
            role: 'user',
            content: message,
          },
        ],
        temperature: 0.8,
        max_tokens: 3500,
      });

      const response = completion.choices[0].message.content || '{"isValid": false, "reason": "No se pudo validar"}';
      console.log(' [LLAMADA 1/2] Respuesta completa:', response.substring(0, 500) + '...');

      const parsed = JSON.parse(response);
      console.log('Validación:', parsed.isValid, '- Reason:', parsed.reason);
      console.log(' Posts generados:', parsed.posts ? parsed.posts.length : 0);

      return parsed;
    } catch (error) {
      console.error(' Error en validación y generación:', error);
      return { isValid: false, reason: 'Error al validar el contenido' };
    }
  }

  // GENERAR LOS 5 POSTS AUTOMÁTICAMENTE
  async generateAllPosts(
    message: string,
    userId: string,
    chatMessageId: string,
    preGeneratedTexts?: Array<{ platform: string; content: string }>,
  ): Promise<GeneratedPost[]> {
    const posts: GeneratedPost[] = [];

    // LLAMADA 2/2: Generar 1 sola imagen compartida para todas las plataformas (incluido TikTok)
    console.log(' [LLAMADA 2/2] Generando imagen compartida...');
    const sharedImageData = await this.generateImage(message);
    console.log(' [LLAMADA 2/2] Imagen generada en OpenAI:', sharedImageData.imageUrl.substring(0, 80) + '...');

    // Subir imagen a Cloudinary (URL persistente)
    console.log(' Subiendo imagen a Cloudinary...');
    let cloudinaryUrl = 'https://via.placeholder.com/1024x1024?text=Error+Cloudinary';
    try {
      cloudinaryUrl = await this.cloudinaryService.uploadImageFromUrl(sharedImageData.imageUrl);
      console.log(' Imagen disponible en Cloudinary:', cloudinaryUrl);
    } catch (error) {
      console.error('Error subiendo a Cloudinary, usando placeholder:', error);
    }

    // Crear posts con textos pre-generados o generar nuevos (fallback)
    const platforms = ['instagram', 'facebook', 'tiktok', 'linkedin', 'whatsapp'];

    for (const platform of platforms) {
      // Buscar texto pre-generado o generar nuevo como fallback
      const preGenerated = preGeneratedTexts?.find((p) => p.platform === platform);
      const content = preGenerated?.content || (await this.generatePostContent(message, this.getPlatformInstructions(platform)));

      let videoUrl: string | undefined = undefined;
      // Si es TikTok, generar video con HeyGen
      if (platform === 'tiktok') {
        try {
          videoUrl = await this.generateVideo(content);
        } catch (error) {
          console.error('Error generando video para TikTok:', error);
        }
      }

      const post: GeneratedPost = {
        platform,
        content,
        imageUrl: cloudinaryUrl, // URL de Cloudinary
        videoUrl: videoUrl,
        imagePrompt: sharedImageData.prompt,
      };

      // Guardar en base de datos
      const savedPost = await this.postsRepository.save({
        prompt: message,
        platform,
        content,
        userId,
        chatMessageId,
        imageUrl: platform === 'tiktok' ? undefined : post.imageUrl, // TikTok no lleva imagen estática
        videoUrl: post.videoUrl,
        imagePrompt: post.imagePrompt,
      });

      post['id'] = savedPost.id;
      posts.push(post);
    }

    console.log(' Posts guardados en BD:', posts.length);
    return posts;
  }

  // Generar contenido del post
  private async generatePostContent(message: string, platformInstructions: string): Promise<string> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `${this.baseContext}\n\n${platformInstructions}`,
          },
          {
            role: 'user',
            content: `Genera un post profesional sobre: ${message}`,
          },
        ],
        temperature: 0.8,
        max_tokens: 1000,
      });

      return completion.choices[0].message.content || 'No se pudo generar el contenido';
    } catch (error) {
      console.error('Error al generar contenido:', error);
      throw new InternalServerErrorException('Error al generar contenido del post');
    }
  }

  // Generar 1 imagen compartida con DALL-E 3
  private async generateImage(message: string): Promise<{ imageUrl: string; prompt: string }> {
    try {
      const imagePrompt = `Genera una fotografía realista y profesional para redes sociales sobre: "${message}".
Contexto: Facultad de Ciencias de la Computación y Telecomunicaciones (FICCT) de la UAGRM.
Estilo Visual: Fotografía de alta calidad, iluminación natural, estilo cinematográfico moderno.
Elementos Clave: Estudiantes universitarios diversos interactuando con tecnología real (laptops, laboratorios, robots), ambiente de campus universitario moderno y vibrante.
Evitar: Arte abstracto, formas geométricas sin sentido, ilustraciones 3D genéricas, texto en la imagen.
Atmósfera: Innovación, colaboración académica, futuro digital.`;

      const response = await this.openai.images.generate({
        model: 'dall-e-3',
        prompt: imagePrompt,
        n: 1,
        size: '1024x1024',
        quality: 'standard',
      });

      return {
        imageUrl: response.data?.[0]?.url || 'https://via.placeholder.com/1024x1024?text=Error+al+generar+imagen',
        prompt: imagePrompt,
      };
    } catch (error) {
      console.error(' Error al generar imagen:', error);
      return {
        imageUrl: 'https://via.placeholder.com/1024x1024?text=Error+al+generar+imagen',
        prompt: message,
      };
    }
  }

  // Generación de video con HeyGen (TikTok)
  private async generateVideo(script: string): Promise<string | undefined> {
    console.log(' [HeyGen] Iniciando generación de video para TikTok...');

    if (!script || typeof script !== 'string') {
      console.warn(' [HeyGen] Script inválido o vacío, omitiendo generación de video.');
      return undefined;
    }

    // Limitar script para no exceder duración/créditos (aprox 130 caracteres ~ 8-10 seg)
    // HeyGen cobra por duración, así que mantenemos el script muy conciso.
    const shortScript = script.length > 130 ? script.substring(0, 127) + '...' : script;

    const heyGenUrl = await this.heyGenService.generateVideo(shortScript);

    if (!heyGenUrl) {
      console.warn(' [HeyGen] No se pudo generar el video.');
      return undefined;
    }

    console.log(' [HeyGen] Video generado:', heyGenUrl);
    console.log(' [Cloudinary] Subiendo video para persistencia...');

    try {
      const cloudinaryUrl = await this.cloudinaryService.uploadVideoFromUrl(heyGenUrl);
      console.log(' [Cloudinary] Video subido exitosamente:', cloudinaryUrl);
      return cloudinaryUrl;
    } catch (error) {
      console.error(' [Cloudinary] Error subiendo video:', error);
      // Si falla Cloudinary, retornamos la URL de HeyGen (aunque expira) como fallback
      return heyGenUrl;
    }
  }

  // Instrucciones por plataforma
  private getPlatformInstructions(platform: string): string {
    const instructions = {
      instagram: `
Formato para Instagram:
- Máximo 2200 caracteres
- Usa emojis relevantes 
- Incluye 5-10 hashtags relevantes al final (#UAGRM #Computación #Tecnología #Bolivia #SantaCruz)
- Tono: Inspirador y visual
- Estructura: Hook inicial, contenido breve, call-to-action, hashtags
`,
      facebook: `
Formato para Facebook:
- Hasta 500 palabras
- Tono informativo y detallado
- Incluye emojis con moderación
- Estructura: Título atractivo, desarrollo completo, call-to-action
- 3-5 hashtags al final
`,
      tiktok: `
Formato para TikTok:
- Script EXTREMADAMENTE BREVE (máximo 8-10 segundos de lectura)
- Máximo 20-25 palabras.
- Directo para estudiantes de la UAGRM.
- Lenguaje juvenil y urgente.
- Sin introducciones largas, ve al grano.
- Lenguaje juvenil y cercano
- Hook inicial MUY fuerte (primeros 3 segundos)
- Call-to-action claro
- 3-4 hashtags trending + específicos
- Incluye ideas para efectos y transiciones
`,
      linkedin: `
Formato para LinkedIn:
- Tono profesional y educativo
- 150-300 palabras
- Enfoque en valor profesional y oportunidades académicas
- Estructura: Problema/Situación → Solución/Oportunidad → Call-to-action
- Usa bullets points para facilitar lectura
- 3-5 hashtags profesionales
`,
      whatsapp: `
Formato para WhatsApp:
- Breve y directo (máximo 2-3 párrafos cortos)
- Tono cercano y útil
- Emojis para resaltar puntos clave
- Ideal para difusión en grupos de estudiantes/docentes
- Sin hashtags excesivos (máximo 1 o 2 si es muy necesario)
- Call-to-action claro (ej: "Más info en el link", "Inscríbete aquí")
`
    };

    return instructions[platform] || instructions.instagram;
  }

  // Obtener posts de un chat específico
  async getChatPosts(chatMessageId: string, userId: string): Promise<Post[]> {
    return this.postsRepository.find({
      where: { chatMessageId, userId },
      order: { createdAt: 'ASC' },
    });
  }

  // MÉTODOS LEGACY (mantener compatibilidad)
  async getPostHistory(userId: string, limit: number = 20): Promise<Post[]> {
    return this.postsRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async getPostById(id: string, userId: string): Promise<Post | null> {
    return this.postsRepository.findOne({
      where: { id, userId },
    });
  }
}
