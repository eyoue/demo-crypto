import {CommonModule} from '@angular/common';
import {NgModule} from '@angular/core';
import {CryptoProService} from "./crypto-pro.service";
import {XMLESignDirective} from "./xml-e-sign.directive";

@NgModule({
  imports: [
    CommonModule,
  ],
  providers: [CryptoProService],
  declarations: [XMLESignDirective],
  exports: [XMLESignDirective]
})
export class ESignerModule {
  constructor(private cryptoService: CryptoProService ) {
    this.cryptoService.isPluginValid().subscribe()
  }
}
