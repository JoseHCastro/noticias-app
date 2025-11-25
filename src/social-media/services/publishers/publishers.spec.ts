import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { FacebookPublisherService } from './facebook-publisher.service';
import { InstagramPublisherService } from './instagram-publisher.service';
import { LinkedinPublisherService } from './linkedin-publisher.service';
import { TiktokPublisherService } from './tiktok-publisher.service';
import { PublisherFactoryService } from './publisher-factory.service';
import { SocialMediaPlatform } from '../../enums/social-media-platform.enum';

/**
 * Suite de pruebas unitarias para los servicios de publicación en redes sociales
 * Incluye 5 pruebas con mocks para simular llamadas HTTP
 */
describe('Social Media Publishers', () => {
    let facebookPublisher: FacebookPublisherService;
    let instagramPublisher: InstagramPublisherService;
    let linkedinPublisher: LinkedinPublisherService;
    let tiktokPublisher: TiktokPublisherService;
    let publisherFactory: PublisherFactoryService;

    // Mock de ConfigService
    const mockConfigService = {
        get: jest.fn((key: string) => {
            const config = {
                FACEBOOK_PAGE_ID: '818435978027118',
                FACEBOOK_TOKEN: 'mock_facebook_token',
                INSTAGRAM_ACCOUNT_ID: '17841471985908722',
                INSTAGRAM_TOKEN: 'mock_instagram_token',
                LINKEDIN_TOKEN: 'mock_linkedin_token',
                TIKTOK_CLIENT_KEY: 'mock_client_key',
                TIKTOK_CLIENT_SECRET: 'mock_client_secret',
                TIKTOK_TOKEN: 'mock_tiktok_token',
            };
            return config[key];
        }),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                FacebookPublisherService,
                InstagramPublisherService,
                LinkedinPublisherService,
                TiktokPublisherService,
                PublisherFactoryService,
                {
                    provide: ConfigService,
                    useValue: mockConfigService,
                },
            ],
        }).compile();

        facebookPublisher = module.get<FacebookPublisherService>(FacebookPublisherService);
        instagramPublisher = module.get<InstagramPublisherService>(InstagramPublisherService);
        linkedinPublisher = module.get<LinkedinPublisherService>(LinkedinPublisherService);
        tiktokPublisher = module.get<TiktokPublisherService>(TiktokPublisherService);
        publisherFactory = module.get<PublisherFactoryService>(PublisherFactoryService);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    /**
     * PRUEBA 1: Facebook Publisher - Publicación exitosa
     * Mock de fetch para simular respuesta exitosa de Facebook Graph API
     */
    describe('FacebookPublisherService', () => {
        it('debe publicar exitosamente en Facebook', async () => {
            // Arrange: Mock de fetch
            const mockFetch = jest.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ id: '123456789', post_id: '818435978027118_123456789' }),
            });
            global.fetch = mockFetch as any;

            const caption = 'Test post from unit test - UAGRM';
            const imageUrl = 'https://res.cloudinary.com/dxicjichu/image/upload/v1764060307/noticias-app/n0b5lrapmvas1bxydjc3.png';

            // Act: Ejecutar publicación
            const result = await facebookPublisher.publish(caption, imageUrl);

            // Assert: Verificar resultado
            expect(result.success).toBe(true);
            expect(result.platform).toBe('facebook');
            expect(result.postId).toBe('123456789');

            // Verificar que fetch fue llamado correctamente
            expect(mockFetch).toHaveBeenCalledTimes(1);
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('818435978027118/photos'),
                expect.objectContaining({
                    method: 'POST',
                })
            );
        });
    });

    /**
     * PRUEBA 2: Instagram Publisher - Publicación exitosa con polling de estado
     * Mock de fetch para simular: crear container, verificar estado (FINISHED), publicar
     */
    describe('InstagramPublisherService', () => {
        it('debe publicar exitosamente en Instagram con delay de procesamiento', async () => {
            // Arrange: Mock de setTimeout para ejecutarse inmediatamente
            jest.spyOn(global, 'setTimeout').mockImplementation(((callback: any) => {
                callback();
                return 0 as any;
            }) as any);

            // Mock de fetch para simular 3 llamadas: crear container, verificar estado, publicar
            const mockFetch = jest.fn()
                .mockResolvedValueOnce({
                    // Paso 1: Crear media container
                    ok: true,
                    json: async () => ({ id: 'container_123' }),
                })
                .mockResolvedValueOnce({
                    // Polling: Verificar estado del container (FINISHED en primer intento)
                    ok: true,
                    json: async () => ({ status_code: 'FINISHED' }),
                })
                .mockResolvedValueOnce({
                    // Paso 2: Publicar
                    ok: true,
                    json: async () => ({ id: 'post_456' }),
                });
            global.fetch = mockFetch as any;

            const caption = 'Test Instagram post - UAGRM Noticias';
            const imageUrl = 'https://res.cloudinary.com/dxicjichu/image/upload/v1764060307/noticias-app/n0b5lrapmvas1bxydjc3.png';

            // Act: Ejecutar publicación
            const result = await instagramPublisher.publish(caption, imageUrl);

            // Assert
            expect(result.success).toBe(true);
            expect(result.platform).toBe('instagram');
            expect(result.postId).toBe('post_456');
            expect(mockFetch).toHaveBeenCalledTimes(3); // 3 llamadas: container + status + publish
        });
    });

    /**
     * PRUEBA 3: LinkedIn Publisher - Manejo de error de token inválido
     * Mock de fetch para simular error 401 (Unauthorized)
     */
    describe('LinkedinPublisherService', () => {
        it('debe manejar correctamente un error de token inválido', async () => {
            // Arrange: Mock de fetch que retorna error 401
            const mockFetch = jest.fn().mockResolvedValue({
                ok: false,
                status: 401,
                json: async () => ({
                    serviceErrorCode: 65600,
                    message: 'Invalid access token',
                    status: 401,
                }),
            });
            global.fetch = mockFetch as any;

            const caption = 'Test LinkedIn post - Universidad Autónoma Gabriel René Moreno';
            const imageUrl = 'https://res.cloudinary.com/dxicjichu/image/upload/v1764060307/noticias-app/n0b5lrapmvas1bxydjc3.png';

            // Act
            const result = await linkedinPublisher.publish(caption, imageUrl);

            // Assert: Verificar que retorna error
            expect(result.success).toBe(false);
            expect(result.platform).toBe('linkedin');
            expect(result.error).toBeDefined();
            expect(mockFetch).toHaveBeenCalled();
        });
    });

    /**
     * PRUEBA 4: TikTok Publisher - Token no configurado
     * Simula el caso cuando TIKTOK_TOKEN no está en .env
     */
    describe('TiktokPublisherService', () => {
        it('debe retornar error cuando el token no está configurado', async () => {
            // Arrange: Crear publisher sin token
            const mockConfigNoToken = {
                get: jest.fn((key: string) => {
                    if (key === 'TIKTOK_TOKEN') return undefined;
                    return 'mock_value';
                }),
            };

            const tiktokNoToken = new TiktokPublisherService(mockConfigNoToken as any);

            const caption = 'Test TikTok video - UAGRM Noticias';
            const videoPath = 'https://res.cloudinary.com/dxicjichu/video/upload/v1764059626/noticias-app/iizbk90zc3vmrpvmlhzk.mp4';

            // Act
            const result = await tiktokNoToken.publish(caption, videoPath);

            // Assert
            expect(result.success).toBe(false);
            expect(result.platform).toBe('tiktok');
            expect(result.error).toBe('Token no configurado');
        });
    });

    /**
     * PRUEBA 5: Publisher Factory - Obtención correcta de publisher por plataforma
     * Verifica que el factory retorna el publisher correcto según la plataforma
     */
    describe('PublisherFactoryService', () => {
        it('debe retornar el publisher correcto para cada plataforma', () => {
            // Act & Assert: Verificar cada plataforma
            const fbPublisher = publisherFactory.getPublisher(SocialMediaPlatform.FACEBOOK);
            expect(fbPublisher).toBeInstanceOf(FacebookPublisherService);

            const igPublisher = publisherFactory.getPublisher(SocialMediaPlatform.INSTAGRAM);
            expect(igPublisher).toBeInstanceOf(InstagramPublisherService);

            const liPublisher = publisherFactory.getPublisher(SocialMediaPlatform.LINKEDIN);
            expect(liPublisher).toBeInstanceOf(LinkedinPublisherService);

            const tkPublisher = publisherFactory.getTiktokPublisher();
            expect(tkPublisher).toBeInstanceOf(TiktokPublisherService);
        });

        it('debe lanzar error para plataforma no soportada', () => {
            // Act & Assert
            expect(() => {
                publisherFactory.getPublisher('twitter' as any);
            }).toThrow('Plataforma no soportada');
        });
    });
});
