import {Directive, EventEmitter, HostListener, Input, Output} from '@angular/core';
import {BehaviorSubject, iif, Observable, of, throwError} from "rxjs";
import {catchError, filter, map, tap} from "rxjs/operators";
import * as JsonToXML from "js2xmlparser";
import {CryptoProService} from "./crypto-pro.service";
import {CertificatesMapper} from "./mapper/certificates.mapper";
import {EMPTY_CERTIFICATE} from "./default-data/certificates";
import {CertificateModel, ErrorCryptoPro, ISignResult} from "./models";

@Directive({
  selector: '[xmlESign]'
})
export class XMLESignDirective {

  /**
   * @description Список сертификатов
   */
  certificates: CertificateModel[];

  /**
   * @description Выбранный сертификат
   */
  selectedCertificate: CertificateModel;

  /**
   * @description Плагин рабочий
   */
  isPluginValid = false;

  /**
   * @description Подписть в процессе
   */
  signInProgress = false;

  /**
   * @description События подписи (ошибки или успех)
   */
  signEvent$ = new BehaviorSubject<any>(null);

  /**
   * @description Флаг тестового режима (Alt + S)
   */
  isTestingMode = localStorage.getItem('SIGN_XML_TESTING_MODE') === 'true';

  /**
   * @description Блок в который будет положен распарсенный объект XML
   */
  @Input()
  rootField = 'html';

  /**
   * @description Исходный объект
   */
  @Input()
  jsonObject = {};

  /**
   * @description Флаг скачивания файла при подписи
   */
  @Input()
  isNeedDownloadFile = false;

  /**
   * @description События успеха
   */
  @Output()
  successResult = new EventEmitter<ISignResult>(null);

  /**
   * @description События ошибок
   */
  @Output()
  failedResult = new EventEmitter<ISignResult>(null);

  /**
   * @description Вход в режим тестировщика
   * Если не установлен плагин то Alt + S
   * @param event
   */
  @HostListener('window:keyup', ['$event'])
  keyEvent(event: KeyboardEvent) {
    if (event.altKey && event.code === 'KeyS') {
      this.isTestingMode = !this.isTestingMode;
      localStorage.setItem('SIGN_XML_TESTING_MODE', String(this.isTestingMode));
      console.log('SIGN_XML_TESTING_MODE: ', this.isTestingMode ? 'on' : 'off');
    }
  }

  constructor(private cryptoService: CryptoProService) {
    this.listenSignEvents();
  }

  /**
   * @description слушатель событий подписи
   * Внутри observable - в него пушатся события успеха или ошибки
   * Тут они обрабатываются
   * @private
   */
  public listenSignEvents() {
    return this.signEvent$
      .pipe(
        filter(response => response),
        tap((response) => {
          const {status, payload} = response;
          this.signInProgress = false;
          if (status === ErrorCryptoPro.Success) {
            this.successResult.emit({status, payload});
            this.selectedCertificate = null;
            if (this.isNeedDownloadFile) {
              this.downloadFile(payload, 'signed.xml');
            }
            return;
          } else {
            // обработка ошибок
            if (this.selectedCertificate) {
              this.selectedCertificate.isValid = false;
              this.selectedCertificate.class = 'disabled';
            }
            this.failedResult.emit({status, payload});
            return;
          }
        }),
      ).subscribe();
  }

  /**
   * @description Проверить наличие плагина
   */
  checkPlugin() {
    this.isPluginValid = this.cryptoService.isPlugin;

    if (!this.isPluginValid && !this.isTestingMode) {
      this.signEvent$.next({
        status: ErrorCryptoPro.PluginNotFined,
        payload: 'Требуется  КриптоПро ЭЦП Browser plug-in и установленная ЭЦП'
      });
    }
  }

  /**
   * @description Если сертификат выбран
   * @param certificate
   */
  onCertificateSelected(certificate: CertificateModel): void {
    this.selectedCertificate = certificate;
  }

