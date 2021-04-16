import {Inject, Injectable} from '@angular/core';
import {from, Observable} from 'rxjs';
import {
  createDetachedSignature,
  createHash,
  createXMLSignature,
  getSystemInfo,
  getUserCertificates,
  isValidSystemSetup
} from 'crypto-pro';
import {catchError, map, tap} from 'rxjs/operators';
import {CryptoProPluginInfo} from "./models";


@Injectable()
export class CryptoProService {

  isPlugin = false;

  constructor() {
    // Отключить модальное окно с просьбой скачать плагин (встроенное в cadesplugin)
    if ('cadesplugin_skip_extension_install' in window) {
      //@ts-ignore
      window.cadesplugin_skip_extension_install = true;
    }
  }

  isPluginValid(): Observable<boolean> {
    return from(isValidSystemSetup()).pipe(tap(
      (value) => this.isPlugin = value,
      catchError(err => {
        this.isPlugin = false;
        return err;
      })
    ));
  }

  getPluginInfo(): Observable<CryptoProPluginInfo> {
    return from(getSystemInfo()).pipe(
      map(info => new CryptoProPluginInfo(info))
    );
  }

  getUserCertificates(): Observable<any[]> {
    return new Observable(observer => from(getUserCertificates())
      .subscribe(observer));
  }

  createFileSignature(thumbprint: string, fileBlob: Blob): Observable<any> {
    return new Observable(observer => from(this.createFileDetachedSignature(thumbprint, fileBlob))
      .subscribe(observer));
  }

  createXMLSignature(thumbprint: string, unencryptedMessage: string): Observable<any> {
    return new Observable(observer => from(this.createXMLSignaturePromise(thumbprint, unencryptedMessage))
      .subscribe(observer));
  }

  private async createXMLSignaturePromise(thumbprint: string, unencryptedMessage: string) {
    return await createXMLSignature(thumbprint, unencryptedMessage);
  }

  private async createFileDetachedSignature(thumbprint: string, fileBlob: Blob) {
    const data = await fileBlob.arrayBuffer();
    const hash = await createHash(data);
    return await createDetachedSignature(thumbprint, hash);
  }
}
