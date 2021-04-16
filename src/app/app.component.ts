import {Component, ViewChild} from '@angular/core';
import {tap} from "rxjs/operators";
import {MatDialog} from "@angular/material/dialog";
import {DialogComponent} from "./dialog/dialog.component";
import {CertificateModel} from "../../projects/e-sign-lib/src/lib/models";
import {XMLESignDirective} from "../../projects/e-sign-lib/src/lib/xml-e-sign.directive";

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'e-sign';
  @ViewChild(XMLESignDirective) xmlESign: XMLESignDirective;

  constructor(private dialog: MatDialog) {
  }

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

  getSignedXML({ payload }: {payload: string}) {
    console.log(payload)
  }

  getSignError({ payload }: {payload: string}) {
    console.log(payload)
  }
}