  /**
   * @description Получить список сертификатов
   */
  getCertificates(): Observable<any> {
    if (!this.jsonObject) {
      return of(null);
    }
    const successFn = () => {
      return this.cryptoService.getUserCertificates();
    };
    const failFn = () => {
      return of(this.isTestingMode ? [EMPTY_CERTIFICATE] : []);
    };
    const action = () => {
      this.checkPlugin();
      return iif(() => this.isPluginValid,
        successFn(),
        failFn()
      ).pipe(
        map((certificates: any[]) => certificates.map(c => CertificatesMapper.map(c))),
        tap(certificates => {
          this.certificates = certificates;
        }),
        catchError(error => {
          this.certificates = [];
          this.signEvent$.next({
            status: ErrorCryptoPro.PluginNotFined,
            payload: 'Требуется  КриптоПро ЭЦП Browser plug-in и установленная ЭЦП'
          });
          return throwError(error);
        })
      );
    };
    return action();
  }

  /**
   *
   * @param text - содержимое файла (строка)
   * @param filename - имя файла
   * @private
   */
  private downloadFile(text: string, filename = 'filename.xml') {
    const pom = document.createElement('a');
    const bb = new Blob([text], {type: 'text/plain'});

    pom.setAttribute('href', window.URL.createObjectURL(bb));
    pom.setAttribute('download', filename);

    pom.dataset.downloadurl = ['text/plain', pom.download, pom.href].join(':');
    pom.draggable = true;
    pom.classList.add('dragout');

    pom.click();
    pom.remove();
  }

  /**
   * @description пользовательский JSON в XML (без мета инфы что это xml)
   */
  get jsonToXml() {
    return JsonToXML.parse(this.rootField, this.jsonObject).replace('<?xml version=\'1.0\'?>\n', '');
  }

  /**
   * @description Генерим xml, и отдаем на подпись - если мы в режиме тестирования
   * сразу отдаем xml (буд-то он подписан)
   */
  public sign() {
    const xmlData = this.jsonToXml;
    this.signInProgress = true;
    if (!this.selectedCertificate || this.selectedCertificate.thumbprint === EMPTY_CERTIFICATE.thumbprint) {
      const response = this.isTestingMode ?
        {status: ErrorCryptoPro.Success, payload: this.getXMLTemplate(xmlData, '', '', '')} :
        {
          status: ErrorCryptoPro.PluginNotFined,
          payload: 'Требуется  КриптоПро ЭЦП Browser plug-in и установленная ЭЦП'
        };
      this.signEvent$.next(response);
      return;
    } else {
      this.signXML(this.selectedCertificate.thumbprint, xmlData);
    }
  }

  /**
   *
   * @param body - тело xml с данными пользователя (строка)
   * @param b64cert - сертификат (строка)
   * @param signMethod - метод подписи (строка)
   * @param digestMethod - что-то для канонизации XML (строка)
   */
  getXMLTemplate = (body: string, b64cert: string, signMethod: string, digestMethod: string) => {
    return '<?xml version="1.0" encoding="UTF-8"?>' +
      '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" xmlns:u="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">' +
      '    <s:Header>' +
      '        <o:Security s:mustUnderstand="1" xmlns:o="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd" s:actor="http://smev.gosuslugi.ru/actors/smev">' +
      '            <o:BinarySecurityToken u:Id="uuid-ee82d445-758b-42cb-996c-666b74b60022-2" ValueType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-x509-token-profile-1.0#X509v3" EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary">' +
      b64cert +
      '            </o:BinarySecurityToken>' +
      '            <Signature xmlns="http://www.w3.org/2000/09/xmldsig#">' +
      '                <SignedInfo>' +
      '                    <CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#" />' +
      '                    <SignatureMethod Algorithm="' + signMethod + '"/>' +
      '                    <Reference URI="#_1">' +
      '                        <Transforms>' +
      '                            <Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#" />' +
      '                        </Transforms>' +
      '                        <DigestMethod Algorithm="' + digestMethod + '"/>' +
      '                        <DigestValue></DigestValue>' +
      '                    </Reference>' +
      '                </SignedInfo>' +
      '                <SignatureValue></SignatureValue>' +
      '                <KeyInfo>' +
      '                    <o:SecurityTokenReference>' +
      '                    <o:Reference ValueType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-x509-token-profile-1.0#X509v3" URI="#uuid-ee82d445-758b-42cb-996c-666b74b60022-2" />' +
      '                    </o:SecurityTokenReference>' +
      '                </KeyInfo>' +
      '            </Signature>' +
      '        </o:Security>' +
      '    </s:Header>' +
      '    <s:Body u:Id="_1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">' +
      body +
      '    </s:Body>' +
      '</s:Envelope>';
  }

