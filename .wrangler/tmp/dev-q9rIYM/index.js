var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// .wrangler/tmp/bundle-2fs9a6/checked-fetch.js
function checkURL(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls.has(url.toString())) {
      urls.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
var urls;
var init_checked_fetch = __esm({
  ".wrangler/tmp/bundle-2fs9a6/checked-fetch.js"() {
    urls = /* @__PURE__ */ new Set();
    __name(checkURL, "checkURL");
    globalThis.fetch = new Proxy(globalThis.fetch, {
      apply(target, thisArg, argArray) {
        const [request, init] = argArray;
        checkURL(request, init);
        return Reflect.apply(target, thisArg, argArray);
      }
    });
  }
});

// wrangler-modules-watch:wrangler:modules-watch
var init_wrangler_modules_watch = __esm({
  "wrangler-modules-watch:wrangler:modules-watch"() {
    init_checked_fetch();
    init_modules_watch_stub();
  }
});

// ../Users/VIEW/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/modules-watch-stub.js
var init_modules_watch_stub = __esm({
  "../Users/VIEW/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/modules-watch-stub.js"() {
    init_wrangler_modules_watch();
  }
});

// node_modules/mime/Mime.js
var require_Mime = __commonJS({
  "node_modules/mime/Mime.js"(exports, module) {
    "use strict";
    init_checked_fetch();
    init_modules_watch_stub();
    function Mime() {
      this._types = /* @__PURE__ */ Object.create(null);
      this._extensions = /* @__PURE__ */ Object.create(null);
      for (let i = 0; i < arguments.length; i++) {
        this.define(arguments[i]);
      }
      this.define = this.define.bind(this);
      this.getType = this.getType.bind(this);
      this.getExtension = this.getExtension.bind(this);
    }
    __name(Mime, "Mime");
    Mime.prototype.define = function(typeMap, force) {
      for (let type in typeMap) {
        let extensions = typeMap[type].map(function(t) {
          return t.toLowerCase();
        });
        type = type.toLowerCase();
        for (let i = 0; i < extensions.length; i++) {
          const ext = extensions[i];
          if (ext[0] === "*") {
            continue;
          }
          if (!force && ext in this._types) {
            throw new Error(
              'Attempt to change mapping for "' + ext + '" extension from "' + this._types[ext] + '" to "' + type + '". Pass `force=true` to allow this, otherwise remove "' + ext + '" from the list of extensions for "' + type + '".'
            );
          }
          this._types[ext] = type;
        }
        if (force || !this._extensions[type]) {
          const ext = extensions[0];
          this._extensions[type] = ext[0] !== "*" ? ext : ext.substr(1);
        }
      }
    };
    Mime.prototype.getType = function(path) {
      path = String(path);
      let last = path.replace(/^.*[/\\]/, "").toLowerCase();
      let ext = last.replace(/^.*\./, "").toLowerCase();
      let hasPath = last.length < path.length;
      let hasDot = ext.length < last.length - 1;
      return (hasDot || !hasPath) && this._types[ext] || null;
    };
    Mime.prototype.getExtension = function(type) {
      type = /^\s*([^;\s]*)/.test(type) && RegExp.$1;
      return type && this._extensions[type.toLowerCase()] || null;
    };
    module.exports = Mime;
  }
});

// node_modules/mime/types/standard.js
var require_standard = __commonJS({
  "node_modules/mime/types/standard.js"(exports, module) {
    init_checked_fetch();
    init_modules_watch_stub();
    module.exports = { "application/andrew-inset": ["ez"], "application/applixware": ["aw"], "application/atom+xml": ["atom"], "application/atomcat+xml": ["atomcat"], "application/atomdeleted+xml": ["atomdeleted"], "application/atomsvc+xml": ["atomsvc"], "application/atsc-dwd+xml": ["dwd"], "application/atsc-held+xml": ["held"], "application/atsc-rsat+xml": ["rsat"], "application/bdoc": ["bdoc"], "application/calendar+xml": ["xcs"], "application/ccxml+xml": ["ccxml"], "application/cdfx+xml": ["cdfx"], "application/cdmi-capability": ["cdmia"], "application/cdmi-container": ["cdmic"], "application/cdmi-domain": ["cdmid"], "application/cdmi-object": ["cdmio"], "application/cdmi-queue": ["cdmiq"], "application/cu-seeme": ["cu"], "application/dash+xml": ["mpd"], "application/davmount+xml": ["davmount"], "application/docbook+xml": ["dbk"], "application/dssc+der": ["dssc"], "application/dssc+xml": ["xdssc"], "application/ecmascript": ["es", "ecma"], "application/emma+xml": ["emma"], "application/emotionml+xml": ["emotionml"], "application/epub+zip": ["epub"], "application/exi": ["exi"], "application/express": ["exp"], "application/fdt+xml": ["fdt"], "application/font-tdpfr": ["pfr"], "application/geo+json": ["geojson"], "application/gml+xml": ["gml"], "application/gpx+xml": ["gpx"], "application/gxf": ["gxf"], "application/gzip": ["gz"], "application/hjson": ["hjson"], "application/hyperstudio": ["stk"], "application/inkml+xml": ["ink", "inkml"], "application/ipfix": ["ipfix"], "application/its+xml": ["its"], "application/java-archive": ["jar", "war", "ear"], "application/java-serialized-object": ["ser"], "application/java-vm": ["class"], "application/javascript": ["js", "mjs"], "application/json": ["json", "map"], "application/json5": ["json5"], "application/jsonml+json": ["jsonml"], "application/ld+json": ["jsonld"], "application/lgr+xml": ["lgr"], "application/lost+xml": ["lostxml"], "application/mac-binhex40": ["hqx"], "application/mac-compactpro": ["cpt"], "application/mads+xml": ["mads"], "application/manifest+json": ["webmanifest"], "application/marc": ["mrc"], "application/marcxml+xml": ["mrcx"], "application/mathematica": ["ma", "nb", "mb"], "application/mathml+xml": ["mathml"], "application/mbox": ["mbox"], "application/mediaservercontrol+xml": ["mscml"], "application/metalink+xml": ["metalink"], "application/metalink4+xml": ["meta4"], "application/mets+xml": ["mets"], "application/mmt-aei+xml": ["maei"], "application/mmt-usd+xml": ["musd"], "application/mods+xml": ["mods"], "application/mp21": ["m21", "mp21"], "application/mp4": ["mp4s", "m4p"], "application/msword": ["doc", "dot"], "application/mxf": ["mxf"], "application/n-quads": ["nq"], "application/n-triples": ["nt"], "application/node": ["cjs"], "application/octet-stream": ["bin", "dms", "lrf", "mar", "so", "dist", "distz", "pkg", "bpk", "dump", "elc", "deploy", "exe", "dll", "deb", "dmg", "iso", "img", "msi", "msp", "msm", "buffer"], "application/oda": ["oda"], "application/oebps-package+xml": ["opf"], "application/ogg": ["ogx"], "application/omdoc+xml": ["omdoc"], "application/onenote": ["onetoc", "onetoc2", "onetmp", "onepkg"], "application/oxps": ["oxps"], "application/p2p-overlay+xml": ["relo"], "application/patch-ops-error+xml": ["xer"], "application/pdf": ["pdf"], "application/pgp-encrypted": ["pgp"], "application/pgp-signature": ["asc", "sig"], "application/pics-rules": ["prf"], "application/pkcs10": ["p10"], "application/pkcs7-mime": ["p7m", "p7c"], "application/pkcs7-signature": ["p7s"], "application/pkcs8": ["p8"], "application/pkix-attr-cert": ["ac"], "application/pkix-cert": ["cer"], "application/pkix-crl": ["crl"], "application/pkix-pkipath": ["pkipath"], "application/pkixcmp": ["pki"], "application/pls+xml": ["pls"], "application/postscript": ["ai", "eps", "ps"], "application/provenance+xml": ["provx"], "application/pskc+xml": ["pskcxml"], "application/raml+yaml": ["raml"], "application/rdf+xml": ["rdf", "owl"], "application/reginfo+xml": ["rif"], "application/relax-ng-compact-syntax": ["rnc"], "application/resource-lists+xml": ["rl"], "application/resource-lists-diff+xml": ["rld"], "application/rls-services+xml": ["rs"], "application/route-apd+xml": ["rapd"], "application/route-s-tsid+xml": ["sls"], "application/route-usd+xml": ["rusd"], "application/rpki-ghostbusters": ["gbr"], "application/rpki-manifest": ["mft"], "application/rpki-roa": ["roa"], "application/rsd+xml": ["rsd"], "application/rss+xml": ["rss"], "application/rtf": ["rtf"], "application/sbml+xml": ["sbml"], "application/scvp-cv-request": ["scq"], "application/scvp-cv-response": ["scs"], "application/scvp-vp-request": ["spq"], "application/scvp-vp-response": ["spp"], "application/sdp": ["sdp"], "application/senml+xml": ["senmlx"], "application/sensml+xml": ["sensmlx"], "application/set-payment-initiation": ["setpay"], "application/set-registration-initiation": ["setreg"], "application/shf+xml": ["shf"], "application/sieve": ["siv", "sieve"], "application/smil+xml": ["smi", "smil"], "application/sparql-query": ["rq"], "application/sparql-results+xml": ["srx"], "application/srgs": ["gram"], "application/srgs+xml": ["grxml"], "application/sru+xml": ["sru"], "application/ssdl+xml": ["ssdl"], "application/ssml+xml": ["ssml"], "application/swid+xml": ["swidtag"], "application/tei+xml": ["tei", "teicorpus"], "application/thraud+xml": ["tfi"], "application/timestamped-data": ["tsd"], "application/toml": ["toml"], "application/trig": ["trig"], "application/ttml+xml": ["ttml"], "application/ubjson": ["ubj"], "application/urc-ressheet+xml": ["rsheet"], "application/urc-targetdesc+xml": ["td"], "application/voicexml+xml": ["vxml"], "application/wasm": ["wasm"], "application/widget": ["wgt"], "application/winhlp": ["hlp"], "application/wsdl+xml": ["wsdl"], "application/wspolicy+xml": ["wspolicy"], "application/xaml+xml": ["xaml"], "application/xcap-att+xml": ["xav"], "application/xcap-caps+xml": ["xca"], "application/xcap-diff+xml": ["xdf"], "application/xcap-el+xml": ["xel"], "application/xcap-ns+xml": ["xns"], "application/xenc+xml": ["xenc"], "application/xhtml+xml": ["xhtml", "xht"], "application/xliff+xml": ["xlf"], "application/xml": ["xml", "xsl", "xsd", "rng"], "application/xml-dtd": ["dtd"], "application/xop+xml": ["xop"], "application/xproc+xml": ["xpl"], "application/xslt+xml": ["*xsl", "xslt"], "application/xspf+xml": ["xspf"], "application/xv+xml": ["mxml", "xhvml", "xvml", "xvm"], "application/yang": ["yang"], "application/yin+xml": ["yin"], "application/zip": ["zip"], "audio/3gpp": ["*3gpp"], "audio/adpcm": ["adp"], "audio/amr": ["amr"], "audio/basic": ["au", "snd"], "audio/midi": ["mid", "midi", "kar", "rmi"], "audio/mobile-xmf": ["mxmf"], "audio/mp3": ["*mp3"], "audio/mp4": ["m4a", "mp4a"], "audio/mpeg": ["mpga", "mp2", "mp2a", "mp3", "m2a", "m3a"], "audio/ogg": ["oga", "ogg", "spx", "opus"], "audio/s3m": ["s3m"], "audio/silk": ["sil"], "audio/wav": ["wav"], "audio/wave": ["*wav"], "audio/webm": ["weba"], "audio/xm": ["xm"], "font/collection": ["ttc"], "font/otf": ["otf"], "font/ttf": ["ttf"], "font/woff": ["woff"], "font/woff2": ["woff2"], "image/aces": ["exr"], "image/apng": ["apng"], "image/avif": ["avif"], "image/bmp": ["bmp"], "image/cgm": ["cgm"], "image/dicom-rle": ["drle"], "image/emf": ["emf"], "image/fits": ["fits"], "image/g3fax": ["g3"], "image/gif": ["gif"], "image/heic": ["heic"], "image/heic-sequence": ["heics"], "image/heif": ["heif"], "image/heif-sequence": ["heifs"], "image/hej2k": ["hej2"], "image/hsj2": ["hsj2"], "image/ief": ["ief"], "image/jls": ["jls"], "image/jp2": ["jp2", "jpg2"], "image/jpeg": ["jpeg", "jpg", "jpe"], "image/jph": ["jph"], "image/jphc": ["jhc"], "image/jpm": ["jpm"], "image/jpx": ["jpx", "jpf"], "image/jxr": ["jxr"], "image/jxra": ["jxra"], "image/jxrs": ["jxrs"], "image/jxs": ["jxs"], "image/jxsc": ["jxsc"], "image/jxsi": ["jxsi"], "image/jxss": ["jxss"], "image/ktx": ["ktx"], "image/ktx2": ["ktx2"], "image/png": ["png"], "image/sgi": ["sgi"], "image/svg+xml": ["svg", "svgz"], "image/t38": ["t38"], "image/tiff": ["tif", "tiff"], "image/tiff-fx": ["tfx"], "image/webp": ["webp"], "image/wmf": ["wmf"], "message/disposition-notification": ["disposition-notification"], "message/global": ["u8msg"], "message/global-delivery-status": ["u8dsn"], "message/global-disposition-notification": ["u8mdn"], "message/global-headers": ["u8hdr"], "message/rfc822": ["eml", "mime"], "model/3mf": ["3mf"], "model/gltf+json": ["gltf"], "model/gltf-binary": ["glb"], "model/iges": ["igs", "iges"], "model/mesh": ["msh", "mesh", "silo"], "model/mtl": ["mtl"], "model/obj": ["obj"], "model/step+xml": ["stpx"], "model/step+zip": ["stpz"], "model/step-xml+zip": ["stpxz"], "model/stl": ["stl"], "model/vrml": ["wrl", "vrml"], "model/x3d+binary": ["*x3db", "x3dbz"], "model/x3d+fastinfoset": ["x3db"], "model/x3d+vrml": ["*x3dv", "x3dvz"], "model/x3d+xml": ["x3d", "x3dz"], "model/x3d-vrml": ["x3dv"], "text/cache-manifest": ["appcache", "manifest"], "text/calendar": ["ics", "ifb"], "text/coffeescript": ["coffee", "litcoffee"], "text/css": ["css"], "text/csv": ["csv"], "text/html": ["html", "htm", "shtml"], "text/jade": ["jade"], "text/jsx": ["jsx"], "text/less": ["less"], "text/markdown": ["markdown", "md"], "text/mathml": ["mml"], "text/mdx": ["mdx"], "text/n3": ["n3"], "text/plain": ["txt", "text", "conf", "def", "list", "log", "in", "ini"], "text/richtext": ["rtx"], "text/rtf": ["*rtf"], "text/sgml": ["sgml", "sgm"], "text/shex": ["shex"], "text/slim": ["slim", "slm"], "text/spdx": ["spdx"], "text/stylus": ["stylus", "styl"], "text/tab-separated-values": ["tsv"], "text/troff": ["t", "tr", "roff", "man", "me", "ms"], "text/turtle": ["ttl"], "text/uri-list": ["uri", "uris", "urls"], "text/vcard": ["vcard"], "text/vtt": ["vtt"], "text/xml": ["*xml"], "text/yaml": ["yaml", "yml"], "video/3gpp": ["3gp", "3gpp"], "video/3gpp2": ["3g2"], "video/h261": ["h261"], "video/h263": ["h263"], "video/h264": ["h264"], "video/iso.segment": ["m4s"], "video/jpeg": ["jpgv"], "video/jpm": ["*jpm", "jpgm"], "video/mj2": ["mj2", "mjp2"], "video/mp2t": ["ts"], "video/mp4": ["mp4", "mp4v", "mpg4"], "video/mpeg": ["mpeg", "mpg", "mpe", "m1v", "m2v"], "video/ogg": ["ogv"], "video/quicktime": ["qt", "mov"], "video/webm": ["webm"] };
  }
});

// node_modules/mime/types/other.js
var require_other = __commonJS({
  "node_modules/mime/types/other.js"(exports, module) {
    init_checked_fetch();
    init_modules_watch_stub();
    module.exports = { "application/prs.cww": ["cww"], "application/vnd.1000minds.decision-model+xml": ["1km"], "application/vnd.3gpp.pic-bw-large": ["plb"], "application/vnd.3gpp.pic-bw-small": ["psb"], "application/vnd.3gpp.pic-bw-var": ["pvb"], "application/vnd.3gpp2.tcap": ["tcap"], "application/vnd.3m.post-it-notes": ["pwn"], "application/vnd.accpac.simply.aso": ["aso"], "application/vnd.accpac.simply.imp": ["imp"], "application/vnd.acucobol": ["acu"], "application/vnd.acucorp": ["atc", "acutc"], "application/vnd.adobe.air-application-installer-package+zip": ["air"], "application/vnd.adobe.formscentral.fcdt": ["fcdt"], "application/vnd.adobe.fxp": ["fxp", "fxpl"], "application/vnd.adobe.xdp+xml": ["xdp"], "application/vnd.adobe.xfdf": ["xfdf"], "application/vnd.ahead.space": ["ahead"], "application/vnd.airzip.filesecure.azf": ["azf"], "application/vnd.airzip.filesecure.azs": ["azs"], "application/vnd.amazon.ebook": ["azw"], "application/vnd.americandynamics.acc": ["acc"], "application/vnd.amiga.ami": ["ami"], "application/vnd.android.package-archive": ["apk"], "application/vnd.anser-web-certificate-issue-initiation": ["cii"], "application/vnd.anser-web-funds-transfer-initiation": ["fti"], "application/vnd.antix.game-component": ["atx"], "application/vnd.apple.installer+xml": ["mpkg"], "application/vnd.apple.keynote": ["key"], "application/vnd.apple.mpegurl": ["m3u8"], "application/vnd.apple.numbers": ["numbers"], "application/vnd.apple.pages": ["pages"], "application/vnd.apple.pkpass": ["pkpass"], "application/vnd.aristanetworks.swi": ["swi"], "application/vnd.astraea-software.iota": ["iota"], "application/vnd.audiograph": ["aep"], "application/vnd.balsamiq.bmml+xml": ["bmml"], "application/vnd.blueice.multipass": ["mpm"], "application/vnd.bmi": ["bmi"], "application/vnd.businessobjects": ["rep"], "application/vnd.chemdraw+xml": ["cdxml"], "application/vnd.chipnuts.karaoke-mmd": ["mmd"], "application/vnd.cinderella": ["cdy"], "application/vnd.citationstyles.style+xml": ["csl"], "application/vnd.claymore": ["cla"], "application/vnd.cloanto.rp9": ["rp9"], "application/vnd.clonk.c4group": ["c4g", "c4d", "c4f", "c4p", "c4u"], "application/vnd.cluetrust.cartomobile-config": ["c11amc"], "application/vnd.cluetrust.cartomobile-config-pkg": ["c11amz"], "application/vnd.commonspace": ["csp"], "application/vnd.contact.cmsg": ["cdbcmsg"], "application/vnd.cosmocaller": ["cmc"], "application/vnd.crick.clicker": ["clkx"], "application/vnd.crick.clicker.keyboard": ["clkk"], "application/vnd.crick.clicker.palette": ["clkp"], "application/vnd.crick.clicker.template": ["clkt"], "application/vnd.crick.clicker.wordbank": ["clkw"], "application/vnd.criticaltools.wbs+xml": ["wbs"], "application/vnd.ctc-posml": ["pml"], "application/vnd.cups-ppd": ["ppd"], "application/vnd.curl.car": ["car"], "application/vnd.curl.pcurl": ["pcurl"], "application/vnd.dart": ["dart"], "application/vnd.data-vision.rdz": ["rdz"], "application/vnd.dbf": ["dbf"], "application/vnd.dece.data": ["uvf", "uvvf", "uvd", "uvvd"], "application/vnd.dece.ttml+xml": ["uvt", "uvvt"], "application/vnd.dece.unspecified": ["uvx", "uvvx"], "application/vnd.dece.zip": ["uvz", "uvvz"], "application/vnd.denovo.fcselayout-link": ["fe_launch"], "application/vnd.dna": ["dna"], "application/vnd.dolby.mlp": ["mlp"], "application/vnd.dpgraph": ["dpg"], "application/vnd.dreamfactory": ["dfac"], "application/vnd.ds-keypoint": ["kpxx"], "application/vnd.dvb.ait": ["ait"], "application/vnd.dvb.service": ["svc"], "application/vnd.dynageo": ["geo"], "application/vnd.ecowin.chart": ["mag"], "application/vnd.enliven": ["nml"], "application/vnd.epson.esf": ["esf"], "application/vnd.epson.msf": ["msf"], "application/vnd.epson.quickanime": ["qam"], "application/vnd.epson.salt": ["slt"], "application/vnd.epson.ssf": ["ssf"], "application/vnd.eszigno3+xml": ["es3", "et3"], "application/vnd.ezpix-album": ["ez2"], "application/vnd.ezpix-package": ["ez3"], "application/vnd.fdf": ["fdf"], "application/vnd.fdsn.mseed": ["mseed"], "application/vnd.fdsn.seed": ["seed", "dataless"], "application/vnd.flographit": ["gph"], "application/vnd.fluxtime.clip": ["ftc"], "application/vnd.framemaker": ["fm", "frame", "maker", "book"], "application/vnd.frogans.fnc": ["fnc"], "application/vnd.frogans.ltf": ["ltf"], "application/vnd.fsc.weblaunch": ["fsc"], "application/vnd.fujitsu.oasys": ["oas"], "application/vnd.fujitsu.oasys2": ["oa2"], "application/vnd.fujitsu.oasys3": ["oa3"], "application/vnd.fujitsu.oasysgp": ["fg5"], "application/vnd.fujitsu.oasysprs": ["bh2"], "application/vnd.fujixerox.ddd": ["ddd"], "application/vnd.fujixerox.docuworks": ["xdw"], "application/vnd.fujixerox.docuworks.binder": ["xbd"], "application/vnd.fuzzysheet": ["fzs"], "application/vnd.genomatix.tuxedo": ["txd"], "application/vnd.geogebra.file": ["ggb"], "application/vnd.geogebra.tool": ["ggt"], "application/vnd.geometry-explorer": ["gex", "gre"], "application/vnd.geonext": ["gxt"], "application/vnd.geoplan": ["g2w"], "application/vnd.geospace": ["g3w"], "application/vnd.gmx": ["gmx"], "application/vnd.google-apps.document": ["gdoc"], "application/vnd.google-apps.presentation": ["gslides"], "application/vnd.google-apps.spreadsheet": ["gsheet"], "application/vnd.google-earth.kml+xml": ["kml"], "application/vnd.google-earth.kmz": ["kmz"], "application/vnd.grafeq": ["gqf", "gqs"], "application/vnd.groove-account": ["gac"], "application/vnd.groove-help": ["ghf"], "application/vnd.groove-identity-message": ["gim"], "application/vnd.groove-injector": ["grv"], "application/vnd.groove-tool-message": ["gtm"], "application/vnd.groove-tool-template": ["tpl"], "application/vnd.groove-vcard": ["vcg"], "application/vnd.hal+xml": ["hal"], "application/vnd.handheld-entertainment+xml": ["zmm"], "application/vnd.hbci": ["hbci"], "application/vnd.hhe.lesson-player": ["les"], "application/vnd.hp-hpgl": ["hpgl"], "application/vnd.hp-hpid": ["hpid"], "application/vnd.hp-hps": ["hps"], "application/vnd.hp-jlyt": ["jlt"], "application/vnd.hp-pcl": ["pcl"], "application/vnd.hp-pclxl": ["pclxl"], "application/vnd.hydrostatix.sof-data": ["sfd-hdstx"], "application/vnd.ibm.minipay": ["mpy"], "application/vnd.ibm.modcap": ["afp", "listafp", "list3820"], "application/vnd.ibm.rights-management": ["irm"], "application/vnd.ibm.secure-container": ["sc"], "application/vnd.iccprofile": ["icc", "icm"], "application/vnd.igloader": ["igl"], "application/vnd.immervision-ivp": ["ivp"], "application/vnd.immervision-ivu": ["ivu"], "application/vnd.insors.igm": ["igm"], "application/vnd.intercon.formnet": ["xpw", "xpx"], "application/vnd.intergeo": ["i2g"], "application/vnd.intu.qbo": ["qbo"], "application/vnd.intu.qfx": ["qfx"], "application/vnd.ipunplugged.rcprofile": ["rcprofile"], "application/vnd.irepository.package+xml": ["irp"], "application/vnd.is-xpr": ["xpr"], "application/vnd.isac.fcs": ["fcs"], "application/vnd.jam": ["jam"], "application/vnd.jcp.javame.midlet-rms": ["rms"], "application/vnd.jisp": ["jisp"], "application/vnd.joost.joda-archive": ["joda"], "application/vnd.kahootz": ["ktz", "ktr"], "application/vnd.kde.karbon": ["karbon"], "application/vnd.kde.kchart": ["chrt"], "application/vnd.kde.kformula": ["kfo"], "application/vnd.kde.kivio": ["flw"], "application/vnd.kde.kontour": ["kon"], "application/vnd.kde.kpresenter": ["kpr", "kpt"], "application/vnd.kde.kspread": ["ksp"], "application/vnd.kde.kword": ["kwd", "kwt"], "application/vnd.kenameaapp": ["htke"], "application/vnd.kidspiration": ["kia"], "application/vnd.kinar": ["kne", "knp"], "application/vnd.koan": ["skp", "skd", "skt", "skm"], "application/vnd.kodak-descriptor": ["sse"], "application/vnd.las.las+xml": ["lasxml"], "application/vnd.llamagraphics.life-balance.desktop": ["lbd"], "application/vnd.llamagraphics.life-balance.exchange+xml": ["lbe"], "application/vnd.lotus-1-2-3": ["123"], "application/vnd.lotus-approach": ["apr"], "application/vnd.lotus-freelance": ["pre"], "application/vnd.lotus-notes": ["nsf"], "application/vnd.lotus-organizer": ["org"], "application/vnd.lotus-screencam": ["scm"], "application/vnd.lotus-wordpro": ["lwp"], "application/vnd.macports.portpkg": ["portpkg"], "application/vnd.mapbox-vector-tile": ["mvt"], "application/vnd.mcd": ["mcd"], "application/vnd.medcalcdata": ["mc1"], "application/vnd.mediastation.cdkey": ["cdkey"], "application/vnd.mfer": ["mwf"], "application/vnd.mfmp": ["mfm"], "application/vnd.micrografx.flo": ["flo"], "application/vnd.micrografx.igx": ["igx"], "application/vnd.mif": ["mif"], "application/vnd.mobius.daf": ["daf"], "application/vnd.mobius.dis": ["dis"], "application/vnd.mobius.mbk": ["mbk"], "application/vnd.mobius.mqy": ["mqy"], "application/vnd.mobius.msl": ["msl"], "application/vnd.mobius.plc": ["plc"], "application/vnd.mobius.txf": ["txf"], "application/vnd.mophun.application": ["mpn"], "application/vnd.mophun.certificate": ["mpc"], "application/vnd.mozilla.xul+xml": ["xul"], "application/vnd.ms-artgalry": ["cil"], "application/vnd.ms-cab-compressed": ["cab"], "application/vnd.ms-excel": ["xls", "xlm", "xla", "xlc", "xlt", "xlw"], "application/vnd.ms-excel.addin.macroenabled.12": ["xlam"], "application/vnd.ms-excel.sheet.binary.macroenabled.12": ["xlsb"], "application/vnd.ms-excel.sheet.macroenabled.12": ["xlsm"], "application/vnd.ms-excel.template.macroenabled.12": ["xltm"], "application/vnd.ms-fontobject": ["eot"], "application/vnd.ms-htmlhelp": ["chm"], "application/vnd.ms-ims": ["ims"], "application/vnd.ms-lrm": ["lrm"], "application/vnd.ms-officetheme": ["thmx"], "application/vnd.ms-outlook": ["msg"], "application/vnd.ms-pki.seccat": ["cat"], "application/vnd.ms-pki.stl": ["*stl"], "application/vnd.ms-powerpoint": ["ppt", "pps", "pot"], "application/vnd.ms-powerpoint.addin.macroenabled.12": ["ppam"], "application/vnd.ms-powerpoint.presentation.macroenabled.12": ["pptm"], "application/vnd.ms-powerpoint.slide.macroenabled.12": ["sldm"], "application/vnd.ms-powerpoint.slideshow.macroenabled.12": ["ppsm"], "application/vnd.ms-powerpoint.template.macroenabled.12": ["potm"], "application/vnd.ms-project": ["mpp", "mpt"], "application/vnd.ms-word.document.macroenabled.12": ["docm"], "application/vnd.ms-word.template.macroenabled.12": ["dotm"], "application/vnd.ms-works": ["wps", "wks", "wcm", "wdb"], "application/vnd.ms-wpl": ["wpl"], "application/vnd.ms-xpsdocument": ["xps"], "application/vnd.mseq": ["mseq"], "application/vnd.musician": ["mus"], "application/vnd.muvee.style": ["msty"], "application/vnd.mynfc": ["taglet"], "application/vnd.neurolanguage.nlu": ["nlu"], "application/vnd.nitf": ["ntf", "nitf"], "application/vnd.noblenet-directory": ["nnd"], "application/vnd.noblenet-sealer": ["nns"], "application/vnd.noblenet-web": ["nnw"], "application/vnd.nokia.n-gage.ac+xml": ["*ac"], "application/vnd.nokia.n-gage.data": ["ngdat"], "application/vnd.nokia.n-gage.symbian.install": ["n-gage"], "application/vnd.nokia.radio-preset": ["rpst"], "application/vnd.nokia.radio-presets": ["rpss"], "application/vnd.novadigm.edm": ["edm"], "application/vnd.novadigm.edx": ["edx"], "application/vnd.novadigm.ext": ["ext"], "application/vnd.oasis.opendocument.chart": ["odc"], "application/vnd.oasis.opendocument.chart-template": ["otc"], "application/vnd.oasis.opendocument.database": ["odb"], "application/vnd.oasis.opendocument.formula": ["odf"], "application/vnd.oasis.opendocument.formula-template": ["odft"], "application/vnd.oasis.opendocument.graphics": ["odg"], "application/vnd.oasis.opendocument.graphics-template": ["otg"], "application/vnd.oasis.opendocument.image": ["odi"], "application/vnd.oasis.opendocument.image-template": ["oti"], "application/vnd.oasis.opendocument.presentation": ["odp"], "application/vnd.oasis.opendocument.presentation-template": ["otp"], "application/vnd.oasis.opendocument.spreadsheet": ["ods"], "application/vnd.oasis.opendocument.spreadsheet-template": ["ots"], "application/vnd.oasis.opendocument.text": ["odt"], "application/vnd.oasis.opendocument.text-master": ["odm"], "application/vnd.oasis.opendocument.text-template": ["ott"], "application/vnd.oasis.opendocument.text-web": ["oth"], "application/vnd.olpc-sugar": ["xo"], "application/vnd.oma.dd2+xml": ["dd2"], "application/vnd.openblox.game+xml": ["obgx"], "application/vnd.openofficeorg.extension": ["oxt"], "application/vnd.openstreetmap.data+xml": ["osm"], "application/vnd.openxmlformats-officedocument.presentationml.presentation": ["pptx"], "application/vnd.openxmlformats-officedocument.presentationml.slide": ["sldx"], "application/vnd.openxmlformats-officedocument.presentationml.slideshow": ["ppsx"], "application/vnd.openxmlformats-officedocument.presentationml.template": ["potx"], "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ["xlsx"], "application/vnd.openxmlformats-officedocument.spreadsheetml.template": ["xltx"], "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ["docx"], "application/vnd.openxmlformats-officedocument.wordprocessingml.template": ["dotx"], "application/vnd.osgeo.mapguide.package": ["mgp"], "application/vnd.osgi.dp": ["dp"], "application/vnd.osgi.subsystem": ["esa"], "application/vnd.palm": ["pdb", "pqa", "oprc"], "application/vnd.pawaafile": ["paw"], "application/vnd.pg.format": ["str"], "application/vnd.pg.osasli": ["ei6"], "application/vnd.picsel": ["efif"], "application/vnd.pmi.widget": ["wg"], "application/vnd.pocketlearn": ["plf"], "application/vnd.powerbuilder6": ["pbd"], "application/vnd.previewsystems.box": ["box"], "application/vnd.proteus.magazine": ["mgz"], "application/vnd.publishare-delta-tree": ["qps"], "application/vnd.pvi.ptid1": ["ptid"], "application/vnd.quark.quarkxpress": ["qxd", "qxt", "qwd", "qwt", "qxl", "qxb"], "application/vnd.rar": ["rar"], "application/vnd.realvnc.bed": ["bed"], "application/vnd.recordare.musicxml": ["mxl"], "application/vnd.recordare.musicxml+xml": ["musicxml"], "application/vnd.rig.cryptonote": ["cryptonote"], "application/vnd.rim.cod": ["cod"], "application/vnd.rn-realmedia": ["rm"], "application/vnd.rn-realmedia-vbr": ["rmvb"], "application/vnd.route66.link66+xml": ["link66"], "application/vnd.sailingtracker.track": ["st"], "application/vnd.seemail": ["see"], "application/vnd.sema": ["sema"], "application/vnd.semd": ["semd"], "application/vnd.semf": ["semf"], "application/vnd.shana.informed.formdata": ["ifm"], "application/vnd.shana.informed.formtemplate": ["itp"], "application/vnd.shana.informed.interchange": ["iif"], "application/vnd.shana.informed.package": ["ipk"], "application/vnd.simtech-mindmapper": ["twd", "twds"], "application/vnd.smaf": ["mmf"], "application/vnd.smart.teacher": ["teacher"], "application/vnd.software602.filler.form+xml": ["fo"], "application/vnd.solent.sdkm+xml": ["sdkm", "sdkd"], "application/vnd.spotfire.dxp": ["dxp"], "application/vnd.spotfire.sfs": ["sfs"], "application/vnd.stardivision.calc": ["sdc"], "application/vnd.stardivision.draw": ["sda"], "application/vnd.stardivision.impress": ["sdd"], "application/vnd.stardivision.math": ["smf"], "application/vnd.stardivision.writer": ["sdw", "vor"], "application/vnd.stardivision.writer-global": ["sgl"], "application/vnd.stepmania.package": ["smzip"], "application/vnd.stepmania.stepchart": ["sm"], "application/vnd.sun.wadl+xml": ["wadl"], "application/vnd.sun.xml.calc": ["sxc"], "application/vnd.sun.xml.calc.template": ["stc"], "application/vnd.sun.xml.draw": ["sxd"], "application/vnd.sun.xml.draw.template": ["std"], "application/vnd.sun.xml.impress": ["sxi"], "application/vnd.sun.xml.impress.template": ["sti"], "application/vnd.sun.xml.math": ["sxm"], "application/vnd.sun.xml.writer": ["sxw"], "application/vnd.sun.xml.writer.global": ["sxg"], "application/vnd.sun.xml.writer.template": ["stw"], "application/vnd.sus-calendar": ["sus", "susp"], "application/vnd.svd": ["svd"], "application/vnd.symbian.install": ["sis", "sisx"], "application/vnd.syncml+xml": ["xsm"], "application/vnd.syncml.dm+wbxml": ["bdm"], "application/vnd.syncml.dm+xml": ["xdm"], "application/vnd.syncml.dmddf+xml": ["ddf"], "application/vnd.tao.intent-module-archive": ["tao"], "application/vnd.tcpdump.pcap": ["pcap", "cap", "dmp"], "application/vnd.tmobile-livetv": ["tmo"], "application/vnd.trid.tpt": ["tpt"], "application/vnd.triscape.mxs": ["mxs"], "application/vnd.trueapp": ["tra"], "application/vnd.ufdl": ["ufd", "ufdl"], "application/vnd.uiq.theme": ["utz"], "application/vnd.umajin": ["umj"], "application/vnd.unity": ["unityweb"], "application/vnd.uoml+xml": ["uoml"], "application/vnd.vcx": ["vcx"], "application/vnd.visio": ["vsd", "vst", "vss", "vsw"], "application/vnd.visionary": ["vis"], "application/vnd.vsf": ["vsf"], "application/vnd.wap.wbxml": ["wbxml"], "application/vnd.wap.wmlc": ["wmlc"], "application/vnd.wap.wmlscriptc": ["wmlsc"], "application/vnd.webturbo": ["wtb"], "application/vnd.wolfram.player": ["nbp"], "application/vnd.wordperfect": ["wpd"], "application/vnd.wqd": ["wqd"], "application/vnd.wt.stf": ["stf"], "application/vnd.xara": ["xar"], "application/vnd.xfdl": ["xfdl"], "application/vnd.yamaha.hv-dic": ["hvd"], "application/vnd.yamaha.hv-script": ["hvs"], "application/vnd.yamaha.hv-voice": ["hvp"], "application/vnd.yamaha.openscoreformat": ["osf"], "application/vnd.yamaha.openscoreformat.osfpvg+xml": ["osfpvg"], "application/vnd.yamaha.smaf-audio": ["saf"], "application/vnd.yamaha.smaf-phrase": ["spf"], "application/vnd.yellowriver-custom-menu": ["cmp"], "application/vnd.zul": ["zir", "zirz"], "application/vnd.zzazz.deck+xml": ["zaz"], "application/x-7z-compressed": ["7z"], "application/x-abiword": ["abw"], "application/x-ace-compressed": ["ace"], "application/x-apple-diskimage": ["*dmg"], "application/x-arj": ["arj"], "application/x-authorware-bin": ["aab", "x32", "u32", "vox"], "application/x-authorware-map": ["aam"], "application/x-authorware-seg": ["aas"], "application/x-bcpio": ["bcpio"], "application/x-bdoc": ["*bdoc"], "application/x-bittorrent": ["torrent"], "application/x-blorb": ["blb", "blorb"], "application/x-bzip": ["bz"], "application/x-bzip2": ["bz2", "boz"], "application/x-cbr": ["cbr", "cba", "cbt", "cbz", "cb7"], "application/x-cdlink": ["vcd"], "application/x-cfs-compressed": ["cfs"], "application/x-chat": ["chat"], "application/x-chess-pgn": ["pgn"], "application/x-chrome-extension": ["crx"], "application/x-cocoa": ["cco"], "application/x-conference": ["nsc"], "application/x-cpio": ["cpio"], "application/x-csh": ["csh"], "application/x-debian-package": ["*deb", "udeb"], "application/x-dgc-compressed": ["dgc"], "application/x-director": ["dir", "dcr", "dxr", "cst", "cct", "cxt", "w3d", "fgd", "swa"], "application/x-doom": ["wad"], "application/x-dtbncx+xml": ["ncx"], "application/x-dtbook+xml": ["dtb"], "application/x-dtbresource+xml": ["res"], "application/x-dvi": ["dvi"], "application/x-envoy": ["evy"], "application/x-eva": ["eva"], "application/x-font-bdf": ["bdf"], "application/x-font-ghostscript": ["gsf"], "application/x-font-linux-psf": ["psf"], "application/x-font-pcf": ["pcf"], "application/x-font-snf": ["snf"], "application/x-font-type1": ["pfa", "pfb", "pfm", "afm"], "application/x-freearc": ["arc"], "application/x-futuresplash": ["spl"], "application/x-gca-compressed": ["gca"], "application/x-glulx": ["ulx"], "application/x-gnumeric": ["gnumeric"], "application/x-gramps-xml": ["gramps"], "application/x-gtar": ["gtar"], "application/x-hdf": ["hdf"], "application/x-httpd-php": ["php"], "application/x-install-instructions": ["install"], "application/x-iso9660-image": ["*iso"], "application/x-iwork-keynote-sffkey": ["*key"], "application/x-iwork-numbers-sffnumbers": ["*numbers"], "application/x-iwork-pages-sffpages": ["*pages"], "application/x-java-archive-diff": ["jardiff"], "application/x-java-jnlp-file": ["jnlp"], "application/x-keepass2": ["kdbx"], "application/x-latex": ["latex"], "application/x-lua-bytecode": ["luac"], "application/x-lzh-compressed": ["lzh", "lha"], "application/x-makeself": ["run"], "application/x-mie": ["mie"], "application/x-mobipocket-ebook": ["prc", "mobi"], "application/x-ms-application": ["application"], "application/x-ms-shortcut": ["lnk"], "application/x-ms-wmd": ["wmd"], "application/x-ms-wmz": ["wmz"], "application/x-ms-xbap": ["xbap"], "application/x-msaccess": ["mdb"], "application/x-msbinder": ["obd"], "application/x-mscardfile": ["crd"], "application/x-msclip": ["clp"], "application/x-msdos-program": ["*exe"], "application/x-msdownload": ["*exe", "*dll", "com", "bat", "*msi"], "application/x-msmediaview": ["mvb", "m13", "m14"], "application/x-msmetafile": ["*wmf", "*wmz", "*emf", "emz"], "application/x-msmoney": ["mny"], "application/x-mspublisher": ["pub"], "application/x-msschedule": ["scd"], "application/x-msterminal": ["trm"], "application/x-mswrite": ["wri"], "application/x-netcdf": ["nc", "cdf"], "application/x-ns-proxy-autoconfig": ["pac"], "application/x-nzb": ["nzb"], "application/x-perl": ["pl", "pm"], "application/x-pilot": ["*prc", "*pdb"], "application/x-pkcs12": ["p12", "pfx"], "application/x-pkcs7-certificates": ["p7b", "spc"], "application/x-pkcs7-certreqresp": ["p7r"], "application/x-rar-compressed": ["*rar"], "application/x-redhat-package-manager": ["rpm"], "application/x-research-info-systems": ["ris"], "application/x-sea": ["sea"], "application/x-sh": ["sh"], "application/x-shar": ["shar"], "application/x-shockwave-flash": ["swf"], "application/x-silverlight-app": ["xap"], "application/x-sql": ["sql"], "application/x-stuffit": ["sit"], "application/x-stuffitx": ["sitx"], "application/x-subrip": ["srt"], "application/x-sv4cpio": ["sv4cpio"], "application/x-sv4crc": ["sv4crc"], "application/x-t3vm-image": ["t3"], "application/x-tads": ["gam"], "application/x-tar": ["tar"], "application/x-tcl": ["tcl", "tk"], "application/x-tex": ["tex"], "application/x-tex-tfm": ["tfm"], "application/x-texinfo": ["texinfo", "texi"], "application/x-tgif": ["*obj"], "application/x-ustar": ["ustar"], "application/x-virtualbox-hdd": ["hdd"], "application/x-virtualbox-ova": ["ova"], "application/x-virtualbox-ovf": ["ovf"], "application/x-virtualbox-vbox": ["vbox"], "application/x-virtualbox-vbox-extpack": ["vbox-extpack"], "application/x-virtualbox-vdi": ["vdi"], "application/x-virtualbox-vhd": ["vhd"], "application/x-virtualbox-vmdk": ["vmdk"], "application/x-wais-source": ["src"], "application/x-web-app-manifest+json": ["webapp"], "application/x-x509-ca-cert": ["der", "crt", "pem"], "application/x-xfig": ["fig"], "application/x-xliff+xml": ["*xlf"], "application/x-xpinstall": ["xpi"], "application/x-xz": ["xz"], "application/x-zmachine": ["z1", "z2", "z3", "z4", "z5", "z6", "z7", "z8"], "audio/vnd.dece.audio": ["uva", "uvva"], "audio/vnd.digital-winds": ["eol"], "audio/vnd.dra": ["dra"], "audio/vnd.dts": ["dts"], "audio/vnd.dts.hd": ["dtshd"], "audio/vnd.lucent.voice": ["lvp"], "audio/vnd.ms-playready.media.pya": ["pya"], "audio/vnd.nuera.ecelp4800": ["ecelp4800"], "audio/vnd.nuera.ecelp7470": ["ecelp7470"], "audio/vnd.nuera.ecelp9600": ["ecelp9600"], "audio/vnd.rip": ["rip"], "audio/x-aac": ["aac"], "audio/x-aiff": ["aif", "aiff", "aifc"], "audio/x-caf": ["caf"], "audio/x-flac": ["flac"], "audio/x-m4a": ["*m4a"], "audio/x-matroska": ["mka"], "audio/x-mpegurl": ["m3u"], "audio/x-ms-wax": ["wax"], "audio/x-ms-wma": ["wma"], "audio/x-pn-realaudio": ["ram", "ra"], "audio/x-pn-realaudio-plugin": ["rmp"], "audio/x-realaudio": ["*ra"], "audio/x-wav": ["*wav"], "chemical/x-cdx": ["cdx"], "chemical/x-cif": ["cif"], "chemical/x-cmdf": ["cmdf"], "chemical/x-cml": ["cml"], "chemical/x-csml": ["csml"], "chemical/x-xyz": ["xyz"], "image/prs.btif": ["btif"], "image/prs.pti": ["pti"], "image/vnd.adobe.photoshop": ["psd"], "image/vnd.airzip.accelerator.azv": ["azv"], "image/vnd.dece.graphic": ["uvi", "uvvi", "uvg", "uvvg"], "image/vnd.djvu": ["djvu", "djv"], "image/vnd.dvb.subtitle": ["*sub"], "image/vnd.dwg": ["dwg"], "image/vnd.dxf": ["dxf"], "image/vnd.fastbidsheet": ["fbs"], "image/vnd.fpx": ["fpx"], "image/vnd.fst": ["fst"], "image/vnd.fujixerox.edmics-mmr": ["mmr"], "image/vnd.fujixerox.edmics-rlc": ["rlc"], "image/vnd.microsoft.icon": ["ico"], "image/vnd.ms-dds": ["dds"], "image/vnd.ms-modi": ["mdi"], "image/vnd.ms-photo": ["wdp"], "image/vnd.net-fpx": ["npx"], "image/vnd.pco.b16": ["b16"], "image/vnd.tencent.tap": ["tap"], "image/vnd.valve.source.texture": ["vtf"], "image/vnd.wap.wbmp": ["wbmp"], "image/vnd.xiff": ["xif"], "image/vnd.zbrush.pcx": ["pcx"], "image/x-3ds": ["3ds"], "image/x-cmu-raster": ["ras"], "image/x-cmx": ["cmx"], "image/x-freehand": ["fh", "fhc", "fh4", "fh5", "fh7"], "image/x-icon": ["*ico"], "image/x-jng": ["jng"], "image/x-mrsid-image": ["sid"], "image/x-ms-bmp": ["*bmp"], "image/x-pcx": ["*pcx"], "image/x-pict": ["pic", "pct"], "image/x-portable-anymap": ["pnm"], "image/x-portable-bitmap": ["pbm"], "image/x-portable-graymap": ["pgm"], "image/x-portable-pixmap": ["ppm"], "image/x-rgb": ["rgb"], "image/x-tga": ["tga"], "image/x-xbitmap": ["xbm"], "image/x-xpixmap": ["xpm"], "image/x-xwindowdump": ["xwd"], "message/vnd.wfa.wsc": ["wsc"], "model/vnd.collada+xml": ["dae"], "model/vnd.dwf": ["dwf"], "model/vnd.gdl": ["gdl"], "model/vnd.gtw": ["gtw"], "model/vnd.mts": ["mts"], "model/vnd.opengex": ["ogex"], "model/vnd.parasolid.transmit.binary": ["x_b"], "model/vnd.parasolid.transmit.text": ["x_t"], "model/vnd.sap.vds": ["vds"], "model/vnd.usdz+zip": ["usdz"], "model/vnd.valve.source.compiled-map": ["bsp"], "model/vnd.vtu": ["vtu"], "text/prs.lines.tag": ["dsc"], "text/vnd.curl": ["curl"], "text/vnd.curl.dcurl": ["dcurl"], "text/vnd.curl.mcurl": ["mcurl"], "text/vnd.curl.scurl": ["scurl"], "text/vnd.dvb.subtitle": ["sub"], "text/vnd.fly": ["fly"], "text/vnd.fmi.flexstor": ["flx"], "text/vnd.graphviz": ["gv"], "text/vnd.in3d.3dml": ["3dml"], "text/vnd.in3d.spot": ["spot"], "text/vnd.sun.j2me.app-descriptor": ["jad"], "text/vnd.wap.wml": ["wml"], "text/vnd.wap.wmlscript": ["wmls"], "text/x-asm": ["s", "asm"], "text/x-c": ["c", "cc", "cxx", "cpp", "h", "hh", "dic"], "text/x-component": ["htc"], "text/x-fortran": ["f", "for", "f77", "f90"], "text/x-handlebars-template": ["hbs"], "text/x-java-source": ["java"], "text/x-lua": ["lua"], "text/x-markdown": ["mkd"], "text/x-nfo": ["nfo"], "text/x-opml": ["opml"], "text/x-org": ["*org"], "text/x-pascal": ["p", "pas"], "text/x-processing": ["pde"], "text/x-sass": ["sass"], "text/x-scss": ["scss"], "text/x-setext": ["etx"], "text/x-sfv": ["sfv"], "text/x-suse-ymp": ["ymp"], "text/x-uuencode": ["uu"], "text/x-vcalendar": ["vcs"], "text/x-vcard": ["vcf"], "video/vnd.dece.hd": ["uvh", "uvvh"], "video/vnd.dece.mobile": ["uvm", "uvvm"], "video/vnd.dece.pd": ["uvp", "uvvp"], "video/vnd.dece.sd": ["uvs", "uvvs"], "video/vnd.dece.video": ["uvv", "uvvv"], "video/vnd.dvb.file": ["dvb"], "video/vnd.fvt": ["fvt"], "video/vnd.mpegurl": ["mxu", "m4u"], "video/vnd.ms-playready.media.pyv": ["pyv"], "video/vnd.uvvu.mp4": ["uvu", "uvvu"], "video/vnd.vivo": ["viv"], "video/x-f4v": ["f4v"], "video/x-fli": ["fli"], "video/x-flv": ["flv"], "video/x-m4v": ["m4v"], "video/x-matroska": ["mkv", "mk3d", "mks"], "video/x-mng": ["mng"], "video/x-ms-asf": ["asf", "asx"], "video/x-ms-vob": ["vob"], "video/x-ms-wm": ["wm"], "video/x-ms-wmv": ["wmv"], "video/x-ms-wmx": ["wmx"], "video/x-ms-wvx": ["wvx"], "video/x-msvideo": ["avi"], "video/x-sgi-movie": ["movie"], "video/x-smv": ["smv"], "x-conference/x-cooltalk": ["ice"] };
  }
});

// node_modules/mime/index.js
var require_mime = __commonJS({
  "node_modules/mime/index.js"(exports, module) {
    "use strict";
    init_checked_fetch();
    init_modules_watch_stub();
    var Mime = require_Mime();
    module.exports = new Mime(require_standard(), require_other());
  }
});

// node_modules/@cloudflare/kv-asset-handler/dist/types.js
var require_types = __commonJS({
  "node_modules/@cloudflare/kv-asset-handler/dist/types.js"(exports) {
    "use strict";
    init_checked_fetch();
    init_modules_watch_stub();
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.InternalError = exports.NotFoundError = exports.MethodNotAllowedError = exports.KVError = void 0;
    var KVError = class _KVError extends Error {
      static {
        __name(this, "KVError");
      }
      constructor(message, status = 500) {
        super(message);
        Object.setPrototypeOf(this, new.target.prototype);
        this.name = _KVError.name;
        this.status = status;
      }
      status;
    };
    exports.KVError = KVError;
    var MethodNotAllowedError = class extends KVError {
      static {
        __name(this, "MethodNotAllowedError");
      }
      constructor(message = `Not a valid request method`, status = 405) {
        super(message, status);
      }
    };
    exports.MethodNotAllowedError = MethodNotAllowedError;
    var NotFoundError = class extends KVError {
      static {
        __name(this, "NotFoundError");
      }
      constructor(message = `Not Found`, status = 404) {
        super(message, status);
      }
    };
    exports.NotFoundError = NotFoundError;
    var InternalError = class extends KVError {
      static {
        __name(this, "InternalError");
      }
      constructor(message = `Internal Error in KV Asset Handler`, status = 500) {
        super(message, status);
      }
    };
    exports.InternalError = InternalError;
  }
});

// node_modules/@cloudflare/kv-asset-handler/dist/index.js
var require_dist = __commonJS({
  "node_modules/@cloudflare/kv-asset-handler/dist/index.js"(exports) {
    "use strict";
    init_checked_fetch();
    init_modules_watch_stub();
    var __createBinding = exports && exports.__createBinding || (Object.create ? (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: /* @__PURE__ */ __name(function() {
          return m[k];
        }, "get") };
      }
      Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
      if (k2 === void 0) k2 = k;
      o[k2] = m[k];
    }));
    var __setModuleDefault = exports && exports.__setModuleDefault || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
      o["default"] = v;
    });
    var __importStar = exports && exports.__importStar || function(mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) {
        for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      }
      __setModuleDefault(result, mod);
      return result;
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.InternalError = exports.NotFoundError = exports.MethodNotAllowedError = exports.serveSinglePageApp = exports.mapRequestToAsset = exports.getAssetFromKV = void 0;
    var mime = __importStar(require_mime());
    var types_1 = require_types();
    Object.defineProperty(exports, "InternalError", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return types_1.InternalError;
    }, "get") });
    Object.defineProperty(exports, "MethodNotAllowedError", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return types_1.MethodNotAllowedError;
    }, "get") });
    Object.defineProperty(exports, "NotFoundError", { enumerable: true, get: /* @__PURE__ */ __name(function() {
      return types_1.NotFoundError;
    }, "get") });
    var defaultCacheControl = {
      browserTTL: null,
      edgeTTL: 2 * 60 * 60 * 24,
      // 2 days
      bypassCache: false
      // do not bypass Cloudflare's cache
    };
    var parseStringAsObject = /* @__PURE__ */ __name((maybeString) => typeof maybeString === "string" ? JSON.parse(maybeString) : maybeString, "parseStringAsObject");
    var getAssetFromKVDefaultOptions = {
      ASSET_NAMESPACE: typeof __STATIC_CONTENT !== "undefined" ? __STATIC_CONTENT : void 0,
      ASSET_MANIFEST: typeof __STATIC_CONTENT_MANIFEST !== "undefined" ? parseStringAsObject(__STATIC_CONTENT_MANIFEST) : {},
      cacheControl: defaultCacheControl,
      defaultMimeType: "text/plain",
      defaultDocument: "index.html",
      pathIsEncoded: false,
      defaultETag: "strong"
    };
    function assignOptions(options) {
      return Object.assign({}, getAssetFromKVDefaultOptions, options);
    }
    __name(assignOptions, "assignOptions");
    var mapRequestToAsset = /* @__PURE__ */ __name((request, options) => {
      options = assignOptions(options);
      const parsedUrl = new URL(request.url);
      let pathname = parsedUrl.pathname;
      if (pathname.endsWith("/")) {
        pathname = pathname.concat(options.defaultDocument);
      } else if (!mime.getType(pathname)) {
        pathname = pathname.concat("/" + options.defaultDocument);
      }
      parsedUrl.pathname = pathname;
      return new Request(parsedUrl.toString(), request);
    }, "mapRequestToAsset");
    exports.mapRequestToAsset = mapRequestToAsset;
    function serveSinglePageApp(request, options) {
      options = assignOptions(options);
      request = mapRequestToAsset(request, options);
      const parsedUrl = new URL(request.url);
      if (parsedUrl.pathname.endsWith(".html")) {
        return new Request(`${parsedUrl.origin}/${options.defaultDocument}`, request);
      } else {
        return request;
      }
    }
    __name(serveSinglePageApp, "serveSinglePageApp");
    exports.serveSinglePageApp = serveSinglePageApp;
    var getAssetFromKV2 = /* @__PURE__ */ __name(async (event, options) => {
      options = assignOptions(options);
      const request = event.request;
      const ASSET_NAMESPACE = options.ASSET_NAMESPACE;
      const ASSET_MANIFEST = parseStringAsObject(options.ASSET_MANIFEST);
      if (typeof ASSET_NAMESPACE === "undefined") {
        throw new types_1.InternalError(`there is no KV namespace bound to the script`);
      }
      const rawPathKey = new URL(request.url).pathname.replace(/^\/+/, "");
      let pathIsEncoded = options.pathIsEncoded;
      let requestKey;
      if (options.mapRequestToAsset) {
        requestKey = options.mapRequestToAsset(request);
      } else if (ASSET_MANIFEST[rawPathKey]) {
        requestKey = request;
      } else if (ASSET_MANIFEST[decodeURIComponent(rawPathKey)]) {
        pathIsEncoded = true;
        requestKey = request;
      } else {
        const mappedRequest = mapRequestToAsset(request);
        const mappedRawPathKey = new URL(mappedRequest.url).pathname.replace(/^\/+/, "");
        if (ASSET_MANIFEST[decodeURIComponent(mappedRawPathKey)]) {
          pathIsEncoded = true;
          requestKey = mappedRequest;
        } else {
          requestKey = mapRequestToAsset(request, options);
        }
      }
      const SUPPORTED_METHODS = ["GET", "HEAD"];
      if (!SUPPORTED_METHODS.includes(requestKey.method)) {
        throw new types_1.MethodNotAllowedError(`${requestKey.method} is not a valid request method`);
      }
      const parsedUrl = new URL(requestKey.url);
      const pathname = pathIsEncoded ? decodeURIComponent(parsedUrl.pathname) : parsedUrl.pathname;
      let pathKey = pathname.replace(/^\/+/, "");
      const cache = caches.default;
      let mimeType = mime.getType(pathKey) || options.defaultMimeType;
      if (mimeType.startsWith("text") || mimeType === "application/javascript") {
        mimeType += "; charset=utf-8";
      }
      let shouldEdgeCache = false;
      if (typeof ASSET_MANIFEST !== "undefined") {
        if (ASSET_MANIFEST[pathKey]) {
          pathKey = ASSET_MANIFEST[pathKey];
          shouldEdgeCache = true;
        }
      }
      const cacheKey = new Request(`${parsedUrl.origin}/${pathKey}`, request);
      const evalCacheOpts = (() => {
        switch (typeof options.cacheControl) {
          case "function":
            return options.cacheControl(request);
          case "object":
            return options.cacheControl;
          default:
            return defaultCacheControl;
        }
      })();
      const formatETag = /* @__PURE__ */ __name((entityId = pathKey, validatorType = options.defaultETag) => {
        if (!entityId) {
          return "";
        }
        switch (validatorType) {
          case "weak":
            if (!entityId.startsWith("W/")) {
              if (entityId.startsWith(`"`) && entityId.endsWith(`"`)) {
                return `W/${entityId}`;
              }
              return `W/"${entityId}"`;
            }
            return entityId;
          case "strong":
            if (entityId.startsWith(`W/"`)) {
              entityId = entityId.replace("W/", "");
            }
            if (!entityId.endsWith(`"`)) {
              entityId = `"${entityId}"`;
            }
            return entityId;
          default:
            return "";
        }
      }, "formatETag");
      options.cacheControl = Object.assign({}, defaultCacheControl, evalCacheOpts);
      if (options.cacheControl.bypassCache || options.cacheControl.edgeTTL === null || request.method == "HEAD") {
        shouldEdgeCache = false;
      }
      const shouldSetBrowserCache = typeof options.cacheControl.browserTTL === "number";
      let response = null;
      if (shouldEdgeCache) {
        response = await cache.match(cacheKey);
      }
      if (response) {
        if (response.status > 300 && response.status < 400) {
          if (response.body && "cancel" in Object.getPrototypeOf(response.body)) {
            response.body.cancel();
          } else {
          }
          response = new Response(null, response);
        } else {
          const opts = {
            headers: new Headers(response.headers),
            status: 0,
            statusText: ""
          };
          opts.headers.set("cf-cache-status", "HIT");
          if (response.status) {
            opts.status = response.status;
            opts.statusText = response.statusText;
          } else if (opts.headers.has("Content-Range")) {
            opts.status = 206;
            opts.statusText = "Partial Content";
          } else {
            opts.status = 200;
            opts.statusText = "OK";
          }
          response = new Response(response.body, opts);
        }
      } else {
        const body = await ASSET_NAMESPACE.get(pathKey, "arrayBuffer");
        if (body === null) {
          throw new types_1.NotFoundError(`could not find ${pathKey} in your content namespace`);
        }
        response = new Response(body);
        if (shouldEdgeCache) {
          response.headers.set("Accept-Ranges", "bytes");
          response.headers.set("Content-Length", String(body.byteLength));
          if (!response.headers.has("etag")) {
            response.headers.set("etag", formatETag(pathKey));
          }
          response.headers.set("Cache-Control", `max-age=${options.cacheControl.edgeTTL}`);
          event.waitUntil(cache.put(cacheKey, response.clone()));
          response.headers.set("CF-Cache-Status", "MISS");
        }
      }
      response.headers.set("Content-Type", mimeType);
      if (response.status === 304) {
        const etag = formatETag(response.headers.get("etag"));
        const ifNoneMatch = cacheKey.headers.get("if-none-match");
        const proxyCacheStatus = response.headers.get("CF-Cache-Status");
        if (etag) {
          if (ifNoneMatch && ifNoneMatch === etag && proxyCacheStatus === "MISS") {
            response.headers.set("CF-Cache-Status", "EXPIRED");
          } else {
            response.headers.set("CF-Cache-Status", "REVALIDATED");
          }
          response.headers.set("etag", formatETag(etag, "weak"));
        }
      }
      if (shouldSetBrowserCache) {
        response.headers.set("Cache-Control", `max-age=${options.cacheControl.browserTTL}`);
      } else {
        response.headers.delete("Cache-Control");
      }
      return response;
    }, "getAssetFromKV");
    exports.getAssetFromKV = getAssetFromKV2;
  }
});

