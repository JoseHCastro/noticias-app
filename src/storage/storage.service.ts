import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

@Injectable()
export class StorageService {
  private readonly uploadsDir: string;
  private readonly baseUrl: string;

  constructor(private configService: ConfigService) {
    // Directorio donde se guardan las imágenes
    this.uploadsDir = path.join(process.cwd(), 'uploads');
    
    // URL base del servidor (ej: https://noticias-app-fsvj.onrender.com)
    this.baseUrl = this.configService.get<string>('APP_URL') || 'http://localhost:3000';

    // Crear directorio si no existe
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  /**
   * Descarga una imagen desde una URL externa y la guarda localmente
   * @param imageUrl URL de la imagen (ej: URL de OpenAI DALL-E)
   * @returns URL pública de la imagen guardada en el servidor
   */
  async downloadAndSaveImage(imageUrl: string): Promise<string> {
    try {
      console.log('📥 Descargando imagen desde:', imageUrl);

      // Descargar la imagen
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Error al descargar imagen: ${response.statusText}`);
      }

      // Obtener el buffer de la imagen
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Generar nombre único para la imagen
      const hash = crypto.createHash('md5').update(buffer).digest('hex');
      const extension = this.getImageExtension(response.headers.get('content-type'));
      const filename = `${hash}${extension}`;
      const filepath = path.join(this.uploadsDir, filename);

      // Guardar la imagen
      fs.writeFileSync(filepath, buffer);
      console.log('💾 Imagen guardada en:', filepath);

      // Retornar URL pública
      const publicUrl = `${this.baseUrl}/uploads/${filename}`;
      console.log('🌐 URL pública:', publicUrl);

      return publicUrl;
    } catch (error) {
      console.error('❌ Error al descargar/guardar imagen:', error.message);
      throw error;
    }
  }

  /**
   * Obtiene la extensión de archivo basada en el Content-Type
   */
  private getImageExtension(contentType: string | null): string {
    if (!contentType) return '.jpg';

    if (contentType.includes('png')) return '.png';
    if (contentType.includes('jpeg') || contentType.includes('jpg')) return '.jpg';
    if (contentType.includes('webp')) return '.webp';
    if (contentType.includes('gif')) return '.gif';

    return '.jpg'; // Por defecto
  }

  /**
   * Obtiene la ruta del archivo local
   */
  getFilePath(filename: string): string {
    return path.join(this.uploadsDir, filename);
  }

  /**
   * Verifica si un archivo existe
   */
  fileExists(filename: string): boolean {
    return fs.existsSync(this.getFilePath(filename));
  }

  /**
   * Elimina archivos antiguos (opcional, para limpieza)
   */
  async cleanOldFiles(daysOld: number = 7): Promise<void> {
    const files = fs.readdirSync(this.uploadsDir);
    const now = Date.now();
    const maxAge = daysOld * 24 * 60 * 60 * 1000; // días a milisegundos

    for (const file of files) {
      const filepath = path.join(this.uploadsDir, file);
      const stats = fs.statSync(filepath);
      
      if (now - stats.mtimeMs > maxAge) {
        fs.unlinkSync(filepath);
        console.log(`🗑️ Archivo eliminado: ${file}`);
      }
    }
  }
}
