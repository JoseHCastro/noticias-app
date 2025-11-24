import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

/**
 * Servicio de criptografía para OAuth PKCE y utilidades
 */
@Injectable()
export class CryptoService {
    /**
     * Genera un code_verifier aleatorio para PKCE
     * @returns String aleatorio de 43-128 caracteres
     */
    generateCodeVerifier(): string {
        return this.base64URLEncode(crypto.randomBytes(32));
    }

    /**
     * Genera un code_challenge a partir del code_verifier
     * @param verifier - Code verifier
     * @returns Code challenge (SHA256 hash del verifier)
     */
    generateCodeChallenge(verifier: string): string {
        return this.base64URLEncode(
            crypto.createHash('sha256').update(verifier).digest()
        );
    }

    /**
     * Genera un state aleatorio para OAuth
     * @returns String aleatorio de 16 caracteres
     */
    generateState(): string {
        return crypto.randomBytes(16).toString('hex');
    }

    /**
     * Codifica en Base64 URL-safe (sin +, /, =)
     */
    private base64URLEncode(buffer: Buffer): string {
        return buffer
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');
    }

    /**
     * Genera un nombre de archivo único
     */
    generateUniqueFilename(prefix: string, extension: string): string {
        const timestamp = Date.now();
        const random = Math.round(Math.random() * 1e9);
        return `${prefix}-${timestamp}-${random}${extension}`;
    }
}
