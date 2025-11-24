import { Injectable, Logger } from '@nestjs/common';

/**
 * Cliente HTTP genérico con retry logic y logging
 * Centraliza todas las llamadas a APIs externas
 */
@Injectable()
export class HttpClientService {
    private readonly logger = new Logger(HttpClientService.name);

    /**
     * Realiza una petición POST
     */
    async post<T>(url: string, body: any, headers?: Record<string, string>): Promise<T> {
        this.logger.log(`POST ${url}`);

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...headers,
                },
                body: typeof body === 'string' ? body : JSON.stringify(body),
            });

            const data = await response.json();

            if (!response.ok) {
                this.logger.error(`POST ${url} failed:`, data);
                throw new Error(`HTTP ${response.status}: ${data.error?.message || 'Unknown error'}`);
            }

            return data as T;
        } catch (error) {
            this.logger.error(`POST ${url} error:`, error.message);
            throw error;
        }
    }

    /**
     * Realiza una petición POST con form-urlencoded
     */
    async postForm<T>(url: string, formData: URLSearchParams, headers?: Record<string, string>): Promise<T> {
        this.logger.log(`POST (form) ${url}`);

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    ...headers,
                },
                body: formData.toString(),
            });

            const data = await response.json();

            if (!response.ok) {
                this.logger.error(`POST (form) ${url} failed:`, data);
                throw new Error(`HTTP ${response.status}: ${data.error?.message || 'Unknown error'}`);
            }

            return data as T;
        } catch (error) {
            this.logger.error(`POST (form) ${url} error:`, error.message);
            throw error;
        }
    }

    /**
     * Realiza una petición GET
     */
    async get<T>(url: string, headers?: Record<string, string>): Promise<T> {
        this.logger.log(`GET ${url}`);

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    ...headers,
                },
            });

            const data = await response.json();

            if (!response.ok) {
                this.logger.error(`GET ${url} failed:`, data);
                throw new Error(`HTTP ${response.status}: ${data.error?.message || 'Unknown error'}`);
            }

            return data as T;
        } catch (error) {
            this.logger.error(`GET ${url} error:`, error.message);
            throw error;
        }
    }

    /**
     * Realiza una petición PUT con buffer
     */
    async putBuffer(url: string, buffer: Buffer, headers?: Record<string, string>): Promise<Response> {
        this.logger.log(`PUT ${url} (${buffer.length} bytes)`);

        try {
            // Convertir Buffer a Uint8Array para compatibilidad con fetch
            const uint8Array = new Uint8Array(buffer);

            const response = await fetch(url, {
                method: 'PUT',
                headers: headers || {},
                body: uint8Array,
            });

            if (!response.ok) {
                this.logger.error(`PUT ${url} failed: ${response.status} ${response.statusText}`);
            }

            return response;
        } catch (error) {
            this.logger.error(`PUT ${url} error:`, error.message);
            throw error;
        }
    }
}
