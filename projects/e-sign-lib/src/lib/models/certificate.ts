export interface CertificateModel {
  issuerName: string;
  isValid: boolean;
  name: string;
  thumbprint: string;
  validFrom: string;
  validTo: string;
  class?: string;
}
