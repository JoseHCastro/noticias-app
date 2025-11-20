import { Controller, Get, Res, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';

@Controller('auth/tiktok')
export class TiktokTokenManualController {
  constructor(private configService: ConfigService) {}

  /**
   * Endpoint manual para refrescar el token de TikTok
   * GET /auth/tiktok/refresh-token
   */
  @Get('refresh-token')
  async refreshToken(@Res() res: Response) {
    try {
      const clientKey = this.configService.get<string>('TIKTOK_CLIENT_KEY');
      const clientSecret = this.configService.get<string>('TIKTOK_CLIENT_SECRET');
      const refreshToken = this.configService.get<string>('TIKTOK_REFRESH_TOKEN');

      if (!clientKey || !clientSecret || !refreshToken) {
        return res.status(400).send(`
          <html>
            <body style="font-family: Arial; padding: 40px; background: #f5f5f5;">
              <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px;">
                <h2 style="color: #e74c3c;"> Error</h2>
                <p>Faltan variables de entorno:</p>
                <ul>
                  <li>TIKTOK_CLIENT_KEY</li>
                  <li>TIKTOK_CLIENT_SECRET</li>
                  <li>TIKTOK_REFRESH_TOKEN</li>
                </ul>
              </div>
            </body>
          </html>
        `);
      }

      // Llamar a la API de TikTok para refrescar el token
      const tokenUrl = 'https://open.tiktokapis.com/v2/oauth/token/';
      const body = new URLSearchParams();
      body.append('client_key', clientKey);
      body.append('client_secret', clientSecret);
      body.append('grant_type', 'refresh_token');
      body.append('refresh_token', refreshToken);

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        return res.status(400).send(`
          <html>
            <body style="font-family: Arial; padding: 40px; background: #f5f5f5;">
              <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px;">
                <h2 style="color: #e74c3c;">❌ Error al refrescar token</h2>
                <p><strong>Error:</strong> ${data.error || 'Desconocido'}</p>
                <p><strong>Descripción:</strong> ${data.error_description || data.message || 'Sin descripción'}</p>
                <hr>
                <p style="color: #666; font-size: 14px;">
                  Si el refresh_token expiró (1 año), necesitas obtener uno nuevo visitando:
                  <a href="/auth/tiktok/login">/auth/tiktok/login</a>
                </p>
              </div>
            </body>
          </html>
        `);
      }

      // Calcular cuándo expira
      const expiresInHours = Math.floor(data.expires_in / 3600);
      const refreshExpiresInDays = Math.floor(data.refresh_expires_in / 86400);

      return res.send(`
        <html>
          <head>
            <style>
              body { font-family: Arial; padding: 40px; background: #f5f5f5; }
              .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
              h2 { color: #27ae60; }
              .token-box { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #27ae60; }
              .code { font-family: monospace; background: #263238; color: #aed581; padding: 2px 6px; border-radius: 3px; font-size: 13px; word-break: break-all; }
              .info { color: #666; margin: 10px 0; }
              .warning { background: #fff3cd; padding: 15px; border-radius: 5px; border-left: 4px solid #ffc107; margin: 20px 0; }
              button { background: #3498db; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; margin: 5px; }
              button:hover { background: #2980b9; }
            </style>
          </head>
          <body>
            <div class="container">
              <h2> Token renovado exitosamente</h2>
              
              <div class="info">
                <p> <strong>Access Token expira en:</strong> ${expiresInHours} horas (${data.expires_in} segundos)</p>
                <p> <strong>Refresh Token expira en:</strong> ${refreshExpiresInDays} días</p>
              </div>

              <div class="token-box">
                <h3>🔑 Nuevo Access Token:</h3>
                <p class="code" id="accessToken">${data.access_token}</p>
                <button onclick="copyToken('accessToken')">📋 Copiar Access Token</button>
              </div>

              <div class="token-box">
                <h3> Nuevo Refresh Token:</h3>
                <p class="code" id="refreshToken">${data.refresh_token}</p>
                <button onclick="copyToken('refreshToken')">📋 Copiar Refresh Token</button>
              </div>

              <div class="warning">
                <h3> Importante - Actualiza estas variables en Render:</h3>
                <p>Ve a tu dashboard de Render → Environment:</p>
                <ol>
                  <li><strong>TIKTOK_TOKEN</strong> = <span class="code">${data.access_token.substring(0, 30)}...</span></li>
                  <li><strong>TIKTOK_REFRESH_TOKEN</strong> = <span class="code">${data.refresh_token.substring(0, 30)}...</span></li>
                </ol>
                <p style="margin-top: 15px; color: #856404;">
                   <strong>Tip:</strong> Hazlo ahora para que mañana a las 7 PM tengas el token fresco (24h de validez).
                </p>
              </div>

              <div class="info" style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
                <p> <strong>Próxima renovación recomendada:</strong> En 20 horas</p>
                <p> <strong>Volver a refrescar:</strong> <a href="/auth/tiktok/refresh-token">Refrescar token</a></p>
              </div>
            </div>

            <script>
              function copyToken(elementId) {
                const element = document.getElementById(elementId);
                const text = element.textContent;
                navigator.clipboard.writeText(text).then(() => {
                  const btn = event.target;
                  const originalText = btn.textContent;
                  btn.textContent = ' Copiado!';
                  btn.style.background = '#27ae60';
                  setTimeout(() => {
                    btn.textContent = originalText;
                    btn.style.background = '#3498db';
                  }, 2000);
                });
              }
            </script>
          </body>
        </html>
      `);
    } catch (error) {
      return res.status(500).send(`
        <html>
          <body style="font-family: Arial; padding: 40px; background: #f5f5f5;">
            <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px;">
              <h2 style="color: #e74c3c;"> Error del servidor</h2>
              <p>${error.message}</p>
            </div>
          </body>
        </html>
      `);
    }
  }

  /**
   * Endpoint para verificar el estado de un publish_id de TikTok
   * GET /auth/tiktok/check-status?publish_id=p_inbox_url~v2.xxx
   */
  @Get('check-status')
  async checkPublishStatus(
    @Query('publish_id') publishId: string,
    @Res() res: Response,
  ) {
    try {
      if (!publishId) {
        return res.status(400).json({
          error: 'Debes proporcionar un publish_id',
          example: '/auth/tiktok/check-status?publish_id=p_inbox_url~v2.xxx',
        });
      }

      const accessToken = this.configService.get<string>('TIKTOK_TOKEN');

      if (!accessToken) {
        return res.status(400).json({
          error: 'TIKTOK_TOKEN no configurado',
        });
      }

      // Llamar a la API de TikTok para verificar el estado
      const statusUrl = `https://open.tiktokapis.com/v2/post/publish/status/fetch/?publish_id=${encodeURIComponent(publishId)}`;

      console.log(`[CHECK-STATUS] Consultando estado de: ${publishId}`);
      console.log(`[CHECK-STATUS] URL: ${statusUrl}`);

      const response = await fetch(statusUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      console.log(`[CHECK-STATUS] Response status: ${response.status}`);
      console.log(`[CHECK-STATUS] Response data:`, JSON.stringify(data, null, 2));

      // Respuesta HTML bonita
      const statusCode = data?.data?.status || 'UNKNOWN';
      const failReason = data?.data?.fail_reason || 'N/A';
      const errorCode = data?.error?.code || 'ok';
      const errorMessage = data?.error?.message || '';

      let statusColor = '#3498db';
      let statusEmoji = '';
      let statusText = 'Desconocido';

      if (statusCode === 'PUBLISH_COMPLETE') {
        statusColor = '#27ae60';
        statusEmoji = '';
        statusText = 'Publicado exitosamente';
      } else if (statusCode === 'PROCESSING_UPLOAD') {
        statusColor = '#f39c12';
        statusEmoji = '';
        statusText = 'Procesando upload';
      } else if (statusCode === 'PROCESSING_DOWNLOAD') {
        statusColor = '#f39c12';
        statusEmoji = '';
        statusText = 'Descargando imagen';
      } else if (statusCode === 'SEND_TO_USER_INBOX') {
        statusColor = '#3498db';
        statusEmoji = '';
        statusText = 'Enviado a inbox del usuario';
      } else if (statusCode === 'FAILED') {
        statusColor = '#e74c3c';
        statusEmoji = '';
        statusText = 'Falló';
      }

      return res.send(`
        <html>
          <head>
            <meta charset="UTF-8">
            <title>Estado de Publicación TikTok</title>
          </head>
          <body style="font-family: Arial; padding: 40px; background: #f5f5f5;">
            <div style="max-width: 700px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
              <h2 style="color: ${statusColor};">${statusEmoji} Estado de Publicación</h2>
              
              <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <p><strong>Publish ID:</strong> <code style="background: #e9ecef; padding: 2px 6px; border-radius: 3px;">${publishId}</code></p>
                <p><strong>Estado:</strong> <span style="color: ${statusColor}; font-weight: bold;">${statusText}</span> (${statusCode})</p>
                ${failReason !== 'N/A' ? `<p><strong>Razón de fallo:</strong> <span style="color: #e74c3c;">${failReason}</span></p>` : ''}
              </div>

              ${errorCode !== 'ok' ? `
                <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
                  <p style="margin: 0;"><strong>⚠️ Error API:</strong></p>
                  <p style="margin: 5px 0 0 0; color: #856404;">Code: ${errorCode}</p>
                  <p style="margin: 5px 0 0 0; color: #856404;">${errorMessage}</p>
                </div>
              ` : ''}

              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
                <h3>📖 Posibles Estados:</h3>
                <ul style="color: #666; line-height: 1.8;">
                  <li><strong>PUBLISH_COMPLETE:</strong> Post publicado exitosamente</li>
                  <li><strong>PROCESSING_UPLOAD:</strong> TikTok está procesando el upload</li>
                  <li><strong>PROCESSING_DOWNLOAD:</strong> TikTok está descargando la imagen desde tu servidor</li>
                  <li><strong>SEND_TO_USER_INBOX:</strong> Enviado al inbox del usuario (debe completar en la app)</li>
                  <li><strong>FAILED:</strong> La publicación falló (ver fail_reason)</li>
                </ul>
              </div>

              <div style="margin-top: 20px; padding: 15px; background: #e3f2fd; border-radius: 5px;">
                <p style="margin: 0; color: #1565c0;">
                  💡 <strong>Tip:</strong> Si el estado es SEND_TO_USER_INBOX, el usuario debe abrir TikTok y completar la publicación desde sus notificaciones o borradores.
                </p>
              </div>

              <div style="margin-top: 30px; text-align: center;">
                <a href="/auth/tiktok/check-status?publish_id=${encodeURIComponent(publishId)}" 
                   style="display: inline-block; padding: 12px 24px; background: #3498db; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
                  🔄 Recargar Estado
                </a>
              </div>

              <div style="margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 5px; font-size: 12px; color: #666;">
                <strong>Respuesta JSON completa:</strong>
                <pre style="background: #fff; padding: 10px; border-radius: 3px; overflow-x: auto;">${JSON.stringify(data, null, 2)}</pre>
              </div>
            </div>
          </body>
        </html>
      `);
    } catch (error) {
      console.error('[CHECK-STATUS] Error:', error);
      return res.status(500).json({
        error: 'Error al consultar estado',
        message: error.message,
      });
    }
  }

  /**
   * Endpoint para verificar qué usuario tiene el token actual
   * GET /auth/tiktok/check-user
   */
  @Get('check-user')
  async checkUser(@Res() res: Response) {
    try {
      const accessToken = this.configService.get<string>('TIKTOK_TOKEN');

      if (!accessToken) {
        return res.status(400).json({
          error: 'TIKTOK_TOKEN no configurado',
        });
      }

      console.log('[CHECK-USER] Consultando información del usuario...');

      // Llamar a la API de TikTok para obtener info del usuario
      const userInfoUrl = 'https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name,username';

      const response = await fetch(userInfoUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      console.log('[CHECK-USER] Response status:', response.status);
      console.log('[CHECK-USER] Response data:', JSON.stringify(data, null, 2));

      if (!response.ok || data.error?.code !== 'ok') {
        return res.send(`
          <html>
            <head><meta charset="UTF-8"><title>Error - Usuario TikTok</title></head>
            <body style="font-family: Arial; padding: 40px; background: #f5f5f5;">
              <div style="max-width: 700px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px;">
                <h2 style="color: #e74c3c;">❌ Error al obtener información del usuario</h2>
                <p><strong>Error Code:</strong> ${data.error?.code || 'unknown'}</p>
                <p><strong>Message:</strong> ${data.error?.message || 'Sin mensaje'}</p>
                <div style="margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 5px;">
                  <strong>Respuesta completa:</strong>
                  <pre style="background: #fff; padding: 10px; border-radius: 3px; overflow-x: auto;">${JSON.stringify(data, null, 2)}</pre>
                </div>
              </div>
            </body>
          </html>
        `);
      }

      const user = data.data?.user;

      return res.send(`
        <html>
          <head><meta charset="UTF-8"><title>Usuario TikTok - Info</title></head>
          <body style="font-family: Arial; padding: 40px; background: #f5f5f5;">
            <div style="max-width: 700px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
              <h2 style="color: #27ae60;">✅ Información del Usuario con Token Actual</h2>
              
              ${user?.avatar_url ? `
                <div style="text-align: center; margin: 20px 0;">
                  <img src="${user.avatar_url}" alt="Avatar" style="width: 120px; height: 120px; border-radius: 60px; border: 3px solid #3498db;">
                </div>
              ` : ''}

              <div style="background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
                <p><strong>👤 Display Name:</strong> ${user?.display_name || 'N/A'}</p>
                <p><strong>🔑 Username:</strong> @${user?.username || 'N/A'}</p>
                <p><strong>🆔 Open ID:</strong> <code style="background: #e9ecef; padding: 2px 6px; border-radius: 3px;">${user?.open_id || 'N/A'}</code></p>
                <p><strong>🔗 Union ID:</strong> <code style="background: #e9ecef; padding: 2px 6px; border-radius: 3px;">${user?.union_id || 'N/A'}</code></p>
              </div>

              <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
                <p style="margin: 0;"><strong>⚠️ Importante:</strong></p>
                <p style="margin: 5px 0 0 0; color: #856404;">
                  Este es el usuario asociado al token actual. Si no coincide con @6ftsjc9, necesitas generar un nuevo token con la cuenta correcta.
                </p>
              </div>

              <div style="margin-top: 30px; text-align: center;">
                <a href="/auth/tiktok/login" 
                   style="display: inline-block; padding: 12px 24px; background: #3498db; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; margin-right: 10px;">
                  🔄 Generar Nuevo Token
                </a>
                <a href="/auth/tiktok/check-user" 
                   style="display: inline-block; padding: 12px 24px; background: #27ae60; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
                  ↻ Recargar
                </a>
              </div>

              <div style="margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 5px; font-size: 12px; color: #666;">
                <strong>Respuesta JSON completa:</strong>
                <pre style="background: #fff; padding: 10px; border-radius: 3px; overflow-x: auto;">${JSON.stringify(data, null, 2)}</pre>
              </div>
            </div>
          </body>
        </html>
      `);
    } catch (error) {
      console.error('[CHECK-USER] Error:', error);
      return res.status(500).json({
        error: 'Error al consultar usuario',
        message: error.message,
      });
    }
  }
}
