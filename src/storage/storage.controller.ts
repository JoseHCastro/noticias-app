import { Controller, Get, Param, Res, NotFoundException } from '@nestjs/common';
import type { Response } from 'express';
import { StorageService } from './storage.service';
import * as fs from 'fs';

@Controller()
export class StorageController {
  constructor(private readonly storageService: StorageService) { }

  /**
   * Endpoint para servir imágenes públicamente
   * GET /uploads/:filename
   */
  @Get('uploads/:filename')
  serveImage(@Param('filename') filename: string, @Res() res: Response) {
    // Validar nombre de archivo (seguridad)
    if (!filename || filename.includes('..') || filename.includes('/')) {
      throw new NotFoundException('Archivo no válido');
    }

    const filepath = this.storageService.getFilePath(filename);

    if (!this.storageService.fileExists(filename)) {
      throw new NotFoundException('Imagen no encontrada');
    }

    // Determinar Content-Type
    const ext = filename.split('.').pop()?.toLowerCase();
    const contentType = this.getContentType(ext);

    // Log para depuración en Render
    console.log(`Serving file: ${filename} with Content-Type: ${contentType}`);

    // Usar res.sendFile es mucho más robusto para clientes estrictos como Instagram
    // Al ser ruta absoluta (process.cwd), no necesitamos 'root' o debemos tener cuidado
    res.sendFile(filepath, (err) => {
      if (err) {
        console.error(`Error serving file ${filename}:`, err);
        if (!res.headersSent) {
          res.status(404).send('Not Found');
        }
      }
    });
  }

  /**
   * Endpoint de verificación para TikTok (método signature file)
   * GET /tiktokzytVh8CPUg5DvrjPa6ibZmnzb6XdMq4N.txt
   */
  @Get('tiktok512oyOb3aLOwUzoVWFE5lqztaEGUuUGL.txt')
  tiktokVerificationFile(@Res() res: Response) {
    const verificationContent = 'tiktok-developers-site-verification=512oyOb3aLOwUzoVWFE5lqztaEGUuUGL';

    res.setHeader('Content-Type', 'text/plain');
    res.send(verificationContent);
  }

  private getContentType(extension: string | undefined): string {
    const types: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      mp4: 'video/mp4',
      mov: 'video/quicktime',
      avi: 'video/x-msvideo',
      webm: 'video/webm',
    };

    return types[extension || ''] || 'application/octet-stream';
  }
}
