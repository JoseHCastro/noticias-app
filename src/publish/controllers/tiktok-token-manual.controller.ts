import { Controller, Get, Res } from '@nestjs/common';
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
}
