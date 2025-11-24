import { extname } from 'path';

/**
 * Utilidades para manejo de archivos
 */

/**
 * Obtiene el MIME type de un archivo basado en su extensión
 */
export function getMimeType(filePath: string): string {
    const ext = extname(filePath).toLowerCase();

    const mimeTypes: Record<string, string> = {
        '.mp4': 'video/mp4',
        '.mov': 'video/quicktime',
        '.avi': 'video/x-msvideo',
        '.webm': 'video/webm',
        '.mkv': 'video/x-matroska',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
    };

    return mimeTypes[ext] || 'application/octet-stream';
}

/**
 * Valida si un archivo es una imagen
 */
export function isImage(mimeType: string): boolean {
    const allowedTypes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/webp',
        'image/gif',
    ];

    return allowedTypes.includes(mimeType);
}

/**
 * Valida si un archivo es un video
 */
export function isVideo(mimeType: string): boolean {
    const allowedTypes = [
        'video/mp4',
        'video/quicktime',
        'video/x-msvideo',
        'video/webm',
        'video/x-matroska',
    ];

    return allowedTypes.includes(mimeType);
}

/**
 * Formatea el tamaño de un archivo en formato legible
 */
export function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}
