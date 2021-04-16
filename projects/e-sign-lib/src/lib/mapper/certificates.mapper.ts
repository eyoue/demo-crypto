import { Certificate } from 'crypto-pro';
import {CertificateModel} from "../models/certificate";

export class CertificatesMapper {

  static map(src: Certificate): CertificateModel {
    if (!src) { return null; }
    const {
      issuerName,
      name,
      thumbprint,
      validFrom,
      validTo
    } = src;

    const matches = issuerName.match(/CN=([^,+]*)/);
    const normalizedName = (matches && matches.length > 0)
      ? matches[1]
      : issuerName;

    return {
      issuerName: normalizedName,
      isValid: true,
      name,
      thumbprint,
      validFrom,
      validTo
    };
  }
}
