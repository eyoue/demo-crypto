# E-sign
Contain directive ("xmlESign") and service ("CryptoProService"). <br>
Service it's wrapper on crypto-pro plugin. <br>
Directive contain XML signature logic.

#How use

HTML:
```
<button
  xmlESign
  (click)="openSignDialog()" <= your logic open dialog (with you layout)
  (successResult)="getSignedXML($event)" <= signed XML {payload, status}
  (failedResult)="getSignError($event)"> <= error sign {payload, status}
  Go
</button>
```

TS:
```
  openSignDialog() {
    const getDialogContext = (certificates: CertificateModel[]) => {
      return this.dialog.open(DialogComponent, {
        width: '800px',
        data: {
          title: 'Sign dialog',
          actionButton: {
            label: 'Sign',
            disabled: !this.xmlESign.selectedCertificate,
            selectionAction: (data: any) => {
              this.xmlESign.selectedCertificate = data;
            },
            clickAction: () => {
              this.xmlESign.sign();
            }
          },
          cancelButton: {
            label: 'Close',
          },
          listItems: certificates.map((cert) => ({
            data: cert,
            view: `
            <span>${cert.name}</span>
            <span>${cert.issuerName}</span>
            <span>${cert.validTo}</span>
            `
          }))
        }
      });
    }
    const getPreparedJson = () => {
      return {json: {data: 123}}
    }
    const certificates = this.xmlESign.getCertificates();
    const action = () => {
      this.xmlESign.jsonObject = getPreparedJson();
      certificates.pipe(tap(getDialogContext)).subscribe()
    }

    action()
  }
```
