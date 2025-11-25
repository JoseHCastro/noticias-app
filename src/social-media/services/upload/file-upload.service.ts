import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { v2 as cloudinary } from 'cloudinary';
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
        this.baseUrl = this.configService.get<string>('APP_URL') || 'http://localhost:3000';
        this.ensureUploadDirExists();

        // Configurar Cloudinary
        cloudinary.config({
            cloud_name: this.configService.get<string>('CLOUDINARY_CLOUD_NAME'),
            api_key: this.configService.get<string>('CLOUDINARY_API_KEY'),
            api_secret: this.configService.get<string>('CLOUDINARY_API_SECRET'),
            secure: true,
        });
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

        this.logger.log(`Uploading file to Cloudinary for ${platform}: ${file.originalname}`);

        try {
            // Si el archivo ya está en disco (porque el controller usa diskStorage)
            // Lo subimos desde el path
            let result;
            if (file.path) {
                result = await cloudinary.uploader.upload(file.path, {
                    folder: 'noticias-app',
                    resource_type: 'auto',
                });

                // Opcional: Borrar archivo local inmediatamente después de subir
                // fs.unlinkSync(file.path); 
            } else {
                // Si viene en memoria (buffer)
                // Nota: Esto requeriría inyectar CloudinaryService, pero para simplificar
                // y dado que ya instalamos el SDK, lo usamos directo aquí o inyectamos el servicio.
                // Mejor inyectemos el servicio CloudinaryService que creamos.
                throw new Error('File path not found. Ensure diskStorage is used or update implementation.');
            }

            this.logger.log(`File uploaded to Cloudinary: ${result.secure_url}`);
            return result.secure_url;
        } catch (error) {
            this.logger.error('Error uploading to Cloudinary:', error);
            throw new BadRequestException('Error al subir archivo a la nube');
        }
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
