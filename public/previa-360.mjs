/**
 * A janela para dentro de uma fotografia 360º.
 *
 * As rotas 360º são filmadas a dar a volta toda a quem filma, e a imagem
 * do primeiro instante de cada uma está guardada assim, esticada de lado
 * a lado (equirectangular). Vista de frente essa imagem não se parece com
 * nada: as casas ficam curvas e a pessoa aparece nas duas pontas. Aqui
 * abre-se-lhe uma janela, com a mesma câmara e a mesma volta e inclinação
 * com que o player começa, para a janela do lado mostrar exactamente o
 * que se vai ver quando se passar para lá.
 *
 * A conta é a do próprio player (A-Frame): a esfera é a do three.js com
 * a escala trocada de lado e meia volta dada, e a câmara vira primeiro
 * para cima ou para baixo e depois à volta. Cada ponto da janela é um
 * raio que sai da câmara, e o que se vê é o ponto da esfera onde ele bate.
 */

/**
 * Desenha numa tela a vista de uma fotografia 360º.
 *
 * @param {HTMLCanvasElement} tela - Onde desenhar; fica com o tamanho pedido.
 * @param {HTMLImageElement} imagem - A fotografia a dar a volta toda, já carregada.
 * @param {{yaw: number, pitch: number}} olhar - Volta e inclinação da câmara, em graus.
 * @param {number} abertura - Abertura vertical da câmara, em graus.
 * @param {number} largura - Largura da tela, em pontos.
 * @param {number} altura - Altura da tela, em pontos.
 */
export function desenharPrevia360(tela, imagem, olhar, abertura, largura, altura) {
    const W = Math.max(1, Math.round(largura));
    const H = Math.max(1, Math.round(altura));
    tela.width = W;
    tela.height = H;

    // A fotografia, em pontos, para se ir lá buscar as cores.
    const fonte = document.createElement('canvas');
    const fw = imagem.naturalWidth || imagem.width;
    const fh = imagem.naturalHeight || imagem.height;
    fonte.width = fw;
    fonte.height = fh;
    const cf = fonte.getContext('2d', { willReadFrequently: true });
    cf.drawImage(imagem, 0, 0, fw, fh);
    const origem = cf.getImageData(0, 0, fw, fh).data;

    const destino = tela.getContext('2d');
    const saida = destino.createImageData(W, H);
    const pixeis = saida.data;

    const RAD = Math.PI / 180;
    const yaw = olhar.yaw * RAD;
    const pitch = olhar.pitch * RAD;
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const tanV = Math.tan(abertura * 0.5 * RAD);
    const tanH = tanV * (W / H);
    const DOIS_PI = Math.PI * 2;

    for (let py = 0; py < H; py++) {
        const ny = 1 - ((py + 0.5) / H) * 2;
        for (let px = 0; px < W; px++) {
            const nx = ((px + 0.5) / W) * 2 - 1;

            // O raio, na câmara: para a frente é -z.
            const x0 = nx * tanH, y0 = ny * tanV, z0 = -1;
            // Vira para cima ou para baixo (à volta de x)...
            const x1 = x0;
            const y1 = cp * y0 - sp * z0;
            const z1 = sp * y0 + cp * z0;
            // ...e depois à volta (à volta de y).
            const dx = cy * x1 + sy * z1;
            const dy = y1;
            const dz = -sy * x1 + cy * z1;
            const n = Math.sqrt(dx * dx + dy * dy + dz * dz);

            // Onde o raio bate na esfera do player: a longitude é medida
            // com a esfera virada do avesso e com meia volta dada, e a
            // latitude vem do alto para baixo.
            let u = Math.atan2(-dz / n, -dx / n) / DOIS_PI;
            u -= Math.floor(u);
            const v = Math.acos(Math.max(-1, Math.min(1, dy / n))) / Math.PI;

            let sx = (u * fw) | 0;
            let sy2 = (v * fh) | 0;
            if (sx >= fw) sx = fw - 1;
            if (sy2 >= fh) sy2 = fh - 1;
            const i = (sy2 * fw + sx) * 4;
            const o = (py * W + px) * 4;
            pixeis[o] = origem[i];
            pixeis[o + 1] = origem[i + 1];
            pixeis[o + 2] = origem[i + 2];
            pixeis[o + 3] = 255;
        }
    }
    destino.putImageData(saida, 0, 0);
}

/**
 * Vai buscar uma fotografia 360º e desenha-a na tela assim que chegar.
 *
 * @param {HTMLCanvasElement} tela - Onde desenhar.
 * @param {string} endereco - A fotografia a dar a volta toda.
 * @param {{yaw: number, pitch: number}} olhar - Volta e inclinação, em graus.
 * @param {number} abertura - Abertura vertical da câmara, em graus.
 * @param {number} largura - Largura da tela, em pontos.
 * @param {number} altura - Altura da tela, em pontos.
 * @returns {Promise<void>} Resolve quando estiver desenhada.
 */
export function carregarPrevia360(tela, endereco, olhar, abertura, largura, altura) {
    return new Promise((resolver, rejeitar) => {
        const imagem = new Image();
        imagem.onload = () => {
            desenharPrevia360(tela, imagem, olhar, abertura, largura, altura);
            resolver();
        };
        imagem.onerror = () => rejeitar(new Error('Prévia 360º em falta: ' + endereco));
        imagem.src = endereco;
    });
}
