export declare class CryptoService {
    private static deriveKey;
    static encrypt(text: string): Promise<string>;
    static decrypt(encryptedText: string): Promise<string>;
    static encryptObject<T extends Record<string, unknown>>(obj: T): Promise<string>;
    static decryptObject<T extends Record<string, unknown>>(encryptedText: string): Promise<T>;
}
//# sourceMappingURL=crypto.d.ts.map