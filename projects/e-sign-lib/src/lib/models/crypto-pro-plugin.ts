export class CryptoProPluginInfo {
  pluginVersion: string;
  cspVersion: string;

  constructor({ cadesVersion, cspVersion }: {cadesVersion: string, cspVersion: string}) {
    this.pluginVersion = cadesVersion;
    this.cspVersion = cspVersion;
  }
}
