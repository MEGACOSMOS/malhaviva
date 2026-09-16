/**
 * Óculos de cartão: a realidade virtual no telemóvel.
 *
 * Os navegadores dos telemóveis já não sabem abrir óculos de realidade
 * virtual por si: o Chrome do Android só faz realidade aumentada, e o
 * Safari do iPhone não faz nada disto. O que fica é o velho "cartão" — o
 * telemóvel metido numa armação com duas lentes (Cardboard e afins), com
 * o ecrã dividido em dois e o sensor de movimento a virar a vista.
 *
 * Isto é o que põe esse cartão a funcionar: num ecrã táctil sem óculos a
 * sério, vai buscar um substituto do WebXR (o "polyfill" da Immersive Web
 * Working Group) que desenha as duas metades e lê o sensor. O motor do
 * mapa e o tocador das rotas pedem os óculos como a qualquer visor, sem
 * saberem que é cartão.
 *
 * No Android o navegador tem um WebXR próprio que diz "não há óculos": é
 * tirado do caminho para o substituto entrar. No iPhone não há nenhum e
 * o substituto entra directo. Num computador, ou num telemóvel com óculos
 * a sério, nada disto acontece.
 *
 * É um ficheiro comum, e não um módulo, para ser lido antes dos motores.
 *
 * Deixa em `window.VRCartao`:
 *  - `pronto`: uma promessa que diz se há óculos (a sério ou de cartão);
 *  - `pedirSensores()`: pede ao iPhone licença para ler o sensor de
 *    movimento — tem de ser chamado a partir de um toque.
 */
(function () {
    'use strict';

    var POLYFILL = 'https://cdn.jsdelivr.net/npm/webxr-polyfill@2.0.3/build/webxr-polyfill.min.js';

    var tactil = !!(window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches);
    // Para afinar num computador: `?cartao=1` no endereço faz de conta que
    // é um telemóvel.
    var aFingir = /[?&]cartao=1(&|$)/.test(window.location.search);

    // Quem faz o cartão: o próprio mapa (cartao.mjs), que só precisa do
    // sensor de movimento, ou o substituto do WebXR, para as páginas que
    // deixam essa parte ao A-Frame. Diz-o o guião que chama este.
    var guiaoActual = document.currentScript;
    var modo = (guiaoActual && guiaoActual.getAttribute('data-modo')) || 'substituto';

    // O que o navegador tem de seu: `XRWebGLLayer` e companhia. Para o
    // substituto se instalar por inteiro, tudo isto sai do caminho.
    var NOMES_DO_WEBXR = [
        'XRSystem', 'XRSession', 'XRRenderState', 'XRFrame', 'XRSpace',
        'XRReferenceSpace', 'XRBoundedReferenceSpace', 'XRView', 'XRViewport',
        'XRRigidTransform', 'XRPose', 'XRViewerPose', 'XRInputSource',
        'XRInputSourceArray', 'XRLayer', 'XRWebGLLayer', 'XRWebGLBinding',
        'XRGPUBinding', 'XRSessionEvent', 'XRInputSourceEvent',
        'XRInputSourcesChangeEvent', 'XRReferenceSpaceEvent'
    ];

    /**
     * Se o navegador, por si, sabe abrir óculos.
     *
     * @returns {Promise<boolean>}
     */
    function haOculosASerio() {
        if (!navigator.xr || typeof navigator.xr.isSessionSupported !== 'function') {
            return Promise.resolve(false);
        }
        return navigator.xr.isSessionSupported('immersive-vr').catch(function () { return false; });
    }

    /**
     * Tira do caminho o WebXR do navegador, para o substituto entrar.
     */
    function apagarODoNavegador() {
        try { delete Navigator.prototype.xr; } catch (e) { /* fica */ }
        try {
            if ('xr' in navigator) {
                Object.defineProperty(navigator, 'xr', { value: undefined, configurable: true, writable: true });
                delete navigator.xr;
            }
        } catch (e) { /* fica */ }
        NOMES_DO_WEBXR.forEach(function (nome) {
            try { delete window[nome]; } catch (e) { /* fica */ }
        });
    }

    /**
     * Vai buscar o substituto e instala-o.
     *
     * @returns {Promise<boolean>} Verdadeiro se ficou instalado.
     */
    function instalarOCartao() {
        return new Promise(function (resolver) {
            var guiao = document.createElement('script');
            guiao.src = POLYFILL;
            guiao.onload = function () {
                try {
                    apagarODoNavegador();
                    if ('xr' in navigator) {
                        // Não se conseguiu tirar o do navegador: sem
                        // cartão, então.
                        resolver(false);
                        return;
                    }
                    new window.WebXRPolyfill({
                        webvr: false,
                        cardboard: true,
                        allowCardboardOnDesktop: aFingir
                    });
                    window.vrPorCartao = true;
                    resolver(!!navigator.xr);
                } catch (e) {
                    console.warn('Óculos de cartão: não deu para instalar.', e);
                    resolver(false);
                }
            };
            guiao.onerror = function () { resolver(false); };
            document.head.appendChild(guiao);
        });
    }

    var pronto = haOculosASerio().then(function (tem) {
        if (tem) return true;
        if (!tactil && !aFingir) return false;
        if (modo === 'proprio') {
            // O mapa faz o cartão por si: chega haver sensor de movimento.
            if (!('DeviceOrientationEvent' in window)) return false;
            window.vrPorCartao = true;
            return true;
        }
        return instalarOCartao();
    });

    pronto.then(function (tem) {
        if (tem) document.dispatchEvent(new CustomEvent('vrdisponivel', { detail: { cartao: !!window.vrPorCartao } }));
    });

    window.VRCartao = {
        pronto: pronto,

        /**
         * Pede licença para ler o sensor de movimento, onde é preciso pedir
         * (o iPhone). Tem de vir de um toque.
         *
         * @returns {Promise<void>}
         */
        pedirSensores: function () {
            var pedidos = [];
            ['DeviceMotionEvent', 'DeviceOrientationEvent'].forEach(function (nome) {
                var Evento = window[nome];
                if (Evento && typeof Evento.requestPermission === 'function') {
                    pedidos.push(Evento.requestPermission().catch(function () { /* recusado: fica parado */ }));
                }
            });
            return Promise.all(pedidos).then(function () { /* pronto */ });
        }
    };
})();
