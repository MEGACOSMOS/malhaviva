/**
 * O bairro direito.
 *
 * O modelo do drone saiu do processamento um nada torto: inclinado 0,53°,
 * a descer para oeste e para sul — quase um metro em cada cem. Mede-se
 * contra o voo LiDAR de julho de 2024 da Direção-Geral do Território, que
 * sabe onde é o "cima" verdadeiro: no chão aberto, a altura real é
 *
 *     altitude = y − B·x − C·z + constante
 *
 * com os B e C de baixo (ver scripts/edificios/altura.json, campo "a1",
 * e scripts/edificios/inclinacao.py). Visto de perto não se nota; visto de
 * cima, contra o horizonte da fotografia do céu e os prédios até 720 m, o
 * bairro ficava a pender — no fundo do mapa, 6 a 7 metros fora do sítio.
 *
 * Em vez de refazer o modelo (os ficheiros em manchas e as zonas de
 * detalhe), roda-se tudo o que está preso a ele pela mesma rotação, à
 * volta da origem da cena (o meio do bairro, que fica onde estava):
 *  - o bairro em manchas (a entidade gsplat-scene em index.html, cuja
 *    rotação já inclui esta);
 *  - os prédios à volta (edificios.mjs), que foram feitos inclinados de
 *    propósito para assentarem no modelo torto;
 *  - as anotações pousadas no bairro (annotations.mjs) — as do céu, a
 *    80 m, ficam onde estão;
 *  - o chão do bairro da navegação (navegacao/chao.bin, lido em
 *    navegacao-3d.mjs), medido no modelo torto.
 * As coordenadas guardadas nesses ficheiros continuam as do modelo torto:
 * é aqui que passam a direitas, quando o site as lê. Uma anotação nova,
 * medida com o cursor do modo de programador, já vem direita — vai para
 * a lista sem passar por aqui (ver `direita` em annotations.mjs).
 */

// A inclinação do modelo: a altura real cresce −B por metro para leste (x)
// e −C por metro para sul (z).
const B = -0.007846269444947096;
const C = -0.0048741756195039565;

// O "cima" verdadeiro, nas coordenadas do modelo torto, e a rotação que o
// leva para o cima da cena (0, 1, 0): eixo = cima × (0, 1, 0).
const comprimento = Math.hypot(-B, 1, -C);
const cimaX = -B / comprimento;
const cimaY = 1 / comprimento;
const cimaZ = -C / comprimento;
const angulo = Math.acos(cimaY);
const eixo = Math.hypot(cimaZ, cimaX);
const meio = Math.sin(angulo / 2) / eixo;

/** A rotação, em quaternião [x, y, z, w]. */
export const ROTACAO = [-cimaZ * meio, 0, cimaX * meio, Math.cos(angulo / 2)];

/** A inclinação que se tirou, em graus. */
export const INCLINACAO_GRAUS = angulo * 180 / Math.PI;

// A mesma rotação em matriz 3×3, para rodar pontos sem precisar do motor.
const [qx, qy, qz, qw] = ROTACAO;
const M = [
    1 - 2 * (qy * qy + qz * qz), 2 * (qx * qy - qz * qw), 2 * (qx * qz + qy * qw),
    2 * (qx * qy + qz * qw), 1 - 2 * (qx * qx + qz * qz), 2 * (qy * qz - qx * qw),
    2 * (qx * qz - qy * qw), 2 * (qy * qz + qx * qw), 1 - 2 * (qx * qx + qy * qy)
];

/**
 * Um ponto medido no modelo torto, já no bairro direito.
 *
 * @param {number} x - O x no modelo torto.
 * @param {number} y - O y no modelo torto.
 * @param {number} z - O z no modelo torto.
 * @returns {number[]} [x, y, z] no bairro direito.
 */
export function endireitar(x, y, z) {
    return [
        M[0] * x + M[1] * y + M[2] * z,
        M[3] * x + M[4] * y + M[5] * z,
        M[6] * x + M[7] * y + M[8] * z
    ];
}
