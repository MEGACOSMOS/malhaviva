/**
 * A ordem das manchas chega à placa gráfica às fatias, e não de uma vez.
 *
 * As manchas desenham-se da mais longe para a mais perto, e essa ordem é
 * refeita (num trabalhador à parte) sempre que a câmara anda. De origem, o
 * motor manda-a à placa inteira na imagem em que ela fica pronta: no Alto são
 * uns 30 MB, sete vezes por segundo, e essa imagem demorava 19 milésimos de
 * segundo em vez de 8 — era isso que fazia o bairro andar aos solavancos ao
 * mexer a câmara, num computador rápido.
 *
 * Aqui a ordem nova vai sendo escrita, às fatias, numa segunda lista que a
 * placa ainda não usa: no máximo `BYTES_POR_IMAGEM` por imagem, e só as linhas
 * que levam manchas (o motor mandava a lista inteira, com as linhas vazias do
 * fim, e voltava a criá-la de raiz de cada vez). Quando está toda lá, as duas
 * listas trocam de lugar e o motor é avisado de que a ordem nova chegou — tal
 * como antes, só que sem a enviar outra vez. A ordem que se vê fica umas
 * imagens mais atrasada (quatro, no Alto; uma ou duas, no Médio).
 *
 * Quando a lista muda de tamanho (o bairro ganhou ou perdeu manchas que já
 * não cabem na de antes) e quando o motor não está como este código espera,
 * faz-se como de origem, de uma vez.
 *
 * Isto mexe em contas que o motor guarda lá por dentro, como o lod-foco.mjs e
 * o bairro-malha.mjs. Feito para o motor 2.21.4, a desenhar em WebGL2; com o
 * WebGPU a ordem é feita na própria placa e isto não faz nada.
 */
import { Texture, PIXELFORMAT_R32U, ADDRESS_CLAMP_TO_EDGE, FILTER_NEAREST } from 'playcanvas';

// Quanto da ordem nova se escreve por imagem, no máximo, em bytes.
const BYTES_POR_IMAGEM = 8 * 1024 * 1024;

/**
 * Liga o envio às fatias a todos os bairros de manchas que o motor tiver.
 *
 * @param {object} app - A aplicação 3D.
 * @returns {{ligado: boolean, fatiadas: number, inteiras: number}|null} O
 *     estado: `ligado` pode ser posto a falso para voltar ao de origem;
 *     as contas dizem quantas ordens foram às fatias e quantas de uma vez.
 *     `null` se o motor não for o WebGL2.
 */
