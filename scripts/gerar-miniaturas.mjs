/**
 * Prepara as imagens das miniaturas dos marcadores do mapa.
 *
 * Cada marcador mostra, num rectângulo por cima do bairro, a imagem que o
 * palco mostra do vídeo seguinte: o primeiro instante de um testemunho, a
 * vista com que uma rota abre, a fotografia do alto do bairro, a primeira
 * fotografia de satélite do Retroceder. Fazer essas imagens no navegador
 * de quem visita era lento — um vídeo inteiro pedido à nuvem por cada
 * testemunho, só para lhe tirar a primeira imagem, uma de cada vez, e só
 * depois de o bairro abrir. Por isso são feitas aqui, uma vez, e guardadas
 * no site (public/miniaturas/), pequenas, prontas a chegar com o bairro.
 *
 *     bun scripts/gerar-miniaturas.mjs
 *
 * Volta a correr-se quando se acrescenta um marcador ou muda a imagem de
 * onde a miniatura sai. Um marcador sem imagem preparada continua a ter
 * miniatura: o site fá-la à moda antiga, devagar (ver encherMiniaturas em
 * public/annotations.mjs).
 *
 * Precisa do ffmpeg, com WebP.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fontesDeVideo, previaDe, olharInicialDe, ABERTURA_INICIAL, VIDEOS_360 } from '../public/videos.mjs';
import { projetarPrevia360 } from '../public/previa-360.mjs';
import { FOTOGRAFIAS, enderecoDa, LARGURA_NITIDA } from '../public/timelapse.mjs';

const PUBLICO = join(import.meta.dir, '..', 'public');
const PASTA = join(PUBLICO, 'miniaturas');

// O tamanho da tela das miniaturas (LARGURA_DA_MINIATURA e
// ALTURA_DA_MINIATURA em annotations.mjs).
const LARGURA = 480;
const ALTURA = 270;

// A vista das rotas é feita ao dobro e depois reduzida: a conta escolhe um
// ponto da fotografia por cada ponto da vista, e à medida certa as linhas
// finas saíam aos dentes.
const DOBRO = 2;

// WebP: pesa metade de um JPEG com o mesmo aspecto. As doze juntas ficam
// abaixo de um único bocado do bairro.
const WEBP = ['-c:v', 'libwebp', '-quality', '80', '-compression_level', '6'];

// Encher o rectângulo todo, cortando por igual o que sobra (como
// desenharACobrir, em annotations.mjs). As cores vão para as do WebP; os
// vídeos não dizem as deles, e o navegador lê-os como alta definição
// (BT.709) — é assim que se leem aqui também.
const cobrir = (matriz) =>
    `scale=${LARGURA}:${ALTURA}:force_original_aspect_ratio=increase:flags=lanczos` +
    `:in_color_matrix=${matriz}:out_color_matrix=bt601,crop=${LARGURA}:${ALTURA},format=yuv420p`;

function ffmpeg(args, entrada) {
    const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], {
        input: entrada,
        maxBuffer: 1 << 30
    });
    if (r.error) {
        throw new Error(r.error.code === 'ENOENT' ? 'ffmpeg não encontrado' : r.error.message);
    }
    if (r.status !== 0) throw new Error(r.stderr.toString().trim());
    return r.stdout;
}

const local = (endereco) => join(PUBLICO, decodeURIComponent(endereco));

// O primeiro instante de um testemunho, da versão de 1080 linhas (mais
// nítida do que a de 480 que o navegador usava, e reduzida aqui).
function deVideo(nome, destino) {
    const fontes = fontesDeVideo(nome);
    const fonte = fontes['1080p'] || fontes['720p'] || fontes['480p'];
    ffmpeg(['-i', fonte, '-frames:v', '1', '-vf', cobrir('bt709'), ...WEBP, destino]);
}

function deFotografia(caminho, destino) {
    ffmpeg(['-i', caminho, '-frames:v', '1', '-vf', cobrir('bt601'), ...WEBP, destino]);
}

// A vista com que uma rota abre, com a mesma conta da janela do lado do
// palco (previa-360.mjs).
function deRota(nome, destino) {
    const caminho = local(previaDe(nome));
    const [fw, fh] = medidas(caminho);
    const origem = ffmpeg(['-i', caminho, '-f', 'rawvideo', '-pix_fmt', 'rgba', '-']);
    const W = LARGURA * DOBRO;
    const H = ALTURA * DOBRO;
    const vista = new Uint8Array(W * H * 4);
    projetarPrevia360(origem, fw, fh, vista, W, H, olharInicialDe(nome), ABERTURA_INICIAL);
    ffmpeg(['-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-i', '-',
        '-vf', `scale=${LARGURA}:${ALTURA}:flags=area,format=yuv420p`, ...WEBP, destino], vista);
}

function medidas(caminho) {
    const r = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0',
        '-show_entries', 'stream=width,height', '-of', 'csv=p=0', caminho]);
    const [w, h] = r.stdout.toString().trim().split(',').map(Number);
    if (!w || !h) throw new Error('Sem medidas: ' + caminho);
    return [w, h];
}

// Os testemunhos são os marcadores com vídeo, lidos da própria lista do
// mapa para não haver outra a dizer coisas diferentes.
const anotacoes = readFileSync(join(PUBLICO, 'annotations.mjs'), 'utf8');
const testemunhos = [...anotacoes.matchAll(/^\s*video:\s*"([^"]+)"/gm)].map((m) => m[1]);

// O nome de cada ficheiro é o de nomeDaMiniatura, em annotations.mjs.
const trabalho = [
    ['olho-de-aguia', (d) => deFotografia(join(PUBLICO, 'ceu-olho-de-aguia.jpg'), d)],
    ['retroceder', (d) => deFotografia(local(enderecoDa(FOTOGRAFIAS[0], LARGURA_NITIDA)), d)],
    // A vista com que o mapa dos bairros abre (scripts/fazer-vista-dos-bairros.py).
    ['mapa-dos-bairros', (d) => deFotografia(join(PUBLICO, 'mapa-dos-bairros', 'vista.jpg'), d)],
    ...VIDEOS_360.map((nome) => [nome, (d) => deRota(nome, d)]),
    ...testemunhos.map((nome) => [nome, (d) => deVideo(nome, d)])
];

mkdirSync(PASTA, { recursive: true });
let falhas = 0;
let total = 0;
for (const [nome, fazer] of trabalho) {
    const destino = join(PASTA, nome + '.webp');
    try {
        fazer(destino);
        const peso = statSync(destino).size;
        total += peso;
        console.log(`ok     ${nome}  (${(peso / 1024).toFixed(0)} KB)`);
    } catch (erro) {
        falhas++;
        console.log(`FALHOU ${nome}: ${erro.message}`);
    }
}
console.log(`\n${trabalho.length - falhas} miniaturas, ${(total / 1024).toFixed(0)} KB ao todo.`);
process.exit(falhas ? 1 : 0);
