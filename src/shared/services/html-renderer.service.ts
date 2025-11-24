import { Injectable } from '@nestjs/common';

interface TokenData {
    accessToken: string;
    refreshToken?: string;
    expiresIn?: number;
    scope?: string;
}

/**
 * Servicio para generar respuestas HTML en flujos OAuth
 * Centraliza la generación de HTML que antes estaba en controllers
 */
@Injectable()
export class HtmlRendererService {
    /**
     * Renderiza página de éxito de OAuth con tokens
     */
    renderTokenSuccess(platform: string, tokens: TokenData): string {
        return `
      <html>
        <head>
          <meta charset="UTF-8">
          <title>${platform} - Tokens Obtenidos</title>
          <style>
            body { font-family: Arial; padding: 40px; background: #f5f5f5; }
            .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .success { color: #27ae60; }
            .token-box { background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0; word-break: break-all; }
            .label { font-weight: bold; color: #555; margin-top: 15px; }
            .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
            code { background: #e9ecef; padding: 2px 6px; border-radius: 3px; font-family: monospace; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2 class="success">✅ ${platform} - Autenticación Exitosa</h2>
            
            <div class="token-box">
              <div class="label">🔑 Access Token:</div>
              <code>${tokens.accessToken}</code>
              
              ${tokens.refreshToken ? `
                <div class="label">🔄 Refresh Token:</div>
                <code>${tokens.refreshToken}</code>
              ` : ''}
              
              ${tokens.expiresIn ? `
                <div class="label">⏰ Expira en:</div>
                <code>${tokens.expiresIn} segundos (${Math.floor(tokens.expiresIn / 3600)} horas)</code>
              ` : ''}
              
              ${tokens.scope ? `
                <div class="label">📋 Scopes:</div>
                <code>${tokens.scope}</code>
              ` : ''}
            </div>

            <div class="warning">
              <p style="margin: 0;"><strong>⚠️ Importante:</strong></p>
              <p style="margin: 5px 0 0 0; color: #856404;">
                Copia estos tokens y guárdalos en tu archivo <code>.env</code>
              </p>
            </div>
          </div>
        </body>
      </html>
    `;
    }

    /**
     * Renderiza página de error
     */
    renderError(platform: string, error: { code?: string; message?: string }): string {
        return `
      <html>
        <head>
          <meta charset="UTF-8">
          <title>${platform} - Error</title>
          <style>
            body { font-family: Arial; padding: 40px; background: #f5f5f5; }
            .container { max-width: 700px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; }
            .error { color: #e74c3c; }
            .error-box { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2 class="error">❌ ${platform} - Error</h2>
            <div class="error-box">
              <p><strong>Error Code:</strong> ${error.code || 'unknown'}</p>
              <p><strong>Message:</strong> ${error.message || 'Sin mensaje'}</p>
            </div>
          </div>
        </body>
      </html>
    `;
    }

    /**
     * Renderiza página de configuración faltante
     */
    renderMissingConfig(platform: string, missingVars: string[]): string {
        return `
      <html>
        <head>
          <meta charset="UTF-8">
          <title>${platform} - Configuración Faltante</title>
          <style>
            body { font-family: Arial; padding: 40px; background: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; }
            .error { color: #e74c3c; }
            ul { background: #f8f9fa; padding: 20px; border-radius: 5px; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2 class="error">⚠️ ${platform} - Configuración Faltante</h2>
            <p>Faltan las siguientes variables de entorno:</p>
            <ul>
              ${missingVars.map(v => `<li><code>${v}</code></li>`).join('')}
            </ul>
          </div>
        </body>
      </html>
    `;
    }
}
