import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PublishResult } from '../interfaces/publish-result.interface';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class PublishTiktokService {
  private readonly clientKey: string;
  private readonly clientSecret: string;
  private readonly accessToken: string | undefined;
  private readonly apiUrl = 'https://open.tiktokapis.com/v2/post/publish/video/init/';

  constructor(private configService: ConfigService) {
    this.clientKey = this.configService.get<string>('TIKTOK_CLIENT_KEY') || '';
    this.clientSecret = this.configService.get<string>('TIKTOK_CLIENT_SECRET') || '';
    this.accessToken = this.configService.get<string>('TIKTOK_TOKEN');

    if (!this.accessToken) {
      console.warn('TIKTOK_TOKEN no configurado en .env');
    }
  }

  /**
   * Publica un video en TikTok usando el método FILE_UPLOAD (2 pasos)
   * Paso 1: Obtener upload_url
   * Paso 2: Subir el archivo al upload_url
   */
  async publish(caption: string, videoPath: string): Promise<PublishResult> {
    try {
      console.log('[TIKTOK] Iniciando publicación en TikTok con FILE_UPLOAD');
      console.log('[TIKTOK] Token configurado:', this.accessToken ? 'SI' : 'NO');
      console.log('[TIKTOK] Caption:', caption.substring(0, 50) + '...');
      console.log('[TIKTOK] Video path:', videoPath);

      if (!this.accessToken) {
        console.error('[TIKTOK] ERROR: Token no configurado');
        return {
          success: false,
          platform: 'tiktok',
          error: 'Token no configurado',
        };
      }

      // Verificar que el archivo existe
      const absolutePath = path.resolve(videoPath);
      if (!fs.existsSync(absolutePath)) {
        console.error('[TIKTOK] ERROR: Archivo no encontrado:', absolutePath);
        return {
          success: false,
          platform: 'tiktok',
          error: 'Archivo de video no encontrado',
        };
      }

      const fileStats = fs.statSync(absolutePath);
      const videoSize = fileStats.size;
      const chunkSize = videoSize; // Subir todo el archivo de una vez
      const totalChunkCount = 1;

      console.log('[TIKTOK] Tamaño del archivo:', videoSize, 'bytes');

      // PASO 1: Obtener upload_url
      console.log('[TIKTOK] PASO 1: Obteniendo upload_url...');

      const step1Payload = {
        post_info: {
          title: caption.substring(0, 150), // TikTok permite hasta 150 caracteres
          privacy_level: 'SELF_ONLY', // Cambiar a 'PUBLIC_TO_EVERYONE' cuando esté listo
          disable_comment: false,
          disable_duet: false,
          disable_stitch: false,
          video_cover_timestamp_ms: 1000,
        },
        source_info: {
          source: 'FILE_UPLOAD',
          video_size: videoSize,
          chunk_size: chunkSize,
          total_chunk_count: totalChunkCount,
        },
      };

      console.log('[TIKTOK] Payload paso 1:', JSON.stringify(step1Payload, null, 2));

      const step1Response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
        },
        body: JSON.stringify(step1Payload),
      });

      console.log('[TIKTOK] Response status paso 1:', step1Response.status);
      const step1Data = await step1Response.json();
      console.log('[TIKTOK] Response data paso 1:', JSON.stringify(step1Data, null, 2));

      // Verificar errores en paso 1
      if (step1Data.error && step1Data.error.code !== 'ok') {
        console.error('[TIKTOK] ERROR en paso 1:', step1Data.error.code, step1Data.error.message);
        return {
          success: false,
          platform: 'tiktok',
          error: `${step1Data.error.code}: ${step1Data.error.message}`,
        };
      }

      if (!step1Data.data?.upload_url) {
        console.error('[TIKTOK] ERROR: No se recibió upload_url');
        return {
          success: false,
          platform: 'tiktok',
          error: 'No se recibió upload_url de TikTok',
        };
      }

      const uploadUrl = step1Data.data.upload_url;
      const publishId = step1Data.data.publish_id;
      console.log('[TIKTOK] Upload URL obtenida:', uploadUrl.substring(0, 80) + '...');
      console.log('[TIKTOK] Publish ID:', publishId);

      // PASO 2: Subir el archivo al upload_url
      console.log('[TIKTOK] PASO 2: Subiendo archivo...');

      const videoBuffer = fs.readFileSync(absolutePath);
      const mimeType = this.getMimeType(absolutePath);

      console.log('[TIKTOK] MIME type:', mimeType);
      console.log('[TIKTOK] Buffer size:', videoBuffer.length, 'bytes');

      const step2Response = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': mimeType,
          'Content-Length': videoBuffer.length.toString(),
        },
        body: videoBuffer,
      });

      console.log('[TIKTOK] Response status paso 2:', step2Response.status);

      if (!step2Response.ok) {
        const errorText = await step2Response.text();
        console.error('[TIKTOK] ERROR en paso 2:', errorText);
        return {
          success: false,
          platform: 'tiktok',
          error: `Error al subir archivo: ${step2Response.status} ${step2Response.statusText}`,
        };
      }

      console.log('[TIKTOK] ✅ ÉXITO - Video subido exitosamente');
      console.log('[TIKTOK] ✅ Publish ID:', publishId);

      return {
        success: true,
        platform: 'tiktok',
        postId: publishId,
      };
    } catch (error) {
      console.error('[TIKTOK] EXCEPTION - Error al publicar:', error.message);
      console.error('[TIKTOK] EXCEPTION - Stack:', error.stack);
      return {
        success: false,
        platform: 'tiktok',
        error: error.message,
      };
    }
  }

  /**
   * Obtiene el MIME type basado en la extensión del archivo
   */
  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: { [key: string]: string } = {
      '.mp4': 'video/mp4',
      '.mov': 'video/quicktime',
      '.avi': 'video/x-msvideo',
      '.webm': 'video/webm',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Refresca el access token usando el refresh token
   * Basado en el tutorial proporcionado
   */
  async refreshAccessToken(refreshToken: string): Promise<{
    access_token: string;
    expires_in: number;
    refresh_token: string;
    refresh_expires_in: number;
  }> {
    try {
      const tokenUrl = 'https://open.tiktokapis.com/v2/oauth/token/';

      const body = new URLSearchParams();
      body.append('client_key', this.clientKey);
      body.append('client_secret', this.clientSecret);
      body.append('grant_type', 'refresh_token');
      body.append('refresh_token', refreshToken);

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error_description || errorData.error || 'Error al refrescar token');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('[TIKTOK] Error al refrescar token:', error);
      throw error;
    }
  }

  /**
   * Revoca el access token
   * Basado en el tutorial proporcionado
   */
  async revokeAccessToken(accessToken: string): Promise<void> {
    try {
      const revokeUrl = 'https://open.tiktokapis.com/v2/oauth/revoke/';

      const body = new URLSearchParams();
      body.append('client_key', this.clientKey);
      body.append('client_secret', this.clientSecret);
      body.append('token', accessToken);

      const response = await fetch(revokeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error_description || errorData.error || 'Error al revocar token');
      }

      console.log('[TIKTOK] Token revocado exitosamente');
    } catch (error) {
      console.error('[TIKTOK] Error al revocar token:', error);
      throw error;
    }
  }
}
