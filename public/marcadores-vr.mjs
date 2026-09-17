import {
    Entity, Color, Texture, StandardMaterial, Vec3,
    PIXELFORMAT_RGBA8, FILTER_LINEAR, ADDRESS_CLAMP_TO_EDGE, BLEND_NORMAL, CULLFACE_NONE
} from 'playcanvas';

/**
 * Os marcadores do bairro dentro dos óculos.
 *
 * No mapa, os marcadores dos testemunhos e das rotas são feitos de HTML,
 * pousados por cima da imagem — e dentro dos óculos o HTML não existe:
 * ficava-se a andar pelo bairro sem um único sinal de onde há o que ver.
 * Aqui cada marcador passa a ser uma placa no próprio bairro: o mesmo
 * quadrado com o mesmo desenho (as barras de um testemunho, a cruz de
 * setas de uma rota, o olho da fotografia) e o nome por baixo, desenhados
 * numa tela e postos numa placa que vira sempre a cara para quem olha.
 * Vistos, ficam cinzentos, como no mapa.
 *
 * São só para ver: dentro dos óculos não se abre nada.
 */

// A placa no bairro, em metros: larga o dobro do que é alta.
const LARGURA = 8;
const ALTURA = 4;

// Quanto acima do ponto do marcador a placa flutua, em metros.
const ACIMA = 3;

// A tela onde se desenha cada placa, em pontos.
const TELA_LARGURA = 512;
const TELA_ALTURA = 256;

const VERDE = '#10b981';
const VERMELHO = '#ff0000';
const CINZENTO = '#8a8f98';
const FUNDO = '#05050a';

/**
 * Desenha um marcador numa tela.
 *
 * @param {object} ann - A anotação.
 * @param {string} nome - O nome a escrever por baixo.
 * @param {boolean} visto - Se já foi visto.
 * @returns {HTMLCanvasElement} A tela desenhada.
 */
function desenharPlaca(ann, nome, visto) {
    const tela = document.createElement('canvas');
    tela.width = TELA_LARGURA;
    tela.height = TELA_ALTURA;
    const c = tela.getContext('2d');
    c.clearRect(0, 0, TELA_LARGURA, TELA_ALTURA);

    // O quadrado, ao meio em cima.
    const lado = 120;
    const qx = (TELA_LARGURA - lado) / 2;
    const qy = 8;
    c.fillStyle = visto ? CINZENTO : (ann.is360 ? (ann.isImage ? FUNDO : VERMELHO) : VERDE);
    c.fillRect(qx, qy, lado, lado);
    if (ann.isImage) {
        c.strokeStyle = 'rgba(255,255,255,0.3)';
        c.lineWidth = 3;
        c.strokeRect(qx + 1.5, qy + 1.5, lado - 3, lado - 3);
    }

    // O desenho lá dentro, com traço de cantos direitos como no mapa.
    c.strokeStyle = '#ffffff';
    c.lineCap = 'butt';
    c.lineJoin = 'miter';
    c.lineWidth = 8;
    const u = lado / 24;           // a unidade dos desenhos de 24 pontos
    const X = (v) => qx + v * u;
    const Y = (v) => qy + v * u;
    c.beginPath();
    if (!ann.is360) {
        // As barras do testemunho.
        c.moveTo(X(6), Y(6)); c.lineTo(X(6), Y(18));
        c.moveTo(X(10), Y(9)); c.lineTo(X(10), Y(15));
        c.moveTo(X(14), Y(3)); c.lineTo(X(14), Y(21));
        c.moveTo(X(18), Y(5)); c.lineTo(X(18), Y(19));
    } else if (ann.isImage) {
        // O olho da fotografia.
        c.moveTo(X(1), Y(12));
        c.bezierCurveTo(X(5), Y(5), X(19), Y(5), X(23), Y(12));
        c.bezierCurveTo(X(19), Y(19), X(5), Y(19), X(1), Y(12));
        c.moveTo(X(15), Y(12));
        c.arc(X(12), Y(12), 3 * u, 0, Math.PI * 2);
    } else {
        // A cruz de setas da rota.
        c.moveTo(X(8.5), Y(5.5)); c.lineTo(X(12), Y(2)); c.lineTo(X(15.5), Y(5.5));
        c.moveTo(X(8.5), Y(18.5)); c.lineTo(X(12), Y(22)); c.lineTo(X(15.5), Y(18.5));
        c.moveTo(X(5.5), Y(8.5)); c.lineTo(X(2), Y(12)); c.lineTo(X(5.5), Y(15.5));
        c.moveTo(X(18.5), Y(8.5)); c.lineTo(X(22), Y(12)); c.lineTo(X(18.5), Y(15.5));
        c.moveTo(X(12), Y(3)); c.lineTo(X(12), Y(21));
        c.moveTo(X(3), Y(12)); c.lineTo(X(21), Y(12));
    }
    c.stroke();

    // O nome por baixo, numa caixa escura, como a etiqueta do mapa.
    if (nome && !ann.isImage) {
        c.font = '600 40px "Liberation Mono", "Courier New", monospace';
        c.textBaseline = 'middle';
        c.textAlign = 'center';
        const larguraDoNome = Math.min(TELA_LARGURA - 8, c.measureText(nome).width + 56);
        const ex = (TELA_LARGURA - larguraDoNome) / 2;
        const ey = qy + lado + 10;
        const eh = 74;
        c.fillStyle = FUNDO;
        c.fillRect(ex, ey, larguraDoNome, eh);
        c.strokeStyle = 'rgba(255,255,255,0.15)';
        c.lineWidth = 3;
        c.strokeRect(ex + 1.5, ey + 1.5, larguraDoNome - 3, eh - 3);
        c.fillStyle = '#ffffff';
        c.fillText(nome, TELA_LARGURA / 2, ey + eh / 2 + 2);
    }
    return tela;
}