  /**
   *
   * @param sCertName - имя сертификата  (строка)
   * @param body - строка, которая допишется в xml  (строка)
   * @private
   */
  private signXML(sCertName: string, body: string) {
    const CAPICOM_CURRENT_USER_STORE = 2;
    const CAPICOM_MY_STORE = 'My';
    const CAPICOM_STORE_OPEN_MAXIMUM_ALLOWED = 2;
    const CAPICOM_CERTIFICATE_FIND_SHA1_HASH = 0;
    const CAPICOM_CERTIFICATE_FIND_SUBJECT_NAME = 1;
    const CADESCOM_XML_SIGNATURE_TYPE_TEMPLATE = 2;
    const CADESCOM_ENCODE_BASE64 = 0;

    const run = () => {
      const that = this;
      // @ts-ignore
      cadesplugin.async_spawn(function* (args) {
        // Здесь следует заполнить SubjectName сертификата
        // let sCertName = oCertName.value;

        if ('' === sCertName) {
          alert('Введите имя сертификата (CN).');
          return;
        }

        // Ищем сертификат для подписи
        // @ts-ignore
        const oStore = yield cadesplugin.CreateObjectAsync('CAdESCOM.Store');
        yield oStore.Open(CAPICOM_CURRENT_USER_STORE, CAPICOM_MY_STORE,
          CAPICOM_STORE_OPEN_MAXIMUM_ALLOWED);

        const oStoreCerts = yield oStore.Certificates;
        const oCertificates = yield oStoreCerts.Find(
          CAPICOM_CERTIFICATE_FIND_SHA1_HASH, sCertName);
        const certsCount = yield oCertificates.Count;
        if (certsCount === 0) {
          that.signEvent$.next({status: ErrorCryptoPro.CertificateNotFound, payload: sCertName});
          // alert("Certificate not found: " + sCertName);
          return;
        }
        const oCertificate = yield oCertificates.Item(1);
        yield oStore.Close();

        const oPublicKey = yield oCertificate.PublicKey();
        const oAlgorithm = yield oPublicKey.Algorithm;
        const algoOid = yield oAlgorithm.Value;
        let signMethod = '';
        let digestMethod = '';
        if (algoOid === '1.2.643.7.1.1.1.1') {   // алгоритм подписи ГОСТ Р 34.10-2012 с ключом 256 бит
          signMethod = 'urn:ietf:params:xml:ns:cpxmlsec:algorithms:gostr34102012-gostr34112012-256';
          digestMethod = 'urn:ietf:params:xml:ns:cpxmlsec:algorithms:gostr34112012-256';
        } else if (algoOid === '1.2.643.7.1.1.1.2') {   // алгоритм подписи ГОСТ Р 34.10-2012 с ключом 512 бит
          signMethod = 'urn:ietf:params:xml:ns:cpxmlsec:algorithms:gostr34102012-gostr34112012-512';
          digestMethod = 'urn:ietf:params:xml:ns:cpxmlsec:algorithms:gostr34112012-512';
        } else if (algoOid === '1.2.643.2.2.19') {  // алгоритм ГОСТ Р 34.10-2001
          signMethod = 'urn:ietf:params:xml:ns:cpxmlsec:algorithms:gostr34102001-gostr3411';
          digestMethod = 'urn:ietf:params:xml:ns:cpxmlsec:algorithms:gostr3411';
        } else {
          const errormes = 'Поддерживается XML подпись сертификатами только с алгоритмом ГОСТ Р 34.10-2012, ГОСТ Р 34.10-2001';
          that.signEvent$.next({status: ErrorCryptoPro.SignNotInGOST, payload: errormes});
          // alert(errormes);
        }

        let b64cert = yield oCertificate.Export(CADESCOM_ENCODE_BASE64);
        b64cert = b64cert.replace(/[\r\n]/g, '');

        // В шаблоне документа обязательно должны присутствовать следующие элементы:
        // BinarySecurityToken - сертификат ключа подписи в кодировке BASE64
        //                       атрибут Id должен содержать уникальный идентификатор
        //                       сертификата в документе
        // Signature - элемент с описанием свойств подписи:
        //     SignedInfo - информация о подписываемых элементах:
        //         CanonicalizationMethod - алгоритм приведения к каноническому виду.
        //                                  Для СМЭВ "http://www.w3.org/2001/10/xml-exc-c14n#"
        //         SignatureMethod - идентификатор алгоритма подписи.
        //                           Для СМЭВ "http://www.w3.org/2001/04/xmldsig-more#gostr34102001-gostr3411"
        //         Reference - атрибут URI должен содержать ссылку на подписываемые элементы в вашем документе:
        //             Transforms - преобразования, которые следует применить к подписываемым элементам.
        //                          В примере - приведение к каноническому виду.
        //             DigestMethod - идентификатор алгоритма хэширования.
        //                            Для СМЭВ "http://www.w3.org/2001/04/xmldsig-more#gostr3411"
        //             DigestValue - Хэш-значение подписываемых элементов. Данный элемент следует оставить пустым.
        //                           Его значение будет заполнено при создании подписи.
        //     SignatureValue - значение подписи. Данный элемент следует оставить пустым.
        //                      Его значение будет заполнено при создании подписи.
        //     KeyInfo - информация о сертификате ключа подписи
        //         SecurityTokenReference - ссылка на сертификат
        //             Reference - атрибут ValueType должен содержать значение
        //                         "http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-x509-token-profile-1.0#X509v3"
        //                         Атрибут URI должен содержать ссылку на уникальный идентификатор
        //                         сертификата (такой же, как указан в элементе BinarySecurityToken)
        const sContent = that.getXMLTemplate(body, b64cert, signMethod, digestMethod);

        // Создаем объект CAdESCOM.CPSigner
        // @ts-ignore
        const oSigner = yield cadesplugin.CreateObjectAsync('CAdESCOM.CPSigner');
        yield oSigner.propset_Certificate(oCertificate);
        yield oSigner.propset_CheckCertificate(true);

        // Создаем объект CAdESCOM.SignedXML
        // @ts-ignore
        const oSignedXML = yield cadesplugin.CreateObjectAsync('CAdESCOM.SignedXML');
        yield oSignedXML.propset_Content(sContent);

        // Указываем тип подписи - в данном случае по шаблону
        yield oSignedXML.propset_SignatureType(CADESCOM_XML_SIGNATURE_TYPE_TEMPLATE);

        let sSignedMessage = '';
        try {
          sSignedMessage = yield oSignedXML.Sign(oSigner);
          that.signEvent$.next({status: ErrorCryptoPro.Success, payload: sSignedMessage});
        } catch (err) {
          // @ts-ignore
          that.signEvent$.next({status: ErrorCryptoPro.SignError, payload: cadesplugin.getLastError(err.message)});
          // alert("Failed to create signature. Error: " + cadesplugin.getLastError(err));
          return;
        }
        // Полученный подписанный XML-документ должен проходить проверку на сайте СМЭВ
        // console.log(sSignedMessage);


        // Verification

        // Создаем объект CAdESCOM.SignedXML
        // @ts-ignore
        // let oSignedXML2 = yield cadesplugin.CreateObjectAsync("CAdESCOM.SignedXML");

        // try {
        //   yield oSignedXML2.Verify(sSignedMessage);
        //   alert("Signature verified");
        // } catch (err) {
        //   // @ts-ignore
        //   alert("Failed to verify signature. Error: " + cadesplugin.getLastError(err));
        //   return false;
        // }
      });
    };

    run();
  }
}
