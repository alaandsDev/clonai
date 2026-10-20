/** Contrato para futuras integrações oficiais. Nenhuma implementação automática
 * está registrada no MVP; exportar um arquivo nunca significa publicá-lo. */
export interface PublicationCapabilities {
  mode: "manual" | "official-api";
  authorized: boolean;
  platform: string;
}
export interface FutureOfficialAdapter {
  capabilities(): Promise<PublicationCapabilities>;
  publish(input: {
    assetId: string;
    explicitAuthorizationId: string;
  }): Promise<{ externalId: string; state: "processing" | "published" }>;
}
export const currentPublication: PublicationCapabilities = {
  mode: "manual",
  authorized: false,
  platform: "export",
};