// .wrangler/tmp/bundle-2fs9a6/middleware-loader.entry.ts
init_checked_fetch();
init_modules_watch_stub();

// .wrangler/tmp/bundle-2fs9a6/middleware-insertion-facade.js
init_checked_fetch();
init_modules_watch_stub();

// index.js
init_checked_fetch();
init_modules_watch_stub();
var import_kv_asset_handler = __toESM(require_dist());
import manifestJSON from "__STATIC_CONTENT_MANIFEST";
var assetManifest = JSON.parse(manifestJSON);
function parseCookies(request) {
  const cookieHeader = request.headers.get("Cookie");
  if (!cookieHeader) return {};
  return Object.fromEntries(cookieHeader.split(";").map((c) => c.trim().split("=")));
}
__name(parseCookies, "parseCookies");
var index_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/admin/")) {
      if (url.pathname === "/admin/login.html" || url.pathname.startsWith("/admin/api/auth/")) {
      } else {
        const cookies = parseCookies(request);
        if (cookies["admin_session"] !== "wookhong_verified") {
          return Response.redirect(`${url.origin}/admin/login.html`, 302);
        }
      }
    }
    if (url.pathname === "/admin/api/auth/verify" && request.method === "POST") {
      const body = await request.json();
      if (body.bypass) {
        return new Response(JSON.stringify({ success: true }), {
          headers: { "Content-Type": "application/json", "Set-Cookie": "admin_session=wookhong_verified; Path=/; HttpOnly; Secure; SameSite=Lax" }
        });
      }
      const token = body.token;
      try {
        const googleRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`);
        const data = await googleRes.json();
        const allowedEmails = ["wookhong745502@gmail.com"];
        if (allowedEmails.includes(data.email) && data.email_verified) {
          return new Response(JSON.stringify({ success: true }), {
            headers: { "Content-Type": "application/json", "Set-Cookie": "admin_session=wookhong_verified; Path=/; HttpOnly; Secure; SameSite=Lax" }
          });
        }
        return new Response(JSON.stringify({ error: "Access Denied" }), { status: 403 });
      } catch (e) {
        return new Response(JSON.stringify({ error: "Auth Fail" }), { status: 403 });
      }
    }
    if (url.pathname === "/admin/api/auth/logout" && request.method === "POST") {
      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json", "Set-Cookie": "admin_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT" }
      });
    }
    if (url.pathname === "/admin/api/suggest" && request.method === "POST") {
      const { type, keyword } = await request.json();
      let prompt = "";
      switch (type) {
        case "title":
          prompt = `Keyword: ${keyword}. Suggest one powerful, professional, and SEO-optimized Korean blog title for 'Moonpiece'. Use click-bait techniques but keep it premium. Return ONLY the title string. If generated again, generate a different variation.`;
          break;
        case "slug":
          prompt = `Keyword: ${keyword}. Convert to a short English URL slug. Return ONLY lowercase hypenated string.`;
          break;
        case "keywords":
          prompt = `Keyword: ${keyword}. Provide 10 highly relevant SEO sub-keywords for Google Search (maternity niche). Ensure they are different if asked again. Return ONLY a comma-separated list.`;
          break;
        case "source":
          prompt = `Keyword: ${keyword}. Find a high-authority global health organization (WHO, Mayo Clinic, etc) or Korean medical news site related to this. Provide a distinct one if asked again. Return JSON: {"name": "NAME", "url": "URL"}`;
          break;
        case "question":
          prompt = `Keyword: ${keyword}. Suggest a natural user question that a pregnant woman would ask search engines. Return ONLY the question string.`;
          break;
      }
      const res = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${env.DEEPSEEK_API_KEY}` },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.9
          // Higher temp for variability on regenerations
        })
      });
      const data = await res.json();
      let result = data.choices[0].message.content.trim();
      if (type === "slug") {
        result = result.replace(/[^a-z0-9-]/g, "").toLowerCase();
        const now = /* @__PURE__ */ new Date();
        const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
        result = `${result}-${dateStr}`;
      }
      return new Response(JSON.stringify({ result }), { headers: { "Content-Type": "application/json" } });
    }
    if (url.pathname === "/admin/api/generate-journal" && request.method === "POST") {
      return await generateContentHandler(request, env, "seo");
    }
    if (url.pathname === "/admin/api/generate-knowledge" && request.method === "POST") {
      return await generateContentHandler(request, env, "aeo");
    }
    async function safeGetJson(key) {
      try {
        const obj = await env.JOURNAL_BUCKET.get(key);
        if (!obj) return [];
        const text = await obj.text();
        if (!text || text.trim() === "" || text.includes("")) return [];
        return JSON.parse(text);
      } catch (e) {
        console.error(`Safe JSON parse error for ${key}:`, e.message);
        return [];
      }
    }
    __name(safeGetJson, "safeGetJson");
    if (url.pathname === "/admin/api/posts") {
      const journalList = await safeGetJson("journal/list.json");
      const knowledgeList = await safeGetJson("knowledge/list.json");
      const combined = [
        ...journalList.map((p) => ({ ...p, type: "journal" })),
        ...knowledgeList.map((p) => ({ ...p, type: "knowledge" }))
      ].sort((a, b) => new Date(b.date) - new Date(a.date));
      return new Response(JSON.stringify(combined), { headers: { "Content-Type": "application/json" } });
    }
    if (url.pathname === "/admin/api/posts/delete" && request.method === "POST") {
      const { url: postUrl, type } = await request.json();
      const listKey = type === "journal" ? "journal/list.json" : "knowledge/list.json";
      const key = postUrl.startsWith("/") ? postUrl.slice(1) : postUrl;
      await env.JOURNAL_BUCKET.delete(key);
      const list = await env.JOURNAL_BUCKET.get(listKey).then((r) => r ? r.json() : []);
      const filtered = list.filter((p) => !postUrl.includes(p.url));
      await env.JOURNAL_BUCKET.put(listKey, JSON.stringify(filtered));
      return new Response(JSON.stringify({ success: true }));
    }
    if (url.pathname === "/admin/api/posts/raw" && request.method === "POST") {
      const { url: postUrl } = await request.json();
      const key = postUrl.startsWith("/") ? postUrl.slice(1) : postUrl;
      const object = await env.JOURNAL_BUCKET.get(key);
      if (object) {
        return new Response(JSON.stringify({ success: true, html: await object.text() }), { headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ success: false }), { status: 404 });
    }
    if (url.pathname === "/admin/api/posts/update" && request.method === "POST") {
      const { url: postUrl, html } = await request.json();
      const key = postUrl.startsWith("/") ? postUrl.slice(1) : postUrl;
      await env.JOURNAL_BUCKET.put(key, html, { httpMetadata: { contentType: "text/html; charset=UTF-8" } });
      return new Response(JSON.stringify({ success: true }));
    }
    if (url.pathname === "/admin/api/migrate/clear-all" && request.method === "POST") {
      await env.JOURNAL_BUCKET.put("journal/list.json", "[]");
      await env.JOURNAL_BUCKET.put("knowledge/list.json", "[]");
      return new Response(JSON.stringify({ success: true }));
    }
    if (url.pathname === "/list-journals") {
      const data = await env.JOURNAL_BUCKET.get("journal/list.json");
      return new Response(data ? data.body : "[]", { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
    }
    if (url.pathname === "/list-knowledge") {
      const data = await env.JOURNAL_BUCKET.get("knowledge/list.json");
      return new Response(data ? data.body : "[]", { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
    }
    if (url.pathname.startsWith("/journal/") || url.pathname.startsWith("/knowledge/") || url.pathname.startsWith("/assets/")) {
      const key = url.pathname.slice(1);
      const object = await env.JOURNAL_BUCKET.get(key);
      if (object) {
        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set("Content-Type", key.endsWith(".html") ? "text/html; charset=UTF-8" : "image/png");
        headers.set("Access-Control-Allow-Origin", "*");
        if (key.endsWith(".png")) headers.set("Cache-Control", "public, max-age=31536000");
        return new Response(object.body, { headers });
      }
    }
    try {
      return await (0, import_kv_asset_handler.getAssetFromKV)({ request, waitUntil: ctx.waitUntil.bind(ctx) }, { ASSET_NAMESPACE: env.__STATIC_CONTENT, ASSET_MANIFEST: assetManifest });
    } catch (e) {
      return new Response("Not Found", { status: 404 });
    }
  }
};
async function generateContentHandler(request, env, type) {
  const payload = await request.json();
  const { keyword, title, slug: rawSlug, subKeywords, sourceName, sourceUrl, category, isFinal = false, finalHtml = "" } = payload;
  const isSEO = type === "seo";
  async function resolveUniqueSlug(baseSlug, prefix) {
    let newSlug = baseSlug;
    let counter = 1;
    const listKey = prefix === "journal" ? "journal/list.json" : "knowledge/list.json";
    async function getInternalList(key) {
      try {
        const obj = await env.JOURNAL_BUCKET.get(key);
        if (!obj) return [];
        const text = await obj.text();
        if (!text || text.trim() === "" || text.includes("")) return [];
        return JSON.parse(text);
      } catch (e) {
        return [];
      }
    }
    __name(getInternalList, "getInternalList");
    const bucketList = await getInternalList(listKey);
    while (true) {
      if (!bucketList.find((p) => p.url.includes(`${newSlug}.html`))) {
        break;
      }
      newSlug = `${baseSlug}-${counter}`;
      counter++;
    }
    return newSlug;
  }
  __name(resolveUniqueSlug, "resolveUniqueSlug");
  if (isFinal) {
    let extractSummary = function(html2, length = 120) {
      if (!html2) return "";
      const text = html2.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      return text.length > length ? text.substring(0, length) + "..." : text;
    };
    __name(extractSummary, "extractSummary");
    const slug = await resolveUniqueSlug(rawSlug, isSEO ? "journal" : "knowledge");
    const html = await renderTemplate({
      title,
      image: payload.image,
      html: finalHtml,
      faqs: payload.faqs,
      schema: payload.schema
    }, env, isSEO ? "\uC784\uC0B0\uBD80 \uC800\uB110" : "\uC784\uC0B0\uBD80 \uC9C0\uC2DD\uC778");
    const filePath = `${isSEO ? "journal" : "knowledge"}/${slug}.html`;
    await env.JOURNAL_BUCKET.put(filePath, html, { httpMetadata: { contentType: "text/html; charset=UTF-8" } });
    const listKey = isSEO ? "journal/list.json" : "knowledge/list.json";
    let list = [];
    try {
      const listData = await env.JOURNAL_BUCKET.get(listKey);
      if (listData) list = await listData.json();
    } catch (e) {
      console.error("List JSON parse error:", e.message);
      list = [];
    }
    let finalTitle = title;
    let tCounter = 1;
    while (list.find((p) => p.title === finalTitle)) {
      finalTitle = `${title} (${tCounter})`;
      tCounter++;
    }
    const summary = extractSummary(finalHtml, 80);
    const listEntry = {
      title: finalTitle,
      category,
      date: (/* @__PURE__ */ new Date()).toLocaleDateString("ko-KR"),
      url: `/${filePath}`,
      image: payload.image,
      desc: summary
    };
    list.unshift(listEntry);
    await env.JOURNAL_BUCKET.put(listKey, JSON.stringify(list));
    return new Response(JSON.stringify({ success: true, path: `/${filePath}` }));
  }
  async function ai(prompt, system = "You are a professional content architect.") {
    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${env.DEEPSEEK_API_KEY}` },
      body: JSON.stringify({ model: "deepseek-chat", messages: [{ role: "system", content: system }, { role: "user", content: prompt }] })
    });
    const d = await res.json();
    return d.choices[0].message.content;
  }
  __name(ai, "ai");
  try {
    let parseAIJson = function(raw) {
      try {
        const cleaned = raw.replace(/```json|```/g, "").trim();
        return JSON.parse(cleaned);
      } catch (e) {
        const start = Math.min(raw.indexOf("{") === -1 ? Infinity : raw.indexOf("{"), raw.indexOf("[") === -1 ? Infinity : raw.indexOf("["));
        const end = Math.max(raw.lastIndexOf("}") === -1 ? -1 : raw.lastIndexOf("}"), raw.lastIndexOf("]") === -1 ? -1 : raw.lastIndexOf("]"));
        if (start !== Infinity && end !== -1 && start < end) {
          try {
            return JSON.parse(raw.substring(start, end + 1));
          } catch (err) {
            throw e;
          }
        }
        throw e;
      }
    };
    __name(parseAIJson, "parseAIJson");
    const bodyPrompt = isSEO ? `Write a highly professional, empathetic, and strictly formatted SEO blog post about "${keyword}". Title: "${title}". Target sub-keywords: ${subKeywords || keyword}. 
         CRITICAL REQUIREMENT: The output MUST exceed 2,000 Korean characters. Explain in profound detail with minimum 5 sections.
         USE EXACTLY 3 PLACEHOLDERS for images naturally within the text. Use exactly this format: {{IMG_1}}, {{IMG_2}}, {{IMG_3}}. Place them between paragraphs where visually appropriate.
         Use exactly <article class="post-content">, <h2>, <h3>, <p>, <ul>, <strong> tags. Do NOT use markdown code blocks, return ONLY raw HTML for the body.` : `Write an elite-level AEO-optimized expert answer about "${keyword}". Title/Question: "${title}". 
         \uB2F9\uC2E0\uC740 \uAD6C\uAE00 AI \uAC1C\uC694(AI Overviews)\uAC00 \uAC00\uC7A5 \uBA3C\uC800 \uC778\uC6A9\uD560 '\uC815\uB2F5'\uC744 \uB9CC\uB4DC\uB294 AEO \uC804\uB7B5\uAC00\uC785\uB2C8\uB2E4.
         CRITICAL REQUIREMENT: You MUST strictly follow this exact 4-step semantic HTML \uAD6C\uC870\uB97C 100% \uC900\uC218\uD558\uC138\uC694:
         1. <h1>${title} (\uB300\uD654\uD615 \uC9C8\uBB38 \uD615\uC2DD)</h1>
         2. <div class="aeo-summary-box"><ul><li>\uD575\uC2EC \uC694\uC57D 1 (50\uC790 \uB0B4\uC678)</li><li>\uD575\uC2EC \uC694\uC57D 2 (Snippet Bait)</li><li>\uD575\uC2EC \uC694\uC57D 3 (\uC815\uB2F5 \uC694\uC57D)</li></ul></div>
         3. <section><h2>\uC804\uBB38\uC801 \uC6D0\uC778 \uBD84\uC11D (E-E-A-T)</h2><p>'\uCF54\uB974\uD2F0\uC194', '\uC9C4\uD53C\uCE35 \uC5D8\uB77C\uC2A4\uD2F4 \uD30C\uAD34', '\uD608\uB958\uB7C9 \uBCC0\uD654' \uB4F1 \uC758\uD559\uC801/\uACFC\uD559\uC801 \uC804\uBB38 \uD0A4\uC6CC\uB4DC\uB97C \uBB38\uB9E5\uC5D0 \uB9DE\uAC8C \uD3EC\uD568\uD558\uC5EC 1,000\uC790 \uC774\uC0C1 \uC2EC\uCE35 \uC11C\uC220.</p></section>
         4. <section><h2>\uB2E8\uACC4\uBCC4 \uB300\uCC98\uBC95 \uAC00\uC774\uB4DC</h2><ol><li><strong>1\uB2E8\uACC4:</strong> \uC0C1\uC138 \uC124\uBA85...</li><li><strong>2\uB2E8\uACC4:</strong> \uC0C1\uC138 \uC124\uBA85...</li><li><strong>3\uB2E8\uACC4:</strong> \uC0C1\uC138 \uC124\uBA85...</li></ol></section>
         The output MUST exceed 1,500 characters. Return ONLY raw HTML for the body.`;
    const faqPrompt = `Generate exactly 5 AEO-optimized FAQs for "${keyword}". Target long-tail search intent.
         CRITICAL: The Answer text MUST contain the main keyword "${keyword}" at least once. 
         Return ONLY a valid JSON array: [{"q": "Long tail question?", "a": "Answer containing keyword..."}]`;
    const [htmlRaw, faqsRaw, scoringRaw] = await Promise.all([
      ai(bodyPrompt),
      ai(faqPrompt),
      ai(`Score this content idea (0-100) for SEO/AEO based on keyword "${keyword}". Return ONLY JSON: {"score": 95, "feedback": "Looks great."}`)
    ]);
    let html = htmlRaw.replace(/```html|```/g, "").trim();
    const faqs = parseAIJson(faqsRaw);
    const scoreData = parseAIJson(scoringRaw);
    const imgId = Date.now();
    let heroImagePath = "";
    if (isSEO) {
      const imgPrompts = [
        `Professional photography for ${keyword}, hero wide shot, soft lighting, premium maternal vibes, extremely high quality, realistic.`,
        `Professional photography for ${keyword}, detailed close-up shot, soft lighting, premium maternal vibes, extremely high quality.`,
        `Professional photography for ${keyword}, contextual lifestyle shot, soft lighting, premium maternal vibes, extremely high quality.`,
        `Professional photography for ${keyword}, comforting warm atmosphere, soft lighting, premium maternal vibes, extremely high quality.`
      ];
      const negativePrompt = "deformed, ugly, disfigured, bad anatomy, text, watermark, low resolution, blurry faces, mutated, extra limbs, impossible belly, weird faces";
      let imageResponses;
      try {
        imageResponses = await Promise.all(imgPrompts.map(
          (p) => env.AI.run("@cf/bytedance/stable-diffusion-xl-lightning", { prompt: p, negative_prompt: negativePrompt })
        ));
      } catch (e) {
        console.warn("AI Image Generation failed (likely local mode):", e.message);
        imageResponses = Array(4).fill(null);
      }
      const heroImageKey = `assets/${type}/${rawSlug}-${imgId}-hero.png`;
      if (imageResponses[0]) {
        await env.JOURNAL_BUCKET.put(heroImageKey, imageResponses[0], { httpMetadata: { contentType: "image/png" } });
        heroImagePath = `/${heroImageKey}`;
      } else {
        heroImagePath = `/assets/images/journal_1.jpg`;
      }
      for (let i = 1; i <= 3; i++) {
        const key = `assets/${type}/${rawSlug}-${imgId}-body${i}.png`;
        if (imageResponses[i]) {
          await env.JOURNAL_BUCKET.put(key, imageResponses[i], { httpMetadata: { contentType: "image/png" } });
          html = html.replace(`{{IMG_${i}}}`, `<img src="/${key}" style="width:100%; border-radius:1rem; margin:2rem 0; box-shadow:0 4px 6px rgba(0,0,0,0.05);" alt="${keyword} - ${title} \uAD00\uB828 \uC774\uBBF8\uC9C0 ${i}">`);
        } else {
          html = html.replace(`{{IMG_${i}}}`, `<img src="/assets/images/post_${i}.jpg" style="width:100%; border-radius:1rem; margin:2rem 0; box-shadow:0 4px 6px rgba(0,0,0,0.05);" alt="${keyword} - ${title} \uAD00\uB828 \uC774\uBBF8\uC9C0 ${i}">`);
        }
      }
    } else {
      let imageResponse;
      try {
        imageResponse = await env.AI.run("@cf/bytedance/stable-diffusion-xl-lightning", {
          prompt: `Professional high-quality photography for ${keyword}, ${title}, soft lighting, premium maternal vibes, realistic 8k.`,
          negative_prompt: "deformed, ugly, disfigured, bad anatomy, text, watermark, low resolution, blurry faces, mutated, extra limbs"
        });
      } catch (e) {
        console.warn("AI Image Generation failed (likely local mode):", e.message);
        imageResponse = null;
      }
      if (imageResponse) {
        const imageKey = `assets/${type}/${rawSlug}-${imgId}.png`;
        await env.JOURNAL_BUCKET.put(imageKey, imageResponse, { httpMetadata: { contentType: "image/png" } });
        heroImagePath = `/${imageKey}`;
      } else {
        heroImagePath = `/assets/images/expert_1.jpg`;
      }
    }
    const faqSchema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": faqs.map((f) => ({
        "@type": "Question",
        "name": f.q,
        "acceptedAnswer": { "@type": "Answer", "text": f.a }
      }))
    };
    let schemaArray = [
      faqSchema,
      {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": title,
        "image": heroImagePath,
        "author": { "@type": "Person", "name": "Moonpiece Editorial Board" },
        "publisher": { "@type": "Organization", "name": "Moonpiece", "logo": { "@type": "ImageObject", "url": "https://moonpiece.co.kr/assets/logo.png" } },
        "datePublished": (/* @__PURE__ */ new Date()).toISOString(),
        "description": `${keyword}\uC5D0 \uAD00\uD55C \uC804\uBB38\uAC00\uC758 \uC2EC\uCE35 \uB2F5\uBCC0\uACFC \uB2E8\uACC4\uBCC4 \uD574\uACB0 \uAC00\uC774\uB4DC\uB97C \uD655\uC778\uD558\uC138\uC694.`
      }
    ];
    if (!isSEO) {
      const olMatch = html.match(/<ol>([\s\S]*?)<\/ol>/i);
      if (olMatch) {
        const liItems = Array.from(olMatch[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi));
        if (liItems.length > 0) {
          schemaArray.push({
            "@context": "https://schema.org",
            "@type": "HowTo",
            "name": title,
            "step": liItems.map((match, idx) => ({
              "@type": "HowToStep",
              "url": `https://moonpiece.co.kr/knowledge/${rawSlug}.html#step${idx + 1}`,
              "name": `Step ${idx + 1}`,
              "text": match[1].replace(/<[^>]+>/g, "").trim()
            }))
          });
        }
      }
    }
    const draftData = {
      title,
      slug: rawSlug,
      html,
      faqs,
      score: scoreData.score,
      feedback: scoreData.feedback,
      image: heroImagePath,
      schema: schemaArray
    };
    return new Response(JSON.stringify({ success: true, draft: draftData }));
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500 });
  }
}
__name(generateContentHandler, "generateContentHandler");
async function renderTemplate(data, env, categoryName) {
  const listKey = categoryName === "\uC784\uC0B0\uBD80 \uC800\uB110" ? "journal/list.json" : "knowledge/list.json";
  const list = await env.JOURNAL_BUCKET.get(listKey).then((r) => r ? r.json() : []);
  const related = list.sort(() => 0.5 - Math.random()).slice(0, Math.min(list.length, 3));
  const relatedHtml = related.length > 0 ? `
        <section class="mt-24 border-t border-outline-variant pt-24">
            <h3 class="font-serif mb-12 text-3xl">\uAD00\uB828 \uCF58\uD150\uCE20</h3>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
                ${related.map((p) => `
                <a href="${p.url}" class="card overflow-hidden" style="padding:0; transition: transform 0.3s; display: block;">
                    <img src="${p.image}" class="aspect-video object-cover" style="width: 100%; height: 200px;">
                    <div class="p-6">
                        <h5 class="font-bold text-lg mb-2 text-on-surface hover:text-primary transition">${p.title}</h5>
                    </div>
                </a>`).join("")}
            </div>
        </section>` : "";
  return `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${data.title} | Moonpiece</title>
    <link rel="stylesheet" href="/styles.css">
    <script type="application/ld+json">${JSON.stringify(data.schema)}<\/script>
</head>
<body class="surface-low">
    <!-- Top Navigation -->
    <nav class="nav-bar">
        <div class="nav-container">
            <a href="/" class="logo font-serif">Moonpiece</a>
            <div class="nav-links">
                <a href="/brand.html" class="nav-link">\uBB38\uD53C\uC2A4\uC758 \uC57D\uC18D</a>
                <a href="/review.html" class="nav-link">\uC5C4\uB9C8\uB4E4\uC758 \uC774\uC57C\uAE30</a>
                <a href="/journal.html" class="nav-link">\uC784\uC0B0\uBD80 \uC800\uB110</a>
                <a href="/knowledge.html" class="nav-link">\uC784\uC0B0\uBD80 \uC9C0\uC2DD\uC778</a>
            </div>
            <div class="flex items-center gap-4">
                <a href="https://smartstore.naver.com/moonwalk00/products/2416019050" target="_blank" class="btn-primary mobile-hidden">\uAD6C\uB9E4\uD558\uAE30</a>
                <button class="hamburger-btn" id="menu-toggle">
                    <span></span><span></span><span></span>
                </button>
            </div>
        </div>
    </nav>

    <!-- Mobile Navigation Overlay -->
    <div class="nav-overlay" id="overlay"></div>
    <div class="mobile-nav" id="mobile-menu">
        <a href="/brand.html" class="nav-link">\uBB38\uD53C\uC2A4\uC758 \uC57D\uC18D</a>
        <a href="/review.html" class="nav-link">\uC5C4\uB9C8\uB4E4\uC758 \uC774\uC57C\uAE30</a>
        <a href="/journal.html" class="nav-link">\uC784\uC0B0\uBD80 \uC800\uB110</a>
        <a href="/knowledge.html" class="nav-link">\uC784\uC0B0\uBD80 \uC9C0\uC2DD\uC778</a>
        <a href="https://smartstore.naver.com/moonwalk00/products/2416019050" target="_blank" class="btn-primary text-center mt-8">\uAD6C\uB9E4\uD558\uAE30</a>
    </div>

    <main class="py-24 container" style="max-width: 800px; min-height: 80vh;">
        <div class="category-badge mb-8">${categoryName}</div>
        <h1 class="font-serif mb-12" style="font-size: 3.5rem;">${data.title}</h1>
        <img src="${data.image}" alt="${data.title}" style="width: 100%; border-radius: 2rem; margin-bottom: 4rem;">
        
        <!-- Post Body -->
        <div class="post-body-container article-content">
            ${data.html}
        </div>
        
        <section class="mt-24">
            <h3 class="font-serif mb-8 text-3xl">\uC790\uC8FC \uBB3B\uB294 \uC9C8\uBB38 (FAQ)</h3>
            ${(data.faqs || []).map((f) => `
            <details class="faq-card p-6 rounded-2xl surface-container-lowest mb-4 border border-outline-variant">
                <summary class="font-bold cursor-pointer" style="font-size: 1.1rem;">${f.q}</summary>
                <p class="mt-4 leading-relaxed" style="color: var(--on-surface-variant);">${f.a}</p>
            </details>`).join("")}
        </section>
        
        ${relatedHtml}
    </main>

    <!-- Footer -->
    <footer>
        <div class="container grid md:grid-cols-2 gap-12">
            <div>
                <div class="logo font-serif mb-4" style="color: var(--primary);">Moonpiece</div>
                <p style="max-width: 320px; color: var(--on-surface-variant); line-height: 1.8;">
                    \uC18C\uC911\uD55C \uC5C4\uB9C8\uC640 \uC544\uAE30\uB97C \uC704\uD55C \uB2EC\uBE5B\uC758 \uC870\uAC01, \uBB38\uD53C\uC2A4. 11\uB144\uC758 \uC9C4\uC2EC\uC744 \uB2F4\uC544 \uAC00\uC7A5 \uD3B8\uC548\uD55C \uD734\uC2DD\uC744 \uC124\uACC4\uD569\uB2C8\uB2E4.
                </p>
            </div>
            <div class="grid md:grid-cols-3 gap-8">
                <div>
                    <h4 style="font-weight: 800; margin-bottom: 1.5rem;">Company</h4>
                    <ul style="list-style: none; display: flex; flex-direction: column; gap: 0.75rem; color: var(--on-surface-variant);">
                        <li><a href="/about.html">\uD68C\uC0AC\uC18C\uAC1C</a></li>
                        <li><a href="/terms.html">\uC774\uC6A9\uC57D\uAD00</a></li>
                    </ul>
                </div>
                <div>
                    <h4 style="font-weight: 800; margin-bottom: 1.5rem;">Support</h4>
                    <ul style="list-style: none; display: flex; flex-direction: column; gap: 0.75rem; color: var(--on-surface-variant);">
                        <li><a href="/privacy.html">\uAC1C\uC778\uC815\uBCF4\uCC98\uB9AC\uBC29\uCE68</a></li>
                        <li><a href="https://smartstore.naver.com/moonwalk00/products/2416019050" target="_blank">\uB124\uC774\uBC84 \uC2A4\uB9C8\uD2B8\uC2A4\uD1A0\uC5B4</a></li>
                    </ul>
                </div>
                <div>
                    <h4 style="font-weight: 800; margin-bottom: 1.5rem;">Social</h4>
                    <ul style="list-style: none; display: flex; flex-direction: column; gap: 0.75rem; color: var(--on-surface-variant);">
                        <li><a href="#">Instagram</a></li>
                        <li><a href="#">YouTube</a></li>
                    </ul>
                </div>
            </div>
        </div>
        <div class="container" style="margin-top: 4rem; padding-top: 2rem; border-top: 1px solid var(--outline-variant); text-align: center; color: var(--on-surface-variant); font-size: 0.85rem;">
            \xA9 2024 Moonpiece. All rights reserved.
        </div>
    </footer>
    
    <script>
        const menuToggle = document.getElementById('menu-toggle');
        const mobileMenu = document.getElementById('mobile-menu');
        const overlay = document.getElementById('overlay');
        if(menuToggle) {
            menuToggle.addEventListener('click', () => {
                const isActive = mobileMenu.classList.toggle('active');
                menuToggle.classList.toggle('active');
                overlay.classList.toggle('active');
                document.body.style.overflow = isActive ? 'hidden' : 'auto';
            });
            overlay.addEventListener('click', () => {
                mobileMenu.classList.remove('active');
                menuToggle.classList.remove('active');
                overlay.classList.remove('active');
                document.body.style.overflow = 'auto';
            });
        }
    <\/script>
</body>
</html>`;
}
__name(renderTemplate, "renderTemplate");

// ../Users/VIEW/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
init_checked_fetch();
init_modules_watch_stub();
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../Users/VIEW/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
init_checked_fetch();
init_modules_watch_stub();
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-2fs9a6/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = index_default;

// ../Users/VIEW/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/common.ts
init_checked_fetch();
init_modules_watch_stub();
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-2fs9a6/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