export function ligarOrdemAsFatias(app) {
    const dispositivo = app.graphicsDevice;
    if (!dispositivo || dispositivo.isWebGPU || !dispositivo.gl) return null;
    const gl = dispositivo.gl;
    const estado = { ligado: true, fatiadas: 0, inteiras: 0 };
    let remendado = false;

    /** Escreve linhas da ordem numa lista da placa. */
    function escrever(textura, dados, linha, linhas) {
        const largura = textura.width;
        dispositivo.setTexture(textura, 0);
        dispositivo.activeTexture(0);
        dispositivo.bindTexture(textura);
        dispositivo.setUnpackFlipY(false);
        dispositivo.setUnpackPremultiplyAlpha(false);
        dispositivo.setUnpackAlignment(4);
        gl.bindBuffer(gl.PIXEL_UNPACK_BUFFER, null);
        gl.pixelStorei(gl.UNPACK_ROW_LENGTH, 0);
        gl.pixelStorei(gl.UNPACK_SKIP_ROWS, 0);
        gl.pixelStorei(gl.UNPACK_SKIP_PIXELS, 0);
        const impl = textura.impl;
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, linha, largura, linhas, impl._glFormat, impl._glPixelType, dados, linha * largura);
    }

    /** A segunda lista, do tamanho da que a placa está a usar. */
    function listaDeTras(trabalho, frente) {
        let tras = trabalho.__ordemDeTras;
        if (tras && (tras.width !== frente.width || tras.height !== frente.height)) {
            tras.destroy();
            tras = null;
        }
        if (!tras) {
            tras = new Texture(dispositivo, {
                name: 'SplatGlobalOrder2',
                width: frente.width,
                height: frente.height,
                format: PIXELFORMAT_R32U,
                mipmaps: false,
                minFilter: FILTER_NEAREST,
                magFilter: FILTER_NEAREST,
                addressU: ADDRESS_CLAMP_TO_EDGE,
                addressV: ADDRESS_CLAMP_TO_EDGE
            });
            // Cria-a já na placa, vazia.
            dispositivo.setTexture(tras, 0);
            trabalho.__ordemDeTras = tras;
        }
        return tras;
    }

    function remendar(ordenador, trabalho) {
        const P = Object.getPrototypeOf(ordenador);
        const T = Object.getPrototypeOf(trabalho);
        if (typeof P.applyPendingSorted !== 'function' || typeof P.releaseOrderData !== 'function' ||
            typeof T.setOrderData !== 'function') return false;
        const aplicarDeOrigem = P.applyPendingSorted;
        const enviarDeOrigem = T.setOrderData;
        const destruirDeOrigem = T.destroy;

        // Quando a ordem já foi escrita às fatias, o motor não a envia outra vez.
        T.setOrderData = function (dados) {
            if (this.__jaEscrita) return;
            enviarDeOrigem.call(this, dados);
        };
        T.destroy = function () {
            if (this.__ordemDeTras) {
                this.__ordemDeTras.destroy();
                this.__ordemDeTras = null;
            }
            return destruirDeOrigem.call(this);
        };

        P.applyPendingSorted = function () {
            const gestor = this.__gestor;
            const mundo = gestor && gestor.world;
            const trabalho = mundo && mundo.workBuffer;
            const frente = trabalho && trabalho.orderTexture;
            if (!estado.ligado || !frente || !frente.impl) {
                if (this.__emCurso) {
                    // A que estava a meio dá lugar à mais nova, ou volta à fila.
                    if (this.pendingSorted) this.releaseOrderData(this.__emCurso.orderData);
                    else this.pendingSorted = this.__emCurso;
                    this.__emCurso = null;
                }
                return aplicarDeOrigem.call(this);
            }
            let ordem = this.__emCurso;
            if (!ordem && this.pendingSorted) {
                ordem = this.__emCurso = this.pendingSorted;
                this.pendingSorted = null;
                ordem.linha = 0;
            }
            if (!ordem) return;

            const largura = frente.width;
            const doMundo = mundo.getState(ordem.version);
            // Uma ordem de um bairro que já não existe (o motor recomeçou) vai fora.
            if (!doMundo || ordem.version < mundo.currentVersion) {
                this.__emCurso = null;
                this.releaseOrderData(ordem.orderData);
                return;
            }
            // Com a lista a mudar de tamanho, ou acabada de nascer, de uma vez.
            if (doMundo.textureSize !== largura || ordem.orderData.length !== largura * frente.height ||
                !frente.impl._glCreated) {
                this.__emCurso = null;
                if (this.pendingSorted) this.releaseOrderData(ordem.orderData);
                else this.pendingSorted = ordem;
                estado.inteiras++;
                return aplicarDeOrigem.call(this);
            }

            const tras = listaDeTras(trabalho, frente);
            const usadas = Math.min(frente.height, Math.ceil(ordem.count / largura));
            const porImagem = Math.max(1, Math.floor(BYTES_POR_IMAGEM / (largura * 4)));
            const linhas = Math.min(porImagem, usadas - ordem.linha);
            if (linhas > 0) escrever(tras, ordem.orderData, ordem.linha, linhas);
            ordem.linha += Math.max(0, linhas);
            if (ordem.linha < usadas) return;

            // Toda escrita: as listas trocam de lugar, e o motor fica a saber.
            trabalho.__ordemDeTras = frente;
            trabalho.orderTexture = tras;
            this.__emCurso = null;
            trabalho.__jaEscrita = true;
            try {
                this.fire('sorted', ordem.count, ordem.version, ordem.orderData);
            } finally {
                trabalho.__jaEscrita = false;
            }
            this.releaseOrderData(ordem.orderData);
            estado.fatiadas++;
        };
        return true;
    }

    app.on('prerender', () => {
        const director = app.renderer && app.renderer.gsplatDirector;
        if (!director || !director.camerasMap) return;
        for (const dadosCamera of director.camerasMap.values()) {
            if (!dadosCamera.layersMap) continue;
            for (const dadosCamada of dadosCamera.layersMap.values()) {
                const gestor = dadosCamada.gsplatManager;
                const ordenador = gestor && gestor.cpuSorter;
                if (!ordenador || ordenador.__gestor === gestor || !gestor.world || !gestor.world.workBuffer) continue;
                if (!remendado) remendado = remendar(ordenador, gestor.world.workBuffer);
                if (remendado) ordenador.__gestor = gestor;
            }
        }
    });
    return estado;
}