/**
 * Cria os marcadores dentro dos óculos.
 *
 * @param {object} app - A aplicação 3D.
 * @returns {{mostrar: Function, esconder: Function, virarPara: Function}}
 */
export function criarMarcadoresVR(app) {
    let placas = [];

    /**
     * Põe uma placa por cada anotação.
     *
     * @param {object[]} anotacoes - As anotações do mapa.
     * @param {Function} nomeDe - Dá o nome de cada uma.
     * @param {Function} vista - Diz se cada uma já foi vista.
     */
    function mostrar(anotacoes, nomeDe, vista) {
        esconder();
        for (const ann of anotacoes) {
            if (!ann || !ann.position) continue;
            const tela = desenharPlaca(ann, nomeDe(ann), vista(ann));
            const textura = new Texture(app.graphicsDevice, {
                width: TELA_LARGURA,
                height: TELA_ALTURA,
                format: PIXELFORMAT_RGBA8,
                mipmaps: false,
                minFilter: FILTER_LINEAR,
                magFilter: FILTER_LINEAR,
                addressU: ADDRESS_CLAMP_TO_EDGE,
                addressV: ADDRESS_CLAMP_TO_EDGE
            });
            textura.setSource(tela);

            const material = new StandardMaterial();
            material.useLighting = false;
            material.diffuse = new Color(0, 0, 0);
            material.emissive = new Color(1, 1, 1);
            material.emissiveMap = textura;
            material.opacityMap = textura;
            material.blendType = BLEND_NORMAL;
            material.cull = CULLFACE_NONE;
            material.depthTest = false;
            material.depthWrite = false;
            material.update();

            // A placa vira a cara para quem olha (o pai olha; a placa,
            // deitada de origem, é posta de pé dentro dele).
            const pai = new Entity('marcador-vr');
            pai.setPosition(ann.position.x, ann.position.y + ACIMA, ann.position.z);
            // Numa camada desenhada depois do bairro, para a placa ficar
            // sempre à vista, como as etiquetas do mapa.
            const camada = app.scene.layers.getLayerByName('Immediate');
            const placa = new Entity('placa');
            placa.addComponent('render', {
                type: 'plane',
                material,
                layers: camada ? [camada.id] : undefined
            });
            // De pé, e com a frente para quem olha: o pai aponta o seu -Z a
            // quem olha; a placa, deitada de origem com o cimo da tela para
            // -Z, levanta-se (90 em X) e dá meia volta (180 em Y) para o
            // cimo ficar para cima e a escrita da esquerda para a direita.
            // (Medido com a câmara à volta dela, e não deduzido.)
            placa.setLocalEulerAngles(90, 180, 0);
            placa.setLocalScale(LARGURA, 1, ALTURA);
            pai.addChild(placa);
            app.root.addChild(pai);
            placas.push({ pai, textura, material });
        }
    }

    /**
     * Vira todas as placas para um ponto — a cabeça de quem olha.
     *
     * @param {Vec3} ponto - Para onde virar.
     */
    const alvo = new Vec3();
    function virarPara(ponto) {
        for (const { pai } of placas) {
            // Só à volta, sem inclinar: uma placa a inclinar-se para a
            // cabeça parecia cair.
            alvo.set(ponto.x, pai.getPosition().y, ponto.z);
            pai.lookAt(alvo);
        }
    }

    /**
     * Tira as placas todas.
     */
    function esconder() {
        for (const { pai, textura, material } of placas) {
            pai.destroy();
            material.destroy();
            textura.destroy();
        }
        placas = [];
    }

    return { mostrar, esconder, virarPara };
}
