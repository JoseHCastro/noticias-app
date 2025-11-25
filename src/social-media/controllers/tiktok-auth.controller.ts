import { Controller, Get, Res, Query, HttpException, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { CryptoService } from '../../shared/services/crypto.service';
import { HtmlRendererService } from '../../shared/services/html-renderer.service';

/**
 * Controlador para OAuth 2.0 de TikTok con PKCE
 * Endpoints: /auth/tiktok/login y /auth/tiktok/callback
 */
@Controller('auth/tiktok')
export class TiktokAuthController {
    private readonly clientKey: string;
    private readonly clientSecret: string;
    private readonly redirectUri: string;
    private readonly scopes: string;

    // Storage temporal de code_verifier (en producción usar Redis/DB)
    private verifierStorage = new Map<string, string>();

    constructor(
        private configService: ConfigService,
        private cryptoService: CryptoService,
        private htmlRenderer: HtmlRendererService,
    ) {
        this.clientKey = this.configService.get<string>('TIKTOK_CLIENT_KEY') || '';
        this.clientSecret = this.configService.get<string>('TIKTOK_CLIENT_SECRET') || '';
        this.redirectUri = this.configService.get<string>('TIKTOK_REDIRECT_URI') || '';
        this.scopes = this.configService.get<string>('TIKTOK_SCOPES') || 'user.info.basic,video.upload,video.publish';

        if (!this.clientKey || !this.clientSecret) {
            console.warn('[TikTok Auth] Variables de entorno faltantes');
        }
    }

    /**
     * GET /auth/tiktok/login
     * Inicia el flujo OAuth con PKCE
     */
    @Get('login')
    login(@Res() res: Response) {
        try {
            // Verificar configuración
            if (!this.clientKey || !this.clientSecret || !this.redirectUri) {
                const missingVars: string[] = [];
                if (!this.clientKey) missingVars.push('TIKTOK_CLIENT_KEY');
                if (!this.clientSecret) missingVars.push('TIKTOK_CLIENT_SECRET');
                if (!this.redirectUri) missingVars.push('TIKTOK_REDIRECT_URI');

                return res.send(this.htmlRenderer.renderMissingConfig('TikTok', missingVars));
            }

            // Generar PKCE
            const codeVerifier = this.cryptoService.generateCodeVerifier();
            const codeChallenge = this.cryptoService.generateCodeChallenge(codeVerifier);
            const state = this.cryptoService.generateState();

            // Guardar verifier temporalmente (asociado al state)
            this.verifierStorage.set(state, codeVerifier);

            // Limpiar verifiers antiguos (más de 10 minutos)
            setTimeout(() => this.verifierStorage.delete(state), 10 * 60 * 1000);

            // Construir URL de autorización
            const authUrl = new URL('https://www.tiktok.com/v2/auth/authorize/');
            authUrl.searchParams.append('client_key', this.clientKey);
            authUrl.searchParams.append('scope', this.scopes);
            authUrl.searchParams.append('response_type', 'code');
            authUrl.searchParams.append('redirect_uri', this.redirectUri);
            authUrl.searchParams.append('state', state);
            authUrl.searchParams.append('code_challenge', codeChallenge);
            authUrl.searchParams.append('code_challenge_method', 'S256');

            console.log('[TikTok Auth] 🔍 Redirect URI enviado:', this.redirectUri);
            console.log('[TikTok Auth] Redirigiendo a:', authUrl.toString().substring(0, 100) + '...');

            return res.redirect(authUrl.toString());
        } catch (error) {
            console.error('[TikTok Auth] Error en login:', error);
            return res.send(this.htmlRenderer.renderError('TikTok', { 
                message: error.message 
            }));
        }
    }

    /**
     * GET /auth/tiktok/callback
     * Recibe el código de autorización y lo intercambia por tokens
     */
    @Get('callback')
    async callback(@Query('code') code: string, @Query('state') state: string, @Res() res: Response) {
        try {
            console.log('[TikTok Auth] Callback recibido');

            // Validar parámetros
            if (!code || !state) {
                throw new HttpException(
                    'Parámetros faltantes: code o state',
                    HttpStatus.BAD_REQUEST,
                );
            }

            // Recuperar code_verifier
            const codeVerifier = this.verifierStorage.get(state);
            if (!codeVerifier) {
                throw new HttpException(
                    'Estado inválido o expirado (code_verifier no encontrado)',
                    HttpStatus.BAD_REQUEST,
                );
            }

            // Limpiar verifier usado
            this.verifierStorage.delete(state);

            // Intercambiar código por tokens
            const tokenUrl = 'https://open.tiktokapis.com/v2/oauth/token/';
            const params = new URLSearchParams({
                client_key: this.clientKey,
                client_secret: this.clientSecret,
                code: code,
                grant_type: 'authorization_code',
                redirect_uri: this.redirectUri,
                code_verifier: codeVerifier,
            });

            console.log('[TikTok Auth] Intercambiando código por tokens...');

            const response = await fetch(tokenUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Cache-Control': 'no-cache',
                },
                body: params.toString(),
            });

            const data = await response.json();

            if (!response.ok || data.error) {
                console.error('[TikTok Auth] Error en token exchange:', data);
                return res.send(this.htmlRenderer.renderError('TikTok', {
                    code: data.error || 'token_error',
                    message: data.error_description || 'Error al obtener tokens',
                }));
            }

            console.log('[TikTok Auth] ✅ Tokens obtenidos exitosamente');
            console.log('[TikTok Auth] Scopes:', data.scope);
            console.log('[TikTok Auth] Expira en:', data.expires_in, 'segundos');

            // Renderizar página de éxito con tokens
            return res.send(this.htmlRenderer.renderTokenSuccess('TikTok', {
                accessToken: data.access_token,
                refreshToken: data.refresh_token,
                expiresIn: data.expires_in,
                scopes: data.scope,
                openId: data.open_id,
            }));
        } catch (error) {
            console.error('[TikTok Auth] Exception en callback:', error);
            return res.send(this.htmlRenderer.renderError('TikTok', {
                message: error.message,
            }));
        }
    }

    /**
     * GET /auth/tiktok/refresh
     * Refresca el access token usando el refresh token
     */
    @Get('refresh')
    async refresh(@Query('refresh_token') refreshToken: string, @Res() res: Response) {
        try {
            if (!refreshToken) {
                throw new HttpException(
                    'refresh_token es requerido',
                    HttpStatus.BAD_REQUEST,
                );
            }

            console.log('[TikTok Auth] Refrescando token...');

            const tokenUrl = 'https://open.tiktokapis.com/v2/oauth/token/';
            const params = new URLSearchParams({
                client_key: this.clientKey,
                client_secret: this.clientSecret,
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
            });

            const response = await fetch(tokenUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: params.toString(),
            });

            const data = await response.json();

            if (!response.ok || data.error) {
                console.error('[TikTok Auth] Error al refrescar:', data);
                return res.send(this.htmlRenderer.renderError('TikTok', {
                    code: data.error || 'refresh_error',
                    message: data.error_description || 'Error al refrescar token',
                }));
            }

            console.log('[TikTok Auth] ✅ Token refrescado exitosamente');

            return res.send(this.htmlRenderer.renderTokenSuccess('TikTok', {
                accessToken: data.access_token,
                refreshToken: data.refresh_token,
                expiresIn: data.expires_in,
                scopes: data.scope,
                openId: data.open_id,
            }));
        } catch (error) {
            console.error('[TikTok Auth] Exception en refresh:', error);
            return res.send(this.htmlRenderer.renderError('TikTok', {
                message: error.message,
            }));
        }
    }
}
