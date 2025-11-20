import { Controller, Get, Query, Res, Req, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response, Request } from 'express';

/**
 * Controlador para manejar el flujo de autenticación OAuth 2.0 de TikTok
 * 
 * Flujo:
 * 1. Usuario visita /auth/tiktok/login
 * 2. Redirige a TikTok para autorizar
 * 3. TikTok redirige a /auth/tiktok/callback con código
 * 4. Intercambiamos código por access_token
 */
@Controller('auth/tiktok')
export class PublishTiktokAuthController {
  private readonly clientKey: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly scopes: string;

  constructor(private configService: ConfigService) {
    this.clientKey = this.configService.get<string>('TIKTOK_CLIENT_KEY') || '';
    this.clientSecret = this.configService.get<string>('TIKTOK_CLIENT_SECRET') || '';
    this.redirectUri = this.configService.get<string>('TIKTOK_REDIRECT_URI') || 'http://localhost:3000/auth/tiktok/callback';
    this.scopes = this.configService.get<string>('TIKTOK_SCOPES') || 'user.info.basic,video.upload';

    if (!this.clientKey || !this.clientSecret) {
      console.warn('TikTok OAuth no configurado: CLIENT_KEY o CLIENT_SECRET faltantes');
    }
  }

  /**
   * PASO 1: Iniciar el flujo OAuth
   * GET /auth/tiktok/login
   * 
   * Redirige al usuario a la página de autorización de TikTok
   */
  @Get('login')
  initiateLogin(@Res() res: Response) {
    if (!this.clientKey) {
      throw new HttpException(
        'TikTok CLIENT_KEY no configurado',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    // Generar un state aleatorio para prevenir CSRF
    const state = this.generateRandomState();

    // Generar code_verifier y code_challenge para PKCE
    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = this.generateCodeChallenge(codeVerifier);

    // Guardar code_verifier en una cookie segura (expira en 10 minutos)
    res.cookie('tiktok_code_verifier', codeVerifier, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // HTTPS en producción
      maxAge: 10 * 60 * 1000, // 10 minutos
      sameSite: 'lax',
    });

    // Construir URL de autorización de TikTok
    const authUrl = new URL('https://www.tiktok.com/v2/auth/authorize/');
    authUrl.searchParams.append('client_key', this.clientKey);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('scope', this.scopes);
    authUrl.searchParams.append('redirect_uri', this.redirectUri);
    authUrl.searchParams.append('state', state);
    authUrl.searchParams.append('code_challenge', codeChallenge);
    authUrl.searchParams.append('code_challenge_method', 'S256');
    // Forzar nueva autorización (no usar token cacheado)
    authUrl.searchParams.append('prompt', 'consent');

    console.log('Iniciando flujo OAuth de TikTok con PKCE...');
    console.log('Redirect URI:', this.redirectUri);
    console.log('State:', state);
    console.log('Code Challenge:', codeChallenge);

    // Redirigir al usuario a TikTok
    return res.redirect(authUrl.toString());
  }

  /**
   * PASO 2: Callback después de la autorización
   * GET /auth/tiktok/callback?code=xxx&state=xxx
   * 
   * TikTok redirige aquí después de que el usuario autoriza
   * Intercambiamos el código por un access_token
   */
  @Get('callback')
  async handleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Query('error_description') errorDescription: string,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    // Verificar si hubo un error en la autorización
    if (error) {
      console.error('Error en autorización de TikTok:', error, errorDescription);
      return res.status(400).send(`
        <html>
          <body style="font-family: Arial; padding: 40px; text-align: center;">
            <h1> Error de Autorización</h1>
            <p><strong>Error:</strong> ${error}</p>
            <p><strong>Descripción:</strong> ${errorDescription || 'Sin descripción'}</p>
            <br>
            <p>Posibles soluciones:</p>
            <ul style="text-align: left; max-width: 600px; margin: 20px auto;">
              <li>Verifica que la Redirect URI esté configurada correctamente en el portal de TikTok</li>
              <li>URI esperada: <code>${this.redirectUri}</code></li>
              <li>Asegúrate de que coincida EXACTAMENTE (sin / al final)</li>
              <li>Para desarrollo local, usa <code>http://</code>, para producción usa <code>https://</code></li>
            </ul>
            <br>
            <a href="/auth/tiktok/login" style="padding: 10px 20px; background: #000; color: #fff; text-decoration: none; border-radius: 5px;">
              Intentar de nuevo
            </a>
          </body>
        </html>
      `);
    }

    // Verificar que recibimos el código
    if (!code) {
      throw new HttpException(
        'No se recibió el código de autorización',
        HttpStatus.BAD_REQUEST,
      );
    }

    console.log('Código de autorización recibido');
    console.log('Intercambiando código por token...');

    try {
      // PASO 3: Intercambiar código por access_token
      const tokenData = await this.exchangeCodeForToken(code, req);

      console.log(' Token obtenido exitosamente');
      console.log(' Access Token:', tokenData.access_token.substring(0, 20) + '...');
      console.log(' Expira en:', tokenData.expires_in, 'segundos');
      console.log(' Refresh Token:', tokenData.refresh_token?.substring(0, 20) + '...');

      // Mostrar al usuario el token obtenido
      return res.send(`
        <html>
          <head>
            <style>
              body { font-family: Arial; padding: 40px; max-width: 800px; margin: 0 auto; }
              h1 { color: #000; }
              .token-box { 
                background: #f5f5f5; 
                padding: 15px; 
                border-radius: 5px; 
                margin: 20px 0; 
                word-break: break-all;
                font-family: monospace;
                font-size: 12px;
              }
              .success { color: #00a884; }
              .info { background: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0; }
              code { background: #f5f5f5; padding: 2px 6px; border-radius: 3px; }
            </style>
          </head>
          <body>
            <h1 class="success"> Autenticación Exitosa</h1>
            <p>Has autorizado correctamente la aplicación en TikTok.</p>
            
            <h2> Access Token</h2>
            <div class="token-box">${tokenData.access_token}</div>
            
            <h2> Refresh Token</h2>
            <div class="token-box">${tokenData.refresh_token || 'No disponible'}</div>
            
            <div class="info">
              <h3 Próximos Pasos:</h3>
              <ol>
                <li>Copia el <strong>Access Token</strong> de arriba</li>
                <li>Agrega esta variable a tu archivo <code>.env</code>:
                  <div class="token-box">TIKTOK_TOKEN=${tokenData.access_token}</div>
                </li>
                <li><strong>Opcional:</strong> Guarda el <strong>Refresh Token</strong> para renovar el acceso cuando expire (en ${tokenData.expires_in} segundos = ${Math.round(tokenData.expires_in / 3600)} horas)</li>
                <li>Reinicia tu servidor NestJS</li>
                <li>¡Ya puedes publicar en TikTok! 🎉</li>
              </ol>
            </div>

            <p><strong> Información del Token:</strong></p>
            <ul>
              <li>Expira en: ${tokenData.expires_in} segundos (${Math.round(tokenData.expires_in / 3600)} horas)</li>
              <li>Scopes: ${tokenData.scope}</li>
              <li>Open ID: ${tokenData.open_id}</li>
            </ul>
          </body>
        </html>
      `);
    } catch (error) {
      console.error(' Error al intercambiar código por token:', error.message);
      throw new HttpException(
        `Error al obtener token: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Intercambia el código de autorización por un access_token
   * POST https://open.tiktokapis.com/v2/oauth/token/
   */
  private async exchangeCodeForToken(code: string, req: Request): Promise<{
    access_token: string;
    expires_in: number;
    open_id: string;
    refresh_token: string;
    scope: string;
  }> {
    const tokenUrl = 'https://open.tiktokapis.com/v2/oauth/token/';

    // Recuperar el code_verifier de la cookie
    const codeVerifier = req.cookies?.tiktok_code_verifier;
    if (!codeVerifier) {
      throw new Error('Code verifier no encontrado. Inicia el flujo desde /auth/tiktok/login');
    }

    const body = new URLSearchParams();
    body.append('client_key', this.clientKey);
    body.append('client_secret', this.clientSecret);
    body.append('code', code);
    body.append('grant_type', 'authorization_code');
    body.append('redirect_uri', this.redirectUri);
    body.append('code_verifier', codeVerifier);

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error_description || errorData.error || 'Error al obtener token');
    }

    const data = await response.json();
    
    // Log completo de lo que TikTok realmente devuelve
    console.log('[OAUTH] Response de TikTok:', JSON.stringify(data, null, 2));
    
    return data;
  }

  /**
   * Genera un state aleatorio para prevenir ataques CSRF
   */
  private generateRandomState(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }

  /**
   * Genera un code_verifier aleatorio para PKCE
   * Debe ser una cadena de 43-128 caracteres
   */
  private generateCodeVerifier(): string {
    const length = 128;
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Genera el code_challenge a partir del code_verifier
   * Usa SHA256 y base64url encoding
   */
  private generateCodeChallenge(verifier: string): string {
    // En Node.js, usamos el módulo crypto nativo
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(verifier).digest();
    
    // Convertir a base64url (base64 sin padding y con caracteres URL-safe)
    return hash
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }
}
