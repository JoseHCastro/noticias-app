import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { getMimeType, isImage, isVideo } from '../../../shared/utils/file.utils';

/**
 * Servicio para manejo de archivos de upload
 * Responsabilidad: Guardar, validar y eliminar archivos
 */
@Injectable()
export class FileUploadService {
    private readonly logger = new Logger(FileUploadService.name);
    private readonly uploadDir = './uploads';
    private readonly baseUrl: string;

    constructor(private configService: ConfigService) {
        this.baseUrl = this.configService.get<string>('BASE_URL') || 'http://localhost:3000';
        this.ensureUploadDirExists();
    }

    /**
     * Asegura que el directorio de uploads existe
     */
    private ensureUploadDirExists(): void {
        if (!fs.existsSync(this.uploadDir)) {
            fs.mkdirSync(this.uploadDir, { recursive: true });
            this.logger.log(`Created upload directory: ${this.uploadDir}`);
        }
    }

    /**
     * Guarda una imagen y retorna su URL pública
     * @param file - Archivo subido
     * @param platform - Plataforma (para nombrar el archivo)
     * @returns URL pública de la imagen
     */
    async saveImage(file: Express.Multer.File, platform: string): Promise<string> {
        if (!file) {
            throw new BadRequestException('No se recibió ningún archivo');
        }

        // Validar que sea una imagen o video
        if (!isImage(file.mimetype) && !isVideo(file.mimetype)) {
            throw new BadRequestException('El archivo debe ser una imagen o video válido');
        }

        this.logger.log(`Saving image for ${platform}: ${file.originalname}`);

        // Construir URL pública
        const imageUrl = `${this.baseUrl}/uploads/${file.filename}`;

        return imageUrl;
    }

    /**
     * Elimina un archivo del sistema
     * @param filePathOrUrl - Ruta del archivo o URL
     */
    async deleteFile(filePathOrUrl: string): Promise<void> {
        try {
            // Extraer filename de la URL si es necesario
            let filePath: string;

            if (filePathOrUrl.startsWith('http')) {
                const filename = path.basename(filePathOrUrl);
                filePath = path.join(this.uploadDir, filename);
            } else {
                filePath = filePathOrUrl;
            }

            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                this.logger.log(`Deleted file: ${filePath}`);
            }
        } catch (error) {
            this.logger.error(`Error deleting file: ${error.message}`);
        }
    }

    /**
     * Valida el tamaño del archivo
     * @param file - Archivo a validar
     * @param maxSizeMB - Tamaño máximo en MB
     */
    validateFileSize(file: Express.Multer.File, maxSizeMB: number): void {
        const maxBytes = maxSizeMB * 1024 * 1024;

        if (file.size > maxBytes) {
            throw new BadRequestException(
                `El archivo es demasiado grande. Máximo permitido: ${maxSizeMB}MB`
            );
        }
    }
}
